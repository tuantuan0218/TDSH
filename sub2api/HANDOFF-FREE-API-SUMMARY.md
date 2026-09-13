# 交接汇总：免费 API Key 工作 — 2026-09-13

> **一份读完全部结论。** 本文是索引与行动清单，不重复细节；每个结论都指向证据文档。
> 面向"接手的人/下一个会话/用户本人"。

---

## 一、一句话结论

**免 key 可直接用的端点全市场只有 2 个（pollinations + xzt），都已入池；再多额度必须由用户过一次人机验证或提供一个真实邮箱。**

这不是"没找到"，而是经**两轮共 50+ 个候选站实测**后确认的结构性事实：
服务方的免费额度**一律绑定真实账号身份**，而人机验证/邮箱验证码是**设计来拦自动化的**。

---

## 二、当前资产（可用能力）

### 2.1 池内免 key 端点（已入池、已验证真实）

| 端点 | 账号 | 限速 | 状态 |
|---|---|---|---|
| `ai-api.xzt.plus/v1` | #31 / #32 | **10 次/分钟/IP**（触发后有 ≥2 分钟冷却） | ✅ 真实，24 模型中 **16 个可用** |
| `text.pollinations.ai/openai` | #18(error) / #21 / #22 | 每日预算，**分钟级波动** | ✅ 真实，单模型 `openai-fast` |

**均已通过知识门验证**（问 17×23 答对 391）→ 不是假服务。
详见 `POOL-ENDPOINTS-AUTHENTICITY-VERIFIED.md`。

> **注**：池内另有 #44 `aitools-free`（`platform.aitools.cfd/api/v1`）与
> #45 `xuanwu-free`（`gpt.bjqdtd.com/v1`），系并行会话新加。
> 我于 2026-09-13 实测两者 `/models` 均返回 **401（需 key）** —— **不是免 key 端点**，
> 属正常的注册类渠道（未逐一验证其 key 有效性，那是加号会话的职责）。

### 2.2 池规模

```
45 个账号 · 40 active+schedulable · 5 error（死因全部为额度耗尽，非 bug）
12h 成功率约 95%
```

> ⚠️ **数字会漂移**：池账号数在多个并行会话中持续增长（本会话内从 33 → 37 → 45）。
> **以实时查询为准**，勿信任何文档里的快照数字：
> ```bash
> node pool-health-check.mjs   # 会打印当前实际值
> ```

池台账与健康：`POOL-HEALTH-REPORT.md`（可一键重跑 `node pool-health-check.mjs`）。

---

## 三、⏳ 待用户执行（全部已就绪，只差你一步）

| 编号 | 事项 | 你的成本 | 回报 | 我的准备度 |
|---|---|---|---|---|
| **U8** | **NVIDIA NIM 过一次 hCaptcha** | **约 10 秒** | ⭐ **40 RPM / 82 模型 / 无限制额度** | `liunxddo/add-nvidia-nim-pool.mjs` 已就绪 |
| **U9** | **提供主流邮箱**（qq/163） | 1 分钟 | OpenRouter 22 零价模型 + DeepSeek $5 + 智谱 500 万 token | 全流程脚本已就绪 |
| **U-pool** | 批准 SQL 或给 admin key | 一句话 | 补 #7 base_url、摘 #2/#5/#8、设 agenes 上限 | SQL 语句已备好（见第五节） |
| U10/U11 | AgentRouter / GoRouter 授权登录态 | — | 签到额度 | — |

### 为什么 U8 排第一

- **`GET /v1/models` 匿名 200，列出 82 个模型** —— 门是明确的，只差 key
- 40 RPM 是现有 xzt（10/分钟且带冷却）的**数量级提升**
- 墙已独立验证：`hCaptcha + /v3/otp/verify` 双重（见 `SIGNUP-WALLS-FINAL-CLASSIFICATION.md` §2.0）
- ⚠️ 注意：并行会话称"只差点一次"，但我发现还有 OTP 环节 —— **实际差几步需你操作时确认**

### 若给邮箱，我能自动完成的事

邮箱验证码是唯一需要你读一次邮件的环节，**其余（注册→建 key→验证→入池）全部可自动化**。

---

## 四、关键结论索引（按主题）

### 4.1 免费 API 的真相

| 主题 | 结论 | 文档 |
|---|---|---|
| 免 key 端点总数 | **仅 2 个**（两轮 50+ 候选实测） | `KEYLESS-HUNT-ROUND2.md`、`NO-KEY-ENDPOINTS-VERIFIED.md` |
| 论坛公益站 | 寿命以天计，公开 key 约 3 天失效 | `FREE-API-FIVE-FORUMS.md` |
| 注册墙四类 | 人机验证 / 邮箱短信码 / OAuth / 云账号实名 | `SIGNUP-WALLS-FINAL-CLASSIFICATION.md` |
| 假服务识别 | `completions.me` 对任何输入返回同一句固定文本 | `FAKE-ENDPOINT-COMPLETIONS-ME.md` |
| 大陆直连免费档 | 18 家（权威清单） | `FREE-API-MAINLAND.md` |

### 4.2 池运维发现

