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
  baseWidth: 1280,
  minScale: 0.75,  // 最小缩放 75%
  maxScale: 1.25,  // 最大缩放 125%
  considerDevicePixelRatio: true,
  considerBrowserZoom: true,
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

  // 限制字体大小在合理范围内（12px - 36px）
  return Math.max(12, Math.min(36, Math.round(finalSize)));
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
