/**
 * ============================================
 * 清晰度选择菜单组件 (QualityMenu)
 * ============================================
 * 清晰度选择下拉菜单，支持清晰度列表的命令式渲染、当前清晰度标识、
 * 菜单悬停动画回调
 *
 * 框架无虚拟 DOM diff：列表数据变化不会触发重渲染，必须订阅运行时状态
 * （player.availableQualities）并在回调里手动重建 <li> 节点。
 */

import { h, defineComponent, useTemplateRef, useState, useContext } from '@/core';
import { PlayerStateKeyEnum, StateContext } from '@/store/runtimeState';
import type { QualityLevel } from '@/types/streamPlugin';

/**
 * 清晰度选项接口
 * @deprecated 运行时模型已统一为 QualityLevel；此处仅保留导出以兼容旧引用
 */
export interface QualityItem {
  /** 清晰度显示标签 */
  label: string;
  /** 清晰度值 */
  value: string;
  /** 角标文本（如"大会员"） */
  badge?: string;
}

/**
 * QualityMenu 组件 Props 接口
 */
export interface QualityMenuProps {
  /** 初始清晰度列表（后续变化由组件内部订阅运行时状态获得） */
  qualities?: QualityLevel[];
  /** 当前清晰度 id */
  currentQuality?: string;
}

export type QualityMenuEvents = {
  qualityChange: string;
  menuAnimation: { type: 'quality'; action: 'show' | 'hide' };
  qualityMenuMounted: undefined;
};

/**
 * QualityMenu 组件 - 使用 defineComponent 创建独立组件
 * 渲染清晰度选择菜单，支持当前清晰度高亮和角标显示
 */
