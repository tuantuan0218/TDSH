池只读巡检 · 时间窗 12h · 2026-09-13T22:31:57.438Z
========================================================================

## 0. 环境连通性
  网关 /healthz           : ✅ 200
  管理 API /admin/accounts: ✅ 401（存在，需鉴权）
  > 官方管理 API 可用（需凭据）→ 改池应优先走它（自动纳管调度、可审计），而非裸 SQL

## 0b. 免 key 端点真实性核验（知识门：17*23 应为 391）
  ✅ 真实  xzt [deepseek-ai/DeepSeek-V3.2]  HTTP 200
     17*23→"391"   ZULU-99→"ZULU-99"
  ⚠️ 异常  pollinations [openai-fast]  HTTP 200
     17*23→"The API key used for this request has reached its budge"   ZULU-99→"The API key used for this request h"
     ⚠️ 两题回答相同 → 固定回复嫌疑（可能是假服务，或预算耗尽文本）
     ℹ️ 命中 BAD_OUT 类文本：端点预算/额度耗尽（非假站）

## 1. 总览
账号总数 44 · active+schedulable 39 · error 状态 5 · 曾限流 10

## 2. 账号健康（按 12h 调用量降序）
 id | name                 | status | sched | prio | conc | reqs | rate_limited
----+----------------------+--------+-------+------+------+------+-------------
  1 | yunshu-relay         | active | t     |    1 |    5 | 2943 | 2026-09-13 23:34:59
 15 | yunshu-tdsh          | active | t     |    2 |    3 | 2287 | 2026-09-14 01:33:08
 10 | bai1-glm             | active | t     |    4 |    3 | 1670 | -
 11 | baiqwen              | active | t     |    5 |    3 | 1532 | -
  3 | agenes               | active | t     |    3 |    3 | 1135 | 2026-09-14 03:12:18
 13 | tele-muse            | active | t     |    6 |    3 | 1132 | 2026-09-14 02:35:00
 19 | hub-linuxdo          | active | t     |    7 |    1 |  257 | -
 12 | tokenrouter          | active | t     |    9 |    3 |  134 | 2026-09-14 01:29:31
 16 | tele-qwen            | active | t     |    8 |    3 |  125 | -
 23 | columbina-free-1     | active | t     |   10 |    1 |   36 | -
 20 | columbina-free       | active | t     |   11 |    1 |   12 | 2026-09-14 04:24:05
 28 | columbina-free-6     | active | t     |   13 |    1 |   11 | -
 24 | columbina-free-3     | active | t     |   16 |    1 |    8 | 2026-09-14 04:59:15
 25 | columbina-free-4     | active | t     |   14 |    1 |    8 | -
 26 | columbina-free-5     | active | t     |   12 |    1 |    8 | -
 29 | columbina-free-7     | active | t     |   15 |    1 |    7 | -
 34 | columbina-free-10    | active | t     |   19 |    1 |    5 | -
  7 | glm-zhipu            | active | t     |   18 |    3 |    4 | -
  9 | aio-freeshare        | active | t     |   17 |    1 |    4 | 2026-09-13 19:57:24
 30 | columbina-free-8     | active | t     |   21 |    1 |    3 | 2026-09-14 04:24:05
 27 | wb2api               | active | t     |   20 |    5 |    1 | -
 33 | columbina-free-9     | active | t     |   23 |    1 |    1 | -
 35 | columbina-free-11    | active | t     |   27 |    1 |    1 | -
 36 | columbina-free-12    | active | t     |   26 |    1 |    1 | -
 37 | columbina-free-13    | active | t     |   25 |    1 |    1 | -
  2 | kimi2-hello4am       | active | t     |   24 |    3 |    0 | -
  4 | geeky-hello4am       | error  | f     |   29 |    3 |    0 | -
  5 | infer                | active | t     |   22 |    3 |    0 | -
  6 | stepfun-jieyue       | error  | t     |   30 |    3 |    0 | -
  8 | amd-radeon           | active | t     |   28 |    3 |    0 | -
 14 | xiaoen               | error  | f     |   31 |    3 |    0 | -
 17 | siliconflow-free     | error  | t     |   32 |    1 |    0 | 2026-09-13 05:30:29
 18 | pollinations-free    | error  | f     |   33 |    1 |    0 | -
 21 | pollinations-text-fr | active | t     |   34 |    1 |    0 | -
 22 | pollinations-fast-fr | active | t     |   35 |    1 |    0 | -
 31 | xzt-ai-proxy-free    | active | t     |   36 |    1 |    0 | -
 32 | xzt-free             | active | t     |   37 |    1 |    0 | -
 38 | columbina-free-14    | active | t     |   38 |    1 |    0 | -
 39 | columbina-free-15    | active | t     |   39 |    1 |    0 | -
 40 | columbina-free-16    | active | t     |   40 |    1 |    0 | -
 41 | columbina-free-17    | active | t     |   41 |    1 |    0 | -
 42 | columbina-free-18    | active | t     |   42 |    1 |    0 | -
 43 | columbina-free-19    | active | t     |   43 |    1 |    0 | -
 44 | aitools-free         | active | t     |   44 |    1 |    0 | -

