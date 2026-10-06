/**
 * ============================================
 * 设置面板组件 (SettingMenu)
 * ============================================
 * 设置面板组件，包含左侧菜单项（镜像/循环/自动开播/画面比例/编码策略）
 * 和右侧面板内容切换，设置按钮使用 LottieIcon
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import { LottieIcon, LottieIconApi } from './LottieIcon';
import { Switch } from '@/hili-player/components/Switch';
import { ArrowRight } from './icons';
import settingHoverAnimationData from '../assets/lottie-icon/settings-animation.json';

/**
 * SettingMenu 组件 Props 接口
 */
export interface SettingMenuProps {
}

export type SettingMenuEvents = {
  settingChange: { key: string; value: boolean | string | number };
  menuAnimation: { type: 'setting'; action: 'show' | 'hide' };
  moreSettingClick: undefined;
  settingMenuMounted: undefined;
};

/**
 * SettingMenu 组件 - 使用 defineComponent 创建独立组件
 * 渲染设置面板，支持左侧菜单和右侧详情面板切换
 */
export const SettingMenu = defineComponent<SettingMenuProps, SettingMenuEvents>((_props, lifecycle) => {

  // ============================================
  // DOM 引用
  // ============================================

  /** 菜单区域容器元素引用 */
  const menuAreaRef = useTemplateRef<HTMLDivElement>(lifecycle, 'menuAreaRef');

  /** 右侧面板容器元素引用 */
  const menuRightRef = useTemplateRef<HTMLDivElement>(lifecycle, 'menuRightRef');

  /** 播放方式单选按钮组元素引用 */
  const handoffRadioRef = useTemplateRef<HTMLDivElement>(lifecycle, 'handoffRadioRef');

  /** 视频比例单选按钮组元素引用 */
  const aspectRadioRef = useTemplateRef<HTMLDivElement>(lifecycle, 'aspectRadioRef');

  /** 播放策略单选按钮组元素引用 */
  const codecRadioRef = useTemplateRef<HTMLDivElement>(lifecycle, 'codecRadioRef');
  /** 设置按钮 API 引用 */
  const settingIconRef = useTemplateRef<LottieIconApi>(lifecycle, 'settingIconRef');

  // ============================================
  // 状态
  // ============================================

  // 开关状态由 Switch 子组件持有并通过 onChange 回调上报，本地不再保存副本

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 鼠标进入设置按钮时触发的回调
   */
  const handleMouseEnter = (): void => {
    settingIconRef.value?.play();
    lifecycle.emit?.('menuAnimation', { type: 'setting', action: 'show' });
  };

  /**
   * 鼠标离开设置按钮时触发的回调
   */
  const handleMouseLeave = (): void => {
    lifecycle.emit?.('menuAnimation', { type: 'setting', action: 'hide' });
  };

  /**
   * 镜像画面开关变化（与既有实现一致：菜单子项内嵌 ui-switch 开关）
   * @param checked - 是否开启
   */
  const handleMirrorChange = (checked: boolean): void => {
    lifecycle.emit?.('settingChange', { key: 'mirror', value: checked });
  };

  /**
   * 洗脑循环开关变化
   * @param checked - 是否开启
   */
  const handleLoopChange = (checked: boolean): void => {
    lifecycle.emit?.('settingChange', { key: 'loop', value: checked });
  };

  /**
   * 自动开播开关变化
   * @param checked - 是否开启
   */
  const handleAutostartChange = (checked: boolean): void => {
    lifecycle.emit?.('settingChange', { key: 'autostart', value: checked });
  };

  /**
   * 点击更多设置菜单项，展开右侧面板
   *
   * 与既有实现一致：
   * - state-show-right 加在 .ui-area 元素上（Controls.handleMenuAnimation 的
   *   extraElements[0] 同样指向 .ui-area，hover 离开 300ms 后由其统一移除，
   *   若加在 .player-ctrl-setting-menu 上则 Controls 无法清掉，导致下次
   *   hover 时左右面板类残留、布局错乱）
   * - player-ctrl-seting-more-area 加在 .player-ctrl-seting-menu-right 上
   */
  const handleMoreClick = (): void => {
    menuAreaRef.value
      ?.querySelector('.ui-area')
      ?.classList.add('state-show-right');
    menuRightRef.value?.classList.add('player-ctrl-seting-more-area');
    lifecycle.emit?.('moreSettingClick');
  };

  /**
   * 播放方式选项切换处理
   * @param value - 选中的播放方式值
   */
  const handleHandoffChange = (value: string): void => {
    if (handoffRadioRef.value) {
      const buttons = handoffRadioRef.value.querySelectorAll('.radio-button');
      buttons.forEach((btn) => btn.classList.remove('active'));
    }
    lifecycle.emit?.('settingChange', { key: 'handoff', value: value });
  };

  /**
   * 视频比例选项切换处理
   * @param value - 选中的视频比例值
   */
  const handleAspectChange = (value: string): void => {
    if (aspectRadioRef.value) {
      const buttons = aspectRadioRef.value.querySelectorAll('.radio-button');
      buttons.forEach((btn) => btn.classList.remove('active'));
    }
    lifecycle.emit?.('settingChange', { key: 'aspect', value: value });
  };

  /**
   * 播放策略选项切换处理
   * @param value - 选中的播放策略值
   */
  const handleCodecChange = (value: string): void => {
    if (codecRadioRef.value) {
      const buttons = codecRadioRef.value.querySelectorAll('.radio-button');
      buttons.forEach((btn) => btn.classList.remove('active'));
    }
    lifecycle.emit?.('settingChange', { key: 'codec', value: value });
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后的回调，通知外部设置菜单已就绪
   */
  lifecycle.onMounted = (): void => {
    lifecycle.emit?.('settingMenuMounted');
  };

  /**
   * 组件销毁前的回调，重置右侧面板状态
   */
  lifecycle.onBeforeDestroy = (): void => {
    // 重置右侧面板状态（与 handleMoreClick 的目标元素保持一致：.ui-area）
    menuAreaRef.value
      ?.querySelector('.ui-area')
      ?.classList.remove('state-show-right');
    menuRightRef.value?.classList.remove('player-ctrl-seting-more-area');
  };

  // ============================================
  // 主渲染函数
  // ============================================
  return h('div', {
    class: 'player-ctrl-btn player-ctrl-setting',
    role: 'button',
    'aria-label': '设置',
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  },
    h('div', { class: 'player-ctrl-btn-icon' },
      // 设置按钮图标（使用 LottieIcon）
      h(LottieIcon, {
        name: 'setting',
        animationData: settingHoverAnimationData,
        loop: false,
        autoplay: false,
        ref: 'settingIconRef',
      }),
    ),
    // 设置面板
    h('div', { class: 'player-ctrl-setting-box' },
      h('div', { class: 'player-ctrl-setting-menu ui ui-panel ui-dark', ref: 'menuAreaRef' },
        h('div', { class: 'ui-area' },
          // 左侧菜单
          h('div', { class: 'player-ctrl-seting-menu-left' },
            // 镜像画面（子项内嵌 ui-switch 开关，与既有实现 initCtrlSetting 一致）
            h('div', { class: 'player-ctrl-seting-menu-left-item' },
              h('span', {}, '镜像画面'),
              h(Switch, { size: 'small', onChange: handleMirrorChange }),
            ),
            // 洗脑循环
            h('div', { class: 'player-ctrl-seting-menu-left-item' },
              h('span', {}, '洗脑循环'),
              h(Switch, { size: 'small', onChange: handleLoopChange }),
            ),
            // 自动开播
            h('div', { class: 'player-ctrl-seting-menu-left-item' },
              h('span', {}, '自动开播'),
              h(Switch, { size: 'small', onChange: handleAutostartChange }),
            ),
            // 更多播放设置（箭头图标使用既有实现 icons 的 ArrowRight SVG；
            // 既有实现直接内联 16×16 SVG，
            // 不包 .common-svg-icon——该类会将 SVG 拉伸为 100% 尺寸导致图标过大、挤压菜单布局）
            h('div', {
              class: 'player-ctrl-seting-menu-left-item setting-more',
              onClick: handleMoreClick,
            },
              h('span', {}, '更多播放设置'),
              h('span', { innerHTML: ArrowRight })
            )
          ),
          // 右侧面板
          h('div', { class: 'player-ctrl-seting-menu-right', ref: 'menuRightRef' },
            h('div', { class: 'player-ctrl-seting-menu-right-area' },
              // 播放方式
              h('div', { class: 'player-ctrl-setting-handoff' },
                h('div', { class: 'player-ctrl-setting-handoff-title' }, '播放方式'),
                h('div', { class: 'player-ctrl-setting-handoff-conent' },
                  h('div', { class: 'bui-radio-wrap-button', ref: 'handoffRadioRef' },
                    h('div', {
                      class: 'radio-button active',
                      onClick: () => handleHandoffChange('自动切集'),
                    }, h('span', {}, '自动切集')),
                    h('div', {
                      class: 'radio-button',
                      onClick: () => handleHandoffChange('播完暂停'),
                    }, h('span', {}, '播完暂停'))
                  )
                )
              ),
              // 视频比例
              h('div', { class: 'player-ctrl-setting-aspect' },
                h('div', { class: 'player-ctrl-setting-aspect-title' }, '视频比例'),
                h('div', { class: 'player-ctrl-setting-aspect-conent' },
                  h('div', { class: 'bui-radio-wrap-button', ref: 'aspectRadioRef' },
                    h('div', {
                      class: 'radio-button active',
                      onClick: () => handleAspectChange('自动'),
                    }, h('span', {}, '自动')),
                    h('div', {
                      class: 'radio-button',
                      onClick: () => handleAspectChange('4:3'),
                    }, h('span', {}, '4:3')),
                    h('div', {
                      class: 'radio-button',
                      onClick: () => handleAspectChange('16:9'),
                    }, h('span', {}, '16:9'))
                  )
                )
              ),
              // 播放策略
              h('div', { class: 'player-ctrl-setting-codec' },
                h('div', { class: 'player-ctrl-setting-codec-title' }, '播放策略'),
                h('div', { class: 'player-ctrl-setting-codec-conent' },
                  h('div', { class: 'bui-radio-wrap-button', ref: 'codecRadioRef' },
                    h('div', {
                      class: 'radio-button active',
                      onClick: () => handleCodecChange('默认'),
                    }, h('span', {}, '默认')),
                    h('div', {
                      class: 'radio-button',
                      onClick: () => handleCodecChange('AV1'),
                    }, h('span', {}, 'AV1')),
                    h('div', {
                      class: 'radio-button',
                      onClick: () => handleCodecChange('HEVC'),
                    }, h('span', {}, 'HEVC')),
                    h('div', {
                      class: 'radio-button',
                      onClick: () => handleCodecChange('AVC'),
                    }, h('span', {}, 'AVC'))
                  )
                )
              ),
              // 其他设置
              h('div', { class: 'player-ctrl-setting-others' },
                h('div', { class: 'player-ctrl-setting-others-title' }, '其他设置'),
                h('div', { class: 'player-ctrl-setting-others-content' })
              )
            )
          )
        )
      )
    )
  );
});
