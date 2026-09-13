池只读巡检 · 时间窗 12h · 2026-09-13T20:33:42.556Z
========================================================================

## 1. 总览
账号总数 33 · active+schedulable 28 · error 状态 5 · 曾限流 9

## 2. 账号健康（按 12h 调用量降序）
 id | name                 | status | sched | prio | conc | reqs | rate_limited
----+----------------------+--------+-------+------+------+------+-------------
  1 | yunshu-relay         | active | t     |    2 |    5 | 2930 | 2026-09-13 23:34:59
 15 | yunshu-tdsh          | active | t     |    1 |    3 | 2380 | 2026-09-14 01:33:08
 11 | baiqwen              | active | t     |    5 |    3 | 1747 | -
 10 | bai1-glm             | active | t     |    4 |    3 | 1732 | -
 13 | tele-muse            | active | t     |    6 |    3 | 1180 | 2026-09-14 02:35:00
  3 | agenes               | active | t     |    3 |    3 | 1140 | 2026-09-14 03:12:18
 16 | tele-qwen            | active | t     |    9 |    3 |  201 | -
 19 | hub-linuxdo          | active | t     |    7 |    1 |  200 | -
 12 | tokenrouter          | active | t     |    8 |    3 |  168 | 2026-09-14 01:29:31
 18 | pollinations-free    | error  | f     |   29 |    1 |  100 | -
 23 | columbina-free-1     | active | t     |   10 |    1 |   31 | -
 20 | columbina-free       | active | t     |   12 |    1 |    9 | 2026-09-14 04:24:05
 28 | columbina-free-6     | active | t     |   14 |    1 |    7 | -
 24 | columbina-free-3     | active | t     |   16 |    1 |    6 | -
 25 | columbina-free-4     | active | t     |   15 |    1 |    5 | -
 26 | columbina-free-5     | active | t     |   13 |    1 |    5 | -
  9 | aio-freeshare        | active | t     |   11 |    1 |    4 | 2026-09-13 19:57:24
 29 | columbina-free-7     | active | t     |   17 |    1 |    2 | -
 27 | wb2api               | active | t     |   18 |    5 |    1 | -
 30 | columbina-free-8     | active | t     |   22 |    1 |    1 | 2026-09-14 04:24:05
  2 | kimi2-hello4am       | active | t     |   21 |    3 |    0 | -
  4 | geeky-hello4am       | error  | f     |   25 |    3 |    0 | -
  5 | infer                | active | t     |   20 |    3 |    0 | -
  6 | stepfun-jieyue       | error  | t     |   26 |    3 |    0 | -
  7 | glm-zhipu            | active | t     |   19 |    3 |    0 | -
  8 | amd-radeon           | active | t     |   24 |    3 |    0 | -
 14 | xiaoen               | error  | f     |   27 |    3 |    0 | -
 17 | siliconflow-free     | error  | t     |   28 |    1 |    0 | 2026-09-13 05:30:29
 21 | pollinations-text-fr | active | t     |   30 |    1 |    0 | -
 22 | pollinations-fast-fr | active | t     |   31 |    1 |    0 | -
 31 | xzt-ai-proxy-free    | active | t     |   32 |    1 |    0 | -
 32 | xzt-free             | active | t     |   33 |    1 |    0 | -
 33 | columbina-free-9     | active | t     |   23 |    1 |    0 | -

## 3. 上游错误分布（12h）
  #  3 agenes               HTTP 400  × 400 
  #  1 yunshu-relay         HTTP 502  × 281 🔴5xx
  # 15 yunshu-tdsh          HTTP 502  × 165 🔴5xx
  #  1 yunshu-relay         HTTP 400  ×  78 
  # 15 yunshu-tdsh          HTTP 400  ×  39 
  # 13 tele-muse            HTTP 400  ×  37 
  # 12 tokenrouter          HTTP 503  ×  21 🔴5xx
  # 12 tokenrouter          HTTP 429  ×  18 ⛔限流
  # 16 tele-qwen            HTTP 524  ×  18 🔴5xx
  # 11 baiqwen              HTTP 400  ×  13 
  # 16 tele-qwen            HTTP 503  ×   9 🔴5xx
  # 19 hub-linuxdo          HTTP 524  ×   9 🔴5xx
  #  9 aio-freeshare        HTTP 400  ×   8 
  # 27 wb2api               HTTP 503  ×   8 🔴5xx
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
      24h 错误数: 2 · 最近上游码: 403 · 限流时刻: -
  #17 siliconflow-free  status=error schedulable=t
      错误信息: Payment required (402): Sorry, your account balance is insufficient
      24h 错误数: 23 · 最近上游码: 429 · 限流时刻: 2026-09-13 05:30:29.25201+08
  #18 pollinations-free  status=error schedulable=f
      错误信息: pollinations free budget exhausted (785 requests today, returns 200+budget-error-text)
      24h 错误数: 5 · 最近上游码: 502 · 限流时刻: -

## 5. 400 错误根因（共 582 条 · 客户端请求问题，非池故障）
  B. 超上下文窗口                 404 条 (69.4%) · 涉及 1 个 key
  A. 工具调用 name 为空           125 条 (21.5%) · 涉及 1 个 key
  C. 请求体缺字段                  37 条 (6.4%) · 涉及 1 个 key
  D. 其它                      15 条 (2.6%) · 涉及 1 个 key
  A2. 工具调用缺 name              1 条 (0.2%) · 涉及 1 个 key
  ⚠️ 注意：D 类（其它）常含未归类的同因错误 —— 分类后**务必抽查 D 桶**，否则易把主因误判为杂项
  error_owner 归属：provider=582
  🔴 风险：上述 400 的成因多为**客户端**（超上下文/非法 tool_call），却全归为 provider ——
     若据 error_owner 做账号降权，会错误惩罚无辜上游账号。建议改为识别 400 语义后归 client。

## 6. 请求质量（12h）
  成功 11849 · 400 582 · **成功率 95.32%**

========================================================================
【如何读这份报告】
  · rate_limited_at 非空 = 该账号曾撞上游限流（池会自动临时停用，属可自愈）
  · reqs=0 且 status=active = 兜底位正常待命（前排健康时不会接单，非故障）
  · status=error 且 24h 有错误 = 真故障，需人工介入
  · status=error 但 24h 无错误 = 多为额度耗尽后的静止态（非持续报错）
  · 400 错误多为客户端请求问题，不等于池故障；注意 error_owner 可能存在误标

