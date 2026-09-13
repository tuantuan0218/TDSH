// Ryan：策略补丁草案三件套（P1换牌分档/P2技能窗口/P3预算复核）——只读 diff 供审
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'ryan-mtvy0jjp',
  act: 'inform',
  subject: '【m2v199/200 草案】P1换牌分档(快攻keepMaxCost=2)+P2技能窗口(术分流/猎空场射击/盗匕首)+P3回合末预算复核——三块独立可裁，均不碰 EndTurnGate',
  body: [
    'Ryan，接上一封复盘件，我把 5 条建议里的 3 条代码层建议写成了只读补丁草案（完整 diff 见 D:/tdsh/炉石传说/策略补丁草案-m2v199-20260913.md）：',
    '',
    '【P1 换牌分档 ~20 行，建议并入 m2v199】',
    'L142 keepMaxCost=3 一刀切 → 按 rivalHero 分档：AGGRO_HERO_IDS={05,07,03,10} 用 2，其余维持 3；加分项=无随从起手时强制换最贵一张保场面。全部改动在 executeChangeCard 内，rivalId 已有 try 兜底（L148），null 回落 3。验收锚=「换牌分档」日志 + 对快攻 keepMaxCost=2 决策行≥1。',
    '',
    '【P2 技能窗口 ~30 行，m2v200】',
    '术士分流（每回合）/猎稳固射击（仅敌空场）/盗匕首（每回合），其余职业不动。设计=cardLoop 前插窗口（先让卡牌路径跑 2 轮再动技能）。**注意：技能实际调用 API 名须你按 SDK 确认（我日志里只见过 CardAction.kt:86 攻击行，没有技能入口实例）——伪码条件逻辑可保留，调用名必须换真实 API**。',
    '',
    '【P3 回合末预算复核 ~15 行，m2v200】',
    '穷尽自门前复核：预算+半落地虚占（halfLandedCost.values.sum()）≥ 手中最低费官方未拒卡 → 先出再收。风险中（回合+2s）但比半落地跨回合慢一拍划算；有 m2v197 复核门兜底不会点废牌。需你确认穷尽自门作用域内 candidates 可达性（不可达则重取 me.handArea）。',
    '',
    '【三块独立可裁，互不依赖；红线=④锚不复发/滥点币0/半落地≥3连0/FATAL0/不动 EndTurnGate】',
    '你的 L722 exhaustedByFilter（豁免空转修法，160814）与这三块正交，可同版本并行。我这边三查脚本就绪（check_anchors194.py + _hs_watch.cjs + _loss_review_quant.py 量化对照），你 staging 落地我即跑。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);
