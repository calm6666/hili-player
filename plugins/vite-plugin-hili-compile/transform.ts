/**
 * AST 转换核心模块
 *
 * 使用 Babel 解析源码为 AST，识别 h() 调用模式，
 * 将其替换为专用的内部函数，消除运行时类型判断。
 *
 * 转换策略：
 * 1. h('div', { class: 'x' }, 'text')  →  _createStaticEl(...)  （静态提升）
 * 2. h('div', { onClick: fn }, child)  →  _createEl(...)         （属性预分类）
 * 3. h('svg', {}, h('circle', {}))     →  _createSvgEl(...)      （SVG 预设命名空间）
 * 4. h('fragment', {}, ...)            →  _createFragment(...)   （Fragment 优化）
 * 5. h(MyComp, { prop: val })          →  _createComp(...)       （组件类型预计算）
 * 6. defineComponent(...)              →  注入 __hili_type = 'fn'
 * 7. class extends Component           →  注入 __hili_type = 'class'
 */

import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import * as t from "@babel/types";
import MagicString from "magic-string";
import { SVG_TAGS } from "./svgTags";
import type { TransformContext } from "./types";

// Babel traverse 的 CommonJS 导出兼容
const traverse = (
  _traverse as unknown as { default: typeof _traverse }
).default || _traverse;

/**
 * 需要注入的内部函数导入语句
 * 当文件中有转换发生时，在文件顶部注入此导入
 */
const INTERNAL_IMPORT =
  "import { _createStaticEl, _createEl, _createSvgEl, _createFragment, _createComp } from '@/core/internal';\n";

/**
 * 主转换函数
 *
 * @param code - 源码字符串
 * @param filename - 文件名（用于 sourcemap）
 * @param options - 转换选项
 * @returns 转换后的代码和 sourcemap，或 null（无需转换）
 */
export function transformCode(
  code: string,
  filename: string,
  options: {
    isProduction: boolean;
    hoistStatic: boolean;
    compileComponentType: boolean;
    compileAttrs: boolean;
  },
): { code: string; map: unknown } | null {
  // 解析源码为 AST
  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "decorators-legacy"],
      // ★ 生产构建禁用 errorRecovery：语法错误时宁可跳过转换也不做错误输出
      // dev 模式保留 errorRecovery 以支持不完全代码片段的 HMR
      errorRecovery: !options.isProduction,
    });
  } catch {
    // 解析失败，返回原码
    return null;
  }

  // errorRecovery 可能产生 errors 数组 — 有语法错误时跳过转换
  if ((ast as { errors?: unknown[] }).errors?.length) {
    return null;
  }

  const s = new MagicString(code);
  const ctx: TransformContext = {
    isProduction: options.isProduction,
    hoistStatic: options.hoistStatic,
    compileComponentType: options.compileComponentType,
    compileAttrs: options.compileAttrs,
    hoistedCount: 0,
    filename,
  };

  let hasTransformed = false;
  let needsInternalImport = false;

  traverse(ast, {
    CallExpression(path) {
      // 1. 标记 defineComponent 返回值为函数组件
      if (ctx.compileComponentType && markComponentType(path, s)) {
        hasTransformed = true;
      }

      // 2. 转换 h() 调用
      const result = transformHCall(path, s, ctx);
      if (result) {
        hasTransformed = true;
        needsInternalImport = true;
      }
    },

    // 3. 标记 class extends Component 为类组件
    ClassDeclaration(path) {
      if (!ctx.compileComponentType) return;
      if (markClassComponent(path, s)) {
        hasTransformed = true;
      }
    },
  });

  // 如果没有修改，返回 null
  if (!hasTransformed) return null;

  // 注入内部函数导入
  if (needsInternalImport) {
    s.prepend(INTERNAL_IMPORT);
  }

  return {
    code: s.toString(),
    map: s.generateMap({ source: filename, hires: true }),
  };
}

/**
 * 判断是否为 h() 调用
 */
function isHCall(node: t.CallExpression): boolean {
  return t.isIdentifier(node.callee) && node.callee.name === "h";
}

/**
 * 判断 AST 节点是否为静态值（字面量）
 */
