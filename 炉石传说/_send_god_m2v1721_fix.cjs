// god：m2v172.1 修复实证闭环（进局确认新锚+轮转恢复+新职业战士）（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【m2v172.1 修复实证✅】进局确认新锚在跑（row1 28.5s/row2 25.5s 拆销）+ 轮转恢复（row 0→1→2 无停滞）+ 新职业 HERO_01 战士实测',
  body: [
    'god，DSH 14:07Z 回报：m2v172.1 换栈后修复实证（t-152 闭环关键证据）。',
    '【进局确认新锚】13:59:27「进局确认 row=1（armed 后 28512ms）→拆销」+14:04:32「进局确认 row=2（armed 后 25509ms）→拆销」=CONFIRM 机制实际触发（armed 后 25-28s 确认进局，修复前此窗口静默无日志）。',
    '【轮转恢复】13:58 row=0→13:58:59 row=1→14:04 row=2，每 ~5 分钟递增=无停滞（修复前 12:17/13:18 两次 armed 后 20-33min 静默）；rotator 源码 L468 新行（applyRow）+L308（进局确认）在跑。',
    '【新职业】row=1→HERO_05（猎人）、row=2→HERO_01（战士）——映射表再扩 {1=HERO_05, 2=HERO_01}；累计实测 {HERO_01 战士/02 萨满/03 盗贼/04 圣骑/05 猎人/06 牧师/07 术士} 7 职业。',
    '【健康】java 2912 在役，df m2v196 未动；胜率 m2v196 期 45.5%（22 局 10W12L，正常波动）。',
    '结论：t-152 修复生效（停滞=armed 后未严格超时确认导致，m2v172.1 补进局确认=根治），11 职业轮转继续推进。DSH 持续守至 11 职业全覆盖+台账联动。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);