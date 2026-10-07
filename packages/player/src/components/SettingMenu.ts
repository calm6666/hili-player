/**
 * ============================================
 * 设置面板组件 (SettingMenu)
 * ============================================
 * 结构与 `CicadaPlayerNext/platform/ctrl-setting.txt` 逐条对应
 * （bpx-player-* → player-*，bui-* → ui-*）：
 *   .player-ctrl-setting-box
 *     .player-ctrl-setting-menu.ui.ui-panel.ui-dark > .ui-area
 *       .ui-panel-wrap > .ui-panel-move
 *         .ui-panel-item.ui-panel-item-active > .player-ctrl-setting-menu-left
 *           镜像画面 / 单集循环 / 自动开播 三个开关 + oped 占位 + 更多播放设置
 *         .ui-panel-item > .player-ctrl-setting-menu-right
 *           播放方式 / 视频比例 / 播放策略 / 音量均衡 / 其他设置
 * 仅「隐藏黑边」一项按约定不落地（bpx-player-ctrl-setting-blackgap）。
 */

import { h, defineComponent, useTemplateRef } from '@/core';
import { useComponentUnmount } from '@/hili-player/core/componentUnmount';
import {
  publishPermanent,
  readPermanent,
  observePermanent,
} from '@/hili-player/store/permanentState';
import type { VNode } from '@/types';
import { LottieIcon, LottieIconApi } from './LottieIcon';
import { Switch } from '@/hili-player/components/Switch';
import { Checkbox } from '@/hili-player/components/Checkbox';
import { ArrowRight } from './icons';
import settingHoverAnimationData from '../assets/lottie-icon/settings-animation.json';

export interface SettingMenuProps {
  /** 高能进度条常驻当前状态（面板显示真实状态用） */
  permanent?: boolean;
}

export type SettingMenuEvents = {
  settingChange: { key: string; value: boolean | string | number };
  menuAnimation: { type: 'setting'; action: 'show' | 'hide' };
  moreSettingClick: undefined;
  settingMenuMounted: { setPermanentChecked: (checked: boolean) => void };
};

/** 单选项定义 */
interface RadioOption {
  label: string;
  value: boolean | string | number;
  checked?: boolean;
}

