/**
 * 免费道体检：逐号查「站内余额 + chat 真出词」，输出可执行建议（不自动改池，改池需用户点头）。
 * 动机：pollinations 那次的失效形态是「HTTP 200 但正文是预算错误」，只看状态码会被骗 → 必须校验正文。
 * 用法：node free-lane-audit.mjs   （只读；要停池请复制它给出的 SQL）
 */
import { readFileSync } from 'node:fs';
const store = JSON.parse(readFileSync('D:/tdsh/forum_leads_20260913/site-accounts.json', 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const BAD = /(budget|quota|exhausted|limit exceeded|try again later|rate.?limit|insufficient|无可用|额度.{0,6}用尽)/i;
const UNIT = 500000;
const rows = [];
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
      const c = await fetch(a.base + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA, authorization: 'Bearer ' + a.apiKey }, body: JSON.stringify({ model: a.verifiedModel || a.models?.[0] || 'grok-4.5', max_tokens: 24, messages: [{ role: 'user', content: 'hi' }] }), signal: AbortSignal.timeout(90000) });
      const b = await c.text(); let j = null; try { j = JSON.parse(b); } catch { }
      const env = !!j && (Array.isArray(j.choices) || j.finish_reason || (j.output && Array.isArray(j.output)));
      const errTxt = String((j?.error?.message) || j?.message || '');
      const good = c.status === 200 && env && !BAD.test(errTxt);
      r.ms = Date.now() - t0;
      lastDetail = good ? `fin=${j.choices?.[0]?.finish_reason || '-'} tok=${j.usage?.completion_tokens ?? '-'}` : `[${c.status}] ${(errTxt || b.slice(0, 60)).replace(/\s+/g, ' ')}`;
      if (good) { alive = true; r.chat = att > 1 ? 'OK(重试)' : 'OK'; break; }
    } catch (e) { lastDetail = 'ERR ' + String(e).slice(0, 40); r.ms = Date.now() - t0; }
    if (att < 3) await new Promise(rr => setTimeout(rr, 4000));
  }
  if (!alive) r.chat = 'BAD';
  r.detail = lastDetail + ` (试${tries}次)`;
  r.attempts = tries;
  const q = r.quotaUsd;
  r.advice = r.chat !== 'OK' ? '🔴 建议停池（chat 不健康）' : (q != null && q < 1) ? '🟠 余额<$1，建议停池等次日签到' : '🟢 健康';
  rows.push(r);
}
console.log('号位 | 池名 | 站内余额 | chat | 延迟 | 建议');
console.log('-----|------|---------|------|------|-----');
for (const r of rows) {
  console.log(`${r.tag.padEnd(28)} | ${(r.poolName || '-').padEnd(17)} | ${String(r.quotaUsd ?? '?').padStart(8)} | ${(r.chat || '?').padEnd(4)} | ${String(r.ms ?? '-').padStart(5)}ms | ${r.advice}`);
  if (r.chat !== 'OK') console.log(`   └ ${r.detail}`);
}
const total = rows.reduce((s, r) => s + (r.quotaUsd || 0), 0);
console.log(`\n合计站内免费额度 ≈ $${total.toFixed(2)}；健康 ${rows.filter(r => r.chat === 'OK').length}/${rows.length}`);
// 集中度视图：同一站的多个号是【相关故障】——发现 15 实测那次 503 在账号间随机漂移就是证据。
// 别把"N 个号"读成"N 个独立源"。
const byStation = {};
for (const r of rows) {
  const st = (r.tag.split('#')[0]) || 'unknown';
  (byStation[st] ||= { n: 0, usd: 0, ok: 0 });
  byStation[st].n++; byStation[st].usd += r.quotaUsd || 0; if (r.chat === 'OK') byStation[st].ok++;
}
const grp = Object.entries(byStation).sort((a, b) => b[1].usd - a[1].usd);
console.log('\n=== 按站聚合（集中度警示） ===');
for (const [k, v] of grp) console.log(`  ${k.padEnd(30)} 号数=${String(v.n).padStart(2)} 健康=${v.ok}/${v.n} 余额=$${v.usd.toFixed(2).padStart(8)} 占比=${(v.usd / (total || 1) * 100).toFixed(1)}%`);
const top = grp[0];
if (top && total && top[1].usd / total > 0.7) console.log(`  ⚠️ 单站独占 ${(top[1].usd / total * 100).toFixed(0)}%（${top[0]}）→ 该站一挂免费道近乎归零；**扩站比扩号更有价值**`);
const bad = rows.filter(r => r.advice !== '🟢 健康');
if (bad.length) {
  console.log('\n需要处置的号（SQL 供你确认后手动执行，本脚本不改池）：');
  for (const b of bad) console.log(`  UPDATE accounts SET schedulable=false WHERE name='${b.poolName}';  -- ${b.advice}`);
}
