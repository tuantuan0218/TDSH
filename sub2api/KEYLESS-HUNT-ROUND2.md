# 免 key 端点扩展搜寻（第二轮）— 2026-09-13

> 上一轮扫了 20 个候选，命中 2 个。本轮把候选池扩到 **30 个此前未试过的网关/聚合站**，
> 结论：**免 key 可用端点仍为 0 新增**（2 个上限未破）。
> 但发现 **9 个"可列模型但需 key"的站点**，其中 **naga.ac 确认有真免费档**——登记为新的受限项。

## 一、核心结论

| 项 | 数量 |
|---|---|
| 本轮候选 | 30 |
| **免 key 真出词（★）** | **0** |
| 可列模型但 chat 需 key（🟡） | 9 |
| 不可达/401/403（·） | 21 |

**累计搜寻结果**：两轮共 **50 个候选 → 免 key 可用仍为 2 个**（pollinations + xzt）。
这已是**独立复现的稳定结论**，不是抽样偏差。

## 二、9 个「可列模型但需 key」站点（登记价值）

这些站点的 `/models` **免 key 可列**（说明 API 基础设施开放），但 chat 需 key。
**它们是有真实注册价值的候选**（尤其带免费档的）：

| 站点 | 免 key 可列模型数 | chat 状态 | 备注 |
|---|---|---|---|
| `api.featherless.ai/v1` | **21940** | 401 | 模型量最大 |
| `api.aimlapi.com/v1` | **941** | 401 | AI/ML API |
| `api.zhizengzeng.com/v1` | **852** | 401 | 智增增（国产） |
| `api.airforce/v1` | 615 | 401 | — |
| `api.electronhub.ai/v1` | 589 | 403 | — |
| `api.gptgod.online/v1` | 322 | 403 | — |
| `api.naga.ac/v1` | 258 | 401 | ⭐ **确认有免费档**（见下） |
| `api.novita.ai/v3/openai` | 117 | 403 | — |
| `api.llm7.io/v1` | 47 | 401 | 此前已记录（邮箱黑名单拦截） |

## 三、⭐ 新发现：naga.ac 有真免费档（已核实文档）

### 免费档规格（来自官方文档 `docs.naga.ac/build/rate-limits`）

```
Free Models（所有 :free 模型共享一个合并限额）:
  Requests per Minute (RPM): 10
  Requests per Day   (RPD): 100
Paid Models: 不受此固定 RPM/RPD 限制
```

官方定价页（`naga.ac/pricing`）原文：
> "Start free on zero-cost models, then switch to pay-as-you-go for the full catalog."
> Free tier: **10+ models**（对比付费 240+）

**注册方式**：免费注册（Sign up for free）；官网另有 Discord 社区
（`discord.com/invite/nagaai-1145994888006086696`），历史资料显示可经 Discord 领 key。

### ⚠️ 但我核实到一个不一致（如实记录）

官方文档说"在 models 页面找 `:free` 标签"，但**我实测 `GET /v1/models` 返回 258 个模型中
`:free` 标签数为 0**。即：

- ❓ `/models` **未通过 API 暴露** `:free` 标记
- 📄 文档指向的是**网页版 models 页**，而非 API
- **我未能确认具体哪些模型属于免费档**（需要注册后在网页查看）

> 这属"文档与 API 表面不一致"，**不做臆测**——登记为受限项，等你注册后可一眼看到。

## 四、naga.ac vs 现有渠道对比

| 渠道 | 限速 | 模型数 | 门槛 |
|---|---|---|---|
| **naga.ac（新）** | **10 RPM / 100 RPD** | 10+ 免费 | 免费注册 |
| xzt（已入池） | **10 次/分钟**（实测硬限） | 24（9 可用） | **免 key** |
| pollinations（已入池） | 未公开 | 1 | **免 key** |
| NVIDIA NIM（U8） | **40 RPM** | **82** | 人工过 hCaptcha |

**评估**：naga.ac 限速与 xzt 相当（10 RPM），但需注册。
**优先级低于 U8**（NIM 的 40 RPM 更优），高于其它无免费档的站点。

## 五、方法论：为何"可列模型但需 key"值得单独记录

`/models` 免 key 可列 = 该站**基础架构开放**（不是全封闭）。
这类站往往：
1. 注册流程较简单（不需要企业审核）
2. 有免费试用档的概率更高

**故把 9 个站点登记为候选，而非"不可达"一笔带过**——它们与 401/403 直接拒绝的站有本质区别。

## 六、复现

```bash
node hunt-keyless-round2.mjs --json out.json   # 30 候选两步门扫描
# 文档佐证
curl -s https://docs.naga.ac/build/rate-limits | grep -o 'Requests per [A-Za-z]*[^<]*[0-9]*'
```

## 七、受限项更新

| 编号 | 事项 | 回报 | 优先级 |
|---|---|---|---|
| U8 | NVIDIA NIM 过 hCaptcha | 40 RPM / 82 模型 / 无限制额度 | ⭐⭐⭐ |
| **U14（新）** | **naga.ac 免费注册** | 10 RPM / 100 RPD / 10+ 模型 | ⭐⭐ |
| U9 | OpenRouter 主流邮箱 | 22 零价模型 | ⭐⭐ |
| U12/U13 | Groq / Cerebras（建议恢复） | 各家免费档 | ⭐⭐ |
| U10/U11 | AgentRouter / GoRouter | 签到领模型 | ⭐ |
