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

/* ---------------- 多次采样（抗抖动） ----------------
 * 2026-09-13 教训：pollinations 的预算状态**分钟级波动**，单次采样会得出错误结论
 *   （同一 prompt 可能此刻成功、下一刻返回预算文本）。
 *   且 xzt 有 10 次/分钟硬限流，单次 429 不等于"不可用"。
 * ⇒ 对判定性请求（chat 出词 / 知识校验）采用**N 次尝试**：
 *   任一次拿到有效结果即算通过；记录尝试次数，便于识别"不稳定"端点。
 *   间隔设置得较温和（默认 1.2s），避免把小配额端点打爆。
 */
const ATTEMPTS = Number(process.env.PROBE_ATTEMPTS || 3);
const RETRY_GAP_MS = Number(process.env.PROBE_GAP_MS || 1200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 重试直到满足 predicate 或耗尽尝试次数；返回 {last, attempts, ok}
 * 短路规则：遇到**确定性拒绝**（401/403/404）立即停止 —— 重试无意义，且会浪费配额。
 *   仅对"可能抖动"的情形重试：网络错误(0)、限流(429)、5xx、200 但正文异常。
 */
async function fetchUntil(fn, predicate, attempts = ATTEMPTS) {
  let last = null;
  for (let i = 1; i <= attempts; i++) {
    last = await fn();
    if (predicate(last)) return { last, attempts: i, ok: true };
    const st = last && last.status;
    if (st === 401 || st === 403 || st === 404) return { last, attempts: i, ok: false, definite: true };
    if (i < attempts) await sleep(RETRY_GAP_MS);
  }
  return { last, attempts, ok: false };
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

    // ★ 多次采样：端点可能限流/预算波动，单次失败不代表不可用
    const chatCall = () => fetchJson(base + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: chatModel, max_tokens: 24, messages: [{ role: 'user', content: 'Reply with exactly: PONG' }] }),
    });
    const gotText = (r) => {
      if (!r || !r.json) return false;
      const txt = r.json.choices?.[0]?.message?.content ?? r.json.choices?.[0]?.text ?? '';
      return String(txt).trim().length > 0;
    };
    const cr = await fetchUntil(chatCall, gotText);
    const c = cr.last;
    row.chatStatus = c.status;
    row.chatAttempts = cr.attempts;
    if (c.json) {
      const txt = c.json.choices?.[0]?.message?.content ?? c.json.choices?.[0]?.text ?? '';
      row.chatText = String(txt).slice(0, 40).replace(/\s+/g, ' ');
      row.chatUsable = row.chatText.length > 0;
    }

    // ③ ★ 知识校验门：出词 ≠ 真在推理。
    //    2026-09-13 实测：completions.me 对**任何输入**都返回同一句固定文本，
    //    能通过 ② 但完全是假服务。故必须问一个**有唯一正解**的问题并校验答案。
    //    同样多次采样：端点预算波动时，单次拿到预算文本会误判为"假"。
    if (row.chatUsable) {
      const q = (content) => () => fetchJson(base + '/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: chatModel, max_tokens: 40, messages: [{ role: 'user', content }] }),
      });
      const pick = (r) => {
        if (!r || !r.json) return '';
        return String(r.json.choices?.[0]?.message?.content ?? r.json.choices?.[0]?.text ?? '').trim();
      };
      // 第一次：问知识题（要求答出 391）；带重试以避开预算波动
      const k1 = await fetchUntil(q(KNOWLEDGE_Q), (r) => /\b391\b/.test(pick(r)));
      const ans = pick(k1.last);
      row.knowledgeAnswer = ans.slice(0, 60).replace(/\s+/g, ' ');
      row.knowledgeOk = /\b391\b/.test(ans);
      row.knowledgeAttempts = k1.attempts;
      // 第二次：换一个问题，用于 fixed-response 检测
      const k2 = await fetchUntil(q('Reply with exactly: ZULU-99'), (r) => /ZULU-99/.test(pick(r)));
      const ans2 = pick(k2.last);
      row.secondAnswer = ans2.slice(0, 40).replace(/\s+/g, ' ');
      // 固定回复检测：两题答案完全相同 → 高度可疑（假服务特征）
      row.fixedResponse = !!ans && ans === ans2;
    }
  }

  // 判定：区分"假服务"与"预算/额度受限"
  // 2026-09-13 教训：pollinations 的预算**分钟级波动**，单次拿到预算文本不等于它是假站
  //   （它曾多次给出正确推理结果）。故必须区分：
  //     · 回答命中 BAD_OUT 类文本（budget/quota/exhausted）→ ⏳受限（非假）
  //     · 回答是别的内容但答案错误 / 两题完全相同 → ⛔FAKE
  const budgetish = (s) => /budget|quota|exhausted|rate.?limit|insufficient|余额|额度/i.test(String(s || ''));
  const looksBudget = budgetish(row.knowledgeAnswer) || budgetish(row.secondAnswer);

  row.verdict = !row.modelsOpen
    ? 'need-key(或不可达)'
    : !row.chatUsable ? 'list-only(需key)'
      : looksBudget ? '⏳RATE-LIMITED(预算/额度受限,非假站)'
        : (!row.knowledgeOk || row.fixedResponse) ? '⛔FAKE(出词但非真推理)' : '★KEYLESS-USABLE';

  // 稳定性标注：多次尝试才成功 = 该端点抖动（限流/预算波动）
  row.flaky = (row.chatAttempts > 1) || (row.knowledgeAttempts > 1);

  results.push(row);
  const tag = row.verdict === '★KEYLESS-USABLE' ? '✅'
    : row.verdict === 'list-only(需key)' ? '🟡'
      : row.verdict.startsWith('⛔') ? '⛔'
        : row.verdict.startsWith('⏳') ? '⏳' : '⚪';
  console.log(`${tag} ${base}`);
  console.log(`     models:${row.modelsStatus}${row.modelsOpen ? `(${row.modelCount})` : ''} chat:${row.chatStatus} → ${row.verdict}${row.chatText ? ` 出词="${row.chatText}"` : ''}${row.flaky ? `  ⚠️需 ${Math.max(row.chatAttempts || 1, row.knowledgeAttempts || 1)} 次尝试才成功(抖动)` : ''}`);
  if (row.chatUsable) {
    console.log(`     知识校验: Q="${KNOWLEDGE_Q.slice(0, 28)}..." A="${row.knowledgeAnswer}" ${row.knowledgeOk ? '✅正确' : '❌错误'}${row.fixedResponse ? ' · ⚠️两次回答相同' : ''}`);
  }
}

