# Pollinations 端点行为细查 — 2026-09-13

> 动因：本轮实测时 `POST /openai` 一度返回 **HTML**（而非 JSON），疑似端点行为变化或预算耗尽。
> 细查后确认：**`/openai` 路径正常可用**，异常出在**另一条路径**上——两者必须分清。

## 一、结论：同一域名下两条路径，行为不同

| 路径 | 用途 | 实测 |
|---|---|---|
| **`POST /openai`** | OpenAI 兼容 chat（**池在用**） | ✅ **200 · JSON · 真出词 "PONG"**（699ms） |
| `GET /models` | 模型目录 | ✅ 200 · JSON · 列出 `openai-fast`（tier=anonymous） |
| **`GET /<提示词>`** | 传统简易端点（把 prompt 编进 URL） | ⚠️ 200 但正文是：`The API key used for this request has reached its budget...` |

**关键**：`GET /<prompt>` 返回的**不是错误状态码**，而是 **HTTP 200 + 预算耗尽文本**。
这正是本仓已有的 `BAD_OUT` 正则要防的那类「200 里藏错误」。

## 二、为什么之前的 HTML 输出值得警惕

本轮首次探测 `POST /openai` 时拿到的是 HTML 页面（而非 JSON）。
复测（间隔数分钟）恢复正常 JSON。

**判定**：属**瞬时抖动**（可能是 CF 边缘节点间歇返回挑战页），**非端点行为变更**。
但结论是：**单次探测不可信，必须复测**——否则会把抖动误判成"端点挂了"。

## 三、与账号 18 状态的关系

`columbina`… 无关；这里是 **`pollinations-free`（账号 18）**，其错误信息为：

```
pollinations free budget exhausted (785 requests today, returns 200+budget-error-text)
```

对照本轮实测：
- 账号 18 走的是 **`POST /openai`** 路径，该路径**当前正常**（我实测出词）
- `GET /<prompt>` 路径报预算耗尽 —— 说明**预算限制是按 key/路径计**，两条路径额度可能独立

> **待确认（我未验证）**：账号 18 的「785 requests today」是否就是
> `GET /<prompt>` 那条路径的额度用尽，还是共享额度。**需要用户在 0 点后或换 key 复测**。

## 四、对池的实际影响

- **账号 18 不应手动关闭调度**：其 `POST /openai` 路径现在是通的，靠 error_rate 自动避让即可
- 若池发现有「200 但正文是 budget 文本」的响应 → 本仓 `BAD_OUT` 正则**已能识别**
  （`budget|quota|exhausted|...`），无需改代码
- ⚠️ 提醒：**不要用 `GET /<prompt>` 形态调用**（额度受限），统一走 `POST /openai`

## 五、复现

```bash
# ① 池在用路径（应 200 + JSON + 出词）
curl -s https://text.pollinations.ai/openai \
  -H "Content-Type: application/json" \
  -d '{"model":"openai-fast","messages":[{"role":"user","content":"Reply with exactly: PONG"}],"max_tokens":32}'

# ② 传统简易路径（可能返回 200 + 预算耗尽文本）
curl -s "https://text.pollinations.ai/reply%20with%20the%20single%20word%20PONG"

# ③ 目录
curl -s https://text.pollinations.ai/models
```

## 六、方法论沉淀

**判定一个端点是否可用，不能只看状态码，也不能只测一次：**

1. **状态码可能骗人**（200 + 错误文本）；
2. **单次结果可能抖动**（同一请求间隔数分钟结果不同）；
3. **同一域名的不同路径可能行为不同**（`/openai` 通 vs `GET /<prompt>` 受限）。

→ 正确做法：**测同一条真实调用路径 + 复测确认 + 检查正文而非仅看状态码**。
本仓 `free-quota-monitor.mjs` 的 `BAD_OUT` 与 `probe()` 设计已符合该原则。

## 七、BAD_OUT 识别能力实测验证（7/7 通过）

本轮顺手验证了监控的 `BAD_OUT` 正则能否识别这些"200 藏错"文本：

| 样本 | BAD_OUT | 期望 |
|---|---|---|
| Pollinations 预算文本 | true | ✅ |
| 账号18 错误串（785 requests today） | true | ✅ |
| 通用 quota 文本 | true | ✅ |
| 每日额度中文 | true | ✅ |
| 429 提示 | true | ✅ |
| **正常出词 PONG**（阴性对照） | **false** | ✅ 不误杀 |
| **正常中文回答**（阴性对照） | **false** | ✅ 不误杀 |

**结论：门控有效** —— 能抓预算/配额类错误，且不误杀正常输出。

## 八、同一轮内亲历的"瞬时抖动"（活教材）

验证 BAD_OUT 的那次运行中，监控**同时**报出：

```
stations=0 batches=0 mirror=0 v2ex=0 control=FAILED anonOpen=0
🔴 阳性对照失败（pollinations chat 未出词）→ 本轮"无可入池"结论**不可信**
⚠️ 源不可达 publicBenefit/benefits/linuxdoMirror/v2exTag: TypeError: fetch failed
🛡 stations/benefits/mirror/v2ex 本轮采集失败 → 沿用 last-good 快照（不报下架、不覆写）
```

**几分钟后复测：全部 HTTP 200，Pollinations 正常出词 "PONG"。**
即这是一次**瞬时网络抖动**，非真实故障。

**这次抖动恰好证明了监控设计是对的**：
1. ✅ **阳性对照失败 → 明确标注"结论不可信"**（而不是报"没有任何可用端点"）
2. ✅ **源不可达 → 沿用 last-good，不报"全站下架"、不覆写空数据**
3. ✅ 四处采集同时失败被识别为**采集故障**而非**业务事实**

> 📌 若无这两道保护，本轮很可能得出"免 key 端点全部消失"的**假结论**并写入快照。
> 这正是本会话反复强调"**验证产物而非验证函数**"的价值所在。
