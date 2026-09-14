// mail.tm 收件箱 GitHub 验证码轮询器
// 用法: node gh-code-poller.mjs <address> <password> [timeoutSec]
// 命中后：打印 CODE=xxxxxxxx 并把码写入 Windows 剪贴板（可直接 Ctrl+V 进 GitHub 表单）
import { execSync } from 'node:child_process';
const API = 'https://api.mail.tm';
const [addr, pass] = [process.argv[2], process.argv[3]];
const deadline = Date.now() + (parseInt(process.argv[4] || '300', 10)) * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!addr || !pass) { console.log('用法: node gh-code-poller.mjs <邮箱> <密码> [秒]'); process.exit(1); }

let tok = null;
for (let i = 0; i < 8 && !tok; i++) {
  try {
    const tokR = await fetch(`${API}/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, password: pass }) });
    tok = await tokR.json();
  } catch { tok = null; }
  if (!tok || !tok.token) { if (tok && tok.token === undefined && !String(tok).includes('Error')) break; await sleep(5000); }
}
if (!tok || !tok.token) { console.log('TOKEN_FAIL', JSON.stringify(tok || {}).slice(0, 200)); process.exit(1); }
const H = { Authorization: `Bearer ${tok.token}` };
console.log('LOGIN_OK', addr, '轮询中…');

while (Date.now() < deadline) {
  try {
    const list = await (await fetch(`${API}/messages`, { headers: H })).json();
    for (const m of list['hydra:member'] || []) {
      const full = await (await fetch(`${API}/messages/${m.id}`, { headers: H })).json();
      const from = (full.from?.address || '').toLowerCase();
      const subj = full.subject || '';
      if (!/github/i.test(from) && !/github/i.test(subj)) continue;
      const body = (full.text || '') + ' ' + (full.html || '').replace(/<[^>]+>/g, ' ');
      const codes = [...new Set((body.match(/\b\d{8}\b/g) || []))];
      console.log(`MAIL from=${from} subj="${subj.slice(0,60)}" codes=${codes.join(',') || 'none'}`);
      if (codes.length) {
        const code = codes[0];
        console.log('CODE=' + code);
        try { execSync(`powershell -NoProfile -Command "Set-Clipboard -Value '${code}'"`); console.log('CODE 已写入剪贴板，直接 Ctrl+V'); } catch (e) { console.log('CLIPBOARD_FAIL', e.message.slice(0, 60)); }
        process.exit(0);
      }
    }
  } catch (e) { console.log('poll err (continue):', String(e.message).slice(0, 80)); }
  await sleep(8000);
}
console.log('TIMEOUT: 未收到 GitHub 邮件（说明该域名被 GitHub 拦或验证未过）');
