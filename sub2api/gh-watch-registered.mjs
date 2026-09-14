// 注册完成守望者：轮询 github.com/<username>，404→200 即注册完成，自动接力 gh-login-pat.mjs
// 用法: node gh-watch-registered.mjs [username] [maxHours]
// 边界：只自动化 signup 之后的环节（/login、PAT），符合 GITHUB-REGISTER-GUIDE §九 白名单。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const user = process.argv[2] || JSON.parse(fs.readFileSync('D:/tdsh/sub2api/gh-register-creds.json', 'utf8')).username;
const maxH = parseFloat(process.argv[3]) || 4;
const deadline = Date.now() + maxH * 3600e3;
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log(`[watch] ${new Date().toISOString()} 守望 ${user}（404=未注册）每60s一次，上限 ${maxH}h`);
while (Date.now() < deadline) {
  let code = 0;
  try {
    code = parseInt(execFileSync('curl.exe', ['-s', '-o', 'NUL', '-w', '%{http_code}', '--max-time', '25', '-A', 'Mozilla/5.0', `https://github.com/${user}`], { encoding: 'utf8' }), 10) || 0;
  } catch (e) { console.log('[watch] probe err', String(e.message).slice(0, 80)); }
  if (code === 200) {
    console.log(`[watch] ${new Date().toISOString()} FOUND 200 -> 注册完成，自动接力 gh-login-pat.mjs`);
    try {
      const out = execFileSync('node', ['D:/tdsh/sub2api/gh-login-pat.mjs', 'copilot-pool'], { encoding: 'utf8', timeout: 180000, cwd: 'D:/tdsh/sub2api' });
      console.log('[handoff] gh-login-pat output:\n' + out.slice(0, 2500));
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
