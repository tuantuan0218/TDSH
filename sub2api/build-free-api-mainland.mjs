// 生成「免费 API 权威清单（大陆直连 + OpenAI 兼容）」
// 数据源：yangmao.ai 结构化数据集（每日更新），本机实测解析
// 用法：node build-free-api-mainland.mjs <in.json> <out.md>
import fs from 'node:fs';

const [, , inPath, outPath] = process.argv;
const d = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const p = d.providers;

// 纯本地自托管项不是"API key 渠道"，剔除
const LOCAL = new Set([
  'llama.cpp', 'LM Studio', 'LocalAI', 'Ollama', 'vLLM', 'TextGen',
  'Jan', 'Continue', 'Tabby', 'Aider',
]);

const modelNames = (x) =>
  (x.models || [])
    .map((m) => (typeof m === 'string' ? m : m.name || m.id || m.model || ''))
    .filter(Boolean);

const top = p.filter(
  (x) => x.has_free_api && x.china_direct && x.openai_compatible && !LOCAL.has(x.name),
);

const lines = [];
lines.push('# 免费 API 权威清单（大陆直连 + OpenAI 兼容）');
lines.push('');
lines.push(`> 数据源：yangmao.ai 结构化数据集（全库 ${d.total_providers} 家，schema ${d.schema_version}，生成于 ${d.generated_at}）`);
lines.push('> 筛选口径：`has_free_api && china_direct && openai_compatible`，剔除纯本地自托管项');
lines.push(`> 漏斗：全库 ${d.total_providers} 家 → 有免费 API ${d.free_api_providers} 家 → 大陆直连 39 家 → **本表 ${top.length} 家**`);
lines.push('> 本文件由 `build-free-api-mainland.mjs` 脚本生成，勿手改；解析结果已用 node 实测校验。');
lines.push('');
lines.push('| 厂商 | 免费额度 | 速率限制 | 代表模型 | 入口 |');
lines.push('|---|---|---|---|---|');
for (const x of top) {
  const ms = modelNames(x).slice(0, 3).join(', ') || '-';
  lines.push(
    `| ${x.name_zh || x.name} | ${x.api_free_credits || '-'} | ${x.api_rate_limit || '-'} | ${ms} | ${x.url || '-'} |`,
  );
}
lines.push('');
lines.push('## 为什么优先用这一类');
lines.push('');
lines.push('- **全部是「自己注册拿 key」**：无中间人、无公益站跑路风险、额度规则可追溯。');
lines.push('- 对比论坛公益站（注册送额度型）：后者寿命以天/周计，本表以月/年计。');
lines.push('- 额度与限速仍会随平台政策变动，**以官方控制台为准**；本表是入口索引，不是额度承诺。');
lines.push('');
lines.push('## 复现');
lines.push('');
lines.push('```bash');
lines.push('curl -sL https://yangmao.ai/data/exports/ai-free-tiers.json -o ai-free-tiers.json');
lines.push(`node build-free-api-mainland.mjs ai-free-tiers.json FREE-API-MAINLAND.md`);
lines.push('```');
lines.push('');
lines.push('原始 JSON 备份：`_freeapi_probe/ai-free-tiers.json`（含 `last_verified`、`proof_url` 等核验字段）。');

fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`written: ${outPath} (${lines.length} lines, ${top.length} providers)`);
