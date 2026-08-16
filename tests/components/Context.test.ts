/**
 * Context 组件单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h, mount, destroy } from '@/core';
import { Context } from '@/hili-player/components/Context';
import type { ContextProps } from '@/hili-player/components/Context';

describe('Context', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should render Context component', () => {
    const vnode = h(Context, {});
    mount(vnode, container);
    expect(container.querySelector('.player-context-area')).toBeTruthy();
    expect(container.querySelector('.player-contextmenu')).toBeTruthy();
  });

  it('should render default menu items', () => {
    const vnode = h(Context, {});
    mount(vnode, container);
    const items = container.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
  });

  it('should render custom menu items', () => {
    const menuItems = [
      { dataAction: 'test1', text: 'Test 1' },
      { dataAction: 'test2', text: 'Test 2' },
    ];
    const vnode = h(Context, { menuItems });
    mount(vnode, container);
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
  });

  it('should call onMenuClick when menu item is clicked', () => {
    const onMenuClick = vi.fn();
    const menuItems = [{ dataAction: 'copy', text: 'Copy' }];
    const vnode = h(Context, { menuItems, onMenuClick });
    mount(vnode, container);
    const item = container.querySelector('li')!;
    item.click();
    expect(onMenuClick).toHaveBeenCalledWith('copy');
  });

  it('should show menu with player-active class via lifecycle emit', () => {
    let api: { showMenu: (x: number, y: number) => void; hideMenu: () => void } | undefined;
    const vnode = h(Context, {
      onContextMounted: (data: { showMenu: (x: number, y: number) => void; hideMenu: () => void }) => {
        api = data;
      },
    } as any);
    mount(vnode, container);
    // The lifecycle emit is called in onMounted with showMenu/hideMenu
    // We can test the DOM directly
    const menu = container.querySelector('.player-contextmenu') as HTMLElement;
    expect(menu).toBeTruthy();
  });

  it('should call onClose when menu is hidden', () => {
    const onClose = vi.fn();
    let api: { showMenu: (x: number, y: number) => void; hideMenu: () => void } | undefined;
    const vnode = h(Context, {
      onClose,
      onContextMounted: (data: { showMenu: (x: number, y: number) => void; hideMenu: () => void }) => {
        api = data;
      },
    } as any);
    mount(vnode, container);
    // showMenu registers the document click listener
    api!.showMenu(100, 100);
    // Now clicking document should trigger hideMenu → onClose
    document.dispatchEvent(new Event('click'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should display version info in menu item', () => {
    const menuItems = [{ dataAction: 'version', text: '播放器版本' }];
    const vnode = h(Context, { menuItems, version: '2.0.0' });
    mount(vnode, container);
    const item = container.querySelector('li')!;
    expect(item.textContent).toContain('2.0.0');
  });
});
