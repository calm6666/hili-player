/**
 * ============================================
 * 字幕设置面板组件 (SubtitleMenu)
 * ============================================
 * 结构对照 bilibili 播放器字幕设置面板真实 DOM（D:\Desktop\字幕设置-dom.txt），
 * 类名按本播放器约定改写：bpx-player-ctrl-subtitle-xxx → player-ctrl-subtitle-xxx，
 * bpx-state-active → player-state-active，bpx-state-show → state-show（另兼容 player-state-show）。
 *
 * 页签：
 *   - 第 1 页 .player-ctrl-subtitle-menu-origin：字幕开关 / 语言单选列表 / 双语开关 /
 *     「字幕设置」入口（点击后给 .ui-area 加 state-show-right，滑出第 2 页）
 *   - 第 2 页 .player-ctrl-subtitle-menu-right：字号 / 颜色 / 描边方式 / 默认位置 /
 *     背景不透明度 / 等比缩放 / 淡入淡出 / 恢复默认设置
 *   - 翻译页 .player-ctrl-subtitle-menu-translation：参考 DOM 中存在，但当前播放器
 *     没有原声翻译能力 → 【后端未接入】只做结构一致的静态禁用区块，不显示任何假数据。
 *
 * 框架无虚拟 DOM / 无响应式：所有节点用 h() 建立，状态变化时在 useState 回调里
 * 命令式改 DOM（参考 QualityMenu.renderQualities）。单选、滑块、复选、下拉均为本组件自写，
 * 只有开关复用项目既有 Switch 组件（原生 checkbox）。
 */

import { h, defineComponent, useTemplateRef, useState, useContext } from '@/core';
import type { VNode } from '@/types';
import { PlayerStateKeyEnum, StateContext } from '@/store/runtimeState';
import { Switch } from '@/hili-player/components/Switch';

// ============================================
// 对外接口（冻结，父层按此接线）
// ============================================

/** 字幕语言项 */
export interface SubtitleLanguageOption {
  /** 语言标识，如 'zh-CN' / 'en' */
  lang: string;
  /** 显示名，如 '简体中文' */
  label: string;
  /** 是否默认语言 */
  isDefault?: boolean;
}

/** 字幕样式补丁（只带变化的字段） */
export interface SubtitleStylePatch {
  fontSize?: number; // px
  color?: string;
  position?: 'top' | 'bottom';
  offset?: number; // 位置偏移
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
  /** 可选语言列表 */
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
  /** 面板 hover 显隐（必须发，父层用它做统一动画） */
  menuAnimation: (payload: { type: 'subtitle'; action: 'show' | 'hide' }) => void;
  /** 进入「更多设置」页（可选） */
  moreSettingClick?: () => void;
  /** 组件挂载完成（供父层获取命令式 API） */
  subtitleMenuMounted: SubtitleMenuApi;
}

/** 组件对外暴露的命令式 API（父层可通过 ref / subtitleMenuMounted 拿到） */
export interface SubtitleMenuApi {
  /** 设置字幕开关（同步体内 Switch 的视觉状态） */
  setVisible: (visible: boolean) => void;
  /** 设置双语开关（同步体内 Switch 的视觉状态） */
  setBilingual: (enabled: boolean) => void;
  /** 回到第 1 页（移除 state-show-right） */
  showOriginPage: () => void;
}

// ============================================
// 本地类型（避免改动共享 types / store 文件）
// ============================================


/** 下拉选项 */
interface SubtitleSelectOption {
  /** 选项值（与 SubtitleStylePatch 中对应字段同类型） */
  value: string | number;
  /** 选项文案 */
  label: string;
  /** 颜色色块（仅颜色下拉使用） */
  swatch?: string;
}

/** 复选行渲染参数 */
interface CheckboxRowOptions {
  /** 根节点类名 */
  className: string;
  /** 文案 */
  label: string;
  /** 初始是否勾选 */
  checked: boolean;
  /** 勾选变化回调 */
  onChange: (checked: boolean) => void;
}

/** 下拉渲染参数 */
interface SelectOptions {
  /** 根节点类名 */
  className: string;
  /** 初始选中值 */
  value: string | number | undefined;
  /** 选项列表 */
  options: SubtitleSelectOption[];
  /** 选中变化回调 */
  onChange: (value: string | number) => void;
}

// ============================================
// 常量：默认样式 / 预设项
// ============================================

/** 参考 DOM 中「恢复默认设置」的默认样式值（字号取适中 20px 作为基准） */
const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 20,
  color: '#ffffff',
  position: 'bottom',
  offset: 0,
  strokeColor: 'none',
  strokeWidth: 0,
  opacity: 0.87,
  scale: false,
  fade: false,
};

/**
 * 字幕字号档位（对照参考 DOM 的 最小/较小/适中/较大/最大）
 * 参考 DOM 用倍率（0.6/0.8/1/1.3/1.6）传给后端，本播放器接口为 px，
 * 故以 20px 为「适中」基准等比换算。
 */
const FONT_SIZE_OPTIONS: SubtitleSelectOption[] = [
  { value: 12, label: '最小' },
  { value: 16, label: '较小' },
  { value: 20, label: '适中' },
  { value: 26, label: '较大' },
  { value: 32, label: '最大' },
];

