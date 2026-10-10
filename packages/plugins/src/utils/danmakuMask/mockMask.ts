/**
 * mock 防遮挡数据
 * ============================================================
 * 当浏览器不支持 GPU 加速（或 fps 过低、模型未就绪）时，用预置的 mock 轮廓代替真实分割。
 *
 * 这里用**平滑贝塞尔曲线**画一个「头 + 肩 + 躯干」的人形剪影，
 * 而不是圆形 + 方形的拼凑，尽量接近真实人像轮廓。
 */

import type { SegmentationResult } from './types';

/** 生成一张 mock 的平滑人形轮廓 SVG（人物镂空、背景黑） */
export function createMockMaskSvg(width = 128, height = 72): string {
  const cx = width / 2;
  const headRx = width * 0.085;
  const headTop = height * 0.16;
  const headBottom = height * 0.5;
  const neckHalf = width * 0.06;
  const shoulderHalf = width * 0.24;
  const shoulderY = height * 0.62;
  const waistHalf = width * 0.16;
  const bottomY = height * 0.98;

  // 头部：椭圆（头本来就是圆形，这里用两条 C 曲线画的椭圆，平滑）
  const head =
    `M${cx} ${headTop} ` +
    `C${cx + headRx * 1.2} ${headTop}, ${cx + headRx * 1.2} ${headBottom}, ${cx} ${headBottom} ` +
    `C${cx - headRx * 1.2} ${headBottom}, ${cx - headRx * 1.2} ${headTop}, ${cx} ${headTop} Z`;

  // 躯干：脖子 → 肩部向外张开 → 收腰 → 底部，全用贝塞尔平滑过渡
  const body =
    `M${cx - neckHalf} ${headBottom} ` +
    `C${cx - neckHalf} ${headBottom + height * 0.04}, ${cx - shoulderHalf} ${headBottom + height * 0.1}, ${cx - shoulderHalf} ${shoulderY} ` +
    `C${cx - shoulderHalf} ${shoulderY + height * 0.12}, ${cx - waistHalf} ${shoulderY + height * 0.2}, ${cx - waistHalf} ${bottomY} ` +
    `L${cx + waistHalf} ${bottomY} ` +
    `C${cx + waistHalf} ${shoulderY + height * 0.2}, ${cx + shoulderHalf} ${shoulderY + height * 0.12}, ${cx + shoulderHalf} ${shoulderY} ` +
    `C${cx + shoulderHalf} ${headBottom + height * 0.1}, ${cx + neckHalf} ${headBottom + height * 0.04}, ${cx + neckHalf} ${headBottom} Z`;

  const outerRect = `M0 0 H${width} V${height} H0 Z`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<path d="${outerRect} ${head} ${body}" fill="black" fill-rule="evenodd"/>` +
    `</svg>`
  );
}

/** 生成 mock 分割结果 */
export function createMockResult(width = 128, height = 72): SegmentationResult {
  const svg = createMockMaskSvg(width, height);
  return {
    image: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
    timestamp: Date.now(),
    isMock: true,
    width,
    height,
  };
}
