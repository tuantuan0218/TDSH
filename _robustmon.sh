#!/bin/bash
# TDSH robustness monitor: heartbeat every 60s. Checks procs, memory, watchdog,
# endpoints, app.log errors, session progress. Appends one line to _robust.log.
OUT=/mnt/d/tdsh/_robust.log
APP=/mnt/d/tdsh/resources/app/app.log
WDLOG=/mnt/d/tdsh/tdsh_watchdog.log
WD_PID=$(cat /mnt/d/tdsh/tdsh_watchdog.pid 2>/dev/null)
PGOAL='D:\tdsh\dsh-home\sessions\--D-tdsh-~624B~673A--\session-76e63afc-94dd-4a06-89ba-5b390987e778\session.jsonl.zstd'
AGOAL='D:\tdsh\dsh-home\sessions\--D-tdsh_goal_test--\session-6cee14a3-01b2-4116-9f0d-6408df10ccf5\session.jsonl.zstd'
for ((;;)); do
  ts=$(date -u +%H:%M:%S)
  # procs + memory
  procs=$(tasklist.exe 2>/dev/null | grep -icE "TDSH|electron")
  mem=$(tasklist.exe 2>/dev/null | grep -iE "TDSH|electron" | awk '{gsub(/[,.]/,"",$5); s+=$5} END{printf "%d", s/1024}')
  # watchdog
  wd="?"
  wd_alive="n"
  if [ -n "$WD_PID" ] && kill -0 "$WD_PID" 2>/dev/null; then wd_alive="y"; fi
  wd_age="?"
  if [ -f "$WDLOG" ]; then wd_age=$(date -u -d "now - $(stat -c %Y "$WDLOG") seconds" +%H:%M:%S); fi
  # endpoints
  carr=$(curl.exe -s -m 3 "http://127.0.0.1:24000/__tdsh/meta" 2>/dev/null | head -c 30)
  web=$(curl.exe -s -m 3 -o /dev/null -w "%{http_code}" "http://127.0.0.1:53667" 2>/dev/null)
  # age (minutes) of most recent error-ish line in app.log; large = no recent errors
  errline=$(grep -E "\berror\b|\bcrash\b|uncaught|out of memory|TypeError|unhandled" "$APP" 2>/dev/null | tail -1)
  if [ -n "$errline" ]; then
    ets=$(echo "$errline" | sed -n 's/^\([0-9T:+.-]*\).*/\1/p')
    errAge=$([ -n "$ets" ] && echo $(( ($(date +%s) - $(date -u -d "$ets" +%s 2>/dev/null))/60 )) || echo "old")
  else
    errAge="none"
  fi
  # session progress (sizes)
  ps=$([ -f /mnt/d/tdsh/dsh-home/sessions/--D-tdsh-~624B~673A--/session-76e63afc-94dd-4a06-89ba-5b390987e778/session.jsonl.zstd ] && stat -c %s /mnt/d/tdsh/dsh-home/sessions/--D-tdsh-~624B~673A--/session-76e63afc-94dd-4a06-89ba-5b390987e778/session.jsonl.zstd || echo 0)
  as=$([ -f /mnt/d/tdsh/dsh-home/sessions/--D-tdsh_goal_test--/session-6cee14a3-01b2-4116-9f0d-6408df10ccf5/session.jsonl.zstd ] && stat -c %s /mnt/d/tdsh/dsh-home/sessions/--D-tdsh_goal_test--/session-6cee14a3-01b2-4116-9f0d-6408df10ccf5/session.jsonl.zstd || echo 0)
  line="ts=$ts procs=$procs memMB=$mem wd_alive=$wd_alive wd_lastTick=$wd_age carrier=${carr:-DOWN} web=$web errAgeMin=$errAge phoneKB=$((ps/1024)) auditKB=$((as/1024))"
  echo "$line"
  echo "$line" >> "$OUT"
  sleep 60
done