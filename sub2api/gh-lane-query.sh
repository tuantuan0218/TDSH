#!/bin/bash
# 只读查池：GitHub/OAuth 类候选渠道是否已入池（a6api / suyu / copilot / cngpt / unlimited 等）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "--- 目标 lane 现状 ---"
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id||' | '||name||' | '||status||' | sched='||schedulable||' | prio='||priority||' | '||COALESCE(credentials->>'base_url','(no base_url)') FROM accounts WHERE deleted_at IS NULL AND (lower(name) LIKE '%a6%' OR lower(name) LIKE '%suyu%' OR lower(name) LIKE '%copilot%' OR lower(name) LIKE '%cngpt%' OR lower(name) LIKE '%unlimited%' OR lower(name) LIKE '%github%') ORDER BY id"
echo "--- 池总量 / 兜底位分布 ---"
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT 'active_total='||count(*) FROM accounts WHERE deleted_at IS NULL AND status='active'"
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT 'prio>=90='||count(*) FROM accounts WHERE deleted_at IS NULL AND status='active' AND priority>=90"
REMOTE
