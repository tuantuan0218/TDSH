# S 级免费渠道入池快速指南

> 基于 `add-free-api-pool.mjs` 通用脚本，用户提供 key 后一键入池
> 关联文档：`FREE_API_KEYS_2026.md`、`FREE-API-CHANNELS.md`

---

## 通用用法（PowerShell）

```powershell
# 设置环境变量
$env:SF_NAME="<渠道名>"           # 如 "iflow-free"
$env:SF_BASE="<API基址>"          # 如 "https://spark-api-open.xf-yun.com/v1"
$env:SF_KEY="<API密钥>"           # 用户注册后获取
$env:SF_MODELS='<模型映射JSON>'   # 如 '{"Tuan":"spark-lite"}'

# 执行入池
node add-free-api-pool.mjs
```

---

## 1. 科大讯飞星火 Lite（永久免费）

**API 基址**: `https://spark-api-open.xf-yun.com/v1`
**模型名**: `spark-lite`（Lite 永久免费）/ `spark-pro` / `spark-max`
**注册**: https://xinghuo.xfyun.cn → 实名认证 → 控制台获取 API Key
**免费额度**: Lite 版本永久免费，1-3 QPS

```powershell
$env:SF_NAME="xunfei-lite-free"
$env:SF_BASE="https://spark-api-open.xf-yun.com/v1"
$env:SF_KEY="<用户提供的key>"
$env:SF_MODELS='{"Tuan":"spark-lite"}'
node add-free-api-pool.mjs
```

---

## 2. 快手 KAT-Coder-Air（永久免费）

**API 基址**: `https://api.streamlake.ai/v1`（OpenAI 兼容格式）
**模型名**: `kat-coder-air-v2.5`（Air 永久免费）/ `kat-coder-pro-v2`（新用户 2000 万 token）
**注册**: https://streamlake.ai → 注册 → 创建 Endpoint + API Key
**免费额度**: Air 版本永久免费，高峰 120 次/6h，非高峰 200 次/6h

```powershell
$env:SF_NAME="kuaishou-kat-air-free"
$env:SF_BASE="https://api.streamlake.ai/v1"
$env:SF_KEY="<用户提供的key>"
$env:SF_MODELS='{"Tuan":"kat-coder-air-v2.5"}'
node add-free-api-pool.mjs
```

---

## 3. 阿里心流 iflow（不限量免费）

**API 基址**: `https://api.iflow.cn/v1`（OpenAI 兼容）
**模型名**: `qwen3-coder-plus` / `kimi-k2-instruct-0905` / `glm-4.6` / `deepseek-v3.2-exp`
**注册**: https://platform.iflow.cn → 注册 → API Key
**免费额度**: 不限量，单并发限制

```powershell
$env:SF_NAME="iflow-free"
$env:SF_BASE="https://api.iflow.cn/v1"
$env:SF_KEY="<用户提供的key>"
$env:SF_MODELS='{"Tuan":"qwen3-coder-plus"}'
node add-free-api-pool.mjs
```

---

## 4. 火山方舟（每模型 50 万 token 永久）

**API 基址**: `https://ark.cn-beijing.volces.com/api/v3`
**模型名**: `doubao-seed-2.0` / `deepseek-v4` / `kimi-k2`
**注册**: https://www.volcengine.com/product/ark → 实名认证 → 获取 API Key
**免费额度**: 每模型 50 万 token，永久

```powershell
$env:SF_NAME="volcengine-free"
$env:SF_BASE="https://ark.cn-beijing.volces.com/api/v3"
$env:SF_KEY="<用户提供的key>"
$env:SF_MODELS='{"Tuan":"deepseek-v4"}'
node add-free-api-pool.mjs
```

---

## 5. 美团 LongCat（每天 50 万 token）

**API 基址**: `https://api.longcat.me/v1`
**模型名**: `longcat-2.0`
**注册**: https://longcat.me → 实名认证 → API Key
**免费额度**: 每天 50 万 token，永久每日重置

```powershell
$env:SF_NAME="meituan-longcat-free"
$env:SF_BASE="https://api.longcat.me/v1"
$env:SF_KEY="<用户提供的key>"
$env:SF_MODELS='{"Tuan":"longcat-2.0"}'
node add-free-api-pool.mjs
```

---

## 6. Mistral（10 亿 token/月永久）

**API 基址**: `https://api.mistral.ai/v1`
**模型名**: `mistral-large-latest` / `ministral-3-14b`
**注册**: https://console.mistral.ai → 手机验证 → Experiment Plan
**免费额度**: 10 亿 token/月，永久

```powershell
$env:SF_NAME="mistral-free"
$env:SF_BASE="https://api.mistral.ai/v1"
$env:SF_KEY="<用户提供的key>"
$env:SF_MODELS='{"Tuan":"ministral-3-14b"}'
node add-free-api-pool.mjs
```

