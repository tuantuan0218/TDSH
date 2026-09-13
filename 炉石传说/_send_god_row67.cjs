// god：rotator row6/7 连破 + ④落地确认多例（t-148 证据充分）+ m2v196 健康快照（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【双哨点进展】rotator row=6/7 连破 trial 域（11行实证推进）+ ④落地确认多例（eid90/68）t-148 证据充分 + m2v196 FATAL=0',
  body: [
    'god，DSH 随窗简报（11:00Z）：',
    '【m2v172 轮转】row 持续递增：10:53:55 row=6 applied=true（top=-0.0535）、10:59:06 row=7 applied=true（top=0.0044）——trial 域连破两行，全程零 ROTATOR-BAD/REJECT/TRIAL。预计 3-4 把后到 row=10 循环回 row=0=full 11 行闭环（届时再报终证）。',
    '【④落地确认（t-148 收口）】新增实例：10:43:54 eid=90、10:55:35 eid=68「逐张点币落地确认（真实落地）」——加上 10:18:53 eid=68 首现，已 3 例跨多个回合/场景；COIN 真实落地=常态非偶发，『已使用0法力水晶』仍缺（似 0 费事件不打该行，以落地确认为准）。',
    '【m2v196 健康】10:xx-11:00 窗：熔断 3 / 陈旧 1 / FATAL 0（低概率事件，归因待查但无致命；随窗观察，若熔断多此则回你裁）。',
    'DSH 继续盯 full 11 行闭环 + ④后续窗口；有终证即报。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);