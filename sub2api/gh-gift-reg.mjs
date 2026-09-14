// poolrouter/tian-shu 补注册：字母数字混合码（上一轮只认纯数字是误判）
// 用法: node gh-gift-reg.mjs <base> <mailbox-addr> <mailbox-pass> <code>
import crypto from 'node:crypto';
const [BASE, mbox, mpass, code] = [process.argv[2], process.argv[3], process.argv[4], process.argv[5]];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!BASE || !mbox || !mpass || !code || !/@uberip\.com$/i.test(mbox)) { console.log('用法: node gh-gift-reg.mjs <https://host> <自建uberip邮箱> <邮箱密码> <混合验证码>'); process.exit(2); }
async function site(path, { method = 'GET', body, auth } = {}) {
  const r = await fetch(BASE + path, {
    method, headers: { 'user-agent': UA, ...(body ? { 'content-type': 'application/json' } : {}), ...(auth ? { authorization: 'Bearer ' + auth } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, t: t.slice(0, 300) };
}
const user = 'dsh' + crypto.randomBytes(4).toString('hex');
const pw = 'Pw' + crypto.randomBytes(6).toString('hex') + '!A1';
console.log('BASE=' + BASE, '| user=' + user);
let reg = await site('/api/user/register', { method: 'POST', body: { username: user, password: pw, email: mbox, verification_code: code } });
if (!(reg.j && reg.j.success)) reg = await site('/api/user/register', { method: 'POST', body: { username: user, password: pw, password2: pw, email: mbox, verification_code: code } });
console.log('  register ->', reg.status, (reg.j ? JSON.stringify(reg.j) : reg.t).slice(0, 200));
if (!(reg.j && reg.j.success)) { console.log('STOP 注册失败（可能码已过期，需重发）'); process.exit(6); }
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
const H = { ...(tok ? { auth: tok } : {}), extra: uid ? { 'new-api-user': uid } : {} };
if (!tok && !(cookie && uid)) { console.log('STOP 登录无会话:', (lg.j ? JSON.stringify(lg.j) : lg.t).slice(0, 160)); process.exit(7); }
const me = (await siteAuth('/api/user/self', H)).j?.data || {};
const q0 = (me.quota || 0) / 500000;
console.log('  uid=', me.id, '| group=', me.group, '| 注册赠送=$' + q0.toFixed(4));
console.log('RESULT user=' + user + ' gift=$' + q0.toFixed(4));
