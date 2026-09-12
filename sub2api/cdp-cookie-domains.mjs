// CDP：检查克隆 Chrome (9228) 各域名的 SID cookie 分布
const PORT = 9228;
async function getTabs() { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const tabs = await getTabs();
const tab = tabs.find(t => t.type === 'page') || tabs[0];
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Network.enable');
const { cookies } = await send(ws, 'Network.getAllCookies');
// 按域名分组列出 SID 类关键 cookie
const keys = ['SID','HSID','SSID','SAPISID','APISID','__Secure-1PSID','__Secure-3PSID','__Secure-1PAPISID','OTZ','NID'];
const domains = {};
for (const c of cookies) {
  if (keys.includes(c.name)) {
    if (!domains[c.domain]) domains[c.domain] = [];
    domains[c.domain].push(c.name + '=' + c.value.length);
  }
}
for (const [d, list] of Object.entries(domains)) {
  console.log(d, ':', list.join(' '));
}
console.log('\nTOTAL:', cookies.length);
ws.close(); process.exit(0);