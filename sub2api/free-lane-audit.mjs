/**
 * 免费道体检：逐号查「站内余额 + chat 真出词」，输出可执行建议（不自动改池，改池需用户点头）。
 * 动机：pollinations 那次的失效形态是「HTTP 200 但正文是预算错误」，只看状态码会被骗 → 必须校验正文。
 * 用法：node free-lane-audit.mjs   （只读；要停池请复制它给出的 SQL）
 */
import { readFileSync, existsSync, realpathSync } from 'node:fs';
// CWD 可移植：Windows 侧 node 拿 D:/tdsh/...，WSL 侧 node（CWD=/mnt/d/tdsh/sub2api）拿 WSL 等价路径。
// 用 realpath 解出"当前 CWD 的绝对路径"，Windows/WSL 各自正确；CWD 由调用方保证 = sub2api 根。
import { join } from 'node:path';
const CWD = realpathSync(process.cwd());
// 接受可选 env 覆盖：DSH_LEADS_DIR 指向 forum_leads 目录（默认按 CWD 推导：sub2api 同级 forum_leads_20260913）
// 修：原推导正则只认 '/'，而 Windows realpathSync 给的是 '\' → LEADS 退化成 sub2api 自身 → ENOENT。
// 保留调用方的 env 覆盖设计；两种分隔符都识别；再兜底到已知的 forum_leads_20260913 绝对路径。
let LEADS = process.env.DSH_LEADS_DIR || CWD.replace(/[\\/]tdsh[\\/]sub2api$/, 'tdsh' + (CWD.includes('\\') ? '\\' : '/') + 'forum_leads_20260913');
if (!existsSync(join(LEADS, 'site-accounts.json'))) {
  const FB = CWD.includes('\\') ? 'D:\\tdsh\\forum_leads_20260913' : '/mnt/d/tdsh/forum_leads_20260913';
  if (existsSync(join(FB, 'site-accounts.json'))) LEADS = FB;
}
const store = JSON.parse(readFileSync(join(LEADS, 'site-accounts.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const BAD = /(budget|quota|exhausted|limit exceeded|try again later|rate.?limit|insufficient|无可用|额度.{0,6}用尽)/i;
const UNIT = 500000;
const rows = [];
// 判据纯函数放最前（selftest 不联网也能调；advise/stationOf/isOK 全是函数声明，会被提升）
function stationOf(r) { return (r.tag || '').split('#')[0] || 'unknown'; }
function isOK(r) { return String(r.chat || '').startsWith('OK'); }   // 'OK' 与 'OK(重试)' 都算健康（曾因只认 'OK' 误荐停池）
// 自检放最前：**不联网**（advise/stationOf/isOK 是函数声明，会被提升，可在此调用）
if (process.argv.includes('--selftest')) {
  const mk = (tag, chat, quota) => ({ tag, poolName: tag.replace(/[#.]/g, '-'), chat, quotaUsd: quota });
  const cases = [];
  let s = advise(Array.from({ length: 19 }, (_, i) => mk('newapi.columbina.eu.org#' + i, 'BAD', 100)));
  cases.push(['站方成片故障(19/19 BAD) → 零条停池 SQL', s.sql.length === 0 && Object.keys(s.outage).length === 1]);
  s = advise([mk('h1#0', 'BAD', 50), mk('h1#1', 'BAD', 50), mk('h1#2', 'OK', 50), mk('h2', 'BAD', 5)]);
  cases.push(['同站 2/3 失败(≥50%) 判站方 → 只留 h2 一条', s.sql.length === 1 && s.sql[0].tag === 'h2']);
  s = advise([mk('h3#0', 'OK', 50), mk('h3#1', 'BAD', 50), mk('h3#2', 'OK', 50)]);
  cases.push(['零星 1/3 失败 → 按账号级出 SQL', s.sql.length === 1]);
  s = advise([mk('h4', 'BAD', 5)]);
  cases.push(['单号站失败(号数<3 不成片) → 可账号级处置', s.sql.length === 1]);
  s = advise([mk('h5', 'OK', 50), mk('h5#1', 'OK', 50)]);
  cases.push(['全健康 → 无 SQL', s.sql.length === 0]);
  s = advise([mk('h6#0', 'OK', 0.2), mk('h6#1', 'OK', 0.3), mk('h6#2', 'OK', 0.1)]);
  cases.push(['低余额(<$1)不被"成片健康"规则吞掉', s.sql.length === 3]);
  // 本轮实况用例：20 号里 5 号失败（26%，远小于 50%）→ 仍须判为站方相关故障，一条 SQL 都不出
  s = advise([...Array.from({ length: 15 }, (_, i) => mk('stA#' + i, 'OK', 100)),
    ...Array.from({ length: 5 }, (_, i) => mk('stA#f' + i, 'BAD', 100))]);
  cases.push(['19/19→14/19 部分无票(26%) 也判站方 → 零停池 SQL', s.sql.length === 0 && Object.keys(s.outage).length === 1]);
  s = advise([mk('onlyone', 'BAD', 30)]);
  cases.push(['单号站唯一失败 → 不被误判成片', s.sql.length === 1 && Object.keys(s.outage).length === 0]);
  // 真实回归用例：加"3 次重试"后状态变成 'OK(重试)'，下游若只认 'OK' 就会给健康号荐停池（本会话实际犯过）
  s = advise([mk('h9#0', 'OK(重试)', 50), mk('h9#1', 'OK', 50), mk('h9#2', 'OK(重试)', 0.4)]);
  cases.push(["'OK(重试)' 视为健康：不出停池建议；仅低余额那条进处置清单", s.sql.length === 1 && s.sql[0].quotaUsd === 0.4]);
  const fail = cases.filter(c => !c[1]);
  cases.forEach(([n, ok]) => console.log((ok ? '  ok   ' : '  FAIL ') + n));
  console.log(fail.length ? 'AUDIT SELFTEST FAILED: ' + fail.map(f => f[0]).join(' | ') : 'AUDIT SELFTEST ALL PASS');
  process.exit(fail.length ? 1 : 0);
}
for (const [tag, a] of Object.entries(store)) {
  if (!a.apiKey || !a.base) continue;
  // 早期 keyreveal 流程存的条目没有 poolName 字段（曾导致主号 id 20 被体检漏掉）→ 按命名规则回推
  const poolName = a.poolName || (tag.includes('#') ? null : (a.host || tag.split('#')[0]) === 'newapi.columbina.eu.org' ? 'columbina-free' : null);
  if (!poolName) continue;
  const r = { tag, poolName, host: a.host || tag.split('#')[0] };
  // 1) 站内余额（老版 fork 登录只回 session cookie，无 access_token —— 必须抓 cookie + New-Api-User 头）
  try {
    const lgRes = await fetch(a.base + '/api/user/login', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify({ username: a.username, password: a.password }), signal: AbortSignal.timeout(20000) });
    const lg = await lgRes.json().catch(() => ({}));
    const tok = lg?.data?.access_token || '';
    const uid = String(lg?.data?.id || '');
    const cookie = (lgRes.headers.getSetCookie ? lgRes.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
    const hasSession = !!(tok || (cookie && uid));
    const sc = await fetch(a.base + '/api/user/self', { headers: { 'user-agent': UA, ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(cookie ? { cookie } : {}), ...(uid ? { 'new-api-user': uid } : {}) }, signal: AbortSignal.timeout(20000) });
    const sj = await sc.json().catch(() => null);
    if (hasSession && sc.status === 401) r.quotaErr = '会话有效但 self 401（可能需别的头）';
    r.quotaUsd = sj?.data?.quota != null ? +(sj.data.quota / UNIT).toFixed(2) : null;
    r.usedQuota = sj?.data?.used_quota ?? null;
  } catch (e) { r.quotaErr = String(e).slice(0, 40); }
  // 2) chat 健康判定——**判据要便宜**（本会话实证：要求"正文含 PONG"让我自烧了这条道约 40% 额度，
  //    因为推理型模型为回一个词要产 600~900 reasoning token，300 次探针≈20 万 token）。
  //    现在：HTTP 200 + 响应里有 choices/finish_reason 即算活着；只有 error 体或非 200 才算坏。
  //    仍带 3 次重试（单次失败可能只是本机出口抖动或站方瞬时没票）。
  let tries = 0, lastDetail = '', alive = false;
  for (let att = 1; att <= 3; att++) {
    tries = att;
    const t0 = Date.now();
    try {
      // 探活 URL：默认拼 '/v1/chat/completions'；单号站可带 chatPath 覆盖真实网关路径
      // （坑：keyreveal 时代 store 只存主机名 base，olomc 真实 chat 在 /gw/v1/chat/completions，
      //   默认拼法会打到 /v1/... → 404 → 3 次重试全 BAD → 误荐停池。48 号就是这样被误判的。）
      const chatUrl = (a.chatPath ? (a.base + a.chatPath) : (a.base + '/v1/chat/completions'));
      const c = await fetch(chatUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA, authorization: 'Bearer ' + a.apiKey }, body: JSON.stringify({ model: a.verifiedModel || a.models?.[0] || 'grok-4.5', max_tokens: 24, messages: [{ role: 'user', content: 'hi' }] }), signal: AbortSignal.timeout(90000) });
      const b = await c.text(); let j = null; try { j = JSON.parse(b); } catch { }
      // 判"活着"三选一：(1) 有 choices 数组 (2) 有顶层 finish_reason (3) 有 output 数组。
      // 推理模型小 max_tokens 时 content="" 但 reasoning_content 非空 + finish_reason=length → 仍算活（发现 15 aio-freeshare 前科 + 48 号复核实证）。
      // 只看 content 非空是错的：推理模型 8~24 token 全吃在 reasoning_content，content 永远空。
      const env = !!j && (
        Array.isArray(j.choices) ||
        j.finish_reason ||
        (j.output && Array.isArray(j.output)) ||
        (Array.isArray(j.choices) && j.choices[0]?.message?.reasoning_content)
      );
      const errTxt = String((j?.error?.message) || j?.message || '');
      // 正文里出现预算/限流/鉴权词 = 静默失败（HTTP 200 但正文是错的），仍判 BAD
      const silentBad = BAD.test(errTxt) || BAD.test(String(j?.choices?.[0]?.message?.content || ''));
      const good = c.status === 200 && env && !silentBad;
      r.ms = Date.now() - t0;
      lastDetail = good ? `fin=${j.choices?.[0]?.finish_reason || '-'} tok=${j.usage?.completion_tokens ?? '-'}` : `[${c.status}] ${(errTxt || b.slice(0, 60)).replace(/\s+/g, ' ')}`;
      if (good) { alive = true; r.chat = att > 1 ? 'OK(重试)' : 'OK'; break; }
    } catch (e) { lastDetail = 'ERR ' + String(e).slice(0, 40); r.ms = Date.now() - t0; }
    if (att < 3) await new Promise(rr => setTimeout(rr, 4000));
  }
  if (!alive) r.chat = 'BAD';
  r.detail = lastDetail + ` (试${tries}次)`;
  r.attempts = tries;
  rows.push(r);
}

/* 判据抽成纯函数，可被 --selftest 喂假数据验证。
 * 为什么必须这样：站方整体抖动时（实测 0/19 健康、全 503 providers=xai），
 * 旧版会给 19 个号**各**出一条"建议停池"——后来的会话照做就会在一次十几分钟的抖动里停掉整条免费道。
 * 规则：某站 ≥3 个号且失败率 ≥50% → 判为「站方级相关故障」，这些号**不出停池建议**；
 *       零星失败（<50% 或号数 <3）才按账号级处置。 */
function advise(rows) {
  const byStation = {};
  for (const r of rows) (byStation[stationOf(r)] ||= []).push(r);
  const outage = {};
  for (const [st, list] of Object.entries(byStation)) {
    const badN = list.filter(r => !isOK(r)).length;
    // 判据：同站 ≥2 号同时失败即算相关故障（它们共享上游，独立失败概率极低）。
    // 不用"失败率≥50%"：实测 14/19 健康、5 号失败(26%) 就是站方部分无票，按 50% 会误荐逐号停池。
    if (list.length >= 2 && badN >= 2) outage[st] = { n: list.length, bad: badN };
  }
  for (const r of rows) {
    const st = stationOf(r), q = r.quotaUsd;
    if (outage[st]) {
      r.advice = isOK(r) ? '🟢 健康（本站整体异常中）' : '⚪ 站方级相关故障 → **勿逐号停池**（等恢复或换厂商）';
    } else {
      r.advice = !isOK(r) ? '🔴 建议停池（chat 不健康，且非同站成片故障）'
        : (q != null && q < 1) ? '🟠 余额<$1，建议停池等次日签到' : '🟢 健康';
    }
  }
  // 处置清单要含"低余额"号（它们 chat 是 OK 的）——旧版靠 advice!==健康 带出来，重写时别丢
  const needAction = r => !isOK(r) || (r.quotaUsd != null && r.quotaUsd < 1);
  return { outage, sql: rows.filter(r => needAction(r) && !outage[stationOf(r)]) };
}

console.log('号位 | 池名 | 站内余额 | chat | 延迟 | 建议');
const { outage, sql: actionable } = advise(rows);
console.log('号位 | 池名 | 站内余额 | chat | 延迟 | 建议');
console.log('-----|------|---------|------|------|-----');
for (const r of rows) {
  console.log(`${r.tag.padEnd(28)} | ${(r.poolName || '-').padEnd(17)} | ${String(r.quotaUsd ?? '?').padStart(8)} | ${(r.chat || '?').padEnd(4)} | ${String(r.ms ?? '-').padStart(5)}ms | ${r.advice}`);
  if (!isOK(r)) console.log(`   └ ${r.detail}`);
}
const total = rows.reduce((s, r) => s + (r.quotaUsd || 0), 0);
console.log(`\n合计站内免费额度 ≈ $${total.toFixed(2)}；健康 ${rows.filter(isOK).length}/${rows.length}`);
// 集中度视图：同一站的多个号是【相关故障】——发现 15 实测那次 503 在账号间随机漂移就是证据。
// 别把"N 个号"读成"N 个独立源"。
const byStation = {};
for (const r of rows) {
  const st = (r.tag.split('#')[0]) || 'unknown';
  (byStation[st] ||= { n: 0, usd: 0, ok: 0 });
  byStation[st].n++; byStation[st].usd += r.quotaUsd || 0; if (isOK(r)) byStation[st].ok++;
}
const grp = Object.entries(byStation).sort((a, b) => b[1].usd - a[1].usd);
console.log('\n=== 按站聚合（集中度警示） ===');
for (const [k, v] of grp) console.log(`  ${k.padEnd(30)} 号数=${String(v.n).padStart(2)} 健康=${v.ok}/${v.n} 余额=$${v.usd.toFixed(2).padStart(8)} 占比=${(v.usd / (total || 1) * 100).toFixed(1)}%`);
const top = grp[0];
if (top && total && top[1].usd / total > 0.7) console.log(`  ⚠️ 单站独占 ${(top[1].usd / total * 100).toFixed(0)}%（${top[0]}）→ 该站一挂免费道近乎归零；**扩站比扩号更有价值**`);
if (Object.keys(outage).length) {
  console.log('\n🟥 站方级相关故障（同站成片失败，**不要逐号停池**——抖动通常十几分钟自愈）：');
  for (const [st, v] of Object.entries(outage)) console.log(`   ${st}：${v.bad}/${v.n} 号失败 → 根因在站方/上游厂商，处置=等恢复或补其他厂商的源`);
}
if (actionable.length) {
  console.log('\n需要处置的号（SQL 供你确认后手动执行，本脚本不改池）：');
  for (const b of actionable) console.log(`  UPDATE accounts SET schedulable=false WHERE name='${b.poolName}';  -- ${b.advice}`);
} else if (rows.some(r => r.chat !== 'OK')) {
  console.log('\n（本轮所有失败都落在"站方级相关故障"里 → 无账号级处置建议。这正是本次修复要防的误停池）');
}
