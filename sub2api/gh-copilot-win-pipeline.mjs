// Windows 侧 copilot 全自动管线（绕开 Mac，因本机→Mac SSH 全密钥失效）
// 前置：gh-login-pat.mjs 已把新号登录进 WebBridge 会话 'freeapi-keys'（浏览器已持 github.com cookie）
// 链：A 复用登录态→B copilot-api device 授权(同会话自动点)→C 起反代 4141→D 三步门→E 打印入池交接（DB 仍需网关侧）
// 用法: node gh-copilot-win-pipeline.mjs
// 边界：全程不碰 /signup；device 授权属登录态正常操作（MAC-COPILOT-RUNBOOK §0 白名单）。
import fs from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
const WB = 'http://127.0.0.1:10086/command';
const SESSION = 'freeapi-keys';
const COP_BIN = 'D:\\tdsh\\sub2api\\.copilot-local\\node_modules\\.bin\\copilot-api.cmd';
const HOME = 'D:\\tdsh\\sub2api\\.copilot-local\\home';
const TOKEN = HOME + '\\.local\\share\\copilot-api\\github_token';
const PORT = 4141;
const LAN = '192.168.1.8';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wb(action, args = {}) {
  const r = await fetch(WB, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, session: SESSION, ...args }), signal: AbortSignal.timeout(120000) });
  const j = await r.json();
  if (!j.ok) throw new Error('WB_FAIL ' + JSON.stringify(j).slice(0, 250));
  return j.data;
}
async function ev(code) { const d = await wb('evaluate', { code }); return d?.value; }

// A) 确认 WebBridge 已是登录态（用 /settings/tokens 页判断）
console.log('=== A. 校验登录态 ===');
await wb('navigate', { url: 'https://github.com/settings/tokens' });
await sleep(4000);
const who = JSON.parse(await ev(`JSON.stringify({href:location.href.slice(0,120),login:(document.querySelector('meta[name="user-login"]')||{}).content||''})`));
if (/login/.test(who.href) && !who.login) { console.log('❌ 未登录（先跑 gh-login-pat.mjs）'); process.exit(1); }
console.log('logged-in as', who.login || '(via cookie)');

// B) copilot-api device 授权：后台起 auth 拿 code，再在同会话点 /login/device 授权
//    预检(2026-09-15 03:1x)：/login/device 未登录会 302 到 /login?return_to=…（A 步登录门已兜住）；
//    user_code 输入框选择器按 GitHub device-flow 已知结构 best-effort，拿不到码永远打印供人工输
console.log('=== B. device 授权 ===');
try { fs.unlinkSync(TOKEN); } catch {}
const env = { ...process.env, USERPROFILE: HOME, APPDATA: HOME + '\\appdata', NO_COLOR: '1' };
const auth = spawn(COP_BIN, ['auth', '--no-open'], { env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
let buf = ''; auth.stdout.on('data', d => buf += d); auth.stderr.on('data', d => buf += d);
let code = null;
for (let i = 0; i < 40 && !code; i++) { await sleep(500); const m = buf.match(/\b[0-9A-Z]{4}-[0-9A-Z]{4}\b/); if (m) code = m[0]; }
if (!code) { console.log('❌ 没拿到 device code：', buf.slice(0, 300)); auth.kill(); process.exit(2); }
console.log('device code =', code, '→ 在已登录会话里授权');
await wb('navigate', { url: 'https://github.com/login/device' });
await sleep(4000);
const filled = await ev(`(() => {
  const i = document.querySelector('input[name="user_code"], input[maxlength="9"], #device_code, input.js-activate-device-code, form input[type=text]');
  if (!i) return 'NO_CODE_INPUT:'+document.body.innerText.slice(0,120);
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  i.focus(); set.call(i, ${JSON.stringify(code)}); i.dispatchEvent(new Event('input',{bubbles:true}));
  const b = [...document.querySelectorAll('input[type=submit],button')].find(x=>/authorize|continue/i.test(x.value||x.innerText||''));
  if (b) b.click();
  return 'SUBMITTED';
})()`);
console.log('device form:', filled);
await sleep(5000);
// 若二次确认（点 Continue 后再 Authorize）
const confirm = await ev(`(() => { const b=[...document.querySelectorAll('input[type=submit],button')].find(x=>/authorize\\s+i?\\s?device|authorize/i.test(x.value||x.innerText||'')); if(b){b.click();return 'CONFIRMED';} return 'NO_SECOND_BTN:'+document.body.innerText.slice(0,140); })()`);
console.log('confirm:', confirm);
auth.unref();
let tokWait = 0;
while (tokWait < 90000) { await sleep(3000); tokWait += 3000; if (fs.existsSync(TOKEN) && fs.statSync(TOKEN).size > 20) { console.log('✅ token 落盘 size=' + fs.statSync(TOKEN).size); break; } }
if (!fs.existsSync(TOKEN) || fs.statSync(TOKEN).size < 20) { console.log('❌ token 未落盘（授权可能失败/需人工二次确认），auth 输出尾部：', buf.slice(-400)); auth.kill(); process.exit(3); }
try { auth.kill(); } catch {}

// C) 起反代 4141（兜底限速 5）
console.log('=== C. 起反代 :4141 ===');
const srv = spawn(COP_BIN, ['start', '--port', String(PORT), '--rate-limit', '5', '--wait'], { env, shell: true, stdio: 'ignore' });
srv.unref();
let up = 0, ok = false;
while (up < 40000) { await sleep(2000); up += 2000; try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(4000) }); if (r.status === 200) { ok = true; break; } } catch {} }
if (!ok) { console.log('❌ 反代未起'); srv.kill(); process.exit(4); }
const models = await (await fetch(`http://127.0.0.1:${PORT}/v1/models`)).json();
const MID = (models.data || [])[0]?.id;
console.log('✅ models 200, count=', (models.data || []).length, '首个=', MID);

// D) 三步门：models 200（已过）→ chat 有内容 → 知识门 17×23=391
console.log('=== D. 三步门 ===');
const chat = await (await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model: MID, messages: [{ role: 'user', content: '只回答数字：17乘以23等于多少？' }], max_tokens: 20 }),
  signal: AbortSignal.timeout(30000),
})).json().catch(e => ({ err: String(e.message) }));
const txt = (chat.choices?.[0]?.message?.content || '');
const pass391 = /391/.test(txt);
console.log('chat:', JSON.stringify(txt).slice(0, 120), '| 知识门391:', pass391 ? 'PASS' : 'FAIL');
if (!pass391) { console.log('❌ 三步门未过，拒绝交接（fail-closed）'); srv.kill(); process.exit(5); }

// E) 入池交接（DB 在网关侧，本机 SSH 断；打印 SQL/base_url 供网关或恢复后执行）
const base = `http://${LAN}:${PORT}/v1`;
console.log('=== E. 三步门全过 → 可入池 ===');
console.log('base_url(网关在 Mac 可回连本机 LAN):', base);
console.log('model_mapping Tuan =', MID);
fs.writeFileSync('D:/tdsh/sub2api/gh-copilot-win-ready.json', JSON.stringify({ base, model: MID, at: new Date().toISOString(), srv_pid: srv.pid }, null, 2));
console.log('✅ 已写 gh-copilot-win-ready.json；反代常驻 pid=', srv.pid);
console.log('入池 SQL 与 outbox 事件由网关侧执行（Mac 恢复后跑 copilot-pool.sh，或用 admin API key 走 REST）');
process.exit(0);
