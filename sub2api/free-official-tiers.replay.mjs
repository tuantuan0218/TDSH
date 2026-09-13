/**
 * 告警链路受控回放测试（free-official-tiers.replay.mjs）
 *
 * 目的：补上"验证产物而非验证函数"的缺口。
 *   原 selftest 的 21 项断言全部针对纯函数（normalizeProviders/diffTiers/...），
 *   但真正的交付物是 **落盘的报告 + 其中的告警行**。这条路径此前从未被端到端验证。
 *
 * 做法：不联网。直接 import 生产模块的导出函数，用**受控快照**构造变化，
 *   断言 buildAlerts 的产出文案 —— 即"真出变化时，告警真的会出现在报告里"。
 *
 * 用法：node free-official-tiers.replay.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import {
  normalizeProviders, diffTiers, diffFreeModels, extractFreeModels, buildAlerts,
} from './free-official-tiers.mjs';

let fails = 0;
const ck = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };

const SNAP = 'D:/tdsh/sub2api/free-official-snapshots/snapshot-latest.json';
const base = (o = {}) => ({
  id: 'p1', name: 'ProviderOne', has_free_api: true, china_direct: true,
  openai_compatible: true, api_free_credits: '$5', api_rate_limit: '5 RPM',
  models: [{ name: 'm1' }], url: 'https://p1.example', ...o,
});

/* ---------- 场景 1：额度变化 → 必须产出「💰 额度变化」告警 ---------- */
{
  const prev = { records: normalizeProviders([base()]), freeModels: [] };
  const cur = normalizeProviders([base({ api_free_credits: '$50' })]);
  const d = diffTiers(prev, cur);
  const alerts = buildAlerts({
    stale: { stale: false, ageDays: 1, reason: '新鲜' },
    generatedAt: '2026-09-13T00:00:00Z', hasPrev: true,
    orOk: true, orStale: false, freeModelCount: 3,
    diffs: d, freeDiffs: { freeAdded: [], freeRemoved: [], ctxChanged: [] },
  });
  ck(d.creditChanged.length === 1, '① diff 检出额度变化');
  ck(alerts.some((a) => a.includes('💰 额度变化') && a.includes('$5') && a.includes('$50')),
    '① 告警文案含「💰 额度变化」且带旧值→新值');
}

/* ---------- 场景 2：零价模型转收费 → 必须产出「💸」告警 ---------- */
{
  const prevFree = [{ id: 'x/free:free', name: 'F', ctx: 1000, modality: 'text->text', created: 0 }];
  const curFree = [];
  const fd = diffFreeModels(prevFree, curFree);
  const alerts = buildAlerts({
    stale: { stale: false, ageDays: 1, reason: '新鲜' },
    generatedAt: '2026-09-13T00:00:00Z', hasPrev: true,
    orOk: true, orStale: false, freeModelCount: 0,
    diffs: {}, freeDiffs: fd,
  });
  ck(fd.freeRemoved.length === 1, '② diff 检出零价模型消失');
  ck(alerts.some((a) => a.includes('💸 零价模型消失/转收费')),
    '② 告警文案含「💸 零价模型消失/转收费」');
}

/* ---------- 场景 3（负对照）：完全无变化 → 除例行提示外零告警 ---------- */
{
  const prev = { records: normalizeProviders([base()]), freeModels: [] };
  const cur = normalizeProviders([base()]);
  const d = diffTiers(prev, cur);
  const alerts = buildAlerts({
    stale: { stale: false, ageDays: 1, reason: '新鲜' },
    generatedAt: '2026-09-13T00:00:00Z', hasPrev: true,
    orOk: true, orStale: false, freeModelCount: 3,
    diffs: d, freeDiffs: { freeAdded: [], freeRemoved: [], ctxChanged: [] },
  });
  const noisy = alerts.filter((a) =>
    /🆕|⚫|💰|⏱|🧩|🌐|🎉|💸|🧮/.test(a));
  ck(noisy.length === 0, `③ 负对照：无变化时业务告警 ${noisy.length} 条（必须 0）`);
  ck(alerts.length === 1 && alerts[0].includes('🟢'),
    '③ 无变化时只剩 1 条「新鲜源在线」例行提示');
}

/* ---------- 场景 4：源陈旧 + 新鲜源在线 → 必须同时给出陈旧告警与交叉判读 ---------- */
{
  const alerts = buildAlerts({
    stale: { stale: true, ageDays: 80, reason: '源数据已 80 天未更新' },
    generatedAt: '2026-06-24T00:00:00Z', hasPrev: true,
    orOk: true, orStale: false, freeModelCount: 22,
    diffs: {}, freeDiffs: {},
  });
  ck(alerts.some((a) => a.includes('⏳') && a.includes('80 天')), '④ 产出陈旧告警');
  ck(alerts.some((a) => a.includes('🔍') && a.includes('交叉判读')), '④ 产出交叉判读告警');
}

/* ---------- 场景 5：OpenRouter 抓取失败 + 有 last-good → 沿用而非误报消失 ---------- */
{
  const alerts = buildAlerts({
    stale: { stale: false, ageDays: 1, reason: '新鲜' },
    generatedAt: '2026-09-13T00:00:00Z', hasPrev: true,
    orOk: false, orStale: true, freeModelCount: 22,
    diffs: {}, freeDiffs: {},
  });
  ck(alerts.some((a) => a.includes('🛡')), '⑤ 抓取失败时给出「沿用 last-good」提示');
  ck(!alerts.some((a) => a.includes('💸')), '⑤ 负对照：抓取失败不得误报「零价模型消失」');
}

/* ---------- 场景 6：首轮无基线 → 明确告知，且不把全量当新增 ---------- */
{
  const cur = normalizeProviders([base(), base({ id: 'p2', name: 'P2' })]);
  const d = diffTiers(null, cur);
  const alerts = buildAlerts({
    stale: { stale: false, ageDays: 1, reason: '新鲜' },
    generatedAt: '2026-09-13T00:00:00Z', hasPrev: false,
    orOk: true, orStale: false, freeModelCount: 1,
    diffs: d, freeDiffs: {},
  });
  ck(alerts.some((a) => a.includes('首轮基线')), '⑥ 首轮明确提示无基线');
  ck(!alerts.some((a) => a.includes('🆕 新增免费档厂商')), '⑥ 首轮不把全量误报为「新增厂商」');
}

/* ---------- 场景 7：真实快照回放（若有）→ 用线上真数据再跑一次 diff 不崩 ---------- */
{
  if (existsSync(SNAP)) {
    const snap = JSON.parse(readFileSync(SNAP, 'utf8'));
    const recs = snap.records || [];
    const d = diffTiers(snap, recs); // 自己跟自己比 → 必须零变化
    const noisy = Object.values(d).reduce((n, v) => n + v.length, 0);
    ck(recs.length > 0, `⑦ 真实快照载入 ${recs.length} 条记录`);
    ck(noisy === 0, `⑦ 真实快照自比零假变化（检出 ${noisy} 条，必须 0）`);

    const free = snap.freeModels || [];
    if (free.length) {
      const fz = diffFreeModels(free, free);
      const fnoisy = fz.freeAdded.length + fz.freeRemoved.length + fz.ctxChanged.length;
      ck(fnoisy === 0, `⑦ 真实免费模型清单自比零假变化（检出 ${fnoisy} 条）`);
    }
  } else {
    console.log('SKIP ⑦ 无真实快照（先跑一次 free-official-tiers.mjs）');
  }
}

console.log(`REPLAY ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
