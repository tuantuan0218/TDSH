#!/bin/bash
# 自查：审计目录内的文件是否含"凭据本体"形态（阳性对照由 cred_scan 的 §三 数据提供）
cd /mnt/d/tdsh/security_audit || exit 1
B1='github''_pat''_[A-Za-z0-9_]{20,}'
B2='gh[pousr]''_[A-Za-z0-9]{20,}'
B3='eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}'
bad=0
for f in *.py *.sh *.md; do
  n=$(grep -cE "$B1|$B2|$B3" "$f" 2>/dev/null)
  if [ "${n:-0}" != "0" ]; then echo "  LEAK  $f = $n 处凭据本体"; bad=$((bad+1)); fi
done
echo "  含凭据本体的文件数 = $bad （0 = 本目录可安全入库）"
echo "--- 阳性对照：同一条检索式扫第二大脑活动配置，必须非 0（否则检索式无效）---"
pc=$(grep -cE "[A-Za-z_]{0,28}(AUTH|PASS|TOKEN|SECRET|KEY)[A-Za-z_]{0,8}[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_-]{8,32}[\"']" /mnt/i/Obsidian/vaults/第二大脑/automation/stock/config.py 2>/dev/null)
echo "  第二大脑 config.py 命中 = ${pc:-0} （>0 证明检索式有效）"
