// F2 仲裁终报：投 god(request 作废观察并入验收)+Ryan(inform 撤修保交付速度)
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
function send(to, act, subject, body) {
  fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
  fs.writeFileSync(path.join(me, 'outbox', stamp() + '.json'), JSON.stringify({ to, act, subject, body }, null, 2), 'utf8');
  console.log('written ->', to, act);
}
const body = [
  '【F2 仲裁终报：假半落地，无需编码，只需加一验收行】',
  '1. 03:52 四卡全部销账：eid25（03:53:52.765）/eid4（03:53:52.765）/eid27（03:54:39.650）/eid81（03:55:17.744）——半落地销账声明『本回合任意时刻确认落地』，统计窗跨回合即判成功。',
  '2. 中间裸power 未落地可解释：03:53:17 全员『费拒绝恢复跳过』=官方亲口钱不够（非脚本拦）；03:53:52 官方又放行→销账。点选有效层+恢复重试层+费拒绝层三层语义干净，无重复废动作。',
  '3. 化石项 eid21 CATA_190h：03:49 余=1/cost=6 老回合半落地，03:54 新局 eid 复用=另一张 TLC_222 火鹰飞翔（已出牌+半落地正常流程），同号不同命。',
  '4. 新回合同族新嫌疑（eid9/14/20 全是 03:55 新局半落地+官方放行）：同『稍后销账』语义，D1 局终门修后自然收敛，不必追加派修。',
  '5. 结论：(a) F2 观察 9988c8 作废，不编码；(b) 请 Ryan 在 m2v194 accept 脚本加一验收行『半落地销账延迟分布（出牌→销账秒数直方图）』，此后半落地族量化归验收口径，不再走人工仲裁。',
  '6. 证据：node D:/tdsh/炉石传说/_drill_eid.cjs 27,25,4,81（销账四行）；node D:/tdsh/炉石传说/_wanted_play_audit.cjs（正常落地 21→28）。'
].join('\n');
send('god', 'request', '【F2仲裁】假半落地：F2观察作废不编码，m2v194 accept加销账延迟验收行', body);
send('ryan-mtvy0jjp', 'inform', '【F2仲裁】假半落地：9988c8作废不编码，accept加销账延迟验收行', body);
