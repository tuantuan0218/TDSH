# 决策卡（一页 · 实测 2026-09-14 18:4x +0800）

> 只列**需要你动作**的事，按性价比排序；详细出处在 `FREE-LANE-HANDOVER.md` / `FREE-POOL-INVENTORY-20260914.md`。

| # | 你做什么 | 我会做什么 | 收益（实测） |
|---|---|---|---|
| **A** | 给**一个能读信的 QQ/Gmail 邮箱** | 按厂商收益顺序自动开户→验真→入池→补 outbox→追到 `usage_logs` picks | **解锁 13 家「邮件码+签到」站**（本轮新增 `callxyq.xyz`）。厂商多样性：`crowllm[+8厂商] > openrealm[+5] > mzlone[+3]`；**`autorouter.io` 已降为"未核实"（对我 403）** |
| **B** | 点 **`kktoken.cc/?aff=MzG9`** 或 **`api.justwoker.icu/?aff=VTrz`**（GitHub OAuth，实测两站 `/api/status` 200 + 注册页 200） | 你给 key，我入池并验到 picks | **\$75+\$20/日** 或 **\$70+\$22/日**，**都是非 xai 厂商** |
| **C** | 点头：**`UPDATE accounts SET rate_multiplier=0 WHERE name LIKE 'columbina-free%';`**（+补 outbox） | 执行并复核 | 修正账目口径（我这批号被按 `grok-4.5` 价目记价 \$15.45/24h；**经查不是真金损失**：user1 余额 99.98 万名义值、api_key 无配额消耗）→ **不紧急** |
| **D** | 点头：摘掉**持续**报错且属他人配置的号 | `UPDATE accounts SET schedulable=false WHERE id IN (45,46);` + outbox | `45 xuanwu` 403×3、`46 freemodel` 401×3；但 24h picks=0 → **潜伏，不紧急** |
| **E** | 决定要不要做**受控 failover 演练**（短时摘主力） | 只测「排到免费道 + xai 恰好无票」这条唯一未覆盖路径 | 覆盖后我才能说"免费道端到端安全"，否则只能说"无危害证据" |
| **F** | （可选）给 **admin API key**（`x-api-key`，别会话已证实该机制存在、值不在可读范围） | 用官方接口做 A/C 及"改 agenes 上下文准入" | 免裸 SQL、可审计；**今天 436 条用户可见 400 全来自 agenes 超长上下文**，改道本身零成本 |

## 单号站判据偏置（olomc-free 48 复核沉淀，防下会话重踩）

`free-lane-audit.mjs` 的"建议停池"判据有一条**结构性偏置**：

- **成片故障保护只对「同站 ≥3 个号」生效**（`free-lane-audit.mjs:85-88`：失败率 ≥50% 且 ≥3 号 → 站方级相关故障，**不出**停池 SQL）；
- **单号站**（olomc-free 48 号这类）天然走"账号级处置"分支：**任何一次 3 次重试全 BAD 都会被建议摘号**，没有抖动保护
- 后果：单号站在一次站方瞬时抖动/按出口限流（发现 13 的前科：pollinations 按出口 IP 计额度，Mac 出口烧光 Windows 出口还活）期间就会被 audit 建议摘号——**单号站的"建议摘号"要打折读**，不能照单全收

**olomc-free(48) 复核结论（2026-09-14 19:5x 二次复核 + 20:2x 三级验真）**：
- picks 时间线：19:19:48 → 19:27:12（audit BAD 后仍有新增 picks，**证伪 19:3x 的"建议停池"**）
- 20:2x 三级验真（key 经 Mac PG 取 `credentials->>'api_key'` 不打印）：
  - `/models` 200 → 仅 1 个模型 `cb/deepseek-v4.1-flash` ✅
  - `chat` 200 `finish_reason=length` `reasoning_content="The user just said 'hi'. I"` `credit=0` `prompt_tokens=37` ✅
  - 结论：**48 号健康、零成本、可服务**，"建议停池"撤回
