// CDP：账号选择器 → 明确点击 juarezalexander554@gmail.com（避开已退出的 dbfilsmdpfh）
const PORT = 9228;
async function newTab(url) { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const tab = await newTab('https://accounts.google.com/v3/signin/accountchooser?continue=https://aistudio.google.com/apikey');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
await new Promise(r => setTimeout(r, 5000));
// dump 选择器账号列表
const dump = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify([...document.querySelectorAll('[data-identifier]')].map(e => ({id: e.getAttribute('data-identifier'), txt: e.textContent.trim().slice(0,80)})))`, returnByValue: true });
console.log('ACCOUNTS:', dump.result.value);
// 点击 juarezalexander554@gmail.com
const click = await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const target = [...document.querySelectorAll('[data-identifier]')].find(e => e.getAttribute('data-identifier').includes('juarezalexander554'));
    if (target) { target.click(); return 'CLICKED'; }
    return 'NOT_FOUND:' + document.body.innerText.slice(0,300);
  })()`,
  returnByValue: true
});
console.log('CLICK:', click.result.value);
// 跟踪后续跳转
for (let i = 0; i < 8; i++) {
  await new Promise(r => setTimeout(r, 4000));
  const res = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title,url:location.href,text:(document.body?document.body.innerText:'').slice(0,600)})`, returnByValue: true });
  const v = JSON.parse(res.result.value);
  console.log(`[${i}] ${v.title.slice(0,30)} | ${v.url.slice(0,75)}`);
  if (v.url.includes('apikey') && !v.url.includes('signin')) {
    const txt = await send(ws, 'Runtime.evaluate', { expression: `document.body.innerText.slice(0,3000)`, returnByValue: true });
    console.log('=== APIKEY PAGE ==='); console.log(txt.result.value);
    break;
  }
}
ws.close(); process.exit(0);