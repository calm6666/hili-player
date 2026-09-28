/*
 * SegmentBase 转换器运行期自检（纯 Node，不需要测试框架）
 *
 * 用法（在 packages/plugins 下执行）：
 *   node_modules\.bin\tsc.cmd src/vendor/manifest-to-dash.ts src/vendor/utils/validate.ts `
 *     --ignoreConfig --outDir <临时目录> --module commonjs --target es2020 `
 *     --moduleResolution node --skipLibCheck --esModuleInterop
 *   把本文件拷到 <临时目录> 后：node segmentbase.converter.check.cjs
 *   （需要 manifest-to-dash.js / utils/validate.js 与本文件同目录）
 *
 * 覆盖：single+indexRange→SegmentBase（BaseURL 不补尾斜杠、Initialization 用字节范围、timescale）、
 *       single 无 indexRange→SegmentList 兜底（media+mediaRange）、list 带 byteRange→mediaRange、
 *       validate 对 single 的四种形态判定。全部通过时退出码 0。
 */
/* SegmentBase 杞崲鍣ㄨ繍琛屾湡楠岃瘉锛圕JS锛岀洿鎺?require tsc 浜у嚭鐨?JS锛?   娉ㄦ剰锛氳緭鍑虹粨鏋勬槸 dash.js 椋庢牸 Period[] 鈫?AdaptationSet[] 鈫?Representation[]锛?   AdaptationSet 涔熷甫 mimeType锛屾墍浠ュ繀椤绘寜灞傜骇鍙栵紝涓嶈兘鐢?鎵剧涓€涓?video/mp4"鐨勯€掑綊銆?*/
const path = require('path');
const conv = require(path.join(__dirname, 'manifest-to-dash.js'));
const val = require(path.join(__dirname, 'utils', 'validate.js'));

const FILE = 'http://127.0.0.1:9000/video/dash2/sb-video-h264-1080p.m4s';
const NAME = 'sb-video-h264-1080p.m4s';

const fails = [];
function check(name, cond, extra) {
  if (cond) {
    console.log('  OK   ' + name);
  } else {
    console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''));
    fails.push(name);
  }
}
function rep0(out) {
  return out.Period[0].AdaptationSet[0].Representation[0];
}

const baseRep = {
  id: 0, baseUrl: FILE, backupUrls: [FILE], bandwidth: 5000000,
  mimeType: 'video/mp4', codecs: 'avc1.64001f', width: 1920, height: 1080, frameRate: 25,
};
const segs = [
  { duration: 6, url: NAME, byteRange: '908-588221' },
  { duration: 6, url: NAME, byteRange: '588222-1184188' },
];

