// 一键重开 GitHub 注册（清cookies+InPrivate+重备资料+复制密码），把人工摩擦降到最低
// 用法: node gh-signup-retry.mjs [username]
// 背景：本轮 03:0x 用户验证页被系统内存压力杀渲染进程(RESULT_CODE_KILLED)导致 signup 过期；
//       同 IP 短时反复提交会静默限流 → 本脚本开新 InPrivate + 建议换邮箱，引导一次干净重试。
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
const creds = JSON.parse(fs.readFileSync('D:/tdsh/sub2api/gh-register-creds.json', 'utf8'));
const user = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null) || creds.username || 'tuanpool-etm739';
// 1) 复制密码到剪贴板（避免用户手输被截断）
const escaped = creds.password.replace(/'/g, "''");
execSync(`powershell -NoProfile -Command "Set-Clipboard -Value '${escaped}'"`);
console.log('📎 密码已进剪贴板（Ctrl+V 即填）：' + creds.password.length + '字符');
console.log('👤 建议用户名：' + user + '（' + (creds.username_candidates_available || []).join(', ') + ' 备选）');
console.log('✉️  邮箱建议（二选一）：');
console.log('   A. ' + creds.email + '（Gmail，成功率高；需先在 Edge 登录该 Gmail 收码）');
if (creds.email_fallback) console.log('   B. ' + creds.email_fallback + '（临时邮箱，本会话后台自动取码）');
// 2) 新开一个 InPrivate 标签到 signup（--no-browser 只做资料准备，供并行会话安全调用）
if (process.argv.includes('--no-browser')) {
  console.log('ℹ️ --no-browser：跳过开窗（资料/剪贴板已备好，适合已有注册页在手的情况）');
} else try { execFileSync('cmd.exe', ['/c', 'start', 'msedge', '-inprivate', 'https://github.com/signup'], { stdio: 'ignore' }); console.log('✅ 已开 Edge InPrivate → github.com/signup'); }
catch (e) { console.log('⚠️ 自动开浏览器失败，请手动开 InPrivate 访问 github.com/signup：' + String(e.message).slice(0, 60)); }
console.log('\n提示：本机 RAM 紧张(≈78%)曾把上一个验证页渲染进程杀死；重试前建议关掉几个重页/Chrome 标签再走，');
console.log('     人机验证优先切「声音验证」，若同 IP 刚反复提交过，换手机热点或等几分钟再试更稳。');
