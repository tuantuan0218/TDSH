# S级免费API平台注册与入池指南

> 用户授权注册后，按本指南获取key，然后运行入池脚本即可接入sub2api Tuan池

---

## 🚀 快速流程

`mermaid
graph LR
    A[注册平台] --> B[获取API Key]
    B --> C[运行入池脚本]
    C --> D[验证可用性]
    D --> E[自动加入Tuan池]
`

---

## 1️⃣ 科大讯飞星火 Lite（永久免费，推荐优先）

### 注册步骤

1. **访问官网**: https://xinghuo.xfyun.cn
2. **注册账号**: 手机号/邮箱注册
3. **实名认证**: 必须完成（身份证+人脸识别）
4. **进入控制台**: https://console.xfyun.cn
5. **创建应用**: 
   - 应用名称: sub2api-free
   - 应用类型: 选择"其他"
6. **获取密钥**:
   - APIKey: 在"服务接口认证"中获取
   - APISecret: 同上
   - 注意: Lite版本无需付费，永久免费

### 入池脚本

`powershell
$env:SF_NAME="xunfei-lite-free"
$env:SF_BASE="https://spark-api-open.xf-yun.com/v1"
$env:SF_KEY="<你的APIKey>"
$env:SF_MODELS='{"Tuan":"spark-lite"}'
node add-free-api-pool.mjs
`

### 免费额度
- **Lite版本**: 永久免费，1-3 QPS
- **Pro/Max版本**: 需付费，不推荐

### 验证命令
`powershell
curl -X POST "https://spark-api-open.xf-yun.com/v1/chat/completions" 
  -H "Authorization: Bearer <你的APIKey>" 
  -H "Content-Type: application/json" 
  -d '{"model":"spark-lite","messages":[{"role":"user","content":"hi"}]}'
`

---

## 2️⃣ 快手 KAT-Coder-Air（永久免费）

### 注册步骤

1. **访问官网**: https://streamlake.ai
2. **注册账号**: 手机号注册
3. **进入控制台**: 登录后进入"模型服务"
4. **创建Endpoint**:
   - 模型选择: kat-coder-air-v2.5
   - 部署名称: sub2api-free
5. **获取API Key**: 在"密钥管理"中创建

### 入池脚本

`powershell
$env:SF_NAME="kuaishou-kat-air-free"
$env:SF_BASE="https://api.streamlake.ai/v1"
$env:SF_KEY="<你的API Key>"
$env:SF_MODELS='{"Tuan":"kat-coder-air-v2.5"}'
node add-free-api-pool.mjs
`

### 免费额度
- **Air版本**: 永久免费
- **高峰时段**: 120次/6小时
- **非高峰**: 200次/6小时

---

## 3️⃣ 阿里心流 iflow（不限量免费）

### 注册步骤

1. **访问官网**: https://platform.iflow.cn
2. **注册账号**: 手机号/邮箱
3. **实名认证**: 支付宝认证
4. **创建API Key**: 在"密钥管理"中生成

### 入池脚本

`powershell
$env:SF_NAME="iflow-free"
$env:SF_BASE="https://api.iflow.cn/v1"
$env:SF_KEY="<你的API Key>"
$env:SF_MODELS='{"Tuan":"qwen3-coder-plus"}'
node add-free-api-pool.mjs
`

### 免费额度
- **不限量**: 单并发限制
- **可用模型**: qwen3-coder-plus / kimi-k2 / glm-4.6 / deepseek-v3.2

---

## 4️⃣ 火山方舟（每模型50万token永久）

### 注册步骤

1. **访问官网**: https://www.volcengine.com/product/ark
2. **注册账号**: 手机号注册
3. **实名认证**: 必须完成
4. **进入控制台**: https://console.volcengine.com/ark
5. **创建推理接入点**:
   - 选择模型: doubao-seed-2.0 / deepseek-v4 / kimi-k2
   - 创建Endpoint
6. **获取API Key**: 在"密钥管理"中创建

### 入池脚本

`powershell
$env:SF_NAME="volcengine-free"
$env:SF_BASE="https://ark.cn-beijing.volces.com/api/v3"
$env:SF_KEY="<你的API Key>"
$env:SF_MODELS='{"Tuan":"doubao-seed-2.0"}'
node add-free-api-pool.mjs
`

### 免费额度
- **每模型50万token**: 永久有效
- **可用模型**: doubao-seed-2.0 / deepseek-v4 / kimi-k2

---

## 🔍 入池后验证

### 1. 检查账号状态
`powershell
node mac-pool-query.sh
`

### 2. 健康检查
`powershell
node health-check.js
`

### 3. 数据库查询
`powershell
ssh zhaozicheng@192.168.1.3 "psql -h 127.0.0.1 -U postgres -d sub2api -c \"SELECT id,name,status,priority,credentials->>'base_url' AS base FROM accounts WHERE name LIKE '%free%' AND deleted_at IS NULL ORDER BY priority;\""
`

---

## ⚠️ 注意事项

1. **铁律**: 免费渠道一律 prio 90 兜底，concurrency 1，绝不升权
2. **Key安全**: 所有key只入数据库，不入仓（.gitignore已配置）
3. **额度监控**: 用 health-check.js 定期检查402/429状态
4. **自动避让**: 网关内置error_rate检测，免费渠道触发错误会自动降权
5. **实名认证**: 国内平台均需实名，请准备好身份证

---

## 📊 预期收益

| 平台 | 免费额度 | 推荐模型 | 优先级 |
|------|---------|---------|--------|
| 讯飞Lite | 永久免费 | spark-lite | ⭐⭐⭐⭐⭐ |
| 快手Air | 永久免费 | kat-coder-air-v2.5 | ⭐⭐⭐⭐ |
| 阿里iflow | 不限量 | qwen3-coder-plus | ⭐⭐⭐⭐⭐ |
| 火山方舟 | 50万token/模型 | doubao-seed-2.0 | ⭐⭐⭐ |

---

## 🆘 故障排查

### 401 Unauthorized
- 检查API Key是否正确
- 确认key未过期

### 402 Payment Required
- 免费额度已耗尽
- 等待重置或切换到其他平台

### 429 Too Many Requests
- 触发限流
- 降低并发或等待冷却

### 403 Forbidden
- IP被限制
- 检查代理配置

---

*文档生成时间: 2026-09-13 23:18*
*关联文档: S-LEVEL-FREE-QUICKSTART.md / FREE-API-CHANNELS.md*