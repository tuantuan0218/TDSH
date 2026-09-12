// CDP：Edge autofill 登录 Google（填邮箱→下一步→触发已保存密码自动填充→提交）
const PORT = 9227;
const EMAIL = 'dbfilsmdpfh@looglz.com';
async function newTab(url) { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tab = await newTab('https://accounts.google.com/v3/signin/identifier?continue=https://aistudio.google.com/apikey');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
await sleep(5000);
// 1) 填邮箱
let r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const inp = document.querySelector('input[type="email"], input[name="identifier"], #identifierId');
    if (!inp) return 'NO_EMAIL_INPUT:' + location.href;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '${EMAIL}');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return 'EMAIL_FILLED';
  })()`,
  returnByValue: true
});
console.log('1)', r.result.value);
await sleep(500);
// 2) 点下一步
r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const btns = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')];
    const next = btns.find(b => /next|下一步|继续/.test(b.textContent) || b.id === 'identifierNext' || b.getAttribute('jsname') === 'LgbsSe');
    if (next) { next.click(); return 'NEXT_CLICKED'; }
    return 'NO_NEXT:' + document.body.innerText.slice(0,150);
  })()`,
  returnByValue: true
});
console.log('2)', r.result.value);
// 3) 等待密码页 + autofill 气泡
let gotPwd = false;
for (let i = 0; i < 10 && !gotPwd; i++) {
  await sleep(3500);
  r = await send(ws, 'Runtime.evaluate', {
    expression: `JSON.stringify({url:location.href, hasPwd: !!document.querySelector('input[type="password"]'), text:(document.body?document.body.innerText:'').slice(0,400)})`,
    returnByValue: true
  });
  const v = JSON.parse(r.result.value);
  console.log(`3.${i}] ${v.url.slice(0,60)} hasPwd=${v.hasPwd}`);
  if (v.hasPwd) {
    // 4) 聚焦密码框，触发 autofill 气泡
    await send(ws, 'Runtime.evaluate', { expression: `document.querySelector('input[type="password"]').focus()`, returnByValue: true });
    await sleep(1500);
    // 查 autofill 气泡/下拉（含已保存账号文本的元素）
    const af = await send(ws, 'Runtime.evaluate', {
      expression: `JSON.stringify([...document.querySelectorAll('div[role="option"], li[role="option"], [data-password-manager-dropdown], div[aria-label*="密码"], div[class*="autofill"], [jsaction*="password"]')].map(e => e.textContent.trim().slice(0,80)).filter(Boolean).slice(0,10))`,
      returnByValue: true
    });
    console.log('  AUTOFILL_CANDS:', af.result.value);
    // 尝试点击任何含账号名/密码管理器的选项
    const clk = await send(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const cands = [...document.querySelectorAll('div[role="option"], li[role="option"], [data-password-manager-dropdown]')];
        const el = cands.find(e => /${EMAIL.slice(0,6)}|密码|Password/i.test(e.textContent));
        if (el) { el.click(); return 'CLICKED:' + el.textContent.trim().slice(0,60); }
        return 'NO_AUTOFILL_EL';
      })()`,
      returnByValue: true
    });
    console.log('  AUTOFILL_CLICK:', clk.result.value);
    gotPwd = true;
  }
}
// 5) 检查密码是否已填，然后提交
await sleep(2000);
r = await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const inp = document.querySelector('input[type="password"]');
    if (!inp) return 'NO_PWD_INPUT';
    return 'PWD_LEN=' + inp.value.length;
  })()`,
  returnByValue: true
});
console.log('4)', r.result.value);
if (r.result.value.includes('PWD_LEN=0')) {
  console.log('⚠️ autofill 未自动填充，需手动/其他方式');
} else if (r.result.value.includes('PWD_LEN>')) {
  // 提交
  await send(ws, 'Runtime.evaluate', { expression: `(document.querySelector('#passwordNext')||[...document.querySelectorAll('button')].find(b=>/下一步|继续/.test(b.textContent))||[...document.querySelectorAll('button')][0]).click()`, returnByValue: true });
  console.log('5) SUBMITTED');
}
ws.close(); process.exit(0);