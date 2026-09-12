#!/bin/bash
# 经 WSL 跳到 Mac 做只读探测（psql/docker/PG 监听/现有 siliconflow 行）
KEY="$HOME/.ssh/id_ed25519"
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$KEY" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
echo "===PSQL_BIN==="
ls /usr/local/opt/postgresql@16/bin/psql 2>/dev/null || which psql || echo NO_PSQL
echo "===PG_PORT==="
(nc -z 127.0.0.1 5432 && echo PG5432_OPEN) || echo PG5432_CLOSED
echo "===PGDOCKER==="
docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null | head -10 || echo NO_DOCKER_PERM
echo "===SUB2API_PROC==="
ps aux | grep -i sub2api | grep -v grep | awk '{print $2, $11, $12}' | head -5
echo "===HOME_SCRIPTS==="
ls ~ | grep -iE 'mac-|sub2api|silicon' | head -20
REMOTE
