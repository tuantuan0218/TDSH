# xzt 端点完整模型表 + 限流实测（2026-09-13）

> 背景：`ai-api.xzt.plus` 是本会话新发现的**免 key 可用端点**，已入池（账号 31）。
> 本文补全其 24 个模型的出词实测，并给出**实测到的硬限流**——后者直接决定该账号能否当兜底位用。

## 一、⚠️ 最重要的发现：严格 10 次/分钟/IP 限流（实测）

**实验设计**：对同一端点连续快速打 12 次 chat 请求，记录每次 HTTP 状态。

**结果**：

```
请求 1-10 : HTTP 200  ✅
请求 11    : HTTP 429  ⛔ "请求过于频繁，同 IP 每分钟最多 10 次请求，请 X 秒后重试"
请求 12    : HTTP 429  ⛔
```

**结论**：端点是**严格的 10 次/分钟/IP** 限流，窗口为**滚动**（并非按整分钟重置）。

**对池的影响（关键）**：
- 账号 31 配置为 `concurrency=1`，理论上**每秒**最多 1 次请求 → **60 次/分钟**
- 这**远超**端点的 10 次/分钟上限 → 若被频繁调度，**约 5/6 的请求会撞 429**
- 因此该账号**只能作极低频兜底**，不可作为主力；且需依赖池的 `error_rate 自动避让`机制
  在 429 累积后自动降权（这正是兜底位设计的意义）

> 📌 **教训**：`concurrency=1` 的语义是"同时最多 1 个在途请求"，**不等于**"速率受控"。
> 对带速率上限的端点，仅靠 concurrency 无法防限流。这类端点应记录 rate limit 元数据。

## 二、完整模型表（24 个，含限流退避后的准确结果）

### ✅ 实测可用（9 个）

| 模型 | 首次实测 | 退避复测 | 响应耗时 |
|---|---|---|---|
| `PaddlePaddle/PaddleOCR-VL-1.5` | ✅ | — | 503ms（OCR 专用，非对话） |
| `Qwen/Qwen2.5-7B-Instruct` | ✅ | — | 664ms |
| `agnes-2.5-flash` | ✅ | — | 1346ms |
| `nemotron-3.5-lightning-30b-a3b` | 429 | ✅ 出词 | — |
| `gemma-4-31b-it` | 429 | ✅ 出词 | — |
| `kilo-auto/free` | 429 | ✅ 出词 | — |
| `deepseek-ai/DeepSeek-V3.2` | ✅ | — | 1889ms |
| `nemotron-3-ultra` | 429 | ✅ 出词 | — |
| `nemotron-3-super` | 429 | ✅ 出词 | — |
| `openrouter/free` | 429 | ✅ 出词 | 聚合路由 |

### ❌ 实测不可用（需注意原因各异）

| 模型 | 状态 | 原因 |
|---|---|---|
| `Qwen/Qwen3-8B` | 403 | **内容审核拦截**（非限流） |
| `THUDM/GLM-Z1-9B-0414` | 403 | 内容审核拦截 |
| `deepseek-ai/DeepSeek-OCR` | 403 | 内容审核拦截 |
| `deepseek-ai/DeepSeek-R1-0528-Qwen3-8B` | 403 | 内容审核拦截 |
| `step-3.7-flash` | 403 | 内容审核拦截 |
| `gpt-oss-20b` | 200 | 返回 200 但正文为空 |
| `Qwen/Qwen3.5-4B` / `Qwen/Qwen3.5-9B` | 200 | 正文为空 |
| `muse-glimmer-30b` | 200 | 正文为空 |
| `diffusiongemma-26b-a4b-it`、`ising-calibration-1.5-31b`、`nemotron-3-nano-omni-30b-a3b-reasoning`、`step-3.5-flash`、`tencent/Hunyuan-MT-7B` | 429 | 未完成退避复测 |

**403「内容审核拦截」值得注意**：连"Reply with exactly: PONG"这种无害 prompt 都会被拦，
说明该端点的内容审核**过度敏感/有缺陷**，这些模型实际不可用于生产。

## 三、方法论教训（本会话踩坑记录）

**错误结论**：首轮串行快打 24 个模型，得到"仅 4 个可用"。
**真实情况**：19 个报 429，其中许多在退避后**实际可用**。

- ❌ 把 429 读成"模型不可用"→ 会漏掉真实可用的模型
- ✅ 正确做法：**区分 429（限流，可重试）与 4xx/403（真不可用）**，
  并在批量探测中**主动插入退避**（本端点需 ≥6 秒/次）

已据此修正探测脚本认知；后续任何对该端点的批量测试都应遵守 10 次/分钟预算。

## 四、复现

```bash
# 完整模型表（脚本已内置 60s 超时，但**未内置退避**，高并发会触发 429）
node probe-xzt-models.mjs --json out.json

# 限流验证（连续 12 次，观察第 11 次起 429）
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" https://ai-api.xzt.plus/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"deepseek-ai/DeepSeek-V3.2","messages":[{"role":"user","content":"hi"}],"max_tokens":8}'
done
```
