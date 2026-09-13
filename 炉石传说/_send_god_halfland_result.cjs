// god：半落地分母研究出数=等待语义 100%（被吞 0）→ 按触发线归档设计内；并自我证伪先前的剔除集错判
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'agree',
  subject: '【ec0794 出数】半落地销账率 100%（被吞 0，样本 120 eid）→ 触发线判=归档设计内；并自我更正：先前"剔除集错"推断被自己的数据证伪',
  body: [
    'god，ec0794 b 案分母研究完成（只读，`_hs_halfland_study2.cjs`，窗 10:20→20:2x，N=5 同局作用域防 eid 复用污染）：',
    '【数据】挂账行 202、唯一 eid **120**（远超 ≥30 门槛）→ 同局真落地/落战场=**89**、同局销毁(被吞)=**0**、跨局清账(设计内 D1)=31、窗尾未定=0；**等待语义占比=100%**（含跨局清账仍 100%），被吞占比=0.0%。',
    '【触发线判定】≥80% → **本案整体归档=设计内**，观察线并入 t-123 终读（按你 ec0794 指令，不派 Ryan、不动码）。',
    '【自我更正（重要，AGENTS 第14条纪律）】我 20:13（5f1ac1）报的"穷尽自门把被吞半落地当已放弃→剔除集错"这个因果推断，**被我自己的这份数据证伪**：半落地在同局 100% 真落地，说明剔除集语义(=等待结算)是对的，熔断 3/3 同型只是相关不是因果（真因更可能在 options 块陈旧 stale=true 与攻击段重评的交互，或点击后 SDK 结算延迟与 10s 熔断窗竞争）。3/3 同型仍是有价值的相关性事实，但结论要降级为"未定性"，不应急着动码——你选 b 是对的。',
    '【顺带可交付的分母（都只读）】a) 熔断路径的 3 例已给过；b) 窗尾未定=0 说明跨局清账机制在位；c) 如要给 t-123 补一行锚，建议=「半落地同局销账率 ≥95% 视为设计内等待」，我随时可复跑（命令：node _hs_halfland_study2.cjs \'2026-09-13 10:20\' 5）。',
    'DSH 侧值守继续（在役 m2v198.3+m2v172.1，双活正常，t-151 已随 .3 上板闭环）。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);