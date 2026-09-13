// 炉石值守延伸快照（只读）：11 职业战绩 + 胜率趋势（分版本窗）+ 回归告警探针 + t-151 解锁探测
// 用法: node _hs_watch.cjs [起算时间 默认 '2026-09-13 10:20']
const fs = require('fs');
const path = require('path');
const LOGDIR = 'D:/tdsh/炉石传说/hs-script/log';
const START = process.argv[2] || '2026-09-13 10:20';
const files = fs.readdirSync(LOGDIR).filter(f => f.endsWith('.log'));
const lines = files.flatMap(f => fs.readFileSync(path.join(LOGDIR, f), 'utf8').split('\n'));
const NAMES = { HERO_01: '战士', HERO_02: '萨满', HERO_03: '盗贼', HERO_04: '圣骑士', HERO_05: '猎人', HERO_06: '牧师', HERO_07: '术士', HERO_08: '法师', HERO_09: '德鲁伊', HERO_10: '恶魔猎手', HERO_11: '死亡骑士' };
const ts = l => l.length > 19 ? l.slice(11, 19) : '';
const ok = l => /^2026-09-13 /.test(l) && ts(l) >= START.slice(11) || (/^2026-09-13 /.test(l) && l.slice(0, 19) >= START);

// 1) 职业配对战绩（armed 行→胜者行）
const games = []; let cur = null;
for (const l of lines) {
  if (!/^2026-09-13 /.test(l) || l.slice(0, 19) < START) continue;
  const mm = l.match(/行→职业实测: row=\d+ → (HERO_\d+)/);
  if (mm) { cur = { hero: mm[1], t: l.slice(11, 19) }; continue; }
  if (/本局游戏胜者：/.test(l) && cur) { cur.w = l.includes('团神血洗国服'); games.push(cur); cur = null; }
  else if (/本局游戏败者：/.test(l) && cur) { cur.w = false; games.push(cur); cur = null; }
}
const byH = {};
for (const g of games) { const r = byH[g.hero] = byH[g.hero] || { n: 0, w: 0, l: 0, last: '' }; r.n++; g.w ? r.w++ : r.l++; r.last = g.t; }
console.log('=== 各职业战绩（自 ' + START + '）===');
for (const h of Object.keys(NAMES)) {
  const r = byH[h];
  if (!r) { console.log('  ' + h, NAMES[h].padEnd(5), '未配对'); continue; }
  console.log('  ' + h, NAMES[h].padEnd(5), r.n + '局', r.w + 'W' + r.l + 'L', (r.w / r.n * 100).toFixed(0) + '%', '末:' + r.last);
}
const broken = Object.keys(byH).length;
console.log('破冰职业数: ' + broken + '/11', broken < 11 ? '| 缺: ' + Object.keys(NAMES).filter(h => !byH[h]).join(',') : '| ✅ 全破冰');
const tw = games.filter(g => g.w).length;
console.log('配对局: ' + games.length + ' 胜率 ' + (games.length ? (tw / games.length * 100).toFixed(1) : 0) + '%');

// 2) 全期胜败（含未配对）
const all = []; let c2 = null;
for (const l of lines) {
  if (!/^2026-09-13 /.test(l) || l.slice(0, 19) < START) continue;
  if (/本局游戏胜者：/.test(l)) c2 = l.includes('团神血洗国服');
  else if (/本局游戏败者：/.test(l) && c2 !== null) { all.push(c2); c2 = null; }
}
const aw = all.filter(Boolean).length;
console.log('全期局数: ' + all.length + ' ' + aw + 'W' + (all.length - aw) + 'L = ' + (all.length ? (aw / all.length * 100).toFixed(1) : 0) + '%');
let st = 0; for (let i = all.length - 1; i >= 0; i--) { if (all[i]) st++; else break; }
console.log('当前连胜: ' + st);

// 3) 回归告警探针
const seg = lines.filter(l => /^2026-09-13 /.test(l) && l.slice(0, 19) >= START);
const cnt = re => seg.filter(l => re.test(l)).length;
const coinFailLast = seg.filter(l=>/逐张点币未落地/.test(l)).pop();
const melt = cnt(/超时熔断/), stale = cnt(/块陈旧.*直接收回合/), fatal = cnt(/FATAL/);
const rotApplied = seg.filter(l => /rotator row=\d+ applied/.test(l));
const lastRot = rotApplied.length ? rotApplied[rotApplied.length - 1].slice(11, 19) : '无';
const lastEnd = seg.filter(l => /已完成第 \d+ 把游戏/.test(l)).pop();
console.log('=== 回归探针 ===');
console.log('  熔断 ' + melt + ' | 陈旧 ' + stale + ' | FATAL ' + fatal + ' (阈值: FATAL>0 或熔断/局>15% 告警)');
console.log('  ④故障锚(逐张点币未落地) 本窗: ' + cnt(/逐张点币未落地/) + (coinFailLast ? ' 末条 ' + coinFailLast.slice(11, 19) : ' | ✅ 零'));
console.log('  ④落地确认 ' + cnt(/逐张点币落地确认/) + ' | 链式跳费达成 ' + cnt(/链式跳费达成/));
console.log('  rotator 最后 row applied: ' + lastRot + ' | 最后局终: ' + (lastEnd ? lastEnd.slice(11, 19) : '无'));

