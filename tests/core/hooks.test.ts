/**
 * HookSystem 单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { createHookSystem } from '@/core/hooks';

describe('HookSystem', () => {
  it('should create a HookSystem instance', () => {
    const hooks = createHookSystem();
    expect(hooks).toBeDefined();
    expect(typeof hooks.register).toBe('function');
    expect(typeof hooks.run).toBe('function');
  });

  it('should register and execute a hook', () => {
    const hooks = createHookSystem();
    const handler = vi.fn((ctx: { url: string }) => ({ url: ctx.url + '?t=1' }));
    hooks.register('before:load', handler);
    const result = hooks.run<{ url: string }, { url: string }>('before:load', { url: 'video.mp4' });
    expect(handler).toHaveBeenCalledWith({ url: 'video.mp4' });
    expect(result.url).toBe('video.mp4?t=1');
  });

  it('should execute multiple hooks in registration order', () => {
    const hooks = createHookSystem();
    const order: number[] = [];
    hooks.register('test', (ctx: { value: number }) => {
      order.push(1);
      return { value: ctx.value + 1 };
    });
    hooks.register('test', (ctx: { value: number }) => {
      order.push(2);
      return { value: ctx.value * 10 };
    });
    const result = hooks.run<{ value: number }, { value: number }>('test', { value: 1 });
    expect(order).toEqual([1, 2]);
    // First hook: 1 + 1 = 2, Second hook: 2 * 10 = 20
    expect(result.value).toBe(20);
  });

  it('should remove hook via unregister function', () => {
    const hooks = createHookSystem();
    const handler = vi.fn((ctx: { value: number }) => ({ value: ctx.value + 1 }));
    const unregister = hooks.register('test', handler);
    unregister();
    const result = hooks.run<{ value: number }, { value: number }>('test', { value: 1 });
    expect(handler).not.toHaveBeenCalled();
    expect(result.value).toBe(1);
  });

  it('should return original context when no hooks registered', () => {
    const hooks = createHookSystem();
    const result = hooks.run<{ value: number }, { value: number }>('nonexistent', { value: 42 });
    expect(result.value).toBe(42);
  });

  it('should handle hooks that return undefined (pass through context)', () => {
    const hooks = createHookSystem();
    hooks.register('test', (_ctx: { value: number }) => {
      // Returns undefined, context should pass through
    });
    const result = hooks.run<{ value: number }, { value: number }>('test', { value: 5 });
    expect(result.value).toBe(5);
  });

  it('should handle errors in hooks gracefully', () => {
    const hooks = createHookSystem();
    const normalHandler = vi.fn((ctx: { value: number }) => ({ value: ctx.value + 1 }));
    hooks.register('test', () => { throw new Error('hook error'); });
    hooks.register('test', normalHandler);
    expect(() => hooks.run('test', { value: 1 })).not.toThrow();
    // The normal handler should still be called with the original context
    expect(normalHandler).toHaveBeenCalled();
  });

  it('should support different hook names independently', () => {
    const hooks = createHookSystem();
    const handlerA = vi.fn((ctx: { v: number }) => ({ v: ctx.v + 1 }));
    const handlerB = vi.fn((ctx: { v: number }) => ({ v: ctx.v * 2 }));
    hooks.register('hook:a', handlerA);
    hooks.register('hook:b', handlerB);
    hooks.run('hook:a', { v: 1 });
    expect(handlerA).toHaveBeenCalled();
    expect(handlerB).not.toHaveBeenCalled();
  });
});
