/**
 * VideoPlayer 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerEventEnum } from '@/core/events';
import { PlayerStateKeyEnum } from '@/store/runtimeState';

// Mock external dependencies before importing
vi.mock('@/hili-player/styles/index.scss', () => ({}));
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
vi.mock('@/hili-player/utils/media/streamMiddleware', () => ({
  StreamMiddleware: vi.fn().mockImplementation(() => ({
    registerStreamPlugin: vi.fn(),
    unregisterStreamPlugin: vi.fn(),
  })),
}));
vi.mock('@/hili-player/components/PlayerDocker', () => ({
  PlayerDocker: vi.fn(),
}));

// 创建可存储值的 mock state manager
function createMockStateManager() {
  const store: Record<string, unknown> = {};
  return {
    get: vi.fn((key: string) => store[key]),
    set: vi.fn((key: string, value: unknown) => { store[key] = value; }),
    subscribe: vi.fn(() => vi.fn()),
    getState: vi.fn(() => store),
  };
}

vi.mock('@/core', () => ({
  h: vi.fn(() => ({ tag: 'div', attrs: {}, children: [] })),
  mount: vi.fn(),
  destroy: vi.fn(),
  createStateManager: vi.fn(() => createMockStateManager()),
  createTypedStateManager: vi.fn(() => createMockStateManager()),
  createEventBus: vi.fn(() => ({
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
  })),
  createTypedEventBus: vi.fn(() => ({
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));
vi.mock('@/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  loggerManager: { setLevel: vi.fn() },
  LogLevel: { DEBUG: 0, SILENT: 5 },
  isBrowser: () => true,
}));
vi.mock('../utils', () => ({
  EventEmitter: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
  fullscreen: {
    isActive: vi.fn(() => false),
    toggle: vi.fn(),
  },
  pip: {
    isActive: vi.fn(() => false),
    toggle: vi.fn(),
  },
  clamp: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),
}));
vi.mock('@/hili-player/store', () => ({
  createPlayerStore: vi.fn(() => ({
    getPersistentState: () => ({
      volume: 1,
      isMuted: false,
      playbackRate: 1,
    }),
    setPlaying: vi.fn(),
    setPaused: vi.fn(),
    setEnded: vi.fn(),
    setLoading: vi.fn(),
    setWaiting: vi.fn(),
    setDuration: vi.fn(),
    setBuffered: vi.fn(),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setPlaybackRate: vi.fn(),
    setScreenMode: vi.fn(),
    setPip: vi.fn(),
  })),
}));

// Polyfill TimeRanges for jsdom
class MockTimeRanges {
  private _ranges: { start: number; end: number }[] = [];
  length = 0;
  start(_index: number) { return 0; }
  end(_index: number) { return 0; }
}
if (typeof globalThis.TimeRanges === 'undefined') {
  (globalThis as any).TimeRanges = MockTimeRanges;
}

import { VideoPlayer } from '@/hili-player/player/VideoPlayer';
import type { PlayerConfig } from '@/types';

describe('VideoPlayer', () => {
  let player: VideoPlayer;
  let config: PlayerConfig;

  beforeEach(() => {
    config = { src: 'test.mp4' };
    player = new VideoPlayer(config);
  });

  it('should create VideoPlayer instance', () => {
    expect(player).toBeDefined();
    expect(player.props).toBeDefined();
    expect(player.state).toBeDefined();
    expect(player.events).toBeDefined();
  });

  it('should merge default config', () => {
    expect(player.props.autoplay).toBe(false);
    expect(player.props.muted).toBe(false);
    expect(player.props.controls).toBe(true);
    expect(player.props.loop).toBe(false);
  });

  it('should override default config with user config', () => {
    const customPlayer = new VideoPlayer({ src: 'test.mp4', autoplay: true, muted: true });
    expect(customPlayer.props.autoplay).toBe(true);
    expect(customPlayer.props.muted).toBe(true);
  });

  it('should have state manager', () => {
    expect(player.state).toBeDefined();
    expect(typeof player.state.get).toBe('function');
    expect(typeof player.state.set).toBe('function');
  });

  it('should have event bus', () => {
    expect(player.events).toBeDefined();
    expect(typeof player.events.on).toBe('function');
    expect(typeof player.events.off).toBe('function');
    expect(typeof player.events.emit).toBe('function');
  });

  it('should have on/off event methods', () => {
    expect(typeof player.on).toBe('function');
    expect(typeof player.off).toBe('function');
  });

  it('should install plugin via use()', () => {
    const plugin = {
      name: 'test-plugin',
      install: vi.fn(),
    };
    const result = player.use(plugin);
    expect(result).toBe(player); // chainable
    expect(plugin.install).toHaveBeenCalledWith(player);
  });

  it('should not install duplicate plugin', () => {
    const plugin = {
      name: 'test-plugin',
      install: vi.fn(),
    };
    player.use(plugin);
    player.use(plugin);
    expect(plugin.install).toHaveBeenCalledTimes(1);
  });

  it('should get installed plugin via getPlugin()', () => {
    const plugin = {
      name: 'test-plugin',
      install: vi.fn(),
    };
    player.use(plugin);
    const result = player.getPlugin('test-plugin');
    expect(result).toBeDefined();
    expect(result?.name).toBe('test-plugin');
  });

  it('should return undefined for non-existent plugin', () => {
    expect(player.getPlugin('nonexistent')).toBeUndefined();
  });

  it('should uninstall plugin via uninstallPlugin()', () => {
    const plugin = {
      name: 'test-plugin',
      install: vi.fn(),
      uninstall: vi.fn(),
    };
    player.use(plugin);
    player.uninstallPlugin('test-plugin');
    expect(plugin.uninstall).toHaveBeenCalled();
    expect(player.getPlugin('test-plugin')).toBeUndefined();
  });

  it('should return player state via getState()', () => {
    const state = player.getState();
    expect(state).toBeDefined();
  });

  it('should set volume via setVolume()', () => {
    player.setVolume(0.5);
    expect(player.state.get(PlayerStateKeyEnum.VOLUME)).toBe(0.5);
  });

  it('should clamp volume to 0-1 range', () => {
    player.setVolume(2);
    expect(player.state.get(PlayerStateKeyEnum.VOLUME)).toBe(1);
    player.setVolume(-1);
    expect(player.state.get(PlayerStateKeyEnum.VOLUME)).toBe(0);
  });

  it('should set muted via setMuted()', () => {
    player.setMuted(true);
    expect(player.state.get(PlayerStateKeyEnum.MUTED)).toBe(true);
    player.setMuted(false);
    expect(player.state.get(PlayerStateKeyEnum.MUTED)).toBe(false);
  });

  it('should set playback rate via setPlaybackRate()', () => {
    player.setPlaybackRate(2);
    expect(player.state.get(PlayerStateKeyEnum.PLAYBACK_RATE)).toBe(2);
  });

  it('should emit volumeChange event on setVolume', () => {
    const emitSpy = vi.spyOn(player.events, 'emit');
    player.setVolume(0.5);
    expect(emitSpy).toHaveBeenCalledWith(PlayerEventEnum.VOLUME_CHANGE, { volume: 0.5, muted: false });
  });

  it('should emit mutedChange event on setMuted', () => {
    const emitSpy = vi.spyOn(player.events, 'emit');
    player.setMuted(true);
    expect(emitSpy).toHaveBeenCalledWith(PlayerEventEnum.MUTED_CHANGE, true);
  });

  it('should emit rateChange event on setPlaybackRate', () => {
    const emitSpy = vi.spyOn(player.events, 'emit');
    player.setPlaybackRate(1.5);
    expect(emitSpy).toHaveBeenCalledWith(PlayerEventEnum.RATE_CHANGE, 1.5);
  });

  it('should pause on destroy', () => {
    const pauseSpy = vi.spyOn(player, 'pause');
    player.destroy();
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('should clean up on destroy', () => {
    player.destroy();
    expect(player.getPlugin('any')).toBeUndefined();
  });
});
