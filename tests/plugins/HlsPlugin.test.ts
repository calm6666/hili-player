/**
 * HlsPlugin 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock hls.js
vi.mock('hls.js', () => {
  const mockHls = {
    attachMedia: vi.fn(),
    loadSource: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    stopLoad: vi.fn(),
    destroy: vi.fn(),
    startLoad: vi.fn(),
    recoverMediaError: vi.fn(),
    loadManifest: vi.fn(),
    levels: [],
    currentLevel: -1,
    Events: {
      MEDIA_ATTACHED: 'MEDIA_ATTACHED',
      MANIFEST_PARSED: 'MANIFEST_PARSED',
      ERROR: 'ERROR',
      FRAG_LOADED: 'FRAG_LOADED',
      LEVEL_SWITCHED: 'LEVEL_SWITCHED',
      BUFFER_APPENDED: 'BUFFER_APPENDED',
    },
    ErrorTypes: {
      NETWORK_ERROR: 'NETWORK_ERROR',
      MEDIA_ERROR: 'MEDIA_ERROR',
    },
  };
  return {
    default: {
      ...mockHls,
      isSupported: vi.fn(() => true),
    },
    __mockHlsInstance: mockHls,
  };
});

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
    checkHlsjsSupport: () => ({ supported: true, detail: 'MSE supported' }),
  },
}));

vi.mock('../vendor/manifest-to-hls', () => ({
  manifestToHls: vi.fn(() => ({
    variants: [],
    audioGroups: [],
  })),
}));

import { HlsPlugin, createHlsPlugin } from '@/hili-player/plugins/hls/HlsPlugin';

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

describe('HlsPlugin', () => {
  let plugin: HlsPlugin;
  let player: ReturnType<typeof createMockPlayer>;

  beforeEach(() => {
    plugin = new HlsPlugin();
    player = createMockPlayer();
  });

  it('should create HlsPlugin instance', () => {
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('hls');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.type).toBe('hls');
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
    const factoryPlugin = createHlsPlugin({ autoplay: false });
    expect(factoryPlugin).toBeDefined();
    expect(factoryPlugin.name).toBe('hls');
  });

  it('should accept custom config', () => {
    const customPlugin = new HlsPlugin({
      autoplay: false,
      useLocalHls: true,
      startLevel: 0,
      maxBufferLength: 60,
    });
    expect(customPlugin).toBeDefined();
  });

  it('should return null config before load', () => {
    expect(plugin.getConfig()).toBeNull();
  });

  it('should return null browser capability before install', () => {
    expect(plugin.getBrowserCapability()).toBeNull();
  });

  it('should return browser capability after install', () => {
    plugin.install(player);
    const cap = plugin.getBrowserCapability();
    expect(cap).toBeDefined();
    expect(cap?.hlsjsSupported).toBe(true);
  });

  it('should not load when video element is not set', () => {
    plugin.install(player);
    const emitSpy = vi.spyOn(player.events, 'emit');
    plugin.load({ url: 'test.m3u8', format: 'hls' });
    expect(emitSpy).toHaveBeenCalledWith('STREAM_ERROR', expect.objectContaining({ message: expect.any(String) }));
  });

  it('should destroy hls player on destroy', () => {
    plugin.install(player);
    plugin.destroy();
    // No error should be thrown
    expect(plugin.getConfig()).toBeNull();
  });
});
