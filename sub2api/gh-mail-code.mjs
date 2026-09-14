// 从真实 Edge profile（9225，直连，Google 会话存活）读 GitHub 验证邮件里的 8 位码
// 用法: node gh-mail-code.mjs [waitSeconds]
const CDP = 9225;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitS = parseInt(process.argv[2] || '0', 10);

const tabs = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
let tab = tabs.find(t => t.type === 'page' && /mail\.google\.com/.test(t.url)) || tabs.find(t => t.type === 'page');
if (!tab) { console.log('NO_TAB — 请先在真实 profile 里开一个标签页'); process.exit(1); }
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable');

// 用 Gmail 搜索 URL 直接定位 GitHub 验证码邮件（绕开 SPA 点击）
const q = encodeURIComponent('from:notifications@github.com 验证');
async function search() {
  await send('Page.navigate', { url: `https://mail.google.com/mail/u/0/#search/${q}` });
  await sleep(9000);
  return await ev(`JSON.stringify({href:location.href.slice(0,140), body:document.body.innerText.slice(0,1500)})`);
}
let out = await search();
let tries = 0;
while (waitS > 0 && tries * 15 < waitS) {
  const codes = (out.body || '').match(/\b\d{8}\b/g);
  if (codes && codes.length) break;
  await sleep(15000); tries++;
  out = await search();
}
console.log('SEARCH RESULT:', JSON.stringify(out).slice(0, 2200));
const codes = ((JSON.parse(out).body) || '').match(/\b\d{8}\b/g);
console.log('CODES_FOUND:', codes ? [...new Set(codes)].join(',') : 'NONE');
ws.close(); process.exit(0);