- ⚠️ 探针字段坑：`accounts.credentials` 的 key 字段名是 `api_key` 不是 `key`（写探针先查字段名，`_tmp_c48keys.sh` 只打印字段名列表不打印值）

**通用判据**（发现 15/26 精神 + 本轮新经验）：
1. 判"号坏"需 2 次即时重试 + 多号采样 + **查 BAD 时刻后是否有新增 picks**（audit 只给前者）
2. **单号站的"建议摘号"要打折**——没有成片故障保护，任何一次 3/3 全 BAD 都会触发，需 picks 证据兜底
3. 审计脚本判"chat 健康"时若只看 `c.status===200 && 有 choices`，会把**推理模型的 8 token 全吃在 reasoning_content、content 为空**误判 BAD（见发现 15 的 aio-freeshare 前科）；本轮我探针 `max_tokens=8` 就吃到这个坑，判 48 健康必须看 `reasoning_content` 非空，不是 `content` 非空
4. key 字段名别硬编码：`_tmp_*` 探针第一次写 `credentials->>'key'` 直接 401，改 `api_key` 才通

## 现在正在发生的事（实测 19:5x 逐条复核后）
- **A 案三家确认可用**：`crowllm.com` / `api.openrealm.dev` / `mzlone.top` 门都是 `reg=true 邮件验=true 签到=true`、注册页 **200** → **你给邮箱就能开**
- ⚠️ **`autorouter.io` 已变 403**（CF 拦我这侧，上轮我还把它排在前三）→ **A 案顺序以 `crowllm[+8] > openrealm[+5] > mzlone[+3]` 为准**
- ⚠️ `api.hcnsec.cn` 面板 200 但**注册页对我 403** → 不算可开，除非 API 口能通（未测）
- ⛔ `beizhi.sylu.cc` 超时不可达（上轮 523 → 现在连 TCP 都不通）→ 已从首选剔除
- ✅ **B 案两家活着**：`api.justwoker.icu`、`kktoken.cc`（`/api/status` 200 + 注册页 200）；
  `agentrouter.org` 注册页 200 仍在（但它非 new-api 面板，我探不到门）；`tabitoken`/`gorouter` 对我 **403**，你侧可能正常
- 车道账本最后一条：`09:25Z 健康 0/19 · 余额 $2545.6 · 用户可见失败 0 · 静默失效 0`（→ 第 6 次故障仍在进行）
- **xai 可用性实测比"抖动几次"难看得多**：trend 账本 10 次采样里 **7 次降级（4 次 0/19 全灭）→ 可用率 ≈30%**；
  故障期**用户可见失败仍 0**（换号救回，代价 ≈+4.6s/次）。
  → 含两层含义：① 你的主链路**没被它伤到**；② 但**"有 19 个免费号"≠"有可用兜底"**——
  它 70% 的采样是降级状态，把它当 failover 目标≈注定再失败一次（只是不报错给你看）。
  **这是决策卡 A/B 两项的真实背景**：缺的不是号，是**别的上游厂商**。
- 期间**用户可见失败仍 0**（错误全被重试救回，代价 ≈ **+4.6s/次**，`routing_latency_ms` p50）
- `9 aio-freeshare` 也变 403「用户额度不足 \$0」；`agentrouter/autorouter/new.xinjianya/tabitoken` 本轮报 ⚫ 不再回 status（**定点复测后：agentrouter 注册页 200 仍活着，tabitoken/gorouter 是 CF 403 拦我这侧**）
- 签到：**19/19 今日已签**（明日的我会自动跑）

## 我不做的事（省得你担心）
不绕过验证码/人机验证 · 不向第三方邮箱发码 · 不擅自改池配置或调度参数 · 不擅自摘他人号 · 不重复已证否路径 · 不写 C 盘
