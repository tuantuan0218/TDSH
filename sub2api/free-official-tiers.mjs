/**
 * 官方免费档追踪器（yangmao-official-free-tiers）
 *
 * 定位：free-quota-monitor.mjs 的**并列数据源模块**（不侵入原监控逻辑）。
 *   - 原监控盯：公益中转站（GoAIHop）+ 福利码批次 + 论坛新帖 —— 都是"易跑路"的短期源
 *   - 本模块盯：168 家**官方厂商**免费档 —— 长期稳定源，变化慢但价值高（额度涨跌/停送/新增）
 *
 * 数据源：https://yangmao.ai/data/exports/ai-free-tiers.json（每日更新，含 last_verified/proof_url）
 *
 * 铁律（与主监控一致）：**绝不写入任何 key 明文**，只存厂商名/额度描述/限速/链接。
 *
 * 用法：
 *   node free-official-tiers.mjs              # 抓取 -> 快照 -> diff -> 写报告
 *   node free-official-tiers.mjs --selftest   # 纯函数断言，不联网
 *   node free-official-tiers.mjs --quiet
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';

const ROOT = 'D:/tdsh/sub2api/';
const SNAPDIR = ROOT + 'free-official-snapshots/';
const SRC_URL = 'https://yangmao.ai/data/exports/ai-free-tiers.json';
const SINKS = {
  report: ROOT + 'FREE-OFFICIAL-TIERS.md',
  dataset: ROOT + '_freeapi_probe/ai-free-tiers.json', // 原始存档，便于离线复算
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* ---------------- 纯函数区（可离线自测） ---------------- */

/** 纯本地自托管项不是"API key 渠道"，不纳入追踪 */
export const LOCAL_HOSTS = new Set([
  'llama.cpp', 'LM Studio', 'LocalAI', 'Ollama', 'vLLM', 'TextGen',
  'Jan', 'Continue', 'Tabby', 'Aider',
]);

