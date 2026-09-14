// baosiapi 一次性产能实测：发码→自建邮箱读码→注册→读赠送→签到→量奖励→建令牌→三步门
// 用法: node gh-baosi-probe.mjs <mailbox-addr> <mailbox-pass>
// 纪律：只用 argv 传入的自建可读邮箱；日志只打掩码（用户名/key 前几位/余额），不打密码与完整 key
import crypto from 'node:crypto';
const BASE = 'https://baosiapi.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [mbox, mpass] = [process.argv[2], process.argv[3]];
if (!mbox || !mpass || !/@uberip\.com$/i.test(mbox)) { console.log('用法: node gh-baosi-probe.mjs <自建uberip邮箱> <邮箱密码>（硬拒绝非自建域）'); process.exit(2); }

async function site(path, { method = 'GET', body, auth } = {}) {
  const r = await fetch(BASE + path, {
    method, headers: { 'user-agent': UA, ...(body ? { 'content-type': 'application/json' } : {}), ...(auth ? { authorization: 'Bearer ' + auth } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, t: t.slice(0, 400) };
}
async function mailGet(path, tries = 4) {
  let err = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch('https://api.mail.tm' + path, { headers: MH, signal: AbortSignal.timeout(20000) });
      return await r.json();
    } catch (e) { err = e; await sleep(3000 + i * 3000); }
  }
  console.log('MAIL_API_FAIL:', String((err && err.message) || err).slice(0, 80));
  process.exit(5);
}
async function mailToken(tries = 4) {
  let err = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch('https://api.mail.tm/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: mbox, password: mpass }), signal: AbortSignal.timeout(20000) });
      const j = await r.json(); if (j.token) return { Authorization: 'Bearer ' + j.token };
      err = new Error(JSON.stringify(j).slice(0, 100));
    } catch (e) { err = e; }
    await sleep(3000 + i * 3000);
  }
  console.log('MAIL_LOGIN_FAIL:', String((err && err.message) || err).slice(0, 100)); process.exit(3);
}

console.log('=== 1/6 发验证码 ===');
const v = await site('/api/verification?email=' + encodeURIComponent(mbox));
console.log('  verify ->', v.status, (v.j ? JSON.stringify(v.j) : v.t).slice(0, 160));
if (!(v.j && v.j.success)) { console.log('STOP 发码被拒'); process.exit(4); }

console.log('=== 2/6 读码（自建收件箱，轮询≤120s）===');
const MH = await mailToken();
let code = '';
for (let i = 0; i < 24 && !code; i++) {
  await sleep(5000);
  const list = await mailGet('/messages');
  for (const m of list['hydra:member'] || []) {
    const full = await mailGet('/messages/' + m.id);
    const htmlRaw = Array.isArray(full.html) ? full.html.join(' ') : (full.html || '');
    const blob = (full.text || '') + ' ' + String(htmlRaw).replace(/<[^>]+>/g, ' ');
    const six = (blob.match(/\b\d{6}\b/g) || [])[0];
    const any = (blob.match(/\b\d{4,8}\b/g) || [])[0];
    if (six || any) { code = six || any; console.log('  命中邮件:', (full.subject || '').slice(0, 60), '| 码长:', code.length); break; }
  }
}
if (!code) { console.log('STOP 120s 未收到验证码'); process.exit(5); }

console.log('=== 3/6 注册 ===');
const user = 'dsh' + crypto.randomBytes(4).toString('hex');
const pw = 'Pw' + crypto.randomBytes(6).toString('hex') + '!A1';
let reg = await site('/api/user/login'.replace('/login', '/register'), { method: 'POST', body: { username: user, password: pw, email: mbox, verification_code: code } });
console.log('  register ->', reg.status, (reg.j ? JSON.stringify(reg.j) : reg.t).slice(0, 200));
if (!(reg.j && reg.j.success)) {
  reg = await site('/api/user/register', { method: 'POST', body: { username: user, password: pw, password2: pw, email: mbox, verification_code: code } });
  console.log('  register(password2) ->', reg.status, (reg.j ? JSON.stringify(reg.j) : reg.t).slice(0, 200));
}
if (!(reg.j && reg.j.success)) { console.log('STOP 注册失败'); process.exit(6); }

