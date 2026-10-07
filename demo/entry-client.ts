/**
 * ============================================
 * 客户端水合(Hydration)入口
 * ============================================
 * 此文件在浏览器环境中运行
 *
 * 职责：
 * 1. 创建与服务端相同的 VNode 虚拟节点树
 * 2. 调用 hydrate() — 自动绑定事件、ref、生命周期
 *    - VideoPlayer 的 PlayerDocker onMounted 在此时执行
 *    - 自动绑定 video 元素事件、控制栏交互
 * 3. 设置全局事件总线监听（事件日志、水合检测）
 * 4. 更新 SSR 徽章状态（SSR → Hydrated）
 * 5. 绑定「切换视频源」「销毁播放器」按钮事件
 *
 * ============================================
 * 核心变化（vs 旧版客户端挂载方案）
 * ============================================
 *
 * 【旧方案】SSR 渲染占位容器 → 客户端 new VideoPlayer() → player.mount(container)
 *   问题：播放器 HTML 不在 SSR 输出中，首屏为空，需要二次挂载
 *
 * 【新方案】SSR 直接渲染播放器完整 HTML → 客户端 hydrate() 绑定事件
 *   优势：首屏即包含播放器 UI，水合后立即可交互，与 Vue/React SSR 一致
 *
 * 【hydrate 自动处理的事情】
 *   1. 事件绑定：onClick/onInput/onKeyDown 等 → addEventListener
 *   2. ref 引用：ref.current = DOM 元素（包括 videoRef、playerDockerRef 等）
 *   3. 生命周期钩子：onBeforeMount → onMounted
 *     - PlayerDocker.onMounted 调用 initVideo() + initEvent()
 *     - VideoPlayer 通过 onMounted 回调获取 video/container DOM 引用
 *     - 自动创建 StreamMiddleware、bindVideoEvents、触发 ready 事件
 */

import { hydrate } from "@/core";
import {
  RootLayout,
  appEventBus,
  playerInstance,
  setPlayerInstance,
} from "./main";
import { VideoPlayer } from "@/hili-player/player";
import { createHlsPlugin } from "@/hili-player/plugins/hls";
import { createDashPlugin } from "@/hili-player/plugins/dash";
import { DanmakuPlugin } from "@/hili-player/plugins/danmaku";
import type {
  MediaItem,
  PlayerConfig,
  PlayerSource,
  ProgressSegment,
} from "@/types";
import type { Plugin } from "@/hili-player/core/plugin";
import type { ProgressPreviewSource } from "@/hili-player/utils/media/progressPreview";
import {
  normalizeEnergyProgress,
  type EnergyProgressData,
} from "@/hili-player/utils/media/energyProgress";

/**
 * mock-server 基地址（默认端口 9101；响应带 Access-Control-Allow-Origin: *，
 * 开发时 demo 页面可直接跨端口请求，无需额外代理）
 */
const MOCK_SERVER_BASE = "http://127.0.0.1:9101";

/** mock-server 的进度条节点响应 */
interface MockViewPoint {
  from: number;
  to: number;
  content: string;
}

/**
 * 拉取分段点（进度条章节）
 *
 * 接口：GET http://127.0.0.1:9101/x/player/v2
 * 响应：{ code, message, data: { view_points: [{ from, to, content, ... }] } }
 * from/to 单位为秒，直接映射为 ProgressSegment 的 startTime/endTime。
 *
 * @returns 分段列表；请求失败返回空数组
 */
