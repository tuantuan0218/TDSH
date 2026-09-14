// GitHub 新号登录 + 建 classic PAT（WebBridge 真实 Chrome；/login 不受 DataDome 保护，已实测）
// 用法: node gh-login-pat.mjs [note]
// 前置: gh-register-creds.json 里的 email/username/password 已被真人用于完成注册
// 产物: 把 PAT 追加写回 gh-register-creds.json (pat 字段) 并打印
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:10086/command';
const SESSION = 'freeapi-keys';
const NOTE = process.argv[2] || 'copilot-pool';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const creds = JSON.parse(fs.readFileSync('D:/tdsh/sub2api/gh-register-creds.json', 'utf8'));

async function wb(action, args = {}) {
  const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, session: SESSION, ...args }), signal: AbortSignal.timeout(120000) });
  const j = await r.json();
  if (!j.ok) throw new Error('WB_FAIL ' + JSON.stringify(j).slice(0, 300));
  return j.data;
}
async function ev(code) { const d = await wb('evaluate', { code }); return d?.value; }
const state = async () => JSON.parse(await ev(`JSON.stringify({href:location.href.slice(0,140),title:document.title,body:document.body?document.body.innerText.slice(0,400):'',inputs:[...document.querySelectorAll('input')].filter(i=>i.getBoundingClientRect().width>0).map(i=>({id:i.type,name:i.id,ph:i.placeholder}))})`));

// 0) 只动自己的 tab：优先复用已在 github.com 的 tab，否则由 navigate 自建
console.log('=== 1. 打开 /login ===');
await wb('navigate', { url: 'https://github.com/login' });
await sleep(4000);
let s = await state();
console.log('state:', s.href, '|', s.title, '| inputs=', JSON.stringify(s.inputs));
if (/captcha-delivery|temporarily restricted/i.test(s.body)) { console.log('❌ 被拦（意外：/login 本应不受保护）'); process.exit(1); }

console.log('=== 2. 填登录表单 ===');
const fill = await ev(`(() => {
  const u = document.querySelector('#login_field'), p = document.querySelector('#password');
  if (!u || !p) return 'NO_FORM';
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  u.focus(); set.call(u, ${JSON.stringify(creds.username || creds.email)}); u.dispatchEvent(new Event('input', { bubbles: true }));
  p.focus(); set.call(p, ${JSON.stringify(creds.password)}); p.dispatchEvent(new Event('input', { bubbles: true }));
  return 'OK';
})()`);
console.log('fill:', fill);
await sleep(800);
const clicked = await ev(`(() => { const b = document.querySelector('input[type=submit]') || [...document.querySelectorAll('button')].find(x=>/sign in/i.test(x.innerText||'')); if(!b) return 'NO_BTN'; b.click(); return 'CLICKED'; })()`);
console.log('submit:', clicked);
await sleep(7000);
s = await state();
console.log('after:', s.href, '|', s.title);
if (/two-factor|verify|authentication/.test(s.body + s.href)) {
  console.log('⚠️ 需要 2FA/二次验证 —— 这一步要你提供验证码或手动完成，之后重跑本脚本');
  console.log('BODY:', s.body.slice(0, 300));
  process.exit(2);
}
if (/login/.test(s.href)) { console.log('❌ 仍在登录页（凭据不对或注册未完成）'); console.log('BODY:', s.body.slice(0, 300)); process.exit(3); }

console.log('=== 3. 建 classic PAT (/settings/tokens/new) ===');
await wb('navigate', { url: 'https://github.com/settings/tokens/new?scopes=repo,gist&description=' + NOTE });
await sleep(5000);
s = await state();
console.log('pat page:', s.href, '|', s.title.slice(0, 60));
const gen = await ev(`(() => {
  const b = [...document.querySelectorAll('input[type=submit],button')].find(x => /generate token/i.test(x.value || x.innerText || ''));
  if (!b) return 'NO_GEN_BTN';
  b.click(); return 'CLICKED';
})()`);
console.log('generate:', gen);
await sleep(7000);
const tok = await ev(`(() => {
  const m = document.body.innerText.match(/gh[pousr]_[A-Za-z0-9]{20,}/);
  if (m) return m[0];
  const el = document.querySelector('input[value^="gh"], code, .markdown-body');
  const mm = (el ? (el.value || el.innerText) : '').match(/gh[pousr]_[A-Za-z0-9]{20,}/);
  return mm ? mm[0] : 'NOT_FOUND:' + document.body.innerText.slice(0, 200);
})()`);
console.log('TOKEN:', String(tok).slice(0, 12) + '…');
if (String(tok).startsWith('gh')) {
  creds.pat = tok; creds.pat_note = NOTE; creds.pat_at = new Date().toISOString();
  fs.writeFileSync('D:/tdsh/sub2api/gh-register-creds.json', JSON.stringify(creds, null, 2));
  // 验证 PAT 真能用（身份回显）
  const who = await (await fetch('https://api.github.com/user', { headers: { authorization: 'Bearer ' + tok, 'user-agent': 'gh-pool' } })).json();
  console.log('PAT 验证:', who.login, '| id=', who.id, '| created=', who.created_at);
  console.log('✅ 已写入 gh-register-creds.json.pat');
} else {
  console.log('❌ 未拿到 token，页面片段：', String(tok).slice(0, 300));
}
