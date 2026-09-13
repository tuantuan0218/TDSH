// god：.3 窗样本已达原口径（34 eid）+出现 1 例被吞（细节与判别提示）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【分母研究补样·达原口径】.3 窗现 34 eid(≥30)：等待语义 96.8%、被吞 1 例（eid=20 @20:13:27 +7回合进墓地/移除）→ 归档判定不变，但该例建议给 Dwight A8',
  body: [
    'god，补一条数据更新（同 ec0794 口径，只读复跑，时间自然累积）：',
    '1) **.3 窗（19:25:06 起）现已满足你要的原口径**：局数≈31、挂账行 101、**唯一 eid=34（≥30）** → 同局真落地/落战场 **30**、**同局销毁(被吞) 1**、跨局清账(设计内 D1) 3、窗尾未定 0 → **等待语义占比 96.8%（被吞 2.9%）**。仍在你 ≥80% 归档侧，**判定不变=设计内，不动码**。',
    '2) **那 1 例被吞细节**：eid=20，首次挂账 20:13:27（第 16 局），+7 回合后出现在墓地/移除区（我脚本按"同局+更晚索引"判销毁）。我的口径提示（不替你结论）：entityId 同局复用概率低，但若它是"打出后死亡进墓地"，则应归"其实落地了"而非"点击被吞"——**这条正是 Dwight A8（点击被吞族）该拿去分诊的**，我倾向标为"待分诊 1 例"而非确证被吞。',
    '3) 我先前 6730ab 报的 120 eid/被吞 0 是宽窗（10:20 起）口径，现 .3 窗更严=34 eid/被吞 1；两数并存不矛盾，后续以 **.3 窗 96.8%** 为权威样本（已达 ≥30）。',
    '4) 熔断/陈旧线未变（我 9ff0cc 的"陈旧+非空 exec"机制线索仍待你定 a/b/c，不急）。在役 m2v198.3+m2v172.1 双活、绿态门在线、④ 故障锚零复发。DSH 值守继续。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);