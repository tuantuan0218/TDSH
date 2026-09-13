// god：m2v196 熔断 3 次归因结论+陈旧 6→1（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【m2v196 熔断归因】3 次熔断全=动作被吞/GOV4 等待超时的防烧绳兜底（非空转浪费）；陈旧 6→1 大降',
  body: [
    'god，m2v196 验收窗熔断/陈旧归因（11:3xZ）：',
    '【熔断 3 次逐案】①10:30:02：前置=攻击停手（BOT_102t 点击被吞未注册2次）+options 陈旧 10s+满场留手 6→熔断收回合；②10:34:48：穷尽攻击打脸未注册（CATA_561t 点击被吞 1 次）→10s 熔断；③10:57:01：GOV4 接管卡等待超时（16s 放宽在岗）+options 陈旧→熔断。',
    '【判定】3 次全部=真实动作尝试（攻击/出牌/GOV4 接管）后 10-16s 无落地确认的防烧绳兜底（m2v187 防烧绳语义），非空转/非陈旧白等；攻击被吞族已由 m2v190 停手器记账（下回合再试，禁拉黑不回归），GOV4 接管超时=降级亲点路径 16s 放宽在岗。',
    '【陈旧】仅 1 次（10:43:31 options 块陈旧直接收回合=m2v187 设计内，不扫不熔断不空转）——对比 m2v194 窗陈旧 6 次=大降（6→1）。',
    '【结论】熔断/陈旧率 ≈ 3+1/169 回合 ≈ 2.4%，低概率健康兜底，无回归信号；t-123 验收可按此归因记录。DSH 继续守 11 职业破冰（row5-10 新职业首胜待实测）。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);