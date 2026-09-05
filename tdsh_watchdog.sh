#!/usr/bin/env bash
# TDSH external watchdog — restarts TDSH.exe when HTTP is dead
# All checks run via Windows PowerShell because TDSH runs on Windows, not in WSL.
set -u

LOG=/mnt/d/tdsh/tdsh_watchdog.log
PIDFILE=/mnt/d/tdsh/tdsh_watchdog.pid
HTTP_URL="http://127.0.0.1:24000/__tdsh/agent"
CHECK_INTERVAL=30
MAX_RESTARTS=10
WATCHDOG_WINDOW=300   # seconds (5 min)
CONSECUTIVE_DOWN=3
consecutive_down=0
log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

# ── duplicate guard: exit quietly if a previous watchdog is still alive ───────
if [[ -f "$PIDFILE" ]]; then
    old_pid=$(cat "$PIDFILE" 2>/dev/null || true)
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] watchdog already running pid=$old_pid — exiting" >> "$LOG"
        exit 0
    fi
fi

# ── header ────────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$LOG")"
echo $$ > "$PIDFILE"
log "watchdog started  pid=$$  log=$LOG  url=$HTTP_URL  interval=${CHECK_INTERVAL}s"
log "max ${MAX_RESTARTS} restarts per ${WATCHDOG_WINDOW}s window"

# ── rate-limit ring buffer (epoch seconds) ────────────────────────────────────
restart_times=()

should_restart() {
    local epoch_now
    epoch_now=$(date +%s)
    restart_times=("${restart_times[@]:-}")
    local fresh=()
    for t in "${restart_times[@]:-}"; do
        [[ -n "$t" ]] && (( epoch_now - t < WATCHDOG_WINDOW )) && fresh+=("$t")
    done
    restart_times=("${fresh[@]}")
    (( ${#restart_times[@]} >= MAX_RESTARTS ))
}

force_wait() {
    log "restart budget exhausted — sleeping ${WATCHDOG_WINDOW}s before retrying"
    sleep "$WATCHDOG_WINDOW"
}

# ── checks (via Windows PowerShell — TDSH runs on Windows, not in WSL) ────────
http_ok() {
    local code
    # PowerShell 5.1 throws on non-2xx; wrap in try/catch to avoid the thrown
    # exception text leaking into $code. Strip CR/LF/space so the '200'
    # comparison is truthful against the raw StatusCode integer.
    code=$(powershell.exe -NoProfile -Command \
        "try { (Invoke-WebRequest -Uri '$HTTP_URL' -TimeoutSec 5 -UseBasicParsing).StatusCode } catch { Write-Output '-1' }" \
        2>/dev/null | tr -d '\r\n ')
    [[ "$code" == "200" ]]
}

# ── restart ───────────────────────────────────────────────────────────────────
do_restart() {
    log ">>> initiating restart"
    # kill existing TDSH on Windows side
    powershell.exe -NoProfile -Command \
        "Get-Process -Name TDSH -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Seconds 2" \
        2>/dev/null
    # launch TDSH.exe on Windows (Windows path — Start-Process can't resolve /mnt/d WSL paths)
    nohup powershell.exe -NoProfile -Command \
        "Start-Process 'D:\tdsh\TDSH.exe' -WindowStyle Hidden; Write-Output 'launched'" \
        2>/dev/null
    log "    launched TDSH.exe  bg"
    log "    waiting 15s for startup…"
    sleep 15
}

# ── main loop ─────────────────────────────────────────────────────────────────
while true; do
    http_up=false
    http_ok && http_up=true

    log "tick  http=$([ "$http_up" = true ] && echo UP || echo DOWN)"

    # Reset consecutive-down counter on UP; increment on DOWN.
    if $http_up; then
        consecutive_down=0
        restart_times=()
        sleep "$CHECK_INTERVAL"
        continue
    fi
    consecutive_down=$(( consecutive_down + 1 ))

    # Require CONSECUTIVE_DOWN failures before acting — one flaky check never
    # restarts a healthy TDSH.
    if (( consecutive_down < CONSECUTIVE_DOWN )); then
        log "    consecutive_down=$consecutive_down/$CONSECUTIVE_DOWN  (waiting for stable)"
        sleep "$CHECK_INTERVAL"
        continue
    fi

    if should_restart; then
        force_wait
        consecutive_down=0
        continue
    fi

    do_restart
    restart_times+=("$(date +%s)")
    consecutive_down=0

    sleep 5
    if http_ok; then
        log "    restart succeeded"
    else
        log "    restart did not recover — will retry next tick"
    fi

    sleep "$CHECK_INTERVAL"
done
