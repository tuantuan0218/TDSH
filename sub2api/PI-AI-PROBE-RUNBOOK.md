# pi-ai 健康探针 RUNBOOK（复发定位手册）

> 背景：DSH 报 `pi-ai stream idle timeout after ...ms` 的根因是**上游慢号静默挂起**（不出流数据也不返回错误码），网关 failover 只认显式错误码，最终靠客户端空闲看门狗兜底。**2026-09-13 用户拍板：10s 无流数据即失败直接重试**——`yunshu / tuan / agnes / deepseek-official` 四条路由已配 `streamIdleTimeoutMs: 10000`（DSH 热发布免重启），复发时显示 `after 10000ms`；其余未显式配置的路由仍走默认 300000ms。

## 何时用
- DSH 又报 `pi-ai stream idle timeout ... ms`（复发），需要快速定位是哪条 provider 路由在挂。
- 想确认当前各上游路由的健康基线。

## 一键运行（全 9 路由，45s 预算/路由）
```powershell
node D:\tdsh\sub2api\probe-pi-ai-all.mjs 45000
```
输出：
- 控制台逐路由状态：`OK` / `HTTP_ERR`（快速失败，不卡）/ `ERR`（连接失败）/ `STALL_OR_BUDGET`（**预算内无响应且不断开=慢号挂起嫌疑**）。
- JSON 基线写入 `D:\tdsh\sub2api\probe-runs\pi-ai-all-<时间戳>.json`。
- 摘要尾部给出「坏号候选」清单。

## 状态判读
| 状态 | 含义 | 是否卡 5 分钟 |
|---|---|---|
| `OK` | 正常流式 | 否 |
| `HTTP_ERR` | 上游立即返回错误码（400/403/429…） | 否（快速失败→重试） |
| `ERR` | 连接被拒/断开（fetch failed） | 否 |
| `STALL_OR_BUDGET` | **连上但预算内零数据且不断开** | **是 ← 元凶特征** |

> 注意：预算内 `STALL_OR_BUDGET` 可能是「慢但最终会出」（如 dsferr 45s 预算内没出但可能 90s 出），需用更长预算复测或对照历史 JSON 判断趋势。

## 周期调用（不建计划任务）
按本机准则禁建 Windows 自动化任务，需要定期跑时由 goal 循环/看护会话手动执行，或用户自己双击运行。探针幂等、只读（每次发一个小流式请求，max_tokens=32），可安全重复。

## 基线（2026-09-13 01:20 最新全量，`probe-runs\pi-ai-all-2026-09-12T17-20-24-513Z.json`）
- OK=6：yunshu(2.1s) / baiqwen / tokenrouter / tele(0.9s) / tuan(2.9s) / teleqwen
- HTTP_ERR：amd 404（模型 `bai/glm-5.3-flash` 已下架）/ xiaoen 403（token quota 不足）
- ERR：dsferr（fetch failed 直连失败 ← 快速失败，不卡；此前为 STALL_OR_BUDGET。2026-09-13 WSL 侧 `ss -ltn` 仅剩 15722，22217 转发对端已丢；15722 的 wslrelay 进程正常。修需进 WSL 查原转发目标，用户未批前不动）
- STALL_OR_BUDGET：无（当前无慢号在挂）

## 历史基线（2026-09-12 第一次全量，仅存档）
- OK=6：yunshu / baiqwen / tokenrouter / tele / tuan / teleqwen
- HTTP_ERR：bai1（credit insufficient 欠费透传 400）、xiaoen（token quota 不足 403）
- ERR：amd（fetch failed）、xiaoen
- STALL_OR_BUDGET：dsferr（45s 零数据不断开 ← **已加 90s 超时**）

## 已配置 10s 超时的路由（2026-09-13 用户拍板：10s 失败直接重试）
yunshu / tuan / agnes / deepseek-official —— `D:\tdsh\dsh-home\settings.yaml` 内 `streamIdleTimeoutMs: 10000`（热发布生效，无需重启，正在进行的请求仍走旧快照）。若复发时错误消息显示 `after 10000ms` 而非 `300000ms` 或 `90000ms`，即证明新配置已生效。注：`dsferr` 路由已不在 settings.yaml（历史条目，无需再配超时）。

## 复发时怎么办
1. 跑 `node D:\tdsh\sub2api\probe-pi-ai-all.mjs 45000` 找 `STALL_OR_BUDGET` 路由。
2. 对该路由复测更长预算确认是否真挂：`node D:\tdsh\sub2api\probe-pi-ai-all.mjs 180000`。
3. 确认为坏号后：网关侧处理（sub2api admin 加 temp-unschedulable / 降权，见 `TUAN-POOL-HANDOVER.md` L176-180）；DSH 侧可把该路由 `streamIdleTimeoutMs` 再调小（如 30-60s）并考虑 `retryPolicy: normal + maxRetries 3` 限量（改动前先征询用户）。
