// Kimi WebBridge (127.0.0.1:10086) 通用调用器 —— 用 node fetch 直连，避开 PowerShell 引号地狱
// 用法: node gh-wb.mjs <action> '<json-args>'   (args 里可含 session/url/code 等)
const BASE = 'http://127.0.0.1:10086/command';
const action = process.argv[2];
let extra = {};
try { if (process.argv[3]) extra = JSON.parse(process.argv[3]); } catch (e) { console.log('BAD_JSON', e.message); process.exit(1); }
const body = { action, session: 'freeapi-keys', ...extra };
const r = await fetch(BASE, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(120000),
});
const txt = await r.text();
console.log('HTTP', r.status);
try {
  const j = JSON.parse(txt);
  if (j.ok && j.data && typeof j.data.value === 'string') {
    console.log('VALUE:', j.data.value);
  } else {
    console.log(JSON.stringify(j).slice(0, 3000));
  }
} catch { console.log(txt.slice(0, 3000)); }
