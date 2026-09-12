// CDP：诊断密码页——列出所有 password 类型输入 + 截图
const PORT = 9227;
async function getTabs() { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const tabs = await getTabs();
const tab = tabs.find(t => t.type === 'page' && t.url.includes('challenge')) || tabs.find(t => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Runtime.enable'); await send(ws, 'Page.enable');
const r = await send(ws, 'Runtime.evaluate', {
  expression: `JSON.stringify({
    url: location.href.slice(0, 100),
    pwdInputs: [...document.querySelectorAll('input[type="password"], input[type="text"][name*="Passwd"]')].map(i => {
      const b = i.getBoundingClientRect();
      return {name: i.name, id: i.id, type: i.type, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), vis: b.width > 0 && b.height > 0};
    }),
    text: (document.body?document.body.innerText:'').slice(0, 400)
  })`,
  returnByValue: true
});
console.log('DIAG:', r.result.value);
const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' });
const fs = await import('node:fs');
fs.writeFileSync('D:/tdsh/sub2api/edge_diag.png', Buffer.from(shot.data, 'base64'));
console.log('SHOT_SAVED');
ws.close(); process.exit(0);