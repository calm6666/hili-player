/**
 * ============================================
 * 设置面板组件 (SettingMenu)
 * ============================================
 */

import {
  h,
  defineComponent,
  useTemplateRef,
  useContext,
  useState,
} from "@/core";
import { rafTimeout, cancelRaf } from "@/utils/rafTimeout";
import type { AnimationFrameID } from "@/utils/rafTimeout";
import { PlayerStateKeyEnum, StateContext } from "@/store/runtimeState";
import type { PlayerStateMap, TypedStateManager } from "@/store/runtimeState";
import type { VNode } from "@/types";
import { LottieIcon, LottieIconApi } from "./LottieIcon";
import { Switch } from "@/hili-player/components/Switch";
import { Checkbox } from "@/hili-player/components/Checkbox";
import { ArrowRight } from "./icons";
import { RadioGroup } from "./RadioGroup";
import type { RadioGroupOption } from "./RadioGroup";
import { switchPanelPage } from "./PanelPage";
import settingHoverAnimationData from "../assets/lottie-icon/settings-animation.json";

export interface SettingMenuProps {
  /** 高能进度条常驻当前状态（面板显示真实状态用） */
  permanent?: boolean;
}

export type SettingMenuEvents = {
  settingChange: { key: string; value: boolean | string | number };
  moreSettingClick: undefined;
};

const MENU_SHOW_DELAY = 120;
const MENU_HIDE_DELAY = 220;

