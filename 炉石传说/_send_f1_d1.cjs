// F1+D1 一键双投：god=request(派单t-146)+Ryan=inform(情报包直达)。Node 写无 BOM。
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
function send(to, act, subject, body) {
  fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
  const msg = { to, act, subject, body };
  const p = path.join(me, 'outbox', stamp() + '.json');
  fs.writeFileSync(p, JSON.stringify(msg, null, 2), 'utf8');
  console.log('written ->', to, act, subject.slice(0, 40));
}
const f1body = [
  '一句话：m2v193 恢复路径对 ENEMY 无目标指向法术每 40s 空试一次裸power，修法=恢复轮转复用 L964 无目标判定，免试省每次 2.4s。',
  '1. 铁证：CORE_EX1_246 eid=20（03:41-03:43 三次无敌方目标skip 之间 03:42:06/03:42:57 两次裸power 未落地，各烧 2.4s）；看板对照 CORE_EX1_259 03:46:36-03:47:54 7 次连击 100% 落地。',
  '2. 根因：DrawFixStrategy.kt L961-980 when 只在 retryHalfLanded 重扫入口，裸power 发出后敌方场面变化（敌随从死光）不复判；上游 m2v188 ②b PlayDirection.learnFromCardInfo 学错未知卡时 w1 预检看错方向。',
  '3. 修法：(a) L1012 waitLanded 失败分支内复用 L964 判定：敌/我空场即时跳过不计重试位（卡保留 halfLanded 下回合再试）。(b) L305-314 when 加 dir==UNKNOWN 且官方可执行时不留手（备选，不做先标 TODO）。',
  '4. 红线：禁拉黑死令 6dbc38/9b1801 不动；无目标判定只读 hasEnemyMinion/hasMyMinion，不碰 options 门；accept 交付物含 eid=20 同窗复测（裸power 空试次数=0）。',
  '5. 源码：D:/tdsh/hs_bridge_build/drawfix/src/main/kotlin/lin/drawfix/DrawFixStrategy.kt L964-980/L1006-1023；证据脚本 D:/tdsh/炉石传说/_drill_eid.cjs（node _drill_eid.cjs 20）。'
].join('\n');
const d1body = [
  '一句话：局终半落地卡触发三次全窗扫描（8s+14s+46s），修法= ⑥局终门 + ⑦双凭据（select 局计数器变化或 POWER 无落地块），凭据不足只扫一轮。',
  '1. 铁证：03:49:34-03:50:34 局终窗因分类账=半落地未销账 4 + 预算不足 4 + 重试到限 1：三次全窗重扫（WAR.isMyTurn=false 早退关不掉），烧 8s+14s+46s=68s 整窗开销。',
  '2. 修法 ⑥局终门：executeOutCard while 循环每次迭代判 WAR.me/handArea.cards 为空或局计数器变化→break 交 governor（半落地卡跨局 eid 复用，销账语义已死）。',
  '3. 修法 ⑦双凭据：retryHalfLanded 入口要求凭据二选一：(a) select 局计数器有变化；(b) Power.log 有未消费落地块。凭据不足→只扫→立即出循环。',
  '4. 受理标准：局终窗全窗扫描≤1 次且总耗时≤3s；正常回合行为零变化（accept 回归中位不回归）。',
  '5. 证据脚本：D:/tdsh/炉石传说/_wanted_play_audit.cjs；时间锚 03:49:34-03:50:34。'
].join('\n');
send('god', 'request', '【派单t-146】F1无目标例外+D1双轨凭据（m2v194 spec·铁证行号版）', f1body + '\n---\n' + d1body);
send('ryan-mtvy0jjp', 'inform', '【m2v194情报包直达】F1无目标例外+D1双轨凭据（行号锚+铁证）', f1body + '\n---\n' + d1body);
