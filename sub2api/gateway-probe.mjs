// gateway-probe：任意 LLM 网关一键建档探针（只读，无 key）
// 用法：node gateway-probe.mjs <base> [--chat] [--models]
//   <base>      网关根 URL，如 https://voyager.olomc.top
//   --models    额外探测常见模型路径（/v1/models 等 401=存在/200=公开）
//   --chat      对找到的 API 前缀 POST 空 key chat（验证 401 形态，不真发消息）
// 输出：网关档案块（可贴进 GATEWAY-PROFILE-TEMPLATE.md 的实例段落）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = process.argv[2];
if (!BASE) { console.log('用法: node gateway-probe.mjs <base> [--models] [--chat]'); process.exit(1); }
const DO_MODELS = process.argv.includes('--models');
const DO_CHAT = process.argv.includes('--chat');
const UA = 'probe-gateway-profile/1.0 (readonly)';
const T = 12000;

async function probe(u, opts = {}) {
  const { method = 'GET', body } = opts;
  try {
    const r = await fetch(u, {
      method, headers: { 'user-agent': UA, accept: 'application/json', 'content-type': 'application/json', ...(body ? {} : {}) }, body, signal: AbortSignal.timeout(T), redirect: 'manual',
    });
    const ct = r.headers.get('content-type') || '';
    let shape = '';
    try { const j = await r.json(); shape = Array.isArray(j?.data) ? `models:${j.data.length}` : (j?.error?.message ? `err:${String(j.error.message).slice(0, 60)}` : (j?.object ? 'obj:' + j.object : 'json')); } catch { shape = ct.includes('html') ? 'html' : 'nonjson'; }
    return `${r.status}|${shape}`;
  } catch (e) { return `ERR:${String(e.message).slice(0, 50)}`; }
}

// 1) 公共信息端点（new-api 系 /api/status、/stats.json、/gw/catalog 等）
const COMMON = ['/api/status', '/stats.json', '/gw/catalog', '/gw/v1/models', '/v1/models', '/api/models'];
console.log(`# 网关档案: ${BASE}`);
console.log(`\n## 公共端点探测（${new Date().toISOString()}）`);
for (const p of COMMON) {
  const r = await probe(BASE + p);
  const mark = /^2\d\d/.test(r) ? '✅' : (/^401/.test(r) ? '🔑' : (/^404/.test(r) ? '·' : '❌'));
  console.log(`  ${mark} ${p} -> ${r}`);
}

// 2) 模型路径前缀扫描（找真实 base 前缀）
if (DO_MODELS) {
  const PREFIXES = ['/v1', '/gw/v1', '/api/v1', '/openai/v1', '/v1beta', '/oai/v1', '/api'];
  console.log('\n## API 前缀扫描（401=API 存在需认证 / 200|json=公开 API / 200|html=SPA 兜底勿误判）');
  for (const pre of PREFIXES) {
    const r = await probe(BASE + pre + '/models');
    if (/^401/.test(r)) console.log(`  🔑 ${pre}/models -> ${r}  ← API 路径`);
    else if (/^200/.test(r) && /json|models/.test(r)) console.log(`  ✅ ${pre}/models -> ${r}`);
    else if (/^200/.test(r) && /html/.test(r)) console.log(`  ·  ${pre}/models -> ${r} (SPA 兜底，非 API)`);
    else console.log(`  ·  ${pre}/models -> ${r}`);
  }
}

// 3) chat 端点认证形态（POST 空 key）
if (DO_CHAT) {
  console.log('\n## chat 认证形态（POST 无 key）');
  const body = JSON.stringify({ model: 'x', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 });
  for (const pre of ['/v1', '/gw/v1', '/api/v1']) {
    const r = await probe(BASE + pre + '/chat/completions', { method: 'POST', body });
    console.log(`  ${pre}/chat/completions -> ${r}`);
  }
}
console.log('\n（档案填写说明见 GATEWAY-PROFILE-TEMPLATE.md）');
