/**
 * EventBus 单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '@/core/eventBus';

describe('EventBus', () => {
  it('should create an EventBus instance', () => {
    const bus = createEventBus();
    expect(bus).toBeDefined();
    expect(typeof bus.on).toBe('function');
    expect(typeof bus.off).toBe('function');
    expect(typeof bus.emit).toBe('function');
  });

  it('should listen and emit basic event', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event');
    expect(handler).toHaveBeenCalled();
  });

  it('should emit event with data payload', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on<{ message: string }>('test:event', handler);
    bus.emit('test:event', { message: 'hello' });
    expect(handler).toHaveBeenCalledWith({ message: 'hello' });
  });

  it('should support multiple listeners on same event', () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('test:event', handler1);
    bus.on('test:event', handler2);
    bus.emit('test:event', 'data');
    expect(handler1).toHaveBeenCalledWith('data');
    expect(handler2).toHaveBeenCalledWith('data');
  });

  it('should remove listener via off()', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.off('test:event', handler);
    bus.emit('test:event');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return unsubscribe function from on()', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.on('test:event', handler);
    unsubscribe();
    bus.emit('test:event');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should not call listeners for different events', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('event:a', handler);
    bus.emit('event:b');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle emit with no listeners gracefully', () => {
    const bus = createEventBus();
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  it('should handle errors in listeners gracefully', () => {
    const bus = createEventBus();
    const errorHandler = vi.fn(() => { throw new Error('test error'); });
    const normalHandler = vi.fn();
    bus.on('test', errorHandler);
    bus.on('test', normalHandler);
    // Should not throw, and other listeners should still be called
    expect(() => bus.emit('test')).not.toThrow();
    expect(normalHandler).toHaveBeenCalled();
  });

  it('should support type-safe event handling', () => {
    const bus = createEventBus();
    const handler = vi.fn((payload: { count: number }) => {
      expect(payload.count).toBe(42);
    });
    bus.on<{ count: number }>('count:event', handler);
    bus.emit('count:event', { count: 42 });
    expect(handler).toHaveBeenCalled();
  });
});
