/**
 * 弹幕防遮挡（人像分割）—— 类型定义
 * ============================================================
 * 该模块负责：检测浏览器 GPU 能力 → 在 Worker 里用 MediaPipe 对视频抽帧做人像
 * 分割 → 把人物 mask 转成 SVG 轮廓（人物镂空、背景黑），供弹幕渲染层避开人物。
 */

/** 运行后端类型 */
export type SegmentationBackend = 'webgpu' | 'webgl' | 'wasm' | 'none';

/** 浏览器能力检测结果 */
export interface CapabilityInfo {
  /** 是否支持 WebGL2 */
  webgl2: boolean;
  /** 是否支持 WebGPU */
  webgpu: boolean;
  /** 是否支持 WASM SIMD */
  wasmSimd: boolean;
  /** 是否支持 OffscreenCanvas（Worker 内渲染/抽帧依赖它） */
  offscreenCanvas: boolean;
  /** 选定的推理后端 */
  backend: SegmentationBackend;
  /** 估算的最高处理 fps（启发式，真实 fps 以首次推理实测为准） */
  estimatedFps: number;
  /** 是否可用真实分割（false 表示应走 mock 数据） */
  supported: boolean;
}

/** 防遮挡分割配置 */
export interface SegmentationConfig {
  /** 抽帧间隔（毫秒），默认 300 ≈ 3.3fps，轮廓变化慢，无需每帧跑 */
  sampleInterval: number;
  /** 分割 mask 输出宽度（低分辨率即可，仅需轮廓） */
  maskWidth: number;
  /** 分割 mask 输出高度 */
  maskHeight: number;
  /** 低于该 fps 则判定「不支持」，改走 mock */
  minFps: number;
  /** 人像分割模型 URL（默认 MediaPipe 官方 selfie_multiclass_256x256） */
  modelUrl: string;
  /** 判定「人物」的置信度阈值，越低人物越完整（含头发/衣服边缘），默认 0.25 */
  threshold: number;
  /** 人物占画面比例低于此值时不设置遮罩（人太小，直接不挡弹幕），默认 0.005 */
  minPersonRatio: number;
  /** 遮罩输出格式：'png' 直接输出原始 mask 的 PNG（先验证模型），'svg' 输出矢量轮廓 */
  outputFormat: 'svg' | 'png';
  /** 膨胀像素数：模型 mask 常比真人小一圈，把人物区域向外扩 N 像素，默认 2 */
  dilatePixels: number;
}

/** 默认配置 */
export const DEFAULT_MASK_CONFIG: SegmentationConfig = {
  sampleInterval: 300,
  // 轮廓分辨率：不需要太高，但过低会出现锯齿；128x72 兼顾平滑与性能
  maskWidth: 128,
  maskHeight: 72,
  minFps: 5,
  // 用 selfie_multiclass_256x256（多分类：背景/头发/身体皮肤/脸部皮肤/衣服/其他），
  // 人物 = 除背景外全部类相加，比二分类 selfie_segmenter 明显更完整、误判更少。
  // 请把 selfie_multiclass_256x256.tflite 放到 public/mediapipe/models/ 下。
  // modelUrl: '/mediapipe/models/deeplab_v3.tflite',
  modelUrl: '/mediapipe/models/selfie_multiclass_256x256.tflite',
  // modelUrl: '/mediapipe/models/selfie_segmenter.tflite',
  // 阈值 0.25：模型 mask 边缘置信度偏低，阈值太高会把人物切小一圈。
  threshold: 0.25,
  // 人太小（占比 < 0.5%）时这一帧不设遮罩
  minPersonRatio: 0.005,
  // 已用 PNG 验证过模型分割是准确的，现在切回 'svg' 矢量轮廓：
  // - SVG 是矢量，放大不糊；
  // - 省掉 PNG 的 convertToBlob 编码（约 10~50ms），降低「遮罩落后画面」的延迟。
  outputFormat: 'svg',
  // 默认不膨胀（0）：PNG 原始 mask 已较贴合，膨胀 2 会把人物放得太大。
  // 个别场景人物略小时可临时调成 1。
  dilatePixels: 0,
};

/** 一次分割的结果（传给弹幕渲染层） */
export interface SegmentationResult {
  /** 生成的遮罩图片（data URL，可能是 SVG 或 PNG）：人物镂空、背景黑 */
  image: string;
  /** 本次结果时间戳 */
  timestamp: number;
  /** 是否为 mock 数据（能力不足时的降级结果） */
  isMock: boolean;
  /** 遮罩宽度（与视频宽高比一致） */
  width: number;
  /** 遮罩高度 */
  height: number;
  /** 结果是否已过期（被更新的帧结果取代，调用方可丢弃不应用） */
  stale?: boolean;
  /** 本帧没有检测到人物（或人物太小），调用方应清除/不设置遮罩 */
  noPerson?: boolean;
}

/** 视频内容在抽帧画布中的区域（相对 0~1，用于把 mask 对齐回视频画面） */
export interface MaskRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 主线程 → 分割 Worker 的消息 */
export type SegmentationWorkerRequest =
  | { type: 'init'; config: SegmentationConfig; capability: CapabilityInfo }
  | { type: 'segment'; id: number; bitmap: ImageBitmap; timestamp: number; region: MaskRegion }
  | { type: 'dispose' };

/** 分割 Worker → 主线程的消息 */
export type SegmentationWorkerResponse =
  | { type: 'ready'; backend: SegmentationBackend; actualFps: number }
  | {
      type: 'result';
      id: number;
      image: string;
      timestamp: number;
      isMock: boolean;
      elapsedMs: number;
      width: number;
      height: number;
      noPerson: boolean;
    }
  | { type: 'error'; id?: number; message: string };
