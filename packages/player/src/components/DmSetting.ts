/**
 * ============================================
 * 弹幕设置面板组件 (DmSetting)
 * ============================================
 * 结构与 `CicadaPlayerNext/platform/danmusetting.txt` 逐条对应
 * （bpx-player-* → player-*，bui-* → ui-*）。外层
 * `.player-dm-setting-wrap > .player-dm-setting-box.ui.ui-panel.ui-dark` 由 SendBar 提供，
 * 本组件从 `.ui-area` 起渲染左右两块：
 *   左：按类型过滤 / 弹幕随屏幕缩放·防挡字幕·智能防挡弹幕 / 屏蔽词 /
 *       显示区域·不透明度·弹幕字号·弹幕速度 / 高级设置
 *   右：更多弹幕设置（返回）/ 速度同步 / 弹幕字体 / 粗体 / 描边类型 / 恢复默认设置
 */

import { h, defineComponent, useContext, useTemplateRef } from "@/core";
import type { VNode } from "@/types";
import type { TypedStateManager } from "@/core/state";
import { Slider } from "@/hili-player/components/Slider";
import { Checkbox } from "@/hili-player/components/Checkbox";
import { switchPanelPage } from "@/hili-player/components/PanelPage";
import { ArrowLeft, ArrowRight } from "@/hili-player/components/icons";
import {
  StateContext,
  PlayerStateKeyEnum,
  type PlayerStateMap,
} from "@/store/runtimeState";

/** 弹幕速度滑杆值（0-100）到速度倍率的映射：0 → 0.5，50 → 1.0，100 → 1.5 */
const speedSliderToMultiplier = (value: number): number => 0.5 + value / 100;

/** 弹幕字体下拉项（对应参考 bui-select-list 的 8 个 data-value） */
const FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: "黑体", value: "SimHei, 'Microsoft JhengHei'" },
  { label: "宋体", value: "SimSun" },
  { label: "新宋体", value: "NSimSun" },
  { label: "仿宋", value: "FangSong" },
  { label: "微软雅黑", value: "'Microsoft YaHei'" },
  { label: "微软雅黑 Light", value: "'Microsoft Yahei UI Light'" },
  { label: "Noto Sans DemiLight", value: "'Noto Sans CJK SC DemiLight'" },
  { label: "Noto Sans Regular", value: "'Noto Sans CJK SC Regular'" },
];

export interface DmSettingProps {}

export interface DmSettingApi {
  setOpacity: (value: number) => void;
  setArea: (value: number) => void;
  setFontsize: (value: number) => void;
  setSpeed: (value: number) => void;
  resetPage: () => void;
}

export type DmSettingEvents = {
  dmSettingMounted: DmSettingApi;
};

/** 显示区域滑杆的档位标记 */
const AREA_MARKS = [
  { value: 0, name: "0%" },
  { value: 25, name: "25%" },
  { value: 50, name: "50%" },
  { value: 75, name: "75%" },
  { value: 100, name: "100%" },
];

/** 弹幕速度滑杆的档位标记 */
const SPEED_MARKS = [
  { value: 0, name: "极慢" },
  { value: 25, name: "较慢" },
  { value: 50, name: "适中" },
  { value: 75, name: "较快" },
  { value: 100, name: "极快" },
];

