/**
 * ============================================
 * 字幕设置面板组件 (SubtitleMenu)
 * ============================================
 * 显隐：Controls.ts 给按钮根节点加 `state-show`（Controls.ts:196 / :334）后面板显示；
 * 二级页：点击「字幕设置」给 `.ui-area` 加 `state-show-right`（与 SettingMenu.handleMoreClick
 * 一致），由样式侧把 .ui-panel-wrap 从 168×311 过渡到 266×260 并左移 168px 滑出第 2 页。
 *
 * 框架无虚拟 DOM diff：语言列表 / 下拉选项首帧用 h() 生成，之后的选中态、结果文案、
 * 开关勾选、滑条位置全部在命令式回调里直接改真实 DOM（参考 QualityMenu 的做法）。
 */

import { h, defineComponent, useTemplateRef, useState, useContext } from '@/core';
import { useComponentUnmount } from '@/hili-player/core/componentUnmount';
import { rafTimeout, cancelRaf } from '@/utils/rafTimeout';
import type { AnimationFrameID } from '@/utils/rafTimeout';
import type { VNode } from '@/types';
import { PlayerStateKeyEnum, StateContext } from '@/store/runtimeState';

// ============================================
// 对外接口（冻结，父层按此接线）
// ============================================

/** 字幕语言项 */
export interface SubtitleLanguageOption {
  /** 语言标识（渲染为语言项 data-lan，参考 DOM 形如 ai-zh） */
  lang: string;
  /** 显示名（参考 DOM 原文，如「中文」「English」） */
  label: string;
  /** 是否默认语言 */
  isDefault?: boolean;
}

/** 字幕样式补丁（只带变化的字段） */
export interface SubtitleStylePatch {
  fontSize?: number;
  color?: string;
  position?: 'top' | 'bottom';
  offset?: number;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  scale?: boolean;
  fade?: boolean;
}

/** 字幕样式（组件内部使用的完整样式结构，与 SubtitleMenuProps['style'] 一致） */
export type SubtitleStyle = NonNullable<SubtitleMenuProps['style']>;

export interface SubtitleMenuProps {
  /** 字幕是否开启 */
  visible: boolean;
  /** 可选语言列表（为空时按参考 DOM 的 6 项原样渲染） */
  languages: SubtitleLanguageOption[];
  /** 当前语言 */
  lang: string;
  /** 当前样式（用于回显各设置项初值） */
  style: {
    fontSize: number;
    color: string;
    position: 'top' | 'bottom';
    offset: number;
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
    scale: boolean;
    fade: boolean;
  };
  /** 是否开启双语 */
  bilingual?: boolean;
}

export interface SubtitleMenuEvents {
  /** 字幕开关变化 */
  subtitleToggle: (visible: boolean) => void;
  /** 语言切换 */
  subtitleLangChange: (lang: string) => void;
  /** 样式项变化（只带变化字段） */
  subtitleStyleChange: (patch: SubtitleStylePatch) => void;
  /** 双语开关变化 */
  bilingualChange: (enabled: boolean) => void;
  /** 组件挂载完成（供父层获取命令式 API，可选） */
  subtitleMenuMounted?: SubtitleMenuApi;
}

/** 组件对外暴露的命令式 API */
export interface SubtitleMenuApi {
  /** 同步字幕开关（含按钮结果区与「关闭」行选中态） */
  setVisible: (visible: boolean) => void;
  /** 同步双语开关 */
  setBilingual: (enabled: boolean) => void;
  /** 回到第 1 页（移除 state-show-right） */
  showOriginPage: () => void;
}

// ============================================
// 常量：文案与选项（全部照抄参考 DOM）
// ============================================

/**
 * 参考 DOM 的语言项（字幕设置-dom.txt:65-77 / :83-95，主副字幕列表各 6 项，内容相同）
 * props.languages 为空时按这 6 项原样渲染
 */
const DEFAULT_LANGUAGES: SubtitleLanguageOption[] = [
  { lang: 'ai-zh', label: '中文' },
  { lang: 'ai-en', label: 'English' },
  { lang: 'ai-ja', label: '日本語' },
  { lang: 'ai-es', label: 'Español' },
  { lang: 'ai-ar', label: 'العربية' },
  { lang: 'ai-pt', label: 'Português' },
];

/** 下拉选项（value 为参考 DOM 的 data-value，label 为选项原文） */
interface SubtitleSelectOption {
  /** 参考 DOM 的 data-value */
  value: string;
  /** 选项原文 */
  label: string;
  /** 颜色项色块（参考 DOM 内联 style 的色值） */
  swatch?: string;
  /** 选中后下发的样式补丁 */
  patch: SubtitleStylePatch;
}

/** 参考 DOM 快照对应的默认样式 */
const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 1, // 字幕大小：适中（data-value=1）
  color: '#ffffff', // 字幕颜色：白色
  position: 'bottom', // 默认位置：底部居中
  offset: 0,
  strokeColor: 'none', // 描边方式：无描边
  strokeWidth: 0,
  opacity: 0.87, // 背景不透明度：87%
  scale: true, // 其它设置：等比缩放（参考 DOM 该 input 带 checked）
  fade: false, // 其它设置：淡入淡出
};

/** 字幕大小（参考 DOM data-value 0.6/0.8/1/1.3/1.6，结果项初始为「适中」） */
const FONT_SIZE_OPTIONS: SubtitleSelectOption[] = [
  { value: '0.6', label: '最小', patch: { fontSize: 0.6 } },
  { value: '0.8', label: '较小', patch: { fontSize: 0.8 } },
  { value: '1', label: '适中', patch: { fontSize: 1 } },
  { value: '1.3', label: '较大', patch: { fontSize: 1.3 } },
  { value: '1.6', label: '最大', patch: { fontSize: 1.6 } },
];

