// 用户名无关的注册探测：search API 找最近 N 分钟新建的 tuan* GitHub 号（兜底守望名单漏网）
// 用法: node gh-recent-users.mjs [minutes] [q]
import { execSync } from 'node:child_process';
const mins = parseInt(process.argv[2] || '30', 10);
const q = process.argv[3] || 'tuan';
const since = new Date(Date.now() - mins * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
const url = `https://api.github.com/search/users?q=${q}+created:%3E${encodeURIComponent(since)}&sort=created&order=desc&per_page=20`;
const j = JSON.parse(execSync(`curl.exe -s --max-time 25 -A probe -H "accept: application/vnd.github+json" "${url.replace(/"/g, '\\"')}"`, { encoding: 'utf8', maxBuffer: 5e6 }));
if (j.message) { console.log('API_MSG: ' + j.message.slice(0, 120)); process.exit(0); }
console.log(`q=${q} created>${since} total=${j.total_count}`);
for (const u of j.items || []) console.log('  ' + u.login + '  id=' + u.id + '  ' + (u.html_url || ''));
