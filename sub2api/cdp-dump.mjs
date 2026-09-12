// CDP 驱动（原生 WebSocket）：打开目标 URL，dump 标题+URL+文本判断登录态
const PORT = 9225;
const TARGET = process.argv[2] || 'https://accounts.google.com/';

async function newTab(url) {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return r.json();
}

let msgId = 0;
const pending = new Map();
function wsOpen(ws) {
  return new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws error')); });
}
function cdpSend(ws, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const tab = await newTab(TARGET);
console.log('TAB:', tab.id, '|', tab.url);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
};
await cdpSend(ws, 'Page.enable');
await cdpSend(ws, 'Runtime.enable');
await new Promise(r => setTimeout(r, 9000));
const evalRes = await cdpSend(ws, 'Runtime.evaluate', {
  expression: `JSON.stringify({ title: document.title, url: location.href, text: (document.body?document.body.innerText:'').slice(0,1500) })`,
  returnByValue: true
});
console.log('RESULT:', evalRes.result.value);
ws.close();
process.exit(0);