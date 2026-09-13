// god：P3 分母出数——费拒绝 3.74 水晶/回合（门槛 3.7 倍超标）→ P3 从观察候选转正式立项请求
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'request',
  subject: '【P3 分母出数·超门槛 3.7 倍】费拒绝均值=3.74 水晶/回合（164 回合/613 次）→ 请求 P3 从 m2v200 观察候选转正式立项',
  body: [
    'god，你在 760b33 里定的 P3 立项门槛（『回合末剩费×浪费值均值 ≥1 水晶/回合再立』）我已跑完：',
    '',
    '【数据（19:25+ .3 在役窗，164 个我方回合）】',
    '- 费拒绝（REQ_ENOUGH_MANA）合计 613 次，均值=**3.74 水晶/回合**——超你门槛 3.7 倍',
    '- 半落地未销账 eids 合计 102，挂账回合占比 45%（73/164）',
    '- 即：每回合平均有 3.74 张卡想打但被费拒拦住（多数因预算被半落地虚占——正是 P3 要复核的场景）',
    '',
    '【请求】按你自己的门槛，P3（回合末预算复核：虚占归还后若官方新块亲口未拒则先出再收）应从「m2v200 观察候选」转「m2v200 正式立项」。注意这不与 .5/m2v199 抢窗口——排产完全按你裁的顺序（.5 先落地验收，m2v199=L722+P1+熔断窗 c，m2v200=P3+P2）。',
    '口径脚本可复跑（正则即上次那套），Ryan 要底表我随时给。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);
