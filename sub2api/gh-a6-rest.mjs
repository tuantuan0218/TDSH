// A6API (New API 系) 后台 REST 直连探测：/api/session 登录 -> /api/user/self -> /api/token 结构
// 不打印任何凭据；输出仅状态码/掩码/结构，便于安全复盘
// 用法: node gh-a6-rest.mjs
import fs from 'node:fs';
const BASE = 'https://a6api.com';
const [USER, PASS] = fs.readFileSync('D:/tdsh/sub2api/.wb-a6-cred.txt', 'utf8').split(/\r?\n/).filter(Boolean).map(s => s.trim());
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0';
let cookie = '';

function saveCookies(res) {
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of sc) { const kv = c.split(';')[0].trim(); if (kv) cookie = cookie ? cookie + '; ' + kv : kv; }
}
async function api(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { 'user-agent': UA, 'accept': 'application/json', ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(opts.headers || {}) },
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });
  saveCookies(r);
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text: text.slice(0, 600) };
}

console.log('=== 1. POST /api/session 登录 ===');
let r = await api('/api/session', { method: 'POST', body: JSON.stringify({ username: USER, password: PASS }) });
console.log('  status=', r.status, 'cookie_got=', !!cookie, 'body=', JSON.stringify(r.json || r.text).slice(0, 180));
if (!cookie) {
  console.log('  试 /api/user/login 变体…');
  r = await api('/api/user/login', { method: 'POST', body: JSON.stringify({ username: USER, password: PASS }) });
  console.log('  status=', r.status, 'cookie_got=', !!cookie, 'body=', JSON.stringify(r.json || r.text).slice(0, 180));
}

console.log('=== 2. GET /api/user/self ===');
const self = await api('/api/user/self');
if (self.json?.data) {
  const d = self.json.data;
  console.log('  ok=', self.json.success, '| username=', d.username, '| id=', d.id, '| role=', d.role, '| status=', d.status);
  console.log('  quota=', d.quota, ' used_quota=', d.used_quota, ' requested_quota=', d.requested_quota, ' group=', d.group);
} else {
  console.log('  ->', self.status, JSON.stringify(self.json || self.text).slice(0, 250));
}

console.log('=== 3. 令牌接口结构探测 ===');
for (const p of ['/api/token/?p=0&size=10', '/api/token/', '/api/token?page=1&page_size=10']) {
  const t = await api(p);
  const shape = t.json ? (Array.isArray(t.json.data) ? 'array:' + t.json.data.length : (t.json.data ? Object.keys(t.json.data).join(',') : JSON.stringify(t.json).slice(0, 120))) : t.text.slice(0, 120);
  console.log(' ', p, '->', t.status, '|', String(shape).slice(0, 220));
  if (t.json?.success && Array.isArray(t.json.data)) {
    for (const row of t.json.data.slice(0, 5)) console.log('    token id=', row.id, 'name=', row.name, 'status=', row.status, 'key_masked=', String(row.key || '').slice(0, 8) + '…', 'unlimited=', row.unlimited, 'expired_time=', row.expired_time);
  }
}

console.log('=== 4. 站点公共信息（额度/模型）===');
const notice = await api('/api/status');
if (notice.json?.data) console.log('  status keys:', Object.keys(notice.json.data).slice(0, 14).join(','), '| self_use_mode=', notice.json.data.self_use_mode, '| start_time=', notice.json.data.start_time);
const models = await api('/v1/models');
console.log('  /v1/models ->', models.status, (models.text || '').slice(0, 120));