const usable = results.filter((r) => r.verdict === '★KEYLESS-USABLE');
const fakes = results.filter((r) => r.verdict.startsWith('⛔'));
const limited = results.filter((r) => r.verdict.startsWith('⏳'));
const flaky = results.filter((r) => r.flaky);
console.log('\n' + '='.repeat(60));
console.log(`候选 ${results.length} 个 → 免 key 且**通过知识校验**的 **${usable.length}** 个：`);
usable.forEach((r) => console.log(`  ✅ ${r.base}  (模型 ${r.chatModel})${r.flaky ? '  ⚠️抖动' : ''}`));
if (fakes.length) {
  console.log(`\n⛔ 出词但**非真推理**（答案错误/固定回复）的 ${fakes.length} 个：`);
  fakes.forEach((r) => console.log(`  ⛔ ${r.base}  答="${r.knowledgeAnswer}"${r.fixedResponse ? ' [固定回复]' : ''}`));
}
if (limited.length) {
  console.log(`\n⏳ 预算/额度受限（**非假站**，可能间歇可用）的 ${limited.length} 个：`);
  limited.forEach((r) => console.log(`  ⏳ ${r.base}  答="${String(r.knowledgeAnswer).slice(0, 50)}"`));
}
if (flaky.length) {
  console.log(`\n⚠️ 抖动端点（需多次尝试才成功，非稳定可用）：${flaky.length} 个`);
  flaky.forEach((r) => console.log(`  ⚠️ ${r.base}  chat尝试 ${r.chatAttempts || '-'} 次 / 知识尝试 ${r.knowledgeAttempts || '-'} 次`));
}
console.log(`> 采样策略：每项判定最多 ${ATTEMPTS} 次尝试、间隔 ${RETRY_GAP_MS}ms（可经 PROBE_ATTEMPTS/PROBE_GAP_MS 调整）`);
console.log('='.repeat(60));

if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(results, null, 1)); console.log(`结构化结果 → ${jsonOut}`); }
process.exit(0);
