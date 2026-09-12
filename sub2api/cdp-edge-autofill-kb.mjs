// CDP：键盘导航触发 Edge 密码 autofill（聚焦密码框 → ArrowDown → Enter）
const PORT = 9227;
async function getTabs() { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 找当前在登录页的 tab
const tabs = await getTabs();
const tab = tabs.find(t => t.type === 'page' && t.url.includes('accounts.google.com')) || tabs.find(t => t.type === 'page');
console.log('TAB:', tab.url.slice(0, 90));
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Runtime.enable'); await send(ws, 'Page.enable');
// 1) 聚焦密码框
await send(ws, 'Runtime.evaluate', { expression: `(() => { const i = document.querySelector('input[type="password"]'); if (i) { i.focus(); i.click(); return 'FOCUSED'; } return 'NO_PWD:' + location.href; })()`, returnByValue: true });
await sleep(1200);
// 2) 键盘 ↓ 打开 autofill 下拉
await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 });
await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 });
await sleep(800);
// 3) Enter 选中
await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await sleep(1500);
// 4) 检查密码长度
const r = await send(ws, 'Runtime.evaluate', { expression: `(() => { const i = document.querySelector('input[type="password"]'); return i ? 'PWD_LEN=' + i.value.length : 'NO_PWD_INPUT'; })()`, returnByValue: true });
console.log('RESULT:', r.result.value);
// 5) 若填上了，提交
if (r.result.value.includes('PWD_LEN>')) {
  await send(ws, 'Runtime.evaluate', {
    expression: `(() => { const b = document.querySelector('#passwordNext') || [...document.querySelectorAll('button')].find(x => /下一步|继续/.test(x.textContent)); if (b) { b.click(); return 'SUBMITTED'; } return 'NO_BTN'; })()`,
    returnByValue: true
  });
  console.log('SUBMITTED');
}
ws.close(); process.exit(0);