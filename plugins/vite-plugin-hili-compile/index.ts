/**
 * vite-plugin-hili-compile
 *
 * 零配置 Vite 编译插件
 * 参照 Vue/Solid/Svelte 插件设计模式：
 * - 自动检测 dev/prod 环境（configResolved）
 * - 自动注入 __HILI_DEV__ 常量（config.define）
 * - Dev 模式零开销（transform return null）
 * - Prod 模式全量 AST 优化转换
 *
 * 智能文件过滤：
 * - Vue 只处理 .vue 文件，Solid 只处理含 JSX 的文件
 * - 本插件只处理「真正使用了框架 API」的文件：
 *   通过检测 import 语句判断文件是否引入了 h/defineComponent 等
 *   纯工具函数文件（即使有 class）不会被转换
 *
 * 使用方式：
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { hiliCompile } from './plugins/vite-plugin-hili-compile';
 *
 * export default defineConfig({
 *   plugins: [hiliCompile()],  // 零配置，自动检测环境
 * });
 * ```
 */

import type { Plugin, ResolvedConfig } from "vite";
import { transformCode } from "./transform";
import type { HiliCompileOptions } from "./types";

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<HiliCompileOptions> = {
  hoistStatic: true,
  compileComponentType: true,
  compileAttrs: true,
  dev: false,
  include: [/\.tsx?$/],
  exclude: [
    /node_modules/,
    /\.test\./,
    /\.spec\./,
    // 框架源码目录不转换（框架自身 export API，不是消费者）
    // 与 Solid 排除 node_modules/solid-js 的逻辑一致
    // 应用代码在 demo/、packages/ 等目录中
    /[\\\/]core[\\\/]/,
    // 插件自身源码不转换
    /plugins[\/\\]vite-plugin-hili-compile/,
  ],
};

/**
 * 框架 API 标识符
 * 只有 import 这些标识符的文件才被视为组件文件
 * 与 Vue 只处理 .vue、Solid 只处理 JSX 的思路一致：
 * 通过文件内容特征判断，而非硬编码路径
 */
const FRAMEWORK_IMPORTS = [
  "h",               // h() VNode 创建函数
  "defineComponent", // defineComponent() 组件定义
  "Fragment",        // Fragment 标签
  "show",            // show() 条件渲染
  "each",            // each() 列表渲染
];

/**
 * 预编译的框架 API 检测正则（模块级，避免每次 transform 重新创建）
 * 匹配 import { h, defineComponent, ... } from '...' 或 import { h as alias } from '...'
 */
const FRAMEWORK_REGEXPS: RegExp[] = FRAMEWORK_IMPORTS.map(
  (name) =>
    new RegExp(
      `\\bimport\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]`,
    ),
);

/**
 * 快速检测文件是否真正使用了框架 API
 *
 * 通过检查 import 语句判断：
 * - 如果文件 import 了 h/defineComponent 等，说明是组件文件，需要转换
 * - 如果文件没有 import 这些，说明是纯工具/类型文件，跳过
 *
 * @param code - 源码内容
 * @returns true 表示文件使用了框架 API，需要转换
 */
function usesFrameworkAPI(code: string): boolean {
  for (const regex of FRAMEWORK_REGEXPS) {
    if (regex.test(code)) return true;
  }
  return false;
}

/**
 * 创建 hili-compile Vite 插件
 *
 * @param options - 可选配置（全部可选，零配置时使用默认值）
 * @returns Vite 插件对象
 */
export function hiliCompile(options?: HiliCompileOptions): Plugin {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 闭包变量：存储环境信息
  let isServe = false;
  let isProduction = false;

  return {
    name: "hili-compile",

    /**
     * config 钩子：自动注入环境变量
     *
     * 与 Solid 插件模式一致：使用 config 第二参数的 command 判断环境
     * 注意：config 钩子运行在 configResolved 之前，此时闭包变量还未设置，
     * 所以必须使用 command 参数而非闭包变量
     */
    config(_userConfig, { command }) {
      const isBuild = command === "build";
      return {
        define: {
          __HILI_DEV__: JSON.stringify(!isBuild),
        },
      };
    },

    /**
     * configResolved 钩子：自动检测当前环境
     *
     * 与 Vue/Svelte 插件完全一致的模式：
     * - serve: vite dev 启动开发服务器
     * - build: vite build 生产打包
     */
    configResolved(resolvedConfig: ResolvedConfig) {
      isServe = resolvedConfig.command === "serve";
      isProduction = resolvedConfig.isProduction;
    },

    /**
     * transform 钩子：根据环境自动分流
     *
     * 三层过滤策略：
     * 1. 文件扩展名过滤（include/exclude）
     * 2. 内容过滤：检测文件是否真正 import 了框架 API
     * 3. 环境过滤：dev 模式跳过，prod 模式转换
     *
     * - Dev 模式（且 dev=false）：跳过转换，保持 HMR 速度
     * - Prod 模式：全量优化（静态提升、组件类型预计算、属性预分类）
     */
    transform(code: string, id: string) {
      // 第一层：文件扩展名过滤
      const isIncluded = opts.include.some((pattern) => pattern.test(id));
      if (!isIncluded) return null;

      const isExcluded = opts.exclude.some((pattern) => pattern.test(id));
      if (isExcluded) return null;

      // 第二层：内容过滤 —— 只转换真正使用了框架 API 的文件
      // 参照 Vue 只处理 .vue、Solid 只处理 JSX 的思路
      // 纯工具/类型文件即使有 class 也不会被转换
      if (!usesFrameworkAPI(code)) return null;

      // 第三层：环境过滤
      // 开发模式：默认不做转换，保持 HMR 速度
      if (isServe && !isProduction && !opts.dev) {
        return null;
      }

      // 生产模式或 dev=true：执行 AST 转换
      const result = transformCode(code, id, {
        isProduction: isProduction || opts.dev,
        hoistStatic: opts.hoistStatic,
        compileComponentType: opts.compileComponentType,
        compileAttrs: opts.compileAttrs,
      });

      if (!result) return null;

      return {
        code: result.code,
        map: result.map as never,
      };
    },
  };
}

export type { HiliCompileOptions };