## 3. 上游错误分布（12h）
  #  3 agenes               HTTP 400  × 340 
  #  1 yunshu-relay         HTTP 502  × 251 🔴5xx
  # 15 yunshu-tdsh          HTTP 502  × 158 🔴5xx
  # 13 tele-muse            HTTP 400  ×  30 
  #  1 yunshu-relay         HTTP 400  ×  26 
  # 15 yunshu-tdsh          HTTP 400  ×  25 
  # 12 tokenrouter          HTTP 503  ×  19 🔴5xx
  # 12 tokenrouter          HTTP 429  ×  16 ⛔限流
  # 16 tele-qwen            HTTP 524  ×  16 🔴5xx
  # 11 baiqwen              HTTP 400  ×  12 
  # 27 wb2api               HTTP 503  ×  10 🔴5xx
  # 19 hub-linuxdo          HTTP 524  ×   9 🔴5xx
  #  9 aio-freeshare        HTTP 400  ×   8 
  #  3 agenes               HTTP 503  ×   6 🔴5xx
  #  9 aio-freeshare        HTTP 503  ×   5 🔴5xx

## 4. 死因核查（error 或不可调度）
  #4 geeky-hello4am  status=error schedulable=f
      错误信息: Access forbidden (403): Insufficient account balance | consecutive_403=3/3
      24h 错误数: 0 · 最近上游码: - · 限流时刻: -
  #6 stepfun-jieyue  status=error schedulable=t
      错误信息: Payment required (402): You exceeded your current quota, please check your plan and billin
      24h 错误数: 0 · 最近上游码: - · 限流时刻: -
  #14 xiaoen  status=error schedulable=f
      错误信息: Access forbidden (403): token quota is not enough, token remain quota: ＄0.043250, need quo
      24h 错误数: 1 · 最近上游码: 403 · 限流时刻: -
  #17 siliconflow-free  status=error schedulable=t
      错误信息: Payment required (402): Sorry, your account balance is insufficient
      24h 错误数: 0 · 最近上游码: - · 限流时刻: 2026-09-13 05:30:29.25201+08
  #18 pollinations-free  status=error schedulable=f
      错误信息: pollinations free budget exhausted (785 requests today, returns 200+budget-error-text)
      24h 错误数: 5 · 最近上游码: 502 · 限流时刻: -

## 5. 400 错误根因（共 448 条 · 客户端请求问题，非池故障）
  B. 超上下文窗口                 344 条 (76.8%) · 涉及 1 个 key
  A. 工具调用 name 为空            59 条 (13.2%) · 涉及 1 个 key
  C. 请求体缺字段                  30 条 (6.7%) · 涉及 1 个 key
  D. 其它                      15 条 (3.3%) · 涉及 1 个 key
  ⚠️ 注意：D 类（其它）常含未归类的同因错误 —— 分类后**务必抽查 D 桶**，否则易把主因误判为杂项
  error_owner 归属：provider=448
  🔴 风险：上述 400 的成因多为**客户端**（超上下文/非法 tool_call），却全归为 provider ——
     若据 error_owner 做账号降权，会错误惩罚无辜上游账号。建议改为识别 400 语义后归 client。

