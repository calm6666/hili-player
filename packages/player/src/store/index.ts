/**
 * ============================================
 * Store 模块导出
 * ============================================
 */

// 类型定义
export type {
  PlayerState,
  PlayerPersistentState,
  PlayerRuntimeState,
  PlayerStore,
  QualityOption,
  UserPreferences,
  DanmakuPreferences,
  SubtitlePreferences,
  StoreOptions,
  StateListener,
  StateChange,
} from './types';

// 状态默认值（纯数据结构）
export {
  defaultUserPreferences,
  defaultDanmakuPreferences,
  defaultSubtitlePreferences,
  defaultPersistentState,
  defaultRuntimeState,
  defaultState,
} from './state';

// Store 实现
export {
  createPlayerStore,
  usePlayerStore,
  resetPlayerStore,
} from './playerStore';

// 枚举
export {
  PersistentKeyEnum,
  StateKeyEnum,
  DanmakuDensityEnum,
  ScreenModeEnum,
  CodecPreferTypeEnum,
} from './enums';

// 运行时状态管理器
export {
  PlayerStateEnum,
  PlayerStateKeyEnum,
  createRuntimeStateManager,
  defaultRuntimeState as defaultRuntimeStateManager,
} from './runtimeState';
export type { RuntimeState, RuntimeStateManager } from './runtimeState';
