/**
 * ============================================
 * 左侧控制按钮组件 (LeftControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 *
 * 设计模式（与 RightControls 一致）：
 *   - config 通过 useContext(ConfigContext) 获取，不走 props 传递
 *   - duration / currentTime 通过 useState 订阅 StateContext 获取
 *   - 事件通过 defineComponent 的第二泛型参数声明，用 lifecycle.emit 发射
 *   - 框架无响应式，DOM 更新必须手动完成（通过 useState 订阅 + updater 回调）
 */

import { h, defineComponent, useTemplateRef, useState, useContext } from '@/core';
import type { VNode } from '@/types';
import { PlayerStateKeyEnum, ConfigContext } from '@/store/runtimeState';
import { StateContext } from '@/store/runtimeState';
import { ConfigStoreContext } from '@/store/configStore';
import { PlayerState } from '@/types';
import { formatTime } from '@/utils/formatTime';
import { LottieIcon, type LottieIconApi } from './LottieIcon';
import { ViewpointMenu, type ViewpointItem } from './ViewpointMenu';
import pauseToPlayAnimationData from '../assets/lottie-icon/pause-to-play-animation.json';
import playToPauseAnimationData from '../assets/lottie-icon/play-to-pause-animation.json';

/**
 * LeftControls 组件事件映射
 * 键名对应 lifecycle.emit 的事件名，值类型对应事件参数
 * defineComponent<Props, Events> 第二泛型参数会自动生成 onXxx 回调 props
 */
export type LeftControlsEvents = {
  /** 点击上一个按钮 */
  prev: undefined;
  /** 点击下一个按钮 */
  next: undefined;
  /** 点击播放/暂停按钮 */
  playPause: undefined;
  /** 进度跳转，参数为跳转目标时间（秒） */
  seek: number;
  /** 菜单动画回调，参数为菜单类型和动作 */
  menuAnimation: { type: string; action: 'show' | 'hide' };
  /** 组件挂载完成 */
  leftControlsMounted: undefined;
};

/**
 * LeftControls 组件 Props 接口
 * config 和 duration 不再通过 props 传递，改为 useContext 获取
 * 避免层级穿透，与 RightControls 保持一致
 */
export interface LeftControlsProps {}

/**
 * LeftControls 组件 - 使用 defineComponent 创建独立组件
 * 第二泛型参数 LeftControlsEvents 声明组件可发射的事件
 * 父组件通过 onPrev、onNext 等 props 监听事件
 */
