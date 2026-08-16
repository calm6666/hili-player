import { describe, it, expect, beforeEach } from 'vitest';
import {
  h,
  _createEl,
  _createStaticEl,
  _createSvgEl,
  _cloneHoisted,
  createContext,
  mount,
  destroy,
  renderToString,
} from '@/core';

/**
 * 编译路径（vite-plugin-hili-compile 产物）回归测试
 *
 * 覆盖 P0 修复：_create* 系列函数必须与 h() 元素分支一样，
 * 从 attrs 中提取 __providers 到 vnode.__providers，
 * 否则 __providers 会残留在 attrs 中，被当作 DOM 属性设置，
 * 且 useContext 沿 __parent 链找不到 Provider。
 */
describe('internal _create* functions (compiled path)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('_createEl should extract __providers from attrs', () => {
    const ctx = createContext<string>('default');
    const providers = [{ contextId: ctx.id, value: 'hello' }];

    const vnode = _createEl('div', { class: 'test', __providers: providers });

    expect(vnode.__providers).toBe(providers);
    expect(vnode.attrs.__providers).toBeUndefined();
    expect(vnode.attrs.class).toBe('test');
  });

  it('_createStaticEl should extract __providers from attrs', () => {
    const ctx = createContext<number>(0);
    const providers = [{ contextId: ctx.id, value: 42 }];

    const vnode = _createStaticEl('div', { __providers: providers }, 'Content');

    expect(vnode.__providers).toBe(providers);
    expect(vnode.attrs.__providers).toBeUndefined();
    expect(vnode.children).toEqual(['Content']);
  });

  it('_createSvgEl should extract __providers from attrs', () => {
    const ctx = createContext<boolean>(false);
    const providers = [{ contextId: ctx.id, value: true }];

    const vnode = _createSvgEl('svg', { __providers: providers });

    expect(vnode.__providers).toBe(providers);
    expect(vnode.attrs.__providers).toBeUndefined();
    expect(vnode.__ns).toBe('http://www.w3.org/2000/svg');
  });

  it('should not set __providers as DOM attribute when mounting', () => {
    const ctx = createContext<string>('default');
    const providers = [{ contextId: ctx.id, value: 'hello' }];

    const vnode = _createEl('div', { class: 'test', __providers: providers });
    mount(vnode, container);

    const el = container.firstChild as HTMLElement;
    expect(el.hasAttribute('__providers')).toBe(false);
    expect(el.getAttribute('class')).toBe('test');
  });

  it('should not serialize __providers in SSR', () => {
    const ctx = createContext<string>('default');
    const providers = [{ contextId: ctx.id, value: 'hello' }];

    const vnode = _createEl('div', { class: 'test', __providers: providers }, 'Content');
    expect(renderToString(vnode)).toBe('<div class="test">Content</div>');
  });

  it('should keep __providers extraction behavior consistent with h()', () => {
    const ctx = createContext<string>('default');
    const providers = [{ contextId: ctx.id, value: 'hello' }];

    // dev 路径参照物：h() 的元素分支提取 __providers
    const hVnode = h('div', { __providers: providers });
    // 编译路径：_createEl 必须产生一致的结构
    const compiledVnode = _createEl('div', { __providers: providers });

    expect(compiledVnode.__providers).toEqual(hVnode.__providers);
    expect(compiledVnode.attrs).toEqual(hVnode.attrs);
  });

  it('_cloneHoisted 克隆静态提升节点，多次挂载互不污染', () => {
    // 模拟编译产物：静态提升的共享常量被两个使用点克隆后挂载
    const shared = _createStaticEl('div', { class: 'hoisted' }, 'text');
    const c1 = document.createElement('div');
    const c2 = document.createElement('div');

    const tree1 = _cloneHoisted(shared);
    const tree2 = _cloneHoisted(shared);
    mount(tree1, c1);
    mount(tree2, c2);

    // 两个容器都正常挂载，且共享常量本身不被污染
    expect(c1.childNodes.length).toBe(1);
    expect(c2.childNodes.length).toBe(1);
    expect(c1.firstChild).not.toBe(c2.firstChild);
    expect(shared.el).toBeUndefined();

    // 销毁其中一棵树只影响自己的 DOM
    destroy(tree1);
    expect(c1.childNodes.length).toBe(0);
    expect(c2.childNodes.length).toBe(1);
  });
});
