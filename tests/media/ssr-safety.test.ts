// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { MediaPlayerMonitor } from '../../media/monitor';
import { PlayerInfoPanel } from '../../media/playerInfoPanel';
import { DanmakuManager } from '../../packages/plugins/src/utils/danmaku';
import { InteractionPlugin } from '../../packages/plugins/src/interaction';
import { SubtitlePlugin } from '../../packages/plugins/src/subtitle';
import { GuidePlugin } from '../../packages/plugins/src/interaction/GuidePlugin';

describe('SSR safety', () => {
  it('should no-op MediaPlayerMonitor.start() without browser globals', () => {
    const monitor = new MediaPlayerMonitor({} as any);
    expect(() => monitor.start()).not.toThrow();
  });

  it('should no-op PlayerInfoPanel.show() without browser globals', () => {
    const monitor = new MediaPlayerMonitor({} as any);
    const panel = new PlayerInfoPanel(monitor);
    expect(() => panel.show()).not.toThrow();
  });

  it('should construct DanmakuManager without browser globals', () => {
    expect(
      () =>
        new DanmakuManager({
          container: {} as any,
          video: {} as any,
          renderMode: 0 as any,
        } as any),
    ).not.toThrow();
  });

  it('should no-op interaction plugin install without browser globals', () => {
    const plugin = InteractionPlugin();
    expect(() => plugin.install({} as any)).not.toThrow();
  });

  it('should no-op subtitle plugin install without browser globals', () => {
    const plugin = SubtitlePlugin();
    expect(() => plugin.install({} as any)).not.toThrow();
  });

  it('should no-op interaction subplugin render without browser globals', () => {
    const plugin = new GuidePlugin({} as any);
    expect(() => plugin.render({} as any)).not.toThrow();
  });
});
