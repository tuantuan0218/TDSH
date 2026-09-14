// WebBridge 截图并落盘（用于人工/OCR 复核拦截页形态）
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:10086/command';
const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'screenshot', session: process.argv[2] || 'freeapi-keys' }), signal: AbortSignal.timeout(120000) });
const j = await r.json();
const b64 = j?.data?.screenshot || j?.data?.image || j?.data?.base64 || (typeof j?.data === 'string' ? j.data : null) || j?.data?.value;
if (!b64) { console.log('NO_IMG KEYS:', Object.keys(j?.data || j).join(','), JSON.stringify(j).slice(0, 300)); process.exit(1); }
const raw = b64.startsWith('data:') ? b64.split(',')[1] : b64;
const out = 'H:/ChromeDebug/gh-register/wb-' + Date.now() + '.png';
fs.writeFileSync(out, Buffer.from(raw, 'base64'));
console.log('SAVED', out, fs.statSync(out).size, 'bytes');
