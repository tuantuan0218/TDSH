/**
 * 免费站每日签到续额度（columbina 类站靠签到给额度，不签就没产能）
 * 读仓外 site-accounts.json → 逐站登录 → POST /api/user/checkin → 报额度变化。零写池。
 * 用法：node free-checkin.mjs [--all]
 */
import { readFileSync, writeFileSync } from 'node:fs';
const LEADS = 'D:/tdsh/forum_leads_20260913/';
const STORE = LEADS + 'site-accounts.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const store = JSON.parse(readFileSync(STORE, 'utf8'));
const unit = 500000; // quota_per_unit（columbina/emtf 实测一致）
for (const [host, acc] of Object.entries(store)) {
  if (!acc.base || !acc.username) { console.log(`${host}: 无凭据，跳过`); continue; }
  // 只看护「已入池」的号：store 里还留着注册成功但额度 0 / chat 不可用而被排除的站号，
  // 一并签到会打出"额度 $0.00"的行，极易被误读成"池里某个号空了"（真实误读风险，故过滤）
  const pooled = !!acc.poolName || host === 'newapi.columbina.eu.org';
  if (!pooled) { console.log(`${host}: 未入池，跳过`); continue; }
  try {
    const lgj = await (await fetch(acc.base + '/api/user/login', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify({ username: acc.username, password: acc.password }), signal: AbortSignal.timeout(20000) })).json();
    const tok = lgj?.data?.access_token, uid = String(lgj?.data?.id || '');
    if (!tok) { console.log(`${host}: 登录失败 ${JSON.stringify(lgj).slice(0, 90)}`); continue; }
    // 老版只回 cookie 时，/api/user/* 还必须有 New-Api-User 头，否则恒 401（本会话实测教训）
    const HDRS = { 'user-agent': UA, authorization: 'Bearer ' + tok, ...(uid ? { 'new-api-user': uid } : {}) };
    const me0 = (await (await fetch(acc.base + '/api/user/self', { headers: HDRS })).json()).data || {};
    const ci = await (await fetch(acc.base + '/api/user/checkin', { method: 'POST', headers: HDRS, signal: AbortSignal.timeout(20000) })).json().catch(() => null);
    const me1 = (await (await fetch(acc.base + '/api/user/self', { headers: HDRS })).json()).data || {};
    const before = (me0.quota || 0) / unit, after = (me1.quota || 0) / unit;
    const st = (await (await fetch(acc.base + '/api/user/checkin', { headers: HDRS })).json()).data || {};
    console.log(`${host}\n  签到: ${ci?.success ? '成功 awarded=' + (ci.data?.quota_awarded ?? 0) : (ci?.message || '无响应')}` +
      `\n  额度: $${before.toFixed(2)} → $${after.toFixed(2)}（累计签到 ${st.stats?.checkin_count ?? '?'} 次，今日${st.stats?.checked_in_today ? '已签' : '未签'}）`);
    store[host] = { ...acc, accessToken: tok, quotaUsd: +after.toFixed(2), lastCheckin: new Date().toISOString() };
  } catch (e) { console.log(`${host}: ERR ${String(e).slice(0, 70)}`); }
}
writeFileSync(STORE, JSON.stringify(store, null, 1));
console.log('\n（额度写回 ' + STORE + '，池子未改动）');
