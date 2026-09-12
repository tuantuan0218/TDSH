// CDP：打开 aistudio apikey 页 → 若出现账号选择器则点选第一个账号 → 提取页面 key 信息
const PORT = 9228;
const TARGET = 'https://aistudio.google.com/apikey';
async function newTab(url) { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }); return r.json(); }
let msgId = 0; const pending = new Map();
function wsOpen(ws) { return new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws err')); }); }
function send(ws, method, params = {}) { const id = ++msgId; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
const tab = await newTab(TARGET);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await wsOpen(ws);
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable');
let url = '', title = '';
for (let i = 0; i < 10; i++) {
  await new Promise(r => setTimeout(r, 4000));
  const res = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title,url:location.href,text:(document.body?document.body.innerText:'').slice(0,900)})`, returnByValue: true });
  const v = JSON.parse(res.result.value);
  url = v.url; title = v.title;
  console.log(`[${i}] ${title.slice(0,40)} | ${url.slice(0,80)}`);
  // 账号选择器：点第一个账号（通常 .jUv3nf 或含 data-identifier 的 div）
  if (url.includes('accountchooser')) {
    const click = await send(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const els = document.querySelectorAll('div[data-identifier], li[data-email], div[role="link"], [data-identifier]');
        for (const el of els) { if (el.textContent.includes('@')) { el.click(); return 'CLICKED:' + el.textContent.trim().slice(0,60); } }
        const links = [...document.querySelectorAll('a, div, li')].filter(e => e.textContent.includes('@') && e.textContent.length < 200);
        if (links.length) { links[0].click(); return 'CLICKED2:' + links[0].textContent.trim().slice(0,60); }
        return 'NO_ACCOUNT_EL:' + document.body.innerText.slice(0,200);
      })()`,
      returnByValue: true
    });
    console.log('CHOOSER:', click.result.value);
  }
  // 到了 apikey 页面则读取
  if (url.includes('apikey') && !url.includes('signin') && !url.includes('accountchooser')) {
    const txt = await send(ws, 'Runtime.evaluate', { expression: `document.body.innerText.slice(0,2500)`, returnByValue: true });
    console.log('=== APIKEY PAGE ===');
    console.log(txt.result.value);
    break;
  }
}
ws.close(); process.exit(0);