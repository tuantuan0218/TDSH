#!/usr/bin/env bash
# U2 修复应用器（默认 DRY-RUN，只对副本操作；加 --apply 才动真文件）
# 关键设计：按【变量名】定位替换，脚本本身不需要、也绝不包含任何凭据值。
set -uo pipefail
VAULT=/mnt/i/Obsidian/vaults/第二大脑
F="$VAULT/automation/stock/config.py"
MODE=${1:-dry-run}

NEW_BLOCK='import os as _os
SENDER_AUTH = _os.environ.get("QQ_SMTP_PASS") or ""   # 2026-09-13 脱敏修复：值改由环境变量注入
if not SENDER_AUTH:
    raise RuntimeError("缺少环境变量 QQ_SMTP_PASS：邮件功能需要它，请在 shell 配置后重试（值不入库）")'

if [ "$MODE" = "--apply" ]; then
  TARGET="$F"
  BK=/mnt/d/tdsh/security_audit/backup_config_$(date +%Y%m%d_%H%M%S).py
  cp "$F" "$BK"; echo "已备份原文件 → $BK"
else
  T=$(mktemp -d)
  mkdir -p "$T/automation/stock"
  cp "$F" "$T/automation/stock/config.py"
  TARGET="$T/automation/stock/config.py"
  echo "DRY-RUN：只在副本 $TARGET 上操作，真文件未被修改"
fi

python3 - "$TARGET" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if re.search(r"(?m)^\s*SENDER_AUTH\s*=\s*_os\.environ", s):
    print("  已是注入写法，无需再改"); sys.exit(0)
new_block = '''SENDER_AUTH = _os.environ.get("QQ_SMTP_PASS") or ""   # 2026-09-13 脱敏修复：值改由环境变量注入
if not SENDER_AUTH:
    raise RuntimeError("缺少环境变量 QQ_SMTP_PASS：邮件功能需要它，请在 shell 配置后重试（值不入库）")'''
orig = s
# 1) 按变量名替换该行（无论其原值是什么）
s = re.sub(r'(?m)^SENDER_AUTH\s*=\s*["\'][^"\']*["\']\s*$', new_block, s, count=1)
if s == orig:
    print("  ❌ 未匹配到 SENDER_AUTH 赋值行，放弃修改（不误伤）"); sys.exit(1)
# 2) import 放到 import 区（避免插在文件中段）
if not re.search(r"(?m)^\s*import\s+os\s+as\s+_os\b", s):
    if re.search(r"(?m)^(from|import)\s", s):
        s = re.sub(r"(?m)^((?:from|import)\s.+)$", r"import os as _os\n\1", s, count=1)
    else:
        s = "import os as _os\n" + s
open(p, "w", encoding="utf-8").write(s)
print("  已按变量名替换并把 import 归位（脚本不含任何凭据值）")
PY

echo "=== 语法检查 ==="
python3 -m py_compile "$TARGET" && echo "  ✅ py_compile 通过" || echo "  ❌ 语法失败"

echo "=== 验收门（应报 FIXED）==="
python3 /mnt/d/tdsh/security_audit/redaction_fixed_check.py "$TARGET" 2>&1 | sed 's/^/  /'

echo "=== 改动预览（值掩码）==="
sed -n '1,14p' "$TARGET" | sed -E 's/["'"'"'][A-Za-z0-9_+./-]{8,}["'"'"']/«掩码»/g' | sed 's/^/  /'

if [ "$MODE" != "--apply" ]; then
  rm -rf "$(dirname "$TARGET")/.." 2>/dev/null
  echo "  （副本已清理；真文件未动）"
  echo
  echo "如认可本补丁，执行：  bash $0 --apply"
  echo "回滚：  cp /mnt/d/tdsh/security_audit/backup_config_<时间戳>.py '$F'"
else
  echo "  ⚠️ 已修改真文件；如异常请用上方备份回滚"
fi
