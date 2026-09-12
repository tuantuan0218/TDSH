// CDP：可见 Edge 完整登录流程（填邮箱→下一步→密码页→截图+autofill 尝试）
const PORT = 9227;
const EMAIL = 'dbfilsmdpfh@looglz.com';
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
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
console.log('TAB:', tab.url.slice(0, 80));
await sleep(5000);
// 填邮箱
let r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => { const i = document.querySelector('input[name="identifier"], #identifierId'); if (!i) return 'NO_INPUT:' + location.href; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'${EMAIL}'); i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); return 'FILLED'; })()`,
  returnByValue: true
});
console.log('FILL:', r.result.value);
await sleep(600);
r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => { const b = document.querySelector('#identifierNext') || [...document.querySelectorAll('button')].find(x => x.getAttribute('jsname')==='LgbsSe' || /下一步|继续/.test(x.textContent)); if (b) { b.click(); return 'NEXT'; } return 'NO_BTN'; })()`,
  returnByValue: true
});
console.log('NEXT:', r.result.value);
// 等密码页
for (let i = 0; i < 15; i++) {
  await sleep(3000);
  r = await send(ws, 'Runtime.evaluate', {
    expression: `(() => { const i = document.querySelector('input[type="password"]'); if (!i) return JSON.stringify({u:location.href.slice(0,60), pwd:false}); const b = i.getBoundingClientRect(); return JSON.stringify({u:location.href.slice(0,60), pwd:true, vis:b.width>0, x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.width), h:Math.round(b.height)}); })()`,
    returnByValue: true
  });
  const v = JSON.parse(r.result.value);
  console.log(`[${i}] ${v.u} pwd=${v.pwd} vis=${v.vis}`);
  if (v.pwd && v.vis) {
    // 截图
    const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' });
    const fs = await import('node:fs');
    fs.writeFileSync('D:/tdsh/sub2api/edge_pwd2.png', Buffer.from(shot.data, 'base64'));
    console.log('SHOT_SAVED');
    // 真实点击密码框
    const cx = Math.round(v.x + v.w/2), cy = Math.round(v.y + v.h/2);
    await send(ws, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await send(ws, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    console.log('CLICKED at', cx, cy);
    await sleep(2500);
    // 截图（看 autofill 气泡）
    const shot2 = await send(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/tdsh/sub2api/edge_pwd3.png', Buffer.from(shot2.data, 'base64'));
    console.log('SHOT2_SAVED');
    break;
  }
}
ws.close(); process.exit(0);