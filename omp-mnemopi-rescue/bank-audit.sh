#!/usr/bin/env bash
# mnemopi bank 健康审计（只读，不修改任何数据）
# 用法: bash bank-audit.sh   （在 WSL 内运行）
BANKS=/root/.omp/agent/memories/mnemopi/banks
PY=$(command -v python3)

echo "=============================================================="
echo " mnemopi bank 健康审计  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================================="

printf "\n%-34s %10s %8s %10s %-12s %s\n" BANK SIZE MB INTEGRITY WM_ROWS HELD_BY STATUS
printf -- "--------------------------------------------------------------------------------------------------\n"

TOTAL=0; BAD=0; SHARED=0
for d in "$BANKS"/*/; do
  n=$(basename "$d"); [ "${n:0:1}" = "_" ] && continue
  db="$d/mnemopi.db"; [ -f "$db" ] || continue
  TOTAL=$((TOTAL+1))

  sz=$(stat -c%s "$db" 2>/dev/null || echo 0)
  mb=$(awk -v b="$sz" 'BEGIN{printf "%.1f", b/1048576}')

  integ=$($PY -c "
import sqlite3,sys
try:
    c=sqlite3.connect('file:$db?mode=ro',uri=True)
    print(c.execute('PRAGMA integrity_check').fetchone()[0][:20])
except Exception as e:
    print('ERR:'+str(e)[:14])
" 2>/dev/null)

  rows=$($PY -c "
import sqlite3
try:
    c=sqlite3.connect('file:$db?mode=ro',uri=True)
    print(c.execute('select count(*) from working_memory').fetchone()[0])
except Exception: print('-')
" 2>/dev/null)

  held=$(fuser "$db" 2>/dev/null | tr -d ' \n')
  nheld=$(echo "$held" | grep -o '[0-9]\+' | wc -l)

  if [ "$integ" = "ok" ]; then st="OK"; else st="** CORRUPT **"; BAD=$((BAD+1)); fi
  [ "$nheld" -gt 1 ] && { st="$st  MULTI-WRITER($nheld)"; SHARED=$((SHARED+1)); }

  printf "%-34s %10s %8s %10s %-12s %s\n" "$n" "$mb" "$integ" "$rows" "${held:-free}" "$st"
done

echo
echo "=============================================================="
echo " 汇总: $TOTAL 个库 | 损坏 $BAD 个 | 多写者争用 $SHARED 个"
echo "=============================================================="

echo
echo "【复发风险：当前所有 omp 进程的 cwd / bank】"
for p in $(pgrep -x omp 2>/dev/null); do
  cwd=$(readlink /proc/$p/cwd 2>/dev/null)
  [ "$cwd" = "/proc/$p/cwd" ] && continue
  case "$(tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null)" in
    *__omp_worker*) continue ;;
  esac
  lg=$(ls -1t /root/.omp/logs/omp.*.$p.log 2>/dev/null | head -1)
  bank=$(grep -h -o '"bank":"[^"]*"' "$lg" 2>/dev/null | tail -1 | cut -d'"' -f4)
  printf "  pid %-8s cwd=%-26s bank=%s\n" "$p" "$cwd" "${bank:-?}"
done

echo
echo "【判据】"
echo "  同一 bank 若被 >1 个进程持有 -> 复发风险高（本次损坏即此因）"
echo "  多个进程 cwd 同为 /tmp  -> 必然共享同一 bank"
echo
echo "【防复发】新建工作区时带 --cwd 指向项目目录:"
echo "  herdr workspace create --cwd /mnt/d/tdsh/黄金 --label 黄金"
