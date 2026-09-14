// 注册后自动化第 2 环：在新号会话里启用 Copilot Free（WebBridge 真实 Chrome；/settings 属登录后页面，白名单内）
// 用法: node gh-copilot-enable.mjs   （前置: gh-login-pat.mjs 已成功登录，浏览器会话持有该号 cookie）
// 策略: 导航 /settings/copilot → dump 页面状态 → 点击匹配 free/启用 的按钮 → 复查 dump。找不到就打印原文交人工。
const BASE = 'http://127.0.0.1:10086/command';
const SESSION = 'freeapi-keys';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function wb(action, args = {}) {
  const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, session: SESSION, ...args }), signal: AbortSignal.timeout(120000) });
  const j = await r.json();
  if (!j.ok) throw new Error('WB_FAIL ' + JSON.stringify(j).slice(0, 300));
  return j.data;
}
async function ev(code) { const d = await wb('evaluate', { code }); return d?.value; }
const state = async () => JSON.parse(await ev(`JSON.stringify({href:location.href.slice(0,140),title:document.title,body:document.body?document.body.innerText.slice(0,900):'',btns:[...document.querySelectorAll('button,a.btn,input[type=submit]')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText||b.value).filter(Boolean).slice(0,40)})`));

console.log('=== 1. /settings/copilot ===');
await wb('navigate', { url: 'https://github.com/settings/copilot' });
await sleep(5000);
let s = await state();
console.log('state:', s.href, '|', s.title);
console.log('btns:', JSON.stringify(s.btns));
if (/sign in|login/i.test(s.href)) { console.log('❌ 未登录（先跑 gh-login-pat.mjs）'); process.exit(1); }

console.log('=== 2. 尝试点击 free/enable 按钮 ===');
const clicked = await ev(`(() => {
  const cand = [...document.querySelectorAll('button,a.btn,input[type=submit]')].filter(b => b.getBoundingClientRect().width>0);
  const b = cand.find(x => /^\\s*(i agree|accept|enable(\\s+copilot)?(\\s+free)?|start (free|trial)|get started)\\s*$/i.test(x.innerText || x.value || ''))
         || cand.find(x => /free/i.test(x.innerText || x.value || ''));
  if (!b) return 'NO_BTN';
  b.click(); return 'CLICKED:' + (b.innerText || b.value);
})()`);
console.log('click:', clicked);
await sleep(6000);
s = await state();
console.log('after:', s.href, '|', s.title);
console.log('body@:', s.body.slice(0, 600));
const ok = /copilot/i.test(s.body) && !/plan|billing|payment method/i.test(s.href);
console.log(ok ? '✅ 已到达 Copilot 设置页（请人工核对是否显示 Free plan 生效；本页文本已 dump 供判定）' : '⚠️ 状态不确定，按上方 dump 人工确认');