function isStaticValue(node: t.Node): boolean {
  if (t.isStringLiteral(node)) return true;
  if (t.isNumericLiteral(node)) return true;
  if (t.isBooleanLiteral(node)) return true;
  if (t.isNullLiteral(node)) return true;
  if (t.isObjectExpression(node)) {
    return node.properties.every((prop) => {
      if (t.isObjectProperty(prop) && !prop.computed) {
        return isStaticValue(prop.value);
      }
      return false;
    });
  }
  if (t.isArrayExpression(node)) {
    return node.elements.every((el) => el === null || isStaticValue(el));
  }
  return false;
}

/**
 * 判断 h() 调用的所有参数是否全为静态字面量
 */
function isAllStatic(args: t.Expression[]): boolean {
  return args.every((arg) => {
    if (t.isStringLiteral(arg)) return true;
    if (t.isNumericLiteral(arg)) return true;
    if (t.isBooleanLiteral(arg)) return true;
    if (t.isNullLiteral(arg)) return true;
    if (t.isObjectExpression(arg)) {
      return arg.properties.every((prop) => {
        if (t.isObjectProperty(prop) && !prop.computed) {
          return isStaticValue(prop.value);
        }
        return false;
      });
    }
    return false;
  });
}

/**
 * 转换 h() 调用
 *
 * 根据第一个参数（tag）的类型，分流到不同的转换逻辑：
 * - 字符串字面量 → 根据 tag 内容选择 _createStaticEl/_createEl/_createSvgEl/_createFragment
 * - 标识符/成员表达式 → _createComp（组件调用）
 */
