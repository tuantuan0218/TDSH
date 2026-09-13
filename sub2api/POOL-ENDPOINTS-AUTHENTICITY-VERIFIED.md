# 池内免 key 端点真实性核验 + pollinations 预算状态 — 2026-09-13

> 动机：上轮抓到 `completions.me` 是**假服务**（任何输入返回同一句固定文本）。
> 这引出必须回答的问题：**池内已入池的免 key 端点是不是真的？**
> 方法：把新增的**知识校验门**（问 17×23，正解 391）直接用在池内端点上。**全程只读**。

## 一、结论速览

| 端点 | 归属账号 | 17×23 | ZULU-99 | 判定 |
|---|---|---|---|---|
| `ai-api.xzt.plus/v1` | #31 / #32 | **391** ✅ | ZULU-99 ✅ | ✅ **真实模型** |
| 同上（换模型 `gemma-4-31b-it`） | #31 / #32 | **391** ✅ | ZULU-99 ✅ | ✅ **真实模型** |
| `text.pollinations.ai/openai` | #18 / #21 / #22 | 预算耗尽文本 ❌ | 同样文本 ⚠️ | ⚠️ **预算耗尽（非假站）** |

**好消息：池内没有假服务。** 已入池的 xzt 经知识校验为**真实模型**
（这很重要——说明此前入池的判断没被"出词即通过"的漏洞污染）。

## 二、xzt 的真实性证据

```
✅ #31/32 xzt  [deepseek-ai/DeepSeek-V3.2]
   17*23  -> HTTP 200 "391"       ✅ 算对了
   ZULU-99-> HTTP 200 "ZULU-99"   ✅ 按指令输出
✅ #31/32 xzt  [gemma-4-31b-it]
   17*23  -> HTTP 200 "391"       ✅
   ZULU-99-> HTTP 200 "ZULU-99"   ✅
```

**两个不同模型都通过**，且两次回答**不同**（排除固定回复）。

## 三、pollinations 的问题：预算耗尽，且**剩余两个号仍是 schedulable**

### 3.1 实测（知识校验门输出的正是"200 藏错"）

```
⚠️ #21/22 pollinations  [openai-fast]
   17*23  -> HTTP 200 "The API key used for this request has reached its budget. Pl..."  ❌
   ZULU-99-> HTTP 200 "The API key used for this request has reached its budget. Pl..."  ❌
   ⚠️ 两次回答完全相同
```

**注意**：返回的是 **HTTP 200**，正文才是预算耗尽提示
（这正是本仓 `BAD_OUT` 正则要防的那类"200 藏错"）。
**上轮新增的知识校验门也把它拦下了** —— 双重保险都生效。

### 3.2 三个 pollinations 号的真实状态

| 号 | status | schedulable | 24h 请求 | error_message |
|---|---|---|---|---|
| 18 `pollinations-free` | **error** | **f** | 782 | `pollinations free budget exhausted (785 requests today)` |
| 21 `pollinations-text-free` | **active** | **t** | **0** | 无 |
| 22 `pollinations-fast-free` | **active** | **t** | **0** | 无 |

**关键事实**：
- #18 在 **17:45 打满 785 次/天**后被正确停用（`error` + `schedulable=f`）✅ 处置正确
- **#21/#22 指向同一个端点、同一个 keyless 预算**，因此**同样耗尽**，
  但仍标为 `active` + `schedulable` → **若被调度到，必然返回预算耗尽文本**（且是 200）
- #21/#22 的 `last_used_at` 为**从未** → 说明它们排在尾部，实际没被调度过

### 3.3 判断

- **不是假站**：pollinations 是真端点（本会话多次验证出词），只是**当日预算耗尽**
- **是间歇性限额**：`785 requests today` → **次日重置**
- **风险有限**：因 #21/#22 排在 priority 34/35（尾部），大概率轮不到；
  且即使轮到，`BAD_OUT` 会识别这 200 藏错，`error_rate` 也会避让

## 四、给后续会话的两条记录

1. **池内免 key 端点已通过真实性核验**（xzt 两个模型均正确）——
   此结论可用于反驳"池里全是假服务"的猜测。
2. **pollinations 是"每日预算"型**：耗尽后**返回 200 + 预算文本**，
   而非 4xx。判读时**必须看正文**，不能只看状态码。
   #18 停用正确；#21/#22 是否也该 `schedulable=false` 属配置改动，**未擅自动手**。

## 五、复现（只读）

```bash
# xzt 真实性（应返回 391）
curl -s https://ai-api.xzt.plus/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"deepseek-ai/DeepSeek-V3.2","messages":[{"role":"user","content":"What is 17 * 23? Reply with only the number."}],"max_tokens":40}'

# pollinations 当前状态（可能返回预算文本；200 不代表成功）
curl -s https://text.pollinations.ai/openai -H 'Content-Type: application/json' \
  -d '{"model":"openai-fast","messages":[{"role":"user","content":"What is 17 * 23?"}],"max_tokens":40}'
```
