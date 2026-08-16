/**
 * ============================================
 * 框架 SSR 全场景测试
 * ============================================
 * 测试框架的完整 SSR 功能，覆盖所有组件写法和场景：
 *
 * 1. 基础元素渲染（文本、属性、子元素）
 * 2. 自闭合标签（void elements）
 * 3. 样式对象序列化（驼峰转短横线）
 * 4. 布尔属性处理
 * 5. HTML 转义（XSS 防护）
 * 6. 事件处理器剥离（SSR 不渲染事件）
 * 7. 内部属性剥离（ref、key、__providers 等）
 * 8. 函数组件（defineComponent 无事件）
 * 9. 函数组件（defineComponent 带事件映射）
 * 10. 类组件
 * 11. 嵌套组件（组件嵌套组件）
 * 12. Fragment 片段
 * 13. 条件渲染（when）
 * 14. 列表渲染（each）
 * 15. 显示/隐藏（show）
 * 16. Context 上下文注入
 * 17. ref 引用（SSR 中不渲染 ref 属性）
 * 18. SVG 元素（命名空间自动注入）
 * 19. data-* / aria-* 自定义属性
 * 20. 客户端水合（hydrate）- ref 绑定、事件绑定、组件水合
 * 21. SSR + Hydrate 完整流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  h,
  defineComponent,
  Fragment,
  when,
  each,
  renderToString,
  hydrate,
  ref,
  createContext,
  useContext,
  provide,
} from '@/core';
import { show } from '@/core/h';
import type { VNode, ClassComponent, ComponentInstance, Ref } from '@/types';

/**
 * 简单类组件
 * 演示最基本的类组件写法
 */
class SimpleClassComponent implements ComponentInstance<{ title: string }> {
  props: { title: string };

  constructor(props: { title: string }) {
    this.props = props;
  }

  render(): VNode {
    return h('h1', { class: 'title' }, this.props.title);
  }
}

/**
 * 带生命周期的类组件
 * 演示类组件中生命周期钩子的写法
 */
class LifecycleClassComponent implements ComponentInstance<{ text: string }> {
  props: { text: string };
  onMounted?: () => void;
  onBeforeDestroy?: () => void;

  constructor(props: { text: string }) {
    this.props = props;
  }

  render(): VNode {
    return h('p', { class: 'lifecycle' }, this.props.text);
  }
}

/**
 * 嵌套子组件的类组件
 * 演示类组件中渲染子组件的写法
 */
class ParentClassComponent implements ComponentInstance<{ items: string[] }> {
  props: { items: string[] };

  constructor(props: { items: string[] }) {
    this.props = props;
  }

  render(): VNode {
    return h(
      'ul',
      { class: 'list' },
      ...this.props.items.map((item) => h('li', {}, item))
    );
  }
}

// ============================================
// 辅助：函数组件定义（用于测试各种函数组件写法）
// ============================================

/**
 * 无事件函数组件
 * 演示 defineComponent 的最简写法
 */
const SimpleFnComponent = defineComponent<{ message: string }>(
  (props) => {
    return h('span', { class: 'msg' }, props.message);
  }
);

/**
 * 带事件映射的函数组件
 * 演示 defineComponent<Props, Events> 双泛型写法
 * lifecycle.emit 触发事件，父组件通过 onXxx 接收
 */
type ButtonEvents = {
  click: { timestamp: number };
};

const ButtonComponent = defineComponent<
  { label: string },
  ButtonEvents
>((props, lifecycle) => {
  const handleClick = (): void => {
    lifecycle.emit?.('click', { timestamp: Date.now() });
  };

  return h(
    'button',
    { class: 'btn', onClick: handleClick },
    props.label
  );
});

/**
 * 多事件函数组件
 * 演示多个事件的 emit/onXxx 写法
 */
type FormEvents = {
  submit: { value: string };
  reset: undefined;
};

const FormComponent = defineComponent<
  { defaultValue: string },
  FormEvents
>((props, lifecycle) => {
  const handleSubmit = (): void => {
    lifecycle.emit?.('submit', { value: props.defaultValue });
  };

  const handleReset = (): void => {
    lifecycle.emit?.('reset');
  };

  return h('form', { class: 'form' },
    h('input', { type: 'text', value: props.defaultValue }),
    h('button', { type: 'submit', onClick: handleSubmit }, 'Submit'),
    h('button', { type: 'reset', onClick: handleReset }, 'Reset')
  );
});

/**
 * 使用 expose 暴露 API 的函数组件
 * 演示 lifecycle.expose 写法
 */
const ExposeComponent = defineComponent<{ initialCount: number }>(
  (props, lifecycle) => {
    let count = props.initialCount;

    const increment = (): void => {
      count += 1;
    };

    const getCount = (): number => {
      return count;
    };

    lifecycle.expose?.({ increment, getCount });

    return h('div', { class: 'counter' }, String(count));
  }
);

/**
 * 使用 Context 的函数组件
 * 演示 createContext + useContext 写法
 */
const ThemeContext = createContext<{ color: string; fontSize: string }>({
  color: 'black',
  fontSize: '14px',
});

const ThemedText = defineComponent<{ text: string }>((props) => {
  const theme = useContext(ThemeContext);
  return h(
    'span',
    { style: { color: theme.color, fontSize: theme.fontSize } },
    props.text
  );
});

/**
 * 使用 ref 的函数组件
 * 演示 ref 绑定写法
 */
const RefComponent = defineComponent(() => {
  const divRef: Ref<HTMLDivElement> = { current: null };

  return h('div', { class: 'ref-demo', ref: divRef }, 'Ref Demo');
});

/**
 * 使用 when 条件渲染的函数组件
 */
