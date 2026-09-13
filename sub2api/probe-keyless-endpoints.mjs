/**
 * 免 key 端点批量探测（probe-keyless-endpoints.mjs）
 *
 * 方法论（本会话已验证有效）：**三步门**
 *   ① `GET {base}/models` 免 key 是否 200 且返回真实模型列表
 *   ② 若 ① 通过，再 `POST {base}/chat/completions` 免 key 测试**真实出词**
 *   ③ ★ **知识校验**：问一个**有唯一正解**的问题（17*23），校验答案**是否正确**
 *
 * 为什么需要 ③（2026-09-13 实测教训）：
 *   `www.completions.me` 宣称免验证注册、提供 Claude Opus 4.6，
 *   实测 **任何输入都返回同一句固定文本**（Rickroll 歌词）——
 *   HTTP 200 + 有正文，**能通过 ② 门**，但完全是假服务。
 *   若只测"有没有出词"，会把它误判为可用端点并写入清单。
 *   → 故必须补 ③：**出词 ≠ 真在推理**。
 *
 * 用法：
 *   node probe-keyless-endpoints.mjs                 # 用内置候选表
 *   node probe-keyless-endpoints.mjs urls.txt        # 每行一个 base URL
 *   node probe-keyless-endpoints.mjs --json out.json # 输出结构化结果
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TIMEOUT_MS = 25000;

/** 知识校验题：答案唯一且易判（用算式，避免主观） */
const KNOWLEDGE_Q = 'What is 17 * 23? Reply with only the number.';
const KNOWLEDGE_A = '391';

/** 内置候选：国产大厂 + 已知聚合/中转站 + 免费档站点 */
const DEFAULT_CANDIDATES = [
  // 国产大厂官方（预期需 key —— 作为阴性对照基线）
  'https://api.siliconflow.cn/v1',
  'https://api.deepseek.com/v1',
  'https://open.bigmodel.cn/api/paas/v4',
  'https://dashscope.aliyuncs.com/compatible-mode/v1',
  'https://api.moonshot.cn/v1',
  'https://ark.cn-beijing.volces.com/api/v3',
  'https://api.hunyuan.cloud.tencent.com/v1',
  'https://qianfan.baidubce.com/v2',
  'https://api.minimax.chat/v1',
  'https://api.stepfun.com/v1',
  'https://api.lingyiwanwu.com/v1',
  'https://api.baichuan-ai.com/v1',
  // 已知免 key / 半免 key 聚合
  'https://text.pollinations.ai/openai',
  'https://ai-api.xzt.plus/v1',
  'https://bazaarlink.ai/api/v1',
  'https://free.suyu.io/v1',
  'https://api.llm7.io/v1',
  // 其它候选
  'https://api.airforce/v1',
  'https://api.chatanywhere.tech/v1',
  'https://api.gpt.ge/v1',
];

const argFile = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const jsonOutIdx = process.argv.indexOf('--json');
const jsonOut = jsonOutIdx >= 0 ? process.argv[jsonOutIdx + 1] : null;

let candidates = DEFAULT_CANDIDATES;
if (argFile && existsSync(argFile)) {
  candidates = readFileSync(argFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
}

const normBase = (u) => u.replace(/\/+$/, '');

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
    return { status: res.status, json, text: text.slice(0, 300) };
  } catch (e) {
    return { status: 0, json: null, text: '', err: String(e).slice(0, 80) };
  } finally { clearTimeout(tm); }
}

const results = [];

