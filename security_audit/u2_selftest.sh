#!/usr/bin/env bash
# 对 u2_apply.sh 做二次应用（幂等）与"无匹配行时不误伤"两项测试，全程只在 /tmp 副本
set -uo pipefail
SRC=/mnt/i/Obsidian/vaults/第二大脑/automation/stock/config.py
T=$(mktemp -d)
mkdir -p "$T/automation/stock"
cp "$SRC" "$T/automation/stock/config.py"
SCRIPT=$(mktemp)
sed "s#^VAULT=.*#VAULT=$T#" /mnt/d/tdsh/security_audit/u2_apply.sh \
  | sed "s#F=\"\$VAULT/automation/stock/config.py\"#F=\"$T/automation/stock/config.py\"#" > "$SCRIPT"

echo "--- 第 1 次应用 ---"
H1=$(md5sum "$T/automation/stock/config.py" | cut -d' ' -f1)
bash "$SCRIPT" --apply 2>&1 | grep -E "已按|py_compile|FIXED|NOT_FIXED" | head -4
H2=$(md5sum "$T/automation/stock/config.py" | cut -d' ' -f1)
[ "$H1" != "$H2" ] && echo "  ✅ 第 1 次确有改动" || echo "  ❌ 第 1 次未改动"

echo "--- 第 2 次应用（应幂等：不再改、不重复插 import）---"
bash "$SCRIPT" --apply 2>&1 | grep -E "已是注入写法|已按|py_compile|FIXED" | head -4
H3=$(md5sum "$T/automation/stock/config.py" | cut -d' ' -f1)
[ "$H2" = "$H3" ] && echo "  ✅ 幂等：第 2 次零改动" || echo "  ❌ 不幂等"
echo "  import os as _os 出现次数 = $(grep -c 'import os as _os' "$T/automation/stock/config.py")（应为 1）"

echo "--- 无匹配行场景（应拒绝修改而非乱插）---"
printf 'SENDER = "x@example.invalid"\nOTHER = 1\n' > "$T/automation/stock/config.py"
bash "$SCRIPT" --apply 2>&1 | grep -E "未匹配到|已按" | head -2
grep -q '_os' "$T/automation/stock/config.py" && echo "  ❌ 不该写入却写了" || echo "  ✅ 无匹配时安全放弃，未误伤"

echo "--- 邮件调用方是否仍可正常 import（改后接口未变）---"
cp "$SRC" "$T/automation/stock/config.py"
bash "$SCRIPT" --apply >/dev/null 2>&1
cd "$T/automation/stock" && QQ_SMTP_PASS=dummy python3 -c "import config; print('  ✅ import 成功, SENDER_AUTH 由环境注入, 长度=', len(config.SENDER_AUTH))" 2>&1 | tail -2

rm -rf "$T" "$SCRIPT"
echo "--- 清理完成（真文件全程未动）---"
grep -c 'import os as _os' "$SRC" | sed 's/^/  真文件 import os as _os 次数（应为 0）= /'