export const QualityMenu = defineComponent<QualityMenuProps, QualityMenuEvents>((props, lifecycle) => {
  const { currentQuality } = props;
  const state = useContext(StateContext);

  // ============================================
  // DOM 引用
  // ============================================

  /** 清晰度按钮根节点引用（用于按列表长度切换显隐） */
  const btnRef = useTemplateRef<HTMLDivElement>(lifecycle, 'qualityBtnRef');

  /** 当前清晰度显示文本元素引用 */
  const resultRef = useTemplateRef<HTMLDivElement>(lifecycle, 'qualityResultRef');

  /** 清晰度列表容器（ul）引用 */
  const listRef = useTemplateRef<HTMLUListElement>(lifecycle, 'qualityListRef');

  // ============================================
  // 内部状态（非响应式，仅渲染时手动维护）
  // ============================================

  /** 当前选中的档位 id */
  let selectedId = currentQuality ?? 'auto';

  /** 最近一次渲染的档位列表（供外部状态变化时重建文案 / 选中态） */
  let currentList: QualityLevel[] = [];

  /** 是否已完成首次淡入 */
  let shownOnce = false;

  // ============================================
  // 渲染辅助函数
  // ============================================

  /**
   * 创建单个清晰度菜单项（真实 DOM 节点）
   * 结构与既有实现一致：li > span.player-ctrl-quality-text + span.player-ctrl-quality-badge
   * badge 节点常驻，非大会员时由内联 style 隐藏
   * @param item - 清晰度档位
   * @returns 菜单项 li 元素
   */
  const createItem = (item: QualityLevel): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = 'player-ctrl-quality-menu-item';
    if (item.id === selectedId) {
      li.classList.add('player-state-active');
    }

    const text = document.createElement('span');
    text.className = 'player-ctrl-quality-text';
    text.textContent = item.label;
    li.appendChild(text);

    // badge 节点常驻，非 bigvip 时用内联 style 隐藏（与既有实现的约定一致）
    const badge = document.createElement('span');
    badge.className = 'player-ctrl-quality-badge player-ctrl-quality-badge-bigvip';
    badge.textContent = '大会员';
    badge.style.opacity = '0';
    badge.style.display = 'none';
    li.appendChild(badge);

    li.addEventListener('click', () => {
      selectedId = item.id;
      // 选中态互斥
      if (listRef.value) {
        listRef.value
          .querySelectorAll<HTMLLIElement>('.player-ctrl-quality-menu-item')
          .forEach((el) => el.classList.remove('player-state-active'));
      }
      li.classList.add('player-state-active');
      applyResultText();
      lifecycle.emit?.('qualityChange', item.id);
    });

    return li;
  };

  /**
   * 刷新结果文本：命中当前档位显示其 label，否则显示「自动」
   */
  const applyResultText = (): void => {
    if (!resultRef.value) return;
    const hit = currentList.find((item) => item.id === selectedId);
    resultRef.value.textContent = hit ? hit.label : '自动';
  };

  /**
   * 刷新选中态（player-state-active 互斥），按当前列表顺序与 li 一一对应
   */
  const updateActive = (): void => {
    if (!listRef.value) return;
    listRef.value
      .querySelectorAll<HTMLLIElement>('.player-ctrl-quality-menu-item')
      .forEach((el, index) => {
        const item = currentList[index];
        el.classList.toggle('player-state-active', item?.id === selectedId);
      });
  };

  /**
   * 根据列表重建菜单，并同步结果文本与按钮显隐
   * @param list - 运行时清晰度列表
   */
  const renderQualities = (list?: QualityLevel[]): void => {
    const items = list ?? [];
    currentList = items;

    // 命令式重建 li 子节点（支持 HLS/DASH 异步就绪）
    if (listRef.value) {
      listRef.value.innerHTML = '';
      items.forEach((item) => listRef.value!.appendChild(createItem(item)));
    }

    // 结果文本：命中当前档位显示其 label，否则显示“自动”
    applyResultText();

    // 按钮显隐：length <= 1 时整个按钮不显示
    const btn = btnRef.value;
    if (!btn) return;
    const visible = items.length > 1;
    btn.style.display = visible ? '' : 'none';
    if (visible && !shownOnce) {
      // 首次显示做一次淡入（临时加过渡，结束后移除，不引入新 CSS 类）
      shownOnce = true;
      btn.style.opacity = '0';
      btn.style.transition = 'opacity 0.2s ease';
      requestAnimationFrame(() => {
        btn.style.opacity = '1';
      });
      setTimeout(() => {
        btn.style.transition = '';
        btn.style.opacity = '';
      }, 220);
    } else if (!visible) {
      shownOnce = false;
    }
  };

  // ============================================
  // 状态监听（订阅运行时清晰度列表）
  // ============================================

  // 框架无响应式：列表变化不会自动更新 DOM，必须在 updater 中手动重建菜单
  // useState 仅在变化时回调，组件销毁时自动取消订阅（与 LeftControls 一致）
  if (state) {
    useState(
      state,
      PlayerStateKeyEnum.AVAILABLE_QUALITIES,
      (list) => {
        renderQualities(list);
      },
      lifecycle,
    );

    // 清晰度切换生命周期：切换中把 result 文案改为「切换中」，结束（成功/失败）恢复
    useState(
      state,
      PlayerStateKeyEnum.QUALITY_SWITCH_STATE,
      (phase) => {
        if (phase === 'switching') {
          if (resultRef.value) {
            resultRef.value.textContent = '切换中';
          }
        } else {
          applyResultText();
        }
      },
      lifecycle,
    );

    // 当前生效档位变化：同步选中态与 result 文案
    useState(
      state,
      PlayerStateKeyEnum.QUALITY_CURRENT,
      (id) => {
        if (typeof id === 'string' && id) {
          selectedId = id;
        }
        updateActive();
        applyResultText();
      },
      lifecycle,
    );
  }

  // ============================================
  // 事件处理函数
  // ============================================

  /**
   * 鼠标进入清晰度按钮时触发的回调
   */
  const handleMouseEnter = (): void => {
    lifecycle.emit?.('menuAnimation', { type: 'quality', action: 'show' });
  };

  /**
   * 鼠标离开清晰度按钮时触发的回调
   */
  const handleMouseLeave = (): void => {
    lifecycle.emit?.('menuAnimation', { type: 'quality', action: 'hide' });
  };

  // ============================================
  // 生命周期钩子
  // ============================================

  /**
   * 组件挂载后：先取一次当前值渲染（原生 MP4 同步就绪），再通知外部已就绪
   */
  lifecycle.onMounted = (): void => {
    const initial =
      state?.get(PlayerStateKeyEnum.AVAILABLE_QUALITIES) ?? props.qualities;
    renderQualities(initial);
    lifecycle.emit?.('qualityMenuMounted');
  };

  // ============================================
  // 主渲染函数
  // ============================================

  return h('div', {
    class: 'player-ctrl-btn player-ctrl-quality',
    role: 'button',
    'aria-label': '清晰度',
    ref: 'qualityBtnRef',
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  },
    // 当前清晰度显示
    h('div', { class: 'player-ctrl-quality-result', ref: 'qualityResultRef' }, '自动'),
    // 清晰度下拉菜单
    h('div', { class: 'player-ctrl-quality-menu-wrap' },
      h('ul', { class: 'player-ctrl-quality-menu', ref: 'qualityListRef' })
    )
  );
});
