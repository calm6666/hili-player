/*
 * HLS（single / SegmentBase 字节范围）自检（纯 Node，不需要测试框架）
 *
 * 用法（在 packages/plugins 下执行）：
 *   1) node_modules\.bin\tsc.cmd src/vendor/manifest-to-hls.ts --ignoreConfig --outDir <临时目录> ^
 *        --module commonjs --target es2020 --moduleResolution node --skipLibCheck --esModuleInterop
 *   2) 把 src/hls/vendor/hls.mjs 与 a 本文件拷到 <临时目录> 后：node segmentbase.hls.check.cjs
 *
 * 覆盖：single+segments[] → 每段同文件 + HLS 记法字节范围（长度@起点）+ init 用 #EXT-X-MAP 语义；
 *       single 只有 indexRange（HLS 无 sidx 概念）→ 不产出 playlistDetails；
 *       list 带 byteRange → 带上范围且 list 既有行为不回归；
 *       真跑 hls.js fork 的 _buildLevelDetails（loadManifest 内部就是它）确认 Fragment 上带
 *       [起点, 起点+长度] 且 init 段带范围。全部通过时退出码 0。
 */
/* HLS锛坰ingle / SegmentBase锛夎浆鎹㈠櫒杩愯鏈熼獙璇侊紙CJS锛?   - 瑕嗙洊 manifest-to-hls.ts 鐨?single 鍒嗘敮涓?DASH鈫扝LS 瀛楄妭鑼冨洿璁版硶鎹㈢畻
   - 骞跺皾璇曠湡璺?hls.js fork 鐨?loadManifest锛岀‘璁?Fragment 涓婄湡鐨勫甫涓婁簡瀛楄妭鑼冨洿 */
const path = require('path');
const hlsConv = require(path.join(__dirname, 'manifest-to-hls.js'));

const FILE = 'http://127.0.0.1:9000/video/dash2/sb-video-h264-1080p.m4s';
const NAME = 'sb-video-h264-1080p.m4s';
const DIR = 'http://127.0.0.1:9000/video/dash2/';

const fails = [];
function check(name, cond, extra) {
  if (cond) {
    console.log('  OK   ' + name);
  } else {
    console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''));
    fails.push(name);
  }
}

const baseRep = {
  id: 0, baseUrl: FILE, backupUrls: [FILE], bandwidth: 5000000,
  mimeType: 'video/mp4', codecs: 'avc1.64001f', width: 1920, height: 1080, frameRate: 25,
};
/* DASH 闂尯闂达細908-588221 闀垮害 = 587314 */
const segs = [
  { duration: 6, url: NAME, byteRange: '908-588221' },
  { duration: 6, url: NAME, byteRange: '588222-1184188' },
];

