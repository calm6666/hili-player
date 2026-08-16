# TODO

- [x] Hydration: `core/mount.ts` now hydrates in DOM order and handles `Fragment` / multi-root SSR output.
- [x] API design: `core/h.ts` `show()` now returns a new VNode instead of mutating the input node.
- [x] Performance: `core/state.ts` now prefers `structuredClone()` for `getState()` snapshots.
- [x] SSR parity: `core/ssr.ts` now only treats real HTML boolean attrs specially; other booleans serialize as strings.
- [x] SSR safety: `media/monitor.ts` now no-ops before touching `window.setInterval` or RAF APIs.
- [x] SSR safety: `media/playerInfoPanel.ts` now no-ops before touching `document` / `window.getComputedStyle`.
- [x] SSR safety: `packages/plugins/src/utils/danmaku/index.ts` now no-ops during init before constructing DOM-backed engines.
- [x] SSR safety: `packages/plugins/src/interaction/*` and `packages/plugins/src/subtitle/*` now guard `install()` / `render()` entry points in non-browser environments.
- [x] SSR context cleanup: `core/ssr.ts` provider stack cleanup now runs in `finally` even if child rendering throws.
- [x] Env safety: `core/state.ts` now uses `isDev()` instead of reading `process.env.NODE_ENV` directly.
