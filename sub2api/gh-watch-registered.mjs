// 注册完成守望者：轮询 github.com/<username>，404→200 即注册完成，自动接力 gh-login-pat.mjs
// 用法: node gh-watch-registered.mjs [username] [maxHours]
// 边界：只自动化 signup 之后的环节（/login、PAT），符合 GITHUB-REGISTER-GUIDE §九 白名单。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const user = process.argv[2] || JSON.parse(fs.readFileSync('D:/tdsh/sub2api/gh-register-creds.json', 'utf8')).username;
const maxH = parseFloat(process.argv[3]) || 4;
const deadline = Date.now() + maxH * 3600e3;
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log(`[watch] ${new Date().toISOString()} 守望 ${user}（404=未注册）每60s一次，上限 ${maxH}h（直连+代理7897双路）`);
const curlProbe = (proxy) => {
  const args = ['-s', '-o', 'NUL', '-w', '%{http_code}', '--max-time', '20', '-A', 'Mozilla/5.0'];
  if (proxy) args.push('-x', 'http://127.0.0.1:7897');
  args.push(`https://github.com/${user}`);
  try { return parseInt(execFileSync('curl.exe', args, { encoding: 'utf8' }), 10) || 0; }
  catch (e) { const p = parseInt(String(e.stdout || '').trim(), 10); return Number.isFinite(p) && p > 0 ? p : 0; }
};
while (Date.now() < deadline) {
  let code = curlProbe(false);
  if (!code || code === 0) code = curlProbe(true); // 直连挂/超时 → 走 mihomo 兜底
  else if (code === 404) { const pc = curlProbe(true); if (pc && pc !== 404) code = pc; } // 防直连污染假404：代理意见不同才采信
  if (code === 200) {
    console.log(`[watch] ${new Date().toISOString()} FOUND 200 -> 注册完成，自动接力 gh-login-pat.mjs`);
    try {
      const out = execFileSync('node', ['D:/tdsh/sub2api/gh-login-pat.mjs', 'copilot-pool'], { encoding: 'utf8', timeout: 180000, cwd: 'D:/tdsh/sub2api' });
      console.log('[handoff] gh-login-pat output:\n' + out.slice(0, 2500));
      console.log('[handoff] 接力 2/2: gh-copilot-enable.mjs（启用 Copilot Free）');
      try {
        const out2 = execFileSync('node', ['D:/tdsh/sub2api/gh-copilot-enable.mjs'], { encoding: 'utf8', timeout: 180000, cwd: 'D:/tdsh/sub2api' });
        console.log('[handoff] gh-copilot-enable output:\n' + out2.slice(0, 2500));
      } catch (e2) {
        console.log('[handoff] copilot-enable 失败（转人工核对）：\n' + String(e2.stdout || '').slice(0, 1200) + String(e2.stderr || '').slice(0, 400));
      }
    } catch (e) {
      console.log('[handoff] gh-login-pat 失败（可能需 2FA/人工，退出码 ' + (e.status || '?') + '）：\n' + String(e.stdout || '').slice(0, 1500) + String(e.stderr || '').slice(0, 500));
    }
    process.exit(0);
  }
  if (code !== 404 && code !== 0) console.log(`[watch] unexpected HTTP ${code}, retry next tick`);
  await sleep(60000);
}
console.log('[watch] 守望窗口结束仍未见注册完成');
process.exit(0);
