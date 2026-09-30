/**
 * StateManager 单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { createStateManager } from '@/core/state';
import { batch } from '@/core';

describe('StateManager', () => {
  it('should create StateManager with empty initial state', () => {
    const state = createStateManager();
    expect(state.getState()).toEqual({});
  });

  it('should create StateManager with initial state', () => {
    const state = createStateManager({ count: 0, name: 'test' });
    expect(state.get<number>('count')).toBe(0);
    expect(state.get<string>('name')).toBe('test');
  });

  it('should get and set with simple path', () => {
    const state = createStateManager();
    state.set('count', 10);
    expect(state.get<number>('count')).toBe(10);
  });

  it('should get and set with nested path notation', () => {
    const state = createStateManager();
    state.set('player.currentTime', 42.5);
    expect(state.get<number>('player.currentTime')).toBe(42.5);
  });

  it('should auto-create intermediate objects for nested paths', () => {
    const state = createStateManager();
    state.set('a.b.c', 'deep');
    expect(state.get<string>('a.b.c')).toBe('deep');
    expect(state.get<Record<string, unknown>>('a.b')).toEqual({ c: 'deep' });
  });

  it('should return undefined for non-existent paths', () => {
    const state = createStateManager();
    expect(state.get('nonexistent')).toBeUndefined();
    expect(state.get('a.b.c')).toBeUndefined();
  });

  it('should subscribe to state changes', async () => {
    const state = createStateManager({ count: 0 });
    const listener = vi.fn();
    state.subscribe('count', listener);
    state.set('count', 5);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(5, 0));
  });

  it('should subscribe to nested path changes', async () => {
    const state = createStateManager({ player: { currentTime: 0 } });
    const listener = vi.fn();
    state.subscribe('player.currentTime', listener);
    state.set('player.currentTime', 10);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(10, 0));
  });

  it('should unsubscribe from state changes', () => {
    const state = createStateManager({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = state.subscribe('count', listener);
    unsubscribe();
    state.set('count', 5);
    expect(listener).not.toHaveBeenCalled();
  });

  it('should not trigger listener when value is same', () => {
    const state = createStateManager({ count: 5 });
    const listener = vi.fn();
    state.subscribe('count', listener);
    state.set('count', 5);
    expect(listener).not.toHaveBeenCalled();
  });

  it('should support silent set (no listener notification)', () => {
    const state = createStateManager({ count: 0 });
    const listener = vi.fn();
    state.subscribe('count', listener);
    state.set('count', 10, true);
    expect(listener).not.toHaveBeenCalled();
    expect(state.get<number>('count')).toBe(10);
  });

  it('should return deep copy from getState()', () => {
    const initial = { nested: { value: 1 } };
    const state = createStateManager(initial);
    const copy = state.getState();
    (copy as Record<string, unknown>).nested = { value: 999 };
    expect(state.get<number>('nested.value')).toBe(1);
  });

  it('should support multiple subscribers on same path', async () => {
    const state = createStateManager({ count: 0 });
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    state.subscribe('count', listener1);
    state.subscribe('count', listener2);
    state.set('count', 10);
    await vi.waitFor(() => expect(listener1).toHaveBeenCalledWith(10, 0));
    await vi.waitFor(() => expect(listener2).toHaveBeenCalledWith(10, 0));
  });

  it('should handle errors in subscribers gracefully', async () => {
    const state = createStateManager({ count: 0 });
    const errorListener = vi.fn(() => { throw new Error('test'); });
    const normalListener = vi.fn();
    state.subscribe('count', errorListener);
    state.subscribe('count', normalListener);
    expect(() => state.set('count', 5)).not.toThrow();
    await vi.waitFor(() => expect(normalListener).toHaveBeenCalled());
  });

  it('effect 触发机构尊重 batch：批量内多次 set 合并为一次通知', () => {
    const state = createStateManager({ count: 0 });
    const listener = vi.fn();
    state.subscribe('count', listener);

    batch(() => {
      state.set('count', 1);
      state.set('count', 2);
    });

    // 批量内两次 set 只触发一次通知，oldVal 为批量前的初始值
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(2, 0);
  });
});
