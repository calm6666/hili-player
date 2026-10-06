/**
 * ============================================
 * 右侧控制按钮组件 (RightControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent, useTemplateRef, useState, useContext, mount, destroy } from '@/core';
import type { VNode } from '@/types';
import { PlayerStateKeyEnum, ConfigContext } from '@/store/runtimeState';
import { StateContext } from '@/store/runtimeState';
import { ConfigStoreContext } from '@/store/configStore';
import { VolumeSlider } from './VolumeSlider';
import { QualityMenu } from './QualityMenu';
import { PlaybackRateMenu } from './PlaybackRateMenu';
import { SettingMenu } from './SettingMenu';
import { EpisodesMenu } from './EpisodesMenu';
import { SubtitleMenu } from './SubtitleMenu';
import type { SubtitleStylePatch } from './SubtitleMenu';
import type { EpisodeOption } from './EpisodesMenu';
import { LottieIcon, type LottieIconApi } from './LottieIcon';
import fullscreenAnimationData from '../assets/lottie-icon/fullscreen-animation.json';
import webFullscreenAnimationData from '../assets/lottie-icon/web-fullscreen-animation.json';
import webExitFullscreenAnimationData from '../assets/lottie-icon/web-exit-fullscreen-animation.json';
import wideHoverAnimationData from '../assets/lottie-icon/wide-hover-animation.json';
import wideExitHoverAnimationData from '../assets/lottie-icon/wide-exit-hover-animation.json';
import pipHoverAnimationData from '../assets/lottie-icon/pip-hover-animation.json';
import pipExitHoverAnimationData from '../assets/lottie-icon/pip-exit-hover-animation.json';



/**
 * RightControls 组件 Props 接口
 */
export type RightControlsEvents = {
  fullscreen: undefined;
  webFullscreen: undefined;
  pip: undefined;
  wide: undefined;
  mute: undefined;
  backrateChange: number;
  volumeChange: number;
  muteToggle: undefined;
  qualityChange: string;
  /** 选集面板选择某一集，值为列表下标（透传 EpisodesMenu 的 episodeChange） */
  eplistChange: number;
  /** 字幕开关变化 */
  subtitleToggle: boolean;
  /** 字幕语言切换 */
  subtitleLangChange: string;
  /** 字幕样式变化（只带变化字段） */
  subtitleStyleChange: SubtitleStylePatch;
  /** 双语字幕开关变化 */
  bilingualChange: boolean;
  settingChange: { key: string; value: boolean | string | number };
  menuAnimation: { type: 'quality' | 'eplist' | 'playbackrate' | 'subtitle' | 'volume' | 'setting'; action: 'show' | 'hide' };
  moreSettingClick: undefined;
  rightControlsMounted: undefined;
};

export interface RightControlsProps {}

/**
 * RightControls 组件 - 使用 defineComponent 创建独立组件
 */
