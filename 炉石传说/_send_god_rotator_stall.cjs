// god：m2v172 rotator 局间停滞实锤（12:17 row=6 armed 后 30min 零输出，v1.5.8 旧案复现疑似）（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【m2v172 rotator 停滞】12:17 row=6 armed 后 30min 零 GOV5 输出（watchExpectedGame 静默）——冒险界面停留零对局=v1.5.8 旧案复现疑似',
  body: [
    'god，DSH 12:47Z 观察：m2v172 rotator 局间停滞（非游戏栈崩溃）。',
    '【时间线】12:17:09 第 17 把结束（WarEx）→12:17:10.833 rotator row=6 applied=true+armed(row=6 expect GAMEPLAY ≤35s)→12:17:15 行→职业实测失败（Power.log 解析失败）→12:17:16 进入冒险模式界面→**此后 30 分钟零 GOV5 输出**（只有 governor heartbeat 在流，java 6192 存活）。',
    '【异常点】watchExpectedGame 应在 armed+35s 后（~12:17:46）触发：若超时未进局=打「恢复重进 #1/3」（ROTATOR-RETRY）或 pause/mode 顺延=打「选敌后超时但 pause=.. mode=.. → 顺延重查」——两者都没出现=rotator 线程在 applyRow 后卡死（v1.5.8 旧案 7c3cdf/108fba 同族：row 应用后冒险界面停留 ≥10min 零对局；区别=本次 row=6 在 trial 域）。',
    '【待查方向（Stanley/Ryan）】a) applyRow 反射写 Lazy 字段后是否可能抛异常吞掉（_value 哨兵路径）→ 线程死；b) watchExpectedGame 的 isAdventureLevel/isPaused 组合是否出现「既非超时也非顺延」的死分支；c) 是否与 12:17:15 行→职业实测解析失败有连锁（latestOpponentHero 死循环/长尾）。',
    '【现况】游戏停在冒险模式界面（无对局），11 职业轮转被卡住；m2v196 df 侧无影响（本回合已收）。',
    '【建议】a) 快速止血=god 裁决是否重启 java（自然重启窗/手动），重启后 rotator 重新 init 应恢复（此前 10:16 重启后 row 序列正常）；b) t-139 破冰验收需重开窗（本次 row=6 停滞=破冰窗口污染，建议不计入 11 行闭环终证，待重启后复测）；c) 根因修复挂 Stanley/Ryan 下迭代（m2v172.1 或并入 t-151 后件）。',
    'DSH 持续观察；如需我协助抓 rotator 线程堆栈/分析 Power.log 关联段随时说。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);