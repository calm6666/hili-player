/**
 * AST 转换核心模块
 *
 * 使用 Babel 解析源码为 AST，识别框架 h() 调用模式，
 * 将其替换为专用的内部函数，消除运行时类型判断。
 *
 * 转换策略：
 * 1. h('div', { class: 'x' }, 'text')  →  _createStaticEl(...)   （静态提升）
 * 2. h('div', { onClick: fn }, child)  →  _createEl(...)          （属性预分类）
 * 3. h('svg', {}, h('circle', {}))     →  _createSvgEl(...)       （SVG 预设命名空间）
 * 4. h('fragment', {}, ...)            →  _createFragment(...)    （Fragment 优化）
 * 5. h(MyComp, { prop: val })          →  _createComp(...)        （组件类型预计算）
 * 6. defineComponent(...)              →  注入 __hili_type = 'fn'
 * 7. class extends Component           →  注入 __hili_type = 'class'
 *
 * 安全设计（与 Vue/Solid 一致）：
 * - 所有转换都通过 babel scope 校验标识符来源：只有来自框架模块
 *   （@/core、@/hili-player 等）的 h/defineComponent/Fragment/Component
 *   才会被转换，绝不误伤其他库的同名导出（如 preact 的 h）
 * - 静态提升递归识别整棵静态子树（AST 级代码生成，无字符串拼接冲突），
 *   提升常量为共享对象，使用点通过 _cloneHoisted() 克隆复用
 */

import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import * as t from "@babel/types";
import MagicString from "magic-string";
import { SVG_TAGS } from "./svgTags";
import type { TransformContext } from "./types";

// Babel traverse 的 CommonJS 导出兼容
//
// ★ 用最小结构类型代替 @babel/traverse@8 的 NodePath：
// babel 8 仍处于 beta，其手写的 NodePath 类型体量巨大（数千行条件类型），
// 在部分 TypeScript / typescript-eslint 版本下会被解析为 error 类型，
// 触发 no-unsafe-call（"Unsafe call of an `error` type typed value"）。
// 这里只声明插件实际用到的成员，与真实 NodePath 结构兼容。
type BabelPath = {
  node: t.Node;
  parentPath: BabelPath | null;
  scope: {
    getBinding(name: string): { path: BabelPath } | undefined;
  };
  isCallExpression(): boolean;
  isImportSpecifier(): boolean;
  isImportDeclaration(): boolean;
  get(key: string | number): BabelPath | BabelPath[];
  findParent(predicate: (path: BabelPath) => boolean): BabelPath | null;
};

type TraverseVisitor = {
  CallExpression?: { exit?: (path: BabelPath) => void };
  ClassDeclaration?: (path: BabelPath) => void;
};

type TraverseFn = (ast: t.File, visitor: TraverseVisitor) => void;

const traverse: TraverseFn = (
  (_traverse as unknown as { default?: unknown }).default || _traverse
) as unknown as TraverseFn;

/**
 * 框架模块来源检测
 *
 * 只有来自框架模块的具名导入才会被转换。匹配：
 * - @/core、@/core/xxx
 * - @/hili-player/xxx、hili-player
 * - 相对路径中的 core 目录（../../core）
 */
