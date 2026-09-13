# xzt 模型表修正 + 映射对比 — 2026-09-13

> 承接上轮：修掉探测器三类假阴性后，xzt 可用模型从 **误报 9 个**纠正为 **16 个**。
> 本轮进一步核实"这些模型对**普通调用方**是否真的可用"，并对比池内已映射情况。

## 一、纠正一个可能的误解：`reasoning_content` 模型**是可用的**

上轮我注意到 11 个未映射的可用模型**全部**被标注 `[推理型,靠reasoning_content]`，
一度怀疑"它们只填 reasoning_content、content 为空 → 入池后用户会收到空回复"。

**本轮实测否定了这个担忧**——用足够的 `max_tokens`（2048）提问"法国首都"：

| 模型 | `content` 字段 | `finish_reason` | 普通调用方可读 |
|---|---|---|---|
| **muse-glimmer-30b** | ✅ **"Paris"** | stop | ✅ |
| **gemma-4-31b-it** | ✅ **"Paris"** | stop | ✅ |
| **openrouter/free** | ✅ **"Paris"** | stop | ✅ |
| deepseek-ai/DeepSeek-V3.2（对照） | ✅ "Paris" | stop | ✅ |
| nemotron-3-ultra | ❌（该次 403 审核拦截） | — | 视情况 |

**结论**：这些都是**标准推理模型**——先输出思考（`reasoning_content`），
思考结束后**照常填充 `content`**。

上轮之所以"只看到 reasoning_content"，是因为我用 `max_tokens: 32` 提问——
**太小了，模型还在思考就被截断**（`finish_reason=length`），`content` 自然还是空的。

> 📌 **教训**：给推理模型探测时，`max_tokens` 必须留足（≥ 数百），
> 否则会把"还没说完"误判为"只说思考不说答案"。
> 这正是我上轮把 `max_tokens` 从 32 提到 256 的原因，但**当时没有验证"提到多少才够"**。
> 本轮实测确认：**2048 足够**，且这些模型确实会填 `content`。

## 二、池内映射 vs 实测可用（对比结果）

### 2.1 已映射的 5 个——**全部实测可用**（无死映射）✅

```
✅ deepseek-ai/DeepSeek-V3.2              340ms   (Tuan)
✅ PaddlePaddle/PaddleOCR-VL-1.5          276ms   (Tuan-ocr)
✅ nemotron-3.5-lightning-30b-a3b         548ms   (Tuan-nemo)
✅ Qwen/Qwen2.5-7B-Instruct               347ms   (Tuan-qwen)
✅ tencent/Hunyuan-MT-7B                  393ms   (Tuan-hunyuan)
```

**这是好消息**：说明此前入池时选的模型都是真的可用，没有选到审核拦截或失效的。

### 2.2 可用但未映射的 11 个（潜在增量）

```
⭕ agnes-2.5-flash                        353ms
⭕ gemma-4-31b-it                         337ms
⭕ gpt-oss-20b                            360ms
⭕ ising-calibration-1.5-31b              543ms
⭕ muse-glimmer-30b                       376ms
⭕ nemotron-3-nano-omni-30b-a3b-reasoning 364ms
⭕ nemotron-3-super                       352ms
⭕ nemotron-3-ultra                      2207ms
⭕ openrouter/free                        694ms
⭕ step-3.5-flash                        2862ms
⭕ step-3.7-flash                        1626ms
```

**注意**：其中 `nemotron-3-ultra` 在我的全量扫描中曾被判 403，
但单独连测 3 次却全部 `200 PONG` —— **审核拦截是间歇性的**（见下节）。

## 三、⚠️ 另一个重要发现：审核拦截（403）是**间歇性**的

证据：

| 场景 | nemotron-3-ultra 表现 |
|---|---|
| 全量扫描（连续 24 模型快跑） | 🚫 403 审核拦截 |
| 单独连测 3 次 | ✅ 200 PONG ×3 |
| 本轮"法国首都"测试 | 🚫 403 |

**同一模型、不同时刻，结果不同** → 审核是**按请求判定且不稳定的**。

**含义**：
- 不能因"某次 403"就把模型永久标记为不可用
- 但也不能保证它稳定可用 → **这类模型不适合做主映射**（会间歇性拒答）

**建议**：新映射应优先选**多次测试都稳定**的模型；
`nemotron-3-ultra` 虽能力可能较强，但因其 403 波动，**不建议作主力映射**。

## 四、结论与建议（需你决定）

### 现状是健康的
- 已映射 5 个**全部可用且稳定**
- 无死映射、无需紧急修正

### 可选增量（非必需）
若想扩展 xzt 的能力覆盖，可考虑加入**稳定可用**的：
- `gemma-4-31b-it`、`muse-glimmer-30b`、`openrouter/free`（三者实测 `content` 正常、响应快）

**但我不建议盲目加**：
1. 该端点有 **10 次/分钟/IP 硬限流**，映射越多、单模型可用配额越少
2. 现有 5 个已覆盖 对话/OCR/翻译/长上下文，**边际收益有限**
3. **增加映射属配置改动，需你批准**

## 五、复现（只读）

```bash
# 用足够大的 max_tokens 验证推理模型会填 content
curl -s https://ai-api.xzt.plus/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"muse-glimmer-30b","max_tokens":2048,"messages":[{"role":"user","content":"What is the capital of France? Answer in one word."}]}' \
  | grep -o '"content":"[^"]*"'
# 期望：能看到 "content":"Paris"
```
