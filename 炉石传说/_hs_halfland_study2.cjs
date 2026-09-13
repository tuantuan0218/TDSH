// 半落地销账率·分母研究 v2（只读）：按局切分作用域（防 eid 跨局复用污染）+ 跨局清账归类
// 用法: node _hs_halfland_study2.cjs [窗口起点 '2026-09-13 10:20'] [N=5]
const fs = require('fs');
const path = require('path');
const LOGDIR = 'D:/tdsh/炉石传说/hs-script/log';
const START = process.argv[2] || '2026-09-13 10:20';
const N = parseInt(process.argv[3] || '5', 10);
const files = fs.readdirSync(LOGDIR).filter(f => f.endsWith('.log'));
const lines = files.flatMap(f => fs.readFileSync(path.join(LOGDIR, f), 'utf8').split('\n'));
const seg = lines.filter(l => /^2026-09-13 /.test(l) && l.slice(0, 19) >= START);

// 局边界：以『已完成第 N 把游戏』为局终分界；局号 g（0=第一局前）
const gEnd = [];
seg.forEach((l, i) => { if (/已完成第 \d+ 把游戏/.test(l) || /本局游戏胜者：/.test(l)) gEnd.push(i); });
const gameOf = i => { let g = 0; for (const e of gEnd) { if (e <= i) g++; else break; } return g; };
// 回合轴（全局 tick）
const turns = [];
seg.forEach((l, i) => { if (/GameTurnPhaseStrategy\.kt:34\] INFO  我方回合/.test(l)) turns.push(i); });
const turnOf = i => { let k = -1; for (const o of turns) { if (o <= i) k++; else break; } return k; };

const settle = new Map(), board = new Map(), grave = new Map(), hang = [];
for (let i = 0; i < seg.length; i++) {
  const l = seg[i]; let m;
  if ((m = l.match(/半落地销账: eid=(\d+)/)) || (m = l.match(/半落地恢复落地销账: eid=(\d+)/)) || (m = l.match(/点币落地确认（真实落地）: eid=(\d+)/))) {
    const e = m[1]; if (!settle.has(e)) settle.set(e, []); settle.get(e).push({ i, g: gameOf(i) });
  }
  if ((m = l.match(/回合结束仍有半落地未销账 eids=([\d,]+)/))) for (const e of m[1].split(',')) hang.push({ eid: e.trim(), i, g: gameOf(i), turn: turnOf(i) });
  if (/【战场】添加卡牌/.test(l) && (m = l.match(/entityId:(\d+)/))) { const e = m[1]; if (!board.has(e)) board.set(e, []); board.get(e).push({ i, g: gameOf(i) }); }
  if (/【墓地】添加卡牌|【移除区】添加卡牌|【除外区】添加卡牌/.test(l) && (m = l.match(/entityId:(\d+)/))) { const e = m[1]; if (!grave.has(e)) grave.set(e, []); grave.get(e).push({ i, g: gameOf(i) }); }
}
const first = new Map();
for (const h of hang) if (!first.has(h.eid)) first.set(h.eid, h);

const sameGame = (arr, h) => arr ? arr.filter(o => o.i > h.i && o.g === h.g) : [];
const rows = []; let wait = 0, swallow = 0, cross = 0, tail = 0;
for (const [eid, h] of [...first.entries()].sort((a, b) => a[1].i - b[1].i)) {
  const s = sameGame(settle.get(eid), h), b = sameGame(board.get(eid), h), d = sameGame(grave.get(eid), h);
  let st, dt = -1;
  if (s.length) { st = '同局落地销账'; dt = turnOf(s[0].i) - h.turn; }
  else if (b.length) { st = '同局落战场'; dt = turnOf(b[0].i) - h.turn; }
  else if (d.length) { st = '同局销毁(被吞)'; dt = turnOf(d[0].i) - h.turn; }
  else {
    // 之后是否换局（跨局清账=设计内 D1）
    const later = seg.slice(h.i + 1);
    const changed = later.findIndex(l => /已完成第 \d+ 把游戏/.test(l) || /本局游戏胜者：/.test(l));
    const anySettleLater = (settle.get(eid) || []).some(o => o.i > h.i && o.g !== h.g);
    if (changed >= 0 || anySettleLater) { st = '跨局清账(设计内)'; cross++; }
    else { st = '窗尾未定'; tail++; }
  }
  if (st === '同局落地销账' || st === '同局落战场') wait++;
  if (st === '同局销毁(被吞)') swallow++;
  rows.push({ eid, t0: seg[h.i].slice(11, 19), g: h.g, st, dt });
}
console.log('窗=' + START + '  局数≈' + (gEnd.length ? new Set(gEnd.map(gameOf)).size : 0) + '  挂账行=' + hang.length + '  唯一eid=' + first.size + '  N=' + N);
console.log('eid   首次挂账   局  状态              距回合');
for (const r of rows) console.log(String(r.eid).padEnd(5), r.t0.padEnd(10), String(r.g).padEnd(2), r.st.padEnd(16), r.dt);
const judged = wait + swallow;
console.log('=== 结论 ===');
console.log('等待语义(同局真落地/落战场)=' + wait + ' | 被吞(同局销毁)= ' + swallow + ' | 跨局清账(设计内 D1)=' + cross + ' | 窗尾未定=' + tail);
console.log('等待语义占比(仅同局判定分母 ' + judged + ')=' + (judged ? (wait / judged * 100).toFixed(1) : 'NA') + '%');
console.log('广义等待语义(含跨局清账)=' + (wait + cross) + '/' + (wait + swallow + cross) + ' = ' + ((wait + cross) / (wait + swallow + cross) * 100).toFixed(1) + '%');
console.log('触发线判定：被吞占比=' + (first.size ? (swallow / first.size * 100).toFixed(1) : 'NA') + '% （god 线：<50% 等待→动码；≥80% 等待→归档设计内）');
