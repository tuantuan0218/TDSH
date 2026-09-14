// poolrouter/tian-shu 注册赠送+签到奖励 REST 实测（自建 uberip 邮箱，单号，零第三方发信）
// 用法: node gh-gift-probe.mjs <base> <mailbox-addr> <mailbox-pass>
// 只打掩码与余额，不打密码/完整 key；签到只做一次（新号首签）
import crypto from 'node:crypto';
const [BASE, mbox, mpass] = [process.argv[2], process.argv[3], process.argv[4]];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!BASE || !mbox || !mpass || !/@uberip\.com$/i.test(mbox)) { console.log('用法: node gh-gift-probe.mjs <https://host> <自建uberip邮箱> <邮箱密码>'); process.exit(2); }

async function site(path, { method = 'GET', body, auth } = {}) {
  const r = await fetch(BASE + path, {
    method, headers: { 'user-agent': UA, ...(body ? { 'content-type': 'application/json' } : {}), ...(auth ? { authorization: 'Bearer ' + auth } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000),
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, t: t.slice(0, 300) };
}
const st = await site('/api/status');
console.log('BASE=' + BASE, '| status=', st.status, '| reg=', st.j?.data?.register_enabled, '| pwreg=', st.j?.data?.password_register_enabled, '| ev=', st.j?.data?.email_verification, '| ts=', st.j?.data?.turnstile_check, '| ck=', st.j?.data?.checkin_enabled, '| unit=', st.j?.data?.quota_per_unit);
if (!(st.j?.data?.register_enabled && st.j?.data?.password_register_enabled)) { console.log('STOP 注册未开放'); process.exit(3); }
if (st.j?.data?.turnstile_check) { console.log('STOP 需人机验证，本脚本止步'); process.exit(3); }

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
async function mailGet(MH, path, tries = 4) {
  let err = null;
  for (let i = 0; i < tries; i++) {
    try { return await (await fetch('https://api.mail.tm' + path, { headers: MH, signal: AbortSignal.timeout(20000) })).json(); }
    catch (e) { err = e; await sleep(3000 + i * 3000); }
  }
  console.log('MAIL_API_FAIL:', String((err && err.message) || err).slice(0, 80)); process.exit(5);
}

console.log('=== 发验证码 ===');
const v = await site('/api/verification?email=' + encodeURIComponent(mbox));
console.log('  verify ->', v.status, (v.j ? JSON.stringify(v.j) : v.t).slice(0, 160));
if (!(v.j && v.j.success)) { console.log('STOP 发码被拒'); process.exit(4); }
const MH = await mailToken();
let code = '';
for (let i = 0; i < 24 && !code; i++) {
  await sleep(5000);
  const list = await mailGet(MH, '/messages');
  for (const m of list['hydra:member'] || []) {
    const full = await mailGet(MH, '/messages/' + m.id);
    const htmlRaw = Array.isArray(full.html) ? full.html.join(' ') : (full.html || '');
    const blob = (full.text || '') + ' ' + String(htmlRaw).replace(/<[^>]+>/g, ' ');
    const six = (blob.match(/\b\d{6}\b/g) || [])[0];
    const any = (blob.match(/\b\d{4,8}\b/g) || [])[0];
    if (six || any) { code = six || any; console.log('  命中邮件:', (full.subject || '').slice(0, 60), '| 码长:', code.length); break; }
  }
}
if (!code) { console.log('STOP 120s 未收到验证码'); process.exit(5); }

console.log('=== 注册 ===');
const user = 'dsh' + crypto.randomBytes(4).toString('hex');
const pw = 'Pw' + crypto.randomBytes(6).toString('hex') + '!A1';
let reg = await site('/api/user/register', { method: 'POST', body: { username: user, password: pw, email: mbox, verification_code: code } });
if (!(reg.j && reg.j.success)) reg = await site('/api/user/register', { method: 'POST', body: { username: user, password: pw, password2: pw, email: mbox, verification_code: code } });
console.log('  register ->', reg.status, (reg.j ? JSON.stringify(reg.j) : reg.t).slice(0, 200));
if (!(reg.j && reg.j.success)) { console.log('STOP 注册失败'); process.exit(6); }

console.log('=== 登录 + 读赠送 + 签到计量 ===');
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
const ci = await siteAuth('/api/user/checkin', { method: 'POST', ...H });
console.log('  checkin ->', ci.status, (ci.j ? JSON.stringify(ci.j) : ci.t).slice(0, 200));
const me2 = (await siteAuth('/api/user/self', H)).j?.data || {};
const q1 = (me2.quota || 0) / 500000;
console.log('RESULT user=' + user + ' gift=$' + q0.toFixed(4) + ' checkin_award=$' + (q1 - q0).toFixed(4));
