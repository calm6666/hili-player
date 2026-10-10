# danmakuMask · 弹幕防遮挡（人像分割）

用 **MediaPipe 人像分割模型** 在浏览器（Worker）里实时对视频抽帧做分割，
生成「人物镂空、背景黑」的 **平滑 SVG 轮廓**，供弹幕层避开人物。

```ts
import { DanmakuMaskSegmenter, CapabilityDetector } from '@/utils/danmakuMask';

const seg = new DanmakuMaskSegmenter();
const cap = await seg.init();           // 检测能力 + 加载模型
const { image, isMock } = await seg.segment(videoEl, performance.now());
```

## 运行前提（重要）

### 1. wasm（随 npm 包，Vite 自动处理，无需 CDN、不放 public/）
`FilesetResolver.forVisionTasks` 会 `import()` wasm 目录里的 `.js` 加载器，
而 **public/ 里的 .js 不能被 import() 当模块加载**（Vite 会报错）。

因此 `segmentationWorker.ts` 用 Vite 的 `?url` 直接从
`@mediapipe/tasks-vision` 包内引用 wasm，并按官方 `vision.d.ts` 的建议
**手工构造 `WasmFileset`**（`wasmLoaderPath` + `wasmBinaryPath`），
开发/构建都自动得到正确地址，不依赖 CDN、不依赖 public/。

> 必须用 `vision_wasm_module_internal.js/.wasm`（ES6 模块，`export default
> ModuleFactory`）。`vision_wasm_internal` / `vision_wasm_nosimd_internal`
> 是 UMD 写法，`import()` 后拿不到 `ModuleFactory`，会报「ModuleFactory not set」。

### 2. 模型文件（需手动下载一次）
默认从 `public/mediapipe/models/selfie_multiclass_256x256.tflite` 加载。

用 **selfie_multiclass_256x256**（多分类：背景 / 头发 / 身体皮肤 / 脸部皮肤 / 衣服 /
其他），人物 = 除背景外全部类相加。相比二分类 `selfie_segmenter`（~256KB）：
- 头发、衣服是独立类别，**漏分割明显更少**；
- 背景单独一类，把植物/旗帜等误判成人的**假阳性明显更少**。

该模型 float32 约 10MB、float16 约 5MB。**体积大是因为多分类参数多，是正常的**；
浏览器会缓存，加载一次即可。若想更小，用 float16（精度基本无差）：

```bash
mkdir -p public/mediapipe/models
# float32（约 10MB）
curl -L -o public/mediapipe/models/selfie_multiclass_256x256.tflite \
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite"
# 或 float16（约 5MB，推荐，文件名一样）
# curl -L -o public/mediapipe/models/selfie_multiclass_256x256.tflite \
#   "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float16/1/selfie_multiclass_256x256.tflite"
```

> 国内无法访问 `storage.googleapis.com`，可自行找一个可访问的镜像（HuggingFace /
> 其他 CDN）下载同一个文件，放到上述路径即可。
> 也可以不改路径，直接 `new DanmakuMaskSegmenter({ modelUrl: '你的可访问地址' })`。

### 3. 人物比实际小一圈（可调）
模型输出的 mask 有时比真人略小一圈，用 `dilatePixels` 向外膨胀补齐：

```ts
new DanmakuMaskSegmenter({ dilatePixels: 2 })   // 默认 2，越大人物越往外扩
new DanmakuMaskSegmenter({ threshold: 0.2 })    // 阈值越低边缘框得越全，过低会带出背景
```

## 能力检测与降级

- `CapabilityDetector` 检测 WebGL2 / WebGPU / WASM SIMD / OffscreenCanvas，
  选择最优后端（WebGPU > WebGL > WASM）并估算 fps；
- 不支持 GPU 或 fps 过低 → `supported=false`，`segment()` 返回 **mock 平滑人形轮廓**；
- 模型加载失败时控制台会 `console.warn` 出原因。

## 关键设计

- **分割在 Worker 里**（MediaPipe 推理 + mask 转 SVG），不占主线程；
- **GPU 委托**：WebGL2/WebGPU 可用时用 GPU（WebGL），否则回退 CPU（XNNPACK）；
- **间隔采样，不是每帧分割**：`updateInterval` + 引擎按秒去重，实际约 1 次/秒；
- **结果与画面同步（丢弃过期帧）**：分割结果回来时若已有更新的请求在跑，
  该结果标记 `stale`，调用方丢弃，避免遮罩和当前画面不同步；
- **宽高比对齐**：按视频内容在抽帧画布里的区域裁剪 mask，再按视频宽高比出 SVG；
- **平滑轮廓**：对置信度 mask 做双线性降采样后，用 marching-squares + **线性插值**
  提取边界，输出平滑 SVG（不是锯齿方块）；阈值默认 0.3，把头发/衣服边缘也框进来；
- **过滤假阳性**：只保留 mask 中最大的连通域（人），把被模型误判成人的植物/旗帜等
  零散小物体剔除；
- **人太小不设遮罩**：人物占比 < `minPersonRatio`（默认 0.5%）时这一帧返回
  `noPerson`，调用方清除/不设置 mask CSS，弹幕照常显示；
- **镂空语义**：外框矩形 + 人物轮廓放进同一个 `<path>` 子路径，`fill-rule="evenodd"`
  让人物区域透明、背景黑。

## 文件结构

| 文件 | 作用 |
| --- | --- |
| `capabilityDetector.ts` | 浏览器能力检测（GPU/WASM/OffscreenCanvas + fps 估算） |
| `segmentationWorker.ts` | 分割 Worker：MediaPipe 推理 → 置信度 mask → 平滑 SVG |
| `segmentationClient.ts` | 主线程客户端：能力检测 + Worker 生命周期 + 抽帧 + mock 降级 |
| `maskToSvg.ts` | 置信度 mask → 平滑 SVG 轮廓（marching-squares + 线性插值） |
| `mockMask.ts` | mock 平滑人形轮廓（GPU 不可用时的降级） |
| `types.ts` | 类型与默认配置 |
| `index.ts` | 统一导出 |
