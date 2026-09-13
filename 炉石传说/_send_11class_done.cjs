// god+Kevin：11/11 职业全破冰+战绩配对完成（m2v172.1 轮转全效实证）（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const body = [
  '全部 11 职业已破冰并配对到胜者（m2v172.1 换栈后轮转全效，15:51Z 统计）：',
  'HERO_01 战士 2局 1W1L 50% / HERO_02 萨满 1局 1W / HERO_03 盗贼 1局 1L / HERO_04 圣骑士 1局 1W / HERO_05 猎人 3局 0W3L / HERO_06 牧师 2局 1W1L / HERO_07 术士 2局 0W2L / HERO_08 法师 1局 1W（15:23 破）/ HERO_09 德鲁伊 1局 1L / HERO_10 恶魔猎手 1局 1W / HERO_11 死亡骑士 1局 1L（15:15 破）',
  '配对局 16 局 6W10L=37.5%；另含未配对的 18 局计入全期 47.1%。',
  '【关键情报】1) 猎人 HERO_05 0W3L=当前最大克星（旧版只打 5 英雄时 HERO_05 曾胜率正常→11 职业轮转后暴露新难敌）；2) 法师/圣骑/萨满/DH 首战即胜=新破冰职业胜率高；3) 术士 0W2L 亦待攻。',
  '【映射表稳定确认】15:23 后 row→职业映射表已稳（0=HERO_08,1=05,2=01,3=02,4=06,5=09,8=07,9=10,10=11），row 6/7 本会话未测到（映射表缺 6/7 键，非停滞=warCount 未到该位时读取失败）。'
].join('\n');
const msgs = [
  { to: 'god', act: 'inform', subject: '【11/11 职业全破冰✅】m2v172.1 轮转全效：11 职业均配对战绩，法师 15:23 破；克星=猎人0W3L', body },
  { to: 'kevin-mtvy14qr', act: 'inform', subject: '【台账联动】11 职业破冰战绩明细（DSH 侧 15:51 统计）供你三源核证/段计数', body: body + '\n\nKevin：此为我侧 armed→胜者时间窗配对的原始明细，供你与 statistics.db/Power.log/WarEx 三源交叉核对（尤其 HERO_05 猎人 0W3L 与 HERO_04 圣骑 1W 是否与你台账一致）；若配对窗口口径不同请指认。' }
];
for (const msg of msgs) {
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
  fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
  fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
  console.log('written:', id, '->', msg.to);
}