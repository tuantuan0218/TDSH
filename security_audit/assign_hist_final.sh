#!/bin/bash
# 定音扫描：全历史中「该字段 = 引号字面量」形态（结构检索，不需也不接触凭据值）
cd /mnt/i/Obsidian/vaults/第二大脑 || exit 1
FLD='SENDER''_AUTH'
RE="$FLD[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_-]{8,32}[\"']"
CM=$(git rev-list --all)
echo "全历史提交数 = $(printf '%s\n' "$CM" | grep -c .)"
echo "--- 明文赋值形态命中的 (commit,file) ---"
pairs=$(git grep -l -I -E "$RE" $CM 2>/dev/null)
echo "  对数 = $(printf '%s\n' "$pairs" | grep -c .)"
echo "  涉及提交数 = $(printf '%s\n' "$pairs" | cut -d: -f1 | sort -u | grep -c .)"
printf '%s\n' "$pairs" | cut -d: -f1 | sort -u | while read c; do
  echo "    $(git log -1 --format='%h %ad' --date=short $c)  $(git log -1 --format=%s $c | cut -c1-40)"
done
echo "--- 涉及文件 ---"
printf '%s\n' "$pairs" | cut -d: -f2- | sort -u | sed 's/^/   /'
