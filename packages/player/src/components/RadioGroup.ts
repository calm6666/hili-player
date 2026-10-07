import { h } from '@/core';
import type { VNode } from '@/types';

export interface RadioGroupOption {
  label: string;
  value: boolean | string | number;
  checked?: boolean;
}

export interface RadioGroupConfig {
  name: string;
  onSelect: (option: RadioGroupOption) => void;
  refKey?: string;
}

/**
 * 渲染一组单选胶囊
 * @param options - 选项列表
 * @param config - 组名、选中回调与可选模板引用
 * @returns 单选组虚拟节点
 */
export const RadioGroup = (
  options: RadioGroupOption[],
  config: RadioGroupConfig,
): VNode =>
  h(
    'div',
    {
      class: 'ui-radio-wrap ui-radio-button',
      ...(config.refKey ? { ref: config.refKey } : {}),
    },
    h(
      'div',
      { class: 'ui-radio-group', style: { margin: '0 -4px' } },
      ...options.map((option) =>
        h(
          'label',
          {
            class: option.checked ? 'ui-radio-item active' : 'ui-radio-item',
            style: { margin: '0 4px' },
            onClick: (event: MouseEvent) => {
              const target = event.currentTarget;
              if (target instanceof HTMLElement) {
                target.parentElement
                  ?.querySelectorAll('.ui-radio-item')
                  .forEach((item) => item.classList.remove('active'));
                target.classList.add('active');
              }
              config.onSelect(option);
            },
          },
          h('input', {
            class: 'ui-radio-input',
            type: 'radio',
            name: config.name,
            value: String(option.value),
            checked: option.checked === true,
          }),
          h(
            'span',
            { class: 'ui-radio-label' },
            h('span', { class: 'ui-radio-text' }, option.label),
          ),
        ),
      ),
    ),
  );