/** 字幕颜色（data-value 为参考 DOM 的十进制色值，色块取内联 style 的十六进制值） */
const COLOR_OPTIONS: SubtitleSelectOption[] = [
  { value: '16777215', label: '白色', swatch: '#ffffff', patch: { color: '#ffffff' } },
  { value: '16007990', label: '红色', swatch: '#F44336', patch: { color: '#F44336' } },
  { value: '10233776', label: '紫色', swatch: '#9C27B0', patch: { color: '#9C27B0' } },
  { value: '6765239', label: '深紫色', swatch: '#673AB7', patch: { color: '#673AB7' } },
  { value: '4149685', label: '靛青色', swatch: '#3F51B5', patch: { color: '#3F51B5' } },
  { value: '2201331', label: '蓝色', swatch: '#2196F3', patch: { color: '#2196F3' } },
  { value: '240116', label: '亮蓝色', swatch: '#03A9F4', patch: { color: '#03A9F4' } },
];

/**
 * 描边方式（参考 DOM data-value 0/1/2/3）
 * 冻结接口只提供 strokeColor + strokeWidth，故每一档映射为一组描边色/线宽
 */
const STROKE_OPTIONS: SubtitleSelectOption[] = [
  { value: '0', label: '无描边', patch: { strokeColor: 'none', strokeWidth: 0 } },
  { value: '1', label: '重墨', patch: { strokeColor: '#000000', strokeWidth: 4 } },
  { value: '2', label: '描边', patch: { strokeColor: '#000000', strokeWidth: 2 } },
  { value: '3', label: '45°投影', patch: { strokeColor: '#000000', strokeWidth: 1 } },
];

/**
 * 默认位置（参考 DOM 的 6 档 data-value）
 * 冻结接口为 position('top'|'bottom') + offset，故左/中/右映射为 offset -1/0/1
 */
const POSITION_OPTIONS: SubtitleSelectOption[] = [
  { value: 'bottom-left', label: '左下角', patch: { position: 'bottom', offset: -1 } },
  { value: 'bottom-center', label: '底部居中', patch: { position: 'bottom', offset: 0 } },
  { value: 'bottom-right', label: '右下角', patch: { position: 'bottom', offset: 1 } },
  { value: 'top-left', label: '左上角', patch: { position: 'top', offset: -1 } },
  { value: 'top-center', label: '顶部居中', patch: { position: 'top', offset: 0 } },
  { value: 'top-right', label: '右上角', patch: { position: 'top', offset: 1 } },
];

/** 四个下拉的根节点类名（与 subtitlemenu.scss 对应） */
const SELECT_CLASS = {
  fontSize: 'player-ctrl-subtitle-fontsize-content',
  color: 'player-ctrl-subtitle-color-content',
  stroke: 'player-ctrl-subtitle-shadow-content',
  position: 'player-ctrl-subtitle-position-content',
} as const;

/** 滑条圆点直径（参考 .bui-thumb .bui-thumb-dot 为 12px） */
const THUMB_SIZE = 12;

// ============================================
// 图标（svg 照抄参考 DOM）
// ============================================

/** 字幕标记图标（参考 DOM:4 结果区 / :66 语言项） */
const SubtitleMarkIcon = (): VNode =>
  h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      fill: 'none',
      'data-pointer': 'none',
      viewBox: '0 0 14 12',
    },
    h('rect', {
      width: '13.5',
      height: '11.5',
      x: '.25',
      y: '.25',
      stroke: '#fff',
      'stroke-opacity': '.5',
      'stroke-width': '.5',
      rx: '5.75',
    }),
    h('path', {
      fill: '#fff',
      d: 'M5.248 2.788h.76L8.256 8.5h-.712l-.608-1.6H4.312l-.608 1.6H3l2.248-5.712Zm-.728 3.56h2.208l-1.08-2.856h-.032L4.52 6.348Zm4.362-3.56h.648V8.5h-.648V2.788Z',
    }),
  );

/** 假开关问号图标（参考 DOM:44） */
const FakeSwitchIcon = (): VNode =>
  h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      fill: 'none',
      'data-pointer': 'none',
      viewBox: '0 0 12 12',
    },
    h('path', {
      fill: '#61666D',
      d: 'M6 1.875a4.125 4.125 0 1 0 0 8.25 4.125 4.125 0 0 0 0-8.25ZM.875 6a5.125 5.125 0 1 1 10.25 0A5.125 5.125 0 0 1 .875 6Z',
    }),
    h('path', {
      fill: '#61666D',
      d: 'M6 3.5a.5.5 0 0 1 .5.5v2.25a.5.5 0 1 1-1 0V4a.5.5 0 0 1 .5-.5ZM6 7.25a.5.5 0 0 1 .5.5v.125a.5.5 0 1 1-1 0V7.75a.5.5 0 0 1 .5-.5Z',
    }),
  );

/** 「字幕设置」右尖角图标（参考 DOM:112，path 不写 fill，颜色由 CSS 的 fill 控制） */
const ChevronRightIcon = (): VNode =>
  h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      'xml:space': 'preserve',
      'data-pointer': 'none',
      viewBox: '0 0 16 16',
    },
    h('path', {
      d: 'm9.188 7.999-3.359 3.359a.75.75 0 1 0 1.061 1.061l3.889-3.889a.75.75 0 0 0 0-1.061L6.89 3.58a.75.75 0 1 0-1.061 1.061l3.359 3.358z',
    }),
  );

/** 勾选未选中图标（参考 DOM:349，path 不写 fill，颜色由 CSS 的 fill 控制） */
const CheckboxDefaultIcon = (): VNode =>
  h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      'data-pointer': 'none',
      viewBox: '0 0 32 32',
    },
    h('path', {
      d: 'M8 6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8zm0-2h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z',
    }),
  );

/** 勾选选中图标（参考 DOM:350） */
const CheckboxSelectedIcon = (): VNode =>
  h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      'data-pointer': 'none',
      viewBox: '0 0 32 32',
    },
    h('path', {
      d: 'm13 18.25-1.8-1.8c-.6-.6-1.65-.6-2.25 0s-.6 1.5 0 2.25l2.85 2.85c.318.318.762.468 1.2.448.438.02.882-.13 1.2-.448l8.85-8.85c.6-.6.6-1.65 0-2.25s-1.65-.6-2.25 0l-7.8 7.8zM8 4h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z',
    }),
  );

