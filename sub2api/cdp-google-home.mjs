// CDP：先访问 google.com 主页确认活跃账号，再跳 aistudio apikey
const PORT = 9228;
async function newTab(url) { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const tab = await newTab('https://www.google.com/');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
await new Promise(r => setTimeout(r, 6000));
const res = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title,url:location.href,text:(document.body?document.body.innerText:'').slice(0,600)})`, returnByValue: true });
const v = JSON.parse(res.result.value);
console.log('GOOGLE:', v.title, '|', v.url.slice(0,80));
console.log('TEXT:', v.text.slice(0,400));
// 若有账号头像按钮（gb_A），点击看账号菜单
const acc = await send(ws, 'Runtime.evaluate', { expression: `(() => { const b = document.querySelector('a[aria-label*="Google 账号"], a[aria-label*="Account"], img[alt*="Google"]'); if (b) { b.click(); return 'CLICKED_AVATAR'; } return 'NO_AVATAR:' + document.body.innerText.includes('登录') ? 'logged_out' : 'unknown'; })()`, returnByValue: true });
console.log('AVATAR:', acc.result.value);
await new Promise(r => setTimeout(r, 3000));
const acc2 = await send(ws, 'Runtime.evaluate', { expression: `document.body.innerText.slice(0,800)`, returnByValue: true });
console.log('AFTER_AVATAR:', acc2.result.value.slice(0,500));
ws.close(); process.exit(0);