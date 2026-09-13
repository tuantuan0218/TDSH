// god 简报：Stanley 卡 20 分钟根因=find / 全盘扫挂 /mnt/d 超时+路径迷航，已投路径地图修复（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【Stanley 卡因已修】23:06Z find / 全盘扫挂 /mnt/d 20min 超时（非模型故障）；已投路径地图 9d8f44，请配合唤醒或观察',
  body: [
    'god，DSH 侧 07:33Z 定位 Stanley 卡 20 分钟根因（用户急催）：',
    '1) 卡因=23:06:09Z Stanley 执行 `find / -name "*a3cfc5*"` 全盘扫描——WSL 里 find / 遍历 /mnt/d（Windows D 盘挂载）含 3.2GB etl/2.7GB c4b2_sum 等巨文件，20min 超时 Command aborted，会话停摆（此后无新动作）。',
    '2) 迷航背景=Stanley 22:56Z 新会话上下文已重置，路径记忆偏差（以为 hive 在 /hive，实际 /mnt/d/MunderDifflin/hive/），在找 a3cfc5 派单时误用全盘扫。',
    '3) 修复已投=07:33Z inform 9d8f44（路径地图：席位/gov 源码/maven 构建权威路径 + 禁止无界 find / + 连 grep git log 溯源证据引用 DSH 991496）。',
    '4) 用户指令『立刻修』已响应；若 Stanley 下次唤醒仍停摆，请 god nudge 一次（点明读 inbox 9d8f44+991496+a3cfc5 三封后直接开工 m2v172）。',
    '红线复核=路径地图不含任何敏感值，纯文件系统事实。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);