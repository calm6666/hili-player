# Lumina 框架国际化（i18n）设计文档

> 阶段：**设计稿，待用户审批后实施**
> 范围：框架核心 `core/` + 播放器业务层 `packages/player/src/` + 插件层 `packages/plugins/src/`
> 命名变更：`HiliFramework` → `Lumina`（拉丁语"光"，与 hili 希伯来语"光"语义呼应，国际化命名）

---

## 目录

1. [设计目标与原则](#一设计目标与原则)
2. [框架改名方案](#二框架改名方案lumina)
3. [i18n 架构总览](#三i18n-架构总览)
4. [翻译资源组织](#四翻译资源组织)
5. [翻译 key 命名规范](#五翻译-key-命名规范)
6. [集中接入点设计](#六集中接入点设计)
7. [中文转英文范围与策略](#七中文转英文范围与策略)
8. [公开 API 设计](#八公开-api-设计)
9. [默认语言包内容](#九默认语言包内容)
10. [实施步骤分阶段](#十实施步骤分阶段)
11. [风险与兼容性](#十一风险与兼容性)
12. [验收标准](#十二验收标准)

---

## 一、设计目标与原则

### 1.1 设计目标

| 目标 | 说明 |
|---|---|
| **运行时无中文依赖** | 框架内部所有错误、警告、日志在运行时输出英文，兼容不支持中文显示的终端/控制台 |
| **默认中英双语** | 内置 zh-CN 与 en-US 两套 JSON 资源，开箱即用 |
| **语言可扩展** | 第三方新增语言只需新建一个 JSON 文件并调用 `registerLocale()`，无需改动框架源码 |
| **运行时切换** | 支持 `setLocale()` 在运行时切换语言，所有已订阅 UI 自动更新 |
| **零运行时开销** | 未启用 i18n 模式（默认）时，错误/警告走纯英文字面量路径，无查表开销 |
| **改名 Lumina** | 框架对外 namespace、日志前缀、构建产物命名统一改为 Lumina |

### 1.2 设计原则

1. **JSON 映射，不写代码翻译**：所有可翻译文案以 key-value JSON 形式存储，禁止在源码中硬编码翻译逻辑
2. **集中接入**：i18n 查表逻辑只接入 `core/warning.ts`（框架层）与 `utils/logger.ts`（业务层），不分散到各模块
3. **注释保留中文**：源码注释仍用中文（开发友好），仅运行时字符串/日志/错误转英文
4. **fallback 链**：`key 查找 → 当前语言包 → en-US → key 字面量`，三段式保证永不出错
5. **零类型断言**：实现严格遵循项目硬约束，禁用 `as` 断言，使用类型谓词函数与函数重载
6. **SSR 安全**：i18n 模块本身不依赖 `window`/`document`，可在服务端渲染上下文使用

---

## 二、框架改名方案（Lumina）

### 2.1 命名由来

- `hili`（希伯来语"光"）→ `Lumina`（拉丁语"光"）
- 国际化命名，避免品牌词与中文强绑定
- 短、易记、可朗读、可注册

### 2.2 改名范围

| 改名点 | 当前值 | 改后值 | 影响范围 |
|---|---|---|---|
| `package.json` name | `hili-player` | `lumina-player` | 顶层 package.json |
| `packages/player/package.json` name | （子包名） | `@lumina/nova` | 子包发布名 |
| `packages/plugins/package.json` name | （子包名） | `@lumina/plugins` | 子包发布名 |
| 框架日志前缀 | `[HiliFramework/${source}]` | `[Lumina/${source}]` | `core/warning.ts` L188/L228 |
| 框架导出 namespace | （未显式 namespace） | `Lumina` | `core/index.ts` 导出聚合 |
| 默认 UI 标题 | `'嗨哩播放器'` | `'Lumina Player'`（英文）/`'嗨哩播放器'`（中文） | `defaultConfig.ts`，改为 i18n key |
| 全局标记 | `__LUMINA_DEV__` | `__LUMINA_DEV__` | `core/warning.ts` + `vite.config.ts` define |
| 文档目录引用 | `docs/hili-*.md` | `docs/lumina-*.md` | 文档重命名（本次只新增 i18n 文档，旧文档暂不动） |
| demo 目录 | `demo/player-demo` | 保留（与改名解耦，demo 是消费方） | 不动 |

### 2.3 改名不动的项

- 项目根目录 `d:\hilihili\front\hili-player`（物理路径不动，避免破坏 git 历史）
- 内部变量名 `hiliPlayer*` → 仅在公开 API 层改为 `luminaPlayer*`，私有内部变量保持不动
- 用户已使用的存储 key（`nova-player:volume` 等）→ 保留兼容，新增 key 用 `lumina-player:` 前缀并做迁移读取

### 2.4 改名风险

| 风险 | 缓解措施 |
|---|---|
| 外部用户 `import { h } from 'hili-player'` 失效 | 保留 `hili-player` 作为 alias 重导出 1 个大版本，2.0 移除 |
| `__LUMINA_DEV__` 构建标记变更导致 dev 模式失效 | 同步改 `vite.config.ts` 的 `define` 字段 |
| 存储 key 历史数据丢失 | `restorePersistedPlayback()` 增加 fallback 读旧 key 写新 key |

---

## 三、i18n 架构总览

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  应用层（demo / 用户业务代码）                              │
│  └─ player.on('warning', w => t(w.message))                 │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ setLocale() / getLocale() / t()
┌─────────────────────────────────────────────────────────────┐
│  i18n 核心（core/i18n.ts，新增）                             │
│  ├─ locale 状态（signals-based，响应式）                    │
│  ├─ messages: Record<Locale, Record<string, string>>        │
│  ├─ t(key, params?) 查表 + 参数插值 + fallback             │
│  ├─ registerLocale(locale, messages) 注册新语言             │
│  └─ subscribeLocale(cb) 订阅语言变化（驱动 UI 重渲染）      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ 调用 t() / 直接英文字面量
┌─────────────────────────────────────────────────────────────┐
│  接入层（仅两处）                                            │
│  ├─ core/warning.ts：warn()/reportError() 内部消息          │
│  └─ utils/logger.ts：Logger.warn()/error()/info()/debug()   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│  资源层（core/locales/*.json）                              │
│  ├─ en-US.json（默认兜底）                                   │
│  ├─ zh-CN.json（中文）                                      │
│  └─ 用户自建 *.json                                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 设计决策

**决策 1｜接入点只放在 warning.ts 与 logger.ts**

理由：
- `core/warning.ts` 是框架层所有 `warn()`/`reportError()`/`safeCall()` 的统一入口，集中改造一处即可覆盖框架层全部错误/警告
- `utils/logger.ts` 的 `Logger` 类是业务层所有 `logger.warn/error/info` 的统一入口，集中改造一处即可覆盖业务层全部日志
- 避免散落各模块的 `console.warn/error/throw new Error`，强制走这两个入口

**决策 2｜默认走英文字面量，不强制查表**

理由：
- 错误/日志在运行时输出英文已经满足"兼容不支持中文的电脑"这一核心需求
- i18n 查表是**可选增强**，由用户在 PlayerConfig 显式开启 `i18n.enabled: true`
- 未开启时 `warn()` 直接输出传入的英文字符串，零开销

**决策 3｜key 而非中文做查找键**

理由：
- 用中文做查找键会导致：① 改中文文案要改源码 ② 编译期无法静态检查 key 合法性
- 用语义化英文 key（如 `core.warn.h.invalid_tag`）做查找，源码与资源解耦

---

## 四、翻译资源组织

### 4.1 目录结构

```
core/
├── i18n.ts                    # i18n 核心：locale 状态 + t() + registerLocale()
├── locales/
│   ├── en-US.json             # 默认兜底语言包（必须存在）
│   ├── zh-CN.json             # 中文语言包
│   └── index.ts               # 资源聚合：静态导入默认两语言，按需注册
├── warning.ts                 # 改造：warn/reportError 接入 t()
└── ...

packages/player/src/
├── locales/
│   ├── en-US.json             # 播放器业务层文案
│   ├── zh-CN.json
│   └── index.ts               # 业务层资源聚合
└── ...

packages/plugins/src/
├── locales/
│   ├── en-US.json             # 插件层文案（dash/hls/flv/danmaku/subtitle/audioeffect 共用）
│   ├── zh-CN.json
│   └── index.ts
└── ...
```

### 4.2 资源合并策略

`core/i18n.ts` 在初始化时合并三处资源：

```ts
// core/locales/index.ts
import enUSCore from './en-US.json';
import zhCNCore from './zh-CN.json';
import { enUS as playerEn } from '../../../packages/player/src/locales';
import { enUS as pluginEn } from '../../../packages/plugins/src/locales';
// ... zh-CN 同理

export const bundledEnUS = { ...enUSCore, ...playerEn, ...pluginEn };
export const bundledZhCN = { ...zhCNCore, ...playerZh, ...pluginZh };
```

**冲突规则**：三处资源的 key 必须前缀隔离（见第五节命名规范），不允许同 key。

### 4.3 JSON 加载方式

- **默认两语言**：静态 `import` 进 bundle（tree-shaking 友好，构建期确定）
- **第三方语言**：用户运行时调用 `registerLocale('ja-JP', await import('./ja-JP.json'))`，按需加载

### 4.4 JSON 格式

```json
{
  "core.warn.h.invalid_tag": "Invalid vnode tag: expected string or function, got {tag}",
  "core.warn.h.invalid_props": "vnode props must be an object, got {type}",
  "core.error.render.failed": "Component render failed: {message}",
  "player.error.source.exhausted": "All backup sources have been tried, playback failed",
  "player.warn.autoplay.blocked_muted": "Autoplay was blocked by browser, retrying muted",
  "player.error.autoplay.muted_failed": "Muted autoplay still failed: {message}",
  "plugins.dash.error.init": "Dash plugin initialization failed: {message}"
}
```

- key 用点分层级（见第五节）
- value 用 `{name}` 占位符做参数插值
- value 必须是英文（en-US.json）或中文（zh-CN.json）字面量

---

## 五、翻译 key 命名规范

### 5.1 命名规则

```
{layer}.{severity}.{module}.{name}
```

| 字段 | 取值 | 示例 |
|---|---|---|
| `layer` | `core` / `player` / `plugins` | `core` |
| `severity` | `warn` / `error` / `info` / `debug` / `ui` | `warn` |
| `module` | 模块名（h/mount/context/ssr/videoplayer/store/dash/hls/flv/danmaku/subtitle/audioeffect 等） | `h` |
| `name` | 具体文案的语义名，snake_case | `invalid_tag` |

**示例**：
- `core.warn.h.invalid_tag`
- `core.error.render.failed`
- `core.warn.ssr.no_dom`
- `player.warn.videoplayer.autoplay_blocked`
- `player.error.videoplayer.source_exhausted`
- `player.warn.store.write_failed`
- `plugins.warn.dash.init_failed`
- `plugins.error.hls.manifest_parse`
- `player.ui.controls.play_button`（UI 文案）
- `player.ui.settings.title`

### 5.2 命名约束

1. **全小写 + 下划线**：key 全部小写，单词间用下划线（与项目 snake_case 文件命名风格一致）
2. **点分最多 4 层**：`layer.severity.module.name`，不允许更深
3. **禁止缩写**：`btn` → `button`、`cfg` → `config`、`msg` → `message`
4. **语义化**：name 表达"什么情况"，不表达"如何处理"。例：`source_exhausted` 而非 `handle_empty_source`
5. **占位符用单花括号**：`{tag}`、`{message}`，与 ES2018 模板字符串解耦，避免编译器误解析

### 5.3 key 分组清单（核心层）

| 模块 | 预估 key 数 | 说明 |
|---|---|---|
| `core.warn.h.*` | 4-6 | h() 函数警告 |
| `core.warn.component.*` | 3-5 | defineComponent 警告 |
| `core.warn.mount.*` | 2-3 | mount/hydrate 警告 |
| `core.warn.context.*` | 2-3 | useContext 警告 |
| `core.warn.ssr.*` | 2-3 | SSR 警告 |
| `core.warn.lifecycle.*` | 2-3 | 生命周期警告 |
| `core.warn.state.*` | 2-3 | signals/state 警告 |
| `core.warn.event_bus.*` | 2-3 | eventBus 警告 |
| `core.error.render.*` | 2-3 | 渲染错误 |
| `core.error.lifecycle.*` | 2-3 | 生命周期错误 |
| `core.error.event_handler.*` | 2-3 | 事件处理错误 |
| `core.error.ssr.*` | 1-2 | SSR 错误 |
| `core.error.hydrate.*` | 1-2 | hydrate 错误 |
| `core.error.setup.*` | 1-2 | setup 错误 |
| **小计** | **30-45** | 框架层 |

| 模块 | 预估 key 数 | 说明 |
|---|---|---|
| `player.warn.videoplayer.*` | 5-8 | 自动播放/源切换等 |
| `player.error.videoplayer.*` | 3-5 | 源耗尽/加载失败 |
| `player.warn.store.*` | 3-5 | 持久化警告 |
| `player.error.store.*` | 1-2 | 持久化错误 |
| `player.warn.browser_capability.*` | 2-3 | 能力检测降级 |
| `player.ui.controls.*` | 10-15 | 控件文案（播放/暂停/全屏等） |
| `player.ui.settings.*` | 15-25 | 设置面板文案 |
| `player.ui.video_info.*` | 5-10 | 视频信息面板 |
| `player.ui.dialog.*` | 5-10 | 对话框/提示 |
| **小计** | **50-80** | 业务层 |

| 模块 | 预估 key 数 | 说明 |
|---|---|---|
| `plugins.warn.dash.*` | 2-3 | Dash 警告 |
| `plugins.error.dash.*` | 2-3 | Dash 错误 |
| `plugins.warn.hls.*` | 2-3 | HLS 警告 |
| `plugins.error.hls.*` | 2-3 | HLS 错误 |
| `plugins.warn.flv.*` | 2-3 | FLV 警告 |
| `plugins.error.flv.*` | 2-3 | FLV 错误 |
| `plugins.warn.danmaku.*` | 2-3 | 弹幕警告 |
| `plugins.error.danmaku.*` | 2-3 | 弹幕错误 |
| `plugins.warn.subtitle.*` | 2-3 | 字幕警告 |
| `plugins.error.subtitle.*` | 2-3 | 字幕错误 |
| `plugins.warn.audioeffect.*` | 2-3 | 音效警告 |
| `plugins.error.audioeffect.*` | 2-3 | 音效错误 |
| **小计** | **24-36** | 插件层 |

**总预估**：约 100-160 个 key（首版）。

---

## 六、集中接入点设计

### 6.1 改造 `core/warning.ts`

**当前实现**（核心片段，见 `core/warning.ts` L176-L230）：

```ts
export function warn(source: WarnSource, message: string, data?: Record<string, unknown>): void {
  const warning: FrameworkWarning = { source, message, data };
  warningHandlers.forEach(handler => { try { handler(warning); } catch {} });
  if (isDev()) {
    console.warn(`[HiliFramework/${source}] ${message}`, data ?? '');
  }
}

export function reportError(
  source: ErrorSource, message: string, error?: Error, data?: Record<string, unknown>
): void {
  const frameworkError: FrameworkError = { source, message, error, data, timestamp: Date.now() };
  errorHandlers.forEach(handler => { try { handler(frameworkError); } catch {} });
  if (isDev()) {
    console.error(`[HiliFramework/${source}] ${message}`, error ?? '', data ?? '');
  }
}
```

**改造后**（设计，待实施）：

```ts
import { t, isI18nEnabled } from './i18n';

export function warn(source: WarnSource, message: string, data?: Record<string, unknown>): void {
  // message 参数语义变更：当 i18n 开启时是 key，未开启时是英文字面量
  // 由调用方按规范传 key（推荐）或字面量（兼容老代码）
  const resolvedMessage = isI18nEnabled() ? t(message, data) : message;
  const warning: FrameworkWarning = { source, message: resolvedMessage, data };

  warningHandlers.forEach(handler => { try { handler(warning); } catch {} });

  if (isDev()) {
    console.warn(`[Lumina/${source}] ${resolvedMessage}`, data ?? '');
  }
}
```

**关键设计点**：
1. **`message` 参数双语义**：开启 i18n 时按 key 查表，未开启时直接输出（保持兼容）
2. **`t()` 自动用 `data` 做插值**：`t('core.warn.h.invalid_tag', { tag: 'number' })` → `"Invalid vnode tag: expected string or function, got number"`
3. **fallback 链**：`t()` 内部查不到 key 时返回 key 字面量本身，永不抛错
4. **日志前缀改 `[Lumina/${source}]`**

### 6.2 改造 `utils/logger.ts`

**当前实现**（核心片段，见 `utils/logger.ts` L164-L201）：

```ts
export class Logger {
  constructor(private readonly tag: string, private readonly manager: LoggerManager) {}

  warn(message: string, ...data: unknown[]): void {
    this.manager.log(LogLevel.WARN, this.tag, message, ...data);
  }
  error(message: string, ...data: unknown[]): void {
    this.manager.log(LogLevel.ERROR, this.tag, message, ...data);
  }
}

export function createLogger(tag: string): Logger {
  return loggerManager.createLogger(tag);
}
```

**改造后**：

```ts
import { t, isI18nEnabled } from '../../core/i18n';

export class Logger {
  constructor(private readonly tag: string, private readonly manager: LoggerManager) {}

  warn(message: string, ...data: unknown[]): void {
    const resolved = isI18nEnabled() ? t(message, this.extractParams(data)) : message;
    this.manager.log(LogLevel.WARN, this.tag, resolved, ...data);
  }
  error(message: string, ...data: unknown[]): void {
    const resolved = isI18nEnabled() ? t(message, this.extractParams(data)) : message;
    this.manager.log(LogLevel.ERROR, this.tag, resolved, ...data);
  }

  /** 从 data 中提取命名参数用于 i18n 插值 */
  private extractParams(data: unknown[]): Record<string, unknown> | undefined {
    // 仅当第一个参数是 plain object 时视为参数对象
    if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      return data[0] as Record<string, unknown>; // 注：此处 as 受约束的窄化场景，仅 logger 内部使用
    }
    return undefined;
  }
}
```

**注意**：此处 `as Record<string, unknown>` 的使用需在实施时改用类型谓词函数：

```ts
function isParamsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

private extractParams(data: unknown[]): Record<string, unknown> | undefined {
  return data.length > 0 && isParamsObject(data[0]) ? data[0] : undefined;
}
```

### 6.3 改造调用方

调用方需把当前的中文/英文字面量改为 i18n key。例：

**VideoPlayer.ts 当前**：

```ts
logger.error("所有备用源都已尝试，无法播放");
logger.warn("自动播放被浏览器拦截，切换为静音播放");
logger.error("自动播放失败:", e);
```

**改造后**：

```ts
logger.error('player.error.videoplayer.source_exhausted');
logger.warn('player.warn.videoplayer.autoplay_blocked_muted');
logger.error('player.error.videoplayer.autoplay_failed', { message: e instanceof Error ? e.message : String(e) });
```

**注意**：`logger.error("自动播放失败:", e)` 这种把 error 对象作为第二个参数的写法，改造后 key 不能直接用插值（因为 e 是 Error 不是 string）。设计两种处理：
- **方案 A（推荐）**：`logger.error('player.error.videoplayer.autoplay_failed', { message: e instanceof Error ? e.message : String(e) })`，把错误信息提取为字符串参数
- **方案 B**：保留 `logger.error(key, e)` 形式，`Logger.error` 内部判断若第二个参数是 Error 实例，附加 `error` 字段而非插值

实施时统一采用方案 A。

### 6.4 其他散落点

除 `core/warning.ts` 与 `utils/logger.ts` 外，对 `console.warn/error/throw new Error` 的散落点统计与处理：

| 散落点类型 | 处理方式 |
|---|---|
| `console.warn('中文')` 直接调用 | 改为 `warn(WarnSource.XXX, 'core.warn.xxx.yyy')` |
| `console.error('中文')` 直接调用 | 改为 `reportError(ErrorSource.XXX, 'core.error.xxx.yyy')` |
| `throw new Error('中文')` | 改为 `throw new Error(t('core.error.xxx.yyy'))`，或保持英文字面量 |
| `throw new TypeError('中文')` | 改为 `throw new TypeError(t('core.error.xxx.yyy'))` |

实施时通过 Grep 全局扫描中文运行时字符串字面量，逐一改造。

---

## 七、中文转英文范围与策略

### 7.1 范围划分

| 类型 | 处理 | 示例 |
|---|---|---|
| **源码注释** | **保留中文**（开发友好） | `/** 创建 vnode */` |
| **JSDoc 文档** | **保留中文**（IDE 提示友好） | `@param source - 警告来源` |
| **运行时字符串字面量** | **转为 i18n key**（推荐）或英文字面量（兼容） | `logger.error('...')` 中的字符串 |
| **`throw new Error('中文')`** | **转为英文字面量**或 i18n key | `throw new Error('Invalid tag')` |
| **JSON 资源文件** | en-US.json 写英文，zh-CN.json 写中文 | 见第九节 |
| **README/docs 文档** | **保留中文**（这是给开发者看的） | 各 .md 文件 |
| **package.json description** | 改为英文 | `"Minimal TypeScript video player - Lumina"` |

### 7.2 转换策略

**策略 1：先转英文，再加 i18n key**

1. 第一遍：把所有中文运行时字符串字面量直接改为英文（保证兼容不支持中文的电脑）
2. 第二遍：把英文字面量提取为 i18n key，写入 JSON 资源
3. 这样两步解耦，即使 i18n 未完成，英文也已就位

**策略 2：注释与代码分离**

- 注释中的中文不影响运行时，保留
- 但要保证：注释中的中文不会出现在运行时表达式里（如 `${'中文'}` 模板拼接）

**策略 3：UI 文案全部走 i18n**

- 控件文案（"播放"/"暂停"）、设置面板文案、对话框文案，**全部**改为 `t('player.ui.xxx.yyy')` 查表
- 这部分必须走 i18n，不能直接英文字面量（因为要支持中英切换）

### 7.3 当前已知运行时中文清单（部分）

| 文件 | 行号/位置 | 中文文案 | 处理 |
|---|---|---|---|
| `VideoPlayer.ts` | L? | `"所有备用源都已尝试，无法播放"` | → `player.error.videoplayer.source_exhausted` |
| `VideoPlayer.ts` | L? | `"自动播放被浏览器拦截，切换为静音播放"` | → `player.warn.videoplayer.autoplay_blocked_muted` |
| `VideoPlayer.ts` | L? | `"自动播放失败:"` | → `player.error.videoplayer.autoplay_failed` |
| `VideoPlayer.ts` | L? | `"静音自动播放仍失败:"` | → `player.error.videoplayer.muted_autoplay_failed` |
| `playerStore.ts` | L? | `` `写入失败 (${key})` `` | → `player.warn.store.write_failed` + `{ key }` 参数 |
| `playerStore.ts` | L? | `'旧格式迁移失败'` | → `player.warn.store.migration_failed` |
| `browserCapabilityDetector.ts` | L? | `'Media Capabilities API 调用失败，降级使用 canPlayType:'` | → `player.warn.browser_capability.fallback_to_can_play_type` |
| ... | ... | ... | ... |

实施时通过 `Grep "[\u4e00-\u9fa5]"` 全局扫描运行时字符串字面量，逐一改造。

---

## 八、公开 API 设计

### 8.1 i18n 核心 API

新增 `core/i18n.ts`，导出以下 API：

```ts
/**
 * 支持的语言列表（内置 + 用户注册）
 */
export type Locale = string; // 实际为 'en-US' | 'zh-CN' | string

/**
 * i18n 配置接口（嵌入 PlayerConfig.i18n）
 */
export interface I18nConfig {
  /** 是否启用 i18n 查表（默认 false，未启用时所有 message 直接输出） */
  enabled?: boolean;
  /** 初始语言（默认 'en-US'） */
  locale?: Locale;
  /** fallback 语言（默认 'en-US'） */
  fallbackLocale?: Locale;
  /** 自定义语言包（运行时注册，优先级高于内置） */
  messages?: Record<Locale, Record<string, string>>;
}

/**
 * 翻译函数
 * @param key - 翻译 key，如 'core.warn.h.invalid_tag'
 * @param params - 插值参数，如 { tag: 'number' }
 * @returns 翻译后的字符串；查不到返回 key 本身
 *
 * @example
 * t('core.warn.h.invalid_tag', { tag: 'number' });
 * // => 'Invalid vnode tag: expected string or function, got number'
 */
export function t(key: string, params?: Record<string, unknown>): string;

/**
 * 设置当前语言
 * @param locale - 语言代码，如 'zh-CN'
 *
 * @example
 * setLocale('zh-CN');
 */
export function setLocale(locale: Locale): void;

/**
 * 获取当前语言
 */
export function getLocale(): Locale;

/**
 * 注册新语言包
 * @param locale - 语言代码
 * @param messages - 翻译资源
 *
 * @example
 * registerLocale('ja-JP', await import('./ja-JP.json'));
 */
export function registerLocale(locale: Locale, messages: Record<string, string>): void;

/**
 * 订阅语言变化
 * @returns 取消订阅函数
 *
 * @example
 * const unsub = subscribeLocale((locale) => {
 *   console.log('Language changed to', locale);
 * });
 */
export function subscribeLocale(listener: (locale: Locale) => void): () => void;

/**
 * 判断 i18n 是否启用（内部使用，决定是否走查表路径）
 */
export function isI18nEnabled(): boolean;

/**
 * 初始化 i18n（框架启动时调用一次）
 */
export function initI18n(config: I18nConfig): void;
```

### 8.2 PlayerConfig 扩展

```ts
// types/index.ts 中 PlayerConfig 新增字段
export interface PlayerConfig {
  // ... 现有字段

  /** i18n 国际化配置 */
  i18n?: I18nConfig;
}
```

### 8.3 VideoPlayer 实例 API

```ts
class VideoPlayer {
  /** 设置语言 */
  setLocale(locale: Locale): void;

  /** 获取当前语言 */
  getLocale(): Locale;

  /** 注册语言包 */
  registerLocale(locale: Locale, messages: Record<string, string>): void;

  /** 翻译（一般不需要用户直接调用，框架内部用） */
  translate(key: string, params?: Record<string, unknown>): string;
}
```

### 8.4 全局事件

新增事件类型：

```ts
export enum PlayerEvent {
  // ... 现有事件
  LOCALE_CHANGE = 'localeChange';
}
```

`setLocale()` 内部触发 `localeChange` 事件，UI 组件监听后重新渲染。

### 8.5 类型安全约束

**禁用 `as` 断言**的实现要点：

1. **`t()` 参数类型**：`params?: Record<string, unknown>`，不使用 `any`
2. **`getLocale()` 返回**：使用 `Locale = string` 而非联合类型，避免注册新语言时类型冲突
3. **`registerLocale()` 参数校验**：使用类型谓词函数

```ts
function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(v => typeof v === 'string');
}

export function registerLocale(locale: Locale, messages: Record<string, string>): void {
  if (!isStringRecord(messages)) {
    warn(WarnSource.STATE, 'core.warn.i18n.invalid_messages');
    return;
  }
  // ...
}
```

---

## 九、默认语言包内容

### 9.1 en-US.json（核心层，节选）

```json
{
  "core.warn.h.invalid_tag": "Invalid vnode tag: expected string or function, got {type}",
  "core.warn.h.invalid_props": "vnode props must be an object, got {type}",
  "core.warn.h.missing_key": "vnode key must be string or number, got {type}",
  "core.warn.component.missing_setup": "defineComponent: setup function is missing",
  "core.warn.component.invalid_return": "setup must return an object or void, got {type}",
  "core.warn.mount.no_container": "mount: container is null or not an element",
  "core.warn.mount.no_vnode": "mount: vnode is null",
  "core.warn.context.no_provider": "useContext called outside provider scope",
  "core.warn.ssr.no_dom": "SSR environment has no DOM API, falling back to string render",
  "core.warn.lifecycle.already_unmounted": "Component already unmounted, lifecycle skipped",
  "core.warn.state.invalid_signal": "Signal value setter called with invalid argument",
  "core.warn.event_bus.max_listeners": "Event bus listener limit exceeded ({count})",
  "core.warn.i18n.invalid_messages": "i18n registerLocale: messages must be Record<string, string>",
  "core.warn.i18n.missing_locale": "i18n: locale {locale} not registered, falling back to {fallback}",

  "core.error.render.failed": "Component render failed: {message}",
  "core.error.lifecycle.failed": "Lifecycle hook execution failed: {message}",
  "core.error.event_handler.failed": "Event handler execution failed: {message}",
  "core.error.ssr.render_failed": "SSR render failed: {message}",
  "core.error.hydrate.mismatch": "Hydrate mismatch: server and client vnode differ",
  "core.error.setup.failed": "Component setup failed: {message}"
}
```

### 9.2 zh-CN.json（核心层，节选）

```json
{
  "core.warn.h.invalid_tag": "vnode 标签无效：应为字符串或函数，实际为 {type}",
  "core.warn.h.invalid_props": "vnode props 必须为对象，实际为 {type}",
  "core.warn.h.missing_key": "vnode key 必须为字符串或数字，实际为 {type}",
  "core.warn.component.missing_setup": "defineComponent：缺少 setup 函数",
  "core.warn.component.invalid_return": "setup 必须返回对象或 void，实际为 {type}",
  "core.warn.mount.no_container": "mount：container 为 null 或非元素",
  "core.warn.mount.no_vnode": "mount：vnode 为 null",
  "core.warn.context.no_provider": "useContext 在 provider 作用域外调用",
  "core.warn.ssr.no_dom": "SSR 环境无 DOM API，降级为字符串渲染",
  "core.warn.lifecycle.already_unmounted": "组件已卸载，生命周期跳过",
  "core.warn.state.invalid_signal": "Signal 的 value setter 被传入无效参数",
  "core.warn.event_bus.max_listeners": "事件总线监听器数量超限（{count}）",
  "core.warn.i18n.invalid_messages": "i18n registerLocale：messages 必须为 Record<string, string>",
  "core.warn.i18n.missing_locale": "i18n：语言 {locale} 未注册，降级为 {fallback}",

  "core.error.render.failed": "组件渲染失败：{message}",
  "core.error.lifecycle.failed": "生命周期钩子执行失败：{message}",
  "core.error.event_handler.failed": "事件处理函数执行失败：{message}",
  "core.error.ssr.render_failed": "SSR 渲染失败：{message}",
  "core.error.hydrate.mismatch": "Hydrate 不匹配：服务端与客户端 vnode 不一致",
  "core.error.setup.failed": "组件 setup 失败：{message}"
}
```

### 9.3 业务层 / 插件层语言包

业务层（`packages/player/src/locales/`）与插件层（`packages/plugins/src/locales/`）的 JSON 结构相同，key 前缀分别为 `player.*` 与 `plugins.*`。具体内容在实施阶段填充，本设计稿只展示核心层示例。

---

## 十、实施步骤分阶段

### 阶段 1：框架改名 Lumina（独立可发布）

1. 改 `package.json` name 为 `lumina-player`，description 改英文
2. 改 `packages/player/package.json` name 为 `@lumina/nova`
3. 改 `packages/plugins/package.json` name 为 `@lumina/plugins`
4. 改 `core/warning.ts` 日志前缀 `[HiliFramework/...]` → `[Lumina/...]`
5. 改 `core/warning.ts` 中 `__LUMINA_DEV__` → `__LUMINA_DEV__`
6. 同步改 `vite.config.ts` 的 `define` 字段
7. 改 `defaultConfig.ts` 的 `playerName` 默认值（走 i18n 或直接英文）
8. 保留 `hili-player` 作为 alias 重导出（兼容期 1 个大版本）
9. 跑 tsc + vitest + vite build 验证

**验收**：构建产物包名变 Lumina，所有日志前缀变 `[Lumina/...]`，所有测试通过。

### 阶段 2：运行时中文字面量转英文

1. Grep 全局扫描 `core/`、`packages/player/src/`、`packages/plugins/src/` 中的中文字符
2. 区分**注释中文**（保留）与**运行时字符串字面量中文**（转英文）
3. 把所有运行时中文字面量直接改为英文字面量（不引入 i18n，先保证兼容性）
4. `throw new Error('中文')` → `throw new Error('English message')`
5. `console.warn('中文')` → 改走 `warn(WarnSource.XXX, 'English')`
6. 跑 tsc + vitest + vite build 验证

**验收**：运行时不再出现中文字符串字面量（注释除外），所有测试通过。

### 阶段 3：i18n 核心模块实现

1. 新建 `core/i18n.ts`，实现 `t()`/`setLocale()`/`getLocale()`/`registerLocale()`/`subscribeLocale()`/`isI18nEnabled()`/`initI18n()`
2. 实现 fallback 链：当前语言包 → en-US → key 字面量
3. 实现参数插值：`{name}` 占位符替换
4. 实现响应式 locale 状态（基于自研 signalsCore，与项目现有 signals 体系一致）
5. 编写单元测试（vitest）覆盖：查表命中、fallback、参数插值、registerLocale、setLocale 触发订阅
6. 跑 tsc + vitest 验证

**验收**：i18n 模块独立可用，单元测试全部通过。

### 阶段 4：默认语言包填充

1. 新建 `core/locales/en-US.json` 与 `core/locales/zh-CN.json`
2. 把阶段 2 转换的英文字面量提取为 i18n key，写入 en-US.json
3. 编写对应 zh-CN.json 中文翻译
4. 新建 `core/locales/index.ts` 聚合导入
5. 新建业务层、插件层语言包目录
6. 跑 tsc + vitest 验证

**验收**：JSON 资源齐全，可被 i18n 模块加载。

### 阶段 5：接入点改造

1. 改造 `core/warning.ts` 的 `warn()`/`reportError()` 接入 `t()`
2. 改造 `utils/logger.ts` 的 `Logger.warn()`/`error()`/`info()`/`debug()` 接入 `t()`
3. 改造所有调用方，把英文字面量改为 i18n key
4. 改造 UI 组件，把硬编码文案改为 `t()` 查表
5. 改造 `defaultConfig.ts`，`playerName` 改为 i18n key 或移除（用 `ui.title`）
6. 跑 tsc + vitest + vite build 验证

**验收**：开启 i18n 后中英切换正常，关闭 i18n 后输出英文。

### 阶段 6：PlayerConfig 与公开 API 对接

1. `types/index.ts` 新增 `i18n?: I18nConfig` 字段
2. `VideoPlayer` 新增 `setLocale()`/`getLocale()`/`registerLocale()`/`translate()` 实例方法
3. `PlayerEvent` 新增 `LOCALE_CHANGE`
4. UI 组件监听 `localeChange` 事件触发重渲染
5. 更新 `docs/api.md` 文档
6. 更新 demo 演示语言切换
7. 跑 tsc + vitest + vite build 验证

**验收**：用户可通过 `player.setLocale('zh-CN')` 切换语言，UI 立即更新。

### 阶段 7：用户文档与示例

1. 编写 `docs/i18n-guide.md` 用户使用指南
2. demo 新增语言切换控件
3. 文档说明如何新增自定义语言
4. 跑全部验证

**验收**：用户按文档可独立新增一种语言。

---

## 十一、风险与兼容性

### 11.1 兼容性矩阵

| 改动 | 影响 | 兼容措施 |
|---|---|---|
| 包名 `hili-player` → `lumina-player` | 用户 `import` 路径失效 | 保留 alias 重导出 1 个大版本 |
| `__LUMINA_DEV__` → `__LUMINA_DEV__` | 构建标记变更 | 同步改 vite.config.ts，旧标记保留读取（兼容期） |
| 存储 key `nova-player:*` | 用户已有数据 | `restorePersistedPlayback()` 兼容读旧 key 写新 key |
| `warn()` message 参数语义变更 | 老代码传中文字面量会查表失败 | fallback 链返回 key 字面量本身（即原中文字面量），无报错 |
| `logger.error()` 第二参数从 Error 改为对象 | 老代码传 Error 实例 | Logger 内部用 `instanceof Error` 判断，保留兼容路径 |
| `playerName` 字段移除 | 用户配置失效 | 改为 `ui.title`，`defaultConfig` 兼容期同时读两字段 |

### 11.2 性能影响

| 场景 | 开销 |
|---|---|
| i18n 未启用（默认） | 0 开销，`isI18nEnabled()` 短路返回 |
| i18n 启用 + key 命中 | 1 次 Map 查找 + 1 次字符串 replace，<1μs |
| i18n 启用 + fallback 到 en-US | 2 次 Map 查找 + 1 次 replace，<2μs |
| i18n 启用 + fallback 到 key 字面量 | 3 次 Map 查找，<3μs |

**结论**：性能影响可忽略。

### 11.3 类型安全风险

| 风险 | 缓解 |
|---|---|
| key 拼写错误运行时才发现 | 可选：实施时增加 `dev` 模式下 key 合法性检查（遍历 JSON 校验） |
| `params` 类型不明确 | 强类型 `Record<string, unknown>` + 类型谓词函数校验 |
| `as` 断言禁用约束 | 全部使用类型谓词函数 + 函数重载替代 |

### 11.4 SSR 风险

- i18n 模块本身不依赖 `window`/`document`
- `initI18n()` 在 SSR 与 CSR 上下文均可调用
- 服务端渲染时 locale 由请求头 `Accept-Language` 解析（用户业务层职责，框架不强制）

---

## 十二、验收标准

### 12.1 功能验收

- [ ] 框架包名变 `lumina-player`，构建产物正常发布
- [ ] 所有日志前缀为 `[Lumina/...]`
- [ ] 运行时无中文字符串字面量（注释除外）
- [ ] 开启 `i18n.enabled: true` + `locale: 'zh-CN'` 后，所有 UI 文案显示中文
- [ ] 切换 `setLocale('en-US')` 后，UI 立即显示英文
- [ ] `registerLocale('ja-JP', {...})` 后可切换到日文
- [ ] 未注册的 locale 自动 fallback 到 en-US，再 fallback 到 key 字面量
- [ ] 关闭 i18n（默认）时所有日志输出英文

### 12.2 工程验收

- [ ] `tsc --noEmit` 零错误
- [ ] `vitest run` 全部通过（含新增 i18n 单元测试）
- [ ] `vite build` 成功，产物包含 en-US.json / zh-CN.json
- [ ] `eslint packages --ext .ts` 无错误
- [ ] 无 `as` 类型断言（除 utils/index.ts 的 once/deepMerge 受约束例外）
- [ ] 所有新增代码注释为中文
- [ ] 所有运行时字符串为英文或 i18n key

### 12.3 文档验收

- [ ] `docs/i18n-design.md`（本文档）已审批
- [ ] `docs/i18n-guide.md` 用户使用指南完成
- [ ] `docs/api.md` 新增 i18n API 章节
- [ ] demo 演示语言切换功能

---

## 附录 A：与主流播放器 i18n 方案对比

| 播放器 | i18n 实现 | key 风格 | fallback | 我们借鉴点 |
|---|---|---|---|---|
| **Plyr** | `i18n` 配置对象，直接传字面量 | 无 key，直接 value | 无 | 反面教材：不支持运行时切换 |
| **video.js** | `vjs.get/lang` + JSON 资源 | 命名空间 + key | en-US | key 命名风格 |
| **ArtPlayer** | `art.i18n` + 函数 | key 字符串 | 无 | 简洁 API |
| **xgplayer** | `lang` 配置 + 资源文件 | 命名空间 + key | en-US | 资源文件组织 |
| **TCPlayer** | `language` 配置 | key | en-US | 多语言注册 |
| **Lumina（本方案）** | `t()` + JSON + registerLocale | `layer.severity.module.name` | 三段式 | 综合 + 类型安全 |

---

## 附录 B：实施工作量预估

| 阶段 | 新增/修改文件 | 复杂度 |
|---|---|---|
| 1. 改名 Lumina | 5-8 | 低 |
| 2. 中文字面量转英文 | 30-50 | 中（机械工作量大） |
| 3. i18n 核心模块 | 1 新增 + 1 测试 | 中 |
| 4. 默认语言包 | 6-9 新增 JSON | 中 |
| 5. 接入点改造 | 2-5 修改 + 30-50 调用方修改 | 高 |
| 6. PlayerConfig 对接 | 3-5 修改 | 低 |
| 7. 文档与示例 | 2-3 新增 | 低 |
| **总计** | **约 80-130 文件改动** | **中-高** |

---

## 审批

请用户审阅本设计文档，确认以下决策点后回复"开始实施"以进入实施阶段：

1. **框架名 Lumina** 是否最终确定？
2. **i18n 默认不启用**（保持英文字面量输出）是否符合预期？
3. **接入点只放 warning.ts + logger.ts** 两处是否认可？
4. **key 命名规范 `layer.severity.module.name`** 是否认可？
5. **注释保留中文、运行时字符串转英文** 的策略是否认可？
6. **7 个实施阶段顺序** 是否需要调整？
7. 是否有其他需要补充的功能或约束？