export const SettingMenu = defineComponent<SettingMenuProps, SettingMenuEvents>(
  (_props, lifecycle) => {
    const menuAreaRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "menuAreaRef",
    );
    const settingIconRef = useTemplateRef<LottieIconApi>(
      lifecycle,
      "settingIconRef",
    );
    const rootRef = useTemplateRef<HTMLDivElement>(lifecycle, "settingRootRef");

    let showTimer: AnimationFrameID | null = null;
    let hideTimer: AnimationFrameID | null = null;

    const setShown = (show: boolean): void => {
      rootRef.value?.classList.toggle("state-show", show);
    };

    const clearTimers = (): void => {
      cancelRaf(showTimer!);
      cancelRaf(hideTimer!);
      showTimer = null;
      hideTimer = null;
    };

    const handleMouseEnter = (): void => {
      settingIconRef.value?.play();
      cancelRaf(hideTimer!);
      hideTimer = null;
      if (showTimer !== null) return;
      showTimer = rafTimeout(() => {
        showTimer = null;
        setShown(true);
      }, MENU_SHOW_DELAY);
    };

    /**
     * 复位到第一页（面板收起时调用，下次打开即第一页）
     */
    const resetPage = (): void => {
      switchPanelPage({ root: menuAreaRef.value, index: 0 });
    };

    const handleMouseLeave = (): void => {
      cancelRaf(showTimer!);
      showTimer = null;
      if (hideTimer !== null) return;
      hideTimer = rafTimeout(() => {
        hideTimer = null;
        resetPage();
        setShown(false);
      }, MENU_HIDE_DELAY);
    };

    const handleMirrorChange = (checked: boolean): void => {
      lifecycle.emit?.("settingChange", { key: "mirror", value: checked });
    };

    const handleLoopChange = (checked: boolean): void => {
      lifecycle.emit?.("settingChange", { key: "loop", value: checked });
    };

    const handleAutostartChange = (checked: boolean): void => {
      lifecycle.emit?.("settingChange", { key: "autostart", value: checked });
    };

    const handleLightoffChange = (checked: boolean): void => {
      lifecycle.emit?.("settingChange", { key: "lightoff", value: checked });
    };

    const handlePipChange = (checked: boolean): void => {
      lifecycle.emit?.("settingChange", { key: "pip", value: checked });
    };

    const handleMoreClick = (): void => {
      switchPanelPage({ root: menuAreaRef.value, index: 1 });
      lifecycle.emit?.("moreSettingClick");
    };

    /**
     * 渲染一组单选按钮
     * @param refKey - 模板引用 key
     * @param options - 选项列表
     * @param key - settingChange 的配置键
     * @returns 单选组虚拟节点
     */
    const renderRadioGroup = (
      refKey: string,
      options: RadioGroupOption[],
      key: string,
    ): VNode =>
      RadioGroup(options, {
        name: key,
        refKey,
        onSelect: (option) => {
          lifecycle.emit?.("settingChange", { key, value: option.value });
        },
      });

    /** 左侧菜单的三个开关项（对应参考的 bui-switch 组） */
    const switches: Array<{
      cls: string;
      name: string;
      checked?: boolean;
      onChange: (checked: boolean) => void;
    }> = [
      {
        cls: "player-ctrl-setting-mirror",
        name: "镜像画面",
        onChange: handleMirrorChange,
      },
      {
        cls: "player-ctrl-setting-loop",
        name: "单集循环",
        onChange: handleLoopChange,
      },
      {
        cls: "player-ctrl-setting-autoplay",
        name: "自动开播",
        checked: true,
        onChange: handleAutostartChange,
      },
    ];

    /** 高能进度条复选框 API（供常驻态双向同步） */
    let highenergyApi: { setChecked: (value: boolean) => void } | null = null;

    const stateMgr = useContext<TypedStateManager<PlayerStateMap> | null>(
      StateContext,
    );

    lifecycle.onMounted = (): void => {
      // 常驻态来自运行时状态：图钉 / 影子条任一处切换都会写回本面板勾选
      if (stateMgr) {
        useState(
          stateMgr,
          PlayerStateKeyEnum.PBP_PERMANENT,
          (value) => {
            highenergyApi?.setChecked(value);
          },
          lifecycle,
        );
      }
    };

    lifecycle.onBeforeDestroy = (): void => {
      clearTimers();
      menuAreaRef.value
        ?.querySelector(".ui-area")
        ?.classList.remove("state-show-right");
    };

    return h(
      "div",
      {
        class: "player-ctrl-btn player-ctrl-setting",
        role: "button",
        "aria-label": "设置",
        ref: "settingRootRef",
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      },
      h(
        "div",
        { class: "player-ctrl-btn-icon" },
        h(LottieIcon, {
          name: "setting",
          animationData: settingHoverAnimationData,
          loop: false,
          autoplay: false,
          ref: "settingIconRef",
        }),
      ),
      h(
        "div",
        { class: "player-ctrl-setting-box" },
        h(
          "div",
          {
            class: "player-ctrl-setting-menu ui ui-panel ui-dark",
            ref: "menuAreaRef",
          },
          h(
            "div",
            { class: "ui-area" },
            h(
              "div",
              {
                class: "ui-panel-wrap",
                style: { width: "132px", height: "140px" },
              },
              h(
                "div",
                {
                  class: "ui-panel-move",
                  style: { width: "418px", transform: "translateX(0px)" },
                },
                h(
                  "div",
                  {
                    class: "ui-panel-item ui-panel-item-active",
                    style: { width: "132px", height: "140px" },
                  },
                  h(
                    "div",
                    { class: "player-ctrl-setting-menu-left" },
                    ...switches.map((item) =>
                      h(
                        "div",
                        { class: `${item.cls} ui ui-switch` },
                        h(Switch, {
                          size: "small",
                          name: item.name,
                          checked: item.checked,
                          onChange: item.onChange,
                        }),
                      ),
                    ),
                    h("div", {
                      class: "player-ctrl-setting-oped",
                      style: { display: "none" },
                    }),
                    h(
                      "div",
                      {
                        class: "player-ctrl-setting-more",
                        onClick: handleMoreClick,
                      },
                      h(
                        "span",
                        { class: "player-ctrl-setting-more-text" },
                        "更多播放设置",
                      ),
                      h(
                        "span",
                        { class: "player-ctrl-setting-more-arrow" },
                        ArrowRight(),
                      ),
                    ),
                  ),
                ),
                h(
                  "div",
                  { class: "ui-panel-item", style: { width: "286px" } },
                  h(
                    "div",
                    { class: "player-ctrl-setting-menu-right" },
                    h(
                      "div",
                      { class: "player-ctrl-setting-handoff" },
                      h(
                        "div",
                        { class: "player-ctrl-setting-handoff-title" },
                        "播放方式",
                      ),
                      h(
                        "div",
                        {
                          class:
                            "player-ctrl-setting-handoff-content ui ui-radio ui-dark",
                        },
                        h(
                          "div",
                          { class: "ui-area" },
                          renderRadioGroup(
                            "handoffRadioRef",
                            [
                              { label: "自动切集", value: 0 },
                              { label: "播完暂停", value: 2, checked: true },
                            ],
                            "handoff",
                          ),
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { class: "player-ctrl-setting-aspect" },
                      h(
                        "div",
                        { class: "player-ctrl-setting-aspect-title" },
                        "视频比例",
                      ),
                      h(
                        "div",
                        {
                          class:
                            "player-ctrl-setting-aspect-content ui ui-radio ui-dark",
                        },
                        h(
                          "div",
                          { class: "ui-area" },
                          renderRadioGroup(
                            "aspectRadioRef",
                            [
                              { label: "自动", value: "0:0", checked: true },
                              { label: "4:3", value: "4:3" },
                              { label: "16:9", value: "16:9" },
                            ],
                            "aspect",
                          ),
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { class: "player-ctrl-setting-codec" },
                      h(
                        "div",
                        { class: "player-ctrl-setting-codec-title" },
                        "播放策略",
                      ),
                      h(
                        "div",
                        {
                          class:
                            "player-ctrl-setting-codec-content ui ui-radio ui-dark",
                        },
                        h(
                          "div",
                          { class: "ui-area" },
                          renderRadioGroup(
                            "codecRadioRef",
                            [
                              { label: "默认", value: 0, checked: true },
                              { label: "AV1", value: 3 },
                              { label: "HEVC", value: 1 },
                              { label: "AVC", value: 2 },
                            ],
                            "codec",
                          ),
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { class: "player-ctrl-setting-loudness" },
                      h(
                        "div",
                        { class: "player-ctrl-setting-loudness-title" },
                        "音量均衡",
                      ),
                      h(
                        "div",
                        {
                          class:
                            "player-ctrl-setting-loudness-content ui ui-radio ui-dark",
                        },
                        h(
                          "div",
                          { class: "ui-area" },
                          renderRadioGroup(
                            "loudnessRadioRef",
                            [
                              { label: "标准", value: 1 },
                              { label: "高动态", value: 2 },
                              { label: "关闭", value: 0, checked: true },
                            ],
                            "loudness",
                          ),
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { class: "player-ctrl-setting-others" },
                      h(
                        "div",
                        { class: "player-ctrl-setting-others-title" },
                        "其他设置",
                      ),
                      h(
                        "div",
                        { class: "player-ctrl-setting-others-content" },
                        h(
                          "div",
                          {
                            class:
                              "player-ctrl-setting-checkbox player-ctrl-setting-lightoff",
                          },
                          h(Checkbox, {
                            label: "关灯模式",
                            onChange: handleLightoffChange,
                          }),
                        ),
                        h("div", {
                          class:
                            "player-ctrl-setting-checkbox player-ctrl-setting-widesave",
                          style: { display: "none" },
                        }),
                        h("div", {
                          class:
                            "player-ctrl-setting-checkbox player-ctrl-setting-panoram",
                          style: { display: "none" },
                        }),
                        h(
                          "div",
                          {
                            class:
                              "player-ctrl-setting-checkbox player-ctrl-setting-highenergy",
                          },
                          h(Checkbox, {
                            label: "高能进度条",
                            checked:
                              stateMgr?.get(PlayerStateKeyEnum.PBP_PERMANENT) ??
                              false,
                            onChange: (checked: boolean) => {
                              stateMgr?.set(
                                PlayerStateKeyEnum.PBP_PERMANENT,
                                checked,
                              );
                              lifecycle.emit?.("settingChange", {
                                key: "highenergy",
                                value: checked,
                              });
                            },
                            onCheckboxMounted: (api: {
                              setChecked: (value: boolean) => void;
                            }) => {
                              highenergyApi = api;
                            },
                          }),
                        ),
                        h(
                          "div",
                          {
                            class:
                              "player-ctrl-setting-checkbox player-ctrl-setting-pip",
                          },
                          h(Checkbox, {
                            label: "原生画中画",
                            onChange: handlePipChange,
                          }),
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
  },
);
