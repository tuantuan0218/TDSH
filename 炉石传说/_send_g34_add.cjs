// ④币跳费精化量化补包（god request 增补 + Ryan inform 直达）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
function send(to, act, subject, body) {
  fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
  fs.writeFileSync(path.join(me, 'outbox', stamp() + '.json'), JSON.stringify({ to, act, subject, body }, null, 2), 'utf8');
  console.log('written ->', to, act);
}
const body = [
  '【④币跳费·量化补包（并入t-146裁定包）】03:07-04:00 窗对账（_drill_coin.cjs 同口径可复跑）：',
  '1. 差1费被拦（=一张币可救）：16 次；差≥2费被拦：20 次；币留手行：23 行。典型实例：03:52:27 CORE_EX1_259(cost=3,余=1)→官方未列exec拦=2张币在手；03:53:00 妖术(cost=3,余=2)→exec实名硬放→半落地烧 88s。',
  '2. 根因链=③④同族：小费垫后策略+预算脱同步+币不敢用 → 高费卡全拖到 exec 实名硬放窗口 → 半落地族占拦截量 32/100。③(大费先打)④(币敢跳费)落地后半落地族自然收缩。',
  '3. 修法精化（链式跳费覆盖差≥2）：高费卡 cost≤预算+币在手数 → 逐张点币（cost=0 先落+waitLanded 销账，turnMana L188 单调自愈+1/张）至 cost≤预算 → 再打；cost>预算+币在手 → 维持现预算门留手（币也不够不白点）。',
  '4. 穷尽门联动：币在手且存在 cost≤预算+币在手 的手牌 → 不算穷尽（跳费路径未穷）；否则刨币判据保留（防 m2v193 R4 空转复发）。',
  '5. 验收锚追加：accept 统计『差1费拦』计数（现基线 16/窗）=0 +『高费卡首点时点前移』+币打出实例≥1；同窗对照 03:52:27/03:53:00 同型卡不再走硬放→半落地。'
].join('\n');
send('god', 'request', '【t-146裁定包增补·④量化】16次差1费被拦=币在手不敢用；链式跳费修法(差≥2也可救)', body);
send('ryan-mtvy0jjp', 'inform', '【m2v194·④量化补包】币在手16次差1费被拦；链式跳费(≤预算+币在手)+穷尽门联动', body);
