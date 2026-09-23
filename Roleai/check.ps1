# RoleAI Studio 镜像一键健康巡检
# 用法: & D:\tdsh\Roleai\check.ps1            快速模式
#       & D:\tdsh\Roleai\check.ps1 -Remote    含源站逐文件哈希比对
# 退出码: 0=全绿  1=发现问题
param(
  [switch]$Remote,
  [int]$Port = 8088
)

$ErrorActionPreference = 'Continue'
$SiteDir = Join-Path $PSScriptRoot 'site'
$Prefix  = $SiteDir + '\'
$Base    = "http://127.0.0.1:$Port"
$Origin  = 'https://roleai.studio'
$script:Issues = New-Object 'System.Collections.Generic.List[string]'

function Say  { param($m) Write-Output $m }
function Sect { param($m) Write-Output ''; Write-Output "=== $m ===" }
function Pass { param($m) Write-Output "  [OK]   $m" }
function Warn { param($m) Write-Output "  [WARN] $m" }
function Fail { param($m) Write-Output "  [FAIL] $m"; $script:Issues.Add($m) }
function Http { param($u) return (curl.exe -s -o NUL -w '%{http_code}' --max-time 20 $u) }

Say "RoleAI Studio 镜像巡检 @ $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$svcUp = $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)

Sect '1. 本地服务'
if ($svcUp) {
  Pass "端口 $Port 监听中"
} else {
  Fail "端口 $Port 未监听，请先运行 serve.js"
}
if ($svcUp) {
  $hc = Http "$Base/"
  if ($hc -eq '200') { Pass '首页 HTTP 200' } else { Fail "首页返回 $hc" }
}

Sect '2. 关键路径可达性'
$keyPaths = @(
  '/', '/skill.html', '/downloads.html', '/pricing.html', '/updates.html',
  '/login.html', '/client-auth.html', '/identity.html', '/payment.html',
  '/support.html', '/agent.html', '/admin/',
  '/legal/user-agreement.html', '/legal/privacy-policy.html',
  '/robots.txt', '/sitemap.xml', '/runtime-config.js',
  '/assets/wechat-customer-service.jpg', '/assets/roleai-icon.png',
  '/assets/roleai-studio-workspace-1920x1080.png',
  '/assets/payment.js', '/assets/qrcode-generator-2.0.4.js',
  '/admin/assets/admin.js', '/admin/assets/admin.css'
)
$bad = New-Object 'System.Collections.Generic.List[string]'
foreach ($p in $keyPaths) {
  $c = Http "$Base$p"
  if ($c -ne '200') { $bad.Add("$p => $c") }
}
if ($bad.Count -eq 0) {
  Pass "$($keyPaths.Count)/$($keyPaths.Count) 路径全部 200"
} else {
  foreach ($b in $bad) { Fail "路径异常: $b" }
}

