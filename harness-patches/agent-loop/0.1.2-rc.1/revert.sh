#!/usr/bin/env bash
# Revert agent-loop auto-continue patch for dsh-v0.1.2-rc.1: restore .bak-rc1.N backups.
# Usage: bash revert.sh
set -u

BACKUP_DIR=/mnt/d/tdsh/harness-patches/agent-loop/0.1.2-rc.1

TARGETS=(
  /mnt/d/tdsh/resources/app/repo/packages/core/agent-loop/lib/index.js
  /mnt/d/tdsh/resources/app/repo/apps/cli/node_modules/@deepseek-ai/dsh-base/node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js
  /mnt/d/tdsh/resources/app/repo/node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js
)

i=0
for t in "${TARGETS[@]}"; do
  i=$((i + 1))
  [ -f "$t" ] || { echo "skip (absent): $t"; continue; }
  bak="$BACKUP_DIR/index.js.bak-rc1.$i"
  if [ -f "$bak" ]; then
    cp "$bak" "$t"
    echo "reverted: $t"
  else
    echo "no backup for: $t (leaving as-is)"
  fi
done
echo "done. Restart TDSH to take effect."