/** 字幕颜色档位（对照参考 DOM 的 7 个色值） */
const COLOR_OPTIONS: SubtitleSelectOption[] = [
  { value: '#ffffff', label: '白色', swatch: '#ffffff' },
  { value: '#F44336', label: '红色', swatch: '#F44336' },
  { value: '#9C27B0', label: '紫色', swatch: '#9C27B0' },
  { value: '#673AB7', label: '深紫色', swatch: '#673AB7' },
  { value: '#3F51B5', label: '靛青色', swatch: '#3F51B5' },
  { value: '#2196F3', label: '蓝色', swatch: '#2196F3' },
  { value: '#03A9F4', label: '亮蓝色', swatch: '#03A9F4' },
];

/**
 * 描边方式档位（对照参考 DOM 的 无描边/重墨/描边/45°投影）
 * 参考 DOM 用 0/1/2/3 的枚举，本播放器接口为 strokeColor + strokeWidth，
 * 故每一档映射为一组 strokeColor/strokeWidth 补丁。
 */
const STROKE_OPTIONS: SubtitleSelectOption[] = [
  { value: 'none', label: '无描边' },
  { value: 'heavy', label: '重墨' },
  { value: 'outline', label: '描边' },
  { value: 'projection', label: '45°投影' },
];

/** 描边档位 → 样式补丁（值域来自参考 DOM 的枚举语义） */
const STROKE_PATCH: Record<string, SubtitleStylePatch> = {
  none: { strokeColor: 'none', strokeWidth: 0 },
  heavy: { strokeColor: '#000000', strokeWidth: 4 },
  outline: { strokeColor: '#000000', strokeWidth: 2 },
  projection: { strokeColor: '#000000', strokeWidth: 1 },
};

/** 描边补丁 → 下拉值（依据 style.strokeColor / strokeWidth 反向匹配） */
const resolveStrokeKey = (style: SubtitleStyle): string => {
  if (style.strokeColor === 'none' || !style.strokeWidth) return 'none';
  if (style.strokeWidth >= 4) return 'heavy';
  if (style.strokeWidth >= 2) return 'outline';
  return 'projection';
};

/**
 * 默认位置档位（对照参考 DOM 的 6 个位置）
 * 本播放器接口为 position('top'|'bottom') + offset(数字偏移)，
 * 故左/居中/右映射为 offset -1 / 0 / 1，选中时同时下发 position 与 offset。
 */
const POSITION_OPTIONS: SubtitleSelectOption[] = [
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-center', label: '底部居中' },
  { value: 'bottom-right', label: '右下角' },
  { value: 'top-left', label: '左上角' },
  { value: 'top-center', label: '顶部居中' },
  { value: 'top-right', label: '右上角' },
];

/** 位置档位 → 样式补丁 */
const POSITION_PATCH: Record<string, SubtitleStylePatch> = {
  'bottom-left': { position: 'bottom', offset: -1 },
  'bottom-center': { position: 'bottom', offset: 0 },
  'bottom-right': { position: 'bottom', offset: 1 },
  'top-left': { position: 'top', offset: -1 },
  'top-center': { position: 'top', offset: 0 },
  'top-right': { position: 'top', offset: 1 },
};

/** 样式 → 位置下拉值（反向匹配） */
const resolvePositionKey = (style: SubtitleStyle): string => {
  const side = style.position === 'top' ? 'top' : 'bottom';
  const offset = style.offset > 0 ? 'right' : style.offset < 0 ? 'left' : 'center';
  return `${side}-${offset}`;
};

// ============================================
// 图标（逐条取自参考 DOM，图标一律走 SVG，禁止 unicode）
// ============================================

/** 结果区字幕标记图标（参考 DOM .player-ctrl-subtitle-result-wrap 内的 A 标记图标） */
const SubtitleMarkIcon: string = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" data-pointer="none" viewBox="0 0 14 12"><rect width="13.5" height="11.5" x=".25" y=".25" stroke="#fff" stroke-opacity=".5" stroke-width=".5" rx="5.75"></rect><path fill="currentColor" d="M5.248 2.788h.76L8.256 8.5h-.712l-.608-1.6H4.312l-.608 1.6H3l2.248-5.712Zm-.728 3.56h2.208l-1.08-2.856h-.032L4.52 6.348Zm4.362-3.56h.648V8.5h-.648V2.788Z"></path></svg>`;

/** 语言项 / 横向下拉项箭头（参考 DOM 的右尖角图标） */
const ChevronRightIcon: string = `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" data-pointer="none" viewBox="0 0 16 16"><path fill="currentColor" d="m9.188 7.999-3.359 3.359a.75.75 0 1 0 1.061 1.061l3.889-3.889a.75.75 0 0 0 0-1.061L6.89 3.58a.75.75 0 1 0-1.061 1.061l3.359 3.358z"></path></svg>`;

/** 禁用态提示（参考 DOM 的 fake-switch 问号图标） */
const InfoIcon: string = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" data-pointer="none" viewBox="0 0 12 12"><path fill="currentColor" d="M6 1.875a4.125 4.125 0 1 0 0 8.25 4.125 4.125 0 0 0 0-8.25ZM.875 6a5.125 5.125 0 1 1 10.25 0A5.125 5.125 0 0 1 .875 6Z"></path><path fill="currentColor" d="M6 3.5a.5.5 0 0 1 .5.5v2.25a.5.5 0 1 1-1 0V4a.5.5 0 0 1 .5-.5ZM6 7.25a.5.5 0 0 1 .5.5v.125a.5.5 0 1 1-1 0V7.75a.5.5 0 0 1 .5-.5Z"></path></svg>`;

/** 复选未选中图标（参考 DOM checkbox-icon-default） */
const CheckboxDefaultIcon: string = `<svg xmlns="http://www.w3.org/2000/svg" data-pointer="none" viewBox="0 0 32 32"><path fill="currentColor" d="M8 6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8zm0-2h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z"></path></svg>`;