// ============================================
// 组件
// ============================================

/**
 * 字幕设置面板
 */
export const SubtitleMenu = defineComponent<SubtitleMenuProps, SubtitleMenuEvents>(
  (props, lifecycle) => {
    const state = useContext(StateContext);

    // ============================================
    // 初值
    // ============================================

    /** 语言列表：父层传入优先，为空时按参考 DOM 的 6 项原样渲染 */
    const languages: SubtitleLanguageOption[] =
      props.languages && props.languages.length > 0 ? props.languages : DEFAULT_LANGUAGES;

    /** 当前样式（缺字段回落到参考 DOM 的默认值） */
    let currentStyle: SubtitleStyle = { ...DEFAULT_STYLE, ...(props.style ?? {}) };

    /** 字幕开关 */
    let visible: boolean = props.visible ?? false;

    /** 当前语言 */
    let lang: string = props.lang ?? '';

    /** 双语开关 */
    let bilingual: boolean = props.bilingual ?? false;

    /** 滑条拖拽中的 mousemove 监听（销毁时移除） */
    let dragMoveHandler: ((event: MouseEvent) => void) | null = null;

    /** 滑条拖拽中的 mouseup 监听（销毁时移除） */
    let dragUpHandler: (() => void) | null = null;

    // ============================================
    // DOM 引用
    // ============================================

    /** 按钮根节点（面板显隐的类名挂载点） */
    const rootRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleRootRef');

    /** 面板根节点（内部查询各控件用） */
    const menuRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleMenuRef');

    /** 展开定时器 */
    let showTimer: AnimationFrameID | null = null;

    /** 收起定时器 */
    let hideTimer: AnimationFrameID | null = null;

    /** 取消两个方向的排队任务 */
    const clearTimers = (): void => {
      cancelRaf(showTimer!);
      cancelRaf(hideTimer!);
      showTimer = null;
      hideTimer = null;
    };

    useComponentUnmount(lifecycle, clearTimers);

    // ============================================
    // 工具
    // ============================================

    /**
     * 数值裁剪
     * @param value - 原值
     * @param min - 下界
     * @param max - 上界
     */
    const clamp = (value: number, min: number, max: number): number =>
      Math.min(max, Math.max(min, value));

    /**
     * 下发样式补丁
     * @param patch - 只带变化字段的补丁
     */
    const emitStyle = (patch: SubtitleStylePatch): void => {
      lifecycle.emit?.('subtitleStyleChange', patch);
    };

    // ============================================
    // 结果区 / 选中态
    // ============================================

    /**
     * 刷新按钮结果区：字幕关闭时显示「字幕」，开启时显示当前语言名；
     * 标记图标仅在字幕开启时显示（参考 DOM 关闭态该图标为 display:none）
     */
    const applyResult = (): void => {
      const root = rootRef.value;
      if (!root) return;
      const result = root.querySelector<HTMLElement>('.player-ctrl-subtitle-result');
      const icon = root.querySelector<HTMLElement>('.player-ctrl-subtitle-result-icon');
      const hit = languages.find((item) => item.lang === lang);
      if (result) result.textContent = visible && hit ? hit.label : '字幕';
      if (icon) icon.style.display = visible ? '' : 'none';
    };

    /** 刷新「关闭」行与语言项的选中态，以及两个双语开关的勾选状态 */
    const applyActive = (): void => {
      const menu = menuRef.value;
      if (!menu) return;
      menu.querySelectorAll<HTMLElement>('.player-ctrl-subtitle-close-switch').forEach((el) => {
        el.classList.toggle('player-state-active', !visible);
      });
      menu.querySelectorAll<HTMLElement>('.player-ctrl-subtitle-language-item').forEach((el) => {
        el.classList.toggle(
          'player-state-active',
          visible && el.getAttribute('data-lan') === lang,
        );
      });
      menu
        .querySelectorAll<HTMLInputElement>('.player-ctrl-subtitle-switch-input')
        .forEach((el) => {
          el.checked = bilingual;
        });
    };

    // ============================================
    // 下拉：当前值反查
    // ============================================

    /** 字幕大小 data-value（参考 DOM 初始为「适中」= 1） */
    const resolveFontSizeValue = (): string => {
      const size = currentStyle.fontSize;
      if (!(size > 0)) return '1';
      let hit = FONT_SIZE_OPTIONS[0];
      let diff = Number.POSITIVE_INFINITY;
      for (const option of FONT_SIZE_OPTIONS) {
        const current = Math.abs(Number(option.value) - size);
        if (current < diff) {
          diff = current;
          hit = option;
        }
      }
      return hit.value;
    };

    /** 字幕颜色 data-value（按色块十六进制值反查） */
    const resolveColorValue = (): string => {
      const color = (currentStyle.color ?? '').toLowerCase();
      return (
        COLOR_OPTIONS.find((option) => option.swatch?.toLowerCase() === color)?.value ??
        '16777215'
      );
    };

    /** 描边方式 data-value（按 strokeColor + strokeWidth 反查） */
    const resolveStrokeValue = (): string => {
      const color = (currentStyle.strokeColor ?? '').toLowerCase();
      const width = currentStyle.strokeWidth;
      return (
        STROKE_OPTIONS.find(
          (option) =>
            option.patch.strokeColor?.toLowerCase() === color &&
            option.patch.strokeWidth === width,
        )?.value ?? '0'
      );
    };

    /** 默认位置 data-value（position + offset 反查） */
    const resolvePositionValue = (): string => {
      const side = currentStyle.position === 'top' ? 'top' : 'bottom';
      const suffix =
        currentStyle.offset > 0 ? 'right' : currentStyle.offset < 0 ? 'left' : 'center';
      return `${side}-${suffix}`;
    };

    // ============================================
    // 下拉：命令式同步
    // ============================================

    /**
     * 把某个下拉同步到指定 data-value（选项高亮 + 结果文案 + 色块）
     * @param className - 下拉根节点类名
     * @param options - 选项列表
     * @param value - 目标 data-value
     */
    const syncSelect = (
      className: string,
      options: SubtitleSelectOption[],
      value: string,
    ): void => {
      const root = menuRef.value?.querySelector<HTMLElement>(`.${className}`);
      if (!root) return;
      const hit = options.find((option) => option.value === value) ?? options[0];
      if (!hit) return;
      root.querySelectorAll<HTMLElement>('.player-ctrl-subtitle-select-item').forEach((node) => {
        node.classList.toggle(
          'player-state-active',
          node.getAttribute('data-value') === hit.value,
        );
      });
      const result = root.querySelector<HTMLElement>('.player-ctrl-subtitle-select-result');
      if (!result) return;
      // 「字幕颜色」的结果区第一个子节点是 12px 色块（与参考 DOM 结构一致）
      const swatch = result.children.length > 1 ? result.children[0] : null;
      if (swatch instanceof HTMLElement && hit.swatch) {
        swatch.style.background = hit.swatch;
      }
      const label = result.lastElementChild;
      if (label) label.textContent = hit.label;
    };

    /** 同步全部下拉 */
    const syncSelects = (): void => {
      syncSelect(SELECT_CLASS.fontSize, FONT_SIZE_OPTIONS, resolveFontSizeValue());
      syncSelect(SELECT_CLASS.color, COLOR_OPTIONS, resolveColorValue());
      syncSelect(SELECT_CLASS.stroke, STROKE_OPTIONS, resolveStrokeValue());
      syncSelect(SELECT_CLASS.position, POSITION_OPTIONS, resolvePositionValue());
    };

    /** 同步「等比缩放 / 淡入淡出」两个原生勾选框 */
    const syncCheckboxes = (): void => {
      const menu = menuRef.value;
      if (!menu) return;
      menu
        .querySelectorAll<HTMLInputElement>('.player-ctrl-subtitle-checkbox-input')
        .forEach((input) => {
          const group = input.closest('.player-ctrl-subtitle-checkbox');
          if (group?.classList.contains('player-ctrl-subtitle-scale')) {
            input.checked = currentStyle.scale;
          } else if (group?.classList.contains('player-ctrl-subtitle-fade')) {
            input.checked = currentStyle.fade;
          }
        });
    };

    /**
     * 刷新「背景不透明度」的百分比文案、进度条与圆点位置
     * 圆点位移沿用参考 DOM 的实测公式：translateX(ratio × (轨道宽 - 圆点直径))
     * （参考 DOM：ratio=0.87、轨道 226px、圆点 12px → 186.18px）
     */
    const applyOpacity = (): void => {
      const menu = menuRef.value;
      if (!menu) return;
      const ratio = clamp(currentStyle.opacity, 0, 1);
      const percent = menu.querySelector<HTMLElement>('.player-ctrl-subtitle-opacity-percent');
      if (percent) percent.textContent = `${Math.round(ratio * 100)}%`;
      const bar = menu.querySelector<HTMLElement>('.player-ctrl-subtitle-slider-bar');
      if (bar) bar.style.transform = `scaleX(${ratio})`;
      const track = menu.querySelector<HTMLElement>('.player-ctrl-subtitle-slider-track');
      const thumb = menu.querySelector<HTMLElement>('.player-ctrl-subtitle-slider-thumb');
      if (track && thumb) {
        const width = track.getBoundingClientRect().width;
        thumb.style.transform = `translateX(${ratio * Math.max(width - THUMB_SIZE, 0)}px)`;
      }
    };

    /** 全量同步（结果区 + 选中态 + 下拉 + 勾选 + 滑条） */
    const applyAll = (): void => {
      applyResult();
      applyActive();
      syncSelects();
      syncCheckboxes();
      applyOpacity();
    };

    // ============================================
    // 交互：字幕开关 / 语言 / 双语 / 样式
    // ============================================

    /**
     * 设置字幕开关
     * @param next - 目标状态
     */
    const setVisible = (next: boolean): void => {
      if (visible !== next) {
        visible = next;
        lifecycle.emit?.('subtitleToggle', visible);
      }
      applyResult();
      applyActive();
    };

    /**
     * 设置双语开关
     * @param next - 是否开启双语
     */
    const setBilingual = (next: boolean): void => {
      bilingual = next;
      applyActive();
    };

    /**
     * 切换语言（选择语言即开启字幕，与参考 DOM「关闭 / 语言项」二选一的语义一致）
     * @param next - 目标语言
     */
    const setLang = (next: string): void => {
      lang = next;
      if (!visible) {
        visible = true;
        lifecycle.emit?.('subtitleToggle', visible);
      }
      applyResult();
      applyActive();
      lifecycle.emit?.('subtitleLangChange', next);
    };

    /**
     * 语言项点击
     * @param item - 被点语言项
     */
    const handleLangClick = (item: SubtitleLanguageOption): void => {
      setLang(item.lang);
    };

    /**
     * 双语开关变化（上 / 下两个开关共用）
     * @param event - change 事件
     */
    const handleBilingualChange = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      bilingual = target.checked;
      applyActive();
      lifecycle.emit?.('bilingualChange', bilingual);
    };

    /** 「关闭」行点击：关闭字幕 */
    const handleCloseClick = (): void => {
      setVisible(false);
    };

    /**
     * 等比缩放勾选变化
     * @param event - change 事件
     */
    const handleScaleChange = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      currentStyle = { ...currentStyle, scale: target.checked };
      emitStyle({ scale: currentStyle.scale });
    };

    /**
     * 淡入淡出勾选变化
     * @param event - change 事件
     */
    const handleFadeChange = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      currentStyle = { ...currentStyle, fade: target.checked };
      emitStyle({ fade: currentStyle.fade });
    };

    /** 恢复默认设置（只重置样式项，不动开关与语言） */
    const handleReset = (): void => {
      currentStyle = { ...DEFAULT_STYLE };
      syncSelects();
      syncCheckboxes();
      applyOpacity();
      emitStyle({
        fontSize: currentStyle.fontSize,
        color: currentStyle.color,
        position: currentStyle.position,
        offset: currentStyle.offset,
        strokeColor: currentStyle.strokeColor,
        strokeWidth: currentStyle.strokeWidth,
        opacity: currentStyle.opacity,
        scale: currentStyle.scale,
        fade: currentStyle.fade,
      });
    };

    // ============================================
    // 交互：下拉
    // ============================================

    /**
     * 关闭所有下拉
     * @param except - 保持展开的下拉根节点
     */
    const closeAllSelects = (except?: HTMLElement | null): void => {
      menuRef.value
        ?.querySelectorAll<HTMLElement>('.player-ctrl-subtitle-select')
        .forEach((root) => {
          if (root !== except) root.classList.remove('player-state-unfold');
        });
    };

    /** 点击面板空白处收起所有下拉 */
    const handleMenuClick = (): void => {
      closeAllSelects(null);
    };

    /**
     * 点击下拉头部：先收起其它下拉，再切换自身展开态
     * @param event - 点击事件
     */
    const handleSelectHeaderClick = (event: MouseEvent): void => {
      event.stopPropagation();
      const target = event.currentTarget;
      if (!(target instanceof HTMLElement)) return;
      const root = target.closest<HTMLElement>('.player-ctrl-subtitle-select');
      if (!root) return;
      closeAllSelects(root);
      root.classList.toggle('player-state-unfold');
    };

    /**
     * 点击下拉选项：组内互斥高亮 → 结果文案与色块 → 收起 → 下发补丁
     * @param item - 被点选项
     * @param event - 点击事件
     */
    const handleSelectItemClick = (item: SubtitleSelectOption, event: MouseEvent): void => {
      event.stopPropagation();
      const target = event.currentTarget;
      const root =
        target instanceof HTMLElement
          ? target.closest<HTMLElement>('.player-ctrl-subtitle-select')
          : null;
      if (root) {
        root
          .querySelectorAll<HTMLElement>('.player-ctrl-subtitle-select-item')
          .forEach((node) => {
            node.classList.toggle(
              'player-state-active',
              node.getAttribute('data-value') === item.value,
            );
          });
        const result = root.querySelector<HTMLElement>('.player-ctrl-subtitle-select-result');
        if (result) {
          const swatch = result.children.length > 1 ? result.children[0] : null;
          if (swatch instanceof HTMLElement && item.swatch) {
            swatch.style.background = item.swatch;
          }
          const label = result.lastElementChild;
          if (label) label.textContent = item.label;
        }
        root.classList.remove('player-state-unfold');
      }
      currentStyle = { ...currentStyle, ...item.patch };
      emitStyle(item.patch);
    };

    // ============================================
    // 交互：不透明度滑条
    // ============================================

    /**
     * 按鼠标横坐标设置不透明度（圆点中心跟随光标）
     * @param clientX - 鼠标视口横坐标
     */
    const setOpacityFromX = (clientX: number): void => {
      const track = menuRef.value?.querySelector<HTMLElement>(
        '.player-ctrl-subtitle-slider-track',
      );
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const usable = rect.width - THUMB_SIZE;
      if (usable <= 0) return;
      const ratio = clamp((clientX - rect.left - THUMB_SIZE / 2) / usable, 0, 1);
      currentStyle = { ...currentStyle, opacity: ratio };
      applyOpacity();
      emitStyle({ opacity: ratio });
    };

    /**
     * 按下滑条：立即定位并进入拖拽
     * @param event - 鼠标事件
     */
    const handleSliderMouseDown = (event: MouseEvent): void => {
      event.preventDefault();
      setOpacityFromX(event.clientX);

      const onMove = (moveEvent: MouseEvent): void => setOpacityFromX(moveEvent.clientX);
      const onUp = (): void => {
        if (dragMoveHandler) document.removeEventListener('mousemove', dragMoveHandler);
        if (dragUpHandler) document.removeEventListener('mouseup', dragUpHandler);
        dragMoveHandler = null;
        dragUpHandler = null;
      };
      dragMoveHandler = onMove;
      dragUpHandler = onUp;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    // ============================================
    // 交互：面板显隐 / 二级页
    // ============================================

    /** 回到第 1 页（移除 state-show-right，并把激活态收回第 1 页） */
    const showOriginPage = (): void => {
      const root = rootRef.value;
      root?.querySelector('.ui-area')?.classList.remove('state-show-right');
      root?.querySelectorAll<HTMLElement>('.player-ctrl-subtitle-panel-item').forEach((item, index) => {
        item.classList.toggle('player-state-active', index === 0);
      });
    };

    /** 鼠标进入按钮：下次打开固定从第 1 页（窄面板）开始，再延迟展开面板 */
    const handleMouseEnter = (): void => {
      showOriginPage();
      cancelRaf(hideTimer!);
      hideTimer = null;
      if (showTimer !== null) return;
      showTimer = rafTimeout(() => {
        showTimer = null;
        rootRef.value?.classList.toggle('state-show', true);
      }, 120);
    };

    /** 鼠标离开按钮：延迟收起面板（面板是按钮的后代，指针在面板内不会触发本回调） */
    const handleMouseLeave = (): void => {
      cancelRaf(showTimer!);
      showTimer = null;
      if (hideTimer !== null) return;
      hideTimer = rafTimeout(() => {
        hideTimer = null;
        rootRef.value?.classList.toggle('state-show', false);
      }, 220);
    };

    /** 点击「字幕设置」：滑出第 2 页（与 SettingMenu.handleMoreClick 同机制） */
    const handleSettingsEntry = (): void => {
      const root = rootRef.value;
      root?.querySelector('.ui-area')?.classList.add('state-show-right');
      root?.querySelectorAll<HTMLElement>('.player-ctrl-subtitle-panel-item').forEach((item, index) => {
        item.classList.toggle('player-state-active', index === 1);
      });
    };

    // ============================================
    // 渲染片段
    // ============================================

    /**
     * 语言项（主 / 副字幕列表共用，data-lan 为语言标识）
     * @param item - 语言项
     */
    const renderLangItem = (item: SubtitleLanguageOption): VNode =>
      h(
        'div',
        {
          class: 'player-ctrl-subtitle-language-item',
          'data-lan': item.lang,
          onClick: () => handleLangClick(item),
        },
        h('div', { class: 'player-ctrl-subtitle-language-item-text' }, item.label),
        h(
          'span',
          { class: 'player-ctrl-subtitle-language-item-icon' },
          SubtitleMarkIcon(),
        ),
      );

    /**
     * 双语字幕开关（参考 DOM 的 .bui-switch 结构，去掉 bui- 前缀改自写类名）
     * @param variantClass - -bilingual-above / -bilingual-bottom
     * @param hidden - 是否按参考 DOM 隐藏（上方那个开关在参考 DOM 中 display:none）
     */
    const renderBilingualSwitch = (variantClass: string, hidden: boolean): VNode =>
      h(
        'div',
        {
          class: `${variantClass} player-ctrl-subtitle-switch`,
          style: hidden ? { display: 'none' } : undefined,
        },
        h(
          'div',
          { class: 'player-ctrl-subtitle-switch-area' },
          h('input', {
            class: 'player-ctrl-subtitle-switch-input',
            type: 'checkbox',
            checked: bilingual,
            'aria-label': '双语字幕',
            onChange: handleBilingualChange,
          }),
          h(
            'label',
            { class: 'player-ctrl-subtitle-switch-label' },
            h('span', { class: 'player-ctrl-subtitle-switch-name' }, '双语字幕'),
            h(
              'span',
              { class: 'player-ctrl-subtitle-switch-body' },
              h('span', { class: 'player-ctrl-subtitle-switch-dot' }, h('span', {})),
            ),
          ),
        ),
      );

    /**
     * 自写下拉（参考 DOM 的 .bui-select 结构，去掉 bui- 前缀改自写类名）
     * @param options - 下拉渲染参数
     * @param options.className - 根节点附加类名（-fontsize-content 等）
     * @param options.value - 当前 data-value
     * @param options.items - 选项列表
     * @param options.withSwatch - 是否在结果区渲染 12px 色块（仅「字幕颜色」）
     */
    const renderSelect = (options: {
      className: string;
      value: string;
      items: SubtitleSelectOption[];
      withSwatch: boolean;
    }): VNode => {
      const hit = options.items.find((item) => item.value === options.value) ?? options.items[0];
      const swatchOf = (color?: string): VNode | null =>
        options.withSwatch ? h('span', { style: { background: color ?? '' } }) : null;

      return h(
        'div',
        { class: `player-ctrl-subtitle-select ${options.className}` },
        h(
          'div',
          { class: 'player-ctrl-subtitle-select-area' },
          h(
            'div',
            { class: 'player-ctrl-subtitle-select-wrap' },
            h(
              'div',
              { class: 'player-ctrl-subtitle-select-border' },
              h(
                'div',
                { class: 'player-ctrl-subtitle-select-header', onClick: handleSelectHeaderClick },
                h(
                  'span',
                  { class: 'player-ctrl-subtitle-select-result' },
                  swatchOf(hit?.swatch),
                  h('span', {}, hit ? hit.label : ''),
                ),
                h(
                  'span',
                  { class: 'player-ctrl-subtitle-select-arrow' },
                  h('span', { class: 'player-ctrl-subtitle-select-arrow-down' }),
                ),
              ),
              h(
                'div',
                { class: 'player-ctrl-subtitle-select-list-wrap' },
                h(
                  'ul',
                  { class: 'player-ctrl-subtitle-select-list' },
                  ...options.items.map((item) =>
                    h(
                      'li',
                      {
                        class:
                          item.value === hit?.value
                            ? 'player-ctrl-subtitle-select-item player-state-active'
                            : 'player-ctrl-subtitle-select-item',
                        'data-value': item.value,
                        onClick: (event: MouseEvent) => handleSelectItemClick(item, event),
                      },
                      swatchOf(item.swatch),
                      h('span', {}, item.label),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    };

    /**
     * 勾选行（等比缩放 / 淡入淡出，参考 DOM 的 .bui-checkbox 结构）
     * @param variantClass - -scale / -fade
     * @param label - 勾选项文案
     * @param checked - 初始是否勾选
     * @param onChange - 变化回调
     */
    const renderCheckbox = (
      variantClass: string,
      label: string,
      checked: boolean,
      onChange: (event: Event) => void,
    ): VNode =>
      h(
        'span',
        { class: `${variantClass} player-ctrl-subtitle-checkbox` },
        h(
          'div',
          { class: 'player-ctrl-subtitle-checkbox-area' },
          h('input', {
            class: 'player-ctrl-subtitle-checkbox-input',
            type: 'checkbox',
            checked,
            'aria-label': label,
            onChange,
          }),
          h(
            'label',
            { class: 'player-ctrl-subtitle-checkbox-label' },
            h(
              'span',
              {
                class:
                  'player-ctrl-subtitle-checkbox-icon player-ctrl-subtitle-checkbox-icon-default',
              },
              CheckboxDefaultIcon(),
            ),
            h(
              'span',
              {
                class:
                  'player-ctrl-subtitle-checkbox-icon player-ctrl-subtitle-checkbox-icon-selected',
              },
              CheckboxSelectedIcon(),
            ),
            h('span', { class: 'player-ctrl-subtitle-checkbox-name' }, label),
          ),
        ),
      );

    // ============================================
    // 状态订阅（框架无响应式，外部变化时命令式同步）
    // ============================================

    if (state) {
      useState(
        state,
        PlayerStateKeyEnum.SUBTITLE_VISIBLE,
        (next) => {
          if (typeof next !== 'boolean') return;
          visible = next;
          applyResult();
          applyActive();
        },
        lifecycle,
      );

      useState(
        state,
        PlayerStateKeyEnum.SUBTITLE_LANG,
        (next) => {
          if (typeof next !== 'string' || !next) return;
          lang = next;
          applyResult();
          applyActive();
        },
        lifecycle,
      );
    }

    // ============================================
    // 生命周期
    // ============================================

    lifecycle.onMounted = (): void => {
      applyAll();
      lifecycle.emit?.('subtitleMenuMounted', {
        setVisible,
        setBilingual,
        showOriginPage,
      } satisfies SubtitleMenuApi);
    };

    lifecycle.onBeforeDestroy = (): void => {
      if (dragMoveHandler) document.removeEventListener('mousemove', dragMoveHandler);
      if (dragUpHandler) document.removeEventListener('mouseup', dragUpHandler);
      dragMoveHandler = null;
      dragUpHandler = null;
    };

    // ============================================
    // 主渲染
    // ============================================

    return h(
      'div',
      {
        class: 'player-ctrl-btn player-ctrl-subtitle',
        role: 'button',
        'aria-label': '字幕',
        tabindex: '0',
        ref: 'subtitleRootRef',
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      },

      // ---------- 按钮结果区 ----------
      h(
        'div',
        { class: 'player-ctrl-subtitle-result-wrap' },
        h('div', { class: 'player-ctrl-subtitle-result' }, '字幕'),
        h(
          'span',
          {
            class: 'player-ctrl-subtitle-result-icon',
            style: { display: 'none' },
          },
          SubtitleMarkIcon(),
        ),
      ),

      // ---------- 面板 ----------
      h(
        'div',
        { class: 'player-ctrl-subtitle-box' },
        h(
          'div',
          {
            class: 'player-ctrl-subtitle-menu ui ui-panel ui-dark',
            ref: 'subtitleMenuRef',
            onClick: handleMenuClick,
          },
          h(
            'div',
            { class: 'ui-area' },
            h(
              'div',
              { class: 'ui-panel-wrap' },
              h(
                'div',
                { class: 'player-ctrl-subtitle-panel-move' },

                // ================= 第 1 页（窄） =================
                h(
                  'div',
                  { class: 'player-ctrl-subtitle-panel-item player-state-active' },
                  h(
                    'div',
                    { class: 'player-ctrl-subtitle-menu-left' },
                    h(
                      'div',
                      { class: 'player-ctrl-subtitle-menu-origin' },
                      h(
                        'div',
                        { class: 'player-ctrl-subtitle-title-area' },

                        // 标题行：字幕 / 添加字幕（参考 DOM 中「添加字幕」display:none）
                        h(
                          'div',
                          {
                            class:
                              'player-ctrl-subtitle-add-wrap player-ctrl-subtitle-item-flex',
                          },
                          h('div', { class: 'player-ctrl-subtitle-title' }, '字幕'),
                          h(
                            'div',
                            {
                              class: 'player-ctrl-subtitle-add',
                              style: { display: 'none' },
                            },
                            h('span', {}, '添加字幕'),
                          ),
                        ),

                        // 关闭
                        h(
                          'div',
                          {
                            class: 'player-ctrl-subtitle-close-switch player-state-active',
                            'data-action': 'close',
                            onClick: handleCloseClick,
                          },
                          '关闭',
                        ),

                        // 假开关（参考 DOM 中 display:none）
                        h(
                          'div',
                          {
                            class: 'player-ctrl-subtitle-fake-switch',
                            style: { display: 'none' },
                          },
                          h('div', { class: 'player-ctrl-subtitle-fake-switch-text' }, '关闭'),
                          h(
                            'span',
                            { class: 'player-ctrl-subtitle-fake-switch-icon' },
                            FakeSwitchIcon(),
                          ),
                        ),

                        // 上方分隔线 / 未登录提示 / 上方双语开关（参考 DOM 中均 display:none）
                        h('div', {
                          class: 'player-ctrl-subtitle-separator-above',
                          style: { display: 'none' },
                        }),
                        h(
                          'div',
                          {
                            class: 'player-ctrl-subtitle-language-unlogin',
                            style: { display: 'none' },
                          },
                          h(
                            'div',
                            { class: 'player-ctrl-subtitle-language-unlogin-content' },
                            '登录可享',
                          ),
                        ),
                        renderBilingualSwitch('player-ctrl-subtitle-bilingual-above', true),

                        // 语言列表：主字幕（副字幕区块在参考 DOM 中 display:none）
                        h(
                          'div',
                          { class: 'player-ctrl-subtitle-language' },
                          h(
                            'div',
                            {
                              class: 'player-ctrl-subtitle-nolan',
                              style: { display: 'none' },
                            },
                            '暂无字幕',
                          ),
                          h(
                            'div',
                            {
                              class: 'player-ctrl-subtitle-major',
                              style: { width: '100%' },
                            },
                            h(
                              'div',
                              {
                                class: 'player-ctrl-subtitle-major-title',
                                style: { display: 'none' },
                              },
                              '主字幕',
                            ),
                            h(
                              'div',
                              { class: 'player-ctrl-subtitle-major-content' },
                              h(
                                'div',
                                { class: 'player-ctrl-subtitle-major-inner' },
                                ...languages.map((item) => renderLangItem(item)),
                              ),
                            ),
                          ),
                          h(
                            'div',
                            {
                              class: 'player-ctrl-subtitle-minor',
                              style: { display: 'none' },
                            },
                            h('div', { class: 'player-ctrl-subtitle-minor-title' }, '副字幕'),
                            h(
                              'div',
                              { class: 'player-ctrl-subtitle-minor-content' },
                              h(
                                'div',
                                { class: 'player-ctrl-subtitle-minor-inner' },
                                ...languages.map((item) => renderLangItem(item)),
                              ),
                            ),
                          ),
                        ),

                        // 下方分隔线 / 双语字幕开关（参考 DOM 中可见的那个）/ 设置入口
                        h('div', { class: 'player-ctrl-subtitle-separator-bottom' }),
                        renderBilingualSwitch('player-ctrl-subtitle-bilingual-bottom', false),
                        h(
                          'div',
                          { class: 'player-ctrl-subtitle-setting', onClick: handleSettingsEntry },
                          h('span', { class: 'player-ctrl-subtitle-setting-text' }, '字幕设置'),
                          h(
                            'span',
                            { class: 'player-ctrl-subtitle-setting-icon' },
                            ChevronRightIcon(),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // ================= 第 2 页（更宽） =================
                h(
                  'div',
                  { class: 'player-ctrl-subtitle-panel-item' },
                  h(
                    'div',
                    { class: 'player-ctrl-subtitle-menu-right' },
                    h(
                      'div',
                      { class: 'player-ctrl-subtitle-settings-content' },
                      h(
                        'div',
                        { class: 'player-ctrl-subtitle-settings-scroller' },

                        // 字幕大小 / 字幕颜色
                        h(
                          'div',
                          {
                            class: 'player-ctrl-subtitle-item player-ctrl-subtitle-item-flex',
                          },
                          h(
                            'div',
                            { class: 'player-ctrl-subtitle-fontsize' },
                            h(
                              'div',
                              { class: 'player-ctrl-subtitle-fontsize-title' },
                              '字幕大小',
                            ),
                            renderSelect({
                              className: SELECT_CLASS.fontSize,
                              value: resolveFontSizeValue(),
                              items: FONT_SIZE_OPTIONS,
                              withSwatch: false,
                            }),
                          ),
                          h(
                            'div',
                            { class: 'player-ctrl-subtitle-color' },
                            h(
                              'div',
                              { class: 'player-ctrl-subtitle-color-title' },
                              '字幕颜色',
                            ),
                            renderSelect({
                              className: SELECT_CLASS.color,
                              value: resolveColorValue(),
                              items: COLOR_OPTIONS,
                              withSwatch: true,
                            }),
                          ),
                        ),

                        // 描边方式 / 默认位置
                        h(
                          'div',
                          {
                            class: 'player-ctrl-subtitle-item player-ctrl-subtitle-item-flex',
                          },
                          h(
                            'div',
                            { class: 'player-ctrl-subtitle-shadow' },
                            h(
                              'div',
                              { class: 'player-ctrl-subtitle-shadow-title' },
                              '描边方式',
                            ),
                            renderSelect({
                              className: SELECT_CLASS.stroke,
                              value: resolveStrokeValue(),
                              items: STROKE_OPTIONS,
                              withSwatch: false,
                            }),
                          ),
                          h(
                            'div',
                            { class: 'player-ctrl-subtitle-position' },
                            h(
                              'div',
                              { class: 'player-ctrl-subtitle-position-title' },
                              '默认位置',
                            ),
                            renderSelect({
                              className: SELECT_CLASS.position,
                              value: resolvePositionValue(),
                              items: POSITION_OPTIONS,
                              withSwatch: false,
                            }),
                          ),
                        ),

                        // 背景不透明度
                        h(
                          'div',
                          { class: 'player-ctrl-subtitle-item player-ctrl-subtitle-opacity' },
                          h(
                            'div',
                            { class: 'player-ctrl-subtitle-opacity-header' },
                            h(
                              'div',
                              { class: 'player-ctrl-subtitle-opacity-title' },
                              '背景不透明度',
                            ),
                            h(
                              'span',
                              { class: 'player-ctrl-subtitle-opacity-percent' },
                              `${Math.round(clamp(currentStyle.opacity, 0, 1) * 100)}%`,
                            ),
                          ),
                          h(
                            'div',
                            {
                              class:
                                'player-ctrl-subtitle-opacity-content player-ctrl-subtitle-slider',
                            },
                            h(
                              'div',
                              { class: 'player-ctrl-subtitle-slider-area' },
                              h(
                                'div',
                                {
                                  class: 'player-ctrl-subtitle-slider-track',
                                  onMouseDown: handleSliderMouseDown,
                                },
                                h(
                                  'div',
                                  { class: 'player-ctrl-subtitle-slider-bar-wrap' },
                                  h('div', {
                                    class: 'player-ctrl-subtitle-slider-bar',
                                    role: 'progressbar',
                                  }),
                                ),
                                h(
                                  'div',
                                  { class: 'player-ctrl-subtitle-slider-thumb' },
                                  h('div', { class: 'player-ctrl-subtitle-slider-thumb-dot' }),
                                ),
                              ),
                            ),
                          ),
                        ),

                        // 其它设置：等比缩放 / 淡入淡出
                        h(
                          'div',
                          { class: 'player-ctrl-subtitle-other' },
                          h('div', { class: 'player-ctrl-subtitle-other-title' }, '其它设置'),
                          h(
                            'div',
                            { class: 'player-ctrl-subtitle-other-content' },
                            renderCheckbox(
                              'player-ctrl-subtitle-scale',
                              '等比缩放',
                              currentStyle.scale,
                              handleScaleChange,
                            ),
                            renderCheckbox(
                              'player-ctrl-subtitle-fade',
                              '淡入淡出',
                              currentStyle.fade,
                              handleFadeChange,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // 底部：恢复默认设置
                    h(
                      'div',
                      { class: 'player-ctrl-subtitle-settings-footer' },
                      h('div', { class: 'player-ctrl-subtitle-separator' }),
                      h(
                        'div',
                        {
                          class: 'player-ctrl-subtitle-reset player-ctrl-subtitle-button',
                          onClick: handleReset,
                        },
                        h(
                          'div',
                          { class: 'player-ctrl-subtitle-button-area' },
                          h('span', {}, '恢复默认设置'),
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
