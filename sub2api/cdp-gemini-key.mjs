// CDP 打开 Gemini AI Studio API Key 页面，检查登录态并尝试拿 key
const PORT = 9228;
const TARGET = 'https://aistudio.google.com/apikey';
async function newTab(url) { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const tab = await newTab(TARGET);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
// 等页面加载 + 可能的登录重定向
for (let i = 0; i < 6; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const res = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title, url:location.href, text:(document.body?document.body.innerText:'').slice(0,1200)})`, returnByValue: true });
  const v = JSON.parse(res.result.value);
  console.log(`[${i}] ${v.title} | ${v.url.slice(0,80)}`);
  if (v.url.includes('apikey') && !v.url.includes('signin')) { console.log('TEXT:', v.text.slice(0, 1200)); break; }
}
ws.close(); process.exit(0);