export const LeftControls = defineComponent<LeftControlsProps, LeftControlsEvents>((_props, lifecycle) => {
  /**
   * 通过 useContext 获取配置上下文
   * ConfigContext 由父组件 Controls 通过 provide 注入
   * 无需 props 传递，组件直接订阅，避免层级穿透
   */
  const configCtx = useContext(ConfigContext);
  const config = configCtx;

  /** 可订阅配置中心（由 VideoPlayer 注入），用于 prev/next 按钮「设置即生效」 */
  const configStore = useContext(ConfigStoreContext);

  /** 底部左侧根节点（用于按类名检索按钮） */
  const bottomLeftRef = useTemplateRef<HTMLDivElement>(lifecycle, 'bottomLeftRef');

  /** 受配置控制的按钮键 → 选择器 */
  const CONTROL_SELECTORS: Record<'prev' | 'next', string> = {
    prev: '.player-ctrl-prev',
    next: '.player-ctrl-next',
  };

  /** 配置订阅清理函数 */
  const configCleanups: Array<() => void> = [];

  /**
   * 命令式显示 / 隐藏 prev / next 按钮
   * @param key - 控件键
   * @param visible - 是否可见
   */
  const setControlVisible = (key: 'prev' | 'next', visible: boolean): void => {
    const el = bottomLeftRef.value?.querySelector<HTMLElement>(
      CONTROL_SELECTORS[key],
    );
    if (el) el.style.display = visible ? '' : 'none';
  };

  /**
   * 通过 useContext 获取状态管理器
   * StateContext 由 VideoPlayer 通过 provide 注入
   * duration / currentTime 等动态数据通过 useState 订阅获取
   */
  const state = useContext(StateContext);

  /** 从状态管理器读取当前时长与当前时间，用于 onMounted 初始化显示 */
  const duration = state?.get(PlayerStateKeyEnum.DURATION) ?? 0;
  const currentTime = state?.get(PlayerStateKeyEnum.CURRENT_TIME) ?? 0;

  // ============================================
  // DOM 引用
  // ============================================

  /** 当前时间显示元素引用 */
  const playerCtrlTimeCurrentRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerCtrlTimeCurrentRef');

  /** 总时长显示元素引用 */
  const playerCtrlTimeDurationRef = useTemplateRef<HTMLDivElement>(lifecycle, 'playerCtrlTimeDurationRef');

  /** 播放/暂停按钮图标 API 引用（LottieIcon 暴露的接口） */
  const playOrPauseIconBtnRef = useTemplateRef<LottieIconApi>(lifecycle, 'playOrPauseIconBtnRef');

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 处理上一个按钮点击
   * 通过 lifecycle.emit 发射事件，父组件通过 onPrev 监听
   */
  const handlePrev = (): void => { lifecycle.emit?.('prev'); };

  /**
   * 处理下一个按钮点击
   * 通过 lifecycle.emit 发射事件，父组件通过 onNext 监听
   */
  const handleNext = (): void => { lifecycle.emit?.('next'); };

  /** 当前是否正在播放（用于切换播放/暂停图标动画方向） */
  let playing: boolean = false;

  /**
   * 切换播放/暂停状态
   * 根据当前播放状态决定动画方向，然后发射 playPause 事件
   */
  const togglePlayPause = (): void => {
    if (playing) {
      playToPauseAnimation();
      playing = false;
    } else {
      pauseToPlayAnimation();
      playing = true;
    }
    lifecycle.emit?.('playPause');
  };

  /**
   * 暂停→播放图标动画
   * 先切换到播放动画槽位（slot 0），再播放
   */
  const pauseToPlayAnimation = (): void => {
    if (playOrPauseIconBtnRef.value?.getCurrentSlotIndex() != 0) {
      playOrPauseIconBtnRef.value?.advanceSlot();
    }
    playOrPauseIconBtnRef.value?.play();
  };

  /**
   * 播放→暂停图标动画
   * 先切换到暂停动画槽位（slot 1），再播放
   */
  const playToPauseAnimation = (): void => {
    if (playOrPauseIconBtnRef.value?.getCurrentSlotIndex() != 1) {
      playOrPauseIconBtnRef.value?.advanceSlot();
    }
    playOrPauseIconBtnRef.value?.play();
  };

  /**
   * 上一个/下一个按钮的 SVG 图标渲染函数
   * 返回内联 SVG VNode，包含播放控制箭头图标
   */
  const nextBtnIconRenderer: () => VNode | null = () => {
    return h('svg', {
      'xml:space': 'preserve',
      'data-pointer': 'none',
      style: 'enable-background:new 0 0 22 22',
      viewBox: '0 0 22 22'
    },
      h('path', { d: 'M16 5a1 1 0 0 0-1 1v4.615a1.431 1.431 0 0 0-.615-.829L7.21 5.23A1.439 1.439 0 0 0 5 6.445v9.11a1.44 1.44 0 0 0 2.21 1.215l7.175-4.555a1.436 1.436 0 0 0 .616-.828V16a1 1 0 0 0 2 0V6C17 5.448 16.552 5 16 5z' })
    );
  };

  // ============================================
  // 状态监听（通过 useState + useContext 订阅 TypedStateManager）
  // ============================================
  // useContext(StateContext) 从最近的 Provider 获取状态管理器实例
  // 无需 props 传递，组件直接订阅，避免层级穿透
  //
  // useState 工作原理：
  //   1. 读取 state.get(path) 的当前值并返回
  //   2. 自动订阅 path 的变化，变化时调用 updater 回调更新 DOM
  //   3. 组件销毁时自动取消订阅（通过 lifecycle.onDestroyed）
  //   4. updater 在 queueMicrotask 中执行，瞬时通知且不阻塞主线程
  //
  // 框架无响应式：状态变化不会自动更新 DOM
  // 必须在 updater 回调中手动操作 DOM（如 el.innerHTML = ...）
  // 这是本框架的核心约束，与 Vue/React 的响应式系统根本不同

  if (state) {
    /**
     * 监听播放状态变化
     * 当外部（VideoPlayer / 插件）改变播放状态时，自动更新播放/暂停图标
     * 例如：state.set(PlayerStateKeyEnum.STATE, PlayerState.PLAYING)
     */
    useState(
      state,
      PlayerStateKeyEnum.STATE,
      (newState) => {
        const ps = newState as PlayerState;
        if (ps === PlayerState.PLAYING) {
          playing = true;
          pauseToPlayAnimation();
        } else if (ps === PlayerState.PAUSED || ps === PlayerState.ENDED) {
          playing = false;
          playToPauseAnimation();
        }
      },
      lifecycle
    );

    /**
     * 监听当前播放时间变化
     * 当 timeupdate 触发时，手动更新时间显示 DOM
     * 框架无响应式，必须手动操作 DOM：el.innerHTML = formatTime(newTime)
     * 例如：state.set(PlayerStateKeyEnum.CURRENT_TIME, 123.45)
     */
    useState(
      state,
      PlayerStateKeyEnum.CURRENT_TIME,
      (newTime) => {
        if (playerCtrlTimeCurrentRef.value) {
          playerCtrlTimeCurrentRef.value.innerHTML = formatTime(newTime as number);
        }
      },
      lifecycle
    );

    /**
     * 监听视频总时长变化
     * 当视频元数据加载完成时，手动更新时长显示 DOM
     * 例如：state.set(PlayerStateKeyEnum.DURATION, 3600)
     */
    useState(
      state,
      PlayerStateKeyEnum.DURATION,
      (newDuration) => {
        if (playerCtrlTimeDurationRef.value) {
          playerCtrlTimeDurationRef.value.innerHTML = formatTime(newDuration as number);
        }
      },
      lifecycle
    );

    /**
     * 监听加载状态变化
     * 加载中时禁用播放按钮，防止重复操作
     * 手动操作 DOM：el.style.pointerEvents = 'none'
     * 例如：state.set(PlayerStateKeyEnum.IS_LOADING, true)
     * TODO: 待确认 loading 期间的 DOM 表现——既有实现中 loading 由独立的 Loading 组件
     *       （player-loading-panel / state-loading 类）负责，未在控制栏切换 pointer-events，
     *       且本组件没有播放按钮的 DOM 引用，故暂不实现回调体，仅占位监听。
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_LOADING,
      (_isLoading) => {
      },
      lifecycle
    );

    /**
     * 监听缓冲进度变化
     * 可用于显示缓冲进度条（当前未渲染缓冲条 UI，预留监听）
     * 例如：state.set(PlayerStateKeyEnum.BUFFERED, 0.75)
     */
    useState(
      state,
      PlayerStateKeyEnum.BUFFERED,
      (_buffered) => {
        // 预留：可用于更新缓冲进度条 UI
      },
      lifecycle
    );
  }

  // ============================================
  // 底部左侧按钮渲染器映射表
  // ============================================

  /** 按钮类型到渲染函数的映射表，每个键对应一种控制按钮的渲染逻辑 */
  const bottomLeftRenderers: Record<string, () => VNode | null> = {
    /** 渲染上一个按钮，config.prev 为 true 时显示 */
    prev: () => h('div', {
      role: 'button',
      'aria-label': '上一个',
      class: 'player-ctrl-btn player-ctrl-prev',
      onClick: handlePrev
    },
      h('div', { class: 'player-ctrl-btn-icon' },
        h('span',
          {
            class: 'common-svg-icon',
            'data-name': 'prev'
          },
          nextBtnIconRenderer()
        )
      )
    ),
    /** 渲染播放/暂停按钮，包含播放和暂停两个 Lottie 动画图标 */
    play: () => h('div', {
      role: 'button',
      'aria-label': '播放/暂停',
      class: 'player-ctrl-btn player-ctrl-play',
      onClick: togglePlayPause
    },
      h('div', {
        class: 'player-ctrl-btn-icon'
      },
        h(LottieIcon, {
          name: 'play-or-pause',
          sequence: [
            {
              animationData: pauseToPlayAnimationData,
              complete: 'stop',
              autoplay: false
            },
            {
              animationData: playToPauseAnimationData,
              complete: 'stop',
              autoplay: false
            }
          ],
          ref: 'playOrPauseIconBtnRef'
        }),
      )
    ),
    /** 渲染下一个按钮，config.next 为 true 时显示 */
    next: () => h('div', {
      role: 'button',
      'aria-label': '下一个',
      class: 'player-ctrl-btn player-ctrl-next',
      onClick: handleNext
    },
      h('div', { class: 'player-ctrl-btn-icon' },
        h('span',
          {
            class: 'common-svg-icon',
            'data-name': 'next'
          },
          nextBtnIconRenderer()
        )
      )
    ),
    /** 渲染时间显示区域，包含当前时间和总时长 */
    time: () => h('div', { class: 'player-ctrl-btn player-ctrl-time' },
      h('input', { id: 'playerCtrlTimeSeekInput', class: 'player-ctrl-time-seek', type: 'text', value: '0:00', style: 'display: none;' },),
      h('div', { class: 'player-ctrl-time-label' },
        // 初始即渲染 formatTime(0)（"00:00"），未播放时时间显示不再是空白
        h('span', { class: 'player-ctrl-time-current', ref: 'playerCtrlTimeCurrentRef' }, formatTime(currentTime)),
        h('span', { class: 'player-ctrl-time-divide' }, '/'),
        h('span', { class: 'player-ctrl-time-duration', ref: 'playerCtrlTimeDurationRef' }, formatTime(duration))
      )
    ),
    /**
     * 渲染看点（章节）菜单
     *
     * 数据源为 `progress.segments`（对应参考实现的 progressViewPoints：
     * ProgressSegment 与 ProgressViewPoint 字段一一对应，label 即 pointText）。
     * 仅在开启看点且分段数大于 1 时渲染。
     */
    viewpoint: (): VNode | null => {
      const segments = config.progressSegments;
      if (!config.viewpoint || !segments || segments.length <= 1) {
        return null;
      }
      const points: ViewpointItem[] = segments.map((segment) => ({
        title: segment.label,
        time: segment.startTime,
      }));
      return h(ViewpointMenu, {
        points,
        currentTime,
        onSeek: (time: number) => lifecycle.emit?.('seek', time),
        onMenuAnimation: (type: string, action: 'show' | 'hide') =>
          lifecycle.emit?.('menuAnimation', { type, action }),
      });
    },
  };

  /** 底部左侧按钮的渲染顺序配置 */
  const bottomLeftOrder = ['prev', 'play', 'next', 'time', 'viewpoint'];

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后，初始化当前时间与总时长显示
   * 手动操作 DOM：el.innerHTML = formatTime(...)
   * 框架无响应式，必须手动更新 DOM
   *
   * 说明：useState 的订阅在首帧不执行回调（core/state.ts subscribe 跳过初始运行），
   * 因此挂载时需手动刷一次，保证未播放时显示 "00:00 / 00:00" 而非空白
   */
  lifecycle.onMounted = (): void => {
    if (playerCtrlTimeCurrentRef.value) {
      playerCtrlTimeCurrentRef.value.innerHTML = formatTime(
        state?.get(PlayerStateKeyEnum.CURRENT_TIME) ?? 0,
      );
    }
    if (playerCtrlTimeDurationRef.value) {
      playerCtrlTimeDurationRef.value.innerHTML = formatTime(duration);
    }

    // prev / next 按钮：按当前配置初始化显隐，并订阅 ui.controls.* 实现设置即生效
    (['prev', 'next'] as const).forEach((key) => {
      const initial =
        configStore?.getPath<boolean>(`ui.controls.${key}`) ??
        config[key] ??
        true;
      setControlVisible(key, initial !== false);
    });
    if (configStore) {
      (['prev', 'next'] as const).forEach((key) => {
        configCleanups.push(
          configStore.subscribePath(`ui.controls.${key}`, (value) => {
            setControlVisible(key, value !== false);
          }),
        );
      });
    }

    lifecycle.emit?.('leftControlsMounted');
  };

  /** 组件销毁前取消配置订阅 */
  lifecycle.onBeforeDestroy = (): void => {
    configCleanups.forEach((fn) => fn());
    configCleanups.length = 0;
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', { class: 'player-control-bottom-left', ref: 'bottomLeftRef' },
    ...bottomLeftOrder
      .map(key => {
        /** 当前键对应的渲染函数 */
        const renderer = bottomLeftRenderers[key];
        if (!renderer) return null;
        return renderer();
      })
      .filter((vnode): vnode is VNode => vnode !== null)
  );
});
