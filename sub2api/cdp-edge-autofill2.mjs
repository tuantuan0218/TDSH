// CDP：点击可见密码框 → autofill 下拉 → 点已保存账号 → 提交
const PORT = 9227;
async function getTabs() { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tabs = await getTabs();
const tab = tabs.find(t => t.type === 'page' && t.url.includes('challenge/pwd')) || tabs.find(t => t.type === 'page');
console.log('TAB:', tab.url.slice(0, 90));
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Runtime.enable'); await send(ws, 'Page.enable');
// 1) 真实点击密码框中心
let r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => { const i = document.querySelector('input[type="password"]'); if (!i) return 'NO_PWD'; const b = i.getBoundingClientRect(); return JSON.stringify({x: Math.round(b.x + b.width/2), y: Math.round(b.y + b.height/2)}); })()`,
  returnByValue: true
});
const pos = JSON.parse(r.result.value);
console.log('POS:', JSON.stringify(pos));
await send(ws, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
await send(ws, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
console.log('CLICKED');
await sleep(2500);
// 2) dump autofill 下拉（含 shadow DOM）
r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const out = [];
    const seen = new Set();
    const walk = (root) => {
      for (const e of root.querySelectorAll('*')) {
        if (e.shadowRoot) walk(e.shadowRoot);
        const role = e.getAttribute && e.getAttribute('role');
        const cls = e.className && typeof e.className === 'string' ? e.className : '';
        const txt = (e.textContent||'').trim();
        if ((role === 'option' || role === 'menuitem' || /autofill|password-manager|credential/i.test(cls)) && !seen.has(txt) && txt.length > 0 && txt.length < 120) {
          seen.add(txt);
          out.push((role||'cls') + '|' + cls.slice(0,40) + '|' + txt.slice(0,60));
        }
      }
    };
    walk(document);
    return JSON.stringify(out.slice(0,15));
  })()`,
  returnByValue: true
});
console.log('AUTOFILL_OPTIONS:', r.result.value);
// 3) 尝试点击第一个含 @ 的选项
r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const all = [...document.querySelectorAll('*')].filter(e => e.getAttribute && (e.getAttribute('role')==='option' || e.getAttribute('role')==='menuitem'));
    const el = all.find(e => /@/.test(e.textContent) && e.textContent.length < 120);
    if (el) { el.click(); return 'CLICKED:' + el.textContent.trim().slice(0,60); }
    // fallback: 任意 option
    if (all.length) { all[0].click(); return 'CLICKED_FIRST:' + all[0].textContent.trim().slice(0,60); }
    return 'NO_OPTION';
  })()`,
  returnByValue: true
});
console.log('CLICK_OPTION:', r.result.value);
await sleep(2000);
// 4) 检查密码长度 + 提交
r = await send(ws, 'Runtime.evaluate', { expression: `(() => { const i = document.querySelector('input[type="password"]'); return i ? 'PWD_LEN=' + i.value.length : 'NO_INPUT'; })()`, returnByValue: true });
console.log('PWD:', r.result.value);
if (/PWD_LEN=[1-9]/.test(r.result.value)) {
  const sub = await send(ws, 'Runtime.evaluate', {
    expression: `(() => { const b = document.querySelector('#passwordNext') || [...document.querySelectorAll('button')].find(x => /下一步|继续/.test(x.textContent)); if (b) { b.click(); return 'SUBMITTED'; } return 'NO_BTN'; })()`,
    returnByValue: true
  });
  console.log('SUBMIT:', sub.result.value);
}
ws.close(); process.exit(0);