// 邮箱域名接受度路由表：只用【自建可读域】探 /api/verification，硬护栏拒一切第三方地址。
// 零池写、零 store 写；产物只落 D:/tdsh/sub2api/ghproxy/mail-routing.json
// 用法: node gh-mail-routing.mjs [并发站点数=1]
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0';
const MY = JSON.parse(fs.readFileSync('D:/tdsh/forum_leads_20260913/mailtm.json', 'utf8'));
const myDomains = new Set((MY.accounts || []).map(a => String(a.address || '').split('@')[1]).filter(Boolean));
if (!myDomains.size) { console.log('STOP 无自建可读域名'); process.exit(2); }
console.log('探针域（仅自建可读）:', [...myDomains].join(','));

// 既有已判定家（来源：wlgap.log / wlretry.log / FREE-API-SITES §五），本轮不重复触发发信
const KNOWN = {
  'api.aiaiai001.com': '❌ 仅支持 QQ 邮箱等白名单（文案实证）',
  'straitapi.com': '❌ uberip 被拒',
  'api.hcnsec.cn': '❌ uberip 被拒',
  'crowllm.com': '❌ uberip 被拒',
  'beizhi.sylu.cc': '❌ uberip 被拒',
  'api.openrealm.dev': '❌ uberip 被拒',
  'ai.mrcwoods.com': '❌ uberip 被拒',
};

const screen = JSON.parse(fs.readFileSync('D:/tdsh/sub2api/free-quota-snapshots/screen-latest.json', 'utf8'));
const targets = screen.live.filter(s => /email_code/i.test(s.verdict || ''));
const rnd = n => Math.random().toString(36).slice(2, 2 + n);
const rows = [];

for (const s of targets) {
  const host = s.h;
  if (KNOWN[host]) { rows.push({ host, verdict: s.verdict, checkin: !!s.ck, uberip: KNOWN[host], source: '既有日志' }); console.log(`${host.padEnd(24)} [跳过，已有结论] ${KNOWN[host]}`); continue; }
  const domain = [...myDomains][0];
  if (!myDomains.has(domain)) { console.log('GUARD TRIP 非自建域 ' + domain); continue; }
  const email = 'dsh' + rnd(7) + '@' + domain;
  let out;
  try {
    const r = await fetch('https://' + host + '/api/verification?email=' + encodeURIComponent(email), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(18000) });
    const t = (await r.text()).replace(/\s+/g, ' ');
    out = /whitelist|白名单|仅支持|不允许|not allowed|REJECTED/i.test(t) ? '❌ 域名白名单挡死'
      : /captcha|人机|turnstile/i.test(t) ? '❌ 要人机验证'
      : /"success":\s*true/.test(t) ? '✅ 已发码（uberip 可用 → 可全自动开户）'
      : /过于频繁|频繁/i.test(t) ? '⏳ 限流（结论未知）'
      : '⚠ ' + t.slice(0, 80);
    if (r.status !== 200) out = r.status + ' ' + out;
  } catch (e) { out = 'ERR ' + String(e).slice(0, 45); }
  rows.push({ host, verdict: s.verdict, checkin: !!s.ck, uberip: out, source: '本轮实测' });
  console.log(`${host.padEnd(24)} ${s.verdict.padEnd(14)} ck=${s.ck ? '✓' : '·'}  ${out}`);
  await new Promise(r => setTimeout(r, 2500));
}

const pass = rows.filter(r => /✅/.test(r.uberip));
fs.writeFileSync('D:/tdsh/sub2api/ghproxy/mail-routing.json', JSON.stringify({ generated_at: new Date().toISOString(), probe_domain: [...myDomains][0], rows }, null, 1));
console.log(`\n===== 汇总（${rows.length} 家）=====`);
console.log('uberip.com 可用（可全自动开户）:', pass.length ? pass.map(p => p.host + (p.checkin ? '(有签到)' : '')).join(', ') : '无');
console.log('结论文件: D:/tdsh/sub2api/ghproxy/mail-routing.json（ghproxy/ 已 gitignore，不外传）');
