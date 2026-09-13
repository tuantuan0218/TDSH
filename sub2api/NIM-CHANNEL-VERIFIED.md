# NVIDIA NIM 通道核查 + 入池脚本修正 — 2026-09-13

> 背景：并行会话战报把 NIM 列为受限项 U8（"需用户人工过 hCaptcha"）。
> 本轮**独立复核 NIM 的真实门槛**，并修正入池脚本中的两处不准确/副作用。

## 一、NIM 真实门槛（本机实测）

| 项 | 实测结果 |
|---|---|
| `GET /v1/models`（匿名） | **HTTP 200** ✅ 可列 **82 个模型** |
| `POST /v1/chat/completions`（匿名） | **HTTP 401** — `Header of type \`authorization\` was missing` |
| 结论 | **只差一把 key**；模型目录公开可查，调用必须带 `nvapi-` key |

**脚本原注释所列的 6 个模型 ID，我逐个核对——全部真实存在**：

```
✅ z-ai/glm-5.3-flash
✅ deepseek-ai/deepseek-v4-flash-0731
✅ moonshotai/kimi-k3
✅ openai/gpt-oss-20b
✅ poolside/laguna-xs-2.1
✅ nvidia/nemotron-3.5-lightning-30b-a3b
```

（另实测目录含 `deepseek-ai/deepseek-v4-pro-0813`、`01-ai/yi-large`、`google/codegemma-*` 等）

## 二、修正项 1：注释里的错误状态码

脚本原注释称 **"chat 匿名 500"**，实测为 **401**。
已更正为精确的 401 + 真实错误文本，避免后续误判（500 会被当成上游故障，401 才是"缺 key"）。

## 三、修正项 2：去掉 `wsl.exe` 依赖（消除 WSL 拉起副作用）

原脚本用 `wsl.exe -e bash <脚本>` 执行 SSH。
**问题**：`wsl.exe` 会**拉起整个 WSL 实例**（常驻内存约数百 MB 至 1GB+），
而本机 SSH 直连**已验证可用**，**无需借道 WSL**。

**已改为**：优先 `bash -c` 直跑 → 失败才回退 `wsl.exe`（保可用性，但优先走无 WSL 路径）。

> 这与用户环境关切一致（历史上 WSL 被反复拉起是已知问题）。

## 四、修正项 3：`prio 90` 文案

与 `add-free-api-pool.mjs` 同源问题：两脚本的 SQL **都不显式写 priority**（走 DB 默认值），
但完成语曾称 "prio 90 兜底"。**实测落库为 50**，已一并更正为
「priority 未显式写入，以 DB 实际值为准」。

（同批修正已于 `add-free-api-pool.mjs` 完成，本轮补齐 NIM 版。）

## 五、NIM 通道的价值评估（为何值得你过一次 hCaptcha）

| 维度 | 数值 |
|---|---|
| 免费额度 | **无限制额度**（linux.do 汇总口径） |
| 速率 | **40 RPM**（可申请提至 200） |
| 模型数 | **82 个**（含 GLM-5.3-Flash、DeepSeek-V4-Flash、Kimi-K3、gpt-oss-20b） |
| 大陆访问 | 可直连 |

**对比**：xzt（免 key）只有 10 次/分钟且审核敏感；pollinations 只有 1 个模型。
**NIM 的 40 RPM + 82 模型是当前已知最优质的免费档**，一次人工验证的回报很高。

## 六、当前的完整受限项清单（两会话一致）

| 编号 | 事项 | 需你做什么 | 回报 |
|---|---|---|---|
| **U8** | **NVIDIA NIM** | 过一次 **hCaptcha**（表单已填好） | ⭐ **40 RPM + 82 模型 + 无限制额度** |
| U9 | OpenRouter / NexoToken | 提供 **主流邮箱**（qq/163） | 22 零价模型（配置已就绪 `openrouter-free-config.json`） |
| U10 | AgentRouter | 授权用你的登录态 OAuth | 100% 可用率、签到领模型 |
| U11 | GoRouter | 人工过 Turnstile | Anthropic 系签到 |

> **自动化能做的确实已到顶**：匿名可用 2 端点（均已入池）、注册类被四类墙拦截。
> 剩下的增量**全部需要你亲手过一次人机验证或提供真实邮箱**。

## 七、复现

```bash
# NIM 门槛复核（免 key）
curl -s -o /dev/null -w "%{http_code}\n" https://integrate.api.nvidia.com/v1/models   # 期望 200
curl -s https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Content-Type: application/json" -d '{"model":"z-ai/glm-5.3-flash","messages":[{"role":"user","content":"hi"}]}'
# 期望 401 Header of type `authorization` was missing

# key 到手后一键入池
$env:SF_KEY="nvapi-xxx"; $env:SF_MODELS='{"Tuan":"z-ai/glm-5.3-flash"}'
node liunxddo\add-nvidia-nim-pool.mjs
```