const ConditionalComponent = defineComponent<{ showTitle: boolean }>(
  (props) => {
    return h(
      'div',
      { class: 'conditional' },
      when(props.showTitle, h('h2', {}, 'Title Visible')),
      h('p', {}, 'Always visible')
    );
  }
);

/**
 * 使用 each 列表渲染的函数组件
 */
const ListComponent = defineComponent<{ items: string[] }>((props) => {
  return h(
    'ul',
    { class: 'items' },
    ...each(props.items, (item, index) =>
      h('li', { 'data-index': String(index) }, item)
    )
  );
});

/**
 * 使用 show 显示/隐藏的函数组件
 */
const ShowComponent = defineComponent<{ visible: boolean }>((props) => {
  return show(props.visible, h('div', { class: 'toggle' }, 'Toggle Content'));
});

/**
 * Fragment 片段组件
 * 演示 Fragment 写法，不产生额外 DOM 节点
 */
const FragmentComponent = defineComponent<{ items: string[] }>((props) => {
  return h(Fragment, {},
    ...props.items.map((item) => h('span', {}, item))
  );
});

/**
 * SVG 组件
 * 演示 SVG 命名空间自动注入写法
 */
const SvgComponent = defineComponent(() => {
  return h('svg', { viewBox: '0 0 100 100', width: '100', height: '100' },
    h('circle', { cx: '50', cy: '50', r: '40', fill: 'red' }),
    h('line', { x1: '10', y1: '10', x2: '90', y2: '90', stroke: 'blue' })
  );
});

/**
 * 嵌套组件
 * 演示组件嵌套组件的写法
 */
const NestedChild = defineComponent<{ label: string }>((props) => {
  return h('span', { class: 'child' }, props.label);
});

const NestedParent = defineComponent<{ title: string; items: string[] }>(
  (props) => {
    return h('div', { class: 'parent' },
      h('h2', {}, props.title),
      h('div', { class: 'children' },
        ...each(props.items, (item) => h(NestedChild, { label: item }))
      )
    );
  }
);

/**
 * Context Provider 组件
 * 演示通过 provide() 注入上下文的写法
 * 使用 provide() 而非元素级 __providers，因为 JavaScript 函数参数求值顺序
 * 导致 h('div', { __providers: [...] }, h(Child, ...)) 中子组件在父元素创建前求值，
 * useContext 无法沿 __parent 链找到元素上的 __providers。
 * provide() 通过全局 Provider 栈在子组件求值前注入 Provider，解决此问题。
 */
const ProviderComponent = defineComponent(() => {
  return h(
    'div',
    { class: 'provider-wrapper' },
    provide(
      [{ contextId: ThemeContext.id, value: { color: 'blue', fontSize: '18px' } }],
      () => h(ThemedText, { text: 'Themed Content' })
    )
  );
});

// ============================================
// 测试：renderToString 基础场景
// ============================================

