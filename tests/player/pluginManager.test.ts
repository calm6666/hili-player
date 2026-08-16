/**
 * PluginManager 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '@/hili-player/core/pluginManager';
import type { Plugin } from '@/hili-player/core/plugin';

// Create a mock VideoPlayer
function createMockPlayer() {
  return {
    props: { debug: false },
    events: {
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
      emit: vi.fn(),
    },
    state: {
      get: vi.fn(),
      set: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    },
    streamMiddleware: {
      registerStreamPlugin: vi.fn(),
      unregisterStreamPlugin: vi.fn(),
    },
  } as any;
}

describe('PluginManager', () => {
  let manager: PluginManager;
  let player: ReturnType<typeof createMockPlayer>;

  beforeEach(() => {
    player = createMockPlayer();
    manager = new PluginManager(player);
  });

  it('should create PluginManager instance', () => {
    expect(manager).toBeDefined();
    expect(manager.state).toBeDefined();
    expect(manager.events).toBeDefined();
    expect(manager.hooks).toBeDefined();
  });

  it('should install a plugin', () => {
    const plugin: Plugin = {
      name: 'test-plugin',
      install: vi.fn(),
    };
    manager.install(plugin);
    expect(plugin.install).toHaveBeenCalledWith(player);
    expect(manager.get('test-plugin')).toBe(plugin);
  });

  it('should not install duplicate plugin', () => {
    const plugin: Plugin = {
      name: 'test-plugin',
      install: vi.fn(),
    };
    manager.install(plugin);
    manager.install(plugin);
    expect(plugin.install).toHaveBeenCalledTimes(1);
  });

  it('should uninstall a plugin', () => {
    const plugin: Plugin = {
      name: 'test-plugin',
      install: vi.fn(),
      uninstall: vi.fn(),
    };
    manager.install(plugin);
    manager.uninstall('test-plugin');
    expect(plugin.uninstall).toHaveBeenCalledWith(player);
    expect(manager.get('test-plugin')).toBeUndefined();
  });

  it('should return undefined for non-existent plugin', () => {
    expect(manager.get('nonexistent')).toBeUndefined();
  });

  it('should create plugin context on install', () => {
    const plugin: Plugin = {
      name: 'test-plugin',
      install: vi.fn(),
    };
    manager.install(plugin);
    expect(manager.context).toBeDefined();
    expect(manager.context?.player).toBe(player);
    expect(manager.context?.state).toBe(manager.state);
    expect(manager.context?.events).toBe(manager.events);
    expect(manager.context?.hooks).toBe(manager.hooks);
    expect(typeof manager.context?.log).toBe('function');
  });

  it('should inherit debug setting from player', () => {
    player.props.debug = true;
    const plugin: Plugin = {
      name: 'test-plugin',
      install: vi.fn(),
      options: {},
    } as Plugin & { options: Record<string, unknown> };
    manager.install(plugin);
    expect(plugin.options.debug).toBe(true);
  });

  it('should detect and register stream plugin', () => {
    const streamPlugin = {
      name: 'hls',
      install: vi.fn(),
      type: 'hls',
      load: vi.fn(),
      getStats: vi.fn(),
    };
    manager.install(streamPlugin as any);
    expect(player.streamMiddleware.registerStreamPlugin).toHaveBeenCalledWith(streamPlugin);
  });

  it('should unregister stream plugin on uninstall', () => {
    const streamPlugin = {
      name: 'hls',
      install: vi.fn(),
      uninstall: vi.fn(),
      type: 'hls',
      load: vi.fn(),
      getStats: vi.fn(),
    };
    manager.install(streamPlugin as any);
    manager.uninstall('hls');
    expect(player.streamMiddleware.unregisterStreamPlugin).toHaveBeenCalled();
  });

  it('should destroy all plugins', () => {
    const plugin1: Plugin = { name: 'p1', install: vi.fn(), uninstall: vi.fn() };
    const plugin2: Plugin = { name: 'p2', install: vi.fn(), uninstall: vi.fn() };
    manager.install(plugin1);
    manager.install(plugin2);
    manager.destroy();
    expect(plugin1.uninstall).toHaveBeenCalled();
    expect(plugin2.uninstall).toHaveBeenCalled();
  });

  it('should provide plugin API via getPluginAPI', () => {
    const plugin: Plugin = {
      name: 'test-plugin',
      install: vi.fn(),
    };
    manager.install(plugin);
    const api = manager.get<Plugin>('test-plugin');
    expect(api).toBe(plugin);
  });
});