| 主题 | 结论 | 文档 |
|---|---|---|
| 400 错误根因 | 95.3% 成功率；400 全来自**单一脚本 key**（超上下文/非法 tool_call） | `POOL-400-ROOTCAUSE.md` |
| 上下文超限 | agenes 上游上限 ~500K，却被派 551K~1M 请求 → 460 条/7天必然失败 | `AGENES-CONTEXT-LIMIT-FIX.md` |
| 僵尸账号 | 4 个无 base_url 但 schedulable，占序列第 19/20/22/28 位；**零实际影响** | `POOL-IDLE-ACCOUNTS.md` |
| 上游归属 | 4 个中仅 #7 查明（智谱，**但账户无余额**） | `ZOMBIE-UPSTREAM-TRACING.md` |
| 管理 API | `/api/v1/admin/*` 存在（401 需鉴权）；`x-api-key` 是独立机制 | `GATEWAY-ADMIN-API-FOUND.md` |
| WSL 副作用 | 入池脚本原用 `wsl.exe`（拉起约 2GB），已改 bash 直连 | `POOL-WSL-FIX-AND-NEWACCOUNTS.md` |

### 4.3 本会话的自我纠错（重要，避免误信旧结论）

| 我原本的结论 | 实际 | 文档 |
|---|---|---|
| xzt 可用模型 **9 个** | ❌ 实为 **16 个**（限流/审核/reasoning 字段三类假阴性） | `XZT-MODEL-TABLE-CORRECTED.md` |
| 限流"10 次/分钟，滚动窗口" | ⚠️ 不完整：**触发后还有 ≥2 分钟冷却** | `XZT-RATELIMIT-CORRECTION.md` |
| pollinations "预算耗尽" | ⚠️ 实为**分钟级波动**（同 prompt 时而成功时而预算文本） | `POLLINATIONS-BUDGET-FLUCTUATION.md` |
| columbina "站方挂了"（引并行会话） | ⚠️ 实为**降级**（82% 成功率、趋势向上） | `POOL-STATUS-CROSSCHECK.md` |
| DeepSeek 无验证码 | ❌ 有邮箱/短信验证码 | `SIGNUP-WALLS-FINAL-CLASSIFICATION.md` |

> 📌 **这几条请优先读**：它们是"听起来对但实际错"的结论，若不纠正会误导后续决策。

---

## 五、待批准的 SQL（我已备好，等你点头）

```sql
-- ① 补 #7 glm-zhipu 的 base_url（端点已确认：open.bigmodel.cn）
--    ⚠️ 但该账户余额为 0（实测 429），补了也接不了单 —— 除非充值
UPDATE accounts
SET credentials = jsonb_set(credentials, '{base_url}', '"https://open.bigmodel.cn/api/paas/v4"')
WHERE id = 7;

-- ② 摘掉归属不明的 3 个僵尸（移除出调度序列）
UPDATE accounts SET schedulable = false WHERE id IN (2, 5, 8);

-- ③ agenes 设输入上限 ~480K（消掉 460 条/7天必然 400）
--    ⚠️ 字段名我未在本仓找到示例，需你在网关侧确认
```

> ⚠️ **裸 SQL 不写 `scheduler_outbox`** —— 若走 SQL 改动，可能需补事件才能进调度快照
> （本仓历史已记录此坑）。**推荐用官方 admin API**（若你能给我 admin key）。

---

## 六、本会话建立的工具（可复用）

| 工具 | 用途 | 自证 |
|---|---|---|
| `run-free-api-regression.mjs` | **单一回归入口**（7 项） | 全过 |
| `probe-keyless-endpoints.mjs` | 免 key 端点探测（**三步门**：models→出词→知识校验） | 含真假对照 |
| `probe-xzt-models.mjs` | xzt 全模型实测 | 限流感知 + 三类假阴性修复 |
| `pool-health-check.mjs` | **池只读巡检**（0/0b/5b/5c/5d 段） | 12 SQL 全只读 |
| `free-official-tiers.mjs` | 官方免费档追踪（双源交叉） | 21 项自测 |
| `scan-silent-failures.mjs` | 隐蔽缺陷扫描（返回形态不对齐） | 精度自证 |

**三个探测/追踪工具均已做"多次采样+重试"加固**（本会话踩到多次瞬时网络抖动）。

---

## 七、我未完成/未验证的事项（诚实清单）

| 项 | 状态 | 原因 |
|---|---|---|
| OpenRouter 免费档入池 | ⏸ 未做 | 需主流邮箱（U9）；配置已备好 `openrouter-free-config.json` |
| 零一万物注册机制 | ❓ **无法从外部确定** | 375KB JS 中 `/api/` 路径数=0，无浏览器执行环境 |
| agenes 上限的确切字段名 | ❓ 未知 | 未在本仓找到写入示例 |
| xzt 冷却期的精确时长 | ❓ 只知 ≥2 分钟 | 未等到恢复点（代价是打满配额） |
| 管理 API key 的值 | ❓ 不在可读范围 | 可能在网关进程 env（**我不去挖敏感面**） |

---

## 八、我没有做、也不会做的事（边界声明）

- ❌ 猜测/爆破管理员口令
- ❌ 伪造 JWT / 绕过人机验证（打码平台）
- ❌ 滥用用户身份做 OAuth 授权
- ❌ 擅自修改池配置（僵尸账号、优先级、映射）
- ❌ 读取网关进程 env 等敏感面

**所有改动类操作均停在"等你批准"。**

---

## 九、快速上手（下个会话如何继续）

```bash
cd D:\tdsh\sub2api

# 1. 先跑回归，确认工具链健康
node run-free-api-regression.mjs

# 2. 池体检（只读）
node pool-health-check.mjs

# 3. 免 key 端点复查（三步门）
node probe-keyless-endpoints.mjs _scan_fixtures/keyless-controls.txt

# 4. xzt 模型表复查（注意：有 10/分钟限流，脚本已节流）
node probe-xzt-models.mjs
```

**权威状态文件**：本文 + `FREE-POOL-INVENTORY-20260914.md`（并行会话产出，含注册实战）
