// m2v198.5 三查验收脚本（DSH 第三源）——staging 落地/换栈后即跑
// 六锚口径（god 760b33 + Ryan reconcile + DSH eid83 行为链 合议版）：
//   ①误拦=0 且 重点击=0（hasInflight 语义升级版）
//   ②真浪费（点击已发出→半落地 且 诊断=余费不足）=0 保持
//   ③同 eid 恢复重试 ≤2/回合（基线 12）
//   ④熔断前空转轮（非绿+穷尽自门连续轮）从 42 降 → 目标 ≤5
//   ⑤UI 阻塞型半落地/回合 ≤2（20:30+ 基线 ~6）
//   ⑥FATAL=0 / 滥点=0 / ④币锚不复发（回归红线）
// 用法: node _m2v198_5_accept.cjs [起算时间 默认 '2026-09-13 21:45']
const fs = require('fs');
const LOGDIR = 'D:/tdsh/炉石传说/hs-script/log';
const START = process.argv[2] || '2026-09-13 21:45';
const files = fs.readdirSync(LOGDIR).filter(f => f.endsWith('.log')).sort();
const lines = [];
for (const f of files.slice(-3)) {
  for (const l of fs.readFileSync(LOGDIR + '/' + f, 'utf8').split('\n')) {
    if (/^2026-09-13/.test(l) && l.slice(0, 19) >= START) lines.push(l);
  }
}
console.log('=== m2v198.5 三查验收（窗 ' + START + '+，' + lines.length + ' 行）===');
const cnt = re => lines.filter(l => re.test(l)).length;

// ① hasInflight 新锚：误拦=0 且 重点击=0
const inflightLines = lines.filter(l => /hasInflight|inflight/i.test(l));
const falseBlocks = cnt(/hasInflight=false.*拦|本应放行.*拦/);
const dupClicks = cnt(/重复点击|重点击/);
console.log('① hasInflight: 相关行 ' + inflightLines.length + ' | 误拦(false 却拦)=' + falseBlocks + ' | 重复点击=' + dupClicks + (falseBlocks === 0 && dupClicks === 0 ? ' ✅' : ' ❌'));

// ② 真浪费
const waste = cnt(/点击已发出→半落地.*诊断=余费不足/);
console.log('② 真浪费(点后被费拒)=' + waste + (waste === 0 ? ' ✅ 保持' : ' ❌ 回归'));

// ③ 同 eid 重试（每回合）
const retries = lines.filter(l => /半落地恢复.*重试|半落地恢复跳过/.test(l));
const byTurn = {}; let curTurn = 0;
for (const l of lines) {
  if (/因分类账:/.test(l)) curTurn++;
  if (/半落地恢复 裸power/.test(l) && curTurn > 0) {
    const m = l.match(/eid=(\d+)/); if (m) byTurn[curTurn] = (byTurn[curTurn] || 0) + 1;
  }
}
const maxRetry = Math.max(0, ...Object.values(byTurn));
console.log('③ 同回合恢复重试 max=' + maxRetry + '（基线 12）' + (maxRetry <= 2 ? ' ✅' : ' ⚠️ 未达（阈值≤2）'));

// ④ 熔断前空转轮（非绿+穷尽自门连续）
const meltDowns = lines.filter(l => /超时熔断/.test(l));
let worst = 0, run = 0;
for (const l of lines) {
  if (/穷尽自门/.test(l)) run++;
  if (/超时熔断/.test(l)) { worst = Math.max(worst, run); run = 0; }
  if (/因分类账:/.test(l)) run = 0;
}
console.log('④ 熔断前连续穷尽自门轮 max=' + worst + '（基线≈11-42 视口径）' + (worst <= 5 ? ' ✅' : ' ⚠️ 未达（阈值≤5）'));
console.log('   熔断总数=' + meltDowns.length);

// ⑤ UI 阻塞型半落地/回合
const uiBlock = cnt(/点击已发出→半落地.*诊断=无费\/满场判据/);
const turns = cnt(/因分类账:/);
console.log('⑤ UI阻塞半落地/回合=' + (turns ? (uiBlock / turns).toFixed(1) : 'N/A') + '（基线 ~6，阈值≤2）' + (turns && uiBlock / turns <= 2 ? ' ✅' : ' ⚠️'));

// ⑥ 回归红线
const fatal = cnt(/FATAL/);
const coinFail = cnt(/逐张点币未落地/);
const coinAbuse = cnt(/滥点=[1-9]/);
const half3 = cnt(/同迭代.*3连半落地|半落地 3 连/);
console.log('⑥ FATAL=' + fatal + ' | ④币故障锚=' + coinFail + ' | 滥点=' + coinAbuse + (fatal === 0 && coinFail === 0 && coinAbuse === 0 ? ' ✅' : ' ❌ 回归'));

// 战况
const w = lines.filter(l => /本局游戏胜者：团神血洗国服/.test(l)).length;
const ls = lines.filter(l => /本局游戏败者：团神血洗国服/.test(l)).length;
console.log('战况: ' + w + 'W' + ls + 'L');
console.log('双活: HS=' + (require('child_process').execSync('powershell -NoProfile -Command "Get-Process Hearthstone -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"').toString().trim() === '1' ? '活' : '死') + ' java=' + (require('child_process').execSync('powershell -NoProfile -Command "@(Get-CimInstance Win32_Process | Where-Object { $_.Name -match \'java\' }).Count"').toString().trim() !== '0' ? '活' : '死'));
