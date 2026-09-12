#!/bin/bash
# 拉取 17 号完整 JSON 用于快照（含 credentials/extra 原文）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT jsonb_build_object('id',id,'name',name,'platform',platform,'type',type,'status',status,'schedulable',schedulable,'priority',priority,'concurrency',concurrency,'proxy_id',proxy_id,'credentials',credentials,'extra',extra,'rate_multiplier',rate_multiplier,'quota_dimension',quota_dimension) FROM accounts WHERE id=17"
REMOTE