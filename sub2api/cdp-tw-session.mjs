// CDP：验证克隆 Chrome 的 .google.com.tw 会话有效性，再访问 accounts.google.com 看识别
const PORT = 9228;
async function newTab(url) { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tab = await newTab('https://www.google.com.tw/');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
await sleep(6000);
let r = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title,url:location.href,text:(document.body?document.body.innerText:'').slice(0,500)})`, returnByValue: true });
let v = JSON.parse(r.result.value);
console.log('TW:', v.title, '|', v.url.slice(0,70));
console.log('TEXT:', v.text.slice(0,300));
// 是否有账号头像
r = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify([...document.querySelectorAll('a[aria-label*="Google 账号"], a[aria-label*="Account"], img[alt*="Google"]')].map(e=>e.getAttribute('aria-label')||e.getAttribute('alt')||'').slice(0,3))`, returnByValue: true });
console.log('AVATAR:', r.result.value);
// 尝试导航 accounts.google.com 看识别
await send(ws, 'Page.navigate', { url: 'https://accounts.google.com/' });
await sleep(6000);
r = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title,url:location.href,text:(document.body?document.body.innerText:'').slice(0,400)})`, returnByValue: true });
v = JSON.parse(r.result.value);
console.log('ACCOUNTS:', v.title, '|', v.url.slice(0,80));
console.log('TEXT:', v.text.slice(0,300));
ws.close(); process.exit(0);