function transformHCall(
  path: { node: t.CallExpression },
  s: MagicString,
  ctx: TransformContext,
): boolean {
  const node = path.node;
  if (!isHCall(node)) return false;

  const args = node.arguments;
  if (args.length === 0) return false;

  const tagArg = args[0];

  // 情况 1：标签为字符串字面量
  if (t.isStringLiteral(tagArg)) {
    const tag = tagArg.value;

    // Fragment → _createFragment
    if (tag === "fragment") {
      s.overwrite(node.callee.start!, node.callee.end!, "_createFragment");
      return true;
    }

    // SVG 标签 → _createSvgEl
    if (SVG_TAGS.has(tag)) {
      s.overwrite(node.callee.start!, node.callee.end!, "_createSvgEl");
      // 属性预分类
      if (ctx.compileAttrs && args.length >= 2) {
        rewriteAttrs(node, s);
      }
      return true;
    }

    // 普通元素
    if (ctx.hoistStatic && isAllStatic(args as t.Expression[])) {
      // 全静态 → 静态提升到模块级
      const hoistedName = `_hoisted_${++ctx.hoistedCount}`;
      // 使用 s.original.slice 而非 s.slice，避免在已修改位置上读取失败
      const callCode = s.original.slice(node.start!, node.end!);
      // 替换 h( 为 _createStaticEl(
      const hoistedCode = callCode.replace(
        /\bh\(/,
        "_createStaticEl(",
      );
      s.prepend(`const ${hoistedName} = ${hoistedCode};\n`);
      s.overwrite(node.start!, node.end!, hoistedName);
      return true;
    }

    // 动态元素 → _createEl + 属性预分类
    s.overwrite(node.callee.start!, node.callee.end!, "_createEl");
    if (ctx.compileAttrs && args.length >= 2) {
      rewriteAttrs(node, s);
    }
    return true;
  }

  // 情况 2：标签为标识符或成员表达式（组件引用）
  if (t.isIdentifier(tagArg) || t.isMemberExpression(tagArg)) {
    s.overwrite(node.callee.start!, node.callee.end!, "_createComp");
    // 注意：组件调用不做属性预分类！
    // 组件上的 onMounted/onReady 等是生命周期回调，不是 DOM 事件
    // 只有 DOM 元素上的 onClick/onInput 才是事件
    return true;
  }

  return false;
}

/**
 * 属性预分类
 *
 * 将 onXxx 事件属性提取到 __events 对象中，
 * 将 ref 属性重命名为 __ref，
 * 让运行时 applyAttrs 跳过遍历判断。
 *
 * 实现方式：直接替换整个 attrs 对象字符串，避免逐个属性移除的复杂位置计算
 */
function rewriteAttrs(node: t.CallExpression, s: MagicString): void {
  const args = node.arguments;
  if (args.length < 2) return;

  const attrsArg = args[1];
  if (!t.isObjectExpression(attrsArg)) return;

  const events: string[] = [];
  const remainingProps: string[] = [];

  for (const prop of attrsArg.properties) {
    // 非 ObjectProperty（如 SpreadElement）直接保留
    if (!t.isObjectProperty(prop) || prop.computed) {
      const propCode = s.original.slice(prop.start!, prop.end!);
      remainingProps.push(propCode);
      continue;
    }

    // 获取属性名
    let keyName = "";
    let keyStr = "";
    if (t.isIdentifier(prop.key)) {
      keyName = prop.key.name;
      keyStr = prop.key.name;
    } else if (t.isStringLiteral(prop.key)) {
      keyName = prop.key.value;
      keyStr = `'${prop.key.value}'`;
    } else {
      const propCode = s.original.slice(prop.start!, prop.end!);
      remainingProps.push(propCode);
      continue;
    }

    const valueCode = s.original.slice(prop.value.start!, prop.value.end!);

    // 事件属性：onXxx → __events.xxx
    if (
      keyName.startsWith("on") &&
      keyName.length > 2 &&
      keyName[2] === keyName[2].toUpperCase()
    ) {
      const eventName = keyName.slice(2).toLowerCase();
      events.push(`${eventName}: ${valueCode}`);
    } else if (keyName === "ref") {
      // ref 属性 → __ref
      remainingProps.push(`__ref: ${valueCode}`);
    } else {
      // 普通属性保留
      remainingProps.push(`${keyStr}: ${valueCode}`);
    }
  }

  // 构建 __events 字符串
  if (events.length > 0) {
    remainingProps.push(`__events: { ${events.join(", ")} }`);
  }

  // 用新的 attrs 对象替换原始的
  const newAttrsStr = `{ ${remainingProps.join(", ")} }`;
  s.overwrite(attrsArg.start!, attrsArg.end!, newAttrsStr);
}

/**
 * 标记 defineComponent 返回值为函数组件
 *
 * 支持以下写法：
 * - const MyComp = defineComponent(...)
 * - export const MyComp = defineComponent(...)
 * - export default defineComponent(...)
 */
function markComponentType(
  path: { node: t.CallExpression; parentPath?: { node: t.Node; parentPath?: { node: t.Node } | null } | null },
  s: MagicString,
): boolean {
  const node = path.node;
  if (!t.isCallExpression(node)) return false;

  const callee = node.callee;
  if (!t.isIdentifier(callee) || callee.name !== "defineComponent") return false;

  // 找到赋值目标：const MyComp = defineComponent(...)
  const parentPath = path.parentPath;
  if (!parentPath) return false;
  const parent = parentPath.node;

  // 情况 1：const MyComp = defineComponent(...)
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
    const compName = parent.id.name;
    const insertPos = node.end!;
    s.appendRight(insertPos, `;\n${compName}.__hili_type = 'fn'`);
    return true;
  }

  // 情况 2：export default defineComponent(...)
  // export default 没有变量名，无法注入 __hili_type 标记
  // _createComp 的 fallback 会走 h() 通用路径处理
  if (t.isExportDefaultDeclaration(parent)) {
    return false;
  }

  return false;
}

/**
 * 标记 class extends Component 为类组件
 *
 * 在 `class MyClass extends Component { ... }` 后注入：
 * MyClass.__hili_type = 'class';
 */
function markClassComponent(
  path: { node: t.ClassDeclaration },
  s: MagicString,
): boolean {
  const node = path.node;
  if (!t.isClassDeclaration(node)) return false;

  // 检查是否 extends Component
  const superClass = node.superClass;
  if (!superClass) return false;

  const superName = t.isIdentifier(superClass) ? superClass.name : "";
  if (superName !== "Component") return false;

  const className = node.id?.name;
  if (!className) return false;

  // 在类声明后注入类型标记
  const insertPos = node.end!;
  s.appendRight(insertPos, `;\n${className}.__hili_type = 'class'`);
  return true;
}