async function fetchProgressSegments(): Promise<ProgressSegment[]> {
  try {
    const response = await fetch(`${MOCK_SERVER_BASE}/x/player/v2`);
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: { view_points?: MockViewPoint[] };
    };
    const points = payload.data?.view_points;
    if (!Array.isArray(points)) return [];
    return points.map((point) => ({
      startTime: Number(point.from) || 0,
      endTime: Number(point.to) || 0,
      label: String(point.content ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * 拉取逐帧预览图
 *
 * 接口：GET http://127.0.0.1:9101/videoshot/preview.bin
 * 响应：UTF-8 文本，逐帧 data URL，以 \u001f 分隔。
 *
 * @returns 预览帧数组；请求失败返回空数组
 */
async function fetchPreviewFrames(): Promise<string[]> {
  try {
    const response = await fetch(`${MOCK_SERVER_BASE}/videoshot/preview.bin`);
    if (!response.ok) return [];
    const text = await response.text();
    return text
      .split("\u001f")
      .map((frame) => frame.trim())
      .filter((frame) => frame.startsWith("data:"));
  } catch {
    return [];
  }
}

/**
 * 拉取预览数据源（雪碧图与逐帧两种都兼容）
 *
 * 接口：GET http://127.0.0.1:9101/videoshot/index.json
 * 优先用雪碧图（pvdata 的 img_url + img_x_len/img_y_len/img_x_size/img_y_size，B 站形状）；
 * 拿不到雪碧图参数时回退到逐帧 preview.bin。
 * URL 带 `?preview=frames` 可强制走逐帧，便于对比两条路径。
 *
 * @returns setProgressPreview() 可直接消费的数据源
 */
async function fetchProgressPreview(): Promise<
  ProgressPreviewSource | string[] | null
> {
  const forceFrames =
    new URLSearchParams(location.search).get("preview") === "frames";

  let spriteSource: ProgressPreviewSource | null = null;
  try {
    const response = await fetch(`${MOCK_SERVER_BASE}/videoshot/index.json`);
    if (response.ok) {
      const payload = (await response.json()) as {
        data?: {
          pvdata?: {
            img_url?: string;
            img_x_len?: number;
            img_y_len?: number;
            img_x_size?: number;
            img_y_size?: number;
          };
          index?: number[];
          sprite?: { status?: string };
        };
      };
      const pv = payload.data?.pvdata;
      // 只在服务端确认雪碧图可用时才走雪碧图模式；否则 img_url 可能指向 404，
      // 预览区会整块空白（逐帧 preview.bin 才是可用的那条路）
      const spriteReady =
        payload.data?.sprite?.status === "ready" &&
        pv?.img_url?.includes("sprite") === true;
      if (spriteReady && pv?.img_url && pv.img_x_len && pv.img_y_len) {
        spriteSource = {
          imgUrl: `${MOCK_SERVER_BASE}${pv.img_url}`,
          imgXLen: pv.img_x_len,
          imgYLen: pv.img_y_len,
          imgXSize: pv.img_x_size,
          imgYSize: pv.img_y_size,
          sliceCount: payload.data?.index?.length,
        };
      }
    }
  } catch {
    spriteSource = null;
  }

  if (spriteSource && !forceFrames) return spriteSource;

  const frames = await fetchPreviewFrames();
  return frames.length > 0 ? frames : spriteSource;
}

/**
 * 拉取高能进度条数据
 *
 * 接口：GET http://127.0.0.1:9101/x/player/pbp
 * 响应：{ code, message, data: { step_sec, data: number[], count, duration } }
 *
 * @returns 归一后的高能数据；请求失败返回 null
 */
async function fetchEnergyProgress(): Promise<EnergyProgressData | null> {
  try {
    const response = await fetch(`${MOCK_SERVER_BASE}/x/player/pbp`);
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: unknown };
    return normalizeEnergyProgress(payload.data);
  } catch {
    return null;
  }
}

// ============================================
// 步骤1：水合前记录时间戳（用于显示水合耗时）
// ============================================
const hydrationStartTime = performance.now();

// 通过 SSR 注入的 meta 标签获取 SSR 渲染时间
const ssrStartTime = (() => {
  const meta = document.querySelector('meta[name="ssr-start-time"]');
  return meta ? parseFloat(meta.getAttribute("content") || "0") : 0;
})();

// ============================================
// 步骤2：监听 HYDRATION_CHECK 事件，实时填充检测面板
// ============================================

interface HydrationItem {
  id: string;
  pass: boolean;
  detail?: string;
  timestamp: number;
}

const hydrationItems: HydrationItem[] = [];

/**
 * 添加水合检测项到面板
 */
function appendHydrationItem(item: HydrationItem): void {
  hydrationItems.push(item);

  const list = document.querySelector(".hydration-list");
  if (list) {
    const el = document.createElement("div");
    el.className = "hydration-item " + (item.pass ? "pass" : "fail");
    el.innerHTML =
      '<span class="icon-wrap">' +
      (item.pass
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>') +
      "</span>" +
      '<span class="label">' +
      escapeHtml(item.id) +
      (item.detail
        ? '<div class="detail">' + escapeHtml(item.detail) + "</div>"
        : "") +
      "</span>";
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }

  updateHydrationSummary();
}

/**
 * 更新水合检测面板的统计信息
 */
function updateHydrationSummary(): void {
  const allSpans = document.querySelectorAll(".hydration-panel span");
  for (const span of allSpans) {
    if (span.textContent && span.textContent.includes("等待水合")) {
      const passCount = hydrationItems.filter((i) => i.pass).length;
      const failCount = hydrationItems.filter((i) => !i.pass).length;
      const total = hydrationItems.length;
      span.textContent =
        `${passCount}/${total} 通过` +
        (failCount > 0 ? ` · ${failCount} 失败` : "");
      if (failCount > 0) {
        (span as HTMLElement).style.background = "rgba(248,113,113,0.15)";
        (span as HTMLElement).style.color = "#f87171";
      } else if (total > 0) {
        (span as HTMLElement).style.background = "rgba(74,222,128,0.15)";
        (span as HTMLElement).style.color = "#4ade80";
      }
      break;
    }
  }
}

/**
 * HTML 转义工具
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 更新 SSR 渲染耗时显示
 */
function updateSSRTime(): void {
  const allSpans = document.querySelectorAll(".hydration-panel span");
  for (const span of allSpans) {
    if (span.textContent && span.textContent.trim() === "—") {
      if (ssrStartTime > 0) {
        const elapsed = hydrationStartTime - ssrStartTime;
        span.textContent = elapsed.toFixed(1) + " ms";
      } else {
        span.textContent = "N/A";
      }
      break;
    }
  }
}

// 注册 HYDRATION_CHECK 监听器（在水合前注册，确保能捕获所有事件）
appEventBus.on("HYDRATION_CHECK", (data) => {
  appendHydrationItem({
    id: data.id,
    pass: data.pass,
    detail: data.detail,
    timestamp: Date.now(),
  });
});

// ============================================
// 步骤3：监听 ACTION_LOG 事件，实时填充事件日志
// ============================================

let logCount = 0;

appEventBus.on("ACTION_LOG", (data) => {
  const logContent = document.querySelector(".log-content");
  if (logContent) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    const time = new Date(data.timestamp).toLocaleTimeString("zh-CN", {
      hour12: false,
    });
    entry.innerHTML =
      '<span class="time">[' +
      time +
      "]</span>" +
      '<span class="msg">' +
      escapeHtml(data.action) +
      "</span>";
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;

    logCount++;
    if (logCount > 200 && logContent.firstChild) {
      logContent.removeChild(logContent.firstChild);
      logCount--;
    }

    updateLogCount();
  }
});

function updateLogCount(): void {
  const allSpans = document.querySelectorAll(".event-log span");
  for (const span of allSpans) {
    if (span.textContent && span.textContent.includes("条")) {
      span.textContent = logCount + " 条";
      break;
    }
  }
}

// ============================================
// 步骤4：执行水合
// ============================================

const root = document.getElementById("root");

if (root) {
  try {
    // 创建与服务端相同的 VNode 树
    // PlayerSection 内部会创建 VideoPlayer 实例并调用 render()
    // 返回的 VNode 树包含完整播放器 UI 结构
    const vnode = RootLayout({});

    // 执行水合
    // hydrate() 会：
    // 1. 遍历 VNode 树，匹配已有 DOM 元素
    // 2. 绑定 ref（videoRef, playerDockerRef 等）
    // 3. 调用 onMounted 生命周期
    //    - PlayerDocker.onMounted → initVideo() + initEvent()
    //    - VideoPlayer 通过回调获取 DOM 引用，绑定视频事件
    hydrate(vnode, root);

    // 更新 SSR 徽章为 "Hydrated"
    updateBadgeToHydrated();

    // 更新水合耗时显示
    updateSSRTime();

    // 注入一条总览水合检测项
    const hydrationDuration = performance.now() - hydrationStartTime;
    appendHydrationItem({
      id: "hydrate() 整体耗时",
      pass: true,
      detail: hydrationDuration.toFixed(1) + " ms",
      timestamp: Date.now(),
    });

    // 检测播放器是否水合成功
    // playerInstance 由 PlayerSection 组件创建，水合后应已就绪
    if (playerInstance) {
      appendHydrationItem({
        id: "VideoPlayer:SSR 水合",
        pass: true,
        detail: "播放器实例已创建，onMounted 自动绑定事件",
        timestamp: Date.now(),
      });

      // 监听播放器关键事件并写入日志
      const playerEvents = [
        "ready",
        "play",
        "pause",
        "ended",
        "error",
        "destroy",
      ];
      playerEvents.forEach((evt) => {
        try {
          (
            playerInstance as unknown as {
              on: (e: string, cb: (...args: unknown[]) => void) => void;
            }
          ).on(evt, (...args: unknown[]) => {
            appEventBus.emit("ACTION_LOG", {
              action:
                "Player:" +
                evt +
                (args.length ? " " + JSON.stringify(args[0]).slice(0, 80) : ""),
              timestamp: Date.now(),
            });
          });
        } catch {
          // 忽略不支持的事件
        }
      });

      // 暴露到全局便于调试
      (window as unknown as { player: VideoPlayer }).player = playerInstance;

      appEventBus.emit("ACTION_LOG", {
        action: "VideoPlayer SSR 水合完成（无需客户端挂载）",
        timestamp: Date.now(),
      });
    } else {
      appendHydrationItem({
        id: "VideoPlayer:SSR 水合",
        pass: false,
        detail: "playerInstance 为 null",
        timestamp: Date.now(),
      });
    }
  } catch (e) {
    console.error("[Hydration Error]", e);
    updateBadgeToFailed(e instanceof Error ? e.message : String(e));
  }
} else {
  updateBadgeToFailed("#root 元素未找到");
}

// ============================================
// 步骤5：「切换视频源」「销毁播放器」按钮事件
// ============================================

/**
 * 渲染「播放器已销毁」占位内容
 *
 * 全部用 DOM API 构建，不再用 innerHTML 清空 / 覆盖容器：
 * 容器清理由 VideoPlayer.destroy() 移除自己的根节点完成。
 * @param wrapper - 播放器容器
 */
function renderDestroyedPlaceholder(wrapper: HTMLElement): void {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const box = document.createElement("div");
  box.className = "player-destroyed-placeholder";
  box.setAttribute(
    "style",
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:rgba(255,255,255,0.4);font-size:13px;",
  );

  const icon = document.createElementNS(SVG_NS, "svg");
  icon.setAttribute("width", "48");
  icon.setAttribute("height", "48");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "rgba(255,255,255,0.3)");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");

  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute("points", "23 7 16 12 23 17 23 7");
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "1");
  rect.setAttribute("y", "5");
  rect.setAttribute("width", "15");
  rect.setAttribute("height", "14");
  rect.setAttribute("rx", "2");
  rect.setAttribute("ry", "2");
  icon.appendChild(polygon);
  icon.appendChild(rect);

  const text = document.createElement("span");
  text.textContent = "播放器已销毁";

  box.appendChild(icon);
  box.appendChild(text);
  wrapper.appendChild(box);
}

/**
 * 销毁当前播放器实例
 *
 * 只调用播放器公开的销毁 API（`VideoPlayer.destroy()`）：组件树卸载、
 * 插件与流中间件销毁、媒体断开、根节点移除全部由播放器内部按序完成，
 * demo 侧不再直接操作播放器 DOM。
 */
function destroyCurrentPlayer(): void {
  if (playerInstance) {
    try {
      playerInstance.destroy();
    } catch {
      // 忽略销毁错误
    }
    setPlayerInstance(null);

    const wrapper = document.getElementById("player-wrapper");
    if (wrapper) {
      // destroy() 已移除播放器根节点；这里只兜底清掉残余子节点（SSR 首屏内容）
      while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
      }
      renderDestroyedPlaceholder(wrapper);
    }

    appEventBus.emit("ACTION_LOG", {
      action: "VideoPlayer 已销毁",
      timestamp: Date.now(),
    });
  }
}

// 绑定按钮事件
const btnDestroyPlayer = document.getElementById("btn-destroy-player");
if (btnDestroyPlayer) {
  btnDestroyPlayer.addEventListener("click", destroyCurrentPlayer);
}

const MEDIA_LIST: MediaItem[] = [];
const OBJECT_URLS: string[] = [];

function collectPlugins(source?: PlayerSource): Plugin[] {
  const list: Plugin[] = [DanmakuPlugin()];
  const text =
    typeof source === "string" ? source : JSON.stringify(source ?? "");
  if (/\.m3u8(\?|$)/i.test(text)) {
    list.unshift(createHlsPlugin({ autoplay: false }));
  } else if (/\.mpd(\?|$)/i.test(text)) {
    list.unshift(createDashPlugin({ autoplay: false }));
  } else if (/\.json(\?|$)/i.test(text) || typeof source !== "string") {
    list.unshift(createDashPlugin({ autoplay: false }));
    list.unshift(createHlsPlugin({ autoplay: false }));
  }
  return list;
}

function parseSource(text: string): PlayerSource | null {
  const value = text.trim();
  if (!value) return null;
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      return JSON.parse(value) as unknown as PlayerSource;
    } catch {
      return null;
    }
  }
  return value;
}

