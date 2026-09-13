# ⚠️ 实测揭穿：completions.me 是「假模型」服务 — 2026-09-13

> 本轮经用户授权，实际注册了 `completions.me` 并做出词验证。
> **结论：它是一个返回固定文本的模拟服务，不是真实模型 API。**
> 记录此事以防后续会话（或其它工具）把它当成可用渠道。

## 一、它对外宣称什么

官网（`www.completions.me`）原文：

> "Create Account — **Sign up for free — no email verification, no credit card.**
> Just a username and password."
> "Get unlimited free access to **Claude Opus 4.6, GPT-5.2, Gemini 3.1 Pro**, and 15+..."

`/api/v1/models` 免 key 可列 6 个模型（**claude-opus-4.6、claude-sonnet-4.6、claude-opus-4.5** 等）。

**特征**：免邮箱验证、免验证码、宣称无限免费、宣称顶级模型 ——
**"好到不真实"**，而它确实不真实。

## 二、注册与取 key：技术上完全走得通

| 步骤 | 结果 |
|---|---|
| `POST /api/auth/register` | ✅ HTTP 200，创建用户（**无邮箱验证、无验证码**） |
| `POST /api/auth/login` | ✅ 200，拿到 cookie |
| `POST /api/keys` | ✅ 200，返回 `sk-cp_...`（54 字符） |

**即：整个注册/取 key 流程自动化无阻。**
（本轮用 `tdsh*` 前缀的随机账号名注册了 2 个号，各拿到 1 个 key。）

## 三、★ 关键：如果只测"有没有出词"，会**误判为可用**

用刚拿到的 key 调 chat：

```
[claude-opus-4.6] HTTP 200 出词="Never gonna give you up, never gonna let you down,"
[auto]            HTTP 200 出词="Never gonna give you up, never gonna let you down,"
```

**HTTP 200 + 有正文** —— 这正是本仓 `isPoolable()` 的判定条件。
**若止步于此，就会把它当作"可用的 Claude Opus 4.6 端点"并写入清单 / 入池。**

## 四、揭穿手段：**答案可预测性交叉验证**

我改问**答案有唯一正解**的问题，并做多组交叉：

| 测试 | completions.me 回复 | 判定 |
|---|---|---|
| `What is 17 * 23?`（正解 391） | Rickroll 歌词 | ❌ |
| `Reply with exactly: ALPHA-BRAVO-7` | Rickroll 歌词 | ❌ |
| `Say only: HELLO` | Rickroll 歌词 | ❌ |
| `What is the capital of France?` | Rickroll 歌词 | ❌ |
| **空 prompt** | Rickroll 歌词 | ❌ |
| **乱码 prompt** | Rickroll 歌词 | ❌ |
| **两个不同 key、同一问题** | **两次完全相同** | ❌ |

**所有输入 → 同一个固定字符串**（Rickroll 歌词）。
它连"输入是什么"都不看。

### 对照组：真免 key 端点（xzt）

同样问 `What is 17 * 23?`：

```
xzt -> HTTP 200 "391"     ✅ 算对了
```

**同一个问题、同一天、同一台机器**：真端点给出正确答案，假端点给出歌词。
**这就是"阳性对照"的价值** —— 没有它，我无法证明"是它假"而不是"我的测试有问题"。

## 五、给后续会话的警示（写进清单）

### ⚠️ 判定"端点可用"的充分条件不止两条

本仓现有门控是**两级门**（`/models` 可列 + chat 出词）。
本次事件说明**还需要第三级**：

| 级别 | 判据 | 能防什么 |
|---|---|---|
| 1 | `/models` 免 key 可列 | 防"根本连不上" |
| 2 | chat 免 key 出词 | 防"仅清单开放" |
| **3（新增）** | **答案可预测性** | **防"固定回复的假服务"** |

**第三级做法**（建议纳入探测脚本）：
提问一个**有唯一正确答案**的问题（如 `17*23`、`9+14`），
**校验答案是否正确**，而非只校验"有没有文本"。

### 具体建议

1. **绝不把 completions.me 加入任何可用清单**
2. 未来任何"出词就通过"的探测，**都应补一个知识校验**
3. 该站特征（免验证 + 免验证码 + 宣称无限顶级模型）应作为**风险信号**：
   真正的厂商免费档通常**需要注册且有限额**；"无限免费顶级模型"基本不成立

## 六、我这轮的自我记账

- ✅ **做对了**：没有停在"200 + 出词"就报喜，而是加了一组可验证问题的交叉检验
- ⚠️ **差点犯的错**：第一轮测出 `claude-opus-4.6` 返回 200 + 文本时，
  我确实一度准备把它当作"重大发现"（甚至想过入池）
- 📌 **教训**：**"出词"不等于"真在推理"**。
  本仓此前把 `chatUsable`（有正文）当入池判据，**在这类假站面前会失效**
  —— 尽管现有实际渠道（xzt/pollinations）经同样检验是真的。

## 七、复现

```bash
# 1) 注册（无验证码/无邮箱）
curl -s -X POST https://www.completions.me/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"probe_x","password":"probe123"}'

# 2) 取 key（需 cookie，略）

# 3) ★ 揭穿：问有唯一正解的问题
curl -s https://www.completions.me/api/v1/chat/completions \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer <key>' \
  -d '{"model":"claude-opus-4.6","messages":[{"role":"user","content":"What is 17*23? Reply with only the number."}],"max_tokens":40}'
# 实际返回：Rickroll 歌词（而非 391）

# 4) 对照（真端点）
curl -s https://ai-api.xzt.plus/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"deepseek-ai/DeepSeek-V3.2","messages":[{"role":"user","content":"What is 17*23? Reply with only the number."}],"max_tokens":40}'
# 实际返回：391
```
