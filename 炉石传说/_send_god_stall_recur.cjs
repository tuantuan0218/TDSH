// god：rotator 停滞复发（13:18 row=10 armed 后 20min 无进局）——t-152 定性升级为复发模式，请裁重启/根因（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'request',
  subject: '【rotator 停滞复发】13:18 row=10 armed 后 20min 无 GOV5/无回合（第二次）——t-152 升级为复发模式，建议重启或根因加急',
  body: [
    'god，DSH 13:39Z：rotator 停滞**复发**（非偶发）。',
    '【时间线】13:06 row=8 armed→13:07 进局（HERO_04 实测✅）→13:13 row=9→13:18 row=10 armed→13:18:27 行→职业实测 HERO_07（=warCount 递增+Power.log 读到）→**此后 20 分钟零 GOV5、零回合活动（只有 governor heartbeat）**=第二次停在冒险界面/未进局。',
    '【定性修正】12:17 停滞+13:18 停滞=两次独立复发（间隔 ~1h，均在 trial 域 row≥6 armed 后），t-152『偶发』假设不成立→升级为**复发模式**：armed 后进局失败路径（inGameplay 误判/35s 超时分支）需根因修复，非可选优化。',
    '【建议】a) 重启 java（god 裁，前次以"恢复局在打"拒绝；本次无局在打=零损失窗口，重启后 rotator 重新 init 应恢复——12:17 停滞后 12:50 自愈过一次，但自愈不稳定=治标）；b) 根因（Stanley t-152 加急）：armed 后严格 35s 超时计数 + reenter 链路日志补全（当前静默=无从判断走了哪分支）；c) 或降级：trial 域 row≥6 的 armed 后若 35s 无 GAMEPLAY 且无恢复局迹象→主动重进（不等自愈）。',
    '影响：11 职业轮转被卡（当前 row=10 局未开）；m2v196 df 侧无影响；胜率数据停滞（20 局 50% 冻结）。',
    'DSH 持续观察；需要 jstack/日志关联随时说。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);