## 5b. ⚠️ 僵尸账号：active + schedulable 但 **无 base_url**（3 个）
  id | name                 | prio | conc | 历史调用 | model_mapping
   5 | infer                |   22 |    3 |        0 | (none)
   2 | kimi2-hello4am       |   24 |    3 |        0 | (none)
   8 | amd-radeon           |   28 |    3 |        0 | {"DeepSeek-V4-Flash": "DeepSee
  🔴 这些账号**永远无法服务**（无上游地址），却 schedulable=true ——
     若其 priority 数值小于可用账号，可能在调度中抢先被选中 → 必然失败并消耗重试。
     有 model_mapping 说明"配置到一半"，可能是并行会话的半成品。
     ▶ 建议（需人工确认）：置 schedulable=false，或补全 base_url。**本脚本不自动改**。
  📊 排序影响：首个僵尸 priority=22，其名次之后仍有 **15 个可用账号**
  🛡 其中被系统自动屏蔽（temp_unschedulable/overload）的：0 个 → **系统未自动屏蔽，需人工处置**

## 5c. 调度序列实况（key=sched:5:openai:forced:v1773，39 个成员）
  > score 即位次（0..N-1）；名字取自 DB
  位次 22 | #  5 infer                ⚠️ **僵尸（无 base_url）**
  位次 24 | #  2 kimi2-hello4am       ⚠️ **僵尸（无 base_url）**
  位次 28 | #  8 amd-radeon           ⚠️ **僵尸（无 base_url）**
  📊 首个僵尸出现在第 **22** 位；其之后仍有 15 个可用账号被挡（33,37,36,35,21,22,31,32…）
  🔴 结论：僵尸**确实被纳入调度序列**且名次靠前 —— 选中后必然失败（无上游地址），
     代价是无效尝试与重试消耗（会 failover 到下一名次，故不降低最终成功率）。
     ▶ 处置需人工决定：补全 base_url（变可用产能）或置 schedulable=false（移除）。

## 5d. 上下文能力画像（7 天 · 按成功请求的 token 天花板排序）
  能吃 >500K 的号：**8 个** —— #10(max 816097) · #11(max 815748) · #13(max 795376) · #19(max 773357) · #1(max 734100) · #15(max 688439)
  ⚠️ 从未成功接过 >500K、但有显著流量的号：#3 agenes(max 490137) · #16 tele-qwen(max 393713) · #18 pollinations-free(max 0)
  🔴 这些号若被派到超长请求 → 必然 400。建议按上下文上限路由（不改账号本身）。
  > 判据说明：用**成功请求**的 max(input_tokens) 作能力天花板（usage_logs 只记成功请求）
  > 2026-09-13 机制查明：请求按**名次从前到后**选择账号 → 排在前面但天花板低的号
    （如 #3 agenes 第3位/490K）会先接到超长请求并必然失败；
    排得靠后的低天花板号（如 #16 tele-qwen 第8位/393K）因长请求早被前排消费 → 反而零错误。
    ⇒ 关键变量是**名次位置 × 上下文能力**的组合，不是单一账号属性。

## 6. 请求质量（12h）
  成功 11325 · 400 448 · **成功率 96.19%**

========================================================================
【如何读这份报告】
  · rate_limited_at 非空 = 该账号曾撞上游限流（池会自动临时停用，属可自愈）
  · reqs=0 且 status=active = 兜底位正常待命（前排健康时不会接单，非故障）
  · status=error 且 24h 有错误 = 真故障，需人工介入
  · status=error 但 24h 无错误 = 多为额度耗尽后的静止态（非持续报错）
  · 400 错误多为客户端请求问题，不等于池故障；注意 error_owner 可能存在误标

