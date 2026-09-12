// CDP 打开 Google 账号页检查登录态（端口 9227——原 profile 重启的 Edge）
const PORT = 9227;
const TARGET = process.argv[2] || 'https://accounts.google.com/';
async function newTab(url) { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const tab = await newTab(TARGET);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
await new Promise(r => setTimeout(r, 8000));
const res = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title, url:location.href, text:(document.body?document.body.innerText:'').slice(0,900)})`, returnByValue: true });
console.log('RESULT:', res.result.value);
ws.close(); process.exit(0);