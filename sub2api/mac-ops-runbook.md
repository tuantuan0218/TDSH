# Mac sub2api 故障排查手册(2026-09-10 沉淀)

适用:运维监控面板报 TTFT 高 + 上游错误率 critical + 错误率 critical + SLA 低 + 健康分低。

## 1. 先看懂面板(别被 5 条吓到)

诊断文案阈值(`frontend/src/views/admin/ops/components/OpsDashboardHeader.vue:545-625`):

- TTFT p99 > 500ms → warning;健康分里 p99>1000 开始扣分,>3000 直接 0 分
- 上游错误率 > 5% → critical;> 2% warning
- 请求错误率 > 3% → critical;> 0.5% warning
- SLA < 98% warning,< 90% critical
- 健康分 < 60 critical,< 90 warning;公式 `业务分*0.7+基建分*0.3`
  (`backend/internal/service/ops_health_score.go`),业务分=错误分*0.5+TTFT分*0.5,
  错误>10% 或 TTFT p99>3000ms 任一即把业务分拉到接近 0

## 2. 口径(关键!否则会误判)

`backend/internal/repository/ops_repo_dashboard.go:882-888`:

```sql
error_sla     = status>=400 AND NOT 业务限流
upstream_excl = error_owner='provider' AND NOT 业务限流 AND 上游状态码 NOT IN (429,529)
```

- **upstream 不要求 status>=400**:网关 failover 救回来的请求(最终 2xx,
  `logOpsRecoveredUpstream`)会计入上游、不计入错误。
- 所以 **上游率 > 错误率是正常的**,差值 = 被 failover 救回的比例,救回越多说明
  failover 越在干活。
- 上游率排除 429/529(单列),SLA/错误率排除用户级业务限流(余额/订阅/并发超限等)。
- 归因:phase=upstream/account_auth → owner=provider;
  无可用账号(no available account)归 routing/platform,不进上游率但进错误率。

## 3. 五分钟定位流程(在 Mac 上)

1. 错误日志筛 `error_owner=provider`,看详情 `upstream_status_code`+`message`+
   `proxy_name`+账号:
   - 401/403 → token 废/被风控 → 禁用或重绑该账号
   - 429 → 限流(单号还是整池?)
   - 529/5xx/timeout → 上游过载或代理抖
   - proxy 集中在某一个 → 代理的锅,先直连验证
2. 按 账号/平台/模型 分组:集中在 1-2 个账号 = 坏号,禁用即回绿;全池分散 = 上游整体问题
3. 要看被救回的:上游错误列表开"含已恢复"(后端 `IncludeRecoveredUpstream=true`,
   `ops_handler.go:475`),对比请求错误里的关联上游
   (`GET /api/v1/admin/ops/request-errors/:id/upstream-errors`)
4. TTFT vs Duration:TTFT 高 + Duration 正常 = 首包卡在排队/重试(坏号failover);
   两者都高 = 本机/代理带宽问题
5. 系统指标 + 后台任务心跳:DB/Redis/CPU>90(80预警)/内存>90(85预警)

## 4. TTFT 口径坑

- `first_token_ms` 只记流式请求;非流式多会拉低合并口径(145 号迁移已修权重)。
- OpenAI 系默认语义口径(跳过 preamble,首个语义 SSE 事件即停表),
  可切可见输出口径(`openai_ttft_mode`, `openai_gateway_passthrough.go:1243-1282`)。
- 流内上游容量降载(HTTP 200 后推 error/server_is_overloaded/slow_down)会触发 failover,
  等待计入 TTFT。
- sticky 默认 TTFT EWMA 超 15000ms 才逃逸(`sticky_escape_ttft_ms`),
  10s 级 TTFT 不会触发逃逸,会一直粘慢号 → 这是 TTFT 高的放大器。

## 5. 止血与调参位置

- 禁用坏账号 → 切分组/模型降级 → 大流量先限流保 SLA
- `gateway.openai_scheduler.sticky_escape_enabled/ttft_ms/error_rate`
  (`config.go:1368-1373`)
- `gateway.response_header_timeout` 默认 600s(宁等不砍,10s TTFT 不会被截)
- `gateway.failover_on_400` 默认 false(400 不 failover,改语义风险,慎动)
- `rate_limit.overload_cooldown_minutes` / `oauth_401_cooldown_minutes` 默认 10

## 6. 调度调优(TTFT 高时的参数抓手,2026-09-10 续跑核对源码)

默认值(`config.go:2420-2436,2595-2597`):

- 打分权重:error_rate 0.8 / ttft 0.5 / load 1.0 / queue 0.7 / priority 1.0
- sticky 逃逸:默认开启,ttft 15000ms / error_rate 0.5(`openai_account_scheduler.go:2497-2526`;
  注意 config 默认值经 normalize 会回到 15000/0.5,0 不是关闭)
