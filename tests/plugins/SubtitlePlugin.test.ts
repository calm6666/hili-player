/**
 * SubtitlePlugin 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock subtitle parser
vi.mock('@/utils/subtitle', () => ({
  parseSubtitle: vi.fn(() => ({
    items: [
      { startTime: 0, endTime: 5, text: 'Hello' },
      { startTime: 5, endTime: 10, text: 'World' },
    ],
  })),
}));

import { SubtitlePlugin, createSubtitlePlugin } from '@/hili-player/plugins/subtitle/SubtitlePlugin';
import type { SubtitlePluginAPI } from '@/hili-player/plugins/subtitle/SubtitlePlugin';

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

describe('SubtitlePlugin', () => {
  let plugin: SubtitlePluginAPI;
  let player: ReturnType<typeof createMockPlayer>;

  beforeEach(() => {
    plugin = SubtitlePlugin();
    player = createMockPlayer();
  });

  it('should create SubtitlePlugin instance', () => {
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('subtitle');
    expect(plugin.version).toBe('1.0.0');
  });

  it('should install plugin and subscribe to events', () => {
    plugin.install(player);
    expect(player.events.on).toHaveBeenCalled();
  });

  it('should create plugin via factory function', () => {
    const factoryPlugin = createSubtitlePlugin();
    expect(factoryPlugin.name).toBe('subtitle');
  });

  it('should create plugin with custom config', () => {
    const customPlugin = SubtitlePlugin({
      sources: [{ src: 'test.srt', lang: 'zh', label: '中文' }],
      fontSize: 20,
      color: '#ffffff',
      position: 'bottom',
    });
    expect(customPlugin).toBeDefined();
  });

  it('should unsubscribe all events on uninstall', () => {
    plugin.install(player);
    plugin.uninstall();
    expect(() => player.events.emit('PLAY')).not.toThrow();
  });

  it('should expose subtitle API methods', () => {
    expect(typeof plugin.load).toBe('function');
    expect(typeof plugin.unload).toBe('function');
    expect(typeof plugin.show).toBe('function');
    expect(typeof plugin.hide).toBe('function');
    expect(typeof plugin.setStyle).toBe('function');
    expect(typeof plugin.setOffset).toBe('function');
    expect(typeof plugin.getCurrentSubtitle).toBe('function');
    expect(typeof plugin.seek).toBe('function');
    expect(typeof plugin.switchLanguage).toBe('function');
    expect(typeof plugin.toggle).toBe('function');
    expect(typeof plugin.setVisible).toBe('function');
    expect(typeof plugin.setFontSize).toBe('function');
    expect(typeof plugin.setColor).toBe('function');
    expect(typeof plugin.setBackgroundColor).toBe('function');
    expect(typeof plugin.setStroke).toBe('function');
    expect(typeof plugin.setPosition).toBe('function');
    expect(typeof plugin.getStatus).toBe('function');
  });

  it('should return null current subtitle before load', () => {
    expect(plugin.getCurrentSubtitle()).toBeNull();
  });

  it('should return status with default values', () => {
    const status = plugin.getStatus();
    expect(status).toBeDefined();
    expect(typeof status.visible).toBe('boolean');
    expect(typeof status.fontSize).toBe('number');
    expect(typeof status.color).toBe('string');
    expect(typeof status.position).toBe('string');
    expect(typeof status.itemCount).toBe('number');
    expect(typeof status.timeOffset).toBe('number');
  });

  it('should handle show/hide', () => {
    expect(() => plugin.show()).not.toThrow();
    expect(() => plugin.hide()).not.toThrow();
  });

  it('should handle setVisible', () => {
    expect(() => plugin.setVisible(true)).not.toThrow();
    expect(() => plugin.setVisible(false)).not.toThrow();
  });

  it('should handle setFontSize', () => {
    expect(() => plugin.setFontSize(24)).not.toThrow();
  });

  it('should handle setColor', () => {
    expect(() => plugin.setColor('#ff0000')).not.toThrow();
  });

  it('should handle setBackgroundColor', () => {
    expect(() => plugin.setBackgroundColor('rgba(0,0,0,0.5)')).not.toThrow();
  });

  it('should handle setStroke', () => {
    expect(() => plugin.setStroke('#000000', 2)).not.toThrow();
  });

  it('should handle setPosition', () => {
    expect(() => plugin.setPosition('top')).not.toThrow();
    expect(() => plugin.setPosition('middle')).not.toThrow();
    expect(() => plugin.setPosition('bottom', 80)).not.toThrow();
  });

  it('should handle setOffset', () => {
    expect(() => plugin.setOffset(2)).not.toThrow();
  });

  it('should handle toggle', () => {
    const result = plugin.toggle();
    expect(typeof result).toBe('boolean');
  });

  it('should handle unload', () => {
    expect(() => plugin.unload()).not.toThrow();
  });
});
