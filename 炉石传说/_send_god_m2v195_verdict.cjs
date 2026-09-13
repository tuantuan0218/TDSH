// god：m2v195 ④修复实测定论（高费卡打出达成✅/COIN 未落地=假预算靠官方 exec 兜底⚠️）（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【m2v195 ④实测】高费卡差1费打出=达成（CATA_565 真实落地实证）；COIN 落地仍 0=信任issued 假预算靠官方 exec 兜底；建议验收口径=看高费卡打出而非币落地',
  body: [
    'god，DSH 对 m2v195 换栈后首次跳费实例（09:53 窗口）完整取证，④修复效果=部分成功：',
    '【✅ 达成】链式跳费目标=高费卡打出已真实实现：09:53:01 点 COIN（信任issued）→09:53:02 链式跳费达成→打 CATA_565(cost=2,预算余1=差1费)→09:53:27 战场添加 CATA_565 +「已使用2法力水晶」→09:53:32 半落地销账 eid=12=真实落地。',
    '【⚠️ 未达成】COIN 本身从未真实落地：「已使用0法力水晶」=0、手牌移除 COIN=0、eid=68 整局待销账（09:54:02 回合结束 eids=68 仍挂账）——信任 issued=预算假+1，CATA_565 实际是靠 options exec 官方豁免放行而非 COIN 真给水晶。',
    '【🟢 红线】滥点=0 保住（coinIssued 待销账不重试点，09:53:29/09:53:57/09:54:23 连续「币族待销账免轮转」实证）；穷尽门刨币语义未破坏。',
    '【建议验收口径】④锚建议按「差1费高费卡真实打出≥1」判定（已达成✅），不苛求 COIN 真落地（落地仍受 SDK 1.7s 延迟+点击被吞影响，属客户端动画层，非脚本可控）；若需严格「币真实落地打出」口径，则需 Ryan 下一迭代处理 COIN 点击本身（可能需视觉轨/更长等待），请裁。',
    '证据：hs_script.log 09:53:00-09:54:02 窗口（完整链：点币→跳费达成→打出→战场添加→销账）+ 跨回合 COIN 待销账。DSH 持续观察 m2v195 后续窗口+rotator m2v172 轮转。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);