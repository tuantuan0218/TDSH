# TDSH web-only launcher
# Priority:
#   1) Attach to an already-running dsh web (URL from desktop shell app.log) -> open browser
#   2) Attach to fixed fallback port 24001 if alive -> open browser
#   3) Start dsh web by itself (portable-node + repo bin.js) -> wait for its URL in web-boot.log -> open browser
# Note: dsh web URLs carry a per-boot auth token (?token=...) - stripping it yields HTTP 401.
$ErrorActionPreference = 'SilentlyContinue'

$app  = 'D:\tdsh\resources\app'
$log  = Join-Path $app 'app.log'
$node = 'D:\tdsh\resources\portable-node\node.exe'
$bin  = Join-Path $app 'repo\apps\cli\lib\bin.js'
$repo = Join-Path $app 'repo'
$home = 'D:\tdsh\dsh-home'
$port = 24001
$out  = 'D:\tdsh\web-boot.log'
$carrier = 24000

function Test-Live([string]$u) {
  # TCP probe only - dsh web answers 401 to unauthenticated HTTP calls,
  # so an HTTP status check would false-negative a live server.
  try {
    $uri = [System.Uri]$u
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $uri.Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(1500)) { $client.Close(); return $false }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch { return $false }
}

function Get-UrlFromText([string]$text) {
  $m = [regex]::Match($text, 'dsh web[^:]*: (http://127\.0\.0\.1:\d+[^\s]*)')
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}

function Open-Browser([string]$u) {
  # Plain-browser mode: open the raw (token-bearing) URL. No dshDesktopPort
  # param => the window-controls client plugin hides its pill and drag strip.
  Start-Process $u
}

# -- 1) attach existing dsh web (URLs from app.log, newest first, unique) --
$seen = @{}
$candidates = @()
if (Test-Path $log) {
  $lines = Get-Content $log -Tail 400
  for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    $u = Get-UrlFromText $lines[$i]
    if ($u -and -not $seen.ContainsKey($u)) { $seen[$u] = $true; $candidates += $u }
  }
}
foreach ($u in $candidates) {
  if (Test-Live $u) { Open-Browser $u; exit 0 }
}

# -- 2) attach fixed fallback port 24001 --
$fallback = 'http://127.0.0.1:' + $port
if (Test-Live $fallback) {
  if (Test-Path $out) {
    $u = Get-UrlFromText ((Get-Content $out -Raw))
    if ($u) { Open-Browser $u; exit 0 }
  }
  Open-Browser $fallback
  exit 0
}

# -- 3) start dsh web ourselves --
if (-not (Test-Path $node)) { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('node.exe not found: ' + $node, 'TDSH Web', 'OK', 'Exclamation'); exit 1 }
if (-not (Test-Path $bin))  { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('bin.js not found: ' + $bin, 'TDSH Web', 'OK', 'Exclamation'); exit 1 }

Remove-Item $out -ErrorAction SilentlyContinue
$env:DSH_HOME = $home

$hook = 'D:\tdsh\swallow-ebusy.cjs'
$cmd = 'cmd /d /c cd /d "' + $repo + '" && set "DSH_HOME=D:\tdsh\dsh-home" && "' + $node + '" --require "' + $hook + '" "' + $bin + '" web --port ' + $port + ' --no-open 1> "' + $out + '" 2>&1'
$ws = New-Object -ComObject WScript.Shell

# mini-carrier: serves /__tdsh/agent (global AGENTS.md panel) on 24000.
# Skipped when the desktop shell already owns that port.
if (-not (Test-Live ('http://127.0.0.1:' + $carrier))) {
  $carrierLog = 'D:\tdsh\carrier.log'
  $cm = 'cmd /d /c cd /d "D:\tdsh" && "' + $node + '" "D:\tdsh\carrier-mini.js" 1> "' + $carrierLog + '" 2>&1'
  $null = $ws.Run($cm, 0, $false)
}

$null = $ws.Run($cmd, 0, $false)

# -- wait for the dsh web URL line (bundle boot takes ~25-35s cold) --
$okUrl = $null
for ($i = 0; $i -lt 160; $i++) {
  Start-Sleep -Milliseconds 750
  if (Test-Path $out) {
    $u = Get-UrlFromText ((Get-Content $out -Raw))
    if ($u) { $okUrl = $u; break }
  }
}
if ($okUrl) {
  Open-Browser $okUrl
} else {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show('TDSH web failed to start within 120s. See D:\tdsh\web-boot.log', 'TDSH Web', 'OK', 'Exclamation')
  exit 1
}