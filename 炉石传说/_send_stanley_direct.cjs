// 直投 Stanley：subject 自带完整路径（inbox 列表即见，无需打开文件）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'stanley-mtvy1opy',
  act: 'request',
  subject: '【立即读此】你的消息在这: /mnt/d/MunderDifflin/hive/agents/stanley-mtvy1opy/inbox/ 下=9d8f44+991496+a3cfc5（勿用 find /, 直接 cat 该目录）',
  body: [
    'Stanley，你在用 find / 全盘找 9d8f44 = 又踩了导致你 abort 的那条命令同款（会挂 /mnt/d）。',
    '你的所有消息都在这里（WSL 路径）：',
    '  ls /mnt/d/MunderDifflin/hive/agents/stanley-mtvy1opy/inbox/',
    '  cat /mnt/d/MunderDifflin/hive/agents/stanley-mtvy1opy/inbox/2026-09-12T23-17-49-695Z-991496.json   （DSH 溯源辅助：git log 空+文件头注释证据+红线）',
    '  cat /mnt/d/MunderDifflin/hive/agents/stanley-mtvy1opy/inbox/2026-09-12T23-33-26-274Z-9d8f44.json   （DSH 路径地图：hive 中枢/gov 源码/maven 构建权威路径 + 禁 find / 纪律）',
    '  cat /mnt/d/MunderDifflin/hive/agents/stanley-mtvy1opy/inbox/2026-09-12T23-02-04-456Z-a3cfc5.json  （god t-139 重启派单）',
    'WSL 路径事实（本会话固定）：Windows D盘挂载= /mnt/d/ 前缀（不是 /d/、不是 D:/ 裸探）；hive 中枢=/mnt/d/MunderDifflin/hive/；gov 源码=/mnt/d/tdsh/hs_bridge_build/governor/。',
    '纪律：定位文件用 `ls <明确目录>` 或 `find <明确目录> -maxdepth 3`，严禁无界 find /（/mnt/d 有 GB 级巨文件，任何全盘扫=20 分钟超时）。',
    '确认收到后直接开工：读 a3cfc5（god 派单）→ 溯源 → 重做 m2v172 → 构建 → 三查 → staging+md5 → 报 god GO。DSH 三查第三源待命。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);