const FRAMEWORK_MODULE_RE = /(?:^|[\\/@])core(?:[\\/]|$)|hili-player/;

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
    internalImportSource?: string;
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
    defaultExportCount: 0,
    filename,
    internalImportSource: options.internalImportSource ?? "@/core/internal",
    usedInternalFns: [],
    hoistedDecls: [],
  };

  // ========== 预扫描 1：自底向上标记静态子树（仅静态提升需要） ==========
  const staticSubtreeMap = new WeakMap<t.CallExpression, boolean>();
  if (ctx.hoistStatic) {
    traverse(ast, {
      CallExpression: {
        exit(path) {
          const node = path.node as t.CallExpression;
          if (!t.isStringLiteral(node.arguments[0])) return;
          staticSubtreeMap.set(node, isStaticSubtree(path, staticSubtreeMap));
        },
      },
    });
  }

  // ========== 预扫描 2：标记提升目标（静态子树且无静态 h() 祖先） ==========
  // 只有顶层静态子树才会被整体提升，嵌套的静态调用内联进父级生成代码，
  // 避免同一子树被提升两次、产生死代码和 MagicString 编辑冲突
  const hoistTargets = new Set<t.CallExpression>();
  if (ctx.hoistStatic) {
    traverse(ast, {
      CallExpression: {
        exit(path) {
          const node = path.node as t.CallExpression;
          if (staticSubtreeMap.get(node) !== true) return;
          if (hasStaticHAncestor(path, staticSubtreeMap)) return;
          hoistTargets.add(node);
        },
      },
    });
  }

  let hasTransformed = false;

  traverse(ast, {
    CallExpression: {
      // exit 顺序（子先父后）：保证嵌套调用先被转换/提升，
      // 父级在生成代码/切片时能读到子级的编辑结果
      exit(path) {
        // 1. 标记 defineComponent 返回值为函数组件
        if (ctx.compileComponentType && markComponentType(path, s, ctx)) {
          hasTransformed = true;
        }

        // 2. 转换 h() 调用
        if (transformHCall(path, s, ctx, hoistTargets)) {
          hasTransformed = true;
        }
      },
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

  // 注入内部函数导入（按实际使用按需注入）
  if (ctx.usedInternalFns.length > 0) {
    const importNames = ctx.usedInternalFns.sort().join(", ");
    s.prepend(`import { ${importNames} } from '${ctx.internalImportSource}';\n`);
  }

  // 注入静态提升声明（先 prepend 声明再 prepend import，import 保持在最前）
  if (ctx.hoistedDecls.length > 0) {
    s.prepend(ctx.hoistedDecls.join(""));
  }

  return {
    code: s.toString(),
    map: s.generateMap({ source: filename, hires: true }),
  };
}

/**
 * 记录已使用的内部函数名（去重）
 *
 * 用 string[] + indexOf 去重，避免 Set 迭代在低 target 环境下产生 error 类型
 */
function markUsed(ctx: TransformContext, name: string): void {
  if (ctx.usedInternalFns.indexOf(name) === -1) {
    ctx.usedInternalFns.push(name);
  }
}

/**
 * 判断标识符是否来自框架模块的具名导入
 *
 * 通过 babel scope 解析 binding，要求：
 * 1. 是 import 语句的具名导入（ImportSpecifier）
 * 2. 导入的原始名称匹配 importedName（支持 import { h as alias } 别名）
 * 3. 导入来源是框架模块（FRAMEWORK_MODULE_RE）
 *
 * binding 不存在（局部函数/全局变量/其他来源）时返回 false，绝不误伤
 */
function isFrameworkNamedImport(
  path: BabelPath,
  localName: string,
  importedName: string,
): boolean {
  const binding = path.scope.getBinding(localName);
  if (!binding) return false;
  const bindPath = binding.path;
  if (!bindPath.isImportSpecifier()) return false;

  const imported = (bindPath.node as t.ImportSpecifier).imported;
  const name = t.isIdentifier(imported) ? imported.name : imported.value;
  if (name !== importedName) return false;

  const importDecl = bindPath.findParent((p) => p.isImportDeclaration());
  if (!importDecl) return false;
  const source = (importDecl.node as t.ImportDeclaration).source.value;
  return FRAMEWORK_MODULE_RE.test(source);
}

/**
 * 判断 CallExpression 是否为框架的 h() 调用
 * （callee 为标识符且绑定到框架模块的 h 导出）
 */
function isFrameworkHCall(path: BabelPath): boolean {
  const callee = (path.node as t.CallExpression).callee;
  if (!t.isIdentifier(callee)) return false;
  return isFrameworkNamedImport(path, callee.name, "h");
}

/**
 * 判断当前 h() 调用是否位于另一个 h() 调用的 attrs 参数内
 *
 * attrs 值中的 h() 调用不是子节点（运行时按属性值处理），不应转换：
 * - 语义上 h() 不会把 attrs 里的 VNode 当子节点
 * - 避免与 rewriteAttrs 对 attrs 整段覆盖产生编辑冲突
 */
function isInsideAttrsOfHCall(path: BabelPath): boolean {
  let child: t.Node = path.node;
  let parent: BabelPath | null = path.parentPath;
  while (parent) {
    if (
      parent.isCallExpression() &&
      isFrameworkHCall(parent) &&
      ((parent.node as t.CallExpression).arguments as t.Node[]).indexOf(child) === 1
    ) {
      return true;
    }
    child = parent.node;
    parent = parent.parentPath;
  }
  return false;
}

/**
 * 判断 AST 节点是否为静态值（字面量）
 */
function isStaticValue(node: t.Node): boolean {
  if (t.isStringLiteral(node)) return true;
  if (t.isNumericLiteral(node)) return true;
  if (t.isBooleanLiteral(node)) return true;
  if (t.isNullLiteral(node)) return true;
  // 负数字面量：-1、-0.5 等
  if (
    t.isUnaryExpression(node) &&
    node.operator === "-" &&
    t.isNumericLiteral(node.argument)
  ) {
    return true;
  }
  // 无插值的模板字符串：`text`
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) return true;
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
 * 递归判断 h() 调用是否整棵子树静态
 *
 * 静态 = tag 为字符串字面量，且所有参数为静态字面量或静态 h() 子树。
 * 与旧版 isAllStatic 的区别：嵌套的 h() 调用也参与判定，
 * 让真实代码中的静态子树（如菜单/面板结构）能整体提升。
 *
 * @param path - h() 调用路径
 * @param cache - 静态判定缓存（自底向上填充，避免重复计算）
 */
function isStaticSubtree(
  path: BabelPath,
  cache: WeakMap<t.CallExpression, boolean>,
): boolean {
  const node = path.node as t.CallExpression;
  const cached = cache.get(node);
  if (cached !== undefined) return cached;

  const args = node.arguments;
  if (args.length === 0 || !t.isStringLiteral(args[0])) {
    cache.set(node, false);
    return false;
  }

  let result = true;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (t.isCallExpression(arg)) {
      const argPath = (path.get("arguments") as BabelPath[])[i];
      // 嵌套调用必须是框架 h() 且自身为静态子树
      if (!isFrameworkHCall(argPath) || !isStaticSubtree(argPath, cache)) {
        result = false;
        break;
      }
    } else if (!isStaticValue(arg)) {
      result = false;
      break;
    }
  }
  cache.set(node, result);
  return result;
}

/**
 * 判断静态 h() 调用是否有静态 h() 祖先
 * 有则说明它会被祖先整体提升，不应单独提升
 */
function hasStaticHAncestor(
  path: BabelPath,
  cache: WeakMap<t.CallExpression, boolean>,
): boolean {
  let parent: BabelPath | null = path.parentPath;
  while (parent) {
    if (parent.isCallExpression() && isFrameworkHCall(parent)) {
      if (cache.get(parent.node as t.CallExpression) === true) return true;
    }
    parent = parent.parentPath;
  }
  return false;
}

/**
 * 判断 h() 调用是否位于已提升的静态子树内部
 * 提升目标会整段覆盖其范围，内部的调用必须跳过编辑
 */
function hasHoistedAncestor(
  path: BabelPath,
  hoistTargets: ReadonlySet<t.CallExpression>,
): boolean {
  let parent: BabelPath | null = path.parentPath;
  while (parent) {
    if (parent.isCallExpression() && hoistTargets.has(parent.node as t.CallExpression)) {
      return true;
    }
    parent = parent.parentPath;
  }
  return false;
}

/**
 * 由 AST 生成静态子树的运行时代码
 *
 * 直接在 AST 上生成代码（而非字符串替换），彻底避免：
 * - 嵌套编辑导致的 MagicString 冲突
 * - 提升代码中残留未转换的 h() 调用
 * 仅处理 isStaticSubtree/isStaticValue 认可的节点类型。
 */
function genStaticExpr(node: t.Node, ctx: TransformContext): string {
  if (t.isStringLiteral(node)) return JSON.stringify(node.value);
  if (t.isNumericLiteral(node)) return String(node.value);
  if (t.isBooleanLiteral(node)) return node.value ? "true" : "false";
  if (t.isNullLiteral(node)) return "null";
  if (
    t.isUnaryExpression(node) &&
    node.operator === "-" &&
    t.isNumericLiteral(node.argument)
  ) {
    return `-${node.argument.value}`;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return JSON.stringify(node.quasis[0].value.cooked ?? node.quasis[0].value.raw);
  }
  if (t.isArrayExpression(node)) {
    return `[${node.elements
      .map((el) => (el === null ? "null" : genStaticExpr(el, ctx)))
      .join(", ")}]`;
  }
  if (t.isObjectExpression(node)) {
    const parts: string[] = [];
    for (const prop of node.properties) {
      if (!t.isObjectProperty(prop) || prop.computed) continue;
      let key: string;
      if (t.isIdentifier(prop.key)) key = prop.key.name;
      else if (t.isStringLiteral(prop.key)) key = JSON.stringify(prop.key.value);
      else if (t.isNumericLiteral(prop.key)) key = String(prop.key.value);
      else continue;
      parts.push(`${key}: ${genStaticExpr(prop.value, ctx)}`);
    }
    return `{ ${parts.join(", ")} }`;
  }
  if (t.isCallExpression(node)) return genStaticHCall(node, ctx);
  // 理论上不可达：isStaticSubtree 已保证只含以上节点类型
  return "null";
}

/**
 * 生成静态 h() 调用的运行时代码（嵌套调用递归生成专用函数）
 */
function genStaticHCall(node: t.CallExpression, ctx: TransformContext): string {
  const args = node.arguments as t.Expression[];
  const tag = (args[0] as t.StringLiteral).value;
  const attrs = args.length >= 2 ? genStaticExpr(args[1], ctx) : "undefined";
  const children = args
    .slice(2)
    .map((a) => genStaticExpr(a, ctx))
    .join(", ");

  // Fragment → _createFragment(...children)，丢弃 attrs 参数
  if (tag === "fragment") {
    markUsed(ctx, "_createFragment");
    return `_createFragment(${children})`;
  }

  // SVG → _createSvgEl（预设命名空间）
  if (SVG_TAGS.has(tag)) {
    markUsed(ctx, "_createSvgEl");
    return `_createSvgEl(${JSON.stringify(tag)}, ${attrs}${
      children ? `, ${children}` : ""
    })`;
  }

  // 普通静态元素
  markUsed(ctx, "_createStaticEl");
  return `_createStaticEl(${JSON.stringify(tag)}, ${attrs}${
    children ? `, ${children}` : ""
  })`;
}

/**
 * 静态提升：整棵静态子树生成模块级常量，使用点替换为 _cloneHoisted(_hoisted_N)
 *
 * 提升常量是模块级共享对象，多次渲染/多处使用会互相覆盖 el，
 * 因此使用点必须克隆（Vue 的 cloneVNode 同理）。
 */
function hoistStaticCall(
  node: t.CallExpression,
  s: MagicString,
  ctx: TransformContext,
): boolean {
  const hoistedName = `_hoisted_${++ctx.hoistedCount}`;
  ctx.hoistedDecls.push(`const ${hoistedName} = ${genStaticHCall(node, ctx)};\n`);
  markUsed(ctx, "_cloneHoisted");
  s.overwrite(node.start!, node.end!, `_cloneHoisted(${hoistedName})`);
  return true;
}

/**
 * 转换 h() 调用
 *
 * 根据第一个参数（tag）的类型，分流到不同的转换逻辑：
 * - 字符串字面量 → 静态提升 / _createSvgEl / _createFragment / _createEl
 * - 标识符/成员表达式 → _createComp（组件调用）
 */
function transformHCall(
  path: BabelPath,
  s: MagicString,
  ctx: TransformContext,
  hoistTargets: ReadonlySet<t.CallExpression>,
): boolean {
  const node = path.node as t.CallExpression;

  // 只有框架的 h() 才转换（binding 校验，避免误伤其他库）
  if (!isFrameworkHCall(path)) return false;
  // attrs 参数内的 h() 调用不是子节点，跳过
  if (isInsideAttrsOfHCall(path)) return false;

  const args = node.arguments;
  if (args.length === 0) return false;

  // 位于已提升的静态子树内部 → 由祖先整体生成代码，这里不能单独编辑
  // （否则编辑会被祖先的整段覆盖静默丢弃，且污染按需注入的 import）
  if (ctx.hoistStatic && hasHoistedAncestor(path, hoistTargets)) return false;

  const tagArg = args[0];

  // 静态提升：整棵静态子树提升为模块级常量（仅限提升目标）
  if (ctx.hoistStatic && hoistTargets.has(node)) {
    return hoistStaticCall(node, s, ctx);
  }

  // 情况 1：标签为字符串字面量
  if (t.isStringLiteral(tagArg)) {
    const tag = tagArg.value;

    // Fragment → _createFragment(...children)
    // 丢弃 attrs 参数（_createFragment 签名是 rest children，
    // 旧实现保留 attrs 会把 {} 当作第一个子节点导致运行时报错）
    if (tag === "fragment") {
      const childrenCode = args
        .slice(2)
        .map((a) => s.slice(a.start!, a.end!))
        .join(", ");
      s.overwrite(node.start!, node.end!, `_createFragment(${childrenCode})`);
      markUsed(ctx, "_createFragment");
      return true;
    }

    // SVG 标签 → _createSvgEl（预设命名空间）
    if (SVG_TAGS.has(tag)) {
      s.overwrite(node.callee.start!, node.callee.end!, "_createSvgEl");
      markUsed(ctx, "_createSvgEl");
      if (ctx.compileAttrs && args.length >= 2) {
        rewriteAttrs(node, s);
      }
      return true;
    }

    // 普通元素 → _createEl + 属性预分类
    s.overwrite(node.callee.start!, node.callee.end!, "_createEl");
    markUsed(ctx, "_createEl");
    if (ctx.compileAttrs && args.length >= 2) {
      rewriteAttrs(node, s);
    }
    return true;
  }

  // 情况 2：标签为标识符或成员表达式（组件引用）
  if (t.isIdentifier(tagArg) || t.isMemberExpression(tagArg)) {
    // h(Fragment, {}, ...children) → _createFragment(...children)
    if (
      t.isIdentifier(tagArg) &&
      args.length >= 2 &&
      t.isObjectExpression(args[1]) &&
      args[1].properties.length === 0 &&
      isFrameworkNamedImport(path, tagArg.name, "Fragment")
    ) {
      const childrenCode = args
        .slice(2)
        .map((a) => s.slice(a.start!, a.end!))
        .join(", ");
      s.overwrite(node.start!, node.end!, `_createFragment(${childrenCode})`);
      markUsed(ctx, "_createFragment");
      return true;
    }

    // 组件调用 → _createComp（组件上的 onMounted/onReady 是生命周期回调，
    // 不是 DOM 事件，因此不做属性预分类）
    s.overwrite(node.callee.start!, node.callee.end!, "_createComp");
    markUsed(ctx, "_createComp");
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
 * （attrs 内的 h() 调用已由 isInsideAttrsOfHCall 保证不会被编辑，无冲突）
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
 *   → 改写为 const _defaultComponent_N = ...; 标记; export default _defaultComponent_N;
 *     （export default 无法直接挂标记，必须经临时变量）
 */
function markComponentType(
  path: BabelPath,
  s: MagicString,
  ctx: TransformContext,
): boolean {
  const node = path.node;
  if (!t.isCallExpression(node)) return false;

  const callee = node.callee;
  if (!t.isIdentifier(callee)) return false;
  // binding 校验：只有框架的 defineComponent 才标记
  if (!isFrameworkNamedImport(path, callee.name, "defineComponent")) {
    return false;
  }

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
  if (t.isExportDefaultDeclaration(parent)) {
    // 只处理干净的 `export default defineComponent(...)` 前缀
    // 带括号/装饰等其他写法的保持原样（_createComp fallback 到 h() 仍正确）
    const prefix = s.original.slice(parent.start!, node.start!);
    if (!/^export\s+default\s*$/.test(prefix)) return false;

    const tmpName = `_defaultComponent_${++ctx.defaultExportCount}`;
    s.overwrite(parent.start!, node.start!, `const ${tmpName} = `);
    s.appendRight(
      node.end!,
      `;\n${tmpName}.__hili_type = 'fn';\nexport default ${tmpName};`,
    );
    return true;
  }

  return false;
}

/**
 * 标记 class extends Component 为类组件
 *
 * 在 `class MyClass extends Component { ... }` 后注入：
 * MyClass.__hili_type = 'class';
 *
 * 仅当父类 Component 来自框架模块时标记（binding 校验）
 */
function markClassComponent(
  path: BabelPath,
  s: MagicString,
): boolean {
  const node = path.node;
  if (!t.isClassDeclaration(node)) return false;

  // 检查是否 extends Component（必须来自框架模块）
  const superClass = node.superClass;
  if (!superClass) return false;
  const superName = t.isIdentifier(superClass) ? superClass.name : "";
  if (!superName) return false;
  if (!isFrameworkNamedImport(path, superName, "Component")) return false;

  const className = node.id?.name;
  if (!className) return false;

  // 在类声明后注入类型标记
  const insertPos = node.end!;
  s.appendRight(insertPos, `;\n${className}.__hili_type = 'class'`);
  return true;
}
