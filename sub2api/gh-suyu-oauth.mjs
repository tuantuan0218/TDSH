// 速语(free.suyu.io) GitHub OAuth 全流程：登录 -> 授权 -> 建 API key -> 打印入池命令
// 用法: node gh-suyu-oauth.mjs
// 前置: 1) 新 GitHub 号已在该 Chrome 会话登录（先跑 gh-login-pat.mjs 即已登录）
//       2) /login/oauth/authorize 不受 DataDome 保护（/login 已实测正常）
const BASE = 'http://127.0.0.1:10086/command';
const SESSION = 'freeapi-keys';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wb(action, args = {}) {
  const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, session: SESSION, ...args }), signal: AbortSignal.timeout(120000) });
  const j = await r.json(); if (!j.ok) throw new Error('WB_FAIL ' + JSON.stringify(j).slice(0, 300)); return j.data;
}
const ev = async code => (await wb('evaluate', { code }))?.value;
const state = async () => JSON.parse(await ev(`JSON.stringify({href:location.href.slice(0,160),title:document.title.slice(0,60),btns:[...document.querySelectorAll('a,button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>(b.innerText||'').trim().slice(0,24)).filter(Boolean).slice(0,25),body:(document.body?document.body.innerText.slice(0,500):'')})`));

console.log('=== 1. 打开速语并点 GitHub 登录 ===');
await wb('navigate', { url: 'https://free.suyu.io/' });
await sleep(5000);
let s = await state();
console.log('home:', s.href, '|', s.title, '| btns=', s.btns.join(' / '));
const go = await ev(`(() => { const b = [...document.querySelectorAll('a,button')].find(x => /使用 GitHub 登录|Continue with GitHub|GitHub 登录/i.test(x.innerText || '')); if (!b) return 'NO_GH_BTN'; b.click(); return 'CLICKED'; })()`);
console.log('click gh:', go);
await sleep(8000);
s = await state();
console.log('after-gh:', s.href, '|', s.title);

if (/login\/oauth\/authorize|\/login\b/.test(s.href)) {
  console.log('=== 2. GitHub 授权页 -> 点 Authorize ===');
  const au = await ev(`(() => { const b = [...document.querySelectorAll('button,input[type=submit]')].find(x => /authorize|授权/i.test(x.value || x.innerText || '')); if (!b) return 'NO_AUTHORIZE:' + document.body.innerText.slice(0,200); b.click(); return 'CLICKED'; })()`);
  console.log('authorize:', au);
  await sleep(9000);
  s = await state();
  console.log('back at:', s.href, '|', s.title);
}

console.log('=== 3. 找 token 控制台（New API 常见路由逐个试）===');
let key = null;
for (const path of ['/console/token', '/user/token', '/dashboard/token', '/token']) {
  await wb('navigate', { url: 'https://free.suyu.io' + path });
  await sleep(4500);
  s = await state();
  const okPage = /token|密钥/i.test(s.title + s.body) && !/(404|not found)/i.test(s.body.slice(0, 200));
  console.log(`  ${path} -> ${s.href.slice(0, 70)} | ${s.title.slice(0, 30)} | ${okPage ? 'TOKEN_PAGE' : 'no'}`);
  if (!okPage) continue;
  const add = await ev(`(() => { const b = [...document.querySelectorAll('button,a')].find(x => /^(添加|新建|创建|Add|New)/i.test((x.innerText||'').trim()) && /token|密钥/i.test((x.innerText||'').trim() + (x.className||''))); if (!b) return 'NO_ADD_BTN:' + [...document.querySelectorAll('button')].map(x=>(x.innerText||'').trim()).filter(Boolean).slice(0,15).join('/'); b.click(); return 'CLICKED_ADD'; })()`);
  console.log('  add:', String(add).slice(0, 120));
  await sleep(4000);
  const k = await ev(`(() => { const m = document.body.innerText.match(/sk-[A-Za-z0-9_\\-]{10,}/); if (m) return m[0]; const i=[...document.querySelectorAll('input')].map(x=>x.value).find(v=>/^sk-/.test(v||'')); return i || 'NO_KEY_YET:' + document.body.innerText.slice(0,250); })()`);
  console.log('  key probe:', String(k).slice(0, 80));
  if (String(k).startsWith('sk-')) { key = k; break; }
}
if (key) {
  console.log('\n✅ 速语 KEY =', key);
  console.log('入池命令：');
  console.log(`$env:SF_NAME="suyu-free"; $env:SF_BASE="https://free.suyu.io/v1"; $env:SF_KEY="${key}"; $env:SF_MODELS='{"Tuan":"gpt-5.5"}'; node add-free-api-pool.mjs`);
} else {
  console.log('\n❌ 未自动拿到 key —— 看上面的路由探测结果，人工在站内点一次"添加令牌"即可（已确认 GitHub OAuth 可通）');
}
