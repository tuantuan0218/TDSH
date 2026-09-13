/**
 * 免 key 端点扩展搜寻（第二轮，更广候选池）
 *
 * 上一轮 probe-keyless-endpoints.mjs 扫了 20 个候选，命中 2 个（pollinations + xzt）。
 * 本轮扩大候选面：加入此前未试过的聚合站、社区免费网关、以及"models 免 key 可列"的疑似站点。
 *
 * 方法论不变（两步门）：
 *   ① GET  /models          免 key 是否 200 且返回真实模型列表
 *   ② POST /chat/completions 免 key 是否真出词
 * 只有 ② 出词才算可用。
 *
 * 用法：node hunt-keyless-round2.mjs [--json out.json]
 */
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TIMEOUT_MS = 20000;

/** 扩展候选池：此前未系统扫过的免费/半免费网关与聚合站 */
const CANDIDATES = [
  // 已知或疑似免费的聚合/社区网关
  'https://api.freellmapi.com/v1',
  'https://api.llm7.io/v1',
  'https://api.airforce/v1',
  'https://api.chatanywhere.tech/v1',
  'https://api.chatanywhere.com.cn/v1',
  'https://free.v36.cm/v1',
  'https://api.302.ai/v1',
  'https://api.gptgod.online/v1',
  'https://api.openai-proxy.com/v1',
  'https://api.aigcbest.top/v1',
  'https://api.oaipro.com/v1',
  'https://api.moreapi.top/v1',
  'https://api.xiaoai.plus/v1',
  'https://api.zhizengzeng.com/v1',
  'https://api.gptsapi.net/v1',
  'https://api.geekai.pro/v1',
  'https://api.deepbricks.ai/v1',
  'https://api.aimlapi.com/v1',
  // 社区常提及
  'https://api.zukijourney.com/v1',
  'https://api.shard-ai.xyz/v1',
  'https://api.helixmind.online/v1',
  'https://api.naga.ac/v1',
  'https://api.electronhub.ai/v1',
  // 其它可能开放的推理端点
  'https://api.hyperbolic.xyz/v1',
  'https://api.novita.ai/v3/openai',
  'https://api.featherless.ai/v1',
  'https://api.lemonfox.ai/v1',
  'https://api.arliai.com/v1',
  'https://api.awanllm.com/v1',
  'https://api.cloudflare.com/client/v4/accounts/x/ai/v1',
];

async function fetchJson(url, init = {}) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'user-agent': UA, accept: 'application/json', ...(init.headers || {}) },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, json: null, err: String(e).slice(0, 60) };
  } finally { clearTimeout(tm); }
}

const results = [];
for (const base of CANDIDATES) {
  const b = base.replace(/\/+$/, '');
  const row = { base: b, modelsStatus: 0, modelCount: 0, sample: [], chatStatus: 0, chatUsable: false, chatText: '', verdict: '' };

  const m = await fetchJson(b + '/models');
  row.modelsStatus = m.status;
  let arr = null;
  if (m.json) {
    const d = Array.isArray(m.json) ? m.json : m.json.data;
    if (Array.isArray(d) && d.length) { arr = d; row.modelCount = d.length; row.sample = d.slice(0, 5).map((x) => x.id || x.name || String(x)); }
  }

  if (arr) {
    const chatModel = row.sample.find((id) => !/ocr|embed|rerank|whisper|tts|asr/i.test(id)) || row.sample[0];
    const c = await fetchJson(b + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: chatModel, max_tokens: 24, messages: [{ role: 'user', content: 'Reply with exactly: PONG' }] }),
    });
    row.chatStatus = c.status;
    if (c.json) {
      const txt = c.json.choices?.[0]?.message?.content ?? c.json.choices?.[0]?.text ?? '';
      row.chatText = String(txt).slice(0, 40).replace(/\s+/g, ' ');
      row.chatUsable = row.chatText.length > 0;
    }
  }

  row.verdict = !arr ? 'need-key/不可达' : row.chatUsable ? '★KEYLESS-USABLE' : 'list-only(需key)';
  results.push(row);

  const tag = row.chatUsable ? '✅' : arr ? '🟡' : '·';
  console.log(`${tag} ${b.padEnd(46)} models:${String(row.modelsStatus).padEnd(4)}${arr ? `(${row.modelCount})`.padEnd(7) : '       '} chat:${String(row.chatStatus).padEnd(4)} ${row.verdict}${row.chatText ? ` "${row.chatText}"` : ''}`);
}

const usable = results.filter((r) => r.chatUsable);
const listed = results.filter((r) => r.modelCount > 0 && !r.chatUsable);
console.log('\n' + '='.repeat(76));
console.log(`候选 ${results.length} · 免 key 真出词 ${usable.length} · 仅可列模型 ${listed.length}`);
if (usable.length) { console.log('\n★ 免 key 可用：'); usable.forEach((r) => console.log(`   ✅ ${r.base} (${r.chatText})`)); }
if (listed.length) { console.log('\n🟡 可列模型但仍需 key（有注册价值）：'); listed.forEach((r) => console.log(`   ${r.base}  ${r.modelCount} 模型`)); }
console.log('='.repeat(76));

const jIdx = process.argv.indexOf('--json');
if (jIdx >= 0) { writeFileSync(process.argv[jIdx + 1], JSON.stringify(results, null, 1)); console.log('→ ' + process.argv[jIdx + 1]); }
