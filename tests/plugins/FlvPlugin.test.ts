/**
 * FlvPlugin 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock flv.js
vi.mock('flv.js', () => ({
  default: {
    createPlayer: vi.fn(() => ({
      attachMediaElement: vi.fn(),
      load: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      unload: vi.fn(),
      detachMediaElement: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      buffered: { length: 0 },
      mediaInfo: null,
      statisticsInfo: null,
    })),
    isSupported: vi.fn(() => true),
    Events: {
      ERROR: 'ERROR',
      MEDIA_INFO: 'MEDIA_INFO',
      METADATA_ARRIVED: 'METADATA_ARRIVED',
      LOADING_COMPLETE: 'LOADING_COMPLETE',
      STATISTICS_INFO: 'STATISTICS_INFO',
      RECOVERED_EARLY_EOF: 'RECOVERED_EARLY_EOF',
    },
  },
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
  },
}));

import { FlvPlugin, createFlvPlugin } from '@/hili-player/plugins/flv/FlvPlugin';

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

describe('FlvPlugin', () => {
  let plugin: FlvPlugin;
  let player: ReturnType<typeof createMockPlayer>;

  beforeEach(() => {
    plugin = new FlvPlugin();
    player = createMockPlayer();
  });

  it('should create FlvPlugin instance', () => {
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('flv');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.type).toBe('flv');
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
    const factoryPlugin = createFlvPlugin();
    expect(factoryPlugin).toBeDefined();
    expect(factoryPlugin.name).toBe('flv');
  });

  it('should accept custom config', () => {
    const customPlugin = new FlvPlugin({
      isLive: true,
      autoplay: true,
      liveTargetLatency: 3,
      liveMaxLatency: 10,
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
    expect(cap?.flvjsSupported).toBe(true);
  });

  it('should not load when video element is not set', () => {
    plugin.install(player);
    const emitSpy = vi.spyOn(player.events, 'emit');
    plugin.load({ url: 'test.flv', format: 'flv' });
    expect(emitSpy).toHaveBeenCalledWith('STREAM_ERROR', expect.objectContaining({ message: expect.any(String) }));
  });

  it('should return empty qualities list (FLV does not support multi-bitrate)', () => {
    const qualities = plugin.getQualities();
    expect(qualities).toEqual([]);
  });

  it('should warn when setting quality (FLV does not support)', () => {
    expect(() => plugin.setQuality('720p')).not.toThrow();
  });

  it('should return initial retry count', () => {
    expect(plugin.getRetryCount()).toBe(0);
  });

  it('should destroy flv player on destroy', () => {
    plugin.install(player);
    plugin.destroy();
    expect(plugin.getConfig()).toBeNull();
  });
});
