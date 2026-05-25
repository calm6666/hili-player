/**
 * ============================================
 * 右侧控制按钮组件 (RightControls)
 * ============================================
 * 独立的函数组件，拥有自己的生命周期
 */

import { h, defineComponent } from '@/core';
import type { VNode } from '@/types';
import type { ControlConfig } from '@/hili-player/types';

/**
 * RightControls 组件 Props 接口
 */
export interface RightControlsProps {
  config: ControlConfig;
}

/**
 * RightControls 组件 - 使用 defineComponent 创建独立组件
 */
export const RightControls = defineComponent<RightControlsProps>((props, lifecycle) => {
  const { config } = props;

  // ============================================
  // DOM 引用
  // ============================================
  const ctrlQualityBtnRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlEplistBtnRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlBackrateBtnRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlVolumeBtnRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlVolumeIconBtnRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlMutedIconBtnRef: { current: HTMLDivElement | null } = { current: null };
  const ctrlSettingBtnRef: { current: HTMLDivElement | null } = { current: null };
  const qualityResultRef: { current: HTMLDivElement | null } = { current: null };
  const qualityMenuRef: { current: HTMLUListElement | null } = { current: null };
  const eplistResultRef: { current: HTMLDivElement | null } = { current: null };
  const eplistMenuRef: { current: HTMLUListElement | null } = { current: null };
  const backrateResultTextRef: { current: HTMLDivElement | null } = { current: null };
  const volumeNumberRef: { current: HTMLDivElement | null } = { current: null };
  const volumeSliderAreaRef: { current: HTMLDivElement | null } = { current: null };
  const volumeProgressbarRef: { current: HTMLDivElement | null } = { current: null };
  const volumeSliderThumbRef: { current: HTMLDivElement | null } = { current: null };
  const settingMenuAreaRef: { current: HTMLDivElement | null } = { current: null };
  const settingMenuRightRef: { current: HTMLDivElement | null } = { current: null };
  const settingMenuMoreRef: { current: HTMLDivElement | null } = { current: null };
  const settingOthersContentRef: { current: HTMLDivElement | null } = { current: null };
  const pipBtnRef: { current: HTMLDivElement | null } = { current: null };
  const wideBtnRef: { current: HTMLDivElement | null } = { current: null };
  const webBtnRef: { current: HTMLDivElement | null } = { current: null };
  const fullBtnRef: { current: HTMLDivElement | null } = { current: null };

  // ============================================
  // 状态
  // ============================================
  const backrateMenuItems: HTMLLIElement[] = [];

  // ============================================
  // 事件处理函数
  // ============================================
  const toggleFullscreen = (): void => { lifecycle.emit?.('fullscreen'); };
  const toggleWebFullscreen = (): void => { lifecycle.emit?.('webFullscreen'); };
  const togglePip = (): void => { lifecycle.emit?.('pip'); };
  const toggleWide = (): void => { lifecycle.emit?.('wide'); };
  const toggleMute = (): void => { lifecycle.emit?.('mute'); };

  // ============================================
  // 辅助函数
  // ============================================
  const renderBackrateItem = (value: string, label: string): VNode => {
    return h('li', {
      class: 'player-ctrl-playbackrate-menu-item',
      'data-value': value,
      onClick: (e: MouseEvent) => {
        const target = e.currentTarget;
        if (target instanceof HTMLElement) {
          changeBackrate(parseFloat(value), target);
        }
      }
    }, label);
  };

  const changeBackrate = (backrate: number, target: HTMLElement): void => {
    lifecycle.emit?.('backrateChange', backrate);
    backrateMenuItems.forEach((item) => item.classList.remove('active'));
    target.classList.add('active');
    if (backrateResultTextRef.current) {
      backrateResultTextRef.current.innerText = backrate === 1 ? '倍速' : backrate + 'X';
    }
  };

  const volumeMouseDown = (event: MouseEvent): void => {
    lifecycle.emit?.('volumeMouseDown', event);
  };

  const handlVolumeMouseDown = (event: MouseEvent): void => {
    lifecycle.emit?.('handlVolumeMouseDown', event);
  };

  // ============================================
  // 底部右侧按钮渲染器映射表
  // ============================================
  const bottomRightRenderers: Record<string, () => VNode | null> = {
    quality: () => {
      if (!config.quality) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-quality',
        role: 'button',
        'aria-label': '清晰度',
        ref: ctrlQualityBtnRef,
        onMouseEnter: () => lifecycle.emit?.('menuAnimation', 'quality', 'show'),
        onMouseLeave: () => lifecycle.emit?.('menuAnimation', 'quality', 'hide')
      },
        h('div', { class: 'player-ctrl-quality-result', ref: qualityResultRef }, '自动'),
        h('div', { class: 'player-ctrl-quality-menu-wrap' },
          h('ul', { class: 'player-ctrl-quality-menu', ref: qualityMenuRef },
            h('li', { class: 'player-ctrl-quality-menu-item' },
              h('span', { class: 'player-ctrl-quality-text' }),
              h('span', { class: 'player-ctrl-quality-badge player-ctrl-quality-badge-bigvip' }, '大会员')
            )
          )
        )
      );
    },
    eplist: () => {
      if (!config.eplist) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-eplist',
        role: 'button',
        'aria-label': '选集',
        ref: ctrlEplistBtnRef,
        onMouseEnter: () => lifecycle.emit?.('menuAnimation', 'eplist', 'show'),
        onMouseLeave: () => lifecycle.emit?.('menuAnimation', 'eplist', 'hide')
      },
        h('div', { class: 'player-ctrl-eplist-result', ref: eplistResultRef }, '选集'),
        h('div', { class: 'player-ctrl-eplist-menu-wrap', style: { minHeight: '180px' } },
          h('div', { class: 'player-ctrl-eplist-section' },
            h('div', {
              class: 'player-ctrl-eplist-section-bottom',
              style: {
                touchAction: 'pan-x',
                userSelect: 'none',
                webkitUserDrag: 'none',
                webkitTapHighlightColor: 'rgba(0, 0, 0, 0)'
              }
            },
              h('ul', {
                class: 'player-ctrl-eplist-section-content',
                style: {
                  transitionTimingFunction: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
                  transitionDuration: '0ms',
                  transform: 'translate(0px, 0px) scale(1) translateZ(0px)'
                },
                ref: eplistMenuRef
              },
                h('li', { class: 'player-ctrl-eplist-multi-menu-item state-multi-active-item', 'data-cid': '554164205' },
                  h('span', { class: 'common-svg-icon' }),
                  h('span', { class: 'player-ctrl-eplist-multi-menu-item-text' }, '青岛大学教工足球队2022年3月20日周五中午活动')
                ),
                h('li', { class: 'player-ctrl-eplist-multi-menu-item', 'data-cid': '554164027' },
                  h('span', { class: 'common-svg-icon' }),
                  h('span', { class: 'player-ctrl-eplist-multi-menu-item-text' }, '青岛大学教工足球队2022年3月20日周日中午活动')
                ),
                h('li', { class: 'player-ctrl-eplist-multi-menu-item', 'data-cid': '554164026' },
                  h('span', { class: 'common-svg-icon' }),
                  h('span', { class: 'player-ctrl-eplist-multi-menu-item-text' }, 'C0099')
                )
              )
            )
          )
        )
      );
    },
    playbackrate: () => h('div', {
      class: 'player-ctrl-btn player-ctrl-playbackrate',
      role: 'button',
      'aria-label': '倍速',
      ref: ctrlBackrateBtnRef,
      onMouseEnter: () => lifecycle.emit?.('menuAnimation', 'playbackrate', 'show'),
      onMouseLeave: () => lifecycle.emit?.('menuAnimation', 'playbackrate', 'hide')
    },
      h('div', { class: 'player-ctrl-playbackrate-result', ref: backrateResultTextRef }, '倍速'),
      h('div', { class: 'player-ctrl-playbackrate-menu-wrap' },
        h('ul', { class: 'player-ctrl-playbackrate-menu' },
          renderBackrateItem('2', '2.0X'),
          renderBackrateItem('1.5', '1.5X'),
          renderBackrateItem('1.25', '1.25X'),
          renderBackrateItem('1', '1.0X'),
          renderBackrateItem('0.75', '0.75X'),
          renderBackrateItem('0.5', '0.5X')
        )
      )
    ),
    volume: () => h('div', {
      class: 'player-ctrl-btn player-ctrl-volume',
      role: 'button',
      'aria-label': '音量',
      ref: ctrlVolumeBtnRef,
      onClick: toggleMute,
      onMouseEnter: () => lifecycle.emit?.('menuAnimation', 'volume', 'show'),
      onMouseLeave: () => lifecycle.emit?.('menuAnimation', 'volume', 'hide')
    },
      h('div', { class: 'player-ctrl-btn-icon player-ctrl-volume-icon', ref: ctrlVolumeIconBtnRef },
        h('span', { class: 'common-svg-icon' })
      ),
      h('div', { class: 'player-ctrl-btn-icon player-ctrl-muted-icon', ref: ctrlMutedIconBtnRef },
        h('span', { class: 'common-svg-icon' })
      ),
      h('div', { class: 'player-ctrl-volume-box' },
        h('div', { class: 'player-ctrl-volume-number', ref: volumeNumberRef }),
        h('div', { class: 'player-ctrl-volume-progress slider' },
          h('div', { class: 'slider-area', ref: volumeSliderAreaRef, onClick: volumeMouseDown, onMouseDown: handlVolumeMouseDown },
            h('div', { class: 'slider-bar-wrap' },
              h('div', { class: 'slider-bar', role: 'progressbar', ref: volumeProgressbarRef })
            ),
            h('div', { class: 'slider-thumb', role: 'thumb', ref: volumeSliderThumbRef },
              h('div', { class: 'slider-thumb-dot' })
            )
          )
        )
      )
    ),
    setting: () => {
      if (!config.setting) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-setting',
        role: 'button',
        'aria-label': '设置',
        ref: ctrlSettingBtnRef,
        onMouseEnter: () => lifecycle.emit?.('menuAnimation', 'setting', 'show'),
        onMouseLeave: () => lifecycle.emit?.('menuAnimation', 'setting', 'hide')
      },
        h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' })),
        h('div', { class: 'player-ctrl-setting-box' },
          h('div', { class: 'player-ctrl-setting-menu ui ui-panel ui-dark', ref: settingMenuAreaRef },
            h('div', { class: 'ui-area' },
              h('div', { class: 'player-ctrl-seting-menu-left' },
                h('div', { class: 'player-ctrl-seting-menu-left-item' }, h('span', {}, '镜像画面')),
                h('div', { class: 'player-ctrl-seting-menu-left-item' }, h('span', {}, '洗脑循环')),
                h('div', { class: 'player-ctrl-seting-menu-left-item' }, h('span', {}, '自动开播')),
                h('div', {
                  class: 'player-ctrl-seting-menu-left-item setting-more',
                  ref: settingMenuMoreRef,
                  onClick: () => {
                    settingMenuAreaRef.current?.classList.add('state-show-right');
                    settingMenuRightRef.current?.classList.add('player-ctrl-seting-more-area');
                    lifecycle.emit?.('moreSettingClick');
                  }
                },
                  h('span', {}, '更多播放设置'),
                  h('span', { class: 'common-svg-icon' })
                )
              ),
              h('div', { class: 'player-ctrl-seting-menu-right', ref: settingMenuRightRef },
                h('div', { class: 'player-ctrl-seting-menu-right-area' },
                  h('div', { class: 'player-ctrl-setting-handoff' },
                    h('div', { class: 'player-ctrl-setting-handoff-title' }, '播放方式'),
                    h('div', { class: 'player-ctrl-setting-handoff-conent' },
                      h('div', { class: 'bui-radio-wrap-button' },
                        h('div', { class: 'radio-button active' }, h('span', {}, '自动切集')),
                        h('div', { class: 'radio-button' }, h('span', {}, '播完暂停'))
                      )
                    )
                  ),
                  h('div', { class: 'player-ctrl-setting-aspect' },
                    h('div', { class: 'player-ctrl-setting-aspect-title' }, '视频比例'),
                    h('div', { class: 'player-ctrl-setting-aspect-conent' },
                      h('div', { class: 'bui-radio-wrap-button' },
                        h('div', { class: 'radio-button active' }, h('span', {}, '自动')),
                        h('div', { class: 'radio-button' }, h('span', {}, '4:3')),
                        h('div', { class: 'radio-button' }, h('span', {}, '16:9'))
                      )
                    )
                  ),
                  h('div', { class: 'player-ctrl-setting-codec' },
                    h('div', { class: 'player-ctrl-setting-codec-title' }, '播放策略'),
                    h('div', { class: 'player-ctrl-setting-codec-conent' },
                      h('div', { class: 'bui-radio-wrap-button' },
                        h('div', { class: 'radio-button active' }, h('span', {}, '默认')),
                        h('div', { class: 'radio-button' }, h('span', {}, 'AV1')),
                        h('div', { class: 'radio-button' }, h('span', {}, 'HEVC')),
                        h('div', { class: 'radio-button' }, h('span', {}, 'AVC'))
                      )
                    )
                  ),
                  h('div', { class: 'player-ctrl-setting-others' },
                    h('div', { class: 'player-ctrl-setting-others-title' }, '其他设置'),
                    h('div', { class: 'player-ctrl-setting-others-content', ref: settingOthersContentRef })
                  )
                )
              )
            )
          )
        )
      );
    },
    pip: () => {
      if (!config.pip) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-pip',
        role: 'button',
        'aria-label': '画中画',
        ref: pipBtnRef,
        onClick: togglePip
      },
        h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' }))
      );
    },
    wide: () => {
      if (!config.wide) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-wide',
        role: 'button',
        'aria-label': '宽屏',
        ref: wideBtnRef,
        onClick: toggleWide
      },
        h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' }))
      );
    },
    web: () => {
      if (!config.web) return null;
      return h('div', {
        class: 'player-ctrl-btn player-ctrl-web',
        role: 'button',
        'aria-label': '网页全屏',
        ref: webBtnRef,
        onClick: toggleWebFullscreen
      },
        h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' }))
      );
    },
    full: () => h('div', {
      class: 'player-ctrl-btn player-ctrl-full',
      role: 'button',
      'aria-label': '全屏',
      ref: fullBtnRef,
      onClick: toggleFullscreen
    },
      h('div', { class: 'player-ctrl-btn-icon' }, h('span', { class: 'common-svg-icon' }))
    ),
  };

  // ============================================
  // 底部右侧按钮渲染顺序配置
  // ============================================
  const bottomRightOrder = ['quality', 'eplist', 'playbackrate', 'volume', 'setting', 'pip', 'wide', 'web', 'full'];

  // ============================================
  // 生命周期钩子
  // ============================================
  lifecycle.onMounted = (): void => {
    // 组件挂载后的初始化逻辑
    lifecycle.emit?.('rightControlsMounted');
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', { class: 'player-control-bottom-right' },
    ...bottomRightOrder
      .map(key => {
        const renderer = bottomRightRenderers[key];
        if (!renderer) return null;
        return renderer();
      })
      .filter((vnode): vnode is VNode => vnode !== null)
  );
});
