#!/usr/bin/env node
/**
 * 免费 API 额度复扫监控器 (free-quota-monitor)
 * 源：GoAIHop(/public-benefit,/benefits) + linux.do 镜像(t.me/s/linuxdoit) + v2ex(tag/公益站)
 * 做：抓取 -> 结构化 -> 匿名实测(含阳性对照) -> 与上轮快照 diff -> 告警落盘
 * 铁律：本脚本与产物**不得**写入任何 key 明文（只存端点/福利描述/指纹）。
 * 用法：node free-quota-monitor.mjs [--fixtures] [--selftest] [--quiet]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
const ROOT = 'D:/tdsh/sub2api/';
const SNAPDIR = ROOT + 'free-quota-snapshots/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SRC = {
  publicBenefit: 'https://goaihop.com/public-benefit',
  benefits: 'https://goaihop.com/benefits',
  linuxdoMirror: 'https://t.me/s/linuxdoit',
  v2exTag: 'https://www.v2ex.com/tag/%E5%85%AC%E7%9B%8A%E7%AB%99',
};
const FIXTURE = {
  publicBenefit: 'D:/tdsh/forum_leads_20260913/goaihop_publicbenefit.html',
  benefits: 'D:/tdsh/forum_leads_20260913/goaihop_benefits.html',
  linuxdoMirror: 'D:/tdsh/forum_leads_20260913/tg_linuxdo.html',
  v2exTag: 'D:/tdsh/forum_leads_20260913/v2ex_tag_gongyi.html',
};
const strip = h => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ')
  .replace(/\s+/g, ' ').trim();

async function get(key, useFixtures) {
  if (useFixtures && existsSync(FIXTURE[key])) return readFileSync(FIXTURE[key], 'utf8');
  try {
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(SRC[key], { headers: { 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9' }, redirect: 'follow', signal: ctrl.signal });
    clearTimeout(tm);
    if (!res.ok) return { err: `HTTP ${res.status}`, html: '' };
    return { err: null, html: await res.text() };
  } catch (e) { return { err: String(e).slice(0, 120), html: '' }; }
}

/* ---------------- parsers ---------------- */
/* RSC 抽取：GoAIHop 把 providers[] / offers[] 塞在 <script> 的转义字符串里（\" 形式）。
   抠 HTML 正文会（a）把相邻文案吸进站名 → diff 键抖动假告警，（b）丢掉 claimUrl/metrics/freeCreditRules。
   → 反转义后按括号配对解 JSON，才是正解。 */
