/**
 * DanmakuPlugin 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DanmakuManager
vi.mock('@/hili-player/plugins/utils/danmaku', () => ({
  DanmakuManager: vi.fn().mockImplementation(() => ({
    addDanmaku: vi.fn(),
    sendDanmaku: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    clear: vi.fn(),
    setOpacity: vi.fn(),
    setSpeed: vi.fn(),
    setFontSize: vi.fn(),
    setArea: vi.fn(),
    setRenderMode: vi.fn(),
    switchScreenMode: vi.fn(),
    setFilter: vi.fn(),
    setMaskConfig: vi.fn(),
    setDensity: vi.fn(),
    setVisible: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
    setOnDanmakuHover: vi.fn(),
    getStats: vi.fn(() => ({
      scheduler: { totalLoaded: 0 },
      active: 0,
      total: 0,
    })),
  })),
}));

import { DanmakuPlugin, createDanmakuPlugin } from '@/hili-player/plugins/danmaku/DanmakuPlugin';
import type { DanmakuPluginAPI } from '@/hili-player/plugins/danmaku/DanmakuPlugin';

function createMockPlayer() {
  const listeners = new Map<string, Set<Function>>();
  return {
    events: {
      on: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(handler);
        return () => { listeners.get(event)?.delete(handler); };
      }),
      off: vi.fn(),
      emit: vi.fn((event: string, data?: any) => {
        listeners.get(event)?.forEach(fn => fn(data));
      }),
    },
    props: { debug: false },
  } as any;
}

describe('DanmakuPlugin', () => {
  let plugin: DanmakuPluginAPI;
  let player: ReturnType<typeof createMockPlayer>;

  beforeEach(() => {
    plugin = DanmakuPlugin();
    player = createMockPlayer();
  });

  it('should create DanmakuPlugin instance', () => {
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('danmaku');
    expect(plugin.version).toBe('1.0.0');
  });

  it('should install plugin and subscribe to events', () => {
    plugin.install(player);
    expect(player.events.on).toHaveBeenCalled();
  });

  it('should create plugin via factory function', () => {
    const factoryPlugin = createDanmakuPlugin();
    expect(factoryPlugin.name).toBe('danmaku');
  });

  it('should create plugin with custom config', () => {
    const customPlugin = DanmakuPlugin({
      callbacks: {
        onSend: vi.fn(),
        onSendSuccess: vi.fn(),
        onSendError: vi.fn(),
      },
    });
    expect(customPlugin).toBeDefined();
  });

  it('should unsubscribe all events on uninstall', () => {
    plugin.install(player);
    plugin.uninstall();
    // After uninstall, emitting events should not cause errors
    expect(() => player.events.emit('PLAY')).not.toThrow();
  });

  it('should expose danmaku API methods', () => {
    expect(typeof plugin.loadDanmaku).toBe('function');
    expect(typeof plugin.setVisible).toBe('function');
    expect(typeof plugin.send).toBe('function');
    expect(typeof plugin.sendBatch).toBe('function');
    expect(typeof plugin.play).toBe('function');
    expect(typeof plugin.pause).toBe('function');
    expect(typeof plugin.stop).toBe('function');
    expect(typeof plugin.clear).toBe('function');
    expect(typeof plugin.setOpacity).toBe('function');
    expect(typeof plugin.setSpeed).toBe('function');
    expect(typeof plugin.setFontSize).toBe('function');
    expect(typeof plugin.setArea).toBe('function');
    expect(typeof plugin.setRenderMode).toBe('function');
    expect(typeof plugin.setScreenMode).toBe('function');
    expect(typeof plugin.setFilter).toBe('function');
    expect(typeof plugin.setMaskConfig).toBe('function');
    expect(typeof plugin.setDensity).toBe('function');
    expect(typeof plugin.getStats).toBe('function');
    expect(typeof plugin.seek).toBe('function');
    expect(typeof plugin.resize).toBe('function');
  });

  it('should return null manager before install', () => {
    expect(plugin.getManager()).toBeNull();
  });

  it('should return null stats before manager is created', () => {
    expect(plugin.getStats()).toBeNull();
  });

  it('should handle setVisible', () => {
    expect(() => plugin.setVisible(true)).not.toThrow();
    expect(() => plugin.setVisible(false)).not.toThrow();
  });

  it('should handle loadDanmaku with empty array', () => {
    expect(() => plugin.loadDanmaku([])).not.toThrow();
  });

  it('should handle send with danmaku item', () => {
    expect(() => plugin.send({ id: 1, text: 'test', time: 0, type: 1 })).not.toThrow();
  });

  it('should handle play/pause/stop/clear', () => {
    expect(() => plugin.play()).not.toThrow();
    expect(() => plugin.pause()).not.toThrow();
    expect(() => plugin.stop()).not.toThrow();
    expect(() => plugin.clear()).not.toThrow();
  });

  it('should handle setOpacity', () => {
    expect(() => plugin.setOpacity(0.5)).not.toThrow();
  });
});