Sect '3. 静态引用完整性'
$missing = New-Object 'System.Collections.Generic.List[string]'
$scanFiles = Get-ChildItem $SiteDir -Recurse -Include *.html, *.css, *.xml -ErrorAction SilentlyContinue
foreach ($f in $scanFiles) {
  $Prefix = $SiteDir + '\'
  $rel = $f.FullName.Replace($Prefix, '') -replace '\\', '/'
  $idx = $rel.LastIndexOf('/')
  $dir = ''
  if ($idx -ge 0) { $dir = $rel.Substring(0, $idx + 1) }
  $cx = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($null -eq $cx) { continue }
  $refs = New-Object 'System.Collections.Generic.List[string]'
  $q = [char]39 + [char]34
  $reAttr = [regex]('(?i)(?:href|src|poster)\s*=\s*[' + $q + ']([^' + $q + ']+)[' + $q + ']')
  $reCss = [regex]('(?i)url\(\s*[' + $q + ']?([^' + $q + ')]+)[' + $q + ']?\s*\)')
  foreach ($m in $reAttr.Matches($cx)) { $refs.Add($m.Groups[1].Value) }
  foreach ($m in $reCss.Matches($cx)) { $refs.Add($m.Groups[1].Value) }
  foreach ($r0 in $refs) {
    $r = $r0.Trim()
    if ($r -match '^(#|data:|mailto:|javascript:|tel:)') { continue }
    if ($r -match '^https?://') {
      if ($r -notmatch 'roleai\.studio') { continue }
      $p2 = $r -replace '^https?://roleai\.studio', ''
    } else {
      $p2 = $r
      if (-not $r.StartsWith('/')) { $p2 = "/$dir$r" }
    }
    $p2 = ($p2 -split '[?#]')[0]
    if ($p2 -eq '' -or $p2 -eq '/') { $p2 = '/index.html' }
    $local = Join-Path $SiteDir ($p2.TrimStart('/') -replace '/', '\')
    if (-not (Test-Path $local)) { $missing.Add("$rel -> $r") }
  }
}
if ($missing.Count -eq 0) { Pass '静态引用缺失 = 0' } else { foreach ($m in $missing) { Fail "缺失引用: $m" } }

Sect '4. 运行时资源审计'
$rt = New-Object 'System.Collections.Generic.HashSet[string]'
$jsFiles = Get-ChildItem $SiteDir -Recurse -Include *.js -File -ErrorAction SilentlyContinue
foreach ($jf in $jsFiles) {
  $jc = Get-Content $jf.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
  if ($null -eq $jc) { continue }
  foreach ($m in [regex]::Matches($jc, '(?<![A-Za-z0-9._\-/])assets/[A-Za-z0-9._\-/]+')) { [void]$rt.Add($m.Value) }
}
$rtMiss = New-Object 'System.Collections.Generic.List[string]'
foreach ($r in $rt) {
  if (-not (Test-Path (Join-Path $SiteDir ($r -replace '/', '\')))) { $rtMiss.Add($r) }
}
if ($rtMiss.Count -eq 0) { Pass "运行时资源 $($rt.Count) 个引用，缺失 = 0" } else { foreach ($m in $rtMiss) { Fail "运行时资源缺失: /$m" } }

Sect '5. API 反向代理'
$apiCode = Http "$Base/api/v1/product"
if ($apiCode -eq '200') { Pass '/api/v1/product 200' } else { Fail "/api/v1/product 返回 $apiCode" }

Sect '5-b. 快照完整性'
$SnapDir = Join-Path $PSScriptRoot 'snapshots'
if (-not (Test-Path $SnapDir)) {
  Warn 'snapshots/ 不存在（快照模式不可用，不影响代理模式）'
} else {
  $snapFiles = Get-ChildItem $SnapDir -Filter '*.json' -File | Where-Object { $_.Name -ne '_meta.json' }
  $badSnap = New-Object 'System.Collections.Generic.List[string]'
  foreach ($sf in $snapFiles) {
    # 用 Node 校验是真 JSON 且 ok=true（防止混入 HTML 错误页）
    $r = node -e "try{const o=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));process.stdout.write(o.ok===true?'OK':'NOTOK')}catch(e){process.stdout.write('BAD')}" $sf.FullName 2>$null
    if ($r -ne 'OK') { $badSnap.Add("$($sf.Name) => $r") }
  }
  if ($snapFiles.Count -eq 0) {
    Warn 'snapshots/ 为空'
  } elseif ($badSnap.Count -eq 0) {
    Pass "快照 $($snapFiles.Count) 个，JSON 全部有效"
  } else {
    foreach ($b in $badSnap) { Fail "快照无效: $b" }
  }
  $metaPath = Join-Path $SnapDir '_meta.json'
  if (Test-Path $metaPath) {
    $meta = Get-Content $metaPath -Raw | ConvertFrom-Json
    Pass "快照抓取于 $($meta.captured_at)"
  }
}

Sect '6. HTTP Range 支持'
$hdr = curl.exe -s -D - -o NUL --max-time 20 -H 'Range: bytes=0-99' "$Base/assets/roleai-icon.png"
$hdrTxt = $hdr -join "`n"
$has206 = $hdrTxt -match '206'
$hasCR = $hdrTxt -match 'Content-Range: bytes 0-99/'
if ($has206 -and $hasCR) { Pass 'Range 206 + Content-Range 正确' } else { Fail 'Range 响应异常' }

Sect '7. 目录穿越防护'
$attacks = @('/../serve.js', '/..%2fserve.js', '/%2e%2e%2fserve.js', '/assets/../../serve.js', '/assets/..%5c..%5cserve.js')
$breached = New-Object 'System.Collections.Generic.List[string]'
foreach ($a in $attacks) {
  $c = Http "$Base$a"
  if ($c -eq '200') { $breached.Add($a) }
}
if ($breached.Count -eq 0) { Pass "$($attacks.Count) 个穿越变体全部拦截" } else { foreach ($b in $breached) { Fail "穿越未被拦截: $b" } }

Sect '8. 镜像统计'
$allFiles = Get-ChildItem $SiteDir -Recurse -File
$sum = ($allFiles | Measure-Object Length -Sum).Sum
$sizeMB = [math]::Round($sum / 1MB, 2)
Pass "$($allFiles.Count) 个文件, $sizeMB MB"

Sect '9. 源站差异'
if (-not $Remote) {
  Say '  [SKIP] 未启用（加 -Remote 开启）'
}

if ($Remote -and -not $svcUp) {
  Warn '本地服务未运行，跳过'
}

if ($Remote -and $svcUp) {
  $diffCount = 0
  $checked = 0
  $unreachable = 0
  foreach ($f in $allFiles) {
    $relNoRoot = $f.FullName.Replace($Prefix, '')
    $rel = '/' + ($relNoRoot -replace '\\', '/')
    if ($rel -like '/admin/*') { continue }
    $tmp = Join-Path $env:TEMP ('roleai_cmp_' + [guid]::NewGuid().ToString('N'))
    $c = curl.exe -s -L -o $tmp -w '%{http_code}' --max-time 30 "$Origin$rel"
    if ($c -ne '200') { $unreachable++; Remove-Item $tmp -Force -ErrorAction SilentlyContinue; continue }
    $checked++
    $lh = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
    $rh = (Get-FileHash $tmp -Algorithm SHA256).Hash
    if ($lh -ne $rh) { $diffCount++; Warn "内容有差异: $rel"; $script:Issues.Add("源站已更新: $rel") }
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
  Pass "比对 $checked 个文件，差异 $diffCount 个"
  if ($unreachable -gt 0) { Warn "$unreachable 个文件源站不可达" }
}

Write-Output ''
Write-Output '================ 巡检汇总 ================'
if ($script:Issues.Count -eq 0) {
  Write-Output '结果: 全绿，未发现问题'
  exit 0
}
Write-Output "结果: 发现 $($script:Issues.Count) 个问题"
foreach ($i in $script:Issues) { Write-Output "  - $i" }
exit 1