/** 按类型过滤的四个图标路径（来自参考 DOM 的 svg path） */
const FILTER_ICONS: Record<string, string[]> = {
  typeScroll: [
    "M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM11 9h6a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2zm-3 2H6V9h2v2zm4 4h-2v-2h2v2zm9 0h-6a1 1 0 0 1 0-2h6a1 1 0 0 1 0 2z",
  ],
  typeTopBottom: [
    "M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM9 9H7V7h2v2zm4 0h-2V7h2v2zm4 0h-2V7h2v2zm4 0h-2V7h2v2z",
  ],
  typeColor: [
    "M17.365 11.118c0-.612-.535-1.147-1.147-1.147s-1.147.535-1.147 1.147c0 .611.535 1.147 1.147 1.147s1.147-.536 1.147-1.147zM12.93 9.665c-.764 0-1.376.611-1.376 1.3 0 .689.612 1.301 1.376 1.301s1.376-.612 1.376-1.301-.612-1.3-1.376-1.3zM9.794 11.883c-.764 0-1.376.612-1.376 1.3 0 .689.612 1.3 1.376 1.3s1.376-.611 1.376-1.3c.001-.688-.611-1.3-1.376-1.3zM10.023 15.171c-.612 0-1.147.536-1.147 1.148 0 .611.535 1.146 1.147 1.146s1.147-.535 1.147-1.146c.001-.612-.535-1.148-1.147-1.148zM17.823 12.953c-.611 0-1.147.535-1.147 1.147s.536 1.147 1.147 1.147c.612 0 1.148-.535 1.148-1.147s-.536-1.147-1.148-1.147z",
    "M23.177 3H4.824C2.683 3 1 4.833 1 7.167v13.665C1 23.167 2.683 25 4.824 25h18.353C25.318 25 27 23.167 27 20.833V7.167C27 4.833 25.318 3 23.177 3zm-3.442 13.624c-1.987.612-4.129-.154-5.046.764-.918.918 1.529 1.606 0 2.219-1.988.84-7.341-.535-8.182-4.053-.841-3.441 2.905-6.5 5.888-7.035 2.906-.535 6.041.841 8.181 2.982 2.065 2.141.765 4.74-.841 5.123z",
  ],
  typeSpecial: [
    "M23 3H5a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zM7.849 11.669l.447-.828.492.782.894.184-.536.736.134.966-.85-.321-.804.414.045-.967L7 11.946l.849-.277zm3.352 7.101-1.43-.506L8.43 19v-1.565L7.357 16.33l1.43-.506.67-1.381.894 1.289 1.475.23-.894 1.289.269 1.519zm7.95-3.9-2.816-.69-2.458 1.565-.223-2.946-2.145-1.933 2.637-1.151L15.263 7l1.877 2.255 2.86.23-1.52 2.531.671 2.854z",
  ],
};

