# 批量集成S级免费API到sub2api Tuan池
# 用法: 填写下方key后运行 .\batch-integrate-free-apis.ps1

Write-Host "=== S级免费API批量入池工具 ===" -ForegroundColor Cyan
Write-Host "请确保已按 REGISTRATION-GUIDE.md 注册并获取key
" -ForegroundColor Yellow

# ==================== 配置区域 ====================
# 讯飞星火 Lite (永久免费)
$XUNFEI_KEY = ""  # 填写你的讯飞 APIKey

# 快手 KAT-Coder-Air (永久免费)
$KUAISHOU_KEY = ""  # 填写你的快手 API Key

# 阿里心流 iflow (不限量)
$IFLOW_KEY = ""  # 填写你的阿里 API Key

# 火山方舟 (每模型50万token)
$VOLCENGINE_KEY = ""  # 填写你的火山 API Key

# ==================== 集成逻辑 ====================
$success = 0
$failed = 0

function Integrate-Platform {
    param([string]$Name, [string]$Base, [string]$Key, [string]$Models, [string]$DisplayName)
    
    if ([string]::IsNullOrWhiteSpace($Key)) {
        Write-Host "[SKIP] $DisplayName - 未配置key" -ForegroundColor DarkGray
        return
    }
    
    Write-Host "[RUN]  $DisplayName..." -ForegroundColor Cyan
    try {
        $env:SF_NAME = $Name
        $env:SF_BASE = $Base
        $env:SF_KEY = $Key
        $env:SF_MODELS = $Models
        
        & node add-free-api-pool.mjs
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK]   $DisplayName 入池成功" -ForegroundColor Green
            $script:success++
        } else {
            Write-Host "[FAIL] $DisplayName 入池失败 (exit=$LASTEXITCODE)" -ForegroundColor Red
            $script:failed++
        }
    } catch {
        Write-Host "[FAIL] $DisplayName 异常: $_" -ForegroundColor Red
        $script:failed++
    }
}

# 1. 讯飞星火 Lite
Integrate-Platform -Name "xunfei-lite-free" `
    -Base "https://spark-api-open.xf-yun.com/v1" `
    -Key $XUNFEI_KEY `
    -Models '{"Tuan":"spark-lite"}' `
    -DisplayName "讯飞星火Lite"

# 2. 快手 KAT-Coder-Air
Integrate-Platform -Name "kuaishou-kat-air-free" `
    -Base "https://api.streamlake.ai/v1" `
    -Key $KUAISHOU_KEY `
    -Models '{"Tuan":"kat-coder-air-v2.5"}' `
    -DisplayName "快手KAT-Coder-Air"

# 3. 阿里心流 iflow
Integrate-Platform -Name "iflow-free" `
    -Base "https://api.iflow.cn/v1" `
    -Key $IFLOW_KEY `
    -Models '{"Tuan":"qwen3-coder-plus"}' `
    -DisplayName "阿里心流iflow"

# 4. 火山方舟
Integrate-Platform -Name "volcengine-free" `
    -Base "https://ark.cn-beijing.volces.com/api/v3" `
    -Key $VOLCENGINE_KEY `
    -Models '{"Tuan":"doubao-seed-2.0"}' `
    -DisplayName "火山方舟"

# ==================== 汇总报告 ====================
Write-Host "
=== 集成完成 ===" -ForegroundColor Cyan
Write-Host "成功: $success" -ForegroundColor Green
Write-Host "失败: $failed" -ForegroundColor ($failed -gt 0 ? "Red" : "Gray")
Write-Host "跳过: $(4 - $success - $failed)" -ForegroundColor DarkGray

if ($success -gt 0) {
    Write-Host "
>>> 运行健康检查..." -ForegroundColor Cyan
    & node health-check.js
}

Write-Host "
>>> 查看池内免费账号:" -ForegroundColor Cyan
& node mac-pool-query.sh

Write-Host "
按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")