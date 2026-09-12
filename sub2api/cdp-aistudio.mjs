// CDP：直接导航 aistudio apikey（不带 continue），逐步观察跳转与登录态
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
let last = '';
for (let i = 0; i < 12; i++) {
  await new Promise(r => setTimeout(r, 4000));
  const res = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title,url:location.href,text:(document.body?document.body.innerText:'').slice(0,1000)})`, returnByValue: true });
  const v = JSON.parse(res.result.value);
  const sig = v.url + '|' + v.title.slice(0,30);
  if (sig !== last) { console.log(`[${i}] ${v.title.slice(0,40)} | ${v.url.slice(0,90)}`); last = sig; }
  if (v.url.includes('apikey') && !v.url.includes('signin') && !v.url.includes('accountchooser') && !v.url.includes('challenge')) {
    console.log('=== APIKEY TEXT ===');
    console.log(v.text.slice(0, 3000));
    break;
  }
  if (v.url.includes('challenge/pwd') || v.url.includes('signin')) {
    console.log('NEED_AUTH at:', v.url.slice(0, 100));
  }
}
ws.close(); process.exit(0);