$ErrorActionPreference = 'Continue'
$base   = 'https://roleai.studio'
$outDir = 'D:\tdsh\Roleai\site'
$seen   = New-Object 'System.Collections.Generic.HashSet[string]'
$queue  = New-Object 'System.Collections.Generic.Queue[string]'
$failed = New-Object 'System.Collections.Generic.List[string]'
$ok     = 0

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Normalize-Ref([string]$r, [string]$fromRel) {
  $r = $r.Trim()
  if ($r -eq '') { return $null }
  if ($r -match '[\$\{\}\(\)\s,]') { return $null }         # 模板串/JS 表达式噪声
  if ($r -match '^(#|data:|mailto:|javascript:|tel:|blob:)') { return $null }
  if ($r -match ':' -and $r -notmatch '^https?://') { return $null }
  if ($r -match '^https?://') {
    if ($r -notmatch 'roleai\.studio') { return $null }
    $r = $r -replace '^https?://roleai\.studio', ''
  }
  $r = $r -replace '\?.*$', ''
  $r = $r -replace '#.*$', ''
  if ($r -eq '') { return $null }
  if ($r -notmatch '^/') {
    $fromDir = [System.IO.Path]::GetDirectoryName($fromRel.TrimStart('/'))
    if ($null -eq $fromDir) { $fromDir = '' }
    $fromDir = $fromDir -replace '\\', '/'
    if ($fromDir -eq '') { $r = "/$r" } else { $r = "/$fromDir/$r" }
  }
  # 折叠 ./ 与 ../
  $parts = New-Object 'System.Collections.Generic.List[string]'
  foreach ($seg in ($r -split '/')) {
    if ($seg -eq '' -or $seg -eq '.') { continue }
    if ($seg -eq '..') { if ($parts.Count -gt 0) { $parts.RemoveAt($parts.Count - 1) }; continue }
    $parts.Add($seg)
  }
  return '/' + ($parts -join '/')
}

$pages = @('/', '/skill.html', '/downloads.html', '/pricing.html', '/updates.html',
           '/login.html', '/client-auth.html', '/identity.html', '/payment.html',
           '/support.html', '/agent.html', '/admin/',
           '/legal/user-agreement.html', '/legal/privacy-policy.html',
           '/robots.txt', '/sitemap.xml', '/runtime-config.js')
foreach ($p in $pages) { $queue.Enqueue($p) }

while ($queue.Count -gt 0) {
  $rel = $queue.Dequeue()
  if ($seen.Contains($rel)) { continue }
  [void]$seen.Add($rel)

  $url  = $base + $rel
  $path = $rel.TrimStart('/')
  if ($path -eq '') { $path = 'index.html' }
  $path = ($path -split '\?')[0]
  if ($path.EndsWith('/')) { $path += 'index.html' }
  $full = Join-Path $outDir ($path -replace '/', '\')
  $parent = [System.IO.Path]::GetDirectoryName($full)
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }

  $code = curl.exe -s -L --max-time 60 -w '%{http_code}' -o $full $url
  if ($code -notmatch '^2') {
    if (Test-Path $full) { Remove-Item $full -Force }
    $failed.Add("$code $rel")
    continue
  }
  $ok++

  $ext = [System.IO.Path]::GetExtension($rel).ToLower()
  # 只解析 HTML/css/xml：JS 里的路径是运行时拼装，静态镜像无需展开
  $isParsable = $ext -in @('.html', '.htm', '.css', '.xml', '.svg', '.webmanifest', '')
  if (-not $isParsable) { continue }
  if ((Get-Item $full).Length -eq 0) { continue }
  $raw = Get-Content $full -Raw -Encoding UTF8
  if ($null -eq $raw) { continue }

  $refs = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($m in [regex]::Matches($raw, '(?i)(?:href|src|srcset|poster|data-src)\s*=\s*["'']([^"'']+)["'']')) { [void]$refs.Add($m.Groups[1].Value) }
  foreach ($m in [regex]::Matches($raw, '(?i)url\(\s*["'']?([^"''\)]+)["'']?\s*\)')) { [void]$refs.Add($m.Groups[1].Value) }
  foreach ($m in [regex]::Matches($raw, '(?i)<loc>\s*([^<\s]+)\s*</loc>')) { [void]$refs.Add($m.Groups[1].Value) }

  foreach ($r in $refs) {
    $n = Normalize-Ref $r $rel
    if ($null -eq $n) { continue }
    if (-not $seen.Contains($n)) { $queue.Enqueue($n) }
  }
}

Write-Output "OK=$ok FAILED=$($failed.Count)"
if ($failed.Count -gt 0) {
  Write-Output "--- 抓取失败清单 ---"
  $failed | Sort-Object -Unique | ForEach-Object { Write-Output $_ }
}

# 闭包校验：扫描已下载的 HTML/CSS/XML，列出仍缺失的引用
# 这些是 BFS 未能覆盖的边角（如 admin 子页深链），可据此手工补抓后再跑一次
$missing = New-Object 'System.Collections.Generic.List[string]'
Get-ChildItem $outDir -Recurse -Include *.html, *.css, *.xml | ForEach-Object {
  $f = $_
  $rel = $f.FullName.Replace("$outDir\", '').Replace('\', '/')
  $dir = ($rel -replace '[^/]+$', '')
  $cx = Get-Content $f.FullName -Raw
  if ($null -eq $cx) { return }
  $refs = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($m in [regex]::Matches($cx, '(?i)(?:href|src|poster)\s*=\s*["'']([^"'']+)["'']')) { [void]$refs.Add($m.Groups[1].Value) }
  foreach ($m in [regex]::Matches($cx, '(?i)url\(\s*["'']?([^"'')]+)["'']?\s*\)')) { [void]$refs.Add($m.Groups[1].Value) }
  foreach ($r0 in $refs) {
    $r = $r0.Trim()
    if ($r -match '^(#|data:|mailto:|javascript:|tel:)') { continue }
    if ($r -match '^https?://') {
      if ($r -match 'roleai\.studio') { $p = ($r -replace '^https?://roleai\.studio', '') } else { continue }
    } else {
      if ($r.StartsWith('/')) { $p = $r } else { $p = "/$dir$r" }
    }
    $p = ($p -split '[?#]')[0]
    if ($p -eq '' -or $p -eq '/') { $p = '/index.html' }
    $local = Join-Path $outDir ($p.TrimStart('/') -replace '/', '\')
    if (-not (Test-Path $local)) { $missing.Add("$rel -> $r") }
  }
}
$missing = $missing | Sort-Object -Unique
Write-Output "缺失引用数=$($missing.Count)"
if ($missing.Count -gt 0) {
  Write-Output "--- 缺失引用清单（需手工补抓） ---"
  $missing | ForEach-Object { Write-Output $_ }
}