function sourceKind(item: MediaItem): string {
  const src = item.src;
  if (typeof src === "string") {
    if (src.startsWith("blob:")) return "本地";
    if (/\.mpd(\?|$)/i.test(src)) return "DASH";
    if (/\.m3u8(\?|$)/i.test(src)) return "HLS";
    if (/\.json(\?|$)/i.test(src)) return "JSON";
    return "MP4";
  }
  if (Array.isArray(src)) return "MP4";
  const text = JSON.stringify(src).slice(0, 2000);
  if (/mpd|SegmentTemplate|Period/i.test(text)) return "DASH";
  if (/m3u8|EXT-X|playlist/i.test(text)) return "HLS";
  return "JSON";
}

function sourceTitle(item: MediaItem, index: number): string {
  if (item.title) return `${index + 1}. ${item.title}`;
  if (typeof item.src === "string")
    return `${index + 1}. ${item.src.slice(0, 64)}`;
  return `${index + 1}. JSON 视频源`;
}

function removeSourceAt(index: number): void {
  const removed = MEDIA_LIST[index];
  if (!removed) return;
  const current = playerInstance?.getCurrentIndex() ?? 0;
  const wasCurrent = current === index;
  if (typeof removed.src === "string" && removed.src.startsWith("blob:")) {
    URL.revokeObjectURL(removed.src);
    const urlIndex = OBJECT_URLS.indexOf(removed.src);
    if (urlIndex >= 0) OBJECT_URLS.splice(urlIndex, 1);
  }
  MEDIA_LIST.splice(index, 1);
  if (MEDIA_LIST.length === 0) {
    destroyCurrentPlayer();
    renderSourceList();
    return;
  }
  if (wasCurrent) {
    void rebuildPlayer(Math.min(index, MEDIA_LIST.length - 1));
    return;
  }
  if (index < current) {
    void rebuildPlayer(current - 1);
    return;
  }
  renderSourceList();
}

