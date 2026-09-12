// CDP 列出目标实例的 google.com cookies，判断登录态是否复制成功
const PORT = process.env.CDP_PORT || 9226;
async function getTabs() { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
const tabs = await getTabs();
const tab = tabs.find(t => t.type === 'page') || tabs[0];
console.log('TAB:', tab.url);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Network.enable');
const { cookies } = await send(ws, 'Network.getAllCookies');
const google = cookies.filter(c => c.domain.includes('google'));
console.log('TOTAL_COOKIES:', cookies.length, '| GOOGLE_COOKIES:', google.length);
const keyNames = ['SID', 'HSID', 'SSID', 'SAPISID', 'APISID', '__Secure-1PSID', '__Secure-3PSID', 'OTZ', 'NID'];
for (const k of keyNames) {
  const hit = google.find(c => c.name === k);
  console.log(`${k}: ${hit ? 'PRESENT len=' + hit.value.length + ' domain=' + hit.domain + ' path=' + hit.path : 'absent'}`);
}
ws.close();
process.exit(0);