for (const raw of candidates) {
  const base = normBase(raw);
  const row = { base, modelsStatus: 0, modelsOpen: false, modelCount: 0, sample: [], chatStatus: 0, chatUsable: false, chatModel: '', chatText: '', verdict: '' };

  // ① models 门
  const m = await fetchJson(base + '/models');
  row.modelsStatus = m.status;
  if (m.json) {
    const arr = Array.isArray(m.json) ? m.json : m.json.data;
    if (Array.isArray(arr) && arr.length) {
      row.modelsOpen = true;
      row.modelCount = arr.length;
      row.sample = arr.slice(0, 4).map((x) => x.id || x.slug || x.name || String(x));
    }
  }

  // ② chat 门：仅当 ① 通过才测（省时间；① 不过则必然需 key）
  if (row.modelsOpen) {
    // 选一个像对话模型的（避开 OCR/embedding 等非对话模型）
    const chatModel = row.sample.find((id) => !/ocr|embed|rerank|whisper|tts|asr|vl/i.test(id)) || row.sample[0];
    row.chatModel = chatModel;
    const c = await fetchJson(base + '/chat/completions', {
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

    // ③ ★ 知识校验门：出词 ≠ 真在推理。
    //    2026-09-13 实测：completions.me 对**任何输入**都返回同一句固定文本，
    //    能通过 ② 但完全是假服务。故必须问一个**有唯一正解**的问题并校验答案。
    if (row.chatUsable) {
      const k = await fetchJson(base + '/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: chatModel, max_tokens: 40, messages: [{ role: 'user', content: KNOWLEDGE_Q }] }),
      });
      let ans = '';
      if (k.json) ans = String(k.json.choices?.[0]?.message?.content ?? k.json.choices?.[0]?.text ?? '');
      row.knowledgeAnswer = ans.trim().slice(0, 60).replace(/\s+/g, ' ');
      // 判据：答案中须出现 391（容忍前后缀）
      row.knowledgeOk = /\b391\b/.test(ans);
      // 再问一个**不同**的问题，看回答是否变化（防"固定回复"）
      const k2 = await fetchJson(base + '/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: chatModel, max_tokens: 40, messages: [{ role: 'user', content: 'Reply with exactly: ZULU-99' }] }),
      });
      let ans2 = '';
      if (k2.json) ans2 = String(k2.json.choices?.[0]?.message?.content ?? '');
      row.secondAnswer = ans2.trim().slice(0, 40).replace(/\s+/g, ' ');
      // 固定回复检测：两次回答完全相同 → 高度可疑
      row.fixedResponse = !!ans && ans.trim() === ans2.trim();
    }
  }

  row.verdict = !row.modelsOpen
    ? 'need-key(或不可达)'
    : !row.chatUsable ? 'list-only(需key)'
      : (!row.knowledgeOk || row.fixedResponse) ? '⛔FAKE(出词但非真推理)' : '★KEYLESS-USABLE';

  results.push(row);
  const tag = row.verdict === '★KEYLESS-USABLE' ? '✅' : row.verdict === 'list-only(需key)' ? '🟡' : row.verdict.startsWith('⛔') ? '⛔' : '⚪';
  console.log(`${tag} ${base}`);
  console.log(`     models:${row.modelsStatus}${row.modelsOpen ? `(${row.modelCount})` : ''} chat:${row.chatStatus} → ${row.verdict}${row.chatText ? ` 出词="${row.chatText}"` : ''}`);
  if (row.chatUsable) {
    console.log(`     知识校验: Q="${KNOWLEDGE_Q.slice(0, 28)}..." A="${row.knowledgeAnswer}" ${row.knowledgeOk ? '✅正确' : '❌错误'}${row.fixedResponse ? ' · ⚠️两次回答相同(固定回复)' : ''}`);
  }
}

const usable = results.filter((r) => r.verdict === '★KEYLESS-USABLE');
const fakes = results.filter((r) => r.verdict.startsWith('⛔'));
console.log('\n' + '='.repeat(60));
console.log(`候选 ${results.length} 个 → 免 key 且**通过知识校验**的 **${usable.length}** 个：`);
usable.forEach((r) => console.log(`  ✅ ${r.base}  (模型 ${r.chatModel})`));
if (fakes.length) {
  console.log(`\n⛔ 出词但**非真推理**（固定回复/答案错误）的 ${fakes.length} 个：`);
  fakes.forEach((r) => console.log(`  ⛔ ${r.base}  答="${r.knowledgeAnswer}"${r.fixedResponse ? ' [固定回复]' : ''}`));
}
console.log('='.repeat(60));

if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(results, null, 1)); console.log(`结构化结果 → ${jsonOut}`); }
process.exit(0);
