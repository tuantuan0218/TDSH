#!/usr/bin/env bash
# Apply agent-loop auto-continue patch for dsh-v0.1.2-rc.1.
# Only run AFTER the repo has been upgraded to 0.1.2-rc.1.
# Usage: bash apply.sh
set -u

PATCHED=/mnt/d/tdsh/harness-patches/agent-loop/0.1.2-rc.1/lib-index.js
BACKUP_DIR=/mnt/d/tdsh/harness-patches/agent-loop/0.1.2-rc.1
MARKER='自动续跑'

TARGETS=(
  /mnt/d/tdsh/resources/app/repo/packages/core/agent-loop/lib/index.js
  /mnt/d/tdsh/resources/app/repo/apps/cli/node_modules/@deepseek-ai/dsh-base/node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js
  /mnt/d/tdsh/resources/app/repo/node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js
)

applied=0
i=0
for t in "${TARGETS[@]}"; do
  i=$((i + 1))
  [ -f "$t" ] || { echo "skip (absent): $t"; continue; }
  if grep -qF "$MARKER" "$t"; then
    echo "already patched: $t"
  else
    cp "$t" "$BACKUP_DIR/index.js.bak-rc1.$i"
    cp "$PATCHED" "$t"
    echo "patched: $t"
  fi
  applied=1
done

if [ "$applied" -eq 0 ]; then
  echo "ERROR: no target found — is the 0.1.2-rc.1 repo in place?" >&2
  exit 1
fi
echo "done. Restart TDSH to take effect."