describe('SSR - renderToString 基础场景', () => {
  it('应将 null/undefined 渲染为空字符串', () => {
    expect(renderToString(null)).toBe('');
    expect(renderToString(undefined)).toBe('');
  });

  it('应渲染纯文本节点', () => {
    expect(renderToString('Hello World')).toBe('Hello World');
  });

  it('应转义 HTML 特殊字符防止 XSS', () => {
    expect(renderToString('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    expect(renderToString("a'b&c\"d")).toBe('a&#39;b&amp;c&quot;d');
  });

  it('应渲染简单 HTML 元素', () => {
    const vnode = h('div', {}, 'Hello');
    expect(renderToString(vnode)).toBe('<div>Hello</div>');
  });

  it('应渲染无属性无子元素的空元素', () => {
    const vnode = h('div', {});
    expect(renderToString(vnode)).toBe('<div></div>');
  });

  it('应渲染带 class 属性的元素', () => {
    const vnode = h('div', { class: 'container active' }, 'Content');
    expect(renderToString(vnode)).toBe(
      '<div class="container active">Content</div>'
    );
  });

  it('应渲染带 id 属性的元素', () => {
    const vnode = h('div', { id: 'app' }, 'Content');
    expect(renderToString(vnode)).toBe('<div id="app">Content</div>');
  });

  it('应跳过空 class 属性', () => {
    const vnode = h('div', { class: '' }, 'Content');
    expect(renderToString(vnode)).toBe('<div>Content</div>');
  });

  it('应跳过 undefined 属性值', () => {
    const vnode = h('div', { class: 'test', id: undefined }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });
});

// ============================================
// 测试：自闭合标签（void elements）
// ============================================

describe('SSR - 自闭合标签', () => {
  it('应渲染 br 自闭合标签', () => {
    expect(renderToString(h('br'))).toBe('<br>');
  });

  it('应渲染 img 自闭合标签带属性', () => {
    expect(renderToString(h('img', { src: 'test.jpg', alt: 'test' }))).toBe(
      '<img src="test.jpg" alt="test">'
    );
  });

  it('应渲染 input 自闭合标签带类型', () => {
    expect(renderToString(h('input', { type: 'text' }))).toBe(
      '<input type="text">'
    );
  });

  it('应渲染 hr 自闭合标签', () => {
    expect(renderToString(h('hr'))).toBe('<hr>');
  });

  it('应渲染 meta 自闭合标签', () => {
    expect(renderToString(h('meta', { charset: 'UTF-8' }))).toBe(
      '<meta charset="UTF-8">'
    );
  });

  it('应渲染 link 自闭合标签', () => {
    expect(
      renderToString(h('link', { rel: 'stylesheet', href: 'style.css' }))
    ).toBe('<link rel="stylesheet" href="style.css">');
  });
});

// ============================================
// 测试：布尔属性
// ============================================

describe('SSR - 布尔属性', () => {
  it('应渲染 disabled 布尔属性（只有属性名无值）', () => {
    const vnode = h('input', { disabled: true });
    expect(renderToString(vnode)).toBe('<input disabled>');
  });

  it('应渲染 checked 布尔属性', () => {
    const vnode = h('input', { type: 'checkbox', checked: true });
    expect(renderToString(vnode)).toBe('<input type="checkbox" checked>');
  });

  it('应渲染 hidden 布尔属性', () => {
    const vnode = h('div', { hidden: true }, 'Hidden');
    expect(renderToString(vnode)).toBe('<div hidden>Hidden</div>');
  });

  it('应跳过 hidden=false 的属性', () => {
    const vnode = h('div', { hidden: false }, 'Visible');
    expect(renderToString(vnode)).toBe('<div>Visible</div>');
  });

  it('应渲染 multiple 布尔属性', () => {
    const vnode = h('select', { multiple: true });
    expect(renderToString(vnode)).toBe('<select multiple></select>');
  });
});

// ============================================
// 测试：样式对象序列化
// ============================================

describe('SSR - 样式对象序列化', () => {
  it('应将 style 对象转为内联样式字符串', () => {
    const vnode = h('div', { style: { color: 'red', fontSize: '16px' } }, 'Styled');
    const html = renderToString(vnode);
    expect(html).toContain('style="');
    expect(html).toContain('color: red');
    expect(html).toContain('font-size: 16px');
  });

  it('应将驼峰命名转为短横线命名', () => {
    const vnode = h('div', {
      style: {
        backgroundColor: 'blue',
        borderBottomWidth: '2px',
        zIndex: '100',
      },
    });
    const html = renderToString(vnode);
    expect(html).toContain('background-color: blue');
    expect(html).toContain('border-bottom-width: 2px');
    expect(html).toContain('z-index: 100');
  });

  it('应处理数字类型的样式值', () => {
    const vnode = h('div', { style: { opacity: 0.5 } });
    const html = renderToString(vnode);
    expect(html).toContain('opacity: 0.5');
  });

  it('空样式对象不应输出 style=""', () => {
    // 空对象 → normalizeStyle 返回 null → serializeStyle 返回 ''
    const vnode = h('div', { style: {} });
    const html = renderToString(vnode);
    expect(html).toBe('<div></div>');
  });

  it('null/undefined 样式值应被过滤', () => {
    // 参考 Vue 3: null/undefined 的样式值不应出现在输出中
    const vnode = h('div', { style: { color: null as unknown, fontSize: undefined, display: 'none' } });
    const html = renderToString(vnode);
    expect(html).not.toContain('color');
    expect(html).not.toContain('font-size');
    expect(html).toContain('display: none');
  });

  it('空字符串的样式值不应输出（避免 display: ;）', () => {
    // display: '' 在 SSR 中不应产生 display: ; 的脏输出
    const vnode = h('div', { style: { display: '', zIndex: '15' } });
    const html = renderToString(vnode);
    expect(html).not.toContain('display:');
    expect(html).toContain('z-index: 15');
  });

  it('应处理 CSS 自定义属性', () => {
    const vnode = h('div', { style: { '--primary-color': '#ff0000', color: 'var(--primary-color)' } });
    const html = renderToString(vnode);
    expect(html).toContain('--primary-color: #ff0000');
    expect(html).toContain('color: var(--primary-color)');
  });
});

// ============================================
// 测试：class 标准化
// ============================================

describe('SSR - class 标准化', () => {
  it('应正确输出字符串 class', () => {
    const vnode = h('div', { class: 'foo bar' });
    const html = renderToString(vnode);
    expect(html).toBe('<div class="foo bar"></div>');
  });

  it('应正确处理 className（映射为 class）', () => {
    const vnode = h('div', { className: 'foo' });
    const html = renderToString(vnode);
    expect(html).toBe('<div class="foo"></div>');
  });

  it('应处理 class 数组（支持字符串和对象的混合）', () => {
    // 参考：类名数组 + 对象混合需正确序列化
    // normalizeClass 将数组展开、对象取 truthy key
    const vnode = h('div', { class: ['btn', 'primary', { disabled: false, active: true }] });
    const html = renderToString(vnode);
    expect(html).toContain('class="');
    // 应包含字符串类名和 truthy 对象 key
    expect(html).toContain('btn');
    expect(html).toContain('primary');
    expect(html).toContain('active');
    // 不应包含 falsy 的对象 key
    expect(html).not.toContain('disabled');
  });

  it('应处理 class 对象', () => {
    const vnode = h('div', { class: { btn: true, disabled: false, active: true } });
    const html = renderToString(vnode);
    expect(html).toContain('btn');
    expect(html).not.toContain('disabled');
    expect(html).toContain('active');
  });

  it('空 class 不应输出 class 属性', () => {
    const vnode = h('div', { class: '' });
    const html = renderToString(vnode);
    expect(html).toBe('<div></div>');
  });

  it('空 className 不应输出 class 属性', () => {
    const vnode = h('div', { className: '' });
    const html = renderToString(vnode);
    expect(html).toBe('<div></div>');
  });
});

// ============================================
// 测试：事件处理器剥离
// ============================================

describe('SSR - 事件处理器剥离', () => {
  it('应跳过 onClick 事件处理器', () => {
    const vnode = h('div', { onClick: () => {}, class: 'test' }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('应跳过 onInput 事件处理器', () => {
    const vnode = h('input', { onInput: () => {}, type: 'text' });
    expect(renderToString(vnode)).toBe('<input type="text">');
  });

  it('应跳过多个事件处理器', () => {
    const vnode = h('div', {
      onClick: () => {},
      onMouseEnter: () => {},
      onFocus: () => {},
      class: 'events',
    });
    expect(renderToString(vnode)).toBe('<div class="events"></div>');
  });
});

// ============================================
// 测试：内部属性剥离
// ============================================

describe('SSR - 内部属性剥离', () => {
  it('应跳过 ref 属性', () => {
    const vnode = h('div', { ref: { current: null }, class: 'test' }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('应跳过 key 属性', () => {
    const vnode = h('div', { key: 'unique', class: 'test' }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('应跳过 __providers 属性', () => {
    const vnode = h('div', {
      __providers: [{ contextId: Symbol(), value: 'test' }],
      class: 'test',
    }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('应跳过 _cleanups 属性', () => {
    const vnode = h('div', { _cleanups: [], class: 'test' }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('应跳过 __ns 属性', () => {
    const vnode = h('div', { __ns: 'http://www.w3.org/2000/svg', class: 'test' }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('应跳过 innerHTML 属性（不应作为 HTML 属性输出）', () => {
    // innerHTML 是 DOM property，setAttribute 无法设置内部内容
    // 应作为 children 传入 h()，而非属性
    const vnode = h('div', { innerHTML: '<span>test</span>' });
    const html = renderToString(vnode);
    expect(html).not.toContain('innerhtml');
    expect(html).not.toContain('innerHTML');
  });

  it('应跳过 textContent 属性（不应作为 HTML 属性输出）', () => {
    const vnode = h('div', { textContent: 'test' });
    const html = renderToString(vnode);
    expect(html).not.toContain('textcontent');
    expect(html).not.toContain('textContent');
  });

  it('readOnly 应输出为 readonly（HTML 标准属性名）', () => {
    const vnode = h('input', { readOnly: true });
    const html = renderToString(vnode);
    expect(html).toContain('readonly');
  });
});

// ============================================
// 测试：函数组件（无事件）
// ============================================

describe('SSR - 函数组件（无事件）', () => {
  it('应渲染简单函数组件', () => {
    const vnode = h(SimpleFnComponent, { message: 'Hello SSR' });
    expect(renderToString(vnode)).toBe(
      '<span class="msg">Hello SSR</span>'
    );
  });

  it('应渲染使用 ref 的函数组件（ref 不出现在 HTML 中）', () => {
    const vnode = h(RefComponent, {});
    expect(renderToString(vnode)).toBe(
      '<div class="ref-demo">Ref Demo</div>'
    );
  });

  it('应渲染使用 expose 的函数组件', () => {
    const vnode = h(ExposeComponent, { initialCount: 42 });
    expect(renderToString(vnode)).toBe(
      '<div class="counter">42</div>'
    );
  });
});

// ============================================
// 测试：函数组件（带事件映射）
// ============================================

describe('SSR - 函数组件（带事件映射）', () => {
  it('应渲染带事件的函数组件（事件回调不出现在 HTML 中）', () => {
    const vnode = h(ButtonComponent, {
      label: 'Click Me',
      onClick: () => {},
    });
    /** onClick 是事件处理器，SSR 中应被剥离 */
    expect(renderToString(vnode)).toBe(
      '<button class="btn">Click Me</button>'
    );
  });

  it('应渲染带多事件的函数组件', () => {
    const vnode = h(FormComponent, {
      defaultValue: 'test',
      onSubmit: () => {},
      onReset: () => {},
    });
    const html = renderToString(vnode);
    /** 所有事件回调都不应出现在 HTML 中 */
    expect(html).not.toContain('onSubmit');
    expect(html).not.toContain('onReset');
    expect(html).toContain('<form class="form">');
    expect(html).toContain('<input type="text" value="test">');
  });
});

// ============================================
// 测试：类组件
// ============================================

describe('SSR - 类组件', () => {
  it('应渲染简单类组件', () => {
    const vnode = h(SimpleClassComponent, { title: 'Class Title' });
    expect(renderToString(vnode)).toBe(
      '<h1 class="title">Class Title</h1>'
    );
  });

  it('应渲染带生命周期的类组件', () => {
    const vnode = h(LifecycleClassComponent, { text: 'Lifecycle Test' });
    expect(renderToString(vnode)).toBe(
      '<p class="lifecycle">Lifecycle Test</p>'
    );
  });

  it('应渲染带子组件的类组件', () => {
    const vnode = h(ParentClassComponent, { items: ['A', 'B', 'C'] });
    expect(renderToString(vnode)).toBe(
      '<ul class="list"><li>A</li><li>B</li><li>C</li></ul>'
    );
  });
});

// ============================================
// 测试：嵌套组件
// ============================================

describe('SSR - 嵌套组件', () => {
  it('应渲染函数组件嵌套函数组件', () => {
    const vnode = h(NestedParent, {
      title: 'Parent Title',
      items: ['Child1', 'Child2'],
    });
    expect(renderToString(vnode)).toBe(
      '<div class="parent"><h2>Parent Title</h2><div class="children"><span class="child">Child1</span><span class="child">Child2</span></div></div>'
    );
  });

  it('应渲染多层嵌套组件', () => {
    /** 三层嵌套：Outer > Middle > Inner */
    const Inner = defineComponent<{ text: string }>((props) => {
      return h('span', {}, props.text);
    });

    const Middle = defineComponent<{ label: string; value: string }>(
      (props) => {
        return h('div', { class: 'middle' },
          h(Inner, { text: `${props.label}: ${props.value}` })
        );
      }
    );

    const Outer = defineComponent(() => {
      return h('div', { class: 'outer' },
        h(Middle, { label: 'Name', value: 'SSR' })
      );
    });

    const vnode = h(Outer, {});
    expect(renderToString(vnode)).toBe(
      '<div class="outer"><div class="middle"><span>Name: SSR</span></div></div>'
    );
  });
});

// ============================================
// 测试：Fragment 片段
// ============================================

describe('SSR - Fragment 片段', () => {
  it('应渲染 Fragment 组件（只输出子元素，不输出 fragment 标签）', () => {
    const vnode = h(FragmentComponent, { items: ['A', 'B'] });
    const html = renderToString(vnode);
    /**
     * Fragment 不产生真实 DOM 节点，只输出子元素
     * 与客户端行为一致：Fragment 不创建 DOM 节点
     */
    expect(html).toBe('<span>A</span><span>B</span>');
  });

  it('应渲染空 Fragment（输出空字符串）', () => {
    const vnode = h(Fragment, {}, '');
    const html = renderToString(vnode);
    expect(html).toBe('');
  });
});

// ============================================
// 测试：条件渲染 when
// ============================================

describe('SSR - 条件渲染 when', () => {
  it('条件为 true 时应渲染内容', () => {
    const vnode = h(ConditionalComponent, { showTitle: true });
    const html = renderToString(vnode);
    expect(html).toContain('<h2>Title Visible</h2>');
    expect(html).toContain('Always visible');
  });

  it('条件为 false 时应不渲染条件内容', () => {
    const vnode = h(ConditionalComponent, { showTitle: false });
    const html = renderToString(vnode);
    expect(html).not.toContain('Title Visible');
    expect(html).toContain('Always visible');
  });
});

// ============================================
// 测试：列表渲染 each
// ============================================

describe('SSR - 列表渲染 each', () => {
  it('应渲染列表项', () => {
    const vnode = h(ListComponent, { items: ['Apple', 'Banana', 'Cherry'] });
    const html = renderToString(vnode);
    expect(html).toContain('<li data-index="0">Apple</li>');
    expect(html).toContain('<li data-index="1">Banana</li>');
    expect(html).toContain('<li data-index="2">Cherry</li>');
  });

  it('应渲染空列表', () => {
    const vnode = h(ListComponent, { items: [] });
    const html = renderToString(vnode);
    expect(html).toBe('<ul class="items"></ul>');
  });
});

// ============================================
// 测试：显示/隐藏 show
// ============================================

describe('SSR - 显示/隐藏 show', () => {
  it('visible=true 时不应添加 display:none', () => {
    const vnode = h(ShowComponent, { visible: true });
    const html = renderToString(vnode);
    expect(html).toContain('Toggle Content');
    expect(html).not.toContain('display: none');
  });

  it('visible=false 时应添加 display:none', () => {
    const vnode = h(ShowComponent, { visible: false });
    const html = renderToString(vnode);
    expect(html).toContain('display: none');
  });
});

// ============================================
// 测试：Context 上下文
// ============================================

describe('SSR - Context 上下文', () => {
  it('应渲染使用默认 Context 值的组件（无 Provider 时使用默认值）', () => {
    /**
     * 没有 Provider 时，useContext 返回默认值
     */
    const vnode = h(ThemedText, { text: 'Default Theme' });
    const html = renderToString(vnode);
    expect(html).toContain('color: black');
    expect(html).toContain('font-size: 14px');
  });

  it('应通过元素 __providers 注入 Context 值', () => {
    /**
     * SSR 中 renderElementToString 维护 __currentVNode 链，
     * 元素上的 __providers 可以被子组件的 useContext 找到
     */
    const vnode = h(ProviderComponent, {});
    const html = renderToString(vnode);
    /** 使用 Provider 注入的值 */
    expect(html).toContain('color: blue');
    expect(html).toContain('font-size: 18px');
  });

  it('应支持多层 Context 嵌套', () => {
    const InnerComponent = defineComponent(() => {
      const theme = useContext(ThemeContext);
      return h('span', { class: 'inner-theme' }, theme.color);
    });

    /**
     * 使用 provide() 注入 Context，而非元素级 __providers
     * provide() 通过全局 Provider 栈确保 useContext 可以在子组件求值时找到 Provider
     */
    const vnode = h(
      'div',
      { class: 'outer' },
      provide(
        [{ contextId: ThemeContext.id, value: { color: 'green', fontSize: '20px' } }],
        () => h(InnerComponent, {})
      )
    );

    const html = renderToString(vnode);
    /** SSR 中 useContext 可以通过 Provider 栈找到 Provider */
    expect(html).toContain('green');
  });

  it('应在子节点渲染抛错后清理元素级 Provider 上下文', () => {
    const LeakContext = createContext<{ color: string; fontSize: string }>({
      color: 'black',
      fontSize: '14px',
    });

    const ThrowingChild = defineComponent(() => {
      useContext(LeakContext);
      throw new Error('boom');
    });

    const LeakProbe = defineComponent(() => {
      const theme = useContext(LeakContext);
      return h('span', { style: { color: theme.color, fontSize: theme.fontSize } }, 'Probe');
    });

    const failingVNode: VNode = {
      tag: 'div',
      attrs: {
        __providers: [
          {
            contextId: LeakContext.id,
            value: { color: 'purple', fontSize: '16px' },
          },
        ],
      },
      children: [
        {
          tag: ThrowingChild,
          attrs: {},
          children: [],
        },
      ],
    };

    expect(() => renderToString(failingVNode)).toThrow('boom');

    const html = renderToString(h(LeakProbe, {}));
    expect(html).toContain('black');
    expect(html).not.toContain('purple');
  });
});

// ============================================
// 测试：SVG 元素
// ============================================

describe('SSR - SVG 元素', () => {
  it('应渲染 SVG 组件（自动注入 xmlns 命名空间）', () => {
    const vnode = h(SvgComponent, {});
    const html = renderToString(vnode);
    expect(html).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(html).toContain('<circle');
    expect(html).toContain('<line');
  });

  it('应渲染简单 SVG 元素', () => {
    const vnode = h('svg', { viewBox: '0 0 50 50' },
      h('rect', { x: '0', y: '0', width: '50', height: '50', fill: 'green' })
    );
    const html = renderToString(vnode);
    expect(html).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(html).toContain('viewBox="0 0 50 50"');
    expect(html).toContain('<rect');
  });

  it('应保留用户指定的 xmlns', () => {
    const vnode = h('svg', { xmlns: 'http://custom.ns', viewBox: '0 0 10 10' });
    const html = renderToString(vnode);
    expect(html).toContain('xmlns="http://custom.ns"');
  });
});

// ============================================
// 测试：自定义属性（data-* / aria-*）
// ============================================

describe('SSR - 自定义属性', () => {
  it('应渲染 data-* 属性', () => {
    const vnode = h('div', { 'data-screen': 'full', 'data-ctrl-hidden': 'false' }, 'Content');
    expect(renderToString(vnode)).toBe(
      '<div data-screen="full" data-ctrl-hidden="false">Content</div>'
    );
  });

  it('应渲染 aria-* 属性', () => {
    const vnode = h('div', { 'aria-label': 'Player', 'aria-hidden': 'true' }, 'Content');
    expect(renderToString(vnode)).toBe(
      '<div aria-label="Player" aria-hidden="true">Content</div>'
    );
  });

  it('应渲染 role 属性', () => {
    const vnode = h('div', { role: 'button' }, 'Click');
    expect(renderToString(vnode)).toBe('<div role="button">Click</div>');
  });

  it('应将非布尔属性的 false 按字符串输出', () => {
    const vnode = h('div', { 'data-enabled': false }, 'Content');
    expect(renderToString(vnode)).toBe('<div data-enabled="false">Content</div>');
  });

  it('应将非布尔属性的 true 按字符串输出', () => {
    const vnode = h('div', { draggable: true }, 'Content');
    expect(renderToString(vnode)).toBe('<div draggable="true">Content</div>');
  });
});

// ============================================
// 测试：嵌套子元素
// ============================================

describe('SSR - 嵌套子元素', () => {
  it('应渲染多层级嵌套元素', () => {
    const vnode = h('div', { class: 'outer' },
      h('div', { class: 'middle' },
        h('span', { class: 'inner' }, 'Deep')
      )
    );
    expect(renderToString(vnode)).toBe(
      '<div class="outer"><div class="middle"><span class="inner">Deep</span></div></div>'
    );
  });

  it('应渲染多个子元素', () => {
    const vnode = h('ul', {},
      h('li', {}, 'Item 1'),
      h('li', {}, 'Item 2'),
      h('li', {}, 'Item 3')
    );
    expect(renderToString(vnode)).toBe(
      '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>'
    );
  });

  it('应渲染混合文本和元素子节点', () => {
    const vnode = h('p', {}, 'Hello ', h('strong', {}, 'World'), '!');
    expect(renderToString(vnode)).toBe(
      '<p>Hello <strong>World</strong>!</p>'
    );
  });

  it('应过滤 null/undefined 子节点', () => {
    const vnode = h('div', {}, 'A', null, 'B', undefined, 'C');
    expect(renderToString(vnode)).toBe('<div>ABC</div>');
  });
});

// ============================================
// 测试：属性值转义
// ============================================

describe('SSR - 属性值转义', () => {
  it('应转义属性值中的双引号', () => {
    const vnode = h('div', { title: 'say "hello"' }, 'Content');
    expect(renderToString(vnode)).toBe(
      '<div title="say &quot;hello&quot;">Content</div>'
    );
  });

  it('应转义属性值中的尖括号', () => {
    const vnode = h('div', { title: '<script>' }, 'Content');
    expect(renderToString(vnode)).toBe(
      '<div title="&lt;script&gt;">Content</div>'
    );
  });

  it('应转义属性值中的 & 符号', () => {
    const vnode = h('div', { title: 'A & B' }, 'Content');
    expect(renderToString(vnode)).toBe(
      '<div title="A &amp; B">Content</div>'
    );
  });
});

// ============================================
// 测试：客户端水合（hydrate）
// ============================================

describe('SSR - 客户端水合 hydrate', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('应将 ref 绑定到已有 DOM 元素', () => {
    container.innerHTML = '<div class="test">Content</div>';
    const divRef = ref<HTMLDivElement>();

    const vnode = h('div', { class: 'test', ref: divRef }, 'Content');
    hydrate(vnode, container);

    expect(divRef.current).toBe(container.firstChild);
  });

  it('应将事件监听器绑定到已有 DOM 元素', () => {
    container.innerHTML = '<button class="btn">Click</button>';
    const handler = vi.fn();

    const vnode = h('button', { class: 'btn', onClick: handler }, 'Click');
    hydrate(vnode, container);

    const button = container.querySelector('button')!;
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('应处理嵌套元素的 ref 和事件', () => {
    container.innerHTML =
      '<div class="outer"><span class="inner">Hello</span></div>';
    const spanRef = ref<HTMLSpanElement>();
    const clickHandler = vi.fn();

    const vnode = h('div', { class: 'outer' },
      h('span', { class: 'inner', ref: spanRef, onClick: clickHandler }, 'Hello')
    );
    hydrate(vnode, container);

    const span = container.querySelector('span')!;
    expect(spanRef.current).toBe(span);
    span.click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it('应水合函数组件', () => {
    container.innerHTML = '<div class="component">Content</div>';
    const divRef = ref<HTMLDivElement>();

    const MyComponent = defineComponent(() => {
      return h('div', { class: 'component', ref: divRef }, 'Content');
    });

    const vnode = h(MyComponent, {});
    hydrate(vnode, container);

    expect(divRef.current).toBe(container.firstChild);
  });

  it('不应修改已有 DOM 结构', () => {
    container.innerHTML = '<div class="test">Content</div>';
    const originalChild = container.firstChild;

    const vnode = h('div', { class: 'test' }, 'Content');
    hydrate(vnode, container);

    expect(container.firstChild).toBe(originalChild);
    expect(container.childNodes.length).toBe(1);
  });

  it('应绑定多个 ref 到嵌套结构', () => {
    container.innerHTML =
      '<div class="outer"><div class="inner"></div></div>';
    const outerRef = ref<HTMLDivElement>();
    const innerRef = ref<HTMLDivElement>();

    const vnode = h('div', { class: 'outer', ref: outerRef },
      h('div', { class: 'inner', ref: innerRef })
    );
    hydrate(vnode, container);

    expect(outerRef.current).toBe(container.querySelector('.outer'));
    expect(innerRef.current).toBe(container.querySelector('.inner'));
  });

  it('应处理文本子节点', () => {
    container.innerHTML = '<p>Hello World</p>';

    const vnode = h('p', {}, 'Hello World');
    hydrate(vnode, container);

    expect(container.textContent).toBe('Hello World');
  });

  it('应水合带事件的函数组件', () => {
    container.innerHTML = '<button class="btn">Click Me</button>';
    const clickHandler = vi.fn();

    const vnode = h(ButtonComponent, {
      label: 'Click Me',
      onClick: clickHandler,
    });
    hydrate(vnode, container);

    const button = container.querySelector('button')!;
    button.click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it('应水合嵌套组件结构', () => {
    container.innerHTML =
      '<div class="parent"><h2>Parent Title</h2><div class="children"><span class="child">Item</span></div></div>';
    const h2Ref = ref<HTMLHeadingElement>();

    const vnode = h(NestedParent, {
      title: 'Parent Title',
      items: ['Item'],
    });
    hydrate(vnode, container);

    /** 验证 DOM 结构未被修改 */
    expect(container.querySelector('h2')?.textContent).toBe('Parent Title');
    expect(container.querySelector('.child')?.textContent).toBe('Item');
  });
});

// ============================================
// 测试：SSR + Hydrate 完整流程
// ============================================

describe('SSR - 完整流程（renderToString → hydrate）', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('应完成简单元素的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染 */
    const vnode = h('div', { class: 'app' },
      h('h1', {}, 'SSR App'),
      h('p', {}, 'This is server rendered')
    );
    const html = renderToString(vnode);
    expect(html).toBe(
      '<div class="app"><h1>SSR App</h1><p>This is server rendered</p></div>'
    );

    /** 2. 客户端注入 HTML */
    container.innerHTML = html;

    /** 3. 客户端水合 */
    const clickHandler = vi.fn();
    const hydratedVnode = h('div', { class: 'app', onClick: clickHandler },
      h('h1', {}, 'SSR App'),
      h('p', {}, 'This is server rendered')
    );
    hydrate(hydratedVnode, container);

    /** 4. 验证事件绑定 */
    const div = container.querySelector('div')!;
    div.click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it('应完成函数组件的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染 */
    const vnode = h(SimpleFnComponent, { message: 'SSR Message' });
    const html = renderToString(vnode);
    expect(html).toBe('<span class="msg">SSR Message</span>');

    /** 2. 客户端注入 HTML */
    container.innerHTML = html;

    /** 3. 客户端水合 */
    const spanRef = ref<HTMLSpanElement>();
    const hydratedVnode = h(SimpleFnComponent, { message: 'SSR Message' });
    hydrate(hydratedVnode, container);

    /** 4. 验证 DOM 未被修改 */
    expect(container.innerHTML).toBe('<span class="msg">SSR Message</span>');
  });

  it('应完成带事件组件的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染（事件不出现在 HTML 中） */
    const vnode = h(ButtonComponent, { label: 'Submit' });
    const html = renderToString(vnode);
    expect(html).toBe('<button class="btn">Submit</button>');

    /** 2. 客户端注入 HTML */
    container.innerHTML = html;

    /** 3. 客户端水合（绑定事件） */
    const clickHandler = vi.fn();
    const hydratedVnode = h(ButtonComponent, {
      label: 'Submit',
      onClick: clickHandler,
    });
    hydrate(hydratedVnode, container);

    /** 4. 验证事件绑定 */
    const button = container.querySelector('button')!;
    button.click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it('应完成类组件的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染 */
    const vnode = h(SimpleClassComponent, { title: 'Class SSR' });
    const html = renderToString(vnode);
    expect(html).toBe('<h1 class="title">Class SSR</h1>');

    /** 2. 客户端注入 HTML */
    container.innerHTML = html;

    /** 3. 客户端水合 */
    const h1Ref = ref<HTMLHeadingElement>();
    const hydratedVnode = h(SimpleClassComponent, { title: 'Class SSR' });
    hydrate(hydratedVnode, container);

    /** 4. 验证 DOM 未被修改 */
    expect(container.innerHTML).toBe('<h1 class="title">Class SSR</h1>');
  });

  it('应完成嵌套组件的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染 */
    const vnode = h(NestedParent, {
      title: 'Nested SSR',
      items: ['X', 'Y'],
    });
    const html = renderToString(vnode);
    expect(html).toBe(
      '<div class="parent"><h2>Nested SSR</h2><div class="children"><span class="child">X</span><span class="child">Y</span></div></div>'
    );

    /** 2. 客户端注入 HTML */
    container.innerHTML = html;

    /** 3. 客户端水合 */
    const hydratedVnode = h(NestedParent, {
      title: 'Nested SSR',
      items: ['X', 'Y'],
    });
    hydrate(hydratedVnode, container);

    /** 4. 验证 DOM 结构完整 */
    expect(container.querySelectorAll('.child').length).toBe(2);
  });

  it('应完成 Context Provider 的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染（SSR 中 Context 使用 Provider 注入的值） */
    const vnode = h(ProviderComponent, {});
    const html = renderToString(vnode);
    /** SSR 中 useContext 可以找到 Provider 注入的值 */
    expect(html).toContain('color: blue');
    expect(html).toContain('Themed Content');

    /** 2. 客户端注入 HTML */
    container.innerHTML = html;

    /** 3. 客户端水合 */
    const hydratedVnode = h(ProviderComponent, {});
    hydrate(hydratedVnode, container);

    /** 4. 验证 DOM 未被修改 */
    expect(container.querySelector('.provider-wrapper')).toBeTruthy();
  });

  it('应完成 SVG 的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染 */
    const vnode = h(SvgComponent, {});
    const html = renderToString(vnode);
    expect(html).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(html).toContain('<circle');

    /** 2. 客户端注入 HTML */
    container.innerHTML = html;

    /** 3. 客户端水合 */
    const hydratedVnode = h(SvgComponent, {});
    hydrate(hydratedVnode, container);

    /** 4. 验证 SVG 结构完整 */
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('circle')).toBeTruthy();
  });

  it('应完成条件渲染的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染（条件为 true） */
    const vnodeShow = h(ConditionalComponent, { showTitle: true });
    const htmlShow = renderToString(vnodeShow);
    expect(htmlShow).toContain('Title Visible');

    /** 2. 服务端渲染（条件为 false） */
    const vnodeHide = h(ConditionalComponent, { showTitle: false });
    const htmlHide = renderToString(vnodeHide);
    expect(htmlHide).not.toContain('Title Visible');

    /** 3. 客户端水合 */
    container.innerHTML = htmlShow;
    const hydratedVnode = h(ConditionalComponent, { showTitle: true });
    hydrate(hydratedVnode, container);

    expect(container.querySelector('h2')?.textContent).toBe('Title Visible');
  });

  it('应完成列表渲染的 SSR + Hydrate 完整流程', () => {
    /** 1. 服务端渲染 */
    const items = ['Alpha', 'Beta', 'Gamma'];
    const vnode = h(ListComponent, { items });
    const html = renderToString(vnode);
    expect(html).toContain('<li data-index="0">Alpha</li>');
    expect(html).toContain('<li data-index="1">Beta</li>');
    expect(html).toContain('<li data-index="2">Gamma</li>');

    /** 2. 客户端注入 HTML */
    container.innerHTML = html;

    /** 3. 客户端水合 */
    const hydratedVnode = h(ListComponent, { items });
    hydrate(hydratedVnode, container);

    /** 4. 验证列表项数量 */
    expect(container.querySelectorAll('li').length).toBe(3);
  });
});

// ============================================
// 测试：边界情况
// ============================================

describe('SSR - 边界情况', () => {
  it('应处理数字类型的属性值', () => {
    const vnode = h('progress', { value: 50, max: 100 });
    const html = renderToString(vnode);
    expect(html).toContain('value="50"');
    expect(html).toContain('max="100"');
  });

  it('应跳过布尔属性 false 值（不渲染 attr="false"）', () => {
    /**
     * HTML 规范中布尔属性只有两种状态：存在（true）或不存在
     * disabled="false" 在浏览器中仍会被视为 disabled
     * 所以所有布尔属性的 false 值都应跳过不渲染
     */
    const vnode = h('input', { disabled: false });
    const html = renderToString(vnode);
    expect(html).toBe('<input>');
  });

  it('应处理 style 为字符串的情况', () => {
    // 字符串 style 现在通过 parseStyleString 解析后统一处理，
    // 每个属性自带分号（与 Vue 3 / Solid.js 行为一致）
    const vnode = h('div', { style: 'color: red' }, 'Styled');
    const html = renderToString(vnode);
    expect(html).toContain('style="color: red;"');
  });

  it('应处理空子节点数组', () => {
    const vnode = h('div', {}, []);
    const html = renderToString(vnode);
    expect(html).toBe('<div></div>');
  });

  it('应处理深层嵌套的组件', () => {
    /** 创建 5 层嵌套组件 */
    const Level5 = defineComponent(() => h('span', {}, 'Deep'));
    const Level4 = defineComponent(() => h('div', { class: 'l4' }, h(Level5, {})));
    const Level3 = defineComponent(() => h('div', { class: 'l3' }, h(Level4, {})));
    const Level2 = defineComponent(() => h('div', { class: 'l2' }, h(Level3, {})));
    const Level1 = defineComponent(() => h('div', { class: 'l1' }, h(Level2, {})));

    const html = renderToString(h(Level1, {}));
    expect(html).toContain('<span>Deep</span>');
    expect(html).toContain('class="l4"');
    expect(html).toContain('class="l3"');
  });

  it('应处理组件返回的 VNode 包含 null 子节点', () => {
    const Component = defineComponent(() => {
      return h('div', {}, 'A', null, 'B');
    });
    const html = renderToString(h(Component, {}));
    expect(html).toBe('<div>AB</div>');
  });

  it('应处理 select + option 组合', () => {
    const vnode = h('select', { name: 'color' },
      h('option', { value: 'red' }, 'Red'),
      h('option', { value: 'blue', selected: true }, 'Blue'),
      h('option', { value: 'green' }, 'Green')
    );
    const html = renderToString(vnode);
    expect(html).toContain('selected');
    expect(html).toContain('<option value="red">Red</option>');
  });

  it('应处理 textarea 元素', () => {
    const vnode = h('textarea', { name: 'comment', placeholder: 'Enter text' });
    const html = renderToString(vnode);
    expect(html).toContain('name="comment"');
    expect(html).toContain('placeholder="Enter text"');
  });
});
