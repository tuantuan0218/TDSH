$s3 = '\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy3'
New-Item -ItemType Directory -Force -Path "H:\ChromeLoginClone\Default\Network" | Out-Null
$src = "$s3\Chrome\UserData"
$dstRoot = "H:\ChromeLoginClone"

$files = @(
  @{ s = "$src\Local State"; d = "$dstRoot\Local State" },
  @{ s = "$src\Default\Network\Cookies"; d = "$dstRoot\Default\Network\Cookies" },
  @{ s = "$src\Default\Preferences"; d = "$dstRoot\Default\Preferences" },
  @{ s = "$src\Default\Login Data"; d = "$dstRoot\Default\Login Data" }
)
foreach ($f in $files) {
  try {
    Copy-Item $f.s $f.d -Force -ErrorAction Stop
    "OK: $(Split-Path $f.s -Leaf) -> $(Get-Item $f.d).Length"
  } catch {
    "FAIL: $(Split-Path $f.s -Leaf): $($_.Exception.Message.Split([char]10)[0])"
  }
}
"=== 结果 ==="
Get-ChildItem "$dstRoot" -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName, Length