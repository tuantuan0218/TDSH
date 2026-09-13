/**
 * xzt 端点全模型出词实测（probe-xzt-models.mjs）
 *
 * 目的：xzt（ai-api.xzt.plus）是本会话新发现的免 key 可用端点，已入池（账号 31）。
 *   但其 /models 列出的 24 个模型中此前只实测了 10 个，剩余 14 个未知 ——
 *   本脚本补全，产出完整可用模型表，供入池映射与路由使用。
 *
 * 方法：逐个 POST /chat/completions（免 key），要求模型回出 PONG。
 *   - 严格判定：必须出现 content 且非空才算"可用"
 *   - 记录 HTTP 状态与耗时，便于识别慢模型（路由应避开慢的）
 *   - 串行执行 + 单模型超时，避免打爆端点
 *
 * 用法：node probe-xzt-models.mjs [--json out.json]
 */
import { writeFileSync } from 'node:fs';

const BASE = 'https://ai-api.xzt.plus/v1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

const jsonOutIdx = process.argv.indexOf('--json');
const jsonOut = jsonOutIdx >= 0 ? process.argv[jsonOutIdx + 1] : null;

async function getModels() {
  const r = await fetch(BASE + '/models', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  return (j.data || []).map((x) => x.id);
}

/* ---------------- 抗抖动：重试 + 限流感知节流 ----------------
 * 2026-09-13 教训（两处）：
 *   ① 单次采样会误判 —— xzt 有 **10 次/分钟/IP 硬限流**（本会话实测：连打 12 次，第 11 次起 429），
 *      批量快扫必然触发 429，把可用模型误判为"不可用"。
 *   ② 429/5xx/网络错误是**可重试**的；401/403/404 是**确定性拒绝**，重试无意义。
 * ⇒ 策略：
 *   · 每个模型最多 RETRY 次尝试，间隔按限流配额留足（默认 6.5s ≈ 9 次/分钟）
 *   · 遇 429 额外退避（读 Retry-After 或固定较长间隔）
 *   · 遇 401/403/404 立即短路（不再浪费配额）
 *   · 区分"模型不可用"与"内容审核拦截"（403 且 message 含 moderation）
 */
const RETRY = Number(process.env.XZT_RETRY || 2);
// ★ 节流间隔（2026-09-13 修正）：
//   原以为"10 次/分钟"是唯一约束，故设 6500ms（≈9.2/min）。
//   但实测发现：**触发 429 后会进入较长冷却**（本轮观测 ≥2 分钟仍未恢复），
//   且低速探测（6/min）在冷却期内同样被拒（code=ip_throttled）。
//   ⇒ 默认放宽到 11000ms（≈5.5/min），远低于阈值；且触发 429 后走长退避。
const GAP_MS = Number(process.env.XZT_GAP_MS || 11000);
const THROTTLE_BACKOFF_MS = Number(process.env.XZT_BACKOFF_MS || 65000); // 遇 429 的长退避
const MAX_TOKENS = Number(process.env.XZT_MAX_TOKENS || 1024); // 推理模型需留足预算，见下方注释
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isDeterministicReject = (status) => status === 401 || status === 403 || status === 404;
/** 识别限流：HTTP 429 或显式 code=ip_throttled */
const isThrottled = (res) => res && (res.status === 429 || res.throttleCode === 'ip_throttled');

async function tryModelOnce(model) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify({
        model,
        // ★ 探测推理模型必须留足预算：
        //   2026-09-13 实测教训 —— max_tokens 太小（如 32）时，推理模型还在输出思考过程就被截断
        //   （finish_reason=length），`message.content` 仍为 null，于是被误判为"不可用"。
        //   实测确认：简单指令用 512 足够；真正任务（如问"法国首都"）需 ≥1024 才能见到 content。
        //   此处用 MAX_TOKENS（默认 1024，可经 XZT_MAX_TOKENS 调整）。
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: 'Reply with exactly: PONG' }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    const ms = Date.now() - t0;
    const txt = await r.text();
    let content = '';
    let fields = [];
    let finish = '';
    let errCode = '';
    let errMsg = '';
    try {
      const j = JSON.parse(txt);
      const choice = j.choices?.[0];
      content = extractContent(choice?.message, choice);
      fields = choice?.message ? Object.keys(choice.message) : [];
      finish = choice?.finish_reason || '';
      // ★ 用**显式错误码**判定审核拦截，而非靠正文模糊匹配
      //   （实测该端点返回 code: "moderation_output_blocked"）
      errCode = j.error?.code || '';
      errMsg = j.error?.message || '';
    } catch { /* 非 JSON */ }
    return {
      model, status: r.status, ms,
      usable: content.length > 0,
      text: content.slice(0, 50).replace(/\s+/g, ' '),
      raw: txt.slice(0, 120),
      moderationBlocked: errCode === 'moderation_output_blocked' || /审核|moderation/i.test(errMsg),
      throttleCode: errCode === 'ip_throttled' ? 'ip_throttled' : '',
      errCode,
      // 便于识别"靠 reasoning_content 才拿到内容"的推理模型
      viaReasoning: !!(content && /reasoning/i.test(fields.join(','))),
      truncated: finish === 'length',
    };
  } catch (e) {
    return { model, status: 0, ms: Date.now() - t0, usable: false, text: '', raw: String(e).slice(0, 100) };
  }
}

