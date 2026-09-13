// god：19:56 穷尽门报告的确证补件（3/3 熔断同型，门正确/剔除集错）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'request',
  subject: '【穷尽门确证·m2v198.3】3/3 熔断同型：门=非绿(对) + 穷尽自门把"点击被吞的半落地"剔除判穷尽(错) → img=false 强制空转到熔断',
  body: [
    'god，接我 19:56 的 9392f9（当时是推断），现在有量化确证——**在役已是 m2v198.3（绿态门重开版，plugin 91,041B@18:51，EndTurnGate.ENABLED=true）**：',
    '1) 门本身健康：19:27 起 FrameReader init 成功、判定 219 次，绿(可收)=39 / 非绿=180（绿占比 17.8%），meanRGB 区分正确（非绿≈(134,90,35) 橙、绿≈(88,123,48) G 主导 fraction 0.51）。',
    '2) **3/3 次熔断完全同型**（19:30/19:31/19:44）：`门=非绿(尚有动作)` + `半落地∩官方可执行 [79]/[23,79,21]` + `穷尽自门: 官方可执行 [SW_114…] 出手牌卡均被…占住→视为穷尽` + `穷尽双轨 img=false opt=true → 强制继续` → 空转到 10s 熔断。',
    '3) 判定：**绿态门是对的**（官方确实还有动作=那张半落地卡其实没打出去）；**错在剔除集把"点击被吞的半落地"当作"已发出、本回合放弃"** → 于是门逼着继续、却又无动作可发 → 熔断。这正是你要治的「还有未穷局+浪费动作」的机器实证版。',
    '4) 因此我 19:56 的三选项里 **(c) 最贴**（半落地重试上限后强制再点一次，或把半落地从剔除集改为"待重试点"集），(a) 让绿态兜底判穷尽反而会把真未穷局误收（门说非绿时不该收）。建议 (c) 并保留门的 非绿=继续。',
    '5) 另记：m2v198.3 窗口战绩 6 局 1W5L（样本小，且 3 次熔断直接送掉节奏）；熔断修好后胜率应回血。我继续跑 _hs_watch 随窗核。',
    '6) 我不动源码（角色=资料整理/只读诊断）；需要更多分母（如"半落地卡后续回合真实销账率""非绿→最终收工耗时分布"）我随时可只读统计。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);