/** 把原始 providers[] 规范化为稳定可 diff 的记录（字段顺序固定 → diff 键稳定） */
export function normalizeProviders(providers) {
  return (providers || [])
    .filter((p) => p && p.id)
    .map((p) => ({
      id: String(p.id),
      name: p.name_zh || p.name || String(p.id),
      nameEn: p.name || '',
      credits: p.api_free_credits || '',
      rate: p.api_rate_limit || '',
      hasFreeApi: !!p.has_free_api,
      chinaDirect: !!p.china_direct,
      openaiCompat: !!p.openai_compatible,
      models: (p.models || [])
        .map((m) => (typeof m === 'string' ? m : m.name || m.id || m.model || ''))
        .filter(Boolean)
        .sort(),
      url: p.url || '',
      verified: p.last_verified || '',
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 只保留"值得跟踪变化"的子集：有免费 API 且非本地自托管 */
export function trackable(records) {
  return records.filter((r) => r.hasFreeApi && !LOCAL_HOSTS.has(r.nameEn) && !LOCAL_HOSTS.has(r.name));
}

/** 与上轮对比：额度/限速/模型/大陆直连 的变化 */
export function diffTiers(prev, cur) {
  const d = { added: [], removed: [], creditChanged: [], rateChanged: [], modelChanged: [], accessChanged: [], verifiedStale: [] };
  if (!prev || !Array.isArray(prev.records)) return d;
  const pm = new Map(prev.records.map((r) => [r.id, r]));
  const cm = new Map(cur.map((r) => [r.id, r]));

  for (const [id, c] of cm) {
    const p = pm.get(id);
    if (!p) { d.added.push(`${c.name} (${c.credits || '额度未标'})`); continue; }
    if (p.credits !== c.credits) d.creditChanged.push(`${c.name}: 额度 「${p.credits || '空'}」→「${c.credits || '空'}」`);
    if (p.rate !== c.rate) d.rateChanged.push(`${c.name}: 限速 ${p.rate || '空'} → ${c.rate || '空'}`);
    if (p.models.join(',') !== c.models.join(',')) {
      const gone = p.models.filter((m) => !c.models.includes(m));
      const gain = c.models.filter((m) => !p.models.includes(m));
      if (gone.length || gain.length) {
        d.modelChanged.push(`${c.name}: ${gain.length ? '+' + gain.slice(0, 3).join('/') : ''}${gone.length ? ' -' + gone.slice(0, 3).join('/') : ''}`);
      }
    }
    if (p.chinaDirect !== c.chinaDirect) d.accessChanged.push(`${c.name}: 大陆直连 ${p.chinaDirect ? '有' : '无'} → ${c.chinaDirect ? '有' : '无'}`);
  }
  for (const [id, p] of pm) if (!cm.has(id)) d.removed.push(`${p.name}（该厂商已从免费档清单移除）`);
  return d;
}

/**
 * 数据陈旧判定：源生成时间距今超过 maxDays 天，则提示"结论可能过期"。
 * 理由：额度政策变得快，只看旧快照会得出错误结论。
 */
export function staleness(generatedAt, nowMs, maxDays = 14) {
  const t = Date.parse(generatedAt);
  if (!Number.isFinite(t)) return { stale: true, ageDays: null, reason: 'generated_at 不可解析' };
  const ageDays = Math.floor((nowMs - t) / 86400000);
  return { stale: ageDays > maxDays, ageDays, reason: ageDays > maxDays ? `源数据已 ${ageDays} 天未更新` : '新鲜' };
}

/** 汇总漏斗：全库 -> 免费API -> 大陆直连 -> 双兼容（用于报告头，一眼看变化） */
export function funnel(records) {
  const free = records.filter((r) => r.hasFreeApi);
  const cn = free.filter((r) => r.chinaDirect);
  return {
    total: records.length,
    freeApi: free.length,
    chinaDirect: cn.length,
    cnCompat: cn.filter((r) => r.openaiCompat).length,
  };
}

/* ---------------- 抓取 ---------------- */

async function fetchJson(url) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) return { err: `HTTP ${res.status}`, json: null };
    return { err: null, json: await res.json() };
  } catch (e) {
    return { err: String(e).slice(0, 140), json: null };
  } finally { clearTimeout(tm); }
}

/* ---------------- 新鲜数据源：OpenRouter 实时模型目录 ----------------
 * 背景：yangmao 数据集 generated_at 常滞后数月（实测 2026-06-24 距今 80 天）→
 *       "额度未变化"这一结论本身会失真。故补一路**免 key、实时**的数据源做交叉验证。
 * 实测：GET https://openrouter.ai/api/v1/models 免 key 返回 200，445 模型 / 22 个零价模型。
 * 口径：pricing.prompt 与 pricing.completion 同时为 0 → 判定为"当前免费"。
 *       这是**可实时复验的硬事实**（价格字段），不是二手整理的描述文字。
 */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models';

/** 从 OpenRouter 原始响应提取免费模型（纯函数，可离线自测） */
export function extractFreeModels(json) {
  const list = (json && json.data) || [];
  return list
    .filter((m) => m && m.id && m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)
    .map((m) => ({
      id: String(m.id),
      name: m.name || '',
      ctx: m.context_length || 0,
      modality: (m.architecture && m.architecture.modality) || '',
      created: m.created || 0,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 免费模型集合的 diff（新增/消失/上下文变化） */
export function diffFreeModels(prev, cur) {
  const d = { freeAdded: [], freeRemoved: [], ctxChanged: [] };
  if (!prev || !Array.isArray(prev)) return d;
  const pm = new Map(prev.map((m) => [m.id, m]));
  const cm = new Map(cur.map((m) => [m.id, m]));
  for (const [id, c] of cm) {
    const p = pm.get(id);
    if (!p) { d.freeAdded.push(`${c.id} (ctx ${c.ctx || '-'})`); continue; }
    if (p.ctx !== c.ctx) d.ctxChanged.push(`${c.id}: 上下文 ${p.ctx}→${c.ctx}`);
  }
  for (const [id, p] of pm) if (!cm.has(id)) d.freeRemoved.push(`${p.id}（已不再免费/下架）`);
  return d;
}

/* ---------------- selftest（离线，含正/负对照） ---------------- */

function selftest() {
  let fails = 0;
  const ck = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };

  // 规范化 + 稳定排序
  const raw = [
    { id: 'b', name: 'Beta', has_free_api: true, china_direct: true, openai_compatible: true, api_free_credits: '$5', api_rate_limit: '5 RPM', models: [{ name: 'm2' }, { name: 'm1' }], url: 'https://b.example' },
    { id: 'a', name_zh: '阿尔法', name: 'Alpha', has_free_api: true, china_direct: false, openai_compatible: false, api_free_credits: '', models: [], url: 'https://a.example' },
  ];
  const rec = normalizeProviders(raw);
  ck(rec.length === 2, `normalizeProviders 保留 ${rec.length} 条`);
  ck(rec[0].id === 'a' && rec[1].id === 'b', '排序按 id 稳定（diff 键不抖动）');
  ck(rec[1].models.join(',') === 'm1,m2', 'models 已排序（避免顺序抖动造假变化）');
  ck(rec[0].name === '阿尔法', '优先用中文名');

  // 本地自托管剔除
  const withLocal = normalizeProviders([...raw, { id: 'ollama', name: 'Ollama', has_free_api: true, models: [] }]);
  ck(!trackable(withLocal).some((r) => r.id === 'ollama'), '本地自托管项被剔除（非 API key 渠道）');

  // 漏斗
  const f = funnel(rec);
  ck(f.total === 2 && f.freeApi === 2 && f.chinaDirect === 1 && f.cnCompat === 1, `漏斗 ${JSON.stringify(f)}`);

  // diff：新增 / 移除 / 额度变化 / 限速变化 / 模型变化 / 直连变化
  // 构造六类变化各一条：a 保留但翻转直连；b 改额度/限速/模型；c 新增；NullProv 移除
  // 注意：必须用基础数据构造，避免 `...raw[0]` 带出 name_zh 覆盖 name 造成"改名"假变化
  const mkA = (o = {}) => ({ id: 'a', name: 'Alpha', has_free_api: true, china_direct: false, openai_compatible: false, api_free_credits: '', models: [], url: 'https://a.example', ...o });
  const mkB = (o = {}) => ({ id: 'b', name: 'Beta', has_free_api: true, china_direct: true, openai_compatible: true, api_free_credits: '$5', api_rate_limit: '5 RPM', models: [{ name: 'm2' }, { name: 'm1' }], url: 'https://b.example', ...o });

  const prev = { records: normalizeProviders([mkA(), mkB(), { id: 'null_provider', name: 'NullProv', has_free_api: true, models: [] }]) };
  const changed = normalizeProviders([
    mkA({ china_direct: true }),                                                             // a: 直连 false→true
    mkB({ api_free_credits: '$10', api_rate_limit: '10 RPM', models: [{ name: 'm1' }, { name: 'm3' }] }), // b: 额度+限速+模型
    { id: 'c', name: 'Gamma', has_free_api: true, china_direct: true, openai_compatible: true, api_free_credits: '$1', models: [] }, // 新增
  ]);
  const d = diffTiers(prev, changed);
  ck(d.creditChanged.length === 1, `检出额度变化 ${d.creditChanged.length} 条`);
  ck(d.rateChanged.length === 1, `检出限速变化 ${d.rateChanged.length} 条`);
  ck(d.modelChanged.length === 1, `检出模型变化 ${d.modelChanged.length} 条`);
  ck(d.added.length === 1, `检出新增厂商 ${d.added.length} 条`);
  ck(d.removed.length === 1, `检出移除厂商 ${d.removed.length} 条`);
  ck(d.accessChanged.length === 1, `检出直连状态变化 ${d.accessChanged.length} 条`);

  // 负对照：同一份数据自比必须零告警（防假告警）
  const dSelf = diffTiers({ records: changed }, normalizeProviders([
    mkA({ china_direct: true }),
    mkB({ api_free_credits: '$10', api_rate_limit: '10 RPM', models: [{ name: 'm1' }, { name: 'm3' }] }),
    { id: 'c', name: 'Gamma', has_free_api: true, china_direct: true, openai_compatible: true, api_free_credits: '$1', models: [] },
  ]));
  const noise = Object.values(dSelf).reduce((n, v) => n + v.length, 0);
  ck(noise === 0, `负对照：数据未变时报出 ${noise} 条假变化（必须为 0）`);

  // 首轮无 prev：不得抛错、不得把全量当"新增"
  const dNull = diffTiers(null, rec);
  ck(dNull.added.length === 0, '首轮无基线时不把全量误报为新增');

  // 陈旧判定
  const now = Date.parse('2026-09-13T00:00:00Z');
  ck(staleness('2026-09-12T00:00:00Z', now).stale === false, '1 天前的数据判为新鲜');
  ck(staleness('2026-08-01T00:00:00Z', now).stale === true, '43 天前的数据判为陈旧');
  ck(staleness('not-a-date', now).stale === true, '非法时间戳判为陈旧（保守）');

  /* --- OpenRouter 实时免费模型（新鲜数据源） --- */
  const orFixture = {
    data: [
      { id: 'a/free-model:free', name: 'FreeA', context_length: 1000, pricing: { prompt: '0', completion: '0' }, architecture: { modality: 'text' } },
      { id: 'b/paid-model', name: 'PaidB', context_length: 2000, pricing: { prompt: '0.000001', completion: '0.000002' }, architecture: { modality: 'text' } },
      { id: 'c/half-free', name: 'HalfC', context_length: 3000, pricing: { prompt: '0', completion: '0.5' }, architecture: { modality: 'text' } },
      { id: 'd/free-ok:free', name: 'FreeD', context_length: 4000, pricing: { prompt: '0', completion: '0' }, architecture: { modality: 'text+image' } },
      { id: 'e/no-pricing', name: 'NoPrice' },
    ],
  };
  const fm = extractFreeModels(orFixture);
  ck(fm.length === 2, `extractFreeModels 命中 ${fm.length} 个真免费（应 2）`);
  ck(fm.every((m) => m.id.includes('free-model') || m.id.includes('free-ok')), '只保留 prompt+completion 同时为 0 的模型');
  ck(!fm.some((m) => m.id.includes('half-free')), '负对照：仅 prompt=0 但 completion 收费的半免费模型被排除');
  ck(!fm.some((m) => m.id.includes('paid-model')), '负对照：收费模型被排除');
  ck(!fm.some((m) => m.id.includes('no-pricing')), '负对照：缺 pricing 字段的模型被安全跳过（不抛错）');
  ck(extractFreeModels(null).length === 0, 'null 输入安全返回空（不抛错）');

  const fd = diffFreeModels(fm, extractFreeModels({
    data: [
      ...orFixture.data,
      { id: 'x/new-free:free', name: 'NewFree', context_length: 500, pricing: { prompt: '0', completion: '0' }, architecture: { modality: 'text' } },
    ],
  }));
  ck(fd.freeAdded.length === 1, `检出新增免费模型 ${fd.freeAdded.length} 条`);
  ck(fd.freeRemoved.length === 0, '无消失时不误报');
  const fdNull = diffFreeModels(null, fm);
  ck(fdNull.freeAdded.length === 0, '首轮无基线时不把全量误报为新增');
  const fdSame = diffFreeModels(fm, extractFreeModels(orFixture));
  ck(fdSame.freeAdded.length + fdSame.freeRemoved.length + fdSame.ctxChanged.length === 0, '负对照：同一份数据自比零告警');

  console.log(`SELFTEST ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
  return fails;
}

/* ---------------- main ---------------- */

// 守卫：仅当本文件被直接执行时才跑 main。
// 否则任何 `import` 都会触发联网抓取 + 写快照（副作用泄漏），selftest 也会被污染。
const isDirectRun = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest() ? 1 : 0);
  await main(argv);
}

async function main(argv) {
  mkdirSync(SNAPDIR, { recursive: true });

  // 新鲜数据源（OpenRouter 实时目录）：先抓，用于交叉验证陈旧的 yangmao 数据
  const or = await fetchJson(OPENROUTER_URL);
  const freeModels = or.err ? [] : extractFreeModels(or.json);
  const orOk = !or.err && freeModels.length > 0;

  const { err, json } = await fetchJson(SRC_URL);

// 源不可达：沿用 last-good，绝不把空数据写成"全部厂商下架"
const latestPath = SNAPDIR + 'snapshot-latest.json';
const prev = existsSync(latestPath) ? JSON.parse(readFileSync(latestPath, 'utf8')) : null;

if (err || !json || !Array.isArray(json.providers) || !json.providers.length) {
  console.log(`⚠️ 源不可达或结构异常：${err || 'providers 为空'} → 沿用 last-good，不覆写快照`);
  return;
}

writeFileSync(SINKS.dataset, JSON.stringify(json, null, 1));

const records = trackable(normalizeProviders(json.providers));
const all = normalizeProviders(json.providers);
const f = funnel(all);
const st = staleness(json.generated_at, Date.now());
const d = prev ? diffTiers(prev, records) : diffTiers(null, records);

// 新鲜数据源兜底：OpenRouter 抓取失败时沿用上轮 last-good，不写空
const prevFree = (prev && Array.isArray(prev.freeModels) && prev.freeModels.length) ? prev.freeModels : null;
const effFree = (orOk || !prevFree) ? freeModels : prevFree;
const orStale = !orOk && !!prevFree;
const fd = diffFreeModels(prevFree, effFree);

const cur = {
  ts: new Date().toISOString(),
  sourceGeneratedAt: json.generated_at,
  schema: json.schema_version,
  funnel: f,
  records,
  freeModels: effFree,
  freeModelsSource: orOk ? 'openrouter-live' : (orStale ? 'last-good(openrouter 抓取失败)' : 'unavailable'),
  sourceErrors: { yangmao: err || null, openrouter: or.err || null },
};
const stamp = cur.ts.replace(/[:\-]/g, '').slice(0, 13);
writeFileSync(SNAPDIR + 'snapshot-' + stamp + '.json', JSON.stringify(cur, null, 1));
if (prev) renameSync(latestPath, SNAPDIR + 'snapshot-prev.json');
writeFileSync(latestPath, JSON.stringify(cur, null, 1));

/* ---------------- 报告 ---------------- */
const alerts = [];
if (st.stale) alerts.push(`⏳ **源数据陈旧**：${st.reason}（generated_at=${json.generated_at}）→ 厂商额度结论可能已过期，需去官方控制台复核`);
if (!prev) alerts.push('ℹ️ 首轮基线已建立，下一轮起可 diff');
if (orOk) {
  alerts.push(`🟢 **新鲜源在线**：OpenRouter 实时目录抓到 ${effFree.length} 个零价模型（可随时复核，不受 yangmao 陈旧拖累）`);
} else if (orStale) {
  alerts.push('🛡 OpenRouter 本轮抓取失败 → 沿用 last-good 免费模型清单（不报"免费模型消失"）');
} else {
  alerts.push('🔴 OpenRouter 实时源不可用且无 last-good → 本轮缺失新鲜侧证据，只看 yangmao 陈旧数据需谨慎');
}
if (st.stale && orOk) {
  alerts.push(`🔍 **交叉判读**：yangmao 描述陈旧（${st.ageDays} 天）但 OpenRouter 价格字段是实时的 → 前者当"厂商入口索引"用，后者当"当下是否真免费"的权威判据`);
}
d.added.forEach((x) => alerts.push(`🆕 新增免费档厂商 ${x}`));
d.removed.forEach((x) => alerts.push(`⚫ 免费档消失 ${x}`));
d.creditChanged.forEach((x) => alerts.push(`💰 额度变化 ${x}`));
d.rateChanged.forEach((x) => alerts.push(`⏱ 限速变化 ${x}`));
d.modelChanged.forEach((x) => alerts.push(`🧩 模型变化 ${x}`));
d.accessChanged.forEach((x) => alerts.push(`🌐 直连变化 ${x}`));
fd.freeAdded.forEach((x) => alerts.push(`🎉 新增零价模型 ${x}`));
fd.freeRemoved.forEach((x) => alerts.push(`💸 零价模型消失/转收费 ${x}`));
fd.ctxChanged.forEach((x) => alerts.push(`🧮 ${x}`));

const byId = (a, b) => (a.name < b.name ? -1 : 1);
const cnList = records.filter((r) => r.chinaDirect).sort(byId);

const md = [
  '# 官方免费档追踪（yangmao 数据集 + OpenRouter 实时目录）',
  `> 生成 ${cur.ts} · yangmao generated_at=${json.generated_at} · schema ${json.schema_version}`,
  `> 双源口径：**yangmao**=厂商入口索引（含额度/限速描述，但可能滞后）；**OpenRouter**=当下是否真免费的实时价格判据（源：${cur.freeModelsSource}）。`,
  `> 漏斗：全库 ${f.total} → 有免费API ${f.freeApi} → 大陆直连 ${f.chinaDirect} → 大陆+OpenAI兼容 **${f.cnCompat}**`,
  `> 追踪口径：有免费 API 且非本地自托管（共 ${records.length} 家）。**不含任何 key 明文**。`,
  '',
  prev ? '## 与上轮 diff' : '## 首轮基线（无上轮可比）',
  ...(alerts.length ? alerts : ['（无变化）']),
  '',
  `## OpenRouter 实时零价模型（${effFree.length} 个）`,
  '> 判据：`pricing.prompt == 0 && pricing.completion == 0`（实时可复核，非二手描述）',
  '',
  '| 模型 ID | 上下文 | 模态 |',
  '|---|---|---|',
  ...effFree.map((m) => `| ${m.id} | ${m.ctx || '-'} | ${m.modality || '-'} |`),
  '',
  `## 大陆直连免费档（${cnList.length} 家）`,
  '| 厂商 | 免费额度 | 限速 | 模型 | 入口 | 核验 |',
  '|---|---|---|---|---|---|',
  ...cnList.map((r) => `| ${r.name} | ${r.credits || '-'} | ${r.rate || '-'} | ${r.models.slice(0, 3).join(', ') || '-'} | ${r.url || '-'} | ${r.verified || '-'} |`),
  '',
];
writeFileSync(SINKS.report, md.join('\n') + '\n');

if (!argv.includes('--quiet')) {
  console.log(`official-tier records=${records.length} cnDirect=${f.chinaDirect} cnCompat=${f.cnCompat} stale=${st.stale} freeModels=${effFree.length}(${cur.freeModelsSource})`);
  alerts.slice(0, 30).forEach((a) => console.log(a));
  console.log(`snapshot -> ${latestPath} | report -> ${SINKS.report}`);
}
}
