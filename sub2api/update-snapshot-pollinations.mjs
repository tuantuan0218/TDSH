// 把 pollinations-free(18) 追加进恢复快照（防 Mac 故障后恢复脚本丢新渠道；纯文档）
import { readFileSync, writeFileSync } from 'node:fs';
const SNAP = 'D:/tdsh/sub2api/tuan-pool-snapshot.json';
const PUB = 'D:/tdsh/sub2api/tuan-pool-snapshot.public.json';
const snap = JSON.parse(readFileSync(SNAP, 'utf8'));

const row = {
  "id": 18,
  "name": "pollinations-free",
  "platform": "openai",
  "type": "apikey",
  "status": "active",
  "schedulable": true,
  "priority": 0,
  "concurrency": 1,
  "proxy_id": null,
  "credentials": {
    "api_key": "anonymous",
    "base_url": "https://text.pollinations.ai/openai",
    "model_mapping": { "Tuan": "openai", "openai": "openai" }
  },
  "extra": {
    "model_mapping": { "Tuan": "openai", "openai": "openai" },
    "openai_responses_mode": "force_chat_completions",
    "openai_responses_supported": false,
    "openai_long_context_billing_enabled": false
  },
  "rate_multiplier": 1,
  "quota_dimension": "global"
};

const idx = snap.accounts.findIndex(a => a.id === 18);
if (idx >= 0) snap.accounts[idx] = row; else snap.accounts.push(row);
snap.generated = new Date().toISOString();
writeFileSync(SNAP, JSON.stringify(snap, null, 2) + '\n');
console.log('snapshot accounts now =', snap.accounts.length);

// ⚠️ 2026-09-13 安全修复：此前该函数直接复制全量快照（含完整 api_key）到 public 文件，
// 导致 TDSH public 仓库历史泄露全部池账号 key。现在强制脱敏（前4后4打码）后才写入。
const pub = JSON.parse(JSON.stringify(snap));
for (const a of pub.accounts) {
  for (const k of Object.keys(a.credentials || {})) {
    if (typeof a.credentials[k] === 'string' && /^(sk-|qwen-|nrs-|phantom-|rc-|1912)/.test(a.credentials[k]) && a.credentials[k].length > 12) {
      a.credentials[k] = a.credentials[k].slice(0, 4) + '…' + a.credentials[k].slice(-4);
    }
  }
}
writeFileSync(PUB, JSON.stringify(pub, null, 2) + '\n');
console.log('public snapshot updated (MASKED) — accounts =', pub.accounts.length);