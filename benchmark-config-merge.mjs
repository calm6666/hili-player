/**
 * 配置合并策略微基准
 * 目的：为 PlayerConfig 的合并实现选型提供实测数据。
 * 运行：node benchmark-config-merge.mjs
 */

const baseDefault = {
  container: undefined,
  src: '',
  autoplay: false,
  muted: false,
  volume: 1,
  playbackRate: 1,
  loop: false,
  controls: {
    prev: true, next: true, viewpoint: false, quality: true,
    episodes: false, setting: true, pip: true, wideScreen: true, webFullscreen: true,
  },
  poster: '',
  defaultQuality: 'auto',
  playMode: 'order',
  keyboard: true,
  progressSegments: [
    { startTime: 0, endTime: 90, label: '待填写' },
    { startTime: 90, endTime: 180, label: '' },
  ],
  playerName: '嗨哩播放器',
  subtitles: [{ url: '', lang: 'zh-CN', isDefault: true }],
  danmaku: { visible: true, opacity: 1, speed: 1, density: 1, fontSize: 25, area: 0.75 },
  ssr: { enabled: false, placeholder: '<div></div>', deferHydration: false },
  plugins: [],
  debug: false,
  callbacks: {},
};

const userConfig = {
  src: 'https://example.com/a.m3u8',
  autoplay: true,
  danmaku: { opacity: 0.6, fontSize: 30 },
  progressSegments: [{ startTime: 0, endTime: 30, label: '第一章' }],
  controls: { quality: false },
  callbacks: { ready: () => {} },
};

// ---------- 策略 1：手写递归深合并，数组整体替换 ----------
function deepMerge(target, source) {
  const out = {};
  for (const key in target) {
    out[key] = target[key];
  }
  for (const key in source) {
    const sv = source[key];
    const tv = out[key];
    if (
      sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
      tv !== null && typeof tv === 'object' && !Array.isArray(tv)
    ) {
      out[key] = deepMerge(tv, sv);
    } else if (sv !== undefined) {
      out[key] = sv; // 数组与原始值整体替换
    }
  }
  return out;
}

// ---------- 策略 2：惰性合并（顶层浅合并 + 嵌套块首次访问时合并并缓存） ----------
function lazyMerge(target, source) {
  const out = {};
  for (const key in target) out[key] = target[key];
  for (const key in source) {
    const sv = source[key];
    const tv = out[key];
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
        tv !== null && typeof tv === 'object' && !Array.isArray(tv)) {
      const t = tv, s = sv;
      let cache;
      Object.defineProperty(out, key, {
        enumerable: true, configurable: true,
        get() {
          if (cache === undefined) cache = deepMerge(t, s);
          return cache;
        },
      });
    } else if (sv !== undefined) {
      out[key] = sv;
    }
  }
  return out;
}

// ---------- 策略 3：JSON 往返（浅合并后用 JSON 克隆默认值兜底） ----------
function jsonMerge(target, source) {
  return JSON.parse(JSON.stringify({ ...target, ...source }));
}

// ---------- 策略 4：Spread 浅合并（现状，仅作对照） ----------
function shallowMerge(target, source) {
  return { ...target, ...source };
}

const strategies = [
  ['1. 手写递归深合并', deepMerge],
  ['2. 惰性合并(顶层浅+嵌套懒合并)', lazyMerge],
  ['3. JSON 往返', jsonMerge],
  ['4. Spread 浅合并(现状)', shallowMerge],
];

const N = 200000;

console.log(`每种策略执行 ${N.toLocaleString()} 次合并\n`);
console.log('策略'.padEnd(34), '总耗时(ms)'.padStart(12), '单次(µs)'.padStart(10), '结果正确'.padStart(10));

const baseline = deepMerge(baseDefault, userConfig);

for (const [name, fn] of strategies) {
  // 预热
  for (let i = 0; i < 2000; i++) fn(baseDefault, userConfig);

  const t0 = process.hrtime.bigint();
  let last;
  for (let i = 0; i < N; i++) last = fn(baseDefault, userConfig);
  const t1 = process.hrtime.bigint();

  const totalMs = Number(t1 - t0) / 1e6;
  const perCallUs = (totalMs * 1000) / N;

  // 正确性：嵌套默认值是否保留 + 数组是否整体替换
  const okNested = last.danmaku.visible === true && last.danmaku.opacity === 0.6;
  const okArray = last.progressSegments.length === 1;

  console.log(
    name.padEnd(34),
    totalMs.toFixed(1).padStart(12),
    perCallUs.toFixed(3).padStart(10),
    (okNested && okArray ? '✓' : '✗').padStart(10),
  );
}

console.log('\n--- 正确性明细（嵌套默认值保留 / 数组整体替换）---');
for (const [name, fn] of strategies) {
  const r = fn(baseDefault, userConfig);
  console.log(
    name.padEnd(34),
    'danmaku.visible=' + String(r.danmaku?.visible).padEnd(6),
    'danmaku.speed=' + String(r.danmaku?.speed).padEnd(5),
    'segments=' + String(r.progressSegments?.length),
  );
}

// 惰性策略的首次访问成本
const lazy = lazyMerge(baseDefault, userConfig);
const t2 = process.hrtime.bigint();
for (let i = 0; i < N; i++) {
  const d = lazy.danmaku;
  void d.opacity;
}
const t3 = process.hrtime.bigint();
console.log(
  `\n惰性合并的嵌套块访问(缓存命中)：单次 ${(((Number(t3 - t2) / 1e6) * 1000) / N).toFixed(4)} µs（vs 直接属性访问约 0.001µs 量级）`,
);
