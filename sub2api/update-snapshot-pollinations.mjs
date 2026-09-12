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
  "priority": 90,
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

const pub = JSON.parse(JSON.stringify(snap));
writeFileSync(PUB, JSON.stringify(pub, null, 2) + '\n');
console.log('public snapshot updated (masked) — accounts =', pub.accounts.length);