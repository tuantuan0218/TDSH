// 半落地销账率·分母研究（只读）：god ec0794 裁决 b 案触发线判定
// 口径：.3 窗（19:25:06 起）所有『回合结束仍有半落地未销账 eids=…』的 eid，追后续 N=5 回合内是否真销账
// 输出：表（eid / 首次挂账时间 / 最终状态 / 距回合数）+ 等待语义占比结论
const fs = require('fs');
const path = require('path');
const LOGDIR = 'D:/tdsh/炉石传说/hs-script/log';
const START = process.argv[2] || '2026-09-13 19:25';
const N = parseInt(process.argv[3] || '5', 10);
const files = fs.readdirSync(LOGDIR).filter(f => f.endsWith('.log'));
const lines = files.flatMap(f => fs.readFileSync(path.join(LOGDIR, f), 'utf8').split('\n'));
const seg = lines.filter(l => /^2026-09-13 /.test(l) && l.slice(0, 19) >= START);
if (seg.length < 100) { console.log('样本窗过短，行=' + seg.length); process.exit(2); }

// 回合轴：每个"我方回合"= 一个回合 tick
const turnIdx = [];
seg.forEach((l, i) => { if (/GameTurnPhaseStrategy\.kt:34\] INFO  我方回合/.test(l)) turnIdx.push({ i, t: l.slice(11, 19) }); });
const turnOf = i => { let k = -1; for (const o of turnIdx) { if (o.i <= i) k++; else break; } return k; };
const turnTime = k => (turnIdx[k] ? turnIdx[k].t : 'END');

// 事件收集
const settle = new Map();      // eid -> 最早销账行索引（L247 销账 / 恢复落地销账 / 点币落地确认 / 落地区添加）
const hang = [];               // {eid, i, turn, line}
const boardLanding = new Map(); // eid -> 首次上战场索引
const destroy = new Map();     // eid -> 首次进墓地/移除/除外索引
for (let i = 0; i < seg.length; i++) {
  const l = seg[i];
  let m;
  if ((m = l.match(/半落地销账: eid=(\d+)/)) || (m = l.match(/半落地恢复落地销账: eid=(\d+)/)) || (m = l.match(/点币落地确认（真实落地）: eid=(\d+)/))) {
    const e = m[1]; if (!settle.has(e)) settle.set(e, i);
  }
  if ((m = l.match(/回合结束仍有半落地未销账 eids=([\d,]+)/))) {
    for (const e of m[1].split(',')) hang.push({ eid: e.trim(), i, turn: turnOf(i) });
  }
  if (/【战场】添加卡牌/.test(l) && (m = l.match(/entityId:(\d+)/))) { const e = m[1]; if (!boardLanding.has(e)) boardLanding.set(e, i); }
  if (/【墓地】添加卡牌|【移除区】添加卡牌|【除外区】添加卡牌/.test(l) && (m = l.match(/entityId:(\d+)/))) { const e = m[1]; if (!destroy.has(e)) destroy.set(e, i); }
}
// 每 eid 取首次挂账
const first = new Map();
for (const h of hang) if (!first.has(h.eid)) first.set(h.eid, h);
const totalTurns = turnIdx.length;
const rows = [];
let waitSem = 0, swallowed = 0, pending = 0;
for (const [eid, h] of [...first.entries()].sort((a, b) => a[1].i - b[1].i)) {
  const sIdx = settle.get(eid);
  const bIdx = boardLanding.get(eid);
  const dIdx = destroy.get(eid);
  let st, dt = -1;
  if (sIdx !== undefined && sIdx > h.i) { st = '落地销账'; dt = turnOf(sIdx) - h.turn; }
  else if (bIdx !== undefined && bIdx > h.i) { st = '落战场'; dt = turnOf(bIdx) - h.turn; }
  else if (dIdx !== undefined && dIdx > h.i) { st = '销毁未落地'; dt = turnOf(dIdx) - h.turn; }
  else if (h.turn + N >= totalTurns) { st = '窗尾未定'; dt = totalTurns - h.turn; }
  else { st = 'N回合内未定'; dt = N; }
  if (st === '落地销账' || st === '落战场') waitSem++; else if (st === '销毁未落地') swallowed++; else pending++;
  rows.push({ eid, t0: turnTime(h.turn), st, dt });
}
console.log('窗口起点=' + START + '  回合数=' + totalTurns + '  挂账行=' + hang.length + '  唯一 eid=' + first.size + '  N=' + N);
console.log('eid   首次挂账   最终状态        距回合');
for (const r of rows) console.log(String(r.eid).padEnd(5), r.t0.padEnd(10), r.st.padEnd(14), r.dt);
const denom = waitSem + swallowed;
const pct = denom ? (waitSem / denom * 100).toFixed(1) : 'NA';
console.log('=== 结论 ===');
console.log('等待语义(真落地/落战场)=' + waitSem + '  被吞(销毁未落地)=' + swallowed + '  未定(窗尾/N内)=' + pending);
console.log('等待语义占比(已判定分母)=' + pct + '%   [god 触发线: <50% 动码 / ≥80% 归档设计内]');
console.log('样本判定数=' + denom + (denom < 30 ? ' → ⚠️ <30，需扩窗复测' : ' → ✅ ≥30 可下结论'));