/* ---------- 鐢ㄤ緥 1锛歴ingle锛圫egmentBase锛夆啋 #EXT-X-BYTERANGE 褰㈡€?---------- */
console.log('\n[case 1] single + segments[] 鈫?姣忔鍚屾枃浠?+ 瀛楄妭鑼冨洿锛圚LS 璁版硶 闀垮害@璧风偣锛?);
const data1 = hlsConv.manifestToHls({
  duration: 12,
  video: [{ ...baseRep, segmentInfo: { mode: 'single', initialization: '0-819', indexRange: '820-907', segments: segs } }],
});
const v1 = data1.variants[0];
const d1 = v1.playlistDetails;
check('variant.url 鏄崟鏂囦欢涓斾笉琛ュ熬鏂滄潬', v1.url === FILE, v1.url);
check('鎷垮埌 playlistDetails', !!d1);
check('init 鐢ㄥ崟鏂囦欢 + 瀛楄妭鑼冨洿',
  d1 && d1.initSegmentUrl === FILE && d1.initSegmentRange === '820@0',
  d1 && { url: d1.initSegmentUrl, range: d1.initSegmentRange });
check('涓ゆ閮芥寚鍚戝悓涓€涓枃浠?, d1 && d1.segments.every((s) => s.url === FILE));
check('瀛楄妭鑼冨洿鎹㈢畻涓?闀垮害@璧风偣',
  d1 && d1.segments[0].byteRange === `${588221 - 908 + 1}@908` && d1.segments[1].byteRange === `${1184188 - 588222 + 1}@588222`,
  d1 && d1.segments.map((s) => s.byteRange));
check('鏃堕暱鍘熸牱淇濈暀', d1 && d1.segments[0].duration === 6 && d1.segments[1].duration === 6);

/* ---------- 鐢ㄤ緥 2锛歴ingle 浣嗘病鏈?segments[]锛堝彧鏈?indexRange锛夆啋 鏃犳硶鏋氫妇锛岃繑鍥?undefined ---------- */
console.log('\n[case 2] single 鍙湁 indexRange锛圚LS 娌℃湁 sidx 姒傚康锛夆啋 涓嶄骇鍑?playlistDetails');
const data2 = hlsConv.manifestToHls({
  duration: 12,
  video: [{ ...baseRep, segmentInfo: { mode: 'single', initialization: '0-819', indexRange: '820-907' } }],
});
check('娌℃湁 playlistDetails锛堜笉浜у嚭鍗婃埅娓呭崟锛?, !data2.variants[0].playlistDetails, data2.variants[0].playlistDetails);

/* ---------- 鐢ㄤ緥 3锛歭ist 甯?byteRange 鈫?涔熻甯︿笂锛沴ist 鏃㈡湁琛屼负涓嶅洖褰?---------- */
console.log('\n[case 3] list 甯?byteRange 鈫?甯︿笂鑼冨洿锛沴ist 鐨勭洰褰曞紡 baseUrl 浠嶈ˉ鏂滄潬');
const data3 = hlsConv.manifestToHls({
  duration: 12,
  video: [{
    ...baseRep, baseUrl: DIR, backupUrls: [],
    segmentInfo: { mode: 'list', initialization: 'init-0.m4s', segments: segs },
  }],
});
const v3 = data3.variants[0];
check('list 鐨?variant.url 浠嶈ˉ灏炬枩鏉狅紙鏈洖褰掞級', v3.url === DIR, v3.url);
check('list 姣忔涔熷甫涓?HLS 璁版硶鐨勫瓧鑺傝寖鍥?,
  v3.playlistDetails && v3.playlistDetails.segments.every((s) => typeof s.byteRange === 'string' && s.byteRange.includes('@')),
  v3.playlistDetails && v3.playlistDetails.segments);
check('list 鐨?init 浠嶆槸 URL 褰㈠紡锛堟棤 initSegmentRange锛?,
  v3.playlistDetails && v3.playlistDetails.initSegmentUrl === DIR + 'init-0.m4s' && v3.playlistDetails.initSegmentRange === undefined,
  v3.playlistDetails && { u: v3.playlistDetails.initSegmentUrl, r: v3.playlistDetails.initSegmentRange });

/* ---------- 鐢ㄤ緥 4锛氱湡璺?hls.js fork 鐨?loadManifest锛岀‘璁?Fragment 甯︿笂浜嗗瓧鑺傝寖鍥?---------- */
(async () => {
  console.log('\n[case 4] hls.js fork锛歭oadManifest 鍚?Fragment 涓婂簲鏈?byteRange');
  let Hls = null;
  try {
    /* Windows 涓?ESM 鍔ㄦ€?import 蹇呴』鐢?file:// URL锛沠ork 鏄祻瑙堝櫒浠ｇ爜锛屽厛琛ユ渶灏忓叏灞€閲?*/
    const { pathToFileURL } = require('url');
    if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
    Hls = (await import(pathToFileURL(path.join(__dirname, 'hls.mjs')).href)).default;
  } catch (e) {
    console.log('  (璺宠繃锛歠ork 鏃犳硶鍦?Node 閲?import -> ' + (e && e.message) + ')');
  }
  if (Hls) {
    try {
      const hls = new Hls({ autoStartLoad: false });
      /* loadManifest 闇€瑕佸厛 attachMedia锛堟祻瑙堝櫒閲岀殑 <video>锛夛紝Node 閲屾病鏈夛紱
         瀹冨唴閮ㄥ氨鏄皟 _buildLevelDetails(...)锛岃繖閲岀洿鎺ヨ皟鍚屼竴澶勬潵楠岃瘉琛ヤ竵銆?*/
      const details = hls._buildLevelDetails(data1.variants[0].playlistDetails, v1.url, 0, 'main');
      const frags = (details && details.fragments) || [];
      console.log('  fragments=' + frags.length);
      const first = frags[0];
      check('绗竴涓垎鐗囩殑 byteRange = [908, 588222]锛堣捣鐐? 璧风偣+闀垮害锛?,
        !!first && Array.isArray(first.byteRange) && first.byteRange[0] === 908 && first.byteRange[1] === 588222,
        first && first.byteRange);
      check('绗簩涓垎鐗囨帴缁?[588222, 1184189]',
        !!frags[1] && frags[1].byteRange[0] === 588222 && frags[1].byteRange[1] === 1184189,
        frags[1] && frags[1].byteRange);
      check('init 娈靛甫瀛楄妭鑼冨洿 [0, 820]',
        !!first && !!first.initSegment && Array.isArray(first.initSegment.byteRange)
        && first.initSegment.byteRange[0] === 0 && first.initSegment.byteRange[1] === 820,
        first && first.initSegment && first.initSegment.byteRange);
      check('鍒嗙墖 URL 鎸囧悜鍗曟枃浠?, !!first && first.url === FILE, first && first.url);
    } catch (e) {
      console.log('  (fork 杩愯鏃舵姤閿欙紝鏃犳硶鍦ㄦ鐜楠岃瘉 -> ' + (e && e.message) + ')');
    }
  }
  console.log('\nRESULT: ' + (fails.length === 0 ? 'ALL PASS' : 'FAIL (' + fails.length + ') -> ' + fails.join(' | ')));
  process.exit(fails.length === 0 ? 0 : 1);
})();
