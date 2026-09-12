// CDP：真实鼠标点击密码框 → 触发浏览器 autofill → dump 含 shadow DOM 的选项
const PORT = 9227;
async function getTabs() { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tabs = await getTabs();
const tab = tabs.find(t => t.type === 'page' && t.url.includes('accounts.google.com')) || tabs.find(t => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Runtime.enable'); await send(ws, 'Page.enable');
// 获取密码框位置并真实点击
const r1 = await send(ws, 'Runtime.evaluate', {
  expression: `(() => { const i = document.querySelector('input[type="password"]'); if (!i) return 'NO_PWD'; const r = i.getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2}); })()`,
  returnByValue: true
});
console.log('PWD_POS:', r1.result.value);
if (r1.result.value !== 'NO_PWD') {
  const pos = JSON.parse(r1.result.value);
  await send(ws, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await send(ws, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  console.log('CLICKED');
  await sleep(2000);
  // dump 所有可见元素文本（含 shadow root），找密码填充项
  const dump = await send(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const out = [];
      const walk = (root) => {
        const els = root.querySelectorAll('*');
        for (const e of els) {
          if (e.shadowRoot) walk(e.shadowRoot);
          const txt = (e.textContent||'').trim();
          const role = e.getAttribute && e.getAttribute('role');
          if (role === 'option' || /password|密码|Passwords/i.test(txt) && txt.length < 100) {
            out.push((role||'') + '|' + txt.slice(0,80));
          }
        }
      };
      walk(document);
      return JSON.stringify(out.slice(0,20));
    })()`,
    returnByValue: true
  });
  console.log('OPTIONS:', dump.result.value);
}
ws.close(); process.exit(0);