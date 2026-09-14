// 注册完成守望者：轮询一个或多个 github.com/<username>，404→200 即注册完成，自动接力 gh-login-pat.mjs
// 用法: node gh-watch-registered.mjs "user1,user2,..." [maxHours]
// 边界：只自动化 signup 之后的环节（/login、PAT），符合 GITHUB-REGISTER-GUIDE §九 白名单。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const users = (process.argv[2] || JSON.parse(fs.readFileSync('D:/tdsh/sub2api/gh-register-creds.json', 'utf8')).username).split(',').map(s => s.trim()).filter(Boolean);
const maxH = parseFloat(process.argv[3]) || 4;
const deadline = Date.now() + maxH * 3600e3;
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log(`[watch] ${new Date().toISOString()} 守望 [${users.join(', ')}]（404=未注册）每60s一轮，上限 ${maxH}h（直连+代理7897双路）`);
const curlProbe = (user, proxy) => {
  const args = ['-s', '-o', 'NUL', '-w', '%{http_code}', '--max-time', '20', '-A', 'Mozilla/5.0'];
  if (proxy) args.push('-x', 'http://127.0.0.1:7897');
  args.push(`https://github.com/${user}`);
  try { return parseInt(execFileSync('curl.exe', args, { encoding: 'utf8' }), 10) || 0; }
  catch (e) { const p = parseInt(String(e.stdout || '').trim(), 10); return Number.isFinite(p) && p > 0 ? p : 0; }
};
const probeUser = (user) => {
  let code = curlProbe(user, false);
  if (!code || code === 0) code = curlProbe(user, true);
  else if (code === 404) { const pc = curlProbe(user, true); if (pc && pc !== 404) code = pc; }
  return code;
};
let hit = null;
while (Date.now() < deadline && !hit) {
  for (const user of users) {
    const code = probeUser(user);
    if (code === 200) { hit = user; break; }
    if (code !== 404 && code !== 0) console.log(`[watch] ${user} unexpected HTTP ${code}, retry next tick`);
  }
  if (!hit) await sleep(60000);
}
{
  const user = hit;
  if (user) {
    try {
      const CREDS = 'D:/tdsh/sub2api/gh-register-creds.json';
      const c0 = JSON.parse(fs.readFileSync(CREDS, 'utf8'));
      c0.username_registered = user; c0.registered_at = new Date().toISOString();
      if (user !== c0.username) { c0.username_history = [...new Set([...(c0.username_history || []), c0.username])]; c0.username = user; }
      fs.writeFileSync(CREDS, JSON.stringify(c0, null, 2));
    } catch (e) { console.log('[watch] creds 回写失败（不阻断）', String(e.message).slice(0, 80)); }
    console.log(`[watch] ${new Date().toISOString()} FOUND 200 -> 注册完成，自动接力 gh-login-pat.mjs`);
    try {
      const out = execFileSync('node', ['D:/tdsh/sub2api/gh-login-pat.mjs', 'copilot-pool'], { encoding: 'utf8', timeout: 180000, cwd: 'D:/tdsh/sub2api' });
      console.log('[handoff] gh-login-pat output:\n' + out.slice(0, 2500));
      console.log('[handoff] 接力 2/3: gh-copilot-enable.mjs（启用 Copilot Free）');
      try {
        const out2 = execFileSync('node', ['D:/tdsh/sub2api/gh-copilot-enable.mjs'], { encoding: 'utf8', timeout: 180000, cwd: 'D:/tdsh/sub2api' });
        console.log('[handoff] gh-copilot-enable output:\n' + out2.slice(0, 2500));
      } catch (e2) {
        console.log('[handoff] copilot-enable 失败（转人工核对）：\n' + String(e2.stdout || '').slice(0, 1200) + String(e2.stderr || '').slice(0, 400));
      }
      console.log('[handoff] 接力 3/3: gh-copilot-win-pipeline.mjs（device 授权→反代 4141→三步门→入池就绪）');
      try {
        const out3 = execFileSync('node', ['D:/tdsh/sub2api/gh-copilot-win-pipeline.mjs'], { encoding: 'utf8', timeout: 300000, cwd: 'D:/tdsh/sub2api' });
        console.log('[handoff] win-pipeline output:\n' + out3.slice(0, 3000));
      } catch (e3) {
        console.log('[handoff] win-pipeline 失败（fail-closed 属正常拦截，看尾部判断）：\n' + String(e3.stdout || '').slice(-1500) + String(e3.stderr || '').slice(0, 400));
      }
    } catch (e) {
      console.log('[handoff] gh-login-pat 失败（可能需 2FA/人工，退出码 ' + (e.status || '?') + '）：\n' + String(e.stdout || '').slice(0, 1500) + String(e.stderr || '').slice(0, 500));
    }
    process.exit(0);
  }
}
console.log('[watch] 守望窗口结束仍未见注册完成');
process.exit(0);
