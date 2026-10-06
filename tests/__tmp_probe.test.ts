/**
 * 临时探针（用完即删）：验证问题 1 / 6 / 3 的修复行为
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { h, mount } from '@/core';
import { LeftControls } from '@/hili-player/components/LeftControls';
import { StateContext, ConfigContext } from '@/hili-player/store/runtimeState';
import { ConfigStoreContext } from '@/hili-player/store/configStore';
import { createTypedStateManager } from '@/core';
import { createConfigStore } from '@/hili-player/store/configStore';
import {
  configureStorage,
  getStorage,
  setStorage,
  removeStorage,
} from '@/hili-player/utils/storage';
import defaultConfig from '@/hili-player/config/defaultConfig';

describe('问题1：初始时间显示', () => {
  it('未播放时当前时间应显示 00:00，时长显示 00:00', () => {
    const state = createTypedStateManager<Record<string, unknown>>({
      player: { currentTime: 0, duration: 0 },
    });
    const configStore = createConfigStore(defaultConfig);
    const vnode = h(LeftControls, {
      __providers: [
        { contextId: StateContext.id, value: state },
        { contextId: ConfigContext.id, value: defaultConfig.ui?.controls ?? {} },
        { contextId: ConfigStoreContext.id, value: configStore },
      ],
    } as never);
    const container = document.createElement('div');
    document.body.appendChild(container);
    mount(vnode, container);
    const current = container.querySelector<HTMLElement>('.player-ctrl-time-current');
    const duration = container.querySelector<HTMLElement>('.player-ctrl-time-duration');
    expect(current?.textContent).toBe('00:00');
    expect(duration?.textContent).toBe('00:00');
  });
});

describe('问题3：持久化存储封装', () => {
  beforeEach(() => {
    localStorage.clear();
    configureStorage({ enabled: true, prefix: 'test:' });
  });

  it('key 自动加前缀，get/set/remove 正常', () => {
    setStorage('volume', 0.5);
    expect(localStorage.getItem('test:volume')).toBe('0.5');
    expect(getStorage('volume', 1)).toBe(0.5);
    removeStorage('volume');
    expect(getStorage('volume', 1)).toBe(1);
  });

  it('enabled=false 时完全不读写', () => {
    configureStorage({ enabled: false, prefix: 'test:' });
    setStorage('volume', 0.5);
    expect(localStorage.getItem('test:volume')).toBeNull();
    expect(getStorage('volume', 9)).toBe(9);
  });
});
