import { QualityLevel, PlayMode } from "@/types";
import type { PlayerConfig } from "@/types";

/**
 * 默认配置
 */
const defaultConfig: PlayerConfig = {
  src: "",
  container: undefined,
  autoplay: false,
  playerName: "嗨哩播放器",
  muted: false,
  volume: 1,
  playbackRate: 1,
  loop: false,
  controlBtns: {
    prev: false,
    next: false,
    setting: false,
    pip: false,
    wide: false,
    web: false,
  },
  poster: "",
  defaultQuality: QualityLevel.AUTO,
  playMode: PlayMode.ORDER,
  keyboard: true,
  subtitles: [],
  danmaku: {
    enabled: false,
    source: "",
    opacity: 0.8,
    speed: 1,
    visible: true,
  },
  progressSegments: [
    {
      startTime: 0,
      endTime: 90,
      pointText: "",
    },
  ],
  ssr: {
    enabled: false,
    deferHydration: false,
  },
  plugins: [],
  debug: false,
};

export default defaultConfig;
