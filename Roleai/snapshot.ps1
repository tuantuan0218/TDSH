# RoleAI Studio 快照抓取/刷新工具
# 用途：从上游抓取只读接口的响应，存为 snapshots/*.json，供 serve.js --snapshot 离线使用
# 用法: & D:\tdsh\Roleai\snapshot.ps1              # 经本地服务抓（需 8088 在跑）
#       & D:\tdsh\Roleai\snapshot.ps1 -Direct      # 直连上游抓（不需本地服务）
param(
  [switch]$Direct,
  [int]$Port = 8088
)

$ErrorActionPreference = 'Continue'
$SnapDir = Join-Path $PSScriptRoot 'snapshots'
$Upstream = 'https://api.roleai.studio'
$ViaLocal = "http://127.0.0.1:$Port/api"

New-Item -ItemType Directory -Force -Path $SnapDir | Out-Null

# 接口路径 -> 快照文件名（与 serve.js lookupSnapshot 的映射规则一致：'/' 换 '_'）
$targets = @(
  @{ path = '/v1/product';                   file = 'v1_product.json' }
  @{ path = '/v1/releases';                  file = 'v1_releases.json' }
  @{ path = '/v1/auth/compliance/documents'; file = 'v1_auth_compliance_documents.json' }
)

Write-Output "快照抓取 @ $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
if ($Direct) { Write-Output "模式: 直连上游 $Upstream" } else { Write-Output "模式: 经本地服务 $ViaLocal" }
Write-Output ''

$succeeded = 0
$failedList = New-Object 'System.Collections.Generic.List[string]'

foreach ($t in $targets) {
  $url = if ($Direct) { "$Upstream$($t.path)" } else { "$ViaLocal$($t.path)" }
  $dest = Join-Path $SnapDir $t.file
  $tmp = "$dest.tmp"

  $code = curl.exe -s -L -o $tmp -w '%{http_code}' --max-time 60 $url

  $valid = $false
  if ($code -eq '200' -and (Test-Path $tmp) -and (Get-Item $tmp).Length -gt 0) {
    # 用 Node 验证是真 JSON（避免把 nginx 的 404 HTML 存成快照）
    $check = node -e "try{const j=require('fs').readFileSync(process.argv[1],'utf8');const o=JSON.parse(j);process.stdout.write(o.ok===true?'OK':'NOTOK')}catch(e){process.stdout.write('BAD')}" $tmp 2>$null
    if ($check -eq 'OK') { $valid = $true }
  }

  if ($valid) {
    Move-Item $tmp $dest -Force
    $size = (Get-Item $dest).Length
    Write-Output "  [OK]   $($t.path)  ->  $($t.file)  ($size B)"
    $succeeded++
  } else {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    Write-Output "  [FAIL] $($t.path)  HTTP=$code  (未覆盖旧快照)"
    $failedList.Add("$($t.path) HTTP=$code")
  }
}

Write-Output ''
if ($succeeded -eq $targets.Count) {
  Write-Output "结果: 全部成功（$succeeded/$($targets.Count)），快照已更新"
} else {
  Write-Output "结果: $succeeded/$($targets.Count) 成功，$( $failedList.Count ) 个失败"
  foreach ($f in $failedList) { Write-Output "  - $f" }
}

# 写入元数据（记录抓取时间与来源，便于日后判断快照新鲜度）
$meta = [ordered]@{
  captured_at = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
  source      = if ($Direct) { $Upstream } else { $ViaLocal }
  method      = if ($Direct) { 'direct' } else { 'via-local-proxy' }
  succeeded   = $succeeded
  total       = $targets.Count
  files       = @($targets | ForEach-Object { [ordered]@{ path = $_.path; file = $_.file } })
}
$metaJson = $meta | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $SnapDir '_meta.json'), $metaJson, (New-Object System.Text.UTF8Encoding($false)))
Write-Output '已更新 snapshots/_meta.json'

if ($succeeded -eq $targets.Count) { exit 0 } else { exit 1 }
