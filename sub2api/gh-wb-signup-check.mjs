// 用 Kimi WebBridge（真实 Chrome + 扩展，非调试端口启动）探 GitHub signup 是否渲染真实表单
const BASE = 'http://127.0.0.1:10086/command';
const SESSION = process.argv[2] || 'freeapi-keys';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wb(action, args = {}) {
  const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, session: SESSION, ...args }), signal: AbortSignal.timeout(120000) });
  return await r.json();
}
const url = process.argv[3] || 'https://github.com/signup';
const nav = await wb('navigate', { url });
console.log('NAV:', JSON.stringify(nav).slice(0, 200));
await sleep(9000);
const probe = await wb('evaluate', {
  code: `(() => {
    const vis = el => el.getBoundingClientRect().width > 0;
    return JSON.stringify({
      href: location.href.slice(0, 120),
      title: document.title,
      inputs: [...document.querySelectorAll('input')].filter(vis).map(i => ({ id: i.id, type: i.type, ph: i.placeholder })),
      btns: [...document.querySelectorAll('button')].filter(vis).map(b => (b.innerText || '').trim().slice(0, 25)).filter(Boolean).slice(0, 8),
      dd: !!document.querySelector('iframe[src*="captcha-delivery"]'),
      cf: !!document.querySelector('iframe[src*="challenges.cloudflare"]'),
      h1: (document.querySelector('h1') || {}).innerText || '',
      body: document.body.innerText.slice(0, 300)
    });
  })()`
});
console.log('PROBE:', probe?.data?.value || JSON.stringify(probe).slice(0, 600));