- `max_account_switches` 10(单请求最多跨 10 个账号重试,TTFT 放大器之一)
- `failover_on_400` 默认 false(400 不换号,别动,改语义)
- 代理断流熔断默认开启(`openai_proxy_stream_circuit.disabled=false`)

TTFT 10s 级别时的调参组合(按顺序,改一个观察一轮):

1. `gateway.openai_scheduler.sticky_escape_ttft_ms`:15000 → 4000~6000,
   让慢号早逃逸。注意这是 EWMA 不是单次,降太低会在上游整体慢时全池逃逸、
   退化成随机选号。
2. `gateway.openai_scheduler.sticky_escape_error_rate`:0.5 → 0.2~0.3,
   坏号早摘。同样 EWMA,别设 0(0 会被 normalize 回 0.5)。
3. `scheduler_score_weights.ttft`:0.5 → 1.0~1.5,让调度更厌恶慢号;
   配合 error_rate 0.8 保持。base 和须 >0,改完看启动校验。
4. `max_account_switches`:10 → 3~5,用"早失败"换 TTFT;
   代价是救回率下降、请求错误率可能上升,小池子慎用。
5. 代理抖动专用:`openai_proxy_stream_circuit`(failure_threshold/window/ttl),
   保持开启;HTTP/2 代理不兼容时有 `allow_proxy_fallback_to_http1` 自动回退。

禁区:`failover_on_400=true` 会改变 400 语义(比如把鉴权错也换号重试),
`response_header_timeout` 别调小(600s 是宁等不砍,调小只会多 504 不会快)。

## 8. 降级预案清单(按故障类型)

- 坏号(401/403/余额空):管理后台禁用该账号 → 观察上游率回落;别删,留着做归因
- 限流(429 整池):降并发/降速,或加号分流;`overload_cooldown_minutes=10` 会自动冷却是
- 过载(529/5xx):等上游 + 切备用模型/分组;`stream_data_interval_timeout` 保持开,
  别让半截流挂死
- 代理抖:切直连验证 → 换代理节点;断流熔断会自动隔离坏代理,TTL 后自愈
- SLA 持续 <90:先限流保可用,再修根因;critical 级别 SLA 是熔断信号不是调参信号

## 10. 告警/保留期/定时探测(2026-09-10 续跑,核对源码)

- 变红线 `OpsMetricThresholds`(`ops_settings_models.go:64-69`):上游率 5 / 请求错误率 3 /
  SLA 98 / TTFT p99 3000。小池子 1 个坏请求就 7%+,上游率可放宽到 8~10,别设太灵。
- 邮件告警(`OpsEmailAlertConfig`:开关/收件人/按小时限流/聚合窗口)+账号健康日报
  (`account_health_error_rate_threshold`):先开日报+周报,告警只收 critical。
- 错误日志保留期:`OpsCleanupService` 按 `data_retention.error_log_retention_days`
  定期删 `ops_error_logs`(0=TRUNCATE)。**查历史故障前先确认保留期,过期的数据没了**。
- 定时账号探测:`ScheduledTestRunnerService` 每分钟 tick + cron 表达式 + 自动恢复坏号
  (`scheduled_test_runner_service.go`)。建议给核心账号建定时探测计划,
  比等用户报错早半拍;`maxWorkers=10`,别建太多计划打爆上游。
- 渠道监控矩阵(2026-09-10 续跑新增):`GET /api/v1/admin/channel-monitor-v2/matrix`
  (平台×模型错误率/TTFT 排行),`mac-diag.sh` §3b 已集成,失败自动跳过(功能未开不影响主流程)。
  这是定位"哪个平台/模型池坏了"的最快路径,比逐条翻错误日志省一半时间。
- 口径一致性:面板近 5 分钟直查、历史走 `ops_metrics_hourly` 预聚合,两边
  upstream_excl 都不要求 status>=400、都排除 count_tokens,口径一致。
  唯一差异:预聚合 usage 侧 `INNER JOIN groups`,无 group 成功行会丢 → 分母偏小、
  错误率偏悲观。小流量窗口以直查(`mac-diag.sh --sql`)为准。

Mac 部署坑位速查:docker 重启后环境变量/挂载丢失最常见;代理节点抖动排第二;
本机时钟漂移会导致 OAuth token 提前判过期;连接池 `max_upstream_clients` 默认 5000,
个人 Mac 场景够用,别调小。

## 11. 本次案例(2026-09-10:TTFT p99 10015ms / 上游 15.38% / 错误 7.69% / SLA 92.31% / 健康 26)

TTFT p99 10015ms + 上游 15.38% + 错误 7.69% + SLA 92.31% + 健康 26。
反推窗口约 13 个请求(2 上游坏其中 1 救回)、基建分约 87(基建基本健康)。
首判:账号池坏号 + failover 串行重试放大 TTFT;小样本,先按 §3 查 1-2 条失败详情定罪。
