// GitHub 注册 CDP 驱动器（Edge 9225 真实 profile）
// 用法: node gh-cdp.mjs <cmd> [args]
//   dump          -> 当前 signup 页状态 + 元素清单 + 截图
//   fill <email> <password> <username> -> 第一步填邮箱，逐步推进
//   shot <name>   -> 仅截图
//   eval <js>     -> 执行表达式
//   url <url>     -> 导航
import { writeFileSync, mkdirSync } from 'node:fs';
const PORT = 9225;
const SHOT_DIR = 'H:/ChromeDebug/gh-register';
mkdirSync(SHOT_DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
let tab = tabs.find(t => t.type === 'page' && /github\.com/.test(t.url)) || tabs.find(t => t.type === 'page');
if (!tab) { console.log('NO_TAB'); process.exit(1); }

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
let msgId = 0; const pending = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id, method, params })); });
await send('Page.enable'); await send('Runtime.enable');

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('JS EXC: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  const p = `${SHOT_DIR}/${name}.png`;
  writeFileSync(p, Buffer.from(s.data, 'base64'));
  return p;
}

const cmd = process.argv[2];

if (cmd === 'url') {
  await send('Page.navigate', { url: process.argv[3] });
  await sleep(4000);
  console.log('NAVIGATED:', await evaluate('location.href'));
} else if (cmd === 'shot') {
  console.log('SHOT:', await shot(process.argv[3] || 'state'));
} else if (cmd === 'eval') {
  console.log(JSON.stringify(await evaluate(process.argv[3])));
} else if (cmd === 'dump') {
  const info = await evaluate(`(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const inputs = [...document.querySelectorAll('input')].filter(vis).map((i,k) => ({k, type:i.type, name:i.name, id:i.id, ph:i.placeholder, val:(i.value||'').slice(0,30), disabled:i.disabled}));
    const btns = [...document.querySelectorAll('button,[role=button]')].filter(vis).map((b,k) => ({k, tag:b.tagName, text:(b.innerText||b.textContent||'').trim().slice(0,40), id:b.id, cls:(b.className||'').toString().slice(0,50), disabled:b.disabled})).filter(b=>b.text||b.id);
    const errs = [...document.querySelectorAll('[class*=error],[role=alert],.flash-error')].filter(vis).map(e=>e.innerText.trim().slice(0,120)).filter(Boolean);
    const iframes = [...document.querySelectorAll('iframe')].map(f=>({src:(f.src||'').slice(0,140), w:Math.round(f.getBoundingClientRect().width), h:Math.round(f.getBoundingClientRect().height)}));
    return JSON.stringify({ href: location.href, title: document.title, step: (document.querySelector('[data-step]')||{}).dataset||null, heading: (document.querySelector('h1')||{}).innerText, inputs, btns, errs, iframes, body: document.body.innerText.slice(0,700) }, null, 1);
  })()`);
  console.log(info);
  console.log('SHOT:', await shot('dump-' + Date.now()));
} else if (cmd === 'step-email') {
  const email = process.argv[3];
  // 填邮箱 -> Continue
  const r1 = await evaluate(`(() => {
    const el = document.querySelector('#user[required][autofocus]') || document.querySelector('input#user') || [...document.querySelectorAll('input[type=email]')][0];
    if (!el) return 'NO_EMAIL_INPUT';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    el.focus(); setter.call(el, ${JSON.stringify(email)});
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
    return 'FILLED:' + el.id + ':' + el.value;
  })()`);
  console.log('R1:', r1);
  await sleep(1200);
  const r2 = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /continue/i.test(x.innerText||'') && !x.disabled);
    if (!b) return 'NO_CONTINUE_BTN';
    b.click(); return 'CLICKED_CONTINUE';
  })()`);
  console.log('R2:', r2);
  await sleep(3500);
  console.log(await evaluate('JSON.stringify({href:location.href, heading:(document.querySelector("h1")||{}).innerText, inputs:[...document.querySelectorAll("input")].filter(i=>i.getBoundingClientRect().width>0).map(i=>({id:i.id,type:i.type,ph:i.placeholder})), body:document.body.innerText.slice(0,500)})'));
  console.log('SHOT:', await shot('step-email'));
} else if (cmd === 'fill-creds') {
  const pw = process.argv[3], user = process.argv[4];
  const r = await evaluate(`(() => {
    const vis = el => el.getBoundingClientRect().width > 0;
    const pwEl = document.querySelector('#password') || [...document.querySelectorAll('input[type=password]')].find(vis);
    const uEl = document.querySelector('#login') || [...document.querySelectorAll('input[type=text]')].filter(vis).find(i=>/login|user/i.test(i.id+i.name+i.placeholder));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const out = [];
    if (pwEl) { pwEl.focus(); setter.call(pwEl, ${JSON.stringify(pw)}); pwEl.dispatchEvent(new Event('input',{bubbles:true})); out.push('pw:'+pwEl.id); }
    if (uEl) { uEl.focus(); setter.call(uEl, ${JSON.stringify(user)}); uEl.dispatchEvent(new Event('input',{bubbles:true})); out.push('user:'+uEl.id); }
    return out.length? 'OK:'+out.join(',') : 'NO_INPUTS';
  })()`);
  console.log('FILL:', r);
  await sleep(1200);
  const c = await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/continue/i.test(x.innerText||'')&&!x.disabled); if(!b) return 'NO_BTN'; b.click(); return 'CLICKED'; })()`);
  console.log('CONT:', c);
  await sleep(4000);
  console.log(await evaluate('JSON.stringify({href:location.href, body:document.body.innerText.slice(0,600), btns:[...document.querySelectorAll("button")].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.innerText.trim().slice(0,40)).slice(0,12)})'));
  console.log('SHOT:', await shot('step-creds'));
} else {
  console.log('unknown cmd');
}
ws.close(); process.exit(0);
