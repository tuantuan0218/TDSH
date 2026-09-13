// 生成 OpenRouter 免费模型接入配置（key 到位即可一键入池）
// 输入：OpenRouter /api/v1/models 原始响应
// 输出：openrouter-free-config.json（含分级、映射建议、入池命令模板）
// 铁律：不写入任何 key 明文，只留占位符
import fs from 'node:fs';

const [, , inPath, outPath] = process.argv;
const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const all = raw.data || [];

const isFree = (m) => m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0;
const free = all.filter(isFree);

/**
 * 分级依据（第一性原理：判断"能不能拿来当主力/兜底"）：
 *  - text 纯文本 + 大上下文 + 非安全审核类 → 主力候选
 *  - 多模态/音频/视频 → 专用，不作通用兜底
 *  - content-safety / 安全审核类 → 不可当对话主力（语义就是审核器）
 *  - 极小参数（<3b）→ 只适合极轻量任务
 *  - 聚合路由 openrouter/free → 自动选免费模型，最省心但不可控
 */
function grade(m) {
  const id = m.id;
  const mod = (m.architecture && m.architecture.modality) || '';
  const ctx = m.context_length || 0;
  if (/content-safety/.test(id)) return { tier: 'D', why: '安全审核模型，非通用对话' };
  if (id === 'openrouter/free') return { tier: 'A', why: '官方免费聚合路由，自动选可用免费模型（最省心）' };
  if (/(lyria|audio)/i.test(id) || /->text\+audio/.test(mod)) return { tier: 'C', why: '音频生成，非文本对话' };
  if (/(nano-omni|omni)/.test(id) && /audio\+video/.test(mod)) return { tier: 'C', why: '多模态专用' };
  if (/2\.6b|small/.test(id) && ctx < 100000) return { tier: 'D', why: '极小参数/小模型，仅极轻量任务' };
  if (mod === 'text->text' && ctx >= 200000) return { tier: 'A', why: `纯文本 + 大上下文(${ctx})，适合当兜底主力` };
  if (mod.startsWith('text+') && ctx >= 200000) return { tier: 'B', why: '多模态 + 大上下文，可作次选' };
  return { tier: 'B', why: '可用，条件一般' };
}

const graded = free
  .map((m) => {
    const g = grade(m);
    return {
      id: m.id,
      name: m.name || '',
      ctx: m.context_length || 0,
      modality: (m.architecture && m.architecture.modality) || '',
      tier: g.tier,
      why: g.why,
      maxCompletion: (m.top_provider && m.top_provider.max_completion_tokens) || null,
      moderated: !!(m.top_provider && m.top_provider.is_moderated),
    };
  })
  .sort((a, b) => (a.tier === b.tier ? b.ctx - a.ctx : a.tier < b.tier ? -1 : 1));

const A = graded.filter((x) => x.tier === 'A');
const B = graded.filter((x) => x.tier === 'B');

// 入池映射建议：Tuan(主) + 2 备选，全部取 A 级
const primary = A.find((x) => x.id === 'openrouter/free') || A[0];
const backups = A.filter((x) => x.id !== (primary && primary.id)).slice(0, 2);
const models = {};
if (primary) models['Tuan'] = primary.id;
for (const b of backups) models[b.id] = b.id;

const out = {
  generatedAt: new Date().toISOString(),
  source: 'https://openrouter.ai/api/v1/models',
  totalModels: all.length,
  freeModels: free.length,
  // 实测到的真实门槛（2026-09-13 本机 curl 实测）
  gate: {
    modelsEndpoint: 'HTTP 200 免 key（可公开列出）',
    chatEndpoint: 'HTTP 401 "No cookie auth credentials found" —— chat 必须带 sk-or-v1-* key',
    conclusion: '免费模型的真实门槛 = 免费注册 OpenRouter 账号并创建 key；无 key 不可用',
  },
  tiers: { A: A.length, B: B.length, C: graded.filter((x) => x.tier === 'C').length, D: graded.filter((x) => x.tier === 'D').length },
  recommendedPoolMapping: models,
  models: graded,
  poolCommand: {
    note: 'key 到位后执行（本文件不含明文 key）',
    env: {
      SF_NAME: 'openrouter-free',
      SF_BASE: 'https://openrouter.ai/api/v1',
      SF_KEY: '<用户提供 sk-or-v1-...>',
      SF_MODELS: JSON.stringify(models),
    },
    cmd: 'node D:\\tdsh\\sub2api\\add-free-api-pool.mjs',
  },
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`written: ${outPath}`);
console.log(`free=${out.freeModels} tiers=${JSON.stringify(out.tiers)}`);
console.log(`推荐映射 Tuan -> ${models['Tuan'] || '(无 A 级模型)'}`);