console.log('=== 4/6 登录 + 读注册赠送 ===');
let cookie = '';
async function siteAuth(path, opts = {}) {
  const r = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: { 'user-agent': UA, 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(opts.auth ? { authorization: 'Bearer ' + opts.auth } : {}), ...(opts.extra || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') : (r.headers.get('set-cookie') || '').split(';')[0];
  if (sc) cookie = cookie ? cookie + '; ' + sc : sc;
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, t: t.slice(0, 300) };
}
const lg = await siteAuth('/api/user/login', { method: 'POST', body: { username: user, password: pw } });
const tok = lg.j?.data?.access_token || '', uid = String(lg.j?.data?.id || '');
// 老 fork 只回 session cookie：凭 cookie + New-Api-User 头继续（FREE-API-SITES 开户三件套第3条）
if (!tok && !(cookie && uid)) { console.log('STOP 登录未回 token 且无 cookie:', (lg.j ? JSON.stringify(lg.j) : lg.t).slice(0, 160)); process.exit(7); }
if (!tok) console.log('  登录为 cookie 会话形态（无 access_token），改走 cookie + New-Api-User 头');
const authHdr = tok ? { auth: tok } : {};
import fs from 'node:fs';
try { fs.mkdirSync('D:/tdsh/sub2api/ghproxy', { recursive: true }); fs.writeFileSync('D:/tdsh/sub2api/ghproxy/baosi-acct.json', JSON.stringify({ base: BASE, username: user, email: mbox, saved_at: new Date().toISOString() })); } catch {}
const me = (await siteAuth('/api/user/self', { ...authHdr, extra: uid ? { 'new-api-user': uid } : {} })).j?.data || {};
const q0 = (me.quota || 0) / 500000;
console.log('  uid=', me.id, '| group=', me.group, '| 注册赠送=$' + q0.toFixed(4));

console.log('=== 5/6 签到并量奖励 ===');
const ci = await siteAuth('/api/user/checkin', { method: 'POST', ...authHdr, extra: uid ? { 'new-api-user': uid } : {} });
console.log('  checkin ->', ci.status, (ci.j ? JSON.stringify(ci.j) : ci.t).slice(0, 200));
const me2 = (await siteAuth('/api/user/self', { ...authHdr, extra: uid ? { 'new-api-user': uid } : {} })).j?.data || {};
const q1 = (me2.quota || 0) / 500000;
console.log('  签到前=$' + q0.toFixed(4), '签到后=$' + q1.toFixed(4), '奖励=$' + (q1 - q0).toFixed(4));

console.log('=== 6/6 建令牌 + 三步门 ===');
await siteAuth('/api/token/', { method: 'POST', ...authHdr, extra: uid ? { 'new-api-user': uid } : {}, body: { name: 'dsh-pool', remain_quota: 0, unlimited_quota: true, group: 'default' } });
const list = await siteAuth('/api/token/', { ...authHdr, extra: uid ? { 'new-api-user': uid } : {} });
const rows = Array.isArray(list.j?.data) ? list.j.data : [];
const rec = rows.find(r => r.name === 'dsh-pool') || rows[0];
const KEY = rec && rec.key;
console.log('  tokens=', rows.length, '| key_fp=', KEY ? 'sk-' + String(KEY).slice(3, 7) + '…len=' + String(KEY).length : 'NONE');
if (!KEY) { console.log('STOP 令牌不明文（需UI复制），本次只确认到签到产能'); process.exit(0); }
const mdl = await (await fetch(BASE + '/v1/models', { headers: { authorization: 'Bearer ' + KEY, 'user-agent': UA }, signal: AbortSignal.timeout(30000) })).json().catch(() => null);
const ids = (Array.isArray(mdl?.data) ? mdl.data : []).map(m => m.id);
console.log('  models -> n=' + ids.length, ids.slice(0, 8).join(','));
if (!ids.length) { console.log('STOP models 为空'); process.exit(8); }
const ch = await fetch(BASE + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY, 'user-agent': UA }, body: JSON.stringify({ model: ids[0], max_tokens: 60, messages: [{ role: 'user', content: 'What is 17 times 23? Answer with only the number.' }] }), signal: AbortSignal.timeout(90000) });
const cb = await ch.text();
let ans = ''; try { ans = (((JSON.parse(cb).choices || [{}])[0].message || {}).content || '').trim(); } catch {}
console.log('  chat[' + ids[0] + '] -> HTTP ' + ch.status, '| answer=' + JSON.stringify(ans).slice(0, 60));
console.log(ans.includes('391') && ch.status === 200 ? '✅ 三步门通过（知识门命中391）' : '⚠ 知识门未命中，需人工复核原文');
console.log('DONE user=' + user + ' gift=$' + q0.toFixed(4) + ' checkin_award=$' + (q1 - q0).toFixed(4));
