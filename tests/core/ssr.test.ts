import { describe, it, expect } from 'vitest';
import { h, defineComponent, renderToString, Fragment } from '@/core';

describe('renderToString', () => {
  it('should render null/undefined to empty string', () => {
    expect(renderToString(null)).toBe('');
    expect(renderToString(undefined)).toBe('');
  });

  it('should render text node', () => {
    expect(renderToString('Hello')).toBe('Hello');
  });

  it('should escape HTML special characters in text', () => {
    expect(renderToString('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should render simple element', () => {
    const vnode = h('div', {}, 'Hello');
    expect(renderToString(vnode)).toBe('<div>Hello</div>');
  });

  it('should render element with class', () => {
    const vnode = h('div', { class: 'container active' }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="container active">Content</div>');
  });

  it('should render element with id', () => {
    const vnode = h('div', { id: 'app' }, 'Content');
    expect(renderToString(vnode)).toBe('<div id="app">Content</div>');
  });

  it('should skip ref attribute', () => {
    const vnode = h('div', { ref: { current: null }, class: 'test' }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('should skip event handlers', () => {
    const vnode = h('div', { onClick: () => {}, class: 'test' }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('should render boolean attribute', () => {
    const vnode = h('input', { disabled: true });
    expect(renderToString(vnode)).toBe('<input disabled>');
  });

  it('should render void elements without closing tag', () => {
    expect(renderToString(h('br'))).toBe('<br>');
    expect(renderToString(h('img', { src: 'test.jpg', alt: 'test' }))).toBe(
      '<img src="test.jpg" alt="test">'
    );
    expect(renderToString(h('input', { type: 'text' }))).toBe('<input type="text">');
  });

  it('should render nested elements', () => {
    const vnode = h('div', { class: 'outer' },
      h('span', { class: 'inner' }, 'Hello')
    );
    expect(renderToString(vnode)).toBe('<div class="outer"><span class="inner">Hello</span></div>');
  });

  it('should render multiple children', () => {
    const vnode = h('ul', {},
      h('li', {}, 'Item 1'),
      h('li', {}, 'Item 2')
    );
    expect(renderToString(vnode)).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('should render style object', () => {
    const vnode = h('div', { style: { color: 'red', fontSize: '16px' } }, 'Styled');
    const html = renderToString(vnode);
    expect(html).toContain('style="');
    expect(html).toContain('color: red');
    expect(html).toContain('font-size: 16px');
  });

  it('should render data attributes', () => {
    const vnode = h('div', { 'data-screen': 'full', 'data-ctrl-hidden': 'false' }, 'Content');
    expect(renderToString(vnode)).toBe('<div data-screen="full" data-ctrl-hidden="false">Content</div>');
  });

  it('should render function component', () => {
    const MyComponent = defineComponent((props: { name: string }) => {
      return h('span', { class: 'greeting' }, `Hello ${props.name}`);
    });
    const vnode = h(MyComponent, { name: 'World' });
    expect(renderToString(vnode)).toBe('<span class="greeting">Hello World</span>');
  });

  it('should render nested components', () => {
    const Child = defineComponent((props: { text: string }) => {
      return h('span', {}, props.text);
    });
    const Parent = defineComponent(() => {
      return h('div', {}, h(Child, { text: 'Child Content' }));
    });
    const vnode = h(Parent, {});
    expect(renderToString(vnode)).toBe('<div><span>Child Content</span></div>');
  });

  it('should skip undefined attribute values', () => {
    const vnode = h('div', { class: 'test', id: undefined }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('should skip empty class', () => {
    const vnode = h('div', { class: '' }, 'Content');
    expect(renderToString(vnode)).toBe('<div>Content</div>');
  });

  it('should render aria-label attribute', () => {
    const vnode = h('div', { 'aria-label': 'Player' }, 'Content');
    expect(renderToString(vnode)).toBe('<div aria-label="Player">Content</div>');
  });

  it('should render hidden attribute', () => {
    const vnode = h('div', { hidden: true }, 'Hidden');
    expect(renderToString(vnode)).toBe('<div hidden>Hidden</div>');
  });
});
