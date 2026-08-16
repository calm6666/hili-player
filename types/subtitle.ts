/**
 * ============================================
 * 字幕类型定义
 * ============================================
 * 合并 player 和 plugin 的字幕类型，纯类型定义，零运行时依赖
 * player 和 plugins 包均从此导入
 *
 * @module types/subtitle
 */

/** 字幕文件格式 */
export enum SubtitleFormat {
  SRT = 'srt',
  ASS = 'ass',
  SSA = 'ssa',
  VTT = 'vtt',
  UNKNOWN = 'unknown',
}

/** 字幕样式 */
export interface SubtitleStyle {
  /** 字体名称 */
  fontName?: string;
  /** 字体大小 */
  fontSize?: number;
  /** 主颜色 */
  primaryColor?: string;
  /** 描边颜色 */
  outlineColor?: string;
  /** 描边宽度 */
  outlineWidth?: number;
  /** 粗体 */
  bold?: boolean;
  /** 斜体 */
  italic?: boolean;
  /** 下划线 */
  underline?: boolean;
  /** 删除线 */
  strikeout?: boolean;
  /** 对齐方式：1-左下, 2-中下, 3-右下, 4-左中, 5-中中, 6-右中, 7-左上, 8-中上, 9-右上 */
  alignment?: number;
  /** 左边距 */
  marginL?: number;
  /** 右边距 */
  marginR?: number;
  /** 垂直边距 */
  marginV?: number;
}

/** 字幕项 */
export interface SubtitleItem {
  /** 唯一标识 */
  id: number;
  /** 开始时间 (秒) */
  startTime: number;
  /** 结束时间 (秒) */
  endTime: number;
  /** 字幕文本 (支持多行) */
  text: string;
  /** 样式信息 (ASS格式) */
  style?: SubtitleStyle;
}

/** 解析后的字幕数据 */
export interface ParsedSubtitle {
  /** 格式类型 */
  format: SubtitleFormat;
  /** 字幕项列表 */
  items: SubtitleItem[];
  /** 全局样式 (ASS格式) */
  globalStyle?: SubtitleStyle;
  /** 原始标题 (ASS格式) */
  title?: string;
}

/** 字幕源 */
export interface SubtitleSource {
  /** 字幕 URL */
  src: string;
  /** 语言代码 */
  lang: string;
  /** 显示名称 */
  label: string;
  /** 默认选中 */
  default?: boolean;
}