---

## 7. Cerebras（每天 100 万 token）

**API 基址**: `https://api.cerebras.ai/v1`
**模型名**: `llama-3.3-70b` / `qwen-3-235b`
**注册**: https://cloud.cerebras.ai → 邮箱 → 无需信用卡
**免费额度**: 每天 100 万 token，永久每日重置

```powershell
$env:SF_NAME="cerebras-free"
$env:SF_BASE="https://api.cerebras.ai/v1"
$env:SF_KEY="<用户提供的key>"
$env:SF_MODELS='{"Tuan":"llama-3.3-70b"}'
node add-free-api-pool.mjs
```

---

## 8. Groq（永久免费极速推理）

**API 基址**: `https://api.groq.com/openai/v1`
**模型名**: `llama-3.3-70b-versatile` / `kimi-k2-instruct-0905`
**注册**: https://console.groq.com → 邮箱 → 无需信用卡
**免费额度**: 永久免费，速率限制 RPM 10-60

```powershell
$env:SF_NAME="groq-free"
$env:SF_BASE="https://api.groq.com/openai/v1"
$env:SF_KEY="<用户提供的key>"
$env:SF_MODELS='{"Tuan":"llama-3.3-70b-versatile"}'
node add-free-api-pool.mjs
```

---

## 入池后验证

```powershell
# 查看入池状态
node mac-pool-query.sh

# 健康检查
node health-check.js

# 查看账号列表
ssh zhaozicheng@192.168.1.3 "psql -h 127.0.0.1 -U postgres -d sub2api -c \"SELECT id,name,status,priority FROM accounts WHERE name LIKE '%free%' AND deleted_at IS NULL ORDER BY priority;\""
```

---

## 注意事项

1. **铁律**: 免费渠道一律 prio 90 兜底，concurrency 1，绝不升权
2. **key 安全**: 所有 key 只入数据库，不入仓（.gitignore 已配置）
3. **额度监控**: 用 `health-check.js` 定期检查 402/429 状态
4. **error_rate 自动避让**: 网关内置，免费渠道触发错误会自动降权

---

## ⚠️ 伪免费警告（逆向代理验证结果 - 2026-09-13 实测）

以下项目经实际 clone + 启动验证，**并非真正免费**，需要付费订阅前置条件：

### ❌ cursor-free-api (cursor2api)
- **声称**: 免费使用 Cursor Web Docs AI API
- **实测结果**: HTTP 500 错误 - Cursor API 需要有效的 _vcrcs cookie（Vercel 安全验证）
- **真实前置条件**: 
  - Cursor 账号 + 浏览器登录获取 cookie
  - 可能需要 Cursor Pro 订阅
  - cookie 有效期短，需频繁更新
- **结论**: **不推荐入池** - 维护成本高，非真正免费

### ❌ copilot-api (ericc-ch) / copilot-openai-api (yuchanns)
- **声称**: 将 GitHub Copilot 转为 OpenAI API
- **实测结果**: `GitHub Copilot config not found at %LOCALAPPDATA%/github-copilot`
- **真实前置条件**:
  - **GitHub Copilot 付费订阅**（/月 或 /年）
  - 需在 VS Code/Vim 等 IDE 安装 Copilot 插件并登录
  - 生成 hosts.json + 	oken.json 配置文件
- **结论**: **非免费** - 需要 Copilot 订阅，已有付费用户可考虑复用

### ⚠️ claude-code-proxy
- **实际功能**: 模型映射器（Claude Code → OpenAI/Gemini/Ollama）
- **不是免费 API 来源**: 只是协议转换，需要用户提供自己的 API key
- **适用场景**: 已有 OpenAI/Gemini key，想让 Claude Code CLI 调用

---

## ✅ 真正可用的免费方案总结

| 类型 | 平台 | 免费额度 | 推荐度 |
|------|------|---------|--------|
| **官方免费档** | 讯飞 Lite / 快手 KAT-Air / iflow | 永久免费 | ⭐⭐⭐⭐⭐ |
| **大厂免费额度** | Groq / Cerebras / Mistral | 每日重置 | ⭐⭐⭐⭐ |
| **Keyless 匿名** | Pollinations / OVHcloud | 按 IP 限流 | ⭐⭐⭐ |
| **逆向代理** | cursor-free-api / copilot-api | ❌ 需付费订阅 | ❌ 不推荐 |

**最佳实践**: 优先使用官方永久免费档（iflow/讯飞/快手），其次是每日重置的大厂额度（Groq/Cerebras），最后才是 keyless 匿名端点作兜底。逆向代理方案维护成本高且有封号风险，不建议入池。

---

*文档生成时间: 2026-09-13 14:35 UTC | 验证方法: git clone + 本地启动 + API 调用实测*