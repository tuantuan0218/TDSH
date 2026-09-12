// CDP：完整拿 key 流程（9228 克隆 Chrome，cookie 会话有效）
// 1) 导航 aistudio apikey → 到 accountchooser 时 dump 账号并点 juarezalexander554@gmail.com
// 2) 若跳到 challenge/pwd → 记录（说明该账号需密码，尝试用 Edge 保存的 v20 密码注入？先记录）
// 3) 若到达 apikey 页 → 提取页面 key 文本
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
let done = false;
for (let i = 0; i < 16 && !done; i++) {
  await new Promise(r => setTimeout(r, 3500));
  const res = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({title:document.title,url:location.href,text:(document.body?document.body.innerText:'').slice(0,1200)})`, returnByValue: true });
  const v = JSON.parse(res.result.value);
  const u = v.url;
  console.log(`[${i}] ${u.slice(0,90)}`);
  if (u.includes('accountchooser')) {
    const dump = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify([...document.querySelectorAll('[data-identifier]')].map(e => ({id: e.getAttribute('data-identifier'), txt: e.textContent.trim().slice(0,60)})))`, returnByValue: true });
    console.log('  ACCOUNTS:', dump.result.value);
    const click = await send(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const all = [...document.querySelectorAll('[data-identifier]')];
        const target = all.find(e => (e.getAttribute('data-identifier')||'').includes('juarezalexander'));
        const el = target || all[0];
        if (el) { el.click(); return 'CLICKED:' + el.getAttribute('data-identifier'); }
        return 'NONE:' + document.body.innerText.slice(0,200);
      })()`,
      returnByValue: true
    });
    console.log('  CLICK:', click.result.value);
  } else if (u.includes('challenge/pwd')) {
    console.log('  ⚠️ NEED_PASSWORD (challenge/pwd)');
    const txt = await send(ws, 'Runtime.evaluate', { expression: `document.body.innerText.slice(0,500)`, returnByValue: true });
    console.log('  PWD_PAGE:', txt.result.value.slice(0,300).replace(/\n/g,' '));
    done = true;
  } else if (u.includes('apikey') && !u.includes('signin') && !u.includes('accountchooser')) {
    const txt = await send(ws, 'Runtime.evaluate', { expression: `document.body.innerText.slice(0,4000)`, returnByValue: true });
    console.log('=== APIKEY PAGE ===');
    console.log(txt.result.value);
    done = true;
  } else if (u.includes('consent') || u.includes('not_approved')) {
    const txt = await send(ws, 'Runtime.evaluate', { expression: `document.body.innerText.slice(0,600)`, returnByValue: true });
    console.log('CONSENT/其他页:', txt.result.value.slice(0,300));
  }
}
ws.close(); process.exit(0);