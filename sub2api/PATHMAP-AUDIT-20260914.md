# 全池路径前缀地图 & 假 BAD 风险面 — 2026-09-14（store 静态探测轮）

> 前置：SSH 到 Mac（192.168.1.3）暂不可达（key 于 09-15 02:23 被换、新旧全拒，用户正在修）。
> 本报告 = **不依赖 DB 的 store 侧静态审计**；DB 侧权威比对待 SSH 恢复后跑
> `free-lane-pathcheck.mjs` 补齐（见文末待办）。

## 一、为什么做

`DECISION-CARD.md` 记录：olomc(48) 假 BAD 根因 = audit 用 store 纯主机名 base 拼
`/v1/chat/completions`，而网关真路径带 `/gw/v1` 前缀 → 404。并指出**凡带路径前缀的网关
（/gw/v1、/api/v1、/oe/v1、/openai…）都会被默认拼法打成假 BAD**。
本文把"会不会中招"从推测变成**全量实测**。

## 二、store 静态审计（site-accounts.json）

- store 有 base 的条目 **57 个**；
- **有 chatPath 覆盖：仅 1 个（archive-olomc.top，即 olomc-free/48）** ← 唯一已修复；
- 其余 56 个 = base 纯主机名 + 无 chatPath（audit 一律拼 `/v1/chat/completions`）；
- 其中 columbina 系 41 个（DB base_url 恰好 `/v1`，巧合正确）；
- 非 columbina 独立站 **14 个**（本报告实测对象）。

## 三、路径探测结论（无 key，401=路径存在需认证 / 200=公开 / 404=不存在 / 522=源站挂）

| 站点 | /v1/models | 判定 |
|---|---|---|
| api.justwoker.icu / crowllm.com / easymax.ai / emtf.aipm9527.online / ai.furry.vg / ai.mrcwoods.com / api.tu-zi.com / baosiapi.com / tian-shu.org / callxyq.xyz | **401 Invalid token** | ✅ /v1 通，audit 默认拼法正确 |
| sudobug.top / api.tmlab.store / tokenra.io | **401**（首轮 /api 仅见 → 二轮确认 /v1 也 401） | ✅ /v1 通（首轮系探测过密误判） |
| beizhi.sylu.cc | **HTTP 522**（CF 源站超时，浏览器 UA 亦 522） | 🔴 站点侧故障（非配置），待复查 |

**结论：14 个非 columbina 独立站中 13 个 `/v1` 前缀恰好正确**（new-api 系站根路径即
/v1），**无假 BAD 风险**；真正"带非标准前缀"的当前只有 olomc（/gw/v1，已修）。
`beizhi.sylu.cc` 是源站 522（CF 层），与探活路径无关，但 audit 也会把它打成 BAD ——
**属"站点真挂"而非"探针假 BAD"**，归类要分清。

> 附带发现：sudobug/tmlab/tokenra 的 `/v1beta/models` 也 401（Anthropic 风格路径，可能是
> 双协议站）；`/api/models` 401 = new-api 系管理路由常见形态，不构成 chatPath 依据。

## 四、对 DECISION-CARD 的修正/印证

- 印证："带前缀网关会被默认拼法打成假 BAD"——**store 现状里唯一实例就是 olomc**，已修。
- 修正：中招面 ≠ "所有带前缀站"，而是 **store 内恰好只有 1 个非 /v1 前缀站**；
  columbina 41 个是 /v1 巧合正确，13 个独立站实测 /v1 也对。
- 新风险：**beizhi.sylu.cc 522** 会让 audit 报 BAD → 别误当成"号坏/停池"建议，
  先复查源站是否恢复（DECISION-CARD 里它是 A 案注册页 200 可用站）。

## 五、DB 权威比对结果（SSH 恢复后 19:5x 实跑 free-lane-pathcheck.mjs）

- **路径漂移 = 0 条**：olomc(48) 的 `chatPath=/gw/v1/chat/completions` 与 DB
  `base_url` 完全一致 → **DECISION-CARD 的修复在 DB 权威口径下确认生效** ✅
- **覆盖缺口 16 条**（DB 有号、store 无条目，audit 探不到），与 DECISION-CARD 记载吻合：
  `aio-freeshare`(freeshare.cc.cd/v1) `aitools-free`(platform.aitools.cfd/**api/v1**)
  `columbina-free` `freemodel-free` `hub-linuxdo` `pollinations-fast-free`(text.pollinations.ai/**openai**)
  `pollinations-free` `pollinations-text-free` `siliconflow-free` `tele-muse`(llm.teleapi.top/**oe/v1**)
  `tele-qwen`(llm.teleapi.top/**qwen/v1**) `tokenrouter` `wb2api`(127.0.0.1:7863) `xuanwu-free`
  `xzt-ai-proxy-free` `xzt-free`
- 🔴 **5 个带非 /v1 前缀的缺口站 = 未来假 BAD 高危**：`aitools`(/api/v1)、
  `pollinations×3`(/openai)、`tele-muse`(/oe/v1)、`tele-qwen`(/qwen/v1)。
  **这些号若被补进 store 并走 audit 默认拼法，会重演 olomc 假 BAD** →
  入池/补条目时**必须带 `chatPath`**（模板 §二 流程）。

## 六、最终结论（静态 + DB 双口径合并）

1. **olomc(48) 无任何处置需求**：chatPath 修复 DB 确认生效、key 仅授权
   `cb/deepseek-v4.1-flash` 单模型（403 available_models + 带 key /gw/v1/models 200 双证）、
   网关持续在线（stats 增量观测 +27.5k tokens）。
2. **store 现状假 BAD 面 = 0**：14 个非 columbina 独立站实测 13 个 /v1 正确、
   1 个（beizhi.sylu.cc）为源站 522 故障（非配置）。
3. **未来风险 = 16 缺口中的 5 个带前缀站**（aitools/pollinations/tele-muse/tele-qwen），
   已列预警，入池必须 chatPath。
4. **第二映射不存在**：48 号 key 授权边界 = 单模型，扩模型需站主扩授权或新 key。

## 七、遗留待办

1. ~~跑 free-lane-pathcheck.mjs DB 比对~~ ✅ 已完成（§五：漂移 0、缺口 16）；
2. beizhi.sylu.cc 522（CF 源站超时）→ 定期复查是否恢复（恢复即从台账摘"故障"标注）；
3. 16 缺口站中带前缀 5 站（aitools/pollinations/tele-muse/tele-qwen）若入池必须带
   `chatPath`（模板 §二 流程），可复用 `gateway-probe.mjs` 建档定前缀。

---
*探测时间 2026-09-14 19:35Z；探针 = `gateway-probe.mjs`（正式工具，只读，无 key，
对 olomc / api.justwoker.icu 已双验证：401 前缀判定、SPA 兜底排除、new-api 系 /v1+/v1beta
双协议识别均正确）。*
