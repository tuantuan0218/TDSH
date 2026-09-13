# agenes 上下文超限问题：根因与精确修法 — 2026-09-13

> 承接上轮优先级重排（agenes 的 436 条错误升为 #1）。本文只读取证，给出**可直接批准**的修法。
> **全程只读，未改任何配置。**

## 一、结论（一句话）

**agenes(3) 上游硬上限约 500K tokens，而调用方持续发 551K~1M 的请求 → 必然 400。**
修法不在"修 agenes"，而在**让 >500K 的请求不要路由给它**。

## 二、证据链

### 2.1 错误规模（近 7 天）

| 项 | 数值 |
|---|---|
| agenes(3) 总错误 | **750** |
| 其中 `ContextWindowExceededError` | **460** |
| 按模型归类（近 7 天） | `Tuan → agnes-3.0-flash` 共 **252** 条，**仅此一种映射** |
| 来源 | **单一 api_key（id=1）**，1 个账号 |

### 2.2 错误原文（抽样，确认是硬上限）

```
ContextWindowExceededError: ... "The input (551174 tokens) is longer than the model's ..."
                                "The input (551909 tokens) ..."
                                "The input (552413 tokens) ..."
                                "The input (576329 tokens) ..."
```

**全部 252 条的输入都 >500K**（正则核验：`over_500k_hint = 252 / 252`，即 100%）。

### 2.3 agenes 的真实天花板（来自成功请求）

```
agenes(3) 近 7 天成功请求：
  总数            3152
  max(input_tokens) = 490,137      ← 成功过的最大值
  >500K 的成功次数 = 0             ← 从未成功接过超 500K
  p95 = 92,773 · p50 = 992
```

**成功天花板 490K < 失败起点 551K** —— 中间没有重叠区，
说明这不是"偶发超限"，而是**确定性的能力边界**。

### 2.4 对照：别的账号确实能吃长上下文

| 账号 | 承接 >500K 次数 | max(input_tokens) |
|---|---|---|
| **11 baiqwen** | **443** | 815,748 |
| **13 tele-muse** | **220** | 795,376 |
| **10 bai1-glm** | **170** | **816,097** |
| 1 yunshu-relay | 21 | 734,100 |
| 15 yunshu-tdsh | 12 | 688,439 |
| 19 hub-linuxdo | 8 | 773,357 |
| 9 aio-freeshare | 7 | 662,716 |
| 12 tokenrouter | 1 | 572,626 |
| **3 agenes** | **0** | 490,137 |

**即：系统里已有 8 个账号在稳定承接 500K~816K 的请求。**
agenes 是唯一"接了却接不住"的那个。

## 三、修法（两选一，均属配置改动，需你批准）

### 3.1 ⚠️ 先厘清：**只有 agenes 一个号在真正受害**

我一度以为"低天花板的号都会被超长请求打到"，但实测**否定了这个推断**：

| 账号 | 成功天花板 | 上下文超限错误数 |
|---|---|---|
| **3 agenes** | 490,137 | **794,304** ⛔ |
| 16 tele-qwen | **393,713**（更低！） | **0** ✅ |
| 18 pollinations-free | 0（当日额度耗尽） | 0 |

**全池按 `ContextWindow` 归类，只有 agenes 一个号有错误记录。**

`tele-qwen` 天花板比 agenes 还低，却**零超限错误** —— 说明**它从未被派到超长请求**。
→ 即：**路由本身已能避开某些低能力号，agenes 是漏网的那个**。

这对修法很重要：**不是"给所有低天花板号设限"，而是"找出 agenes 为何被派了超长请求"。**

### 3.2 方案 A：给 agenes 设最大输入上限（推荐）

**做法**：在 agenes(3) 的配置中设定输入上限 ≈ **480,000** tokens
（其成功天花板 490K、失败起点 551K，取 480K 留余量）。

**效果**：>上限的请求**根本不派给 agenes**，落到本就在吃 500K~816K 的 8 个号。
**预期收益**：一次性消掉 **约 252~460 条/7 天** 的必然 400。
**风险**：极低 —— 不改任何"能用的号"的行为。

### 3.3 方案 B：查清"为何 agenes 被选中"（更根本）

既然 `tele-qwen`（天花板更低）没被打到，说明**存在某种保护机制 agenes 没享受到**。
可能原因（未验证）：
- agenes 的 priority=3 很靠前，被优先选中，而超长请求没做长度预检
- `Tuan` 这个别名在 agenes 映射到 `agnes-3.0-flash`（仅此一个模型），
  而其它号可能有多模型可选、更易匹配

→ **建议先做 A 止血，再查 B**（B 需读网关路由源码，本机无源码，受限）。

> **我的建议**：先做 A（一行配置，风险最低、收益明确）；
> 若日后要长期治理，再考虑 B。

## 四、⚠️ 我做过的核对与保留的不确定性

### 已核验
- ✅ 错误原文确认是 `ContextWindowExceededError`（非网络/非限流）
- ✅ 100% 超 500K（正则全量核验，非抽样推断）
- ✅ agenes 成功天花板 490K、>500K 成功 0 次
- ✅ 有 8 个账号在承接 500K~816K（说明"重定向"有地方可去）

### 未能核验（诚实标注）
- ❓ **agenes 上游的精确上限值**：错误文本被日志截断（`the model's ...`），
  我没拿到完整的 "maximum context length of N tokens" 字样。
  但从"成功 max 490K / 失败 min 551K"可**推定约 500K**，故建议设 480K 留足余量。
- ❓ **配置里"最大输入上限"的确切字段名**：我未在本仓找到该字段的写入示例，
  需在网关侧的账号配置中确认（可能是 `extra` 下的某个键）。
  **这也是我没有直接执行的原因之一。**

## 五、这与我此前结论的关系（自我记账）

- 上轮我把 agenes 列为优先级 #1，**本文坐实了它**：750 条错误中 460 条是上下文超限。
- 并行会话（`FREE-POOL-INVENTORY-20260914.md` 发现 6/7）得出**相同根因**，
  但它的口径是"≥500K 由 8 个号承接、agnes 一个号吃掉 460 条失败"；
  我用**成功天花板（490K，>500K 成功 0 次）**给出了更直接的边界证据 —— **两方互证**。
- 并行会话提到它自己的 `columbina-free(20)` 也有 4 条超限（grok 上限 500K），
  即**同类问题不止 agenes 一个号**，修法应可复用。

## 六、复现（只读）

```bash
ssh -o BatchMode=yes -i ~/.ssh/id_ed25519 zhaozicheng@192.168.1.3 'bash -s' <<'EOF'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api -At -F'|' <<'PSQL'
-- agenes 成功天花板
SELECT count(*), max(input_tokens), count(*) FILTER (WHERE input_tokens>500000)
FROM usage_logs WHERE account_id=3 AND created_at > now() - interval '7 days';
PSQL
PSQL2_MARK
psql -h 127.0.0.1 -U postgres -d sub2api -At -F'|' <<'PSQL'
-- 谁在吃长上下文
SELECT a.id,a.name,count(*),max(u.input_tokens)
FROM usage_logs u JOIN accounts a ON a.id=u.account_id
WHERE u.created_at>now()-interval '7 days' AND u.input_tokens>500000
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10;
PSQL
EOF
# 注：两段 psql 之间的分隔符按实际脚本写法调整
```
