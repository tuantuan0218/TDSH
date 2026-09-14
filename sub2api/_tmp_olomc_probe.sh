#!/usr/bin/env bash
# 只读：olomc-free 48 号两级验真（/models + 一发 chat），key 经 Mac PG 取、不打印
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
KEY=$(psql -h 127.0.0.1 -U postgres -d sub2api -At -c "SELECT credentials->>'api_key' FROM accounts WHERE id=48")
BASE=$(psql -h 127.0.0.1 -U postgres -d sub2api -At -c "SELECT credentials->>'base_url' FROM accounts WHERE id=48")
echo "== /models =="
curl -s -m 20 -o /tmp/o48m -w "%{http_code}" "$BASE/models" -H "Authorization: Bearer $KEY"
echo
head -c 300 /tmp/o48m; echo
echo "== chat =="
curl -s -m 60 -w "\n[http=%{http_code}]" "$BASE/chat/completions" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"cb/deepseek-v4.1-flash","messages":[{"role":"user","content":"hi"}],"max_tokens":8}'
echo
REMOTE
