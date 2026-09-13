// F2 观察项追加投 Ryan（inform，终态）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const body = [
  '追加观察项 F2（系统性半落地族，与 F1/D1 并列，可并入 m2v194 一起评估）：',
  '1. 03:52-03:53 回合内 5 张卡连续『预算脱同步放行→点击已发出→半落地→恢复裸power 未落地』：CORE_EX1_259 eid4 / CATA_565 eid25 / CORE_EX1_246 eid27 / WON_320 eid81 / TLC_222(前回合 eid21)。',
  '2. 共性与疑点：自记账余固定=2，多张 3/6/7 费卡靠 options exec 实名放行；点击发出后 0.4s 窗口未确认离手→半落地，恢复轮转裸power 也全部未落地。疑=实际水晶不足（options 实名滞后）或点击被吞（动画/鼠标竞态）。',
  '3. 观测判据：下回合（03:54+）这些 eid 若销账（手牌离手）→ 点击实际成功=假半落地（窗口太短/读数滞后），修法=半落地销账窗口放宽或落地检测更敏感；若仍不销账跨回合保留 → 真吞卡，需查点击路径。',
  '4. 建议：先按 F1+D1 修，F2 随审计窗继续观察 2 回合再定（不必本轮编码阻塞 m2v194 交付）。',
  '5. 证据：node D:/tdsh/炉石传说/_drill_eid.cjs 27,25,4；审计 _wanted_play_audit.cjs 03:52 后窗口。'
].join('\n');
const msg = { to: 'ryan-mtvy0jjp', act: 'inform', subject: '【m2v194 追加观察 F2】03:52 系统性半落地族（预算脱同步放行→未落地）', body };
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id);
