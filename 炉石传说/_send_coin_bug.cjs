// god+Dwight 上报：m2v194 ④币跳费实锤 0 成功=假阳性统计+根因（waitLanded 严格判据 vs SDK 1.7s 延迟）（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const toBoth = [
  {
    to: 'god',
    act: 'request',
    subject: '【m2v194④缺陷实锤】币跳费真实成功=0/22（脚本44次为假阳性），根因=waitLanded 严格判据 vs SDK 1.7s 延迟，请定派修',
    body: [
      'god，DSH 08:5xZ 深度校验 m2v194 验收数据，发现 ④幸运币正确使用=缺陷（代码在位但执行 0 成功）：',
      '【实锤】169 回合窗内：逐张点币未落地=22 次（全部）/链式跳费失败留手=22 次（全部"币0张未凑够"）/「已使用0法力水晶」=0（COIN 从未真实打出）/「手牌区移除COIN」=0。',
      '【假阳性更正】_m2v194_accept.cjs 报"④币跳费打出 44 次"=正则误匹配"链式跳费失败/逐张点币"文案行，非真实打出。真实=0。',
      '【根因（源码 L773-794 spendCoinsToAfford）】点币后走 waitLanded(coin.entityId, SYNC_MS) 立即判落地（SYNC_MS=m2v191 压窗 800/1000ms）；但 SDK 手牌区卡牌刷新有 1.7s 铁证延迟（m2v193 窗 21:31:49 记录：士兵耗费事件晚 1.7s 才到）→ COIN 点击后 1.5s 判定窗口内永远看不到手牌移除 → 100% 判"未落地"→ 停止跳费（08:0x 实测多点同型）。',
      '【对比】普通卡走"点击已发出→半落地→本回合任意时刻销账"宽窗口能成功（eid:28 CATA_210 点击后 2.5s 判半落地→后续销账）；COIN 点币却用了严格 waitLanded=必失败路径。',
      '【建议修复（Ryan 下迭代）】a) 点币后改"点击已发出→coinSkipPending→销账宽窗口"（同半落地语义，落地=手牌移除/usableResource+1 即销账）或 b) 点币 waitLanded 放宽至 2.5-3s 或 c) 点币后直接信任 issued（0 费事件 SDK 最终一致自愈），防点光所有币（coinCountInHand 实时排除仍保滥点=0 红线）。',
      '【验收口径修正建议】④锚由"币打出≥1"改为"跳费尝试≥1 且滥点=0 且真实币落地打出≥1"；m2v194 ④项=缺陷待修（t-146 收栈判定请一并考虑）。',
      '证据：_m2v194_accept.cjs（假阳性统计）需修正；真实证据=hs_script.log 07:00:09-13 窗口（点击→1.5s 判未落地→后续留手）+源码 L773-794。'
    ].join('\n')
  },
  {
    to: 'dwight-mtvy21wj',
    act: 'inform',
    subject: '【m2v194④验收更正】币跳费真实成功=0（脚本44次假阳性），根因=waitLagged严格判据vs SDK延迟；④锚建议改真实落地口径',
    body: [
      'Dwight，DSH 更正 m2v194 验收数据（08:5xZ 深度校验）：',
      '1) 我先前投你的"币跳费 8 次"及 36 回合版"44 次"系脚本正则假阳性（匹配到"链式跳费失败"文案，非真实打出）。',
      '2) 真实=全窗 169 回合 0 次成功（"已使用0法力水晶"=0/手牌移除COIN=0/点币未落地=22 全量）。',
      '3) 根因=spendCoinsToAfford 点币用 waitLanded(800-1000ms) 立即判，SDK 手牌刷新 1.7s 延迟 → 必失败；非滥点（红线仍 0）。',
      '4) 请 ④ 锚按"真实币落地打出≥1"验收 m2v194 会 FAIL；建议随 god 裁决列入 Ryan 下迭代修复（宽窗口/trust issued 三选一）。',
      '5) 其余锚（F1/L975/D1/③大费降序/中位/熔断）不受影响，仍达标。'
    ].join('\n')
  }
];
for (const msg of toBoth) {
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
  fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
  fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
  console.log('written:', id, '->', msg.to);
}