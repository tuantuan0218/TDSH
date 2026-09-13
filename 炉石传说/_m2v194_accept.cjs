// m2v194 验收窗数据采集（t-146 五修锚：③大费降序/④链式跳费/F1 无目标例外/D1 局终门/L975 免试 + 四指标基线不回归）
// 用法: node _m2v194_accept.cjs [起始时间]  — 默认从 m2v194 换栈时刻后开始（自动找日志里第一个非 m2v193 时段）
const fs = require('fs');
const log = fs.readFileSync('D:/tdsh/炉石传说/hs-script/log/hs_script.log', 'utf8').split('\n');
const SEG_START = process.argv[2] || '2026-09-13 06:48:00'; // 换栈后起点（部署时刻由值守记录，可传参覆盖）
// 起点判定必须同时满足：时间戳格式（^2026-09-13 hh:mm:ss）+ >= SEG_START（防卡牌描述等非日志行误匹配）
const start = log.findIndex(l => /^2026-09-13 \d\d:\d\d:\d\d/.test(l) && l.slice(0, 19) >= SEG_START);
const seg = start >= 0 ? log.slice(start) : log;
const ACTION_RE = /出牌 eid:|攻击【|英雄技能|点选战场槽位|点选目标/;
const done = [];
let tmp = null;
for (const l of seg) {
  const m = /^2026-09-13 (\d\d:\d\d:\d\d)\.(\d+)/.exec(l);
  if (!m) continue;
  const ts = new Date('2026-09-13T' + m[1] + '.' + (m[2] || '0'));
  if (/我方回合/.test(l)) tmp = { s: ts, reason: null, acts: 0 };
  else if (/对方回合/.test(l) && tmp) { tmp.e = ts; done.push(tmp); tmp = null; }
  else if (tmp && !tmp.e) {
    if (ACTION_RE.test(l)) tmp.acts++;
    if (/穷局门线\(剔集\)/.test(l)) tmp.reason = '门线(剔集)';
    else if (/穷尽自门/.test(l)) tmp.reason = tmp.reason ? tmp.reason : '穷尽自门';
    else if (/超时熔断/.test(l)) tmp.reason = (tmp.reason || '') + '+熔断';
    else if (/块陈旧.*直接收回合/.test(l)) tmp.reason = (tmp.reason || '') + '+陈旧';
  }
}
const durs = done.filter(t => t.e).map(t => (t.e - t.s) / 1000);
console.log('我方回合数:', done.length);
if (durs.length) {
  const sorted = [...durs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log('回合耗时(秒):', durs.map(d => d.toFixed(1)).join(', '));
  console.log('中位:', median.toFixed(1), 's / max:', sorted[sorted.length - 1].toFixed(1), 's（m2v194 受理锚: 中位≤25 / max<59.5）');
}
const byReason = {};
for (const t of done) {
  const r = t.reason || (t.acts > 0 ? '动作打满自然收(' + t.acts + '动作)' : '(真三空)');
  byReason[r] = (byReason[r] || 0) + 1;
}
console.log('收工原因分布:');
for (const [r, c] of Object.entries(byReason)) console.log(' ', r, '×', c);

// ===== m2v194 五修锚 =====
const count = re => seg.filter(l => re.test(l)).length;
console.log('--- m2v194 五修锚 ---');
console.log('F1 无目标空试裸power:', count(/无目标例外.*跳过|空场.*即时跳过/), '次（锚=0）');
console.log('L975 免试命中:', count(/半落地恢复免试/), '次（锚=0 空转）');
console.log('D1 局终门 break:', count(/局终门条件满足/), '次（锚=每局终≤1；旧正则『→ 中止收尾』与实际日志『→ 停止出牌交 governor』不符=恒 0 假阴性已修）');
console.log('D1 双凭据不足只扫一轮:', count(/双凭据不足.*仅扫一轮/), '次');
console.log('④跳费尝试(点币已发):', count(/逐张点币:.*已发/), '次（锚≥1；仅计数已发线，不含落地确认/失败文案）');
console.log('④真实币落地打出(权威双证 v2=本回合 L247 落地确认):', count(/逐张点币落地确认/), '次（锚≥1；须+同回合 Area 墓地 COIN 邻接线共同成立，见下行）');
console.log('④币回合末未落地(未打出/销毁判据):', count(/币回合末未落地|逐张点币回合末未销账/), '次；【口径v2】同回合 Area 墓地 COIN(与点币相邻,销毁仅在回合末)=', count(/向玩家1.*【墓地】添加卡牌.*cardId:COIN/), '次（共同权威，须配对 L247/邻接判）');
console.log('④点币未发出/链式跳费失败留手:', count(/链式跳费失败/), '次 | 币待销账免轮转:', count(/币待销账免轮转/), '次');
console.log('④[已退役]Player.kt:85 已使用0法力水晶:', count(/玩家1.*已使用0法力水晶/), '次（god 裁定=结构不可观：该行语义为本回合累计已用，0 费不改累计→永不落行；既不作正证亦不作反证）');
console.log('④无跳费目标仍点币(滥点,真实非零):', count(/滥点=[1-9]/), '次（锚=0；m2v195 日志含『滥点=0』断言文案，旧裸 /滥点/ 匹配误计=假阳性已修正）');
console.log('③大费降序(最高费先):', count(/大费优先|降序/), '次（锚=排序生效标记）');
console.log('半落地恢复免试撤销:', count(/无目标免试撤销/), '次');
console.log('--- m2v194 基线四指标 ---');
console.log('门线触发(剔集):', count(/穷局门线\(剔集\)/), '次 | 陈旧10s收:', count(/块陈旧.*直接收回合/), '次 | 熔断:', count(/超时熔断/), '次');
console.log('币族留手:', count(/幸运币家族.*留手不点/), '次 | 穷尽门刨币:', count(/穷尽门刨币/), '次 | 攻击停手清单:', count(/攻击停手清单/), '次');
// ③大费降序实证采样：找『出牌 eid』行 cost 大者先于小者的窗口
const playLines = seg.filter(l => /出牌 eid:|cost=/.test(l));
if (playLines.length) {
  console.log('--- ③采样（最近20行含cost/出牌） ---');
  playLines.slice(-20).forEach(l => console.log(' ', l.slice(0, 120)));
}
