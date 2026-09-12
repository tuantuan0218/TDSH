// CDP：完整登录流程 + 截图诊断（邮箱→下一步→密码页）
const PORT = 9227;
const EMAIL = 'dbfilsmdpfh@looglz.com';
async function newTab(url) { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tab = await newTab('https://accounts.google.com/');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
await sleep(6000);
// 填邮箱
let r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => { const i = document.querySelector('input[name="identifier"], #identifierId'); if (!i) return 'NO_INPUT:' + location.href; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'${EMAIL}'); i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); return 'FILLED'; })()`,
  returnByValue: true
});
console.log('FILL:', r.result.value);
await sleep(500);
// 点下一步
r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => { const b = document.querySelector('#identifierNext') || [...document.querySelectorAll('button')].find(x => x.getAttribute('jsname')==='LgbsSe' || /下一步|继续/.test(x.textContent)); if (b) { b.click(); return 'NEXT'; } return 'NO_BTN:' + document.body.innerText.slice(0,150); })()`,
  returnByValue: true
});
console.log('NEXT:', r.result.value);
// 轮询直到密码框可见
let pwdVisible = false;
for (let i = 0; i < 15; i++) {
  await sleep(3000);
  r = await send(ws, 'Runtime.evaluate', {
    expression: `(() => { const i = document.querySelector('input[type="password"]'); if (!i) return JSON.stringify({url:location.href, pwd:false}); const r = i.getBoundingClientRect(); const vis = r.width > 0 && r.height > 0; return JSON.stringify({url:location.href, pwd:true, vis, x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height)}); })()`,
    returnByValue: true
  });
  console.log(`[${i}]`, r.result.value);
  const v = JSON.parse(r.result.value);
  if (v.pwd && v.vis) { pwdVisible = true; break; }
}
// 若密码框可见：截图留证
if (pwdVisible) {
  await send(ws, 'Page.captureScreenshot', { format: 'png' }).then(async (shot) => {
    const fs = await import('node:fs');
    fs.writeFileSync('D:/tdsh/sub2api/edge_pwd_page.png', Buffer.from(shot.data, 'base64'));
    console.log('SCREENSHOT_SAVED');
  });
}
ws.close(); process.exit(0);