/** 复选选中图标（参考 DOM checkbox-icon-selected） */
const CheckboxSelectedIcon: string = `<svg xmlns="http://www.w3.org/2000/svg" data-pointer="none" viewBox="0 0 32 32"><path fill="currentColor" d="m13 18.25-1.8-1.8c-.6-.6-1.65-.6-2.25 0s-.6 1.5 0 2.25l2.85 2.85c.318.318.762.468 1.2.448.438.02.882-.13 1.2-.448l8.85-8.85c.6-.6.6-1.65 0-2.25s-1.65-.6-2.25 0l-7.8 7.8zM8 4h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z"></path></svg>`;

/** 面板显隐延迟（与 Controls.handleMenuAnimation 的 300ms 一致） */
const MENU_DELAY = 300;

// ============================================
// 组件实现
// ============================================

/**
 * SubtitleMenu 组件
 * 渲染字幕设置面板（第 1 页 origin / 第 2 页 right / 翻译页占位）
 */
export const SubtitleMenu = defineComponent<SubtitleMenuProps, SubtitleMenuEvents>((props, lifecycle) => {
  const state = useContext(StateContext);

  // ============================================
  // Props 初值
  // ============================================

  /** 初始语言列表 */
  const languages: SubtitleLanguageOption[] = props.languages ?? [];

  /** 初始样式（缺字段回落到默认样式） */
  const style: SubtitleStyle = { ...DEFAULT_STYLE, ...(props.style ?? {}) };

  /** 当前字幕开关（同时作为组件内部真值，外部 state 变化会同步） */
  let visible: boolean = props.visible ?? true;

  /** 当前字幕语言 */
  let lang: string = props.lang ?? '';

  /** 当前双语开关 */
  let bilingual: boolean = props.bilingual ?? false;

  /** 当前样式值（命令式回显 / 重置用） */
  let currentStyle: SubtitleStyle = { ...style };

  /** 面板显隐定时器 */
  let menuTimer: ReturnType<typeof setTimeout> | null = null;

  /** 已挂载的 Switch 根元素（用于外部状态变化时同步视觉状态） */
  const switchRoots: (HTMLElement | null)[] = [null, null];

  /** Switch 下标：字幕开关 */
  const SWITCH_VISIBLE = 0;

  /** Switch 下标：双语开关 */
  const SWITCH_BILINGUAL = 1;

  // ============================================
  // DOM 引用
  // ============================================

  /** 根节点（面板显隐类挂载点，父层也会在此加 state-show） */
  const rootRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleRootRef');

  /** 结果区文本 */
  const resultRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleResultRef');

  /** 语言列表容器 */
  const langListRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleLangListRef');

  /** 「关闭」（不显示字幕）行 */
  const closeRowRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleCloseRowRef');

  /** 字号下拉 */
  const fontSizeSelectRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleFontSizeRef');

  /** 颜色下拉 */
  const colorSelectRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleColorRef');

  /** 描边下拉 */
  const strokeSelectRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleStrokeRef');

  /** 位置下拉 */
  const positionSelectRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitlePositionRef');

  /** 不透明度标题右侧百分比文本 */
  const opacityPercentRef = useTemplateRef<HTMLSpanElement>(lifecycle, 'subtitleOpacityPercentRef');

  /** 不透明度滑块进度条 */
  const opacityBarRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleOpacityBarRef');

  /** 不透明度滑块手柄 */
  const opacityThumbRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleOpacityThumbRef');

  /** 不透明度滑块可拖拽区域 */
  const opacityTrackRef = useTemplateRef<HTMLDivElement>(lifecycle, 'subtitleOpacityTrackRef');

  /** 等比缩放复选框 input */
  const scaleInputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'subtitleScaleInputRef');

  /** 淡入淡出复选框 input */
  const fadeInputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'subtitleFadeInputRef');

  // ============================================
  // 通用工具
  // ============================================


  /** 以 vnode 形式渲染图标（可挂 ref / data-* 属性） */
  const iconVNode = (svg: string, className: string, extraAttrs?: Record<string, unknown>): VNode => {
    // 图标以 VNode 形式渲染（innerHTML 直接注入 svg 字符串）；
    // 不要再先建真实 DOM 再 materialize —— materialize 的方向是 VNode → DOM
    return h('span', { class: className, innerHTML: svg, ...(extraAttrs ?? {}) });
  };

  /** 数值裁剪 */
  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

  /** 下发样式补丁 */
  const emitStyle = (patch: SubtitleStylePatch): void => {
    lifecycle.emit?.('subtitleStyleChange', patch);
  };

  // ============================================
  // 结果区 / 选中态
  // ============================================

  /** 命中当前语言项（无命中时返回 undefined） */
  const currentLangOption = (): SubtitleLanguageOption | undefined =>
    languages.find((item) => item.lang === lang);

  /** 刷新根节点激活态与结果区文案 */
  const applyResult = (): void => {
    const root = rootRef.value;
    if (root) {
      root.classList.toggle('player-state-active', visible);
    }
    if (!resultRef.value) return;
    if (!visible) {
      resultRef.value.textContent = '字幕';
      return;
    }
    const hit = currentLangOption();
    resultRef.value.textContent = hit ? hit.label : '字幕';
  };

  /** 刷新语言列表选中态（player-state-active 互斥，含「关闭」行） */
  const applyLangActive = (): void => {
    // 「关闭」行：字幕整体关闭时选中
    closeRowRef.value?.classList.toggle('player-state-active', !visible);
    // 语言行：字幕开启且语言命中时选中
    langListRef.value
      ?.querySelectorAll<HTMLDivElement>('.player-ctrl-subtitle-language-item')
      .forEach((el) => {
        that: {
          el.classList.toggle(
            'player-state-active',
            visible && el.getAttribute('data-lan') === lang,
          );
        }
      });
  };

  /** 刷新字幕开关 Switch 的视觉状态 */
  const applySwitchChecked = (index: number, checked: boolean): void => {
    const root = switchRoots[index];
    if (!root) return;
    const input = root.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (input) input.checked = checked;
    root.classList.toggle('switch-checked', checked);
  };

  /** 全量刷新（可见 / 语言 / 双语 / 结果文案） */
  const applyAll = (): void => {
    applyResult();
    applyLangActive();
    applySwitchChecked(SWITCH_VISIBLE, !visible ? false : true);
    applySwitchChecked(SWITCH_BILINGUAL, bilingual);
  };

  // ============================================
  // 字幕开关 / 语言
  // ============================================

  /**
   * 字幕开关变化（关闭行点击 / Switch 变化统一走这里）
   * @param next - 目标开关状态
   */
  const setVisible = (next: boolean): void => {
    if (visible === next) {
      // 状态未变也要刷新一次视觉，避免外部切换后 UI 滞留
      applyAll();
      return;
    }
    visible = next;
    applyAll();
    lifecycle.emit?.('subtitleToggle', visible);
  };

  /**
   * 语言切换
   * @param next - 目标语言
   */
  /**
   * 外部同步「双语字幕」开关（同步内部状态与体内 Switch 的视觉状态）
   * @param enabled - 是否开启双语字幕
   */
  const setBilingual = (enabled: boolean): void => {
    bilingual = enabled;
    applySwitchChecked(SWITCH_BILINGUAL, enabled);
  };

  const setLang = (next: string): void => {
    lang = next;
    applyAll();
    lifecycle.emit?.('subtitleLangChange', next);
  };

  // ============================================
  // 下拉（自写，无第三方库、无 bui- 类名）
  // ============================================

  /**
   * 关闭所有下拉
   * @param except - 保持展开的下拉
   */
  const closeAllSelects = (except?: HTMLElement | null): void => {
    [fontSizeSelectRef, colorSelectRef, strokeSelectRef, positionSelectRef].forEach((ref) => {
      const el = ref.value;
      if (!el || el === except) return;
      el.classList.remove('player-ctrl-subtitle-select-unfold');
    });
  };

  /**
   * 构建一个自写下拉
   * @param options - 下拉参数
   * @returns 下拉根节点 VNode
   */
  /**
   * 构建一个自写下拉（**纯 VNode 版**）
   *
   * 说明（为什么必须这样写）：
   * - 本框架 `h(tag, attrs, ...children)` 的 children **只接受 `string | VNode`**，
   *   不能把 `document.createElement()` 得到的真实元素塞进去；
   * - `materialize()` 的方向是「VNode → 真实 DOM」，**不能反向**把 DOM 变成 VNode；
   * - 因此下拉用 VNode 构建，交互事件通过 attrs 的 `onClick` 挂载，
   *   运行时再用 `event.currentTarget` 取到真实元素做展开/收起与文案更新。
   *
   * @param options - 下拉参数
   * @returns 下拉根节点 VNode
   */
  const renderSelect = (options: SelectOptions): VNode => {
    const options_: SubtitleSelectOption[] = options.options;
    const hit = options_.find((item) => item.value === options.value) ?? options_[0];

    /**
     * 点击头部：收起其它下拉后切换本下拉的展开态
     * @param event - 点击事件
     */
    const handleHeaderClick = (event: MouseEvent): void => {
      event.stopPropagation();
      const root = event.currentTarget as HTMLElement | null;
      if (!root) return;
      closeAllSelects(root);
      root.classList.toggle(
        'player-ctrl-subtitle-select-unfold',
        !root.classList.contains('player-ctrl-subtitle-select-unfold'),
      );
    };

    /**
     * 点击选项：组内互斥选中 → 更新头部色块与文案 → 收起 → 回调
     * @param value - 选项值
     * @param item - 选项数据
     * @param event - 点击事件
     */
    const handleItemClick = (
      value: string | number,
      item: SubtitleSelectOption,
      event: MouseEvent,
    ): void => {
      event.stopPropagation();
      const li = event.currentTarget as HTMLElement | null;
      const root = li?.closest<HTMLElement>('.player-ctrl-subtitle-select');
      if (!root) return;

      root
        .querySelectorAll('.player-ctrl-subtitle-select-item')
        .forEach((node) => node.classList.remove('player-state-active'));
      li?.classList.add('player-state-active');

      const header = root.querySelector<HTMLElement>('.player-ctrl-subtitle-select-header');
      const result = root.querySelector<HTMLElement>('.player-ctrl-subtitle-select-result');
      const prevSwatch = header?.querySelector('.player-ctrl-subtitle-select-swatch');
      if (prevSwatch) prevSwatch.remove();
      if (header && result && item.swatch) {
        const swatch = document.createElement('span');
        swatch.className = 'player-ctrl-subtitle-select-swatch';
        swatch.style.background = item.swatch;
        header.insertBefore(swatch, result);
      }
      if (result) result.textContent = item.label;

      root.classList.remove('player-ctrl-subtitle-select-unfold');
      options.onChange(value);
    };

    return h(
      'div',
      { class: `player-ctrl-subtitle-select ${options.className}` },
      h(
        'div',
        { class: 'player-ctrl-subtitle-select-header', onClick: handleHeaderClick },
        ...(hit?.swatch
          ? [
              h('span', {
                class: 'player-ctrl-subtitle-select-swatch',
                style: { background: hit.swatch },
              }),
            ]
          : []),
        h('span', { class: 'player-ctrl-subtitle-select-result' }, hit ? hit.label : ''),
        h('span', {
          class: 'player-ctrl-subtitle-select-arrow',
          innerHTML:
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" data-pointer="none" viewBox="0 0 16 16"><path fill="currentColor" d="m4.75 6.5 3.25 3.25L11.25 6.5z"></path></svg>',
        }),
      ),
      h(
        'ul',
        { class: 'player-ctrl-subtitle-select-list' },
        ...options_.map((item) =>
          h(
            'li',
            {
              class: [
                'player-ctrl-subtitle-select-item',
                item.value === hit?.value ? 'player-state-active' : '',
              ]
                .filter(Boolean)
                .join(' '),
              'data-value': String(item.value),
              onClick: (e: MouseEvent) => handleItemClick(item.value, item, e),
            },
            ...(item.swatch
              ? [
                  h('span', {
                    class: 'player-ctrl-subtitle-select-swatch',
                    style: { background: item.swatch },
                  }),
                ]
              : []),
            h('span', { class: 'player-ctrl-subtitle-select-item-text' }, item.label),
          ),
        ),
      ),
    );
  };


  /**
   * 外部同步下拉当前值（重置 / 外部样式变化时回显）
   * @param selectRoot - 下拉根节点
   * @param options - 选项列表
   * @param value - 目标值
   */
  const syncSelectValue = (
    selectRoot: HTMLElement | null,
    options: SubtitleSelectOption[],
    value: string | number,
  ): void => {
    if (!selectRoot) return;
    const hit = options.find((item) => item.value === value);
    const result = selectRoot.querySelector<HTMLElement>('.player-ctrl-subtitle-select-result');
    if (result && hit) result.textContent = hit.label;
    selectRoot
      .querySelectorAll<HTMLLIElement>('.player-ctrl-subtitle-select-item')
      .forEach((li) => {
        li.classList.toggle('player-state-active', li.getAttribute('data-value') === String(value));
      });
    const header = selectRoot.querySelector<HTMLElement>('.player-ctrl-subtitle-select-header');
    if (!header) return;
    header.querySelector('.player-ctrl-subtitle-select-swatch')?.remove();
    if (hit?.swatch && result) {
      const swatch = document.createElement('span');
      swatch.className = 'player-ctrl-subtitle-select-swatch';
      swatch.style.background = hit.swatch;
      header.insertBefore(swatch, result);
    }
  };

  // ============================================
  // 滑块（自写，ui-slider 基元风格）
  // ============================================

  /**
   * 刷新不透明度 UI
   * @param value - 0~1
   */
  const applyOpacity = (value: number): void => {
    const ratio = clamp(value, 0, 1);
    if (opacityBarRef.value) {
      opacityBarRef.value.style.transform = `scaleX(${ratio})`;
    }
    if (opacityThumbRef.value) {
      opacityThumbRef.value.style.left = `${ratio * 100}%`;
    }
    if (opacityPercentRef.value) {
      opacityPercentRef.value.textContent = `${Math.round(ratio * 100)}%`;
    }
  };

  /**
   * 按鼠标 X 计算不透明度并下发
   * @param clientX - 鼠标 X 坐标
   */
  const setOpacityFromX = (clientX: number): void => {
    const track = opacityTrackRef.value;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    currentStyle.opacity = Math.round(ratio * 100) / 100;
    applyOpacity(currentStyle.opacity);
    emitStyle({ opacity: currentStyle.opacity });
  };

  /** 滑块按下：拖拽直到 mouseup */
  const handleOpacityMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    setOpacityFromX(event.clientX);
    const onMove = (e: MouseEvent): void => setOpacityFromX(e.clientX);
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ============================================
  // 复选（自写，原生 checkbox + 对勾图标）
  // ============================================

  /**
   * 构建一行自写复选（对应参考 DOM 的 bui-checkbox 结构）
   * @param options - 复选参数
   * @returns 复选根节点 VNode
   */
  const renderCheckbox = (options: CheckboxRowOptions): VNode => {
    const inputRefKey = `subtitle-${options.className}-input`;
    const input = h('input', {
      class: 'player-ctrl-subtitle-checkbox-input',
      type: 'checkbox',
      checked: options.checked,
      'aria-label': options.label,
      ref: inputRefKey,
      onChange: (event: Event) => {
        if (!(event.target instanceof HTMLInputElement)) return;
        options.onChange(event.target.checked);
      },
    });
    void inputRefKey;
    return h('div', { class: `player-ctrl-subtitle-checkbox ${options.className}` },
      input,
      h('label', { class: 'player-ctrl-subtitle-checkbox-label' },
        h('span', {
          class: 'player-ctrl-subtitle-checkbox-icon player-ctrl-subtitle-checkbox-icon-default',
          innerHTML: CheckboxDefaultIcon,
        }),
        h('span', {
          class: 'player-ctrl-subtitle-checkbox-icon player-ctrl-subtitle-checkbox-icon-selected',
          innerHTML: CheckboxSelectedIcon,
        }),
        h('span', { class: 'player-ctrl-subtitle-checkbox-name' }, options.label),
      ),
    );
  };

  // ============================================
  // 面板显隐（沿用统一 state-show 机制 + 300ms 延迟）
  // ============================================

  /** 应用面板显隐（内部类，与父层写入的 state-show 效果一致） */
  const applyMenuShow = (show: boolean): void => {
    rootRef.value?.classList.toggle('player-state-show', show);
  };

  /**
   * 面板 hover 显隐入口
   * @param action - show / hide
   */
  const handleMenuAnimation = (action: 'show' | 'hide'): void => {
    if (menuTimer !== null) clearTimeout(menuTimer);
    menuTimer = setTimeout(() => {
      applyMenuShow(action === 'show');
    }, MENU_DELAY);
    lifecycle.emit?.('menuAnimation', { type: 'subtitle', action });
  };

  // ============================================
  // 「字幕设置」 → 滑出第 2 页
  // ============================================

  /**
   * 点击「字幕设置」：给 .ui-area 加 state-show-right（与 SettingMenu.handleMoreClick 完全一致），
   * 由本组件 scss 的 expandWidth / expandWidthIn 动画向右滑出第 2 页。
   */
  const handleSettingsEntry = (): void => {
    rootRef.value
      ?.querySelector('.ui-area')
      ?.classList.add('state-show-right');
    lifecycle.emit?.('moreSettingClick');
  };

  /** 回到第 1 页 */
  const showOriginPage = (): void => {
    rootRef.value
      ?.querySelector('.ui-area')
      ?.classList.remove('state-show-right');
  };

  // ============================================
  // 重置
  // ============================================

  /** 恢复默认字幕样式（只重置样式项，不改变开关与语言） */
  const handleReset = (): void => {
    currentStyle = { ...DEFAULT_STYLE };
    syncSelectValue(fontSizeSelectRef.value, FONT_SIZE_OPTIONS, currentStyle.fontSize);
    syncSelectValue(colorSelectRef.value, COLOR_OPTIONS, currentStyle.color);
    syncSelectValue(strokeSelectRef.value, STROKE_OPTIONS, resolveStrokeKey(currentStyle));
    syncSelectValue(positionSelectRef.value, POSITION_OPTIONS, resolvePositionKey(currentStyle));
    applyOpacity(currentStyle.opacity);
    if (scaleInputRef.value) {
      scaleInputRef.value.checked = currentStyle.scale;
    }
    if (fadeInputRef.value) {
      fadeInputRef.value.checked = currentStyle.fade;
    }
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
  // 状态订阅（框架无响应式，变化时命令式改 DOM）
  // ============================================

  if (state) {
    useState(
      state,
      PlayerStateKeyEnum.SUBTITLE_VISIBLE,
      (next) => {
        if (typeof next !== 'boolean' || next === visible) return;
        visible = next;
        applyAll();
      },
      lifecycle,
    );

    useState(
      state,
      PlayerStateKeyEnum.SUBTITLE_LANG,
      (next) => {
        if (typeof next !== 'string' || !next || next === lang) return;
        lang = next;
        applyAll();
      },
      lifecycle,
    );
  }

  // ============================================
  // 生命周期
  // ============================================

  lifecycle.onMounted = (): void => {
    // 挂载后再同步一次 Switch 视图（Switch 子组件在父 onMounted 之前已挂载完成）
    applyAll();
    // 回显样式项初值
    applyOpacity(currentStyle.opacity);
    lifecycle.emit?.('subtitleMenuMounted', {
      setVisible,
      setBilingual,
      showOriginPage,
    } satisfies SubtitleMenuApi);
  };

  lifecycle.onBeforeDestroy = (): void => {
    if (menuTimer !== null) clearTimeout(menuTimer);
    menuTimer = null;
  };

  // ============================================
  // 语言项渲染
  // ============================================

  /**
   * 构建一个语言单选项
   * @param option - 语言项
   * @returns 语言项 VNode
   */
  const renderLangItem = (option: SubtitleLanguageOption): VNode =>
    h('div', {
      class: 'player-ctrl-subtitle-language-item',
      'data-lan': option.lang,
      onClick: () => setLang(option.lang),
    },
      h('div', { class: 'player-ctrl-subtitle-language-item-text' }, option.label),
      iconVNode(ChevronRightIcon, 'player-ctrl-subtitle-language-item-icon'),
    );

  // ============================================
  // 主渲染
  // ============================================

  return h('div', {
    class: 'player-ctrl-btn player-ctrl-subtitle',
    role: 'button',
    'aria-label': '字幕',
    tabindex: '0',
    ref: 'subtitleRootRef',
    onMouseEnter: () => handleMenuAnimation('show'),
    onMouseLeave: () => handleMenuAnimation('hide'),
  },
    // ---------- 结果区 ----------
    h('div', { class: 'player-ctrl-subtitle-result-wrap' },
      h('div', { class: 'player-ctrl-subtitle-result', ref: 'subtitleResultRef' }, '字幕'),
      iconVNode(SubtitleMarkIcon, 'player-ctrl-subtitle-result-icon'),
    ),

    // ---------- 面板 ----------
    h('div', { class: 'player-ctrl-subtitle-box' },
      h('div', {
        class: 'player-ctrl-subtitle-menu ui ui-panel ui-dark',
        onClick: () => closeAllSelects(null),
      },
        h('div', { class: 'ui-area' },
          h('div', { class: 'ui-panel-wrap' },
            // ============ 第 1 页：origin ============
            h('div', { class: 'player-ctrl-subtitle-menu-origin' },
              h('div', { class: 'player-ctrl-subtitle-title-area' },
                h('div', { class: 'player-ctrl-subtitle-item-flex' },
                  h('div', { class: 'player-ctrl-subtitle-title' }, '字幕'),
                  // 「关闭」等价于字幕开关关闭，选中态 player-state-active
                  h('div', {
                    class: 'player-ctrl-subtitle-close-switch',
                    'data-action': 'close',
                    ref: 'subtitleCloseRowRef',
                    onClick: () => setVisible(false),
                  }, '关闭'),
                ),
                // 上传入口：参考 DOM 中默认隐藏，当前播放器无字幕上传能力 → 常驻隐藏
                h('div', { class: 'player-ctrl-subtitle-add', style: { display: 'none' } },
                  h('span', {}, '添加字幕'),
                ),
              ),

              // 双语开关（第 1 页上方）：复用项目既有 Switch（原生 checkbox）
              h('div', { class: 'player-ctrl-subtitle-bilingual-above' },
                h('span', { class: 'player-ctrl-subtitle-bilingual-name' }, '双语字幕'),
                h(Switch, {
                  size: 'small',
                  checked: bilingual,
                  ref: (el: unknown) => {
                    switchRoots[SWITCH_BILINGUAL] = el instanceof HTMLElement ? el : null;
                  },
                  onChange: (checked: boolean) => {
                    bilingual = checked;
                    lifecycle.emit?.('bilingualChange', checked);
                  },
                }),
              ),

              // 语言列表（单选）
              h('div', { class: 'player-ctrl-subtitle-language' },
                h('div', { class: 'player-ctrl-subtitle-nolan', style: { display: 'none' } }, '暂无字幕'),
                h('div', { class: 'player-ctrl-subtitle-major' },
                  h('div', { class: 'player-ctrl-subtitle-major-content', ref: 'subtitleLangListRef' },
                    ...languages.map((option) => renderLangItem(option)),
                  ),
                ),
              ),

              h('div', { class: 'player-ctrl-subtitle-separator-bottom' }),

              // 双语开关（第 1 页底部，与参考 DOM 一致的第二处开关）
              h('div', { class: 'player-ctrl-subtitle-bilingual-bottom' },
                h('span', { class: 'player-ctrl-subtitle-bilingual-name' }, '双语字幕'),
                h(Switch, {
                  size: 'small',
                  checked: bilingual,
                  ref: (el: unknown) => {
                    switchRoots[SWITCH_BILINGUAL] = el instanceof HTMLElement ? el : null;
                    // 底部开关与顶部开关指向同一状态，同步视图
                    if (el instanceof HTMLElement) {
                      el.classList.toggle('switch-checked', bilingual);
                    }
                  },
                  onChange: (checked: boolean) => {
                    bilingual = checked;
                    lifecycle.emit?.('bilingualChange', checked);
                  },
                }),
              ),

              // 「字幕设置」入口 → 向右滑出第 2 页
              h('div', {
                class: 'player-ctrl-subtitle-setting player-ctrl-subtitle-settings-entry',
                onClick: handleSettingsEntry,
              },
                h('span', { class: 'player-ctrl-subtitle-setting-text' }, '字幕设置'),
                iconVNode(ChevronRightIcon, 'player-ctrl-subtitle-setting-icon'),
              ),
            ),

            // ============ 第 2 页：更多设置 ============
            h('div', { class: 'player-ctrl-subtitle-menu-right' },
              h('div', { class: 'player-ctrl-subtitle-settings-content' },
                h('div', { class: 'player-ctrl-subtitle-settings-scroller' },

                  // 字号 + 颜色
                  h('div', { class: 'player-ctrl-subtitle-item player-ctrl-subtitle-item-flex' },
                    h('div', { class: 'player-ctrl-subtitle-fontsize' },
                      h('div', { class: 'player-ctrl-subtitle-fontsize-title' }, '字幕大小'),
                      h('div', { class: 'player-ctrl-subtitle-fontsize-content', ref: 'subtitleFontSizeRef' },
                        renderSelect({
                          className: 'player-ctrl-subtitle-fontsize-select',
                          value: currentStyle.fontSize,
                          options: FONT_SIZE_OPTIONS,
                          onChange: (value) => {
                            currentStyle.fontSize = Number(value);
                            emitStyle({ fontSize: currentStyle.fontSize });
                          },
                        }),
                      ),
                    ),
                    h('div', { class: 'player-ctrl-subtitle-color' },
                      h('div', { class: 'player-ctrl-subtitle-color-title' }, '字幕颜色'),
                      h('div', { class: 'player-ctrl-subtitle-color-content', ref: 'subtitleColorRef' },
                        renderSelect({
                          className: 'player-ctrl-subtitle-color-select',
                          value: currentStyle.color,
                          options: COLOR_OPTIONS,
                          onChange: (value) => {
                            currentStyle.color = String(value);
                            emitStyle({ color: currentStyle.color });
                          },
                        }),
                      ),
                    ),
                  ),

                  // 描边方式 + 默认位置
                  h('div', { class: 'player-ctrl-subtitle-item player-ctrl-subtitle-item-flex' },
                    h('div', { class: 'player-ctrl-subtitle-shadow' },
                      h('div', { class: 'player-ctrl-subtitle-shadow-title' }, '描边方式'),
                      h('div', { class: 'player-ctrl-subtitle-shadow-content', ref: 'subtitleStrokeRef' },
                        renderSelect({
                          className: 'player-ctrl-subtitle-shadow-select',
                          value: resolveStrokeKey(currentStyle),
                          options: STROKE_OPTIONS,
                          onChange: (value) => {
                            const patch = STROKE_PATCH[String(value)] ?? STROKE_PATCH.none;
                            currentStyle = { ...currentStyle, ...patch };
                            emitStyle(patch);
                          },
                        }),
                      ),
                    ),
                    h('div', { class: 'player-ctrl-subtitle-position' },
                      h('div', { class: 'player-ctrl-subtitle-position-title' }, '默认位置'),
                      h('div', { class: 'player-ctrl-subtitle-position-content', ref: 'subtitlePositionRef' },
                        renderSelect({
                          className: 'player-ctrl-subtitle-position-select',
                          value: resolvePositionKey(currentStyle),
                          options: POSITION_OPTIONS,
                          onChange: (value) => {
                            const patch = POSITION_PATCH[String(value)] ?? POSITION_PATCH['bottom-center'];
                            currentStyle = { ...currentStyle, ...patch };
                            emitStyle(patch);
                          },
                        }),
                      ),
                    ),
                  ),

                  // 背景不透明度
                  h('div', { class: 'player-ctrl-subtitle-item player-ctrl-subtitle-opacity' },
                    h('div', { class: 'player-ctrl-subtitle-opacity-header' },
                      h('div', { class: 'player-ctrl-subtitle-opacity-title' }, '背景不透明度'),
                      h('span', { class: 'player-ctrl-subtitle-opacity-percent', ref: 'subtitleOpacityPercentRef' }, '87%'),
                    ),
                    h('div', { class: 'player-ctrl-subtitle-opacity-content ui ui-slider ui-dark' },
                      h('div', { class: 'ui-area' },
                        h('div', { class: 'ui-track' },
                          h('div', { class: 'ui-bar-wrap' },
                            h('div', {
                              class: 'ui-bar player-ctrl-subtitle-opacity-bar',
                              role: 'progressbar',
                              ref: 'subtitleOpacityBarRef',
                            }),
                          ),
                          h('div', {
                            class: 'ui-thumb player-ctrl-subtitle-opacity-thumb',
                            ref: 'subtitleOpacityThumbRef',
                          },
                            h('div', { class: 'ui-thumb-dot' }),
                          ),
                          // 命中层：覆盖整条轨道，负责点击与拖拽（避免 thumb 体积极小难以命中）
                          h('div', {
                            class: 'player-ctrl-subtitle-opacity-track',
                            ref: 'subtitleOpacityTrackRef',
                            onMouseDown: handleOpacityMouseDown,
                          }),
                        ),
                      ),
                    ),
                  ),

                  // 其它设置：等比缩放 + 淡入淡出
                  h('div', { class: 'player-ctrl-subtitle-other' },
                    h('div', { class: 'player-ctrl-subtitle-other-title' }, '其它设置'),
                    h('div', { class: 'player-ctrl-subtitle-other-content' },
                      renderCheckbox({
                        className: 'player-ctrl-subtitle-scale',
                        label: '等比缩放',
                        checked: currentStyle.scale,
                        onChange: (checked) => {
                          currentStyle.scale = checked;
                          emitStyle({ scale: checked });
                        },
                      }),
                      renderCheckbox({
                        className: 'player-ctrl-subtitle-fade',
                        label: '淡入淡出',
                        checked: currentStyle.fade,
                        onChange: (checked) => {
                          currentStyle.fade = checked;
                          emitStyle({ fade: checked });
                        },
                      }),
                    ),
                  ),
                ),
              ),

              // 底部：恢复默认设置
              h('div', { class: 'player-ctrl-subtitle-settings-footer' },
                h('div', { class: 'player-ctrl-subtitle-separator' }),
                h('div', {
                  class: 'player-ctrl-subtitle-reset',
                  onClick: handleReset,
                },
                  h('span', {}, '恢复默认设置'),
                ),
              ),
            ),

            // ============ 翻译页：后端未接入（静态禁用占位） ============
            // 参考 DOM 的 .player-ctrl-subtitle-menu-translation 依赖 B 站「原声翻译」后端能力，
            // 当前播放器没有对应能力，故只保留同构的禁用区块，不渲染任何假数据。
            h('div', { class: 'player-ctrl-subtitle-menu-translation' },
              h('div', { class: 'player-ctrl-translation-title-area' },
                h('div', { class: 'player-ctrl-translation-add-wrap player-ctrl-subtitle-item-flex' },
                  h('div', { class: 'player-ctrl-translation-title' },
                    h('div', { class: 'player-ctrl-translation-title-text' }, ''),
                    iconVNode(InfoIcon, 'player-ctrl-translation-title-icon'),
                  ),
                ),
                h('div', {
                  class: 'player-ctrl-translation-close-switch player-ctrl-translation-disabled',
                  'data-action': 'close',
                }, '关闭'),
              ),
              h('div', { class: 'player-ctrl-translation-language' },
                h('div', { class: 'player-ctrl-translation-content' },
                  h('div', { class: 'player-ctrl-translation-inner' }),
                ),
              ),
              h('div', { class: 'player-ctrl-translation-unlogin' },
                h('div', { class: 'player-ctrl-translation-unlogin-content' }, '原声翻译后端未接入'),
              ),
            ),
          ),
        ),
      ),
    ),
    // 字幕开关（根节点内的隐藏 Switch，占位保持与参考 DOM 一致的「开关 + 关闭行」双通道）
    h('div', { class: 'player-ctrl-subtitle-switch-hidden' },
      h(Switch, {
        size: 'small',
        checked: visible,
        ref: (el: unknown) => {
          switchRoots[SWITCH_VISIBLE] = el instanceof HTMLElement ? el : null;
        },
        onChange: (checked: boolean) => setVisible(checked),
      }),
    ),
    // 缩放复选 & 淡入淡出复选的原生 input 引用（renderCheckbox 内部通过 ref 字符串注册）
    h('input', { type: 'checkbox', ref: 'subtitle-scale-input', style: { display: 'none' } }),
    h('input', { type: 'checkbox', ref: 'subtitle-fade-input', style: { display: 'none' } }),
  );
});