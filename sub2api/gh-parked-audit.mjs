// 停放站号只读审计：登录 -> 读余额/签到状态 -> 判"是否有未开采产能"
// 严格零写入：不写 site-accounts.json、不建令牌、不动池（避免与并行 agent 抢状态）
// 用法: node gh-parked-audit.mjs
import fs from 'node:fs';
const store = JSON.parse(fs.readFileSync('D:/tdsh/forum_leads_20260913/site-accounts.json', 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0';
const unit = 500000;

async function audit(host, acc) {
  const base = acc.base;
  if (!base || !acc.username || !acc.password) return { host, verdict: 'NO_CREDS' };
  try {
    const lgRes = await fetch(base + '/api/user/login', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify({ username: acc.username, password: acc.password }), signal: AbortSignal.timeout(20000) });
    const lg = await lgRes.json().catch(() => ({}));
    const tok = lg?.data?.access_token || '';
    const uid = String(lg?.data?.id || '');
    // 老版 fork 只回 session cookie（不带 access_token）——本仓 FREE-API-SITES §开户三件套第 3 条已警告过：
    // 这种情况必须带 cookie + New-Api-User 头，否则会把"能登录的号"误读成 LOGIN_FAIL
    const setCookies = (lgRes.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
    if (!tok && !setCookies) return { host, verdict: 'LOGIN_FAIL', note: JSON.stringify(lg).slice(0, 90) };
    if (!tok && !uid) return { host, verdict: 'LOGIN_COOKIE_NO_UID', note: JSON.stringify(lg).slice(0, 90) };
    const H = { 'user-agent': UA, ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(setCookies ? { cookie: setCookies } : {}), ...(uid ? { 'new-api-user': uid } : {}) };
    const me = (await (await fetch(base + '/api/user/self', { headers: H, signal: AbortSignal.timeout(20000) })).json().catch(() => ({}))).data || {};
    const quota = (me.quota || 0) / unit, used = (me.used_quota || 0) / unit;
    let ci = null;
    try { ci = (await (await fetch(base + '/api/user/checkin', { headers: H, signal: AbortSignal.timeout(15000) })).json()).data || null; } catch { ci = null; }
    // 令牌：只读列表，不创建
    let keys = 0, keyMask = '';
    try {
      const tl = await (await fetch(base + '/api/token/?p=0&size=20', { headers: H, signal: AbortSignal.timeout(20000) })).json();
      const arr = Array.isArray(tl.data) ? tl.data : (tl.data?.items || []);
      keys = arr.length; keyMask = arr[0]?.key ? String(arr[0].key).slice(0, 6) + '…' : '';
    } catch {}
    return {
      host, verdict: quota > 0 ? 'HAS_QUOTA' : 'ZERO',
      quotaUsd: +quota.toFixed(2), usedUsd: +used.toFixed(2),
      checkin_enabled: ci ? (ci.checkin_quota !== undefined ? ci.checkin_quota : true) : 'unknown',
      checked_today: ci?.stats?.checked_in_today, ci_count: ci?.stats?.checkin_count,
      tokens: keys, keyMask, uid: me.id, group: me.group || '',
    };
  } catch (e) { return { host, verdict: 'ERR', note: String(e).slice(0, 70) }; }
}

const only = process.argv[2] || '';
const parked = Object.entries(store).filter(([, a]) => !a.poolName).filter(([h]) => !only || h.includes(only));
console.log(`停放（未入池）站号 ${parked.length} 家，只读审计中…\n`);
for (const [host, acc] of parked) {
  const r = await audit(host, acc);
  const line = `${String(r.host).padEnd(26)} ${String(r.verdict).padEnd(10)} quota=$${r.quotaUsd ?? '-'} used=$${r.usedUsd ?? '-'} tokens=${r.tokens ?? '-'} checkin=${JSON.stringify(r.checkin_enabled)}(今日${r.checked_today === undefined ? '?' : (r.checked_today ? '已签' : '未签')}, 累计${r.ci_count ?? '?'})`;
  console.log(line + (r.note ? ' | ' + r.note : ''));
}
console.log('\n（本脚本零写入：未建令牌、未签到发奖、未动池）');
