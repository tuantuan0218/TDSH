#!/bin/bash
# 统计：全历史中"含该字段名的提交数"与"含明文赋值形态的提交数"（不接触凭据值）
cd /mnt/i/Obsidian/vaults/第二大脑 || exit 1
FLD='SENDER''_AUTH'
CM=$(git rev-list --all)
echo "全历史提交数 = $(printf '%s\n' "$CM" | grep -c .)"
echo "--- 维度A：字段名出现在多少历史提交 ---"
pairs=$(git grep -l -I "$FLD" $CM 2>/dev/null)
n=$(printf '%s\n' "$pairs" | grep -c . )
echo "  (commit,file) 对 = $n"
echo "  涉及提交数 = $(printf '%s\n' "$pairs" | cut -d: -f1 | sort -u | grep -c .)"
echo "  涉及文件数 = $(printf '%s\n' "$pairs" | cut -d: -f2- | sort -u | grep -c .)"
echo "--- 涉及的文件（只列路径，不列内容）---"
printf '%s\n' "$pairs" | cut -d: -f2- | sort -u | head -20 | sed 's/^/   /'
echo "--- 维度B：HEAD 树中含该字段名的文件 ---"
git grep -l -I "$FLD" HEAD 2>/dev/null | cut -d: -f2- | sed 's/^/   /'
