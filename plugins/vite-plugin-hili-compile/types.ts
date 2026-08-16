/**
 * Vite 编译插件类型定义
 */

/**
 * 插件配置选项（全部可选，零配置时使用默认值）
 */
export interface HiliCompileOptions {
  /**
   * 是否启用静态提升
   * 将纯静态的 h() 调用提升到模块级常量
   * 默认：true（仅生产环境生效）
   */
  hoistStatic?: boolean;

  /**
   * 是否预计算组件类型
   * 在 defineComponent 和 class 组件后注入 __hili_type 标记
   * 默认：true（仅生产环境生效）
   */
  compileComponentType?: boolean;

  /**
   * 是否预分类属性
   * 将 onXxx 事件提取为 __events，ref 提取为 __ref
   * 默认：true（仅生产环境生效）
   */
  compileAttrs?: boolean;

  /**
   * 是否在开发模式下也启用转换
   * 默认：false（开发模式零开销，保持 HMR 速度）
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
}

/**
 * 转换上下文（内部使用）
 */
export interface TransformContext {
  /** 是否为生产环境 */
  isProduction: boolean;
  /** 是否启用静态提升 */
  hoistStatic: boolean;
  /** 是否预计算组件类型 */
  compileComponentType: boolean;
  /** 是否预分类属性 */
  compileAttrs: boolean;
  /** 静态提升变量计数器 */
  hoistedCount: number;
  /** 当前文件名 */
  filename: string;
}
