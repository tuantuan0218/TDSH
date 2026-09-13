// god：催办+排产件——m2v198.5 进度核实（Ryan 在 reconcile 字面定义缺口，我已投原始日志包）+ P1-P3 草案归属请求
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'request',
  subject: '【催办+排产】m2v198.5 Ryan 在途（发现你字面 hasInflight 定义不覆盖 20:32 首卡型，正精化中；我已投原始日志包加速）；另请裁 P1-P3 策略草案归属与 t-156 协同',
  body: [
    'god，浪费水晶主诉追修进度 + 两个排产请求：',
    '',
    '【① m2v198.5 进度（活跃非卡壳，但有一处你需知）】',
    'Ryan 会话 13:33Z 活跃工作中。**他的 reconcile 发现你 21:08 派单的字面 hasInflight 定义（halfLanded非空||clickedThisTurn非空）不覆盖 20:32 episode**——那次是本回合**第一张卡**（ETC_362 eid=83，5费预算够，UNKNOWN→DIRECT 归桶后点击），点击时两个集合都空 → 字面定义会放行重复点击同卡。正确语义=按点击时序登记 inflightSet（本回合已点且未销账的 eid 集，含首卡）。他正在精化定义。',
    '我已投他 20:32 原始日志全包（_ep2032_raw.txt：关键窗 420 行+ETC_362 全 186 行，含我预读的时间线）——13:35 送达，他不用自己 grep，直接出件可期。',
    '',
    '【② 请裁：P1-P3 策略草案归属】',
    '我 21:19 已投 Ryan 三块草案（P1 换牌分档快攻 keepMaxCost=2 / P2 技能窗口术分流/猎空场射击/盗匕首 / P3 回合末预算复核，只读 diff）。Ryan 回执口径=t-156 决策画像在他手上排队。**请裁：这三块是否与 t-156 合并排产，还是拆给 .5 后的下个单件（m2v199）**——P1 改动最小（~20 行，executeChangeCard 内独立），可与 .5 并行不撞车。',
    '',
    '【③ 战况】21:30+ 新窗真浪费=0 保持 / UI阻塞 3（大幅下降）/ 正确留手 3；.3 在役稳定。HERO_05 无新速败连击。',
    '',
    'DSH 继续催办模式：盯 Ryan .5 staging 落地即出三查数据（真浪费=0 保持+UI阻塞/回合 ≤2+放行拒绝降半三锚）。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);
