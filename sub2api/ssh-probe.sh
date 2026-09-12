#!/bin/bash
# 探测 Mac 192.168.1.3 SSH 免密可登录用户（只读探测，不改动任何东西）
KEY="$HOME/.ssh/id_ed25519"
[ -f "$KEY" ] || KEY=/tmp/id_ed25519
for u in mac tuan admin root wcchengzi sub2api; do
  echo "--- $u ---"
  ssh -o BatchMode=yes -o ConnectTimeout=6 -o StrictHostKeyChecking=accept-new -i "$KEY" "$u@192.168.1.3" 'echo SSH_OK; whoami; hostname' 2>&1 | head -3
done