const unescRsc = h => h.replace(/\\"/g, '"');
export function extractRscArray(html, key) {
  const h = unescRsc(html);
  const at = h.indexOf('"' + key + '":[');
  if (at < 0) return null;
  let i = at + key.length + 3, depth = 0, inStr = false, esc = false;
  for (let p = i; p < h.length; p++) {
    const c = h[p];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { const s = h.slice(i, p + 1);
      try { return JSON.parse(s); } catch (e) { return { __parseError: String(e).slice(0, 100), __len: s.length }; } } }
  }
  return null;
}
const hostOf = u => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : null; } catch { return null; } };
const pct = v => (v == null ? null : (v <= 1 ? Math.round(v * 10000) / 100 : Math.round(v * 100) / 100));
const zh = o => (o && typeof o === 'object' ? (o['zh-CN'] || o.en || JSON.stringify(o)) : (o ?? ''));
// 公益中转站：优先 RSC providers[]，结构变更时退回 HTML 卡片解析
export function parseStations(html) {
  const prov = extractRscArray(html, 'providers');
  if (Array.isArray(prov) && prov.length) {
    return prov.filter(p => p && p.slug).map(p => {
      const rules = Array.isArray(p.freeCreditRules) ? p.freeCreditRules : [];
      const mx = p.metrics || {};
      const models = Array.isArray(p.models) ? p.models : [];
      return {
        name: p.name || p.slug, slug: p.slug, domain: hostOf(p.websiteUrl), claim: p.affiliateUrl || p.websiteUrl || null,
        systemType: p.systemType || null, protocols: p.protocols || [], siteStatus: p.status || null,
        publicBenefit: !!p.publicBenefit, models: models.length,
        freeModels: models.filter(m => m.inputPriceCny === 0 && m.outputPriceCny === 0).length,
        modelIds: models.slice(0, 10).map(m => m.id),
        avail7d: pct(mx.availability7d), success7d: pct(mx.successRate7d),
        // 表上「榜单评分」= stabilityScore（compatibilityScore 另计，Agent Router 实测 100%/96 分/compat 0）
        score: mx.stabilityScore ?? null, compat: mx.compatibilityScore ?? null,
        availEffective: pct(mx.effectiveAvailability7d), ci95low: mx.availabilityEvidence?.lower95 ?? null,
        recentStatuses: mx.recentStatuses || [],
        degradedRecent: (mx.recentStatuses || []).filter(s => !/^(ok|healthy|up|success)$|正常/i.test(String(s))).length,
        latencyMs: mx.firstTokenLatencyMs ?? null, samples: mx.effectiveSampleCount ?? mx.sampleCount ?? null,
        probeKeyConfigured: (p.groups || []).some(g => g.probeApiKeyConfigured),
        benefits: rules.map(r => `${r.method || '?'}/${r.frequency || '-'}:${zh(r.reward)}`),
        claimUrls: [...new Set(rules.map(r => r.claimUrl).filter(Boolean))].slice(0, 3),
      };
    });
  }
  return parseStationsHtml(html);
}
function parseStationsHtml(html) {
  const BAD = /goaihop|status\.|assets\.|www\.w3\.org|w3\.org|schema\.org|xmlns|www\.google|googleapis|github|gstatic|jsdelivr|tg\.me|t\.me|qq\.com|youtube|discord/i;
  const anchors = [...html.matchAll(/<a\s+title="([^"]{2,60})"[^>]*href="\/providers\/([a-z0-9\-]+)"/g)];
  const out = [];
  anchors.forEach((a, i) => {
    const end = i + 1 < anchors.length ? anchors[i + 1].index : html.length;
    const card = html.slice(a.index, end);
    const ctext = strip(card);
    // 注意：正则字面量**不做**模板插值（写 ${BAD.source} 会被当字面字符，黑名单静默失效）→ 必须内联
    const ext = [...card.matchAll(/https?:\/\/((?!goaihop|status\.|assets\.|www\.w3\.org|w3\.org|schema\.org|xmlns|www\.google|googleapis|github|gstatic|jsdelivr|t\.me|tg\.me|qq\.com|youtube|discord)[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.(?:com|net|org|cc|top|icu|ai|io|xyz|me|dev|gg|fun|site|store|app|space|online|club|vip))(?:\/|["'\s])/gi)]
      .map(m => m[1].toLowerCase());
    const avail = ctext.match(/近 7 天可用率 ([\d.]+)%/);
    const score = ctext.match(/榜单评分 ([\d.]+)/);
    const models = ctext.match(/模型覆盖 (\d+) 个模型/);
    const benefits = [];
    if (/签到领取 · 随机/.test(ctext)) benefits.push('签到领取·随机' + (ctext.match(/随机 (\d+) 个模型/)?.[1] || '?') + '模型');
    [...ctext.matchAll(/注册领取 · \$?(\d+) ?(?:美元|元)额度/g)].forEach(r => benefits.push('注册领$' + r[1]));
    if (/首充|充值/.test(ctext)) benefits.push('充值相关');
    out.push({
      name: a[1].trim(), slug: a[2], domain: ext[0] || null, domains: [...new Set(ext)].slice(0, 3),
      models: models ? +models[1] : null, avail7d: avail ? +avail[1] : null, score: score ? +score[1] : null,
      benefits: [...new Set(benefits)],
    });
  });
  // 同名多张卡（列表行+详情行）→ 合并取信息最全的一张
  const byKey = new Map();
  for (const s of out) {
    const k = s.slug || s.name;
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, s); continue; }
    const better = (x, y) => (x ?? -1) > (y ?? -1) ? x : y;
    prev.avail7d = better(prev.avail7d, s.avail7d); prev.score = better(prev.score, s.score);
    prev.models = better(prev.models, s.models);
    prev.domain = prev.domain || s.domain; prev.domains = [...new Set([...(prev.domains || []), ...(s.domains || [])])].slice(0, 3);
    prev.benefits = [...new Set([...prev.benefits, ...s.benefits])];
  }
  return [...byKey.values()];
}
// 福利码批次：按"中转站 / 批次 由 X 提供"切块，块内各字段独立解析（避免整串正则被空格/缺项卡死）
export function parseBenefits(html) {
  const txt = strip(html);
  const chunks = txt.split(/中转站 \/ 批次(?= 由 )/).slice(1);
  const out = [];
  for (const c of chunks) {
    const seg = c.slice(0, 700);
    const merchant = (seg.match(/^ 由 (.+?) 提供 /) || [])[1];
    if (!merchant) continue;
    const batch = (seg.match(/ 提供 (.+?)福利内容 /) || [])[1] || '';
    const body = (seg.match(/福利内容 ([\s\S]{0,240}?)使用条件/) || [])[1] || '';
    const quota = (seg.match(/福利额度 ([\s\S]{0,70}?)状态/) || [])[1] || '';
    const stock = (seg.match(/剩余 (\d+) 个/) || [])[1];
    const endsIn = (seg.match(/距本期结束 (.+?) 操作/) || [])[1] || '';
    out.push({ merchant: merchant.trim(), batch: batch.trim(), quota: quota.trim(), stock: stock ? +stock : null,
      endsIn: endsIn.trim(), note: body.replace(/\s+/g, ' ').slice(0, 90) });
  }
  return out;
}
// linux.do 镜像（tg 页面消息）
const WELFARE = /(公益|api|key|token|额度|兑换码|免费送|送\$|白嫖|薅|注册送|签到)/i;
export function parseMirror(html) {
  const out = [];
  for (const m of html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)) {
    const t = strip(m[1]);
    if (t.length > 15 && WELFARE.test(t)) out.push({ title: t.slice(0, 200) });
  }
  return out;
}
// v2ex tag 页：href="/t/1228635#reply6" class="topic-link"
export function parseV2ex(html) {
  const out = [];
  for (const m of html.matchAll(/href="\/t\/(\d+)[^"]*"\s+class="topic-link"[^>]*>([\s\S]*?)<\/a>/g)) {
    const title = strip(m[2]);
    if (title.length > 4) out.push({ id: m[1], title: title.slice(0, 160), url: `https://www.v2ex.com/t/${m[1]}` });
  }
  return out;
}

/* ---------------- anonymous probe（两级门：models 可见 ≠ 可调用，入池只认 chat 真出词） ---------------- */
const CONTROL = ['https://text.pollinations.ai/openai'];
// 已知"models 开、chat 关"的负对照：free.suyu.io（2026-09-13 实测 /models 200 9模型 + chat 401 未提供令牌）
const NEG_CONTROL = 'https://free.suyu.io/v1';
export function modelsUrl(u) {
  let b = u.replace(/\/+$/, '');
  if (/\/models$/.test(b)) return b;
  if (/\/(v1|openai|api|anthropic|compatible-mode)$/.test(b)) return b + '/models';
  return b + '/v1/models';
}
function contentTypeOpen(body) {
  // 解析必须作用于**未截断**的 JSON（截断会让 parse 失败→假阴），只用于展示时才切
  try { const j = JSON.parse(body); const arr = Array.isArray(j) ? j : j.data; if (Array.isArray(arr)) return { open: true, n: arr.length, sample: arr.slice(0, 6).map(x => x.id || x.slug || x.name || String(x)).join(',') }; } catch { }
  return { open: false, n: 0, sample: '' };
}
function chatText(body) {
  try { const j = JSON.parse(body); const c = j.choices?.[0]?.message?.content ?? j.choices?.[0]?.text ?? j.content?.[0]?.text ?? j.output_text; return typeof c === 'string' ? c.trim() : (c ? String(c) : ''); } catch { return ''; }
}
export const BAD_OUT = /(budget|quota|exhausted|limit exceeded|try again later|rate.?limit|insufficient balance|not enough|每日.{0,6}(上限|额度)|额度.{0,6}用尽)/i;
async function probe(u, { chatModel } = {}) {
  let base = u.replace(/\/+$/, '');
  if (/\/models$/.test(base)) base = base.replace(/\/models$/, '');
  if (!/\/(v1|openai|api|anthropic|compatible-mode)$/.test(base)) base = base + '/v1';
  const out = { base, modelsStatus: 0, modelsOpen: false, n: 0, sample: '', chatStatus: 0, chatUsable: false, chatSnippet: '', err: null };
  try {
    const res = await fetch(modelsUrl(base), { headers: { 'user-agent': UA, accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(12000) });
    out.modelsStatus = res.status; const m = contentTypeOpen(await res.text());
    out.modelsOpen = m.open; out.n = m.n; out.sample = m.sample;
  } catch (e) { out.err = 'models:' + String(e).slice(0, 60); return out; }
  const model = chatModel || out.sample.split(',')[0] || 'gpt-4o-mini';
  try {
    const res = await fetch(base + '/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify({ model, max_tokens: 24, messages: [{ role: 'user', content: 'Reply with exactly: PONG' }] }),
      signal: AbortSignal.timeout(30000),
    });
    out.chatStatus = res.status; const body = await res.text();
    const txt = chatText(body);
    // 关键坑（账号18 的停用原因就是它）：pollinations 类站在额度耗尽时返回 **HTTP 200 + 预算错误文本**，
    // 只看"200 且有内容"会把它判成可用 → 必须识别错误文本，否则会把坏源塞进池子（表现为"降智"）
    out.budgetTextHit = BAD_OUT.test(txt);
    out.chatUsable = res.status === 200 && txt.length > 0 && !out.budgetTextHit;
    out.chatSnippet = txt.slice(0, 40) || body.slice(0, 90).replace(/\s+/g, ' ');
  } catch (e) { out.err = (out.err || '') + ' chat:' + String(e).slice(0, 60); }
  return out;
}
// 入池唯一判据：匿名 chat 真出词（models 可见不够格）
export const isPoolable = p => !!p && p.chatUsable === true;

/* ---------------- 源不可达保护（0 命中 = 采集故障，不得当成"全站下架"事实，更不得覆写 last-good） ---------------- */
export function sectionsOk(cur) {
  return {
    stations: cur.stations.length > 0 && !cur.sourceErrors.publicBenefit,
    benefits: cur.benefits.length > 0 && !cur.sourceErrors.benefits,
    mirror: cur.mirror.length > 0 && !cur.sourceErrors.linuxdoMirror,
    v2ex: cur.v2ex.length > 0 && !cur.sourceErrors.v2exTag,
  };
}
export function mergeLastGood(cur, prev, ok) {
  if (!prev) return { merged: cur, stale: [] };
  const stale = [];
  const map = { stations: ['publicBenefit', 'stations'], benefits: [null, 'benefits'], mirror: [null, 'mirror'], v2ex: [null, 'v2ex'] };
  for (const [sec, [, field]] of Object.entries(map)) {
    if (!ok[sec] && Array.isArray(prev[field]) && prev[field].length) { cur[sec] = prev[field]; (cur.staleSections ||= {})[sec] = prev.ts; stale.push(sec); }
  }
  return { merged: cur, stale };
}
export function diff(oldS, newS, ok = { stations: true, benefits: true, mirror: true, v2ex: true }) {
  const d = { newStations: [], goneStations: [], stationChanges: [], newBatches: [], goneBatches: [], stockDrops: [], newTopics: [], newV2ex: [], anonOpen: [], controlFailed: false };
  const key = s => s.slug || (s.name + '@' + (s.domain || ''));
  if (oldS && ok.stations && oldS.stations.length) {
    const om = new Map(oldS.stations.map(s => [key(s), s])), nm = new Map(newS.stations.map(s => [key(s), s]));
    // 只有"上一轮采集成功且这一轮也成功"才允许报下架（防 fetch 抖动造出全站下架假告警）
    if (om.size && nm.size) for (const [k, v] of om) if (!nm.has(k)) d.goneStations.push(v.name);
    for (const [k, v] of nm) if (!om.has(k)) d.newStations.push(v.name + (v.domain ? ' (' + v.domain + ')' : ''));
    for (const [k, v] of nm) { const o = om.get(k); if (!o) continue;
      if (o.avail7d !== v.avail7d || o.score !== v.score) d.stationChanges.push(`${v.name}: 可用率 ${o.avail7d}%→${v.avail7d}% / 分 ${o.score}→${v.score}`); }
  }
  if (oldS && ok.benefits && oldS.benefits.length) {
    const ob = new Map(oldS.benefits.map(b => [b.merchant + '|' + b.batch, b])), nb = new Map(newS.benefits.map(b => [b.merchant + '|' + b.batch, b]));
    for (const [k, v] of nb) { if (!ob.has(k)) { d.newBatches.push(`${v.merchant}: ${v.quota} (余${v.stock}, ${v.endsIn})`); continue; }
      const o = ob.get(k); if (v.stock < o.stock) d.stockDrops.push(`${v.merchant}: 库存 ${o.stock}→${v.stock}`); }
    if (ob.size && nb.size) for (const [k, v] of ob) if (!nb.has(k)) d.goneBatches.push(v.merchant);
  }
  if (oldS && ok.mirror && oldS.mirror.length) { const ot = new Set(oldS.mirror.map(x => x.title)); d.newTopics = newS.mirror.filter(x => !ot.has(x.title)).map(x => x.title); }
  if (oldS && ok.v2ex && oldS.v2ex.length) { const ov = new Set(oldS.v2ex.map(x => x.id)); d.newV2ex = newS.v2ex.filter(x => !ov.has(x.id)); }
  d.anonOpen = (newS.probes || []).filter(p => !p.control && !p.negControl && isPoolable(p));
  if (!(newS.probes || []).some(p => p.control && isPoolable(p))) d.controlFailed = true;
  const neg = (newS.probes || []).find(p => p.negControl);
  d.negControlLeak = !!(neg && isPoolable(neg));
  return d;
}

/* ---------------- selftest ---------------- */
function selftest() {
  let fails = 0; const ck = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
  const fx = existsSync(FIXTURE.publicBenefit);
  if (!fx) { console.log('SKIP fixture-based tests (no ' + FIXTURE.publicBenefit + ')'); return fails; }
  const st = parseStations(readFileSync(FIXTURE.publicBenefit, 'utf8'));
  ck(st.length >= 5, `parseStations 命中 ${st.length} 家（应 >=5，6 家目录）`);
  ck(st.every(s => !/持续监测|模型实测|分钟前|刚刚|\d{1,2}:\d{2}/.test(s.name)), '站名干净（无相邻文案污染 → diff 键稳定，不产假告警）');
  ck(st.filter(s => s.domain).length >= 3, `域名解析到 ${st.filter(s => s.domain).length}/${st.length} 家`);
  const ar = st.find(s => /Agent Router/.test(s.name));
  ck(ar && ar.domain === 'agentrouter.org', `Agent Router 域名=${ar ? ar.domain : 'n/a'}（须为 agentrouter.org，抓到 w3.org 即黑名单失效）`);
  ck(st.some(s => /Agent Router/i.test(s.name) && s.avail7d === 100 && s.score === 96), 'Agent Router 可用率/评分解析正确');
  ck(st.some(s => s.benefits.some(b => /70/.test(b))), 'JustDoWork 注册$70 被解析');
  const bs = parseBenefits(readFileSync(FIXTURE.benefits, 'utf8'));
  ck(bs.length >= 8, `parseBenefits 命中 ${bs.length} 批（应 >=8）`);
  ck(bs.some(b => /LV Ping/.test(b.merchant) && b.stock === 8), 'LV Ping 库存 8 解析正确');
  const tg = parseMirror(readFileSync(FIXTURE.linuxdoMirror, 'utf8'));
  ck(tg.length >= 1, `linux.do 镜像命中 ${tg.length} 条福利相关`);
  const vx = parseV2ex(readFileSync(FIXTURE.v2exTag, 'utf8'));
  ck(vx.length >= 1, `v2ex tag 命中 ${vx.length} 条主题（0 命中=检索串失效）`);
  // diff logic: removing an entry from baseline must show as "new" in current
  const base = { stations: st.slice(1), benefits: bs.slice(1), mirror: tg.slice(1), v2ex: vx.slice(1), probes: [] };
  const cur = { stations: st, benefits: bs, mirror: tg, v2ex: vx, probes: [{ control: true, chatUsable: true }] };
  const dd = diff(base, cur);
  ck(dd.newStations.length >= 1 && dd.newBatches.length >= 1 && (dd.newTopics.length + dd.newV2ex.length) >= 1, 'diff 能识别新增（合成对照通过）');
  ck(dd.stockDrops.length === 0, 'diff 不误报库存下降');
  // 入池门（本轮真实教训：suyu models 200 但 chat 401，只看 models 会把不能用的站报成可入池）
  ck(chatText('{"choices":[{"message":{"content":"PONG"}}]}') === 'PONG', 'chatText 正常出词');
  ck(chatText('{"choices":[{"message":{"content":""}}]}') === '', 'chatText 空出词=假可用要能识别');
  ck(isPoolable({ chatUsable: true }) === true, '门: chat 出词可入池');
  ck(isPoolable({ chatUsable: false, modelsOpen: true, modelsStatus: 200 }) === false, '门: 仅 models 开放不得入池');
  ck(BAD_OUT.test('Free budget exhausted, try again later'), '门: 200+预算错误文本要能识别(账号18 教训)');
  ck(!BAD_OUT.test('PONG, sure thing'), '门: 正常出词不得被误杀');
  ck(diff(null, { stations: [], benefits: [], mirror: [], v2ex: [], probes: [{ negControl: true, chatUsable: false }] }).negControlLeak === false, '负对照: suyu 类不得被判可用');
  // 端点归一化对照（假失败=假绿源头，必须单独测）
  ck(modelsUrl('https://text.pollinations.ai/openai') === 'https://text.pollinations.ai/openai/models', 'modelsUrl: /openai 补 /models');
  ck(modelsUrl('https://crowllm.com/v1') === 'https://crowllm.com/v1/models', 'modelsUrl: /v1 不重复拼接');
  ck(modelsUrl('https://api.ykh.ai') === 'https://api.ykh.ai/v1/models', 'modelsUrl: 裸域补 /v1/models');
  ck(modelsUrl('https://text.pollinations.ai/openai/models') === 'https://text.pollinations.ai/openai/models', 'modelsUrl: 完整端点幂等');
  // 源抖动保护（本轮真实教训：goaihop fetch failed → stations=0 → 假报"6 家全下架"并覆写 last-good）
  const prevGood = { ts: 'x', sourceErrors: {}, stations: st, benefits: bs, mirror: tg, v2ex: vx, probes: [] };
  const curBad = { ts: 'y', sourceErrors: { publicBenefit: 'fetch failed', benefits: 'fetch failed', linuxdoMirror: 'fetch failed', v2exTag: 'fetch failed' }, stations: [], benefits: [], mirror: [], v2ex: [], probes: [{ control: true, chatUsable: true }] };
  const okBad = sectionsOk(curBad);
  ck(okBad.stations === false, 'sectionsOk: 抓空+源报错 → 判为不可用');
  const mg = mergeLastGood(curBad, prevGood, okBad);
  ck(mg.stale.length === 4 && mg.merged.stations.length === st.length, 'mergeLastGood: 沿用 last-good，不覆写空数据');
  const dBad = diff(prevGood, mg.merged, okBad);
  ck(dBad.goneStations.length === 0 && dBad.goneBatches.length === 0 && dBad.newStations.length === 0, '源抖动不得产假"下架/新增"告警');
  return fails;
}

/* ---------------- main ---------------- */
const argv = process.argv.slice(2);
if (argv.includes('--selftest')) { const f = selftest(); console.log(`SELFTEST ${f === 0 ? 'ALL PASS' : f + ' FAILED'}`); process.exit(f ? 1 : 0); }
mkdirSync(SNAPDIR, { recursive: true });
const useFx = argv.includes('--fixtures');
const raw = {}; const errs = {};
for (const k of Object.keys(SRC)) { const r = await get(k, useFx); raw[k] = r.html || ''; if (r.err) errs[k] = r.err; }
const stations = parseStations(raw.publicBenefit);
const benefits = parseBenefits(raw.benefits);
const mirror = parseMirror(raw.linuxdoMirror);
const v2ex = parseV2ex(raw.v2exTag);
const probes = [];
for (const u of CONTROL) { const p = await probe(u); probes.push({ ...p, control: true, name: 'pollinations(对照)' }); }
{ const p = await probe(NEG_CONTROL); probes.push({ ...p, negControl: true, name: 'suyu(负对照:models开/chat关)' }); }
for (const s of stations) { if (!s.domain) continue; const p = await probe('https://' + s.domain); probes.push({ ...p, name: s.name }); }
const ctrl = probes.find(p => p.control && isPoolable(p));
const neg = probes.find(p => p.negControl);
const cur = { ts: new Date().toISOString(), sourceErrors: errs, stations, benefits, mirror, v2ex, probes };
const prevPath = SNAPDIR + 'snapshot-latest.json';
const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) : null;
const ok = sectionsOk(cur);
const { stale } = mergeLastGood(cur, prev, ok);   // 源抖动时保留 last-good，不覆写空数据
const d = diff(prev, cur, ok);
const stamp = cur.ts.replace(/[:\-]/g, '').slice(0, 13);
writeFileSync(SNAPDIR + 'snapshot-' + stamp + '.json', JSON.stringify(cur, null, 1));
if (prev) renameSync(prevPath, SNAPDIR + 'snapshot-prev.json');
writeFileSync(prevPath, JSON.stringify(cur, null, 1));

const alerts = [];
if (d.controlFailed) alerts.push('🔴 阳性对照失败（pollinations chat 未出词）→ 本轮"无可入池"结论**不可信**，先修探测链路再读结果');
if (d.negControlLeak) alerts.push('🔴 负对照异常：已知"models 开/chat 关"的 suyu 被判可入池 → 门控失效，本轮 anonOpen 全部作废');
for (const p of d.anonOpen) alerts.push(`🟢 匿名 chat 真出词：${p.base} → ${p.n} models（样本 ${p.sample.slice(0, 60)}）出词="${p.chatSnippet}" —— **可入池**（add-free-api-pool.mjs, prio90/conc1/group5）`);
probes.filter(p => p.modelsOpen && !p.chatUsable && !p.control && !p.negControl)
  .forEach(p => alerts.push(`🟡 仅清单开放（不可入池）：${p.base} models ${p.modelsStatus}/chat ${p.chatStatus} → 需注册领 key`));
d.newStations.forEach(s => alerts.push(`🆕 新公益站 ${s}`));
d.goneStations.forEach(s => alerts.push(`⚫ 公益站下架 ${s}`));
d.stationChanges.forEach(s => alerts.push(`📊 ${s}`));
d.newBatches.forEach(b => alerts.push(`🎁 新码批次 ${b}`));
d.stockDrops.forEach(b => alerts.push(`📉 ${b}`));
d.goneBatches.forEach(b => alerts.push(`⛔ 码批次消失 ${b}`));
d.newTopics.forEach(t => alerts.push(`💬 linux.do 新帖: ${t.slice(0, 90)}`));
d.newV2ex.forEach(t => alerts.push(`💬 v2ex 新主题: ${t.title.slice(0, 90)} ${t.url}`));
Object.keys(errs).forEach(k => alerts.push(`⚠️ 源不可达 ${k}: ${errs[k]}`));
stale.forEach(s => alerts.push(`🛡 ${s} 本轮采集失败 → 沿用 last-good 快照（不报下架、不覆写）`));

const md = ['# 免费额度监控告警', `> 生成 ${cur.ts}${useFx ? '（fixtures 模式）' : ''} · 公益站 ${stations.length} · 码批次 ${benefits.length} · 阳性对照 ${ctrl ? 'OK' : 'FAILED'}`, '',
  prev ? '## 与上轮 diff' : '## 首轮基线（无上轮可比）', ...(alerts.length ? alerts : ['（无变化）']), '',
  '## 当前公益中转站快照', ...stations.map(s => `- ${s.name} \`${s.domain || '?'}\` 模型${s.models} 可用率${s.avail7d}% 评分${s.score} ${(s.benefits || []).join(' / ')}`),
  '## 当前福利码批次', ...benefits.map(b => `- ${b.merchant} · ${b.batch} → **${b.quota}** 余 ${b.stock}（${b.endsIn}）`),
  '## 匿名实测（两级门：models 可见 / chat 真出词）',
  ...probes.map(p => `- ${p.control ? '[阳性对照]' : p.negControl ? '[负对照]' : p.name} \`${p.base}\` models:${p.modelsStatus}${p.modelsOpen ? '(' + p.n + ')' : ''} chat:${p.chatStatus} → **${isPoolable(p) ? 'POOLABLE 出词="' + p.chatSnippet + '"' : (p.modelsOpen ? '仅清单开放' : '不可用')}**${p.err ? ' ' + p.err : ''}`), ''];
writeFileSync(ROOT + 'FREE-QUOTA-MONITOR.md', md.join('\n'));
if (!argv.includes('--quiet')) {
  console.log(`stations=${stations.length} batches=${benefits.length} mirror=${mirror.length} v2ex=${v2ex.length} control=${ctrl ? 'OK' : 'FAILED'} anonOpen=${d.anonOpen.length}`);
  console.log(alerts.slice(0, 40).join('\n'));
  console.log('snapshot -> ' + prevPath + ' | alerts -> ' + ROOT + 'FREE-QUOTA-MONITOR.md');
}

/* ---------------- 并列数据源：官方免费档（yangmao 数据集） ----------------
 * 本模块只见公益中转站（易跑路短期源）；官方免费档是长期稳定源，二者互补。
 * 独立成 free-official-tiers.mjs（含自己的自测与快照），此处只做**汇总调用**：
 * 任一子步失败都不得影响主监控结论。
 * 用 --no-official 可跳过；用 --official-only 可只跑官方档。
 */
if (!argv.includes('--no-official')) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [ROOT + 'free-official-tiers.mjs', ...(argv.includes('--quiet') ? ['--quiet'] : [])], {
    stdio: argv.includes('--quiet') ? 'pipe' : 'inherit',
    timeout: 90000,
  });
  if (!argv.includes('--quiet')) {
    console.log(r.status === 0 ? '✅ 官方免费档追踪已并入（见 FREE-OFFICIAL-TIERS.md）' : `⚠️ 官方免费档追踪失败（exit ${r.status}），不影响本轮公益站结论`);
  }
}
