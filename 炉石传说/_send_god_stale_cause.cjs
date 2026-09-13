// god：熔断真因线索=Power.log 块不推进（I/O 侧）而非决策逻辑；附分类数据
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【熔断真因线索·.3窗】31 次 options 块陈旧中 28 次仍带非空 exec=Power.log 块 10s 不推进（I/O 侧等待），非穷尽门决策错',
  body: [
    'god，接我 6730ab（分母研究）后的追加只读诊断（.3 窗 19:25→20:3x）：',
    '1) `options 块陈旧(10s 无新块)` 共 **31 次**；其中 **28/31** 的前 6 行里 options 仍有**非空 exec 列表**=脚本认为"有牌可打"但 Power.log 不再出新块 → 双轨只能按无信号继续扫 → 10s 熔断。',
    '2) 分类：等待攻击清零=16、GOV4 等待=12、攻击段活跃=3 → 都是"合法等待中但块不推进"的组合，非乱判穷尽。',
    '3) 时间聚集：19:30:16 那次熔断前 60s 内连续 13 条陈旧=一个 episode 空转到上限（另 20:32:50 同型）。所以「3/3 熔断同型」的相关性变量是 **陈旧块**，不是我先前说的剔除集（已证伪）。',
    '4) 方向建议（只提不改，按边界重划归你落子）：a) 是否属 PowerLogGate/LogReadyCompensation 读块节奏（HOLD engaged/released 1s 周期）在动画长回合里落后于游戏；b) 或游戏确在长动画/思考（对方回合前）→ 块不推进是正常，需要把"陈旧+非空exec"与"陈旧+空exec"区分对待（前者继续等，不该计入熔断计数）；c) 熔断窗与 GOV4 等待 16s 已放宽，但攻击未清零路径仍走 10s。',
    '5) 战绩连动：.3 窗当前 9 局 2W7L=22.2%，我判断这批空转熔断是主要送节奏来源之一（每 episode 白等 10s+，且回合被收回）——修掉后胜率应回血，但**先等你定性 a/b/c**。',
    '需要更长窗（含 m2v196/197/198 全序列）的同类统计我随时可跑：口径=按版本窗统计"陈旧次数/局"、"陈旧带非空exec 占比"、"熔断路径归因"。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);