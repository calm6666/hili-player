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
import type { PlayerConfig } from "@/types";
import type { Plugin } from "@/hili-player/core/plugin";

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
      (item.detail ? '<div class="detail">' + escapeHtml(item.detail) + "</div>" : "") +
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
      span.textContent = `${passCount}/${total} 通过` + (failCount > 0 ? ` · ${failCount} 失败` : "");
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
    const time = new Date(data.timestamp).toLocaleTimeString("zh-CN", { hour12: false });
    entry.innerHTML =
      '<span class="time">[' + time + "]</span>" +
      '<span class="msg">' + escapeHtml(data.action) + "</span>";
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
      const playerEvents = ["ready", "play", "pause", "ended", "error", "destroy"];
      playerEvents.forEach((evt) => {
        try {
          (playerInstance as unknown as {
            on: (e: string, cb: (...args: unknown[]) => void) => void;
          }).on(evt, (...args: unknown[]) => {
            appEventBus.emit("ACTION_LOG", {
              action: "Player:" + evt + (args.length ? " " + JSON.stringify(args[0]).slice(0, 80) : ""),
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
 * 示例视频源列表（轮播切换）
 * 包含 HLS / DASH / MP4 三种格式
 */
const SAMPLE_SOURCES = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
];

let sampleIndex = 0;

/**
 * 切换视频源（客户端重新创建播放器实例）
 *
 * 由于 VideoPlayer 没有 setSrc API，切换源需要：
 * 1. 销毁当前播放器实例
 * 2. 清空容器
 * 3. 创建新播放器实例（带对应流媒体插件）
 * 4. 挂载到容器
 *
 * 注意：这是客户端操作，不影响 SSR 已渲染的内容
 */
function switchPlayerSource(): void {
  const src = SAMPLE_SOURCES[sampleIndex % SAMPLE_SOURCES.length];
  sampleIndex++;

  // 销毁当前播放器
  destroyCurrentPlayer();

  const wrapper = document.getElementById("player-wrapper");
  if (!wrapper) {
    console.warn("[PlayerSection] #player-wrapper 未找到");
    return;
  }

  // 清空容器
  wrapper.innerHTML = "";

  // 根据视频源类型选择插件
  const plugins: Plugin[] = [DanmakuPlugin()];

  if (/\.m3u8(\?|$)/i.test(src) || /hls/i.test(src)) {
    plugins.unshift(createHlsPlugin({ autoplay: false }));
  } else if (/\.mpd(\?|$)/i.test(src) || /dash/i.test(src)) {
    plugins.unshift(createDashPlugin({ autoplay: false }));
  }

  try {
    const config: PlayerConfig = {
      src,
      playback: {
        autoplay: false,
        muted: true,
        volume: 0.8,
      },
      interaction: {
        keyboard: true,
      },
      plugins: {
        list: plugins,
      },
      advanced: {
        debug: false,
      },
    };

    const newPlayer = new VideoPlayer(config);
    setPlayerInstance(newPlayer);
    newPlayer.mount(wrapper);

    // 监听关键事件
    const events = ["ready", "play", "pause", "ended", "error", "destroy"];
    events.forEach((evt) => {
      try {
        (newPlayer as unknown as {
          on: (e: string, cb: (...args: unknown[]) => void) => void;
        }).on(evt, (...args: unknown[]) => {
          appEventBus.emit("ACTION_LOG", {
            action: "Player:" + evt + (args.length ? " " + JSON.stringify(args[0]).slice(0, 80) : ""),
            timestamp: Date.now(),
          });
        });
      } catch {
        // 忽略
      }
    });

    (window as unknown as { player: VideoPlayer }).player = newPlayer;

    appendHydrationItem({
      id: "VideoPlayer:切换源",
      pass: true,
      detail: "src=" + src.slice(0, 60),
      timestamp: Date.now(),
    });

    appEventBus.emit("ACTION_LOG", {
      action: "VideoPlayer 切换源: " + src.slice(0, 60),
      timestamp: Date.now(),
    });
  } catch (e) {
    appendHydrationItem({
      id: "VideoPlayer:切换源",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
      timestamp: Date.now(),
    });
    console.error("[VideoPlayer Switch Error]", e);
  }
}

/**
 * 销毁当前播放器实例
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
      wrapper.innerHTML =
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:rgba(255,255,255,0.4);font-size:13px;">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
        "<span>播放器已销毁</span>" +
        "</div>";
    }

    appEventBus.emit("ACTION_LOG", {
      action: "VideoPlayer 已销毁",
      timestamp: Date.now(),
    });
  }
}

// 绑定按钮事件
const btnSwitchSource = document.getElementById("btn-switch-source");
if (btnSwitchSource) {
  btnSwitchSource.addEventListener("click", switchPlayerSource);
}

const btnDestroyPlayer = document.getElementById("btn-destroy-player");
if (btnDestroyPlayer) {
  btnDestroyPlayer.addEventListener("click", destroyCurrentPlayer);
}

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
