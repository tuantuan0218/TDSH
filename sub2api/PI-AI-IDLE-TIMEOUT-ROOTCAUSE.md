# pi-ai stream idle timeout after 300000ms 根因诊断（2026-09-12；2026-09-13 用户拍板 10s 直接重试后修订）

## 结论（一句话）

错误由 **DSH 内置 `llm-pi-ai` 适配器的流空闲看门狗** 抛出：流式请求发出后，**连续 300000ms（5 分钟）没有任何流数据块到达**，适配器主动中止并抛 `LlmError(..., 'TIMEOUT')`。触发它的上游是 **sub2api/tuan 网关池里的「慢号」（yunshu 系）静默挂起**——上游既不吐字节也不返回错误码，网关 failover 又不认这种静默，最终只能由客户端 5 分钟兜底超时。

## 证据链

### 1. 错误文本出处（源码级）
- 抛错点：`D:\tdsh\resources\app\repo\packages\llm\llm-pi-ai\src\adapter.ts` L410
  ```ts
  throw new LlmError(`pi-ai stream idle timeout after ${streamIdleTimeoutMs}ms`, 'TIMEOUT', { cause: error })
  ```
- 超时机制：`packages/util/timeout/src/index.ts` 的 `idleWatchdog` —— **计时器只在 `iterator.next()` 挂起期间武装**，即「向 provider 要下一个流块后，5 分钟没等到任何块」才触发。消费者思考时间不计入。
- 超时值：`llm-pi-ai/src/config.ts` L43 `DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000`。**2026-09-13 用户拍板后**：`yunshu / tuan / agnes / deepseek-official` 四条路由已显式配 `streamIdleTimeoutMs: 10000`（见 `settings.yaml`，DSH 热发布免重启），其余未显式配置的路由仍走默认 300000ms。

### 2. 这是哪个 provider？
`llm-pi-ai` 不是单一服务，是 DSH 的**通用 OpenAI 兼容 provider 适配器**，本机 `settings.yaml` 里 `llm-pi-ai.providers` 下的全部路由（yunshu/amd/bai1/xiaoen/baiqwen/tokenrouter/tele/tuan/dsferr/teleqwen）都走它。错误文本**不含 provider/model 名**（DSH 设计缺陷），但本机默认模型是 `tuan/Tuan`（`agent-default-model`），且历史会话里该错误反复出现时，`TUAN-POOL-HANDOVER.md` 明确归因到 yunshu 系慢号。

### 3. 上游为什么 5 分钟没数据（决定性证据）
- `D:\tdsh\sub2api\TUAN-POOL-HANDOVER.md` L90：`00:42 网关首次 FAIL（120s 超时）→ … 01:30 决定性证据：yunshu 云主机 api2.yunshuzhilian.asia 直连 60s 超时（上游本身高峰）→ 01:35 自然恢复`
- L154：`真路由缺陷候选只剩一个：慢号（yunshu 系 40% 流量）慢而不报错不触发换号`
- sub2api 网关 `shouldFailoverOpenAIUpstreamResponse` 只对 401/402/403/405/429/5xx 换号；**静默挂起（无响应也无错误码）不触发 failover** → 请求悬挂在坏号上，客户端只能干等。
- 本会话实测（2026-09-12 深夜）：tuan 首字节 9.5s、yunshu 2.9s，**当前均正常** → 证明这是**间歇性**故障（高峰/坏号时挂起），非持续故障。

### 4. 为什么症状像「反复卡 5 分钟」而不是报错就完
- `llm/src/retry-policy.ts` L18：`TIMEOUT` ∈ `DEFAULT_RETRYABLE_CODES`（默认可重试）。
- 本机 8 个 provider 全部 `retryPolicy: mode: always`（记忆：为治蜂群假循环已全改）——**always 模式无 maxRetries 上限、无限重试**，backoff maxDelayMs=30000。
- 组合效果：坏号挂起 → 等 5 分钟 idle 超时 → TIMEOUT → 立刻（≤30s 退避）重试同一请求 → 又等 5 分钟 → 无限循环。

## 修复建议（按优先级）

| 层 | 动作 | 说明 |
|---|---|---|
| 网关（根治） | yunshu 慢号降权 + sticky 逃逸 15s→5s | 已部分落地（22:15 降权→60/agenes 入池/ttft 权重 1.5→2.0），其余需 admin 凭据，见 `TUAN-POOL-HANDOVER.md` L176-180 |
| 网关（根治） | 给「慢而不报错」的号加响应超时/心跳检测，超时即 failover | 上游静默 >N 秒应视为坏号换路 |
| DSH（兜底） | 对易挂路由显式调小 `streamIdleTimeoutMs`（如 yunshu/tuan 60s~90s） | 快速失败 → 走重试换路，而不是干等 5 分钟。**2026-09-13 已落地：用户拍板 10s 无流数据即失败直接重试，`streamIdleTimeoutMs: 10000` 已配到 yunshu/tuan/agnes/deepseek-official** |
| DSH（兜底） | 易挂路由 retryPolicy 限量（mode: normal + maxRetries 3） | 避免无限 5 分钟循环把请求彻底卡死 |
| DSH（观测） | 错误消息带上 provider/model 名 | 当前 `pi-ai stream idle timeout after ${ms}ms` 无路由标识，无法直接定位是哪个 provider 触发 |

## 判定：不是 MunderDifflin / 蜂群问题
错误字符串来自 DSH 的 `llm-pi-ai` 包，与 MunderDifflin 源码无关（MunderDifflin 的 `idleTimeout=360` / `workerIdleTimeoutMinutes=360` 是另一套 worker 收割机制，数值/语义均不同）。

## 2026-09-13 用户拍板记录（settings.yaml 已改，热发布生效）
- 用户原话：「30 秒就行了 直接重试就行了」「10秒失败直接重试」。
- 动作：`D:\tdsh\dsh-home\settings.yaml` 中全部 4 处 `streamIdleTimeoutMs: 90000` → `10000`（yunshu/tuan/agnes/deepseek-official），注释同步更新。
- 生效机制（源码级验证）：`packages/settings/settings-file` 用 chokidar 监视 settings.yaml，编辑即热发布（loader-composition.spec.ts 断言「edit of settings.yaml registers the route live, and the next request carries…」）；`llm-pi-ai` adapter 按配置快照重建（adapter.ts L216-238 不可变快照），正在进行的请求走旧快照、下一次请求用新值。无需重启。
- 预期效果：坏号静默挂起 ≥10s 即抛 `pi-ai stream idle timeout after 10000ms` → `TIMEOUT` ∈ 可重试码 → `mode: always` 无限重试（初始退避 1s），即「10s 失败直接重试」。