/* ---------- 鐢ㄤ緥 1锛氭柊 SegmentBase JSON锛坰ingle + indexRange + segments[]锛?---------- */
console.log('\n[case 1] single + indexRange + segments[]锛堣浆鐮佽剼鏈骇鍑虹殑鏂?JSON 褰㈢姸锛?);
const rep1 = rep0(conv.manifestToDash({
  duration: 12,
  video: [{ ...baseRep, segmentInfo: { mode: 'single', timescale: 12800, initialization: '0-819', indexRange: '820-907', segments: segs } }],
}));
check('BaseURL 鏄崟鏂囦欢涓旀病鏈夊熬鏂滄潬', rep1.BaseURL[0] === FILE && !rep1.BaseURL[0].endsWith('/'), rep1.BaseURL);
check('backupUrls 鍚屾牱涓嶈ˉ鏂滄潬', rep1.BaseURL[1] === FILE, rep1.BaseURL);
check('SegmentBase.indexRange = 820-907', rep1.SegmentBase && rep1.SegmentBase.indexRange === '820-907', rep1.SegmentBase);
check('Initialization 鐢ㄥ瓧鑺傝寖鍥?{range} 鑰屼笉鏄?{sourceURL}',
  rep1.SegmentBase.Initialization.range === '0-819' && rep1.SegmentBase.Initialization.sourceURL === undefined,
  rep1.SegmentBase.Initialization);
check('SegmentBase.timescale = 12800', rep1.SegmentBase.timescale === 12800);
check('鍚屼竴鏉?rep 涓婁笉鍑虹幇 SegmentList / SegmentTemplate',
  !rep1.SegmentList && !rep1.SegmentTemplate, { L: !!rep1.SegmentList, T: !!rep1.SegmentTemplate });

/* ---------- 鐢ㄤ緥 2锛歴ingle 浣嗘病鏈?indexRange锛堝彧鏈夋樉寮?segments[]锛夆啋 SegmentList 鍏滃簳 ---------- */
console.log('\n[case 2] single锛堟棤 indexRange锛屽彧鏈?segments[]锛夆啋 搴旈€€鍥?SegmentList + mediaRange');
const rep2 = rep0(conv.manifestToDash({
  duration: 12,
  video: [{ ...baseRep, segmentInfo: { mode: 'single', initialization: '0-819', segments: segs } }],
}));
check('娌℃湁 SegmentBase锛堟棤 indexRange 鏃朵笉浜у嚭绌哄３锛?, !rep2.SegmentBase, rep2.SegmentBase);
check('鏈?SegmentList', !!rep2.SegmentList);
check('姣忔 media 鐢ㄥ崟鏂囦欢銆乵ediaRange 鐢?byteRange',
  !!rep2.SegmentList && rep2.SegmentList.SegmentURL.length === 2
  && rep2.SegmentList.SegmentURL.every((s) => s.media === FILE && typeof s.mediaRange === 'string'),
  rep2.SegmentList && rep2.SegmentList.SegmentURL);
check('SegmentList 鐨?Initialization 涔熸槸瀛楄妭鑼冨洿',
  !!rep2.SegmentList && rep2.SegmentList.Initialization.range === '0-819'
  && rep2.SegmentList.Initialization.sourceURL === undefined,
  rep2.SegmentList && rep2.SegmentList.Initialization);

/* ---------- 鐢ㄤ緥 3锛歭ist 妯″紡甯?byteRange 鈫?蹇呴』琛?mediaRange锛堜笖鏃㈡湁琛屼负涓嶅洖褰掞級 ---------- */
console.log('\n[case 3] list 妯″紡甯?byteRange 鈫?SegmentURL.mediaRange 涓嶈兘涓?);
const DIR = 'http://127.0.0.1:9000/video/dash2/';
const rep3 = rep0(conv.manifestToDash({
  duration: 12,
  video: [{
    ...baseRep, baseUrl: DIR, backupUrls: [],
    segmentInfo: { mode: 'list', timescale: 12800, initialization: 'init-0.m4s', segments: segs },
  }],
}));
check('SegmentList 瀛樺湪', !!rep3.SegmentList);
check('姣忔閮藉甫 mediaRange',
  !!rep3.SegmentList && rep3.SegmentList.SegmentURL.every((s) => typeof s.mediaRange === 'string'),
  rep3.SegmentList && rep3.SegmentList.SegmentURL);
check('list 妯″紡鐨?BaseURL 浠嶇劧琛ュ熬鏂滄潬锛堟湭鍥炲綊锛?, rep3.BaseURL[0] === DIR, rep3.BaseURL);
check('list 妯″紡鐨?Initialization 浠嶆槸 URL 褰㈠紡',
  !!rep3.SegmentList && typeof rep3.SegmentList.Initialization.sourceURL === 'string',
  rep3.SegmentList && rep3.SegmentList.Initialization);

/* ---------- 鐢ㄤ緥 4锛氭牎楠屽櫒锛堝叆鍙ｆ槸 validateManifest锛?---------- */
console.log('\n[case 4] validate 瀵?single 鐨勬敹绱э紙validateManifest锛?);
function tryValidate(segmentInfo) {
  try {
    val.validateManifest({ duration: 12, video: [{ ...baseRep, segmentInfo }] });
    return null;
  } catch (e) {
    return e;
  }
}
check('鏃㈡棤 indexRange 鍙堟棤 segments[] 鈫?鎶ラ敊', !!tryValidate({ mode: 'single', initialization: '0-819' }));
check('initialization 鍐欐垚 URL 鈫?鎶ラ敊', !!tryValidate({ mode: 'single', initialization: 'http://x/init.m4s', indexRange: '820-907' }));
check('indexRange 涓嶆槸 start-end 鈫?鎶ラ敊', !!tryValidate({ mode: 'single', initialization: '0-819', indexRange: 'not-a-range' }));
check('鍚堟硶 single锛坕ndexRange锛夆啋 閫氳繃', tryValidate({ mode: 'single', initialization: '0-819', indexRange: '820-907' }) === null);
check('鍚堟硶 single锛堝彧鏈?segments[]锛夆啋 閫氳繃',
  tryValidate({ mode: 'single', initialization: '0-819', segments: segs }) === null);

console.log('\nRESULT: ' + (fails.length === 0 ? 'ALL PASS' : 'FAIL (' + fails.length + ') -> ' + fails.join(' | ')));
process.exit(fails.length === 0 ? 0 : 1);
