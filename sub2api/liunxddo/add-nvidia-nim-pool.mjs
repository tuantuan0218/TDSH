// NVIDIA NIM 一键入池脚本模板（key 到手即用）
// 用法（PowerShell）:
//   $env:SF_NAME="nvidia-nim"; $env:SF_BASE="https://integrate.api.nvidia.com/v1"
//   $env:SF_KEY="nvapi-xxx"; $env:SF_MODELS='{"Tuan":"z-ai/glm-5.3-flash"}'
//   node add-nvidia-nim-pool.mjs
// 实测（2026-09-13 复核，本会话二次验证）:
//   - /models 匿名 200 ✅，实测可列 **82 模型**（脚本原注释所列 6 个模型 ID **全部核对存在**：
//     z-ai/glm-5.3-flash、deepseek-ai/deepseek-v4-flash-0731、moonshotai/kimi-k3、
//     openai/gpt-oss-20b、poolside/laguna-xs-2.1、nvidia/nemotron-3.5-lightning-30b-a3b）
//   - chat 匿名 **401**（更正：原注释称 "500" 有误）—— 精确错误为
//     `Header of type \`authorization\` was missing`，即**只差一把 key**
//   - rpm 限制 40（linux.do 帖实测）
//   - key 获取: https://build.nvidia.com 免费注册 → Get API Key（nvapi- 开头）
//     ⚠️ 注册被 **hCaptcha 交互挑战**拦截（自动化过不去），需用户人工点一次（受限项 U8）
//   - 免费档铁律：concurrency 1 / group 5 / force_chat_completions / supported=false
//     ⚠️ 注意：本 SQL **不显式写 priority**（走 DB 默认），排位以 DB 实际值为准，勿据文案推断
//   用法与 add-free-api-pool.mjs 完全一致（同模板），只是文档化入口
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const NAME = (process.env.SF_NAME || 'nvidia-nim').replace(/'/g, "''");
const BASE = (process.env.SF_BASE || 'https://integrate.api.nvidia.com/v1').replace(/'/g, "''");
const KEY = (process.env.SF_KEY || '').replace(/'/g, "''");
const MODELS_RAW = process.env.SF_MODELS || '';

if (!KEY || !MODELS_RAW) {
  console.error('STOP: 需设置 SF_KEY / SF_MODELS(JSON 模型映射)。key 去 https://build.nvidia.com 免费注册领取');
  process.exit(2);
}
let MODELS;
try { MODELS = JSON.parse(MODELS_RAW); } catch { console.error('STOP: SF_MODELS 非合法 JSON'); process.exit(2); }
const MODELS_JSON = JSON.stringify(MODELS).replace(/'/g, "''");
const esc = (s) => s.replace(/'/g, "''");

console.log(`===== 0. 直测 ${NAME} /models =====`);
try {
  const rm = await fetch(BASE + '/models', { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(20000) });
  console.log(`/models: HTTP ${rm.status}`);
  if (rm.status !== 200) { console.error('STOP: /models 非 200，key 不可用'); process.exit(3); }
} catch (e) { console.error(`STOP: /models ERR ${e.message}`); process.exit(3); }

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

console.log('\n===== 3. 入池（SSH→Mac PG，幂等）=====');
const SQL = `
INSERT INTO accounts (name, platform, type, credentials, extra, status, schedulable, concurrency, rate_multiplier, quota_dimension, auto_pause_on_expired)
SELECT '${esc(NAME)}','openai','apikey',
  jsonb_build_object('api_key','${esc(KEY)}','base_url','${esc(BASE)}','model_mapping','${MODELS_JSON}'::jsonb),
  jsonb_build_object('model_mapping','${MODELS_JSON}'::jsonb,
    'openai_responses_mode','force_chat_completions',
    'openai_responses_supported',false,
    'openai_long_context_billing_enabled',false),
  'active', true, 1, 1.0, 'global', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name='${esc(NAME)}' AND deleted_at IS NULL)
RETURNING id, name, status, schedulable;
INSERT INTO account_groups (account_id, group_id)
SELECT a.id, 5 FROM accounts a WHERE a.name='${esc(NAME)}' AND a.deleted_at IS NULL
ON CONFLICT (account_id, group_id) DO NOTHING;
SELECT id,name,status,schedulable,priority,credentials->>'base_url' AS base, credentials->'model_mapping'->>'Tuan' AS tuan FROM accounts WHERE name='${esc(NAME)}' AND deleted_at IS NULL;
`;
const sh = 'D:/tdsh/sub2api/_tmp_add_nim.sh';
const body = `#!/bin/bash
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api <<'PSQL'
${SQL}
PSQL
echo "GATE_HTTP:"\`curl -s -o /dev/null -w %{http_code} http://127.0.0.1:8090/healthz\`
REMOTE`;
writeFileSync(sh, body, 'utf8');
try {
  // 走 bash（Git Bash / MSYS）而非 wsl.exe：
  //   wsl.exe 会**拉起整个 WSL 实例**（常驻内存），而本机 SSH 直连已验证可用，
  //   无需借道 WSL。（历史上该模板用 wsl.exe，属可避免的副作用。）
  const out = execFileSync('bash', ['-c', `bash "${sh}"`], { encoding: 'utf8', timeout: 120000 });
  console.log(String(out).slice(0, 1200));
} catch (e) {
  // 回退：若本机无 bash，再试 wsl.exe（保持可用性，但优先无 WSL 路径）
  try {
    const out = execFileSync('wsl.exe', ['-e', 'bash', `/mnt/d/tdsh/sub2api/_tmp_add_nim.sh`], { encoding: 'utf8', timeout: 120000 });
    console.log(String(out).slice(0, 1200));
  } catch (e2) {
    console.error('SSH 执行失败:', String(e.message || e).slice(0, 300));
    process.exit(4);
  }
} finally { try { rmSync(sh); } catch {} }

console.log(`\nDONE: ${NAME} 入池完成（concurrency 1 / group 5 / force_chat_completions；priority 未显式写入，以 DB 实际值为准）。
验证: usage_logs 路由观察 account_id 新账号；NIM rpm 40 硬限，concurrency 1 不升权。`);