// 3b) m2v198.3 停滞复发探针（19:07 新增，12:17/18:41 旧案同族）：rotator 静默=停滞
// 判据=最后一个 rotator 动作（row applied/armed/重进/顺延/进局确认/拆销）距今 >15min → 🚨 停滞
const rotActs = seg.filter(l => /【GOV5】/.test(l));
const lastRotAct = rotActs.length ? rotActs[rotActs.length - 1].slice(11, 19) : '无';
const lastRotTs = rotActs.length ? new Date(rotActs[rotActs.length - 1].slice(0, 19).replace(' ', 'T')).getTime() : 0;
const now = Date.now();
const rotIdleMin = lastRotTs ? Math.round((now - lastRotTs) / 60000) : -1;
console.log('  🚨停滞探针: 最后 GOV5 动作 ' + lastRotAct + ' 距今 ' + (rotIdleMin >= 0 ? rotIdleMin + 'min' : 'N/A') + (rotIdleMin > 15 ? ' → ⚠️ 停滞（>15min 无 rotator 活动，HS 可能卡非冒险界面）' : ' → 正常'));
// 双活探针（powershell 简查，引号已规避嵌套）
const hsAlive = (() => { try { const c = require('child_process'); return c.execSync("powershell -NoProfile -Command \"Get-Process Hearthstone -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count\"", {encoding:'utf8'}).trim() === '1' ? '活' : '死'; } catch(e) { return '查失败'; } })();
const jaAlive = (() => { try { const c = require('child_process'); return c.execSync("powershell -NoProfile -Command \"@(Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'java|javaw' }).Count\"", {encoding:'utf8'}).trim() === '1' ? '活' : '死'; } catch(e) { return '查失败'; } })();
console.log('  双活: HS=' + hsAlive + ' | java=' + jaAlive + (hsAlive==='死'||jaAlive==='死' ? ' → ⚠️ 缺活' : ' → 正常'));

// 3c) 绿态门探针（m2v198+ 在役）：判定量/绿占比 + 熔断同型率（非绿+穷尽自门→空转）
const gateLines = seg.filter(l => /按钮绿态判定/.test(l));
if (gateLines.length) {
  const gv = gateLines.filter(l => /绿\(穷尽/.test(l)).length;
  const nv = gateLines.filter(l => /非绿/.test(l)).length;
  console.log('  绿态门: 判定 ' + gateLines.length + '（绿=' + gv + ' 非绿=' + nv + ' 绿占比 ' + (gv + nv ? (gv / (gv + nv) * 100).toFixed(1) : 0) + '%）| FrameReader=' + (seg.some(l => /FrameReader initialized/.test(l)) ? '✅在线' : '未见'));
  const melts = seg.filter(l => /超时熔断/.test(l));
  let sameType = 0;
  for (const m of melts) {
    const i = seg.indexOf(m);
    const pre = seg.slice(Math.max(0, i - 8), i).join('\n');
    if (/非绿\(尚有动作\)/.test(pre) && /穷尽自门/.test(pre)) sameType++;
  }
  if (melts.length) console.log('  熔断同型（非绿+穷尽自门→空转）: ' + sameType + '/' + melts.length + (sameType === melts.length && melts.length >= 2 ? ' → ⚠️ 半落地剔除集待裁（已报 god）' : ''));
} else {
  console.log('  绿态门: 本窗无判定行（门未启用或版本 < m2v198）');
}

// 4) t-151 解锁探测（Ryan 会话是否产出非 budget 内容）
try {
  const RS = 'D:/MunderDifflin/hive/agents/ryan-mtvy0jjp/.pi-agent/sessions';
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const js = walk(RS).filter(f => f.endsWith('.jsonl')).map(f => ({ f, st: fs.statSync(f) })).sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
  if (js.length) {
    const newest = js[0];
    const tail = fs.readFileSync(newest.f, 'utf8').split('\n').filter(Boolean).slice(-3);
    const budget = tail.some(l => /reached its budget/.test(l));
    console.log('=== t-151 探测 ===');
    console.log('  Ryan 最新会话 mtime=' + newest.st.mtime.toISOString().slice(11, 19) + 'Z 尾部 budget 报错=' + (budget ? '❌ 仍阻塞' : '✅ 无'));
    const etg = fs.statSync('D:/tdsh/hs_bridge_build/drawfix/src/main/kotlin/lin/drawfix/EndTurnGate.kt');
    console.log('  EndTurnGate.kt mtime=' + etg.mtime.toISOString().slice(0, 19) + (etg.mtimeMs > new Date('2026-09-13T04:00:00Z').getTime() ? ' → 已动笔' : ' → 未动笔'));
  }
} catch (e) { console.log('t-151 探测 err:', e.message); }
