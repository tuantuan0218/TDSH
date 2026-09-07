#!/usr/bin/env bash
# Apply or revert the "hide 自动化 sidebar button" patch for the
# dsh-automation plugin. Idempotent: safe to run repeatedly.
#
# Usage (from repo root D:\tdsh):
#   bash patches/apply-automation-hide-sidebar.sh apply    # hide the button
#   bash patches/apply-automation-hide-sidebar.sh revert   # restore original
#
# Target (installed plugin bundle; node_modules is gitignored so the patch is
# shipped in patches/ and applied here after install):
#   dsh-home/profiles/web/node_modules/@dsh-external/dsh-automation/lib/client.js
#
# After apply/revert, restart TDSH for the web profile to reload the bundle.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$REPO_ROOT/dsh-home/profiles/web/node_modules/@dsh-external/dsh-automation/lib/client.js"
NODE="$REPO_ROOT/resources/portable-node/node.exe"
MARKER="hide 自动化 sidebar button only"
OLD_LINE='  ctx.effect(() => installAutomationSidebarEntry(t), "dsh-automation: sidebar entry");'
NEW_LINE='  // 2026-09-07 user request: hide 自动化 sidebar button only; plugin intact (was: ctx.effect(() => installAutomationSidebarEntry(t), "dsh-automation: sidebar entry"))'

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -f "$TARGET" ]] || die "target not found: $TARGET (is the plugin installed?)"
cp "$TARGET" "$TARGET.bak"

if [[ "${1:-apply}" == "revert" ]]; then
  if ! grep -qF "$MARKER" "$TARGET"; then
    echo "already reverted (no marker found); nothing to do"
    exit 0
  fi
  python3 - "$TARGET" "$NEW_LINE" "$OLD_LINE" <<'PYEOF'
import sys
p, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read()
assert s.count(old) == 1, f"old-line count={s.count(old)}"
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
PYEOF
  echo "reverted: button restored. Restart TDSH."
else
  if grep -qF "$MARKER" "$TARGET"; then
    echo "already applied (marker present); nothing to do"
    exit 0
  fi
  python3 - "$TARGET" "$OLD_LINE" "$NEW_LINE" <<'PYEOF'
import sys
p, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read()
assert s.count(old) == 1, f"old-line count={s.count(old)}"
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
PYEOF
  if [[ -x "$NODE" ]]; then
    WIN="$(wslpath -w "$TARGET" 2>/dev/null || echo "$TARGET")"
    if "$NODE" -c "$WIN" >/dev/null 2>&1; then
      echo "applied + syntax OK. Restart TDSH to hide the button."
    else
      echo "WARN: applied but syntax check failed; restoring backup." >&2
      cp "$TARGET.bak" "$TARGET"
      exit 1
    fi
  else
    echo "applied (could not locate portable-node for syntax check). Restart TDSH to hide the button."
  fi
fi
