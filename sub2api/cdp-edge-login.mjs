// CDP：Google 登录（根地址，宽泛选择器）→ autofill 密码 → 提交
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
await sleep(5000);
// dump 页面找输入框
let r = await send(ws, 'Runtime.evaluate', {
  expression: `JSON.stringify({url:location.href, inputs:[...document.querySelectorAll('input')].map(i=>({type:i.type,name:i.name,id:i.id,placeholder:i.placeholder})).slice(0,10), text:(document.body?document.body.innerText:'').slice(0,300)})`,
  returnByValue: true
});
console.log('PAGE:', r.result.value);
// 填邮箱
r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const inp = document.querySelector('input[type="email"], input[name="identifier"], #identifierId, input[type="text"]');
    if (!inp) return 'NO_INPUT';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '${EMAIL}');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return 'FILLED:' + inp.type;
  })()`,
  returnByValue: true
});
console.log('FILL:', r.result.value);
await sleep(800);
// 点下一步
r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const btns = [...document.querySelectorAll('button, [role="button"], input[type="submit"], [jsname]')];
    const next = btns.find(b => (b.id==='identifierNext') || (b.getAttribute('jsname')==='LgbsSe') || /下一步|继续/.test(b.textContent||'') || b.type==='submit');
    if (next) { next.click(); return 'NEXT:' + (next.id||next.textContent.trim().slice(0,20)); }
    return 'NO_NEXT';
  })()`,
  returnByValue: true
});
console.log('NEXT:', r.result.value);
// 等密码页
for (let i = 0; i < 12; i++) {
  await sleep(3500);
  r = await send(ws, 'Runtime.evaluate', {
    expression: `JSON.stringify({url:location.href, hasPwd:!!document.querySelector('input[type="password"]'), text:(document.body?document.body.innerText:'').slice(0,300)})`,
    returnByValue: true
  });
  const v = JSON.parse(r.result.value);
  console.log(`[${i}] ${v.url.slice(0,70)} hasPwd=${v.hasPwd}`);
  if (v.hasPwd) {
    await send(ws, 'Runtime.evaluate', { expression: `document.querySelector('input[type="password"]').focus()`, returnByValue: true });
    await sleep(2000);
    const af = await send(ws, 'Runtime.evaluate', {
      expression: `JSON.stringify([...document.querySelectorAll('div[role="option"], li[role="option"], [data-password-manager-dropdown], [aria-label*="密码"]')].map(e=>e.textContent.trim().slice(0,60)).filter(Boolean).slice(0,8))`,
      returnByValue: true
    });
    console.log('  AUTOFILL:', af.result.value);
    const clk = await send(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const cands = [...document.querySelectorAll('div[role="option"], li[role="option"], [data-password-manager-dropdown]')];
        const el = cands[0];
        if (el) { el.click(); return 'CLICKED:' + el.textContent.trim().slice(0,50); }
        return 'NONE';
      })()`,
      returnByValue: true
    });
    console.log('  CLICK:', clk.result.value);
    await sleep(1500);
    const pwd = await send(ws, 'Runtime.evaluate', { expression: `document.querySelector('input[type="password"]') ? document.querySelector('input[type="password"]').value.length : -1`, returnByValue: true });
    console.log('  PWD_LEN:', pwd.result.value);
    if (pwd.result.value > 0) {
      await send(ws, 'Runtime.evaluate', {
        expression: `(() => { const b = document.querySelector('#passwordNext') || [...document.querySelectorAll('button')].find(x=>/下一步|继续/.test(x.textContent)); if (b){b.click();return 'SUB';} return 'NO_BTN'; })()`,
        returnByValue: true
      });
      console.log('  SUBMITTED');
    }
    break;
  }
}
ws.close(); process.exit(0);