/**
 * Vite 编译插件类型定义
 */

/**
 * 插件配置选项（全部可选，零配置时使用默认值）
 */
export interface HiliCompileOptions {
  /**
   * 是否启用静态提升
   * 将纯静态的 h() 子树提升为模块级常量（使用点克隆复用）
   * 默认：true，但仅生产构建生效（与 Vue plugin-vue 一致）
   */
  hoistStatic?: boolean;

  /**
   * 是否预计算组件类型
   * 在 defineComponent 和 class 组件后注入 __hili_type 标记
   * 默认：true（dev/prod 均生效）
   */
  compileComponentType?: boolean;

  /**
   * 是否预分类属性
   * 将 onXxx 事件提取为 __events，ref 提取为 __ref
   * 默认：true（dev/prod 均生效）
   */
  compileAttrs?: boolean;

  /**
   * 是否在开发模式下也执行转换
   * 默认：true —— dev/prod 使用同一套编译产物（与 Vue/Solid 一致），
   * 消除双路径行为差异；设 false 回到旧行为（dev 零转换）
   */
  dev?: boolean;

  /**
   * 包含的文件 glob 模式
   * 默认：[/\.tsx?$/]
   */
  include?: RegExp[];

  /**
   * 排除的文件 glob 模式
   * 默认排除 node_modules、测试文件、框架核心文件
   */
  exclude?: RegExp[];

  /**
   * 编译产物引用的内部函数导入路径
   * 默认：'@/core/internal'（需要与项目的 @/core 别名一致）
   * 若用户项目使用不同的别名/包名，可在此覆盖
   */
  internalImportSource?: string;
}

/**
 * 转换上下文（内部使用）
 */
export interface TransformContext {
  /** 是否为生产环境（真实环境，非编译选项） */
  isProduction: boolean;
  /** 是否启用静态提升 */
  hoistStatic: boolean;
  /** 是否预计算组件类型 */
  compileComponentType: boolean;
  /** 是否预分类属性 */
  compileAttrs: boolean;
  /** 静态提升变量计数器 */
  hoistedCount: number;
  /** export default 改写临时变量计数器 */
  defaultExportCount: number;
  /** 当前文件名 */
  filename: string;
  /** 内部函数导入路径 */
  internalImportSource: string;
  /**
   * 已使用的内部函数名集合（按需注入 import）
   * 用 string[] 而非 Set：避免 Set 展开迭代在低 target / 无 downlevelIteration
   * 环境下产生 error 类型，触发 no-unsafe-call
   */
  usedInternalFns: string[];
  /** 静态提升声明列表（按依赖顺序收集，最后统一注入） */
  hoistedDecls: string[];
}
