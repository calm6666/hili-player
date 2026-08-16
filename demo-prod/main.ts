/**
 * demo-prod 组件定义
 * ============================================
 * 与 demo/main.ts 结构一致，但播放器从构建产物导入（验证打包是否正确）。
 *
 * 导入策略：
 * - 框架核心（h, defineComponent, useState 等）：从 @/core 源码导入
 *   框架不需要独立打包发布，demo 中通过 Vite 别名即时编译
 * - 播放器（VideoPlayer）：从 packages/player/dist/index.es.js 导入
 *   这是 vite build 构建后的 ES 模块产物，验证 hiliCompile 插件是否生效
 * - 插件（HLS, DASH）：在 entry-client.ts 中按需从 dist 导入
 */

import {
  h,
  defineComponent,
  ref,
  createTypedStateManager,
  useState,
} from '../core/index.ts';
import type { Ref } from '../core/index.ts';

// ★ 从构建产物导入播放器，验证打包是否正确
// 构建产物由 packages/player/vite.config.ts 控制，包含 hiliCompile 编译优化
import { VideoPlayer } from '../packages/player/dist/index.es.js';

// ============================================
// 全局状态：简单的计数器，用于验证 useState + hydrate
// ============================================

/** 状态路径 → 类型映射 */
interface AppState {
  'app.count': number;
}

/** 创建类型安全的状态管理器，初始值 count = 0 */
const appState = createTypedStateManager<AppState>({ app: { count: 0 } });

// ============================================
// 组件 1：VideoPlayer 播放器
// ============================================
//
// 工作流程：
// 1. new VideoPlayer(config) — 构造函数 SSR 安全（不访问 DOM）
// 2. player.render() — 返回完整播放器 UI 的 VNode 树
// 3. SSR 阶段：renderToString 将 VNode 序列化为 HTML，首屏即含播放器 UI
// 4. 客户端水合：hydrate() 绑定事件到已有 DOM，无需二次挂载

const PlayerSection = defineComponent(() => {
  // 播放器配置：MP4 视频源，静音自动播放
  const cfg = {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    autoplay: false,
    muted: true,
    volume: 0.8,
    keyboard: true,
    debug: false,
  };

  // 创建播放器实例（SSR 安全，不访问浏览器 API）
  const player = new VideoPlayer(cfg as never);

  return h('div', { class: 'panel' },
    // 面板标题
    h('h2', { class: 'panel-title' }, 'VideoPlayer · 构建产物验证'),

    // 播放器容器：嵌入 player.render() 返回的 VNode
    // SSR 输出完整 HTML，水合时 PlayerDocker.onMounted 自动绑定事件
    h('div', {
      id: 'player-wrapper',
      class: 'player-wrapper',
    }, player.render()),

    // 操作按钮行
    h('div', {
      style: { display: 'flex', gap: '8px', marginTop: '10px' },
    },
      h('button', { id: 'btn-switch', class: 'btn' }, '切换视频源'),
      h('button', { id: 'btn-destroy', class: 'btn' }, '销毁播放器'),
    ),
  );
});

// ============================================
// 组件 2：计数器（验证 useState + hydrate）
// ============================================
//
// 框架无响应式：状态变化不会自动更新 DOM。
// useState 订阅状态路径，变化时在 updater 回调中手动操作 DOM。

const Counter = defineComponent((_props, lifecycle) => {
  // 用 ref 获取 DOM 元素引用（SSR 时 ref.current = null，水合后指向真实 DOM）
  const countEl: Ref<HTMLElement> = ref();
  const getCount = (): number => appState.get('app.count') ?? 0;

  // onMounted 中订阅状态变化，销毁时自动取消订阅
  lifecycle.onMounted = () => {
    useState(
      appState,
      'app.count',
      (c: number) => {
        // 状态变化时手动更新 DOM（框架无响应式，必须手动操作）
        if (countEl.current) countEl.current.textContent = String(c);
      },
      lifecycle, // 传入 lifecycle 以便销毁时自动取消订阅
    );
  };

  // 读取当前值（SSR 和客户端首次渲染时使用）
  const c = getCount();

  return h('div', { class: 'panel' },
    h('h2', { class: 'panel-title' }, '计数器 · useState + 手动 DOM'),

    h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '12px' },
    },
      // -1 按钮
      h('button', {
        class: 'btn',
        onClick: () => appState.set('app.count', getCount() - 1),
      }, '−'),

      // 当前数值（SSR 输出初始值 0，水合后手动更新）
      h('span', {
        ref: countEl,
        style: { fontSize: '20px', fontWeight: '700', minWidth: '40px', textAlign: 'center' },
      }, String(c)),

      // +1 按钮
      h('button', {
        class: 'btn',
        onClick: () => appState.set('app.count', getCount() + 1),
      }, '+'),

      // 重置按钮
      h('button', {
        class: 'btn',
        onClick: () => appState.set('app.count', 0),
      }, '重置'),
    ),
  );
});

// ============================================
// 组件 3：SSR 信息展示
// ============================================

const Info = defineComponent(() => {
  return h('div', { class: 'panel' },
    h('h2', { class: 'panel-title' }, '构建信息'),

    h('div', {
      style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.8' },
    },
      h('div', {}, '播放器: packages/player/dist/index.es.js'),
      h('div', {}, '插件:   packages/plugins/dist/'),
      h('div', {}, '编译:   vite-plugin-hili-compile'),
      h('div', {}, '渲染:   renderToString → HTML → hydrate'),
    ),
  );
});

// ============================================
// 根组件
// ============================================

const RootLayout = defineComponent(() => {
  return h('div', { class: 'app-container' },
    h('h1', {}, 'Hili Player · 构建产物验证'),
    h('p', { class: 'subtitle' }, 'SSR + Hydration · hiliCompile 编译优化 · SVG 图标'),
    PlayerSection({}),
    Counter({}),
    Info({}),
  );
});

// ============================================
// 导出入口函数（SSR 和客户端共用）
// ============================================

/**
 * createApp 被 entry-server.ts（SSR）和 entry-client.ts（水合）共同调用。
 * 两次调用必须产生完全相同的 VNode 树，否则 hydrate 时 VNode 与 DOM 不匹配。
 */
export function createApp(_props: Record<string, unknown>) {
  return h(RootLayout, {});
}
