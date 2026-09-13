# 免费额度监控告警
> 生成 2026-09-13T20:59:36.983Z（fixtures 模式） · 公益站 6 · 码批次 10 · 阳性对照 OK

## 与上轮 diff
（无变化）

## 当前公益中转站快照
- Agent Router `agentrouter.org` 模型3 可用率100% 评分96 check-in/daily:随机
- Any Router `anyrouter.top` 模型7 可用率0% 评分20 check-in/daily:随机 / signup/one-time:50美元额度 / referral/per-referral:50美元额度
- GoRouter `gorouter.app` 模型2 可用率0% 评分45 check-in/daily:随机
- JustDoWork `api.justwoker.icu` 模型2 可用率0% 评分45 check-in/daily:随机 / signup/one-time:70美元额度
- TaBiAI `tabitoken.com` 模型2 可用率0% 评分45 check-in/daily:随机
- columbina `newapi.columbina.eu.org` 模型2 可用率50% 评分70 check-in/daily:随机
## 当前福利码批次
- FluxionAI · FluxionAI 兑换码 → **$3 体验额度** 余 120（46天 16:09:27）
- Orbelis · 九月新用户福利 → **10U试用订阅周卡** 余 72（18:47:27）
- RickToken · RickToken 兑换码 → **$3 体验额度** 余 67（15天 16:25:27）
- I Code Easy · I Code Easy 兑换码第二期 → **¥3 体验额度** 余 58（4天 21:30:27）
- 元流 Token · 元流兑换码 → **$5 体验额度** 余 42（15天 16:18:27）
- Z-API · Z-API九月福利 → **3元体验额度** 余 39（16天 16:40:27）
- AI 聚合平台 · AI 聚合平台 · 2026年9月体验福利 → **5算力（平台人民币5元充值对应额度，非美元）** 余 37（2天 18:13:27）
- Top API · 九月新用户福利 → **$3 无门槛体验额度** 余 27（16天 15:09:27）
- CodeGo · CodeGo 兑换码 → **$3 体验额度** 余 19（16天 10:39:27）
- LV Ping · LV Ping 兑换码 → **$20 体验额度** 余 8（17天 14:52:27）
## 匿名实测（两级门：models 可见 / chat 真出词）
- [阳性对照] `https://text.pollinations.ai/openai` models:200(1) chat:200 → **POOLABLE 出词="PONG"**
- [阳性对照] `https://ai-api.xzt.plus/v1` models:200(24) chat:200 → **POOLABLE 出词="PONG"**
- [负对照] `https://free.suyu.io/v1` models:200(9) chat:401 → **仅清单开放**
- Agent Router `https://agentrouter.org/v1` models:401 chat:401 → **不可用**
- Any Router `https://anyrouter.top/v1` models:0 chat:0 → **不可用** models:TypeError: fetch failed
- GoRouter `https://gorouter.app/v1` models:0 chat:0 → **不可用** models:TypeError: fetch failed
- JustDoWork `https://api.justwoker.icu/v1` models:0 chat:0 → **不可用** models:TypeError: fetch failed
- TaBiAI `https://tabitoken.com/v1` models:0 chat:0 → **不可用** models:TypeError: fetch failed
- columbina `https://newapi.columbina.eu.org/v1` models:0 chat:0 → **不可用** models:TypeError: fetch failed
