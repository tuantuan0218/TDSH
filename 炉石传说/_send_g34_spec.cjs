// ③④ 人类新直令 spec：god(request 裁定并入 m2v194)+Ryan(inform 情报包)
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
function send(to, act, subject, body) {
  fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
  fs.writeFileSync(path.join(me, 'outbox', stamp() + '.json'), JSON.stringify({ to, act, subject, body }, null, 2), 'utf8');
  console.log('written ->', to, act, subject.slice(0, 40));
}
const body = [
  '【人类 03:57 新直令 ③④·与现有实现冲突声明·请裁定】人类原话：③优先打最高费的牌 ④幸运币要正确使用。',
  '—— 冲突 1（③ vs m2v184 死令 62ddcb）——',
  '1. 现排序（DrawFixStrategy.kt L225-227 + L668-674 playPriority）= ①过牌先 ②buff 先 ③普通小费递增 ④大哥垫后（≥5费兜底）。人类 m2v184 曾死令『绝不大费先花光』（21:33 铁证：奥拉基尔首出→余0→5张全余费不足半落地）。',
  '2. 现人类直令反转=大费优先。冲突裁决请 god 定：③ 生效后排序改为 cost 降序（大费先）。',
  '3. 建议实现（防旧铁证复发）：候选排序 compareByDescending{cost} 但保留 DRAW(0)/BUFF(1) 优先，普通按 cost 降序；预算门 L263 照常拦截付不起的（m2v188② 官方 exec 豁免保留）——8费回合先打8费牌后余0，小牌预算不足留手=正确留手（m2v184 当时半落地是预算脱同步 bug 非排序问题，现预算门已有官方豁免，不会硬点）。',
  '—— 冲突 2（④ vs m2v193 R4 币一律留手）——',
  '4. 现实现（L246-256 + L528-549 + L679-681 isCoinCard）：币一律留手不点+刨出活信号判穷尽（人类 03:40 前令『除幸运币外都该打』）。',
  '5. 现人类直令=币要正确使用=跳费工具。建议实现：候选降序遍历时，若牌 cost == budgetRemaining+1 且手牌含币 → 先点币（clickHandCast/power）→ turnMana 自愈+1（L188 usableResource 只增不减天然支持）→ 再打该牌；穷尽门不再恒刨币：币在手且存在 cost==预算+1 的牌 → 不算穷尽（有跳费路径）。',
  '6. 币自身的落地检测走 waitLanded（0 费打出离手即销账，spentMana+=0）。',
  '—— 请裁定 ——',
  '7. A) ③④ 并入 t-146 同批交付 m2v194（Ryan 正在做 L975/F1/D1，出牌段独立可合流，人类『赶紧优化』倾向此案）；B) 立 t-147/m2v195 下一批。',
  '8. 红线不变：禁拉黑 6dbc38/9b1801；币跳费只读 cost==预算+1 不碰 options 门；改后 m2v194 accept 增验：回合内最高费卡先于低费落地（采样 3 回合）+ 币跳费打出高费卡实例 ≥1（全窗）。',
  '9. 证据/锚：现有币留手日志『幸运币家族→留手不点』『穷尽门刨币』L546-548；源码 L225-227/L246-256/L668-674/L679-681。'
].join('\n');
send('god', 'request', '【裁定】人类新直令③大费优先④币正确使用：并入t-146还是立t-147？(冲突声明+实现建议)', body);
send('ryan-mtvy0jjp', 'inform', '【m2v194 追加③④情报】大费降序+币跳费（含与m2v184/m2v193冲突声明，等god裁定）', body);