function renderSourceList(): void {
  const list = document.getElementById("source-list");
  if (!list) return;
  list.innerHTML = "";
  if (MEDIA_LIST.length === 0) {
    const empty = document.createElement("li");
    empty.className = "source-empty";
    empty.textContent = "暂无来源";
    list.appendChild(empty);
    return;
  }
  const current = playerInstance?.getCurrentIndex() ?? 0;
  MEDIA_LIST.forEach((item, index) => {
    const li = document.createElement("li");
    li.className =
      index === current ? "source-item player-state-active" : "source-item";
    li.dataset.index = String(index);

    const main = document.createElement("span");
    main.className = "source-item-main";

    const title = document.createElement("span");
    title.className = "source-item-title";
    title.textContent = sourceTitle(item, index);

    const badge = document.createElement("span");
    badge.className = "source-item-badge";
    badge.textContent = sourceKind(item);

    main.appendChild(title);
    main.appendChild(badge);

    const remove = document.createElement("button");
    remove.className = "source-item-remove";
    remove.type = "button";
    remove.textContent = "✕";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeSourceAt(index);
    });

    li.appendChild(main);
    li.appendChild(remove);

    li.addEventListener("click", () => {
      const target = playerInstance;
      if (target) {
        void target.switchTo(index).catch(() => undefined);
      }
      renderSourceList();
    });

    list.appendChild(li);
  });
}

