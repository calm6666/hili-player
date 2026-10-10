/**
 * ============================================
 * 设置面板组件 (SettingMenu)
 * ============================================
 * 声明式响应式版本：
 * - 面板展开态由 shownSignal 驱动根节点 state-show 类（__reactiveAttrs），
 *   hover 定时器（rafTimeout）仅负责延迟时序并写信号，不直接操作 DOM
 * - 面板翻页（第一页设置 / 第二页更多设置）由 pageIndexSignal 一站式驱动：
 *   页签 active 类 / state-show-right / 外框尺寸 / move 位移全部为派生绑定，
 *   过渡由 .ui-panel-wrap / .ui-panel-move 上的 CSS transition 承担
 */

import {
  h,
  defineComponent,
  useTemplateRef,
  useContext,
  useReactiveState,
  signal,
  computed,
  onEffect,
  t,
} from "@/core";
import type { Signal, ReadonlySignal } from "@/core";
import { rafTimeout, cancelRaf } from "@/utils/rafTimeout";
import type { AnimationFrameID } from "@/utils/rafTimeout";
import { PlayerStateKeyEnum, StateContext } from "@/store/runtimeState";
import type { PlayerStateMap, TypedStateManager } from "@/store/runtimeState";
import type { VNode } from "@/types";
import { LottieIcon, LottieIconApi } from "./LottieIcon";
import { Switch } from "@/nova/components/Switch";
import { Checkbox } from "@/nova/components/Checkbox";
import { ArrowRight } from "./icons";
import { RadioGroup } from "./RadioGroup";
import type { RadioGroupOption } from "./RadioGroup";
import settingHoverAnimationData from "../assets/lottie-icon/settings-animation.json";

export interface SettingMenuProps {
  /** 高能进度条常驻当前状态（面板显示真实状态用） */
  permanent?: boolean;
  /**
   * 配置显隐（ui.controls.setting）
   * 父层可传 Signal 形态（props 惰性代理读取穿透建立依赖），
   * 缺省可见；display 由本组件根节点响应式 style 单一来源管理
   */
  visible?: boolean | ReadonlySignal<boolean>;
}

export type SettingMenuEvents = {
  settingChange: { key: string; value: boolean | string | number };
  moreSettingClick: undefined;
};

const MENU_SHOW_DELAY = 120;
const MENU_HIDE_DELAY = 220;

/** 第一页（设置主面板）尺寸，px */
const SETTING_PAGE_MAIN = { width: 132, height: 140 };
/**
 * 第二页（更多设置）尺寸，px（页内容为固定结构，尺寸为常量）
 * 高度按 CSS 推导：padding 上下 16×2 + 5 个 title（16+4）+ 4 组
 * radio 内容（24+12）+ others（title 20 + checkbox 行 20）= 296px
 */
const SETTING_PAGE_MORE = { width: 286, height: 296 };

