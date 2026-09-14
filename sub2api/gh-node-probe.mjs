// 浏览器级节点探测：切换 mihomo 出口 -> Edge(9226, 代理7898) 打开 github.com/signup -> 判定是否出真实表单
// 用法: node gh-node-probe.mjs [nodeCount]
const CTRL = 'http://127.0.0.1:9098';
const CH = { Authorization: 'Bearer ghscan' };
const CDP = 9226;
const GROUP = '三毛机场';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const group = await (await fetch(`${CTRL}/proxies/${encodeURIComponent(GROUP)}`, { headers: CH })).json();
let nodes = (group.all || []).filter(n => n !== '♻️ 自动选择');
// 优先级：非 HK/非 IPv6-only 优先（HK 段被 DataDome 拉黑概率高）
const prio = n => {
  if (/香港|HK/i.test(n)) return 5;
  if (/IPv6/.test(n)) return 4;
  if (/美国|洛杉矶|堪萨斯|US/i.test(n)) return 0;
  if (/日本|东京|JP/i.test(n)) return 1;
  if (/新加坡|SG/i.test(n)) return 1;
  if (/德国|法国|英国|荷兰|加拿大|台湾|韩国|DE|FR|GB|CA/i.test(n)) return 2;
  return 3;
};
nodes = nodes.sort((a, b) => prio(a) - prio(b));
const LIMIT = parseInt(process.argv[2] || '12', 10);

const tabs = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
const tab = tabs.find(t => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable');

const results = [];
for (const node of nodes.slice(0, LIMIT)) {
  let egress = '?', code = '?', form = false, dd = false;
  try {
    await fetch(`${CTRL}/proxies/${encodeURIComponent(GROUP)}`, { method: 'PUT', headers: { ...CH, 'content-type': 'application/json' }, body: JSON.stringify({ name: node }) });
    await sleep(900);
    await send('Page.navigate', { url: 'https://ipinfo.io/json' });
    await sleep(4000);
    egress = await ev(`(() => { try { const j = JSON.parse(document.body.innerText); return j.ip + ' ' + j.country + '/' + j.city; } catch(e){ return 'EGRESS_FAIL'; } })()`);
    await send('Page.navigate', { url: 'https://github.com/signup' });
    await sleep(7000);
    const probe = JSON.parse(await ev(`JSON.stringify({
      hasEmailInput: !!document.querySelector('input#user, input[name*=user], input[type=email]'),
      h1: (document.querySelector('h1')||{}).innerText || '',
      dd: !!document.querySelector('iframe[src*="captcha-delivery"]'),
      hc: !!document.querySelector('[type=hidden][name*=turnstile], iframe[src*="challenges.cloudflare"]'),
      href: location.href, title: document.title
    })`));
    form = probe.hasEmailInput; dd = probe.dd;
    code = probe.dd ? 'DATADOME' : (form ? 'FORM_OK' : 'NO_FORM:' + (probe.h1 || probe.title || '').slice(0, 20));
    console.log(`${(form ? '✅ FORM ' : (dd ? '🚫 DD   ' : '⚠️  ?   '))} ${node.padEnd(28)} egress=${String(egress).padEnd(30)} ${code}`);
    results.push({ node, egress, form, dd, code });
    if (form) { console.log('\n>>> 找到可用出口，停止扫描 <<<'); break; }
  } catch (e) { console.log(`FAIL ${node}: ${e.message.slice(0, 60)}`); results.push({ node, egress, form, dd, code: 'ERR' }); }
}
console.log('\n===== SUMMARY =====');
console.log('FORM_OK:', results.filter(r => r.form).map(r => `${r.node} (${r.egress})`).join(', ') || 'NONE');
import('node:fs').then(fs => fs.writeFileSync('D:/tdsh/sub2api/ghproxy/probe.json', JSON.stringify(results, null, 1)));
ws.close(); process.exit(0);