/**
 * 重建播放器（切换源 / 列表变化时）
 *
 * 销毁与清理由播放器公开的 destroy API 负责：
 * - 组件卸载顺序为「最深子组件 → 根」；
 * - 媒体断开（pause → 清 src → load）由 VideoPlayer.destroy 在流媒体插件销毁之后执行，
 *   不再需要 demo 侧提前摘 src（提前摘会把 MediaSource 从 video 元素上摘掉，
 *   使仍在运行的 dash.js 抛 SourceBuffer 已移除的异常）。
 *
 * @param targetIndex - 目标源下标
 */
async function rebuildPlayer(targetIndex: number): Promise<void> {
  const wrapper = document.getElementById("player-wrapper");

  destroyCurrentPlayer();

  if (!wrapper) return;

  // 清掉销毁占位（destroy 已移除播放器根节点，这里只移除占位节点，不再用 innerHTML）
  wrapper
    .querySelectorAll(".player-destroyed-placeholder")
    .forEach((node) => node.remove());

  // 测试期每个视频默认加载：分段点 + 预览数据（雪碧图/逐帧）+ 高能进度条
  const [segments, preview, energy] = await Promise.all([
    fetchProgressSegments(),
    fetchProgressPreview(),
    fetchEnergyProgress(),
  ]);

  const current = MEDIA_LIST[targetIndex];
  const config: PlayerConfig = {
    src: current ? current.src : undefined,
    playlist: MEDIA_LIST,
    playlistIndex: targetIndex,
    progress: {
      segments,
    },
    playback: {
      autoplay: true,
      muted: true,
      volume: 0.3,
    },
    interaction: {
      keyboard: true,
    },
    plugins: {
      list: collectPlugins(current ? current.src : undefined),
    },
    advanced: {
      debug: false,
    },
  };

  try {
    const next = new VideoPlayer(config);
    setPlayerInstance(next);
    next.setProgressPreview(preview);
    next.setEnergyProgress(energy);
    next.mount(wrapper);
    (window as unknown as { player: VideoPlayer }).player = next;
    if (targetIndex > 0) {
      void next.switchTo(targetIndex).catch(() => undefined);
    }
    appEventBus.emit("ACTION_LOG", {
      action:
        "视频列表 " +
        MEDIA_LIST.length +
        " 项，当前第 " +
        (targetIndex + 1) +
        " 项",
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error("[VideoPlayer Playlist Error]", e);
  }

  renderSourceList();
}

function addSource(source: PlayerSource, title: string): void {
  MEDIA_LIST.push({ src: source, title });
  void rebuildPlayer(MEDIA_LIST.length - 1);
}

function handleAddSource(): void {
  const input = document.getElementById("input-source-url");
  if (!(input instanceof HTMLInputElement)) return;
  const source = parseSource(input.value);
  if (!source) {
    appEventBus.emit("ACTION_LOG", {
      action: "视频链接为空或 JSON 解析失败",
      timestamp: Date.now(),
    });
    return;
  }
  input.value = "";
  addSource(
    source,
    typeof source === "string" ? source.slice(0, 64) : "JSON 视频源",
  );
}

function handleLocalFile(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const file = target.files?.item(0);
  if (!file) return;
  const url = URL.createObjectURL(file);
  OBJECT_URLS.push(url);
  target.value = "";
  addSource(url, file.name);
}

const inputSourceUrl = document.getElementById("input-source-url");
if (inputSourceUrl) {
  inputSourceUrl.addEventListener("keydown", (event) => {
    if (event instanceof KeyboardEvent && event.key === "Enter") {
      handleAddSource();
    }
  });
}

const btnAddSource = document.getElementById("btn-add-source");
if (btnAddSource) {
  btnAddSource.addEventListener("click", handleAddSource);
}

function handleJsonFile(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const file = target.files?.item(0);
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    const source = parseSource(text);
    if (!source) {
      appEventBus.emit("ACTION_LOG", {
        action: "JSON 文件解析失败: " + file.name,
        timestamp: Date.now(),
      });
      console.error("[Demo] JSON 文件解析失败", file.name);
      return;
    }
    addSource(source, file.name);
  };
  reader.onerror = () => {
    appEventBus.emit("ACTION_LOG", {
      action: "JSON 文件读取失败: " + file.name,
      timestamp: Date.now(),
    });
    console.error("[Demo] JSON 文件读取失败", file.name);
  };
  reader.readAsText(file);
  target.value = "";
}

const inputLocalFile = document.getElementById("input-local-file");
if (inputLocalFile) {
  inputLocalFile.addEventListener("change", handleLocalFile);
}

const inputJsonFile = document.getElementById("input-json-file");
if (inputJsonFile) {
  inputJsonFile.addEventListener("change", handleJsonFile);
}

const btnDestroyWithCleanup = document.getElementById("btn-destroy-player");
if (btnDestroyWithCleanup) {
  btnDestroyWithCleanup.addEventListener("click", () => {
    OBJECT_URLS.forEach((url) => URL.revokeObjectURL(url));
    OBJECT_URLS.length = 0;
  });
}

renderSourceList();

// ============================================
// 辅：徽章状态更新
// ============================================

function updateBadgeToHydrated(): void {
  const badge = document.getElementById("ssr-badge");
  if (badge) {
    badge.className = "ssr-badge hydrated";
    const text = badge.querySelector(".text");
    if (text) text.textContent = "Hydrated";
  }
}

function updateBadgeToFailed(errorMsg: string): void {
  const badge = document.getElementById("ssr-badge");
  if (badge) {
    badge.className = "ssr-badge failed";
    const text = badge.querySelector(".text");
    if (text) text.textContent = "Hydration Failed";
  }
  const errorOverlay = document.getElementById("ssr-error");
  const errorMsgEl = document.getElementById("ssr-error-msg");
  if (errorOverlay && errorMsgEl) {
    errorMsgEl.textContent = errorMsg;
    errorOverlay.classList.add("show");
  }
}
