#!/bin/bash
# 两种历史口径的区别演示（不接触凭据值，只用字段名）
cd /mnt/i/Obsidian/vaults/第二大脑 || exit 1
FLD='SENDER''_AUTH'
CM=$(git rev-list --all)
N=$(printf '%s\n' "$CM" | grep -c .)
echo "全历史提交数 = $N  （注：本仓有其他会话在并发提交，数值会漂移）"

echo "--- 口径①：树中含明文赋值的提交数（clone 后 checkout 任一提交即可读到）---"
RE="$FLD[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_-]{8,32}[\"']"
t=$(git grep -l -I -E "$RE" $CM 2>/dev/null | cut -d: -f1 | sort -u | grep -c .)
echo "   提交数 = $t"

echo "--- 口径②：该字段名【出现次数发生变化】的提交数（=引入/删除/改写的提交）---"
c=$(git log --all --format=%h -S"$FLD" -- automation/stock/config.py 2>/dev/null | grep -c .)
echo "   提交数 = $c   <-- 文档的'4 提交'很可能是这个口径"
git log --all --format='   %h %ad %s' --date=short -S"$FLD" -- automation/stock/config.py 2>/dev/null | head -6

echo "--- 口径③：HEAD 树现状（唯一需要立即改的活动明文）---"
git grep -c -I -E "$RE" HEAD 2>/dev/null | sed 's/^/   /'
