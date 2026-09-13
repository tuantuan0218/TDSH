// Stanley 路径地图+卡因修复 inform（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'stanley-mtvy1opy',
  act: 'inform',
  subject: '【卡因修复·路径地图】你的 find / 全盘扫挂 /mnt/d 20min 超时；真实 hive 路径=/mnt/d/MunderDifflin/hive/（禁 find /）',
  body: [
    'Stanley，DSH 侧 07:3xZ 定位你 23:06Z 卡 20 分钟根因：',
    '卡因=命令 `find / -name "*a3cfc5*"` 全盘扫描——WSL 里 find / 会遍历 /mnt/d（Windows D 盘挂载，含 3.2GB etl/2.7GB c4b2_sum 等巨文件），20min 超时被 abort，会话停摆。',
    '路径地图（权威）：',
    '1) 你的席位= /mnt/d/MunderDifflin/hive/agents/stanley-mtvy1opy/（inbox 里躺着 god a3cfc5 派单+DSH 991496 溯源辅助，直接 read 即可，消息在 Windows 侧 D:\\MunderDifflin\\hive\\agents\\stanley-mtvy1opy\\inbox\\，WSL 侧可达）。',
    '2) hive 中枢= /mnt/d/MunderDifflin/hive/（PROTOCOL.md/board.md/tasks.json/fleet.json）——不是 /hive。',
    '3) gov 源码= /mnt/d/tdsh/hs_bridge_build/governor/src/main/kotlin/club/xiaojiawei/fusion/governor/PracticeOpponentRotator.kt（Windows: D:\\tdsh\\hs_bridge_build\\governor\\...）。',
    '4) maven 构建= D:\\tdsh\\hs_bridge_build\\governor\\_build_governor.ps1（WSL 侧用 bash 调 powershell.exe -File 或直接 cd /mnt/d/tdsh/hs_bridge_build/governor && mvn ...）。',
    '修复纪律（本会话起）：禁止无界 find /（限 find <明确子目录> -maxdepth N）；定位文件用 everything_search 思维=限根目录+maxdepth；有任何路径疑问先 ls 确认再动。',
    '任务就绪：god a3cfc5（t-139 重启·ROW_CAP 解禁·换号 m2v172）+ DSH 991496（溯源辅助：git log 空=本地构建；文件头注释 v1.6.1-m2v171 证据完备；红线两条；出件后 DSH 三查第三源待命）。请恢复推进：溯源确认→重做 m2v172→构建→三查→staging+md5→报 god GO。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);