export const SettingMenu = defineComponent<SettingMenuProps, SettingMenuEvents>((_props, lifecycle) => {
  const menuAreaRef = useTemplateRef<HTMLDivElement>(lifecycle, 'menuAreaRef');
  const menuRightRef = useTemplateRef<HTMLDivElement>(lifecycle, 'menuRightRef');
  const settingIconRef = useTemplateRef<LottieIconApi>(lifecycle, 'settingIconRef');

  const handleMouseEnter = (): void => {
    settingIconRef.value?.play();
    lifecycle.emit?.('menuAnimation', { type: 'setting', action: 'show' });
  };

  const handleMouseLeave = (): void => {
    lifecycle.emit?.('menuAnimation', { type: 'setting', action: 'hide' });
  };

  const handleMirrorChange = (checked: boolean): void => {
    lifecycle.emit?.('settingChange', { key: 'mirror', value: checked });
  };

  const handleLoopChange = (checked: boolean): void => {
    lifecycle.emit?.('settingChange', { key: 'loop', value: checked });
  };

  const handleAutostartChange = (checked: boolean): void => {
    lifecycle.emit?.('settingChange', { key: 'autostart', value: checked });
  };

  const handleLightoffChange = (checked: boolean): void => {
    lifecycle.emit?.('settingChange', { key: 'lightoff', value: checked });
  };

  const handlePipChange = (checked: boolean): void => {
    lifecycle.emit?.('settingChange', { key: 'pip', value: checked });
  };

  const handleMoreClick = (): void => {
    menuAreaRef.value
      ?.querySelector('.ui-area')
      ?.classList.add('state-show-right');
    menuRightRef.value?.classList.add('player-ctrl-seting-more-area');
    lifecycle.emit?.('moreSettingClick');
  };

  /**
   * 统一应用单选选中态（框架无 diff，必须手动互斥）
   * @param group - 该单选组的根元素
   * @param event - 点击事件（取其 currentTarget 作为被选项）
   */
  const applyRadioActive = (group: HTMLElement | null, event?: MouseEvent): void => {
    if (!group) return;
    group
      .querySelectorAll('.radio-button')
      .forEach((btn) => btn.classList.remove('active'));
    const target = event?.currentTarget;
    if (target instanceof HTMLElement) {
      target.classList.add('active');
    }
  };

  /**
   * 渲染一组单选按钮（对应参考的 bui-radio-button：横排胶囊按钮）
   * @param refKey - 模板引用 key
   * @param options - 选项列表
   * @param key - settingChange 的配置键
   * @returns 单选组虚拟节点
   */
  const renderRadioGroup = (
    refKey: string,
    options: RadioOption[],
    key: string,
  ): VNode =>
    h(
      'div',
      { class: 'player-radio-wrap-button', ref: refKey },
      ...options.map((option) =>
        h(
          'div',
          {
            class: option.checked ? 'radio-button active' : 'radio-button',
            onClick: (event: MouseEvent) => {
              const target = event.currentTarget;
              applyRadioActive(
                target instanceof HTMLElement ? target.parentElement : null,
                event,
              );
              lifecycle.emit?.('settingChange', { key, value: option.value });
            },
          },
          h('span', {}, option.label),
        ),
      ),
    );

  /** 左侧菜单的三个开关项（对应参考的 bui-switch 组） */
  const switches: Array<{
    cls: string;
    name: string;
    checked?: boolean;
    onChange: (checked: boolean) => void;
  }> = [
    { cls: 'player-ctrl-setting-mirror', name: '镜像画面', onChange: handleMirrorChange },
    { cls: 'player-ctrl-setting-loop', name: '单集循环', onChange: handleLoopChange },
    {
      cls: 'player-ctrl-setting-autoplay',
      name: '自动开播',
      checked: true,
      onChange: handleAutostartChange,
    },
  ];

  /** 高能进度条复选框 API（供常驻态双向同步） */
  let highenergyApi: { setChecked: (value: boolean) => void } | null = null;

  lifecycle.onMounted = (): void => {
    // 图钉 / 影子条常驻态变化时回写本面板勾选
    const unsub = observePermanent((value) => {
      highenergyApi?.setChecked(value);
    });
    useComponentUnmount(lifecycle, unsub);
    lifecycle.emit?.('settingMenuMounted', {
      setPermanentChecked: (checked: boolean): void => {
        highenergyApi?.setChecked(checked);
      },
    });
  };

  lifecycle.onBeforeDestroy = (): void => {
    menuAreaRef.value
      ?.querySelector('.ui-area')
      ?.classList.remove('state-show-right');
    menuRightRef.value?.classList.remove('player-ctrl-seting-more-area');
  };

  return h('div', {
    class: 'player-ctrl-btn player-ctrl-setting',
    role: 'button',
    'aria-label': '设置',
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  },
    h('div', { class: 'player-ctrl-btn-icon' },
      h(LottieIcon, {
        name: 'setting',
        animationData: settingHoverAnimationData,
        loop: false,
        autoplay: false,
        ref: 'settingIconRef',
      }),
    ),
    h('div', { class: 'player-ctrl-setting-box' },
      h('div', { class: 'player-ctrl-setting-menu ui ui-panel ui-dark', ref: 'menuAreaRef' },
        h('div', { class: 'ui-area' },
          h('div', { class: 'ui-panel-wrap', style: { width: '132px', height: '140px' } },
            h('div', { class: 'ui-panel-move', style: { width: '418px', transform: 'translateX(0px)' } },
              h('div', {
                class: 'ui-panel-item ui-panel-item-active',
                style: { width: '132px', height: '140px' },
              },
                h('div', { class: 'player-ctrl-setting-menu-left' },
                  ...switches.map((item) =>
                    h('div', { class: `${item.cls} ui ui-switch` },
                      h(Switch, {
                        size: 'small',
                        name: item.name,
                        checked: item.checked,
                        onChange: item.onChange,
                      }),
                    ),
                  ),
                  h('div', { class: 'player-ctrl-setting-oped', style: { display: 'none' } }),
                  h('div', { class: 'player-ctrl-setting-more', onClick: handleMoreClick },
                    h('span', { class: 'player-ctrl-setting-more-text' }, '更多播放设置'),
                    h('span', { class: 'player-ctrl-setting-more-arrow', innerHTML: ArrowRight }),
                  ),
                ),
              ),
              h('div', { class: 'ui-panel-item', style: { width: '286px' } },
                h('div', { class: 'player-ctrl-setting-menu-right', ref: 'menuRightRef' },
                  h('div', { class: 'player-ctrl-seting-menu-right-area' },
                    h('div', { class: 'player-ctrl-setting-handoff' },
                      h('div', { class: 'player-ctrl-setting-handoff-title' }, '播放方式'),
                      h('div', { class: 'player-ctrl-setting-handoff-conent ui ui-radio ui-dark' },
                        renderRadioGroup('handoffRadioRef', [
                          { label: '自动切集', value: 0 },
                          { label: '播完暂停', value: 2, checked: true },
                        ], 'handoff'),
                      ),
                    ),
                    h('div', { class: 'player-ctrl-setting-aspect' },
                      h('div', { class: 'player-ctrl-setting-aspect-title' }, '视频比例'),
                      h('div', { class: 'player-ctrl-setting-aspect-conent ui ui-radio ui-dark' },
                        renderRadioGroup('aspectRadioRef', [
                          { label: '自动', value: '0:0', checked: true },
                          { label: '4:3', value: '4:3' },
                          { label: '16:9', value: '16:9' },
                        ], 'aspect'),
                      ),
                    ),
                    h('div', { class: 'player-ctrl-setting-codec' },
                      h('div', { class: 'player-ctrl-setting-codec-title' }, '播放策略'),
                      h('div', { class: 'player-ctrl-setting-codec-conent ui ui-radio ui-dark' },
                        renderRadioGroup('codecRadioRef', [
                          { label: '默认', value: 0, checked: true },
                          { label: 'AV1', value: 3 },
                          { label: 'HEVC', value: 1 },
                          { label: 'AVC', value: 2 },
                        ], 'codec'),
                      ),
                    ),
                    h('div', { class: 'player-ctrl-setting-loudness' },
                      h('div', { class: 'player-ctrl-setting-loudness-title' }, '音量均衡'),
                      h('div', { class: 'player-ctrl-setting-loudness-content ui ui-radio ui-dark' },
                        renderRadioGroup('loudnessRadioRef', [
                          { label: '标准', value: 1 },
                          { label: '高动态', value: 2 },
                          { label: '关闭', value: 0, checked: true },
                        ], 'loudness'),
                      ),
                    ),
                    h('div', { class: 'player-ctrl-setting-others' },
                      h('div', { class: 'player-ctrl-setting-others-title' }, '其他设置'),
                      h('div', { class: 'player-ctrl-setting-others-content' },
                        h('div', { class: 'player-ctrl-setting-checkbox player-ctrl-setting-lightoff' },
                          h(Checkbox, { label: '关灯模式', onChange: handleLightoffChange }),
                        ),
                        h('div', { class: 'player-ctrl-setting-checkbox player-ctrl-setting-widesave', style: { display: 'none' } }),
                        h('div', { class: 'player-ctrl-setting-checkbox player-ctrl-setting-panoram', style: { display: 'none' } }),
                        h('div', { class: 'player-ctrl-setting-checkbox player-ctrl-setting-highenergy' },
                          h(Checkbox, {
                            label: '高能进度条',
                            checked: readPermanent(),
                            onChange: (checked: boolean) => {
                              publishPermanent(checked);
                              lifecycle.emit?.('settingChange', {
                                key: 'highenergy',
                                value: checked,
                              });
                            },
                            onCheckboxMounted: (api: { setChecked: (value: boolean) => void }) => {
                              highenergyApi = api;
                            },
                          }),
                        ),
                        h('div', { class: 'player-ctrl-setting-checkbox player-ctrl-setting-pip' },
                          h(Checkbox, { label: '原生画中画', onChange: handlePipChange }),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
});
