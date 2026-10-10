/**
 * 弹幕缩放辅助工具
 * 处理浏览器缩放、系统缩放和响应式缩放
 */

/** 缩放配置 */
export interface ScaleConfig {
  /** 基础参考宽度（设计稿宽度） */
  baseWidth: number;
  /** 最小缩放比例 */
  minScale: number;
  /** 最大缩放比例 */
  maxScale: number;
  /** 是否考虑设备像素比 */
  considerDevicePixelRatio: boolean;
  /** 是否考虑浏览器缩放 */
  considerBrowserZoom: boolean;
}

/** 默认缩放配置 */
const DEFAULT_CONFIG: ScaleConfig = {
  // 参考哔哩哔哩：以网页播放器基准宽度 950px 为 1.0——网页内嵌场景
  // 弹幕保持原始字号不缩小，全屏随屏幕宽度等比放大
  baseWidth: 950,
  minScale: 0.75,  // 最小缩放 75%（迷你播放器等小容器）
  maxScale: 2.0,   // 最大缩放 200%（1080p 全屏约 2 倍，与 B 站量级一致）
  // CSS 像素本身是密度无关单位（高 DPI 屏的视觉一致性由浏览器保证），
  // B 站同样不做 dpr/浏览器缩放补偿；此前 dpr^-0.3 修正反而把高分屏
  // 的缩放再打约九折，进一步压小了弹幕，是「缩放不够大」的帮凶
  considerDevicePixelRatio: false,
  considerBrowserZoom: false,
};

/**
 * 计算合理的缩放比例
 * @param containerWidth 容器宽度
 * @param config 缩放配置
 * @returns 计算后的缩放比例
 */
export function calculateScale(
  containerWidth: number,
  config: Partial<ScaleConfig> = {}
): number {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 1. 基于容器宽度计算基础缩放
  let scale = containerWidth / finalConfig.baseWidth;

  // 2. 考虑设备像素比（高DPI屏幕）
  if (finalConfig.considerDevicePixelRatio) {
    const dpr = window.devicePixelRatio || 1;
    // 高DPI屏幕适当减小缩放，避免字体过大
    if (dpr > 1) {
      scale *= Math.pow(dpr, -0.3); // 使用 -0.3 次方来轻微调整
    }
  }

  // 3. 考虑浏览器缩放（Ctrl+滚轮）
  if (finalConfig.considerBrowserZoom && window.visualViewport) {
    const visualScale = window.visualViewport.scale || 1;
    // 浏览器放大时减小缩放，缩小时增加缩放，保持视觉一致性
    scale /= Math.sqrt(visualScale);
  }

  // 4. 限制在合理范围内
  return Math.max(finalConfig.minScale, Math.min(finalConfig.maxScale, scale));
}

/**
 * 计算最终字体大小
 * @param baseFontSize 基础字体大小
 * @param fontSizeScale 字体缩放比例（用户设置）
 * @param containerWidth 容器宽度
 * @param autoScale 是否自动缩放
 * @returns 最终字体大小
 */
export function calculateFontSize(
  baseFontSize: number,
  fontSizeScale: number,
  containerWidth: number,
  autoScale: boolean = true
): number {
  if (!autoScale) {
    // 不自动缩放时，只应用用户设置的字体缩放
    return Math.round(baseFontSize * fontSizeScale);
  }

  // 自动缩放时，综合考虑容器大小和浏览器缩放
  const scale = calculateScale(containerWidth);
  const finalSize = baseFontSize * fontSizeScale * scale;

  // 限制字体大小在合理范围内（12px - 50px）。上限必须容纳 maxScale=2.0
  // 下的全屏字号（如 25px 基准 × 2.0 = 50px），否则全屏缩放会被这里
  // 二次截断，用户侧又表现为「缩放不够大」
  return Math.max(12, Math.min(50, Math.round(finalSize)));
}

/**
 * 根据有效字号计算轨道高度
 *
 * 轨道高度必须覆盖弹幕文本盒（.danmaku-x-dm 的 line-height 为 1.125）
 * 并预留上下呼吸空间，否则字号放大（用户缩放/屏幕自适应缩放）后
 * 文本盒高度超过轨道高度，相邻轨道的弹幕会在视觉上紧紧贴住甚至重叠。
 *
 * +12px 呼吸空间的构成：
 * - 本人弹幕（.danmaku-x-self）带 2px 边框 + 2px 垂直内边距，
 *   盒子在文本行高基础上垂直膨胀约 8px，必须被轨道完整容纳
 * - 剩余约 4px 为最小可见间隙，普通弹幕（无边框）间隙约 12px
 * @param fontPx 当前有效字号（px，已含用户缩放与屏幕自适应因子）
 * @returns 轨道高度（px），下限 24 与旧版默认值保持一致
 */
export function calculateTrackHeight(fontPx: number): number {
  return Math.max(24, Math.ceil(fontPx * 1.125) + 12);
}

/**
 * 获取当前浏览器缩放信息
 * @returns 缩放信息
 */
export function getZoomInfo(): {
  devicePixelRatio: number;
  visualViewportScale: number;
  calculatedScale: number;
} {
  const dpr = window.devicePixelRatio || 1;
  const visualScale = window.visualViewport?.scale || 1;
  const calculatedScale = calculateScale(window.innerWidth);

  return {
    devicePixelRatio: dpr,
    visualViewportScale: visualScale,
    calculatedScale,
  };
}
