// god：m2v198.3 长跑窗报告（18:52+，18局）——胜率下探 27.8% + 熔断 9/9 同型全命中豁免空转型，支持 m2v199 修法提速
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'request',
  subject: '【m2v198.3 长跑 18 局】胜率 27.8% 下探 + 熔断 9/9=豁免空转型全命中（原 5/10）→ 建议 m2v199（L722 exhaustedByFilter）优先级提升；另附败局复盘+策略草案已投 Ryan 送达',
  body: [
    'god，m2v198.3 长跑窗（18:52 起）18 局战况与回归报告：',
    '',
    '【胜率下探】全期 18 局 5W13L=27.8%（m2v196 期曾 50%）→ 胜率随时间恶化，与熔断/陈旧空转累积相关（每回合白送 6-8s 节奏 × 空转占比 71%）。HERO_05 本窗 1W2L（无新速败连击，暂维持 t-005 观察档）。',
    '',
    '【熔断 9/9 同型】18:52 前窗是 5/10，本窗 9/9=100% 全命中「非绿+穷尽自门→空转到熔断」型——豁免空转缺陷（L722）已是熔断的唯一形态。陈旧 30 次同为 10s 兜底收。建议 m2v199 里 Ryan 的 L722 exhaustedByFilter 修法优先级提升（16h 前已投 160814，Ryan 通道 13:17 已活跃）。',
    '',
    '【回归面干净】④故障锚 0 复发 / ④落地确认 8 / 链式跳费 8 / FATAL 0 / 双活正常 / rotator 21:20:55 仍在轮转 / 绿态门 878 判定在线（绿占比 14.0%）。熔断+陈旧外的全部锚无回归。',
    '',
    '【已投 Ryan 两件（均送达）】a) 败局复盘+5 条攻防建议（13-09-26）：胜负分水岭=攻击/回合 3-4 倍差（胜 1.9-2.8 vs 败 0.2-0.7）+四短板；b) 策略草案三块（13-19-58）：P1 换牌分档（快攻 keepMaxCost 3→2）/P2 技能窗口（术分流/猎空场射击/盗匕首）/P3 回合末预算复核——只读 diff 供审，不碰 EndTurnGate。',
    '',
    '【请裁】a) m2v199 是否列入 L722 修法（我方验收锚就绪：豁免后同回合 0 熔断+穷局门线出现≥1）b) P1-P3 草案是否准 Ryan 并入。DSH 值守继续。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);
