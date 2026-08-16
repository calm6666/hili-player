/**
 * DashPlugin 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dashjs
vi.mock('dashjs', () => ({
  MediaPlayer: vi.fn(() => ({
    create: vi.fn(() => ({
      initialize: vi.fn(),
      attachSource: vi.fn(),
      updateSettings: vi.fn(),
      on: vi.fn(),
      reset: vi.fn(),
      destroy: vi.fn(),
      seek: vi.fn(),
      time: vi.fn(() => 0),
      duration: vi.fn(() => 0),
      getCurrentRepresentationForType: vi.fn(() => null),
      getAverageThroughput: vi.fn(() => 0),
      getRepresentationsByType: vi.fn(() => []),
      setRepresentationForTypeByIndex: vi.fn(),
    })),
  })),
}));

vi.mock('@/hili-player/utils/browserCapabilityDetector', () => ({
  BrowserCapabilityDetector: {
    getFullCapabilityResult: () => ({
      browserName: 'Chrome',
      browserVersion: '120',
      osName: 'Windows',
      osVersion: '10',
      hlsjsSupported: true,
      dashSupported: true,
      flvjsSupported: true,
      mseSupported: true,
    }),
    isDASHSupported: () => true,
  },
}));

vi.mock('../vendor/manifest-to-dash', () => ({
  manifestToDash: vi.fn(() => ({})),
}));

import { DashPlugin, createDashPlugin } from '@/hili-player/plugins/dash/DashPlugin';

function createMockPlayer() {
  return {
    events: {
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      emit: vi.fn(),
    },
    props: { debug: false },
  } as any;
}

describe('DashPlugin', () => {
  let plugin: DashPlugin;
  let player: ReturnType<typeof createMockPlayer>;

  beforeEach(() => {
    plugin = new DashPlugin();
    player = createMockPlayer();
  });

  it('should create DashPlugin instance', () => {
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('dash');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.type).toBe('dash');
  });

  it('should install plugin and save player reference', () => {
    plugin.install(player);
    expect(plugin.getPlayer()).toBe(player);
    expect(plugin.eventBus).toBe(player.events);
  });

  it('should listen for player:mounted event on install', () => {
    plugin.install(player);
    expect(player.events.on).toHaveBeenCalledWith('player:mounted', expect.any(Function));
  });

  it('should uninstall plugin and clean up', () => {
    plugin.install(player);
    plugin.uninstall(player);
    expect(plugin.getPlayer()).toBeNull();
    expect(plugin.eventBus).toBeNull();
    expect(plugin.videoElement).toBeNull();
  });

  it('should create plugin via factory function', () => {
    const factoryPlugin = createDashPlugin();
    expect(factoryPlugin).toBeDefined();
    expect(factoryPlugin.name).toBe('dash');
  });

  it('should accept custom config', () => {
    const customPlugin = new DashPlugin({
      autoplay: false,
      streaming: {
        abr: { autoSwitchBitrate: false },
        buffer: { fastSwitchEnabled: false },
      },
    });
    expect(customPlugin).toBeDefined();
  });

  it('should return null config before load', () => {
    expect(plugin.getConfig()).toBeNull();
  });

  it('should return browser capability after install', () => {
    plugin.install(player);
    const cap = plugin.getBrowserCapability();
    expect(cap).toBeDefined();
    expect(cap?.dashSupported).toBe(true);
  });

  it('should not load when video element is not set', () => {
    plugin.install(player);
    const emitSpy = vi.spyOn(player.events, 'emit');
    plugin.load({ url: 'test.mpd', format: 'dash' });
    expect(emitSpy).toHaveBeenCalledWith('STREAM_ERROR', expect.objectContaining({ message: expect.any(String) }));
  });

  it('should destroy dash player on destroy', () => {
    plugin.install(player);
    plugin.destroy();
    expect(plugin.getConfig()).toBeNull();
  });
});