export const RightControls = defineComponent<RightControlsProps, RightControlsEvents>((_props, lifecycle) => {
  const configCtx = useContext(ConfigContext);
  const config = configCtx;
  const state = useContext(StateContext);
  /** 可订阅配置中心（由 VideoPlayer 注入），用于控件开关「设置即生效」 */
  const configStore = useContext(ConfigStoreContext);

  // ============================================
  // 控件开关 → 命令式显隐（ui.controls.*）
  // ============================================

  /** 受配置控制的按钮键（与 ControlsConfig 键对齐） */
  type ToggleControlKey =
    | 'quality'
    | 'episodes'
    | 'setting'
    | 'pip'
    | 'wideScreen'
    | 'webFullscreen';

  /** 控件键 → 根节点选择器（沿用现有类名，不新增类） */
  const CONTROL_SELECTORS: Record<ToggleControlKey, string> = {
    quality: '.player-ctrl-quality',
    episodes: '.player-ctrl-eplist',
    setting: '.player-ctrl-setting',
    pip: '.player-ctrl-pip',
    wideScreen: '.player-ctrl-wide',
    webFullscreen: '.player-ctrl-web',
  };

  /** 全部受控键 */
  const CONTROL_KEYS = Object.keys(CONTROL_SELECTORS) as ToggleControlKey[];

  /** 右侧控制栏根节点（用于按类名检索按钮） */
  const bottomRightRef = useTemplateRef<HTMLDivElement>(lifecycle, 'bottomRightRef');

  /** 配置订阅清理函数 */
  const configCleanups: Array<() => void> = [];

  /**
   * 命令式显示 / 隐藏某个按钮
   * @param key - 控件键
   * @param visible - 是否可见
   */
  const setControlVisible = (key: ToggleControlKey, visible: boolean): void => {
    const el = bottomRightRef.value?.querySelector<HTMLElement>(
      CONTROL_SELECTORS[key],
    );
    if (el) el.style.display = visible ? '' : 'none';
  };

  const applyEplistVisibility = (): void => {
    const total = state?.get(PlayerStateKeyEnum.PLAYLIST_LENGTH) ?? 0;
    const el = bottomRightRef.value?.querySelector<HTMLElement>(
      CONTROL_SELECTORS.episodes,
    );
    if (!el) return;
    el.style.visibility = '';
    el.style.width = '';
    el.style.display = total > 1 ? '' : 'none';
    el.classList.toggle('player-has-playlist', total > 1);
  };

  // 运行时可用清晰度列表：初始快照由 QualityMenu 内部订阅后续变化
  const qualities = state?.get(PlayerStateKeyEnum.AVAILABLE_QUALITIES) ?? [];
  const currentQuality = state?.get(PlayerStateKeyEnum.QUALITY) ?? 'auto';
  const rate = state?.get(PlayerStateKeyEnum.PLAYBACK_RATE) ?? 1;
  const rates = [2, 1.5, 1.25, 1, 0.75, 0.5];

  const onQualityChange = (quality: string): void => {
    lifecycle.emit?.('qualityChange', quality);
  };
  const onRateChange = (r: number): void => {
    lifecycle.emit?.('backrateChange', r);
  };
  const onSettingChange = (key: string, value: boolean | string | number): void => {
    lifecycle.emit?.('settingChange', { key, value });
  };
  /**
   * 菜单动画事件桥接（QualityMenu / PlaybackRateMenu / SettingMenu 均以
   * 单个 payload 对象 { type, action } 发射，与 eplist 的内联发射保持一致）
   */
  const onMenuAnimation = (payload: {
    type: 'quality' | 'eplist' | 'playbackrate' | 'volume' | 'setting';
    action: 'show' | 'hide';
  }): void => {
    lifecycle.emit?.('menuAnimation', payload);
  };

  /** 音量滑块拖拽 / 点击调量事件桥接（VolumeSlider 以单个数值发射） */
  const onVolumeChange = (volume: number): void => {
    lifecycle.emit?.('volumeChange', volume);
  };

  /** 音量图标点击静音切换事件桥接 */
  const onMuteToggle = (): void => {
    lifecycle.emit?.('muteToggle');
  };

  // ============================================
  // 选集面板（EpisodesMenu）数据与事件桥接
  // ============================================

  /** 选集列表（首帧快照来自运行时状态；后续变化由下方订阅刷新并重建面板） */
  let episodes: EpisodeOption[] = state?.get(PlayerStateKeyEnum.PLAYLIST) ?? [];
  /** 当前集下标（首帧快照；切集后的高亮由 EpisodesMenu 内部订阅同一状态键维护） */
  let currentIndex: number = state?.get(PlayerStateKeyEnum.PLAYLIST_INDEX) ?? 0;
  /** 选集面板组件节点（列表真正变化时据此原地重建） */
  let eplistVNode: VNode | null = null;

  /**
   * 列表内容签名：用于判断 PLAYLIST 通知是否真的换了列表
   * （切集时 VideoPlayer 会重写 PLAYLIST，但内容不变，此时不应重建面板）
   * @param list - 选集列表
   * @returns 内容签名
   */
  const episodesKey = (list: EpisodeOption[]): string =>
    list
      .map((item) => `${item.index}:${item.id ?? ''}:${item.title ?? ''}`)
      .join('|');

  /** 当前面板节点对应的列表签名 */
  let eplistKey = episodesKey(episodes);

  /** 选集面板点击某一集：下标向上抛，最终落到 VideoPlayer.switchTo(index) */
  const onEpisodeChange = (index: number): void => {
    lifecycle.emit?.('eplistChange', index);
  };

  /** 字幕面板：开关 */
  const onSubtitleToggle = (visible: boolean): void => {
    lifecycle.emit?.('subtitleToggle', visible);
  };

  /** 字幕面板：语言切换 */
  const onSubtitleLangChange = (lang: string): void => {
    lifecycle.emit?.('subtitleLangChange', lang);
  };

  /** 字幕面板：样式项变化（只带变化字段） */
  const onSubtitleStyleChange = (patch: SubtitleStylePatch): void => {
    lifecycle.emit?.('subtitleStyleChange', patch);
  };

  /** 字幕面板：双语开关 */
  const onBilingualChange = (enabled: boolean): void => {
    lifecycle.emit?.('bilingualChange', enabled);
  };

  /**
   * 创建选集面板节点
   *
   * 显式注入 StateContext：运行期重建发生在渲染栈之外（状态订阅回调里），
   * 组件沿 __parent 链取不到 Provider（与 PlayerDocker 懒挂载面板同一处理）。
   * @returns EpisodesMenu 组件节点
   */
  const createEplistVNode = (): VNode =>
    h(EpisodesMenu, {
      episodes,
      currentIndex,
      onEpisodeChange,
      onMenuAnimation,
      __providers: state
        ? [{ contextId: StateContext.id, value: state }]
        : undefined,
    });

  /**
   * 原地重建选集面板（列表数据真正变化时调用）
   *
   * 框架无虚拟 DOM diff：EpisodesMenu 的 episodes 是 props 快照，
   * 仅靠订阅拿不到新列表，只能销毁旧实例再挂载新实例。
   * mount 只能追加到容器末尾，故先挂到临时容器，再 insertBefore 插回原位置，
   * 保证选集按钮在右侧控制栏中的顺序不变。
   */
  const rebuildEplist = (): void => {
    const oldEl = eplistVNode?.el;
    const host = (oldEl?.parentNode ?? null) as HTMLElement | null;
    if (!eplistVNode || !oldEl || !host) return; // 尚未挂载：首帧渲染自带最新数据

    const anchor = oldEl.nextSibling;
    destroy(eplistVNode);

    const next = createEplistVNode();
    eplistVNode = next;

    const staging = document.createElement('div');
    mount(next, staging);
    if (next.el) {
      host.insertBefore(next.el, anchor);
    }
  };

  // ============================================
  // DOM 引用
  // ============================================

  /** 画中画按钮元素引用 */
  const pipBtnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'pipBtnRef');

  /** 宽屏按钮元素引用 */
  const wideBtnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'wideBtnRef');

  /** 网页全屏按钮元素引用 */
  const webBtnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'webBtnRef');

  /** 全屏按钮元素引用 */
  const fullBtnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'fullBtnRef');

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 切换全屏状态
   */
  const toggleFullscreen = (): void => { lifecycle.emit?.('fullscreen'); };

  /**
   * 切换网页全屏状态
   */
  const toggleWebFullscreen = (): void => { lifecycle.emit?.('webFullscreen'); };

  /**
   * 切换画中画状态
   */
  const togglePip = (): void => { lifecycle.emit?.('pip'); };

  /**
   * 切换宽屏状态
   */
  const toggleWide = (): void => { lifecycle.emit?.('wide'); };

  /** 全屏按钮 API 引用 */
  const fullscreenRef = useTemplateRef<LottieIconApi>(lifecycle, 'fullscreenRef');
  /** 网页全屏按钮 API 引用 */
  const webFullscreenRef = useTemplateRef<LottieIconApi>(lifecycle, 'webFullscreenRef');
  /** 宽屏按钮 API 引用 */
  const wideRef = useTemplateRef<LottieIconApi>(lifecycle, 'wideRef');
  /** 画中画按钮 API 引用 */
  const pipRef = useTemplateRef<LottieIconApi>(lifecycle, 'pipRef');



  /**
   * 全屏悬悬停事件处理函数
   */
  const mouseFullscreenEnter = (): void => {
    fullscreenRef.value?.play();
  };

  /**
   * 全屏悬停事件处理函数
   */
  const mouseFullscreenLeave = (): void => {
  };

  /**
   * 网页全屏悬悬停事件处理函数
   */
  const mouseWebEnter = (): void => {
    webFullscreenRef.value?.play();
  };

  /**
   * 网页全屏悬停事件处理函数
   */
  const mouseWebLeave = (): void => {
  };

  /**
   * 宽屏悬悬停事件处理函数
   */
  const mouseWideEnter = (): void => {
    wideRef.value?.play();
  };

  /**
   * 宽屏悬停事件处理函数
   */
  const mouseWideLeave = (): void => {
  };

  /**
   * 画中画悬悬停事件处理函数
   */
  const mousePipEnter = (): void => {
    pipRef.value?.play();
  };

  /**
   * 画中画悬停事件处理函数
   */
  const mousePipLeave = (): void => {
  };

  // ============================================
  // 状态监听（通过 useState + useContext 订阅 TypedStateManager）
  // ============================================
  // useContext(StateContext) 从最近的 Provider 获取状态管理器实例
  // 无需 props 传递，组件直接订阅，避免层级穿透
  //
  // 当外部改变全屏/画中画/宽屏等状态时，自动更新按钮的视觉反馈
  // 例如：用户按 F11 → VideoPlayer 检测到 fullscreenchange
  //   → state.set(PlayerStateKeyEnum.IS_FULLSCREEN, true)
  //   → 此处 updater 自动执行，给按钮添加 active 样式

  if (state) {
    /**
     * 监听全屏状态变化
     * 进入全屏时给全屏按钮添加 'state-active' 样式类，退出时移除
     * 例如：state.set(PlayerStateKeyEnum.IS_FULLSCREEN, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_FULLSCREEN,
      (isFullscreen) => {
        if (fullBtnRef.value) {
          fullBtnRef.value.classList.toggle('state-active', isFullscreen);
        }
      },
      lifecycle
    );

    /**
     * 监听网页全屏状态变化
     * 进入网页全屏时给按钮添加 'state-active' 样式类，退出时移除
     * 例如：state.set(PlayerStateKeyEnum.IS_WEB_FULLSCREEN, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_WEB_FULLSCREEN,
      (isWebFullscreen) => {
        if (webBtnRef.value) {
          webBtnRef.value.classList.toggle('state-active', isWebFullscreen);
        }
      },
      lifecycle
    );

    /**
     * 监听画中画状态变化
     * 进入画中画时给按钮添加 'state-active' 样式类，退出时移除
     * 例如：state.set(PlayerStateKeyEnum.IS_PIP, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_PIP,
      (isPip) => {
        if (pipBtnRef.value) {
          pipBtnRef.value.classList.toggle('state-active', isPip);
        }
      },
      lifecycle
    );

    /**
     * 监听宽屏状态变化
     * 进入宽屏模式时给按钮添加 'state-active' 样式类，退出时移除
     * 例如：state.set(PlayerStateKeyEnum.IS_WIDE_SCREEN, true)
     */
    useState(
      state,
      PlayerStateKeyEnum.IS_WIDE_SCREEN,
      (isWide) => {
        if (wideBtnRef.value) {
          wideBtnRef.value.classList.toggle('state-active', isWide);
        }
      },
      lifecycle
    );

    /**
     * 监听播放列表数据（player.playlist）
     * 列表内容真正变化时刷新传给 EpisodesMenu 的快照并原地重建面板；
     * 切集只会重写同内容的 PLAYLIST，签名一致则不重建，按钮节点保持稳定
     */
    useState(
      state,
      PlayerStateKeyEnum.PLAYLIST,
      (list) => {
        const next = list ?? [];
        const nextKey = episodesKey(next);
        if (nextKey === eplistKey) return;
        episodes = next;
        eplistKey = nextKey;
        rebuildEplist();
        applyEplistVisibility();
      },
      lifecycle
    );

    /**
     * 监听当前集下标（player.playlistIndex）
     * 这里只维护传给组件的快照；「切集后高亮跟随」由 EpisodesMenu
     * 内部对同一状态键的订阅完成（组件自带，无需父层驱动）
     */
    useState(
      state,
      PlayerStateKeyEnum.PLAYLIST_INDEX,
      (index) => {
        if (typeof index === 'number') currentIndex = index;
      },
      lifecycle
    );

    useState(
      state,
      PlayerStateKeyEnum.PLAYLIST_LENGTH,
      () => {
        applyEplistVisibility();
      },
      lifecycle
    );
  }

  // ============================================
  // 底部右侧按钮渲染器映射表
  // ============================================

  /** 按钮类型到渲染函数的映射表，每个键对应一种控制按钮的渲染逻辑 */
  const bottomRightRenderers: Record<string, () => VNode | null> = {
    /** 渲染画质选择菜单 */
    quality: () => {
      return h(QualityMenu, { qualities, currentQuality, onQualityChange, onMenuAnimation });
    },
    /** 渲染选集菜单（列表数据 / 当前集高亮由 EpisodesMenu 内部订阅运行时状态维护） */
    eplist: () => {
      eplistVNode = createEplistVNode();
      return eplistVNode;
    },
    /** 渲染播放速率选择菜单 */
    playbackrate: () => h(PlaybackRateMenu, { rate, rates, onRateChange, onMenuAnimation }),
    /** 渲染字幕设置面板（开关 / 语言 / 字号颜色位置等 / 双语） */
    subtitle: () => {
      /** 字幕样式初值（面板内部会按用户操作命令式更新） */
      const subtitleStyle = {
        fontSize: 0,
        color: '#ffffff',
        position: 'bottom' as const,
        offset: 0,
        strokeColor: 'none',
        strokeWidth: 0,
        opacity: 0.87,
        scale: false,
        fade: false,
      };
      return h(SubtitleMenu, {
        visible: state?.get(PlayerStateKeyEnum.SUBTITLE_VISIBLE) ?? false,
        lang: state?.get(PlayerStateKeyEnum.SUBTITLE_LANG) ?? '',
        // 语言列表：播放器暂无对应运行时状态键；由使用方通过配置提供，缺省为空数组
        languages: configStore?.getPath<
          { lang: string; label: string; isDefault?: boolean }[]
        >('subtitle.list') ?? [],
        style: subtitleStyle,
        onSubtitleToggle,
        onSubtitleLangChange,
        onSubtitleStyleChange,
        onBilingualChange,
        onMenuAnimation,
      });
    },
    /** 渲染音量滑块组件（hover 展开 / 拖拽调量 / 静音切换） */
    volume: () => h(VolumeSlider, { onMenuAnimation, onVolumeChange, onMuteToggle }),
    /** 渲染设置菜单 */
    setting: () => {
      return h(SettingMenu, { onSettingChange, onMenuAnimation });
    },
    /** 渲染画中画按钮 */
    pip: () => {
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-pip',
        role: 'button',
        'aria-label': '画中画',
        ref: 'pipBtnRef',
        onClick: togglePip,
        onMouseEnter: mousePipEnter,
        onMouseLeave: mousePipLeave,
      },
        h('div', { class: 'player-ctrl-btn-icon' },
          h(LottieIcon, {
            name: 'pip',
            sequence: [
              {
                animationData: pipHoverAnimationData,
                complete: 'stop',
                autoplay: false
              },
              {
                animationData: pipExitHoverAnimationData,
                complete: 'stop',
                autoplay: false
              }
            ],
            ref: 'pipRef'
          }
          )
        ),
      );
    },
    /** 渲染宽屏按钮 */
    wide: () => {
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-wide',
        role: 'button',
        'aria-label': '宽屏',
        ref: 'wideBtnRef',
        onClick: toggleWide,
        onMouseEnter: mouseWideEnter,
        onMouseLeave: mouseWideLeave,
      },
        h('div', { class: 'player-ctrl-btn-icon' },
          h(LottieIcon, {
            name: 'wide',
            sequence: [
              {
                animationData: wideHoverAnimationData,
                complete: 'stop',
                autoplay: false
              },
              {
                animationData: wideExitHoverAnimationData,
                complete: 'stop',
                autoplay: false
              }
            ],
            ref: 'wideRef'
          }
          )
        )
      );
    },
    /** 渲染网页全屏按钮 */
    web: () => {
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-web',
        role: 'button',
        'aria-label': '网页全屏',
        ref: 'webBtnRef',
        onClick: toggleWebFullscreen,
        onMouseEnter: mouseWebEnter,
        onMouseLeave: mouseWebLeave,
      },
        h('div', { class: 'player-ctrl-btn-icon' },
          h(LottieIcon, {
            name: 'webFullscreen',
            sequence: [
              {
                animationData: webFullscreenAnimationData,
                complete: 'stop',
                autoplay: false
              },
              {
                animationData: webExitFullscreenAnimationData,
                complete: 'stop',
                autoplay: false
              }
            ],
            ref: 'webFullscreenRef'
          }
          )
        )
      );
    },
    /** 渲染全屏按钮 */
    full: () => h('div', {
      class: 'player-ctrl-btn player-ctrl-full',
      role: 'button',
      'aria-label': '全屏',
      ref: 'fullBtnRef',
      onMouseEnter: mouseFullscreenEnter,
      onMouseLeave: mouseFullscreenLeave,
      onClick: toggleFullscreen
    },
      h('div', { class: 'player-ctrl-btn-icon' },
        h(LottieIcon,
          {
            name: 'fullscreen',
            animationData: fullscreenAnimationData,
            ref: 'fullscreenRef',
            autoplay: false
          }
        )
      )
    )
  };

  /** 底部右侧按钮的渲染顺序配置 */
  const bottomRightOrder = ['quality', 'eplist', 'playbackrate', 'subtitle', 'volume', 'setting', 'pip', 'wide', 'web', 'full'];

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后：按当前配置初始化按钮显隐，并订阅 ui.controls.* 实现设置即生效
   */
  lifecycle.onMounted = (): void => {
    CONTROL_KEYS.forEach((key) => {
      const initial =
        configStore?.getPath<boolean>(`ui.controls.${key}`) ??
        config[key] ??
        true;
      setControlVisible(key, initial !== false);
    });

    if (configStore) {
      CONTROL_KEYS.forEach((key) => {
        configCleanups.push(
          configStore.subscribePath(`ui.controls.${key}`, (value) => {
            setControlVisible(key, value !== false);
          }),
        );
      });
    }

    applyEplistVisibility();

    lifecycle.emit?.('rightControlsMounted');
  };

  /** 组件销毁前取消配置订阅 */
  lifecycle.onBeforeDestroy = (): void => {
    configCleanups.forEach((fn) => fn());
    configCleanups.length = 0;
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', { class: 'player-control-bottom-right', ref: 'bottomRightRef' },
    ...bottomRightOrder
      .map(key => {
        /** 当前键对应的渲染函数 */
        const renderer = bottomRightRenderers[key];
        if (!renderer) return null;
        return renderer();
      })
      .filter((vnode): vnode is VNode => vnode !== null)
  );
});
