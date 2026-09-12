// 通用免费 API 入池工具：任何免费/低成本 key 到手 → 一键入池 Tuan 池
// 用法（PowerShell）:
//   $env:SF_NAME="openrouter-free"; $env:SF_BASE="https://openrouter.ai/api/v1"
//   $env:SF_KEY="sk-or-v1-xxx"; $env:SF_MODELS='{"Tuan":"deepseek/deepseek-r1:free"}'
//   node add-free-api-pool.mjs
// 自动：直测/models+chat → SSH→Mac PG 插入账号(extra 四字段+force_chat_completions+supported=false)
//       + group 5 + prio 90 + concurrency 1 → 只读核对
// 铁律(见 FREE-API-CHANNELS.md)：免费档一律兜底位，error_rate 自动避让，不升权
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const NAME = (process.env.SF_NAME || '').replace(/'/g, "''");
const BASE = (process.env.SF_BASE || '').replace(/'/g, "''");
const KEY = (process.env.SF_KEY || '').replace(/'/g, "''");
const MODELS_RAW = process.env.SF_MODELS || '';

if (!NAME || !BASE || !KEY || !MODELS_RAW) {
  console.error('STOP: 需设置 SF_NAME/SF_BASE/SF_KEY/SF_MODELS(JSON 模型映射)');
  process.exit(2);
}
let MODELS;
try { MODELS = JSON.parse(MODELS_RAW); } catch { console.error('STOP: SF_MODELS 非合法 JSON'); process.exit(2); }
const MODELS_JSON = JSON.stringify(MODELS).replace(/'/g, "''");
const esc = (s) => s.replace(/'/g, "''");

// 1. 直测 /models
console.log(`===== 0. 直测 ${NAME} =====`);
try {
  const rm = await fetch(BASE + '/models', { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(20000) });
  console.log(`/models: HTTP ${rm.status}`);
  if (rm.status !== 200) { console.error('STOP: /models 非 200，key 不可用'); process.exit(3); }
} catch (e) { console.error(`STOP: /models ERR ${e.message}`); process.exit(3); }

// 2. 直测每个模型 chat 一发
for (const m of Object.values(MODELS)) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: m, messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
      signal: AbortSignal.timeout(30000)
    });
    const t = await r.text();
    let content = ''; try { content = JSON.parse(t).choices?.[0]?.message?.content || ''; } catch {}
    console.log(`chat ${m}: HTTP ${r.status} ${Date.now() - t0}ms content="${String(content).slice(0, 30)}"`);
  } catch (e) { console.log(`chat ${m}: ERR ${e.message}（继续）`); }
}

// 3. 生成远端 SQL 脚本 → SSH 执行
console.log('\n===== 3. 入池（SSH→Mac PG，幂等）=====');
const SQL = `
INSERT INTO accounts (name, platform, type, credentials, extra, status, schedulable, priority, concurrency, rate_multiplier, quota_dimension, auto_pause_on_expired)
SELECT '${esc(NAME)}','openai','apikey',
  jsonb_build_object('api_key','${esc(KEY)}','base_url','${esc(BASE)}','model_mapping','${MODELS_JSON}'::jsonb),
  jsonb_build_object('model_mapping','${MODELS_JSON}'::jsonb,
    'openai_responses_mode','force_chat_completions',
    'openai_responses_supported',false,
    'openai_long_context_billing_enabled',false),
  'active', true, 90, 1, 1.0, 'global', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name='${esc(NAME)}' AND deleted_at IS NULL)
RETURNING id, name, status, schedulable, priority;
INSERT INTO account_groups (account_id, group_id, priority)
SELECT a.id, 5, 1 FROM accounts a WHERE a.name='${esc(NAME)}' AND a.deleted_at IS NULL
ON CONFLICT (account_id, group_id) DO NOTHING;
SELECT id,name,status,schedulable,priority,credentials->>'base_url' AS base, credentials->'model_mapping'->>'Tuan' AS tuan FROM accounts WHERE name='${esc(NAME)}' AND deleted_at IS NULL;
`;
const sh = 'D:/tdsh/sub2api/_tmp_add_free.sh';
const body = `#!/bin/bash
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api <<'PSQL'
${SQL}
PSQL
echo "GATE_HTTP:`curl -s -o /dev/null -w %{http_code} http://127.0.0.1:8090/healthz`"
REMOTE`;
writeFileSync(sh, body, 'utf8');
try {
  const out = execFileSync('wsl.exe', ['-e', 'bash', '/mnt/d/tdsh/sub2api/_tmp_add_free.sh'], { encoding: 'utf8', timeout: 120000 });
  console.log(String(out).slice(0, 1200));
} catch (e) {
  console.error('SSH 执行失败:', e.message.slice(0, 400));
  process.exit(4);
} finally { try { rmSync(sh); } catch {} }

console.log(`\nDONE: ${NAME} 入池完成（prio 90 兜底 / concurrency 1 / group 5 / force_chat_completions）。
验证: 观察 usage_logs 路由（account_id 查新账号）或等用户给 admin 凭据跑 verify。`);