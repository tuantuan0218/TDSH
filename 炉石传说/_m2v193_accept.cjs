// m2v193 验收窗数据采集（四指标：空转=0、穷尽即收、门线内结束回合、中位不回归）
// 行号锚升级：穷尽自门 L574 / 穷局门线(剔集) L624 / 因分类账 L661 / 币族 L253 / 双轨 L601
const fs = require('fs');
const lines = fs.readFileSync('D:/tdsh/炉石传说/hs-script/log/hs_script.log', 'utf8').split('\n');
// 从 03:07:09（m2v193 在役，java 9320 起）之后第一条起（开放式比较，跨小时安全）
const start = lines.findIndex(l => l.slice(0, 19) >= '2026-09-13 03:07:09');
const seg = lines.slice(start);
const done = [];
let tmp = null;
const ACTION_RE = /出牌 eid:|攻击【|英雄技能|点选战场槽位|点选目标/;
for (const l of seg) {
  const m = /^2026-09-13 (\d\d:\d\d:\d\d)\.(\d+)/.exec(l);
  if (!m) continue;
  const ts = new Date('2026-09-13T' + m[1] + '.' + (m[2] || '0'));
  if (/我方回合/.test(l)) { tmp = { s: ts, reason: null, acts: 0 }; }
  else if (/对方回合/.test(l) && tmp) { tmp.e = ts; done.push(tmp); tmp = null; }
  else if (tmp && !tmp.e) {
    if (ACTION_RE.test(l)) tmp.acts++;
    if (/穷局门线\(剔集\)/.test(l)) tmp.reason = '门线(剔集)';
    else if (/穷尽自门/.test(l)) tmp.reason = tmp.reason ? tmp.reason : '穷尽自门';
    else if (/超时熔断/.test(l)) tmp.reason = (tmp.reason || '') + '+熔断';
    else if (/块陈旧.*直接收回合/.test(l)) tmp.reason = (tmp.reason || '') + '+陈旧';
    else if (/CLIENT-FROZEN/.test(l)) tmp.reason = (tmp.reason || '') + '+冻结';
  }
}
const durs = done.filter(t => t.e).map(t => (t.e - t.s) / 1000);
console.log('我方回合数:', done.length);
if (durs.length) {
  const sorted = [...durs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log('回合耗时(秒):', durs.map(d => d.toFixed(1)).join(', '));
  console.log('中位:', median.toFixed(1), 's / max:', sorted[sorted.length - 1].toFixed(1), 's（基线 m2v191: 19.1 / 59.5）');
}
console.log('收工原因分布:');
const byReason = {};
for (const t of done) {
  // v2 口径：无门线/穷尽关键词但有动作 = 动作打满自然收（非真三空）
  const r = t.reason || (t.acts > 0 ? '动作打满自然收(' + t.acts + '动作)' : '(真三空)');
  byReason[r] = (byReason[r] || 0) + 1;
}
for (const [r, c] of Object.entries(byReason)) console.log(' ', r, '×', c);
const trueEmpty = done.filter(t => !t.reason && !(t.acts > 0));
// 四指标
const gateHits = seg.filter(l => /穷局门线\(剔集\)/.test(l)).length;
const staleCloses = seg.filter(l => /块陈旧.*直接收回合/.test(l)).length;
const melts = seg.filter(l => /超时熔断/.test(l)).length;
const coinHold = seg.filter(l => /幸运币家族.*留手不点/.test(l)).length;
const coinGated = seg.filter(l => /穷尽门刨币/.test(l)).length;
const stopList = seg.filter(l => /攻击停手清单/.test(l)).length;
console.log('--- m2v193 四指标 ---');
console.log('门线触发(剔集):', gateHits, '次 | 陈旧10s收:', staleCloses, '次 | 熔断:', melts, '次');
console.log('币族留手:', coinHold, '次 | 穷尽门刨币:', coinGated, '次 | 攻击停手清单:', stopList, '次');
