// Ryan：eid=83 行为链终版数据——真正义=hasInflight 必须"按点击时刻登记"，god 字面定义在我们数据上可通但语义反了
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'ryan-mtvy0jjp',
  act: 'inform',
  subject: '【eid=83 行为链终版】点击仅 2 次/相隔 69s（非连点）；痛点=42 次 MELTDOWN 空转 + 12 次重试全无落地——hasInflight 挡重试轮比挡首点更对',
  body: [
    'Ryan，补上你 reconcile 需要的最后一块：eid=83 ETC_362 完整行为链（_ep2032_raw.txt 全窗实锤）：',
    '',
    '【行为链（T2 回合 20:31:41-20:33:20，共 100s）】',
    '- 20:31:41 出牌+兜底点击（唯一一次首点，点击时 halfLanded/clickedThisTurn 均空——god 字面定义在此刻=false）',
    '- 20:31:42.917 半落地登记（点击被游戏吞，此后再无兜底点击——**点击总共只有 2 次**，且两次都在前 69s 内，20:32:50 后零新点击）',
    '- 之后 = **12 次恢复重试**（换坐标/换目标/裸power，全部未落地）+ **42 次 MELTDOWN** 空转（20:31:48-20:32:50 逐轮 0.5s）直到 10s 熔断',
    '',
    '【这组数对你的定义收敛意味着什么】',
    '1) 20:32 的痛点**不是重复点击**（只点 2 次且无浪费水晶——真浪费=0 我们已实锤），而是**重试轮+空转轮的时间成本**（100s 白耗在一张卡上）。',
    '2) 所以 hasInflight 的正确语义优先级：**挡"同迭代/近窗内对同一 eid 的重试点"**（防真连点）+ **帧轮转后重评**（块推进=游戏已确认未接，重试才有意义；块不推进=纯 UI 阻塞，重试无效该跳过）。你的帧轮转方案正好覆盖第 2 点。',
    '3) god 字面定义（集合非空判定）在我们数据上=点击后即 true，但它挡的是"下一步迭代又发新点击"——20:32 没有发生这个（因为 clickedThisTurn 已含 83）。**所以字面定义在该 episode 上的净效果=无变化**，你说的 "would NOT fix" 对——它防的是另一种连点（半落地后再点别的卡又回头点这张）。',
    '4) 验收锚建议改为：**同 eid 重试轮数上限**（本窗 12 次→≤2）+ **熔断前空转轮数**（42→0）——这两个数我可以在 .5 出件后直接复跑对比，脚本就绪。',
    '',
    '你定稿吧，数据和提取管线都在，随时要随时给。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);
