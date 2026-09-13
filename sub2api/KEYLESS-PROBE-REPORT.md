# Keyless 端点实测报告 (2026-09-13)

## 测试范围
4 个声称"无需 API key"的免费端点：
1. Pollinations (text.pollinations.ai)
2. OVHcloud (oai.endpoints.kepler.ai.cloud.ovh.net)
3. LLM7 (api.llm7.io)
4. Kilo Gateway (api.kilo.ai)

## 实测结果

### ✅ 可用：Pollinations
- **端点**: `https://text.pollinations.ai/openai/chat/completions`
- **模型**: `openai`
- **延迟**: 3705ms
- **响应**: HTTP 200, 正确返回 "pong"
- **状态**: 已入池（账号 18，prio 90，concurrency 1）
- **限制**: 按 IP 限流，匿名可用

### ❌ 不可用：OVHcloud
- **端点**: `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions`
- **模型**: `qwen3.5-397b-a17b`
- **响应**: HTTP 429 (Too Many Requests)
- **原因**: 匿名层严格限流（2 RPM），可能已被当前 IP 触发
- **建议**: 需注册获取 key，或极低频使用

### ❌ 不可用：LLM7
- **端点**: `https://api.llm7.io/v1/chat/completions`
- **模型**: `gpt-oss-20b`
- **响应**: fetch failed
- **原因**: 网络/SSL 错误，可能需要代理或已下线
- **建议**: 暂不可用

### ❌ 不可用：Kilo Gateway
- **端点**: `https://api.kilo.ai/api/gateway/chat/completions`
- **模型**: `nvidia/nemotron-3-ultra-550b-a55b:free`
- **响应**: fetch failed
- **原因**: 网络/SSL 错误，可能需要代理或已下线
- **建议**: 暂不可用

## 结论

**4 个 keyless 端点中，仅 1 个真正可用**（Pollinations），且已入池。

其余 3 个要么严格限流（OVHcloud 429），要么网络不可达（LLM7/Kilo）。

## 一键入池命令（仅 Pollinations 可用）

```powershell
$env:SF_NAME="pollinations-text-free"
$env:SF_BASE="https://text.pollinations.ai/openai"
$env:SF_KEY="anonymous"
$env:SF_MODELS='{"Tuan":"openai"}'
node add-free-api-pool.mjs
```

## 下一步建议

1. **优先使用官方免费额度**（需注册 key）：
   - NVIDIA NIM (129 模型)
   - ModelScope (2000 次/天)
   - Groq (极速，RPM 10-60)
   - Cerebras (100 万 token/天)

2. **Keyless 端点仅作兜底**：Pollinations 已入池，其他不可靠

3. **监控额度**：用 `health-check.js` 定期检查 402/429 状态

---
生成时间: 2026-09-13T15:45:00Z
测试工具: probe-keyless.mjs