/** 从响应中提取"模型确实产出了内容"的证据。
 *
 * ★ 2026-09-13 第三类假阴性修复：推理模型（如 muse-glimmer-30b / Qwen3.5 / step-3.5-flash）
 *   会把输出放在 **`reasoning_content`**（或 `reasoning`）里，而 `message.content` 为 **null**。
 *   若只读 `content`，会把这类模型误判为"不可用" —— 本会话实测 6 个"失败"里有 3 个属此类。
 *   同时 `max_tokens` 给小了会让推理模型只输出思考过程、拿不到最终答案（finish_reason=length）。
 */
function extractContent(msg, choice) {
  if (!msg) return '';
  const cands = [msg.content, msg.reasoning_content, msg.reasoning, choice?.text];
  for (const c of cands) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (Array.isArray(c)) {                       // 多模态/分块格式
      const joined = c.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('').trim();
      if (joined) return joined;
    }
  }
  return '';
}
/** 带重试与节流的单模型测试；返回 {r, attempts, throttled}
 * ★ 限流处理：遇 429/ip_throttled 走**长退避**（实测触发后冷却 ≥2 分钟），
 *   而非仅等下一个小间隔 —— 否则会在冷却期内空转并继续消耗探测次数。
 */
async function tryModel(model) {
  let last = null;
  let throttled = 0;
  for (let i = 1; i <= RETRY; i++) {
    last = await tryModelOnce(model);
    if (last.usable) return { r: last, attempts: i, throttled };
    if (isThrottled(last)) {
      throttled++;
      // 已被限流：长退避后再试（若还有次数）
      if (i < RETRY) { await sleep(THROTTLE_BACKOFF_MS); continue; }
    }
    if (isDeterministicReject(last.status)) return { r: last, attempts: i, throttled, definite: true };
    if (i < RETRY) await sleep(GAP_MS);
  }
  return { r: last, attempts: RETRY, throttled };
}

const models = await getModels();
console.log(`xzt 端点模型总数：${models.length}`);
console.log(`节流策略：间隔 ${GAP_MS}ms（≈${(60000 / GAP_MS).toFixed(1)} req/min）、每模型最多 ${RETRY} 次尝试`);
console.log(`          遇限流退避 ${THROTTLE_BACKOFF_MS}ms（实测触发后冷却 ≥2 分钟）\n`);

const results = [];
for (const [idx, m] of models.entries()) {
  const { r, attempts, throttled, definite } = await tryModel(m);
  const row = { ...r, attempts, throttled, definite: !!definite };
  if (throttled && !r.usable) row.rateLimited = true;
  // 区分"内容审核拦截"与真实不可用
  if (!r.usable && r.moderationBlocked) row.moderated = true;
  results.push(row);

  const tag = r.usable ? '✅' : row.moderated ? '🚫' : row.rateLimited ? '⏳' : '❌';
  const note = r.usable ? `出词="${r.text}"` : row.moderated ? '内容审核拦截' : row.rateLimited ? `限流(${throttled}次429)` : r.raw.slice(0, 55);
  console.log(`${tag} ${m.padEnd(46)} HTTP ${String(r.status).padEnd(4)} ${String(r.ms).padStart(6)}ms  ${note}${attempts > 1 ? `  (${attempts}次尝试)` : ''}`);
  // 模型间节流：保持整体速率在限流之下
  if (idx < models.length - 1) await sleep(GAP_MS);
}

const ok = results.filter((r) => r.usable);
const moderated = results.filter((r) => r.moderated);
const rateLimited = results.filter((r) => r.rateLimited);
const fail = results.filter((r) => !r.usable && !r.moderated && !r.rateLimited);

console.log('\n' + '='.repeat(70));
console.log(`可用 ${ok.length} / 总 ${results.length}`);
console.log('\n可用模型（按响应速度排序）：');
ok.sort((a, b) => a.ms - b.ms).forEach((r) => console.log(`  ✅ ${r.model.padEnd(46)} ${r.ms}ms`));

if (moderated.length) {
  console.log(`\n🚫 内容审核拦截（端点策略，非模型故障）${moderated.length} 个：`);
  moderated.forEach((r) => console.log(`  🚫 ${r.model.padEnd(46)} HTTP ${r.status}`));
}
if (rateLimited.length) {
  console.log(`\n⏳ 限流未出结果（**重跑可能可用**）${rateLimited.length} 个：`);
  rateLimited.forEach((r) => console.log(`  ⏳ ${r.model.padEnd(46)} 累计 ${r.throttled} 次 429`));
}
if (fail.length) {
  console.log(`\n❌ 真实不可用 ${fail.length} 个：`);
  fail.forEach((r) => console.log(`  ❌ ${r.model.padEnd(46)} HTTP ${r.status}  ${String(r.raw).slice(0, 50)}`));
}
console.log('\n> 判读：⏳ 限流 ≠ 不可用；🚫 审核拦截 ≠ 模型坏；只有 ❌ 才是真不可用');
console.log('='.repeat(70));

if (jsonOut) { writeFileSync(jsonOut, JSON.stringify({ base: BASE, ts: new Date().toISOString(), total: results.length, usable: ok.length, results }, null, 1)); console.log(`结构化结果 → ${jsonOut}`); }