export const DmSetting = defineComponent<DmSettingProps, DmSettingEvents>(
  (_props, lifecycle) => {
    const stateMgr = useContext<TypedStateManager<PlayerStateMap> | null>(
      StateContext,
    );

    const uiAreaRef = useTemplateRef<HTMLDivElement>(lifecycle, "dmUiAreaRef");
    const fontResultRef = useTemplateRef<HTMLSpanElement>(
      lifecycle,
      "dmFontResultRef",
    );
    const fontListRef = useTemplateRef<HTMLDivElement>(
      lifecycle,
      "dmFontListRef",
    );

    const sliderApis: {
      area?: (value: number) => void;
      opacity?: (value: number) => void;
      fontsize?: (value: number) => void;
      speed?: (value: number) => void;
    } = {};

    const handleAreaChange = (value: number): void => {
      stateMgr?.set(PlayerStateKeyEnum.DANMAKU_AREA, value);
    };

    const handleOpacityChange = (value: number): void => {
      stateMgr?.set(PlayerStateKeyEnum.DANMAKU_OPACITY, value / 100);
    };

    const handleFontsizeChange = (value: number): void => {
      stateMgr?.set(PlayerStateKeyEnum.DANMAKU_FONT_SIZE, value);
    };

    const handleSpeedChange = (value: number): void => {
      stateMgr?.set(
        PlayerStateKeyEnum.DANMAKU_SPEED,
        speedSliderToMultiplier(value),
      );
    };

    const handleScaleChange = (checked: boolean): void => {
      stateMgr?.set(PlayerStateKeyEnum.DANMAKU_SCALE_WITH_SCREEN, checked);
    };

    const handleFilterTypeClick = (event: MouseEvent): void => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLElement)) return;
      target.classList.toggle("player-block-filter-type-selected");
    };

    const handleDensityClick = (event: MouseEvent): void => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLElement)) return;
      target.parentElement
        ?.querySelectorAll(".player-dm-setting-density")
        .forEach((item) => item.classList.remove("active"));
      target.classList.add("active");
    };

    /**
     * 左右面板切换：目标页加 active ＋ move 位移一页宽 ＋ 外框尺寸跟到目标页
     * （位移与外框过渡由 .ui-panel-move / .ui-panel-wrap / .ui-area 上的 transition 承担）
     * @param show - true 显示右侧「更多弹幕设置」
     */
    const toggleRight = (show: boolean): void => {
      switchPanelPage({
        root: uiAreaRef.value,
        index: show ? 1 : 0,
        resizeArea: true,
      });
    };

    /** 复位到第一页（面板关闭时调用，下次打开即第一页） */
    const resetPage = (): void => {
      toggleRight(false);
    };

    /**
     * 切换弹幕字体下拉的展开态
     * @param open - 是否展开
     */
    const toggleFontList = (open?: boolean): void => {
      const list = fontListRef.value;
      if (!list) return;
      const next = open ?? list.style.display !== "block";
      list.style.display = next ? "block" : "none";
    };

    /**
     * 选择弹幕字体
     * @param label - 字体显示名
     * @param event - 点击事件（取 currentTarget 作为选中项）
     */
    const handleFontPick = (label: string, event: MouseEvent): void => {
      const target = event.currentTarget;
      if (target instanceof HTMLElement) {
        target.parentElement
          ?.querySelectorAll(".ui-select-item")
          .forEach((item) => item.classList.remove("ui-select-item-active"));
        target.classList.add("ui-select-item-active");
        if (fontResultRef.value) fontResultRef.value.textContent = label;
      }
      toggleFontList(false);
    };

    const handleReset = (): void => {
      sliderApis.area?.(50);
      sliderApis.opacity?.(100);
      sliderApis.fontsize?.(50);
      sliderApis.speed?.(50);
      stateMgr?.set(PlayerStateKeyEnum.DANMAKU_AREA, 50);
      stateMgr?.set(PlayerStateKeyEnum.DANMAKU_OPACITY, 1);
      stateMgr?.set(PlayerStateKeyEnum.DANMAKU_FONT_SIZE, 50);
      stateMgr?.set(PlayerStateKeyEnum.DANMAKU_SPEED, 1);
    };

    /** 渲染「按类型过滤」的四个图标项 */
    const renderFilterTypes = (): VNode[] => {
      const types = [
        { type: "typeScroll", label: "滚动" },
        { type: "typeTopBottom", label: "固定" },
        { type: "typeColor", label: "彩色" },
        { type: "typeSpecial", label: "高级" },
      ];

      return types.map((item) =>
        h(
          "div",
          {
            class: `player-block-filter-type player-block-${item.type}`,
            "data-type": item.type,
            onClick: handleFilterTypeClick,
          },
          h(
            "span",
            { class: "player-block-filter-image" },
            h(
              "svg",
              {
                xmlns: "http://www.w3.org/2000/svg",
                "xml:space": "preserve",
                "data-pointer": "none",
                style: "enable-background:new 0 0 28 28",
                viewBox: "0 0 28 28",
              },
              ...FILTER_ICONS[item.type].map((path) =>
                h("path", {
                  d: path,
                }),
              ),
            ),
          ),
          h(
            "span",
            { class: "player-block-filter-label" },
            h("span", {}, item.label),
            ...(item.type === "typeSpecial"
              ? [
                  h(
                    "span",
                    { class: "player-block-advanced-more" },
                    h(
                      "svg",
                      {
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        "data-pointer": "none",
                        viewBox: "0 0 14 14",
                      },
                      h("path", {
                        fill: "#9499A0",
                        d: "M7 2.041a4.958 4.958 0 1 0 0 9.917A4.958 4.958 0 0 0 7 2.04ZM1.167 7a5.833 5.833 0 1 1 11.666 0A5.833 5.833 0 0 1 1.166 7Z",
                      }),
                      h("path", {
                        fill: "#9499A0",
                        d: "M7.51 9.296a.51.51 0 1 1-1.02 0 .51.51 0 0 1 1.02 0ZM7 5.177a.73.73 0 0 0-.729.729.437.437 0 1 1-.875 0 1.604 1.604 0 0 1 3.208 0 1.5 1.5 0 0 1-.36.991c-.096.118-.202.22-.297.307l-.081.074c-.067.061-.127.116-.187.177-.147.146-.199.25-.22.31a.5.5 0 0 0-.021.182.437.437 0 1 1-.875 0c0-.118.006-.284.07-.469.071-.206.204-.42.427-.642a6.966 6.966 0 0 1 .293-.274c.089-.083.159-.151.216-.22a.629.629 0 0 0 .16-.436.73.73 0 0 0-.729-.73Z",
                      }),
                    ),
                  ),
                ]
              : []),
          ),
        ),
      );
    };

    /** 渲染一个滑杆行（标题 + 内容 + Slider） */
    const renderSliderRow = (
      cls: string,
      title: string,
      options: {
        value: number;
        step?: number;
        marks?: Array<{ value: number; name: string }>;
        onChange: (value: number) => void;
        onMounted: (api: { setValue: (value: number) => void }) => void;
      },
    ): VNode =>
      h(
        "div",
        { class: `${cls} ui ui-progress` },
        h("div", { class: `${cls}-title` }, title),
        h(
          "div",
          { class: `${cls}-content` },
          h("div", { class: `player-dm-setting-ui-${cls.split("-").pop()}` }),
        ),
        h(Slider, {
          value: options.value,
          step: options.step,
          marks: options.marks,
          onChange: options.onChange,
          onSliderMounted: options.onMounted,
        }),
      );

    lifecycle.onMounted = (): void => {
      if (stateMgr) {
        const area = stateMgr.get(PlayerStateKeyEnum.DANMAKU_AREA) ?? 50;
        const opacity =
          (stateMgr.get(PlayerStateKeyEnum.DANMAKU_OPACITY) ?? 1) * 100;
        const fontsize =
          stateMgr.get(PlayerStateKeyEnum.DANMAKU_FONT_SIZE) ?? 50;
        const speed =
          ((stateMgr.get(PlayerStateKeyEnum.DANMAKU_SPEED) ?? 1) - 0.5) * 100;
        sliderApis.area?.(area);
        sliderApis.opacity?.(opacity);
        sliderApis.fontsize?.(fontsize);
        sliderApis.speed?.(speed);
      }
      lifecycle.emit?.("dmSettingMounted", {
        setOpacity: (value: number) => sliderApis.opacity?.(value),
        setArea: (value: number) => sliderApis.area?.(value),
        setFontsize: (value: number) => sliderApis.fontsize?.(value),
        setSpeed: (value: number) => sliderApis.speed?.(value),
        resetPage,
      } satisfies DmSettingApi);
    };

    return h(
      "div",
      { class: "ui-area", ref: "dmUiAreaRef" },
      h(
        "div",
        {
          class: "ui-panel-wrap",
          style: { width: "320px", height: "322px" },
        },
        h(
          "div",
          {
            class: "ui-panel-move",
            style: { width: "586px", transform: "translateX(0px)" },
          },
          // ===== 左：弹幕设置主面板 =====
          h(
            "div",
            {
              class: "ui-panel-item ui-panel-item-active",
              style: { width: "320px", height: "322px" },
            },
            h(
              "div",
              { class: "player-dm-setting-left" },
              // 按类型过滤
              h(
                "div",
                { class: "player-dm-setting-left-block" },
                h(
                  "div",
                  { class: "player-dm-setting-left-block-title" },
                  "按类型过滤",
                ),
                h(
                  "div",
                  { class: "player-dm-setting-left-block-content" },
                  ...renderFilterTypes(),
                ),
              ),
              // 三个复选框
              h(
                "div",
                { class: "player-dm-setting-left-radio" },
                h(
                  "span",
                  { class: "player-dm-setting-left-fs" },
                  h(Checkbox, {
                    checked:
                      stateMgr?.get(
                        PlayerStateKeyEnum.DANMAKU_SCALE_WITH_SCREEN,
                      ) ?? true,
                    label: "弹幕随屏幕缩放",
                    onChange: handleScaleChange,
                  }),
                ),
                h(
                  "span",
                  {
                    class: "player-dm-setting-left-ps",
                    "data-text": "视频底部15%部分为空白保留区",
                  },
                  h(Checkbox, {
                    label: "防挡字幕",
                  }),
                ),
                h(
                  "span",
                  { class: "player-dm-setting-left-mask" },
                  h(Checkbox, {
                    label: "智能防挡弹幕",
                    checked: true,
                  }),
                ),
              ),
              // 防挡字幕保留区示意
              h(
                "div",
                { class: "player-dm-setting-left-preventshade" },
                h("span", {
                  class: "player-dm-setting-left-preventshade-box",
                  "data-text": "视频底部15%部分为空白保留区",
                  "data-position": "top-left",
                }),
              ),
              h(
                "div",
                {
                  class: "player-dm-setting-left-danmaku-mask",
                  style: { display: "none" },
                },
                h("span", { class: "player-dm-setting-left-danmaku-mask-box" }),
              ),
              // 屏蔽词
              h(
                "div",
                { class: "player-dm-setting-left-block-word" },
                h(
                  "div",
                  {
                    class: "player-dm-setting-left-block-add",
                  },
                  "弹幕观看屏蔽词",
                ),
                h(
                  "div",
                  {
                    class: "player-dm-setting-left-block-sync",
                  },
                  "同步屏蔽列表",
                ),
              ),
              // 显示区域
              renderSliderRow("player-dm-setting-left-area", "显示区域", {
                value: 50,
                step: 5,
                marks: AREA_MARKS,
                onChange: handleAreaChange,
                onMounted: (api) => {
                  sliderApis.area = api.setValue;
                },
              }),
              // 弹幕密度（参考中隐藏）
              h(
                "div",
                {
                  class: "player-dm-setting-left-dmDensity",
                  style: { display: "none" },
                },
                h(
                  "div",
                  { class: "player-dm-setting-left-dmDensity-left-area" },
                  "弹幕密度",
                ),
                h(
                  "div",
                  { class: "player-dm-setting-left-dmDensity-right-area" },
                  ...(
                    [
                      { density: "normal", label: "正常", active: true },
                      { density: "more", label: "较多" },
                      { density: "most", label: "重叠" },
                    ] as Array<{
                      density: string;
                      label: string;
                      active?: boolean;
                    }>
                  ).map((item) =>
                    h(
                      "span",
                      {
                        class: item.active
                          ? "player-dm-setting-density active"
                          : "player-dm-setting-density",
                        "data-density": item.density,
                        onClick: handleDensityClick,
                      },
                      item.label,
                    ),
                  ),
                ),
              ),
              // 不透明度
              renderSliderRow("player-dm-setting-left-opacity", "不透明度", {
                value: 100,
                onChange: handleOpacityChange,
                onMounted: (api) => {
                  sliderApis.opacity = api.setValue;
                },
              }),
              // 弹幕字号
              renderSliderRow("player-dm-setting-left-fontsize", "弹幕字号", {
                value: 50,
                onChange: handleFontsizeChange,
                onMounted: (api) => {
                  sliderApis.fontsize = api.setValue;
                },
              }),
              // 弹幕速度
              renderSliderRow("player-dm-setting-left-speedplus", "弹幕速度", {
                value: 50,
                step: 5,
                marks: SPEED_MARKS,
                onChange: handleSpeedChange,
                onMounted: (api) => {
                  sliderApis.speed = api.setValue;
                },
              }),
              // 高级设置
              h(
                "div",
                {
                  class: "player-dm-setting-left-more",
                  onClick: () => toggleRight(true),
                },
                h(
                  "span",
                  { class: "player-dm-setting-left-more-text" },
                  "高级设置",
                ),
                h(
                  "span",
                  { class: "player-dm-setting-left-more-senior-text" },
                  "全新【硬核会员弹幕模式】",
                ),
                h("span", { class: "common-svg-icon" }, ArrowRight()),
              ),
            ),
          ),
          // ===== 右：更多弹幕设置 =====
          h(
            "div",
            {
              class: "ui-panel-item",
              style: { width: "266px", height: "250px" },
            },
            h(
              "div",
              { class: "player-dm-setting-right" },
              h(
                "div",
                {
                  class: "player-dm-setting-right-more",
                  onClick: () => toggleRight(false),
                },
                h("span", { class: "common-svg-icon" }, ArrowLeft()),
                h(
                  "span",
                  { class: "player-dm-setting-right-more-text" },
                  "更多弹幕设置",
                ),
              ),
              h("div", { class: "player-dm-setting-right-separator" }),
              h(
                "div",
                { class: "player-dm-setting-right-speedsync" },
                h(
                  "span",
                  { class: "player-dm-setting-right-speedsync-box" },
                  h(Checkbox, {
                    label: "弹幕速度同步播放倍数",
                  }),
                ),
              ),
              h(
                "div",
                { class: "player-dm-setting-right-font" },
                h(
                  "div",
                  { class: "player-dm-setting-right-font-title" },
                  "弹幕字体",
                ),
                h(
                  "div",
                  { class: "player-dm-setting-right-font-content" },
                  h(
                    "div",
                    {
                      class:
                        "player-dm-setting-right-font-content-fontfamily ui ui-select ui-dark",
                    },
                    h(
                      "div",
                      { class: "ui-select-wrap" },
                      h(
                        "div",
                        { class: "ui-select-border" },
                        h(
                          "div",
                          {
                            class: "ui-select-header",
                            onClick: () => toggleFontList(),
                          },
                          h(
                            "span",
                            {
                              class: "ui-select-result",
                              ref: "dmFontResultRef",
                            },
                            "黑体",
                          ),
                          h(
                            "span",
                            { class: "ui-select-arrow" },
                            h("span", { class: "ui-select-arrow-down" }),
                          ),
                        ),
                        h(
                          "div",
                          {
                            class: "ui-select-list-wrap",
                            ref: "dmFontListRef",
                            style: { display: "none" },
                          },
                          h(
                            "ul",
                            { class: "ui-select-list" },
                            ...FONT_FAMILIES.map((font, index) =>
                              h(
                                "li",
                                {
                                  class:
                                    index === 0
                                      ? "ui-select-item ui-select-item-active"
                                      : "ui-select-item",
                                  "data-value": font.value,
                                  onClick: (event: MouseEvent) =>
                                    handleFontPick(font.label, event),
                                },
                                font.label,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                h(
                  "div",
                  { class: "player-dm-setting-right-font-bold" },
                  h(
                    "span",
                    { class: "player-dm-setting-right-font-bold-box" },
                    h(Checkbox, {
                      label: "粗体",
                    }),
                  ),
                ),
              ),
              h(
                "div",
                { class: "player-dm-setting-right-fontborder" },
                h(
                  "div",
                  { class: "player-dm-setting-right-fontborder-title" },
                  "描边类型",
                ),
                h(
                  "div",
                  {
                    class:
                      "player-dm-setting-right-fontborder-content ui ui-radio ui-dark",
                  },
                  h(
                    "div",
                    { class: "player-radio-wrap-button" },
                    ...[
                      { label: "重墨", active: true },
                      { label: "描边" },
                      { label: "45°投影" },
                    ].map((item) =>
                      h(
                        "div",
                        {
                          class: item.active
                            ? "radio-button active"
                            : "radio-button",
                          onClick: (event: MouseEvent) => {
                            const target = event.currentTarget;
                            if (!(target instanceof HTMLElement)) return;
                            target.parentElement
                              ?.querySelectorAll(".radio-button")
                              .forEach((btn) => btn.classList.remove("active"));
                            target.classList.add("active");
                          },
                        },
                        h("span", {}, item.label),
                      ),
                    ),
                  ),
                ),
              ),
              h("div", { class: "player-dm-setting-right-separator" }),
              h(
                "div",
                {
                  class: "player-dm-setting-right-reset ui ui-button",
                  onClick: handleReset,
                },
                h(
                  "div",
                  { class: "ui-area ui-button-transparent" },
                  h("span", {}, "恢复默认设置"),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  },
);