export const SettingMenu = defineComponent<SettingMenuProps, SettingMenuEvents>(
  (props, lifecycle) => {
    const settingIconRef = useTemplateRef<LottieIconApi>(
      lifecycle,
      "settingIconRef",
    );

    let showTimer: AnimationFrameID | null = null;
    let hideTimer: AnimationFrameID | null = null;

    /**
     * 响应式信号：面板展开态
     * 驱动根节点 state-show 类（编译器包装为 __reactiveAttrs，
     * 变化时经 normalizeClass 精准更新类名），
     * 替代旧的 rootRef.classList.toggle 命令式写法
     */
    const shownSignal = signal<boolean>(false);

    /**
     * 响应式信号：当前页下标（0 设置主面板 / 1 更多设置）
     * 一站式驱动翻页三联动（替代旧的 switchPanelPage 命令式工具与 pageBox 量测回退）：
     *   - 页签 ui-panel-item-active 类 / .ui-area 的 state-show-right（响应式 class）
     *   - 外框 .ui-panel-wrap 的宽高跟随当前页（响应式 style）
     *   - .ui-panel-move 的 translateX 位移（响应式 style）
     * 写信号即可，过渡由各节点 CSS transition 承担
     */
    const pageIndexSignal = signal<number>(0);

    /**
     * 配置显隐派生信号：父层经 visible prop 传入（支持 Signal 形态，
     * props 惰性代理读取穿透 Signal.value 自动建立依赖），
     * display 由本组件根节点响应式 style 单一来源管理，
     * 消除旧的 RightControls querySelector 直写 display（两边写 display 打架）
     */
    const configVisibleSignal = computed(() => props.visible !== false);

    /**
     * 面板 hover 显隐：写信号即可，DOM 类名由响应式系统自动同步
     * @param show - 是否展开
     */
    const setShown = (show: boolean): void => {
      shownSignal.value = show;
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
     * 响应式：写页码信号即可，页签类名 / 外框尺寸 / 位移由响应式系统自动同步
     */
    const resetPage = (): void => {
      pageIndexSignal.value = 0;
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

    /** 更多设置：翻到第二页（写页码信号驱动翻页三联动） */
    const handleMoreClick = (): void => {
      pageIndexSignal.value = 1;
      lifecycle.emit?.("moreSettingClick");
    };

    /**
     * 渲染一组单选按钮
     * 响应式迁移后单选组不再需要 DOM 引用（refKey 残留传参会触发未注册告警），已一并移除
     * @param options - 选项列表
     * @param key - settingChange 的配置键
     * @returns 单选组虚拟节点
     */
    const renderRadioGroup = (
      options: RadioGroupOption[],
      key: string,
    ): VNode =>
      RadioGroup(options, {
        name: key,
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
        cls: "nova-player-ctrl-setting-mirror",
        name: t("player.ui.settings.mirror"),
        onChange: handleMirrorChange,
      },
      {
        cls: "nova-player-ctrl-setting-loop",
        name: t("player.ui.settings.loop"),
        onChange: handleLoopChange,
      },
      {
        cls: "nova-player-ctrl-setting-autoplay",
        name: t("player.ui.settings.autostart"),
        checked: true,
        onChange: handleAutostartChange,
      },
    ];

    /** 高能进度条复选框 API（供渲染态双向同步） */
    let highenergyApi: { setChecked: (value: boolean) => void } | null = null;

    const stateMgr = useContext<TypedStateManager<PlayerStateMap> | null>(
      StateContext,
    );

    /**
     * 响应式信号：高能进度条渲染态（设置面板复选框 = 是否渲染开关）
     * 注意与常驻态（PBP_PERMANENT，右侧图钉图标）解耦：
     * 取消勾选 → PbpControls 整个不挂载；常驻开关只控制展开行为
     * useReactiveState 返回 Signal，读取 .value 自动建立响应式依赖
     */
    const pbpRenderedSignal: Signal<boolean | undefined> = stateMgr
      ? useReactiveState(stateMgr, PlayerStateKeyEnum.PBP_RENDERED, lifecycle)
      : signal<boolean | undefined>(undefined);

    /**
     * 响应式同步：渲染态信号变化 → 调用 Checkbox API 同步勾选状态
     * onEffect 内读取 signal.value 自动追踪，信号变化时自动重跑
     * 保留命令式：highenergyApi.setChecked() 是组件 API 调用（非 DOM 操作）
     */
    onEffect(lifecycle, () => {
      const value = pbpRenderedSignal.value;
      if (value !== undefined) highenergyApi?.setChecked(value);
    });

    lifecycle.onBeforeDestroy = (): void => {
      clearTimers();
    };

    return h(
      "div",
      {
        // 展开态类名由 shownSignal 响应式驱动（__reactiveAttrs + normalizeClass）
        class: [
          "nova-player-ctrl-btn",
          "nova-player-ctrl-setting",
          { "state-show": shownSignal.value },
        ],
        role: "button",
        "aria-label": t("player.ui.settings.title"),
        // 配置显隐：display 单一来源（父层 ui.controls.setting 经 visible prop 传入）
        style: { display: configVisibleSignal.value ? "" : "none" },
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      },
      h(
        "div",
        { class: "nova-player-ctrl-btn-icon" },
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
        { class: "nova-player-ctrl-setting-box" },
        h(
            "div",
            {
              class: "nova-player-ctrl-setting-menu ui ui-panel ui-dark",
            },
            h(
              "div",
              {
                // 翻到第二页时加 state-show-right（pageIndexSignal 响应式驱动）
                class: ["ui-area", { "state-show-right": pageIndexSignal.value > 0 }],
              },
              h(
                "div",
                {
                  class: "ui-panel-wrap",
                  // 外框尺寸跟随当前页（响应式 style 派生，过渡由 CSS transition 承担）
                  style: {
                    width: `${(pageIndexSignal.value === 0 ? SETTING_PAGE_MAIN : SETTING_PAGE_MORE).width}px`,
                    height: `${(pageIndexSignal.value === 0 ? SETTING_PAGE_MAIN : SETTING_PAGE_MORE).height}px`,
                  },
                },
                h(
                  "div",
                  {
                    class: "ui-panel-move",
                    // 位移由 pageIndexSignal 派生：第二页时左移一页宽（过渡由 CSS transition 承担）
                    style: {
                      width: `${SETTING_PAGE_MAIN.width + SETTING_PAGE_MORE.width}px`,
                      transform: `translateX(${pageIndexSignal.value === 0 ? 0 : -SETTING_PAGE_MAIN.width}px)`,
                    },
                  },
                  h(
                    "div",
                    {
                      // 页签 active 类由 pageIndexSignal 响应式驱动
                      class: [
                        "ui-panel-item",
                        { "ui-panel-item-active": pageIndexSignal.value === 0 },
                      ],
                      style: {
                        width: `${SETTING_PAGE_MAIN.width}px`,
                        height: `${SETTING_PAGE_MAIN.height}px`,
                      },
                    },
                  h(
                    "div",
                    { class: "nova-player-ctrl-setting-menu-left" },
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
                      class: "nova-player-ctrl-setting-oped",
                      style: { display: "none" },
                    }),
                    h(
                      "div",
                      {
                        class: "nova-player-ctrl-setting-more",
                        onClick: handleMoreClick,
                      },
                      h(
                        "span",
                        { class: "nova-player-ctrl-setting-more-text" },
                        t("player.ui.settings.more"),
                      ),
                      h(
                        "span",
                        { class: "nova-player-ctrl-setting-more-arrow" },
                        ArrowRight(),
                      ),
                    ),
                  ),
                ),
                h(
                  "div",
                  {
                    // 第二页页签 active 类由 pageIndexSignal 响应式驱动
                    class: [
                      "ui-panel-item",
                      { "ui-panel-item-active": pageIndexSignal.value === 1 },
                    ],
                    style: { width: `${SETTING_PAGE_MORE.width}px` },
                  },
                  h(
                    "div",
                    { class: "nova-player-ctrl-setting-menu-right" },
                    h(
                      "div",
                      { class: "nova-player-ctrl-setting-handoff" },
                      h(
                        "div",
                        { class: "nova-player-ctrl-setting-handoff-title" },
                        t("player.ui.settings.handoff.title"),
                      ),
                      h(
                        "div",
                        {
                          class:
                            "nova-player-ctrl-setting-handoff-content ui ui-radio ui-dark",
                        },
                        h(
                          "div",
                          { class: "ui-area" },
                          renderRadioGroup(
                            // 响应式迁移后单选组不再需要 DOM 引用，refKey 参数已删除（避免运行时未注册告警）
                            [
                              {
                                label: t("player.ui.settings.handoff.auto"),
                                value: 0,
                              },
                              {
                                label: t("player.ui.settings.handoff.pause"),
                                value: 2,
                                checked: true,
                              },
                            ],
                            "handoff",
                          ),
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { class: "nova-player-ctrl-setting-aspect" },
                      h(
                        "div",
                        { class: "nova-player-ctrl-setting-aspect-title" },
                        t("player.ui.settings.aspect.title"),
                      ),
                      h(
                        "div",
                        {
                          class:
                            "nova-player-ctrl-setting-aspect-content ui ui-radio ui-dark",
                        },
                        h(
                          "div",
                          { class: "ui-area" },
                          renderRadioGroup(
                            // 响应式迁移后单选组不再需要 DOM 引用，refKey 参数已删除（避免运行时未注册告警）
                            [
                              {
                                label: t("player.ui.settings.aspect.auto"),
                                value: "0:0",
                                checked: true,
                              },
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
                      { class: "nova-player-ctrl-setting-codec" },
                      h(
                        "div",
                        { class: "nova-player-ctrl-setting-codec-title" },
                        t("player.ui.settings.codec.title"),
                      ),
                      h(
                        "div",
                        {
                          class:
                            "nova-player-ctrl-setting-codec-content ui ui-radio ui-dark",
                        },
                        h(
                          "div",
                          { class: "ui-area" },
                          renderRadioGroup(
                            // 响应式迁移后单选组不再需要 DOM 引用，refKey 参数已删除（避免运行时未注册告警）
                            [
                              {
                                label: t("player.ui.settings.codec.default"),
                                value: 0,
                                checked: true,
                              },
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
                      { class: "nova-player-ctrl-setting-loudness" },
                      h(
                        "div",
                        { class: "nova-player-ctrl-setting-loudness-title" },
                        t("player.ui.settings.loudness.title"),
                      ),
                      h(
                        "div",
                        {
                          class:
                            "nova-player-ctrl-setting-loudness-content ui ui-radio ui-dark",
                        },
                        h(
                          "div",
                          { class: "ui-area" },
                          renderRadioGroup(
                            // 响应式迁移后单选组不再需要 DOM 引用，refKey 参数已删除（避免运行时未注册告警）
                            [
                              {
                                label: t(
                                  "player.ui.settings.loudness.standard",
                                ),
                                value: 1,
                              },
                              {
                                label: t("player.ui.settings.loudness.dynamic"),
                                value: 2,
                              },
                              {
                                label: t("player.ui.settings.loudness.off"),
                                value: 0,
                                checked: true,
                              },
                            ],
                            "loudness",
                          ),
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { class: "nova-player-ctrl-setting-others" },
                      h(
                        "div",
                        { class: "nova-player-ctrl-setting-others-title" },
                        t("player.ui.settings.others"),
                      ),
                      h(
                        "div",
                        { class: "nova-player-ctrl-setting-others-content" },
                        h(
                          "div",
                          {
                            class:
                              "nova-player-ctrl-setting-checkbox nova-player-ctrl-setting-lightoff",
                          },
                          h(Checkbox, {
                            label: t("player.ui.settings.lightoff"),
                            onChange: handleLightoffChange,
                          }),
                        ),
                        h("div", {
                          class:
                            "nova-player-ctrl-setting-checkbox nova-player-ctrl-setting-widesave",
                          style: { display: "none" },
                        }),
                        h("div", {
                          class:
                            "nova-player-ctrl-setting-checkbox nova-player-ctrl-setting-panoram",
                          style: { display: "none" },
                        }),
                        h(
                          "div",
                          {
                            class:
                              "nova-player-ctrl-setting-checkbox nova-player-ctrl-setting-highenergy",
                          },
                          h(Checkbox, {
                            label: t("player.ui.settings.highenergy"),
                            // 复选框 = 是否渲染开关（默认渲染）；常驻开关是右侧图钉图标
                            checked: pbpRenderedSignal.value ?? true,
                            onChange: (checked: boolean) => {
                              stateMgr?.set(
                                PlayerStateKeyEnum.PBP_RENDERED,
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
                              "nova-player-ctrl-setting-checkbox nova-player-ctrl-setting-pip",
                          },
                          h(Checkbox, {
                            label: t("player.ui.settings.pip"),
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
