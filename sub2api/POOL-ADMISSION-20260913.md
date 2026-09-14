# 免 key 端点入池记录 — 2026-09-13

> 回答"都丢到池子里了么"这个问题：**Pollinations 早已在池；本轮新发现的 ai-api.xzt.plus 此前未入池，现已补上。**

## 一、真实池现状（2026-09-13，SSH→Mac PG 只读查证）

池内共 **31 个账号**，其中 **26 个 active + schedulable**。

### 免 key / 零成本端点分布

| 端点 | 池内账号 | 状态 |
|---|---|---|
| **Pollinations** `text.pollinations.ai/openai` | 18 `pollinations-free`(prio 27)、21 `pollinations-text-free`(28)、22 `pollinations-fast-free`(29) | 18 号 error → **已停调**；21/22 active |
| **ai-api.xzt.plus**（本轮新发现） | **31 `xzt-ai-proxy-free`** | ✅ **本次新入池，active** |
| columbina | 12/14/15/17/18/20/10 + 30（共 8 个） | active |
| siliconflow-free | 17 | error（已避让） |

## 二、本轮入池详情（账号 31）

```
id          : 31
name        : xzt-ai-proxy-free
base_url    : https://ai-api.xzt.plus/v1
key         : sk-free（占位；该端点忽略 Authorization 头，实测无头/任意值均可用）
status      : active
schedulable : true
priority    : 50      ← 与其它免费档同层（columbina 10-30、pollinations 27-29），非主力位
concurrency : 1       ← 兜底位铁律
```

**入池前自动复测（add-free-api-pool.mjs 内置，全部 HTTP 200 真出词）**：

| 模型 | 结果 | 耗时 |
|---|---|---|
| `deepseek-ai/DeepSeek-V3.2` | ✅ 出词 | 4667ms / 335ms |
| `nemotron-3-ultra` | ✅ 出词 | 11281ms |
| `gemma-4-31b-it` | ✅ 出词 | 3660ms |

**模型映射**（2026-09-14 扩到 5 映射，旧 `nemotron-3-ultra`/`gemma-4-31b-it` 同名字段被替换，5/5 直连 200 出词已验）：
`Tuan → deepseek-ai/DeepSeek-V3.2`（主）+ `Tuan-qwen → Qwen/Qwen2.5-7B-Instruct`（中文好）+
`Tuan-nemo → nemotron-3.5-lightning-30b-a3b` + `Tuan-hunyuan → tencent/Hunyuan-MT-7B` +
`Tuan-ocr → PaddlePaddle/PaddleOCR-VL-1.5`

## 三、关于"免 key 端点如何入池"

入池工具 `add-free-api-pool.mjs` 要求 `SF_KEY` 非空。对免 key 端点，实测确认：

```
该端点忽略 Authorization 头 —— 无头 / "none" / "sk-free" / 空串 四种情况均正常出词
```

因此用占位 key `sk-free` 入池即可，不影响功能。

## 四、纪律遵守

- ✅ **兜底位铁律**：priority 50 / concurrency 1，与既有免费档同层，**绝不影响主力账号**（主力为 1-9、19）
- ✅ **入池前复测**：工具自带 /models + chat 双测，避免把已失效端点写进池
- ✅ **幂等**：INSERT 前先按 name 查重，重复执行不会产生脏数据
- ✅ **只读核对**：入池后经 SSH 只读 SQL 独立验证字段真实值（不轻信工具自述）

## 七、2026-09-14 xuanwu-free 占位入池（账号 45）

- 来源：V2EX `t/1215596` 玄武公益站 `gpt.bjqdtd.com`，**用户名+密码直注无邮箱验证**，秒进控制台。
- 验证：`/v1/models` 200（gpt-5.5/5.6-sol/5.6-terra）；chat 全 403「剩余额度 $0」——**key 有效、号没钱**。
  帖子"注册送 50 刀"未到账；Wallet 只收兑换码；Linux.DO Credit 未启用。三样全要找站主。
- 入池：`xuanwu-free`，3 映射（Tuan→gpt-5.5 / Tuan-sol / Tuan-terra），prio50/conc1/group5。
  额度到账自动复活（error_rate 避让会放行）。key 只入 PG，**不落文档**。

## 六、2026-09-14 aitools-free 入池（账号 44，新 goal 首单）

- 来源：V2EX `t/1181529` 帖站 `platform.aitools.cfd`，**免注册**，页内点两次即领 key（每 IP 每小时 1 个，永久有效，每 key 3 秒 1 次）。
- 验证（入池前直连）：`zhipu/glm-4-flash` 200 出词、`google/gemma-4-31b` 200 出词；`openai/gpt-oss-20b` 偶发 500（上游不稳）。
- 入池：`aitools-free`，base `https://platform.aitools.cfd/api/v1`，映射 Tuan→glm-4-flash /
  Tuan-gemma→gemma-4-31b / Tuan-gptoss→gpt-oss-20b，prio50/conc1/group5。key 只入 PG credentials，**不落文档**。
- 注意：该站 429 限流严（3 秒 1 次），只做兜底。

## 八、2026-09-14 freemodel-free 占位入池（账号 46）

- 来源：`freemodel.dev`，**邮箱验证码直注**（临时邮箱收码 `768599` 秒到），建 key 全程无卡点。
- 验证：`/v1/models` 双面 200（OpenAI 面 gpt-5.6 系 3 个 / cc 面 claude-opus-5 等）；
  chat 401（OpenAI 空）/`Insufficient balance`（cc 面）——**key 有效、余额 0**，帖子说的 $30/$300 未到账。
- 入池：`freemodel-free`，Tuan→gpt-5.6-sol / Tuan-luna / Tuan-terra，prio50/conc1/group5。
  额度到账自动复活。key 只入 PG，**不落文档**。

## 九、2026-09-14 新 goal 轮战果与门槛地图（empero 蹲守+持续扫）

**新入池 2 单**：44 `aitools-free`（免注册页内领 key，glm-4-flash/gemma 出词 200）+
45 `xuanwu-free`（用户名直注无验证，models 200，chat 403 待额度）+
46 `freemodel-free`（邮箱码直注，models 双面 200，chat 余额 0 待额度）。
xzt 31 号映射扩到 5（DS-V3.2/Qwen2.5/nemo/hunyuan/OCR 全 200，限流时 429）。

**18+12 新站批量探测零匿名**：导航站 30 个域名，models 可列但 chat 全要 key（freemodel 三域/orca/tokenforge 同理）。

**死站**：empero 503 / QWQ 502 / unlimited 522 / 辉哥 DNS 挂 / cngpt 连接断。

**门槛地图（要用户凭证）**：L站号（君の/快跑/GGBOOM签到/AgentRouter）/ 登好的 GitHub（速语/a6/claude360）/
国内邮箱（TrueSOTA 白名单）/ 手机（商汤/硅基流动/火山/DeepSeek/LongCat）。
**禁区**：camel-hub（明示禁 AI 注册，不碰）。

- 观察 `usage_logs` 中新账号是否被路由（兜底位只在主力打满/失败时接管，served=0 属结构性正常）
- ⚠️ 工具输出文案称"prio 90"，与实际写入的 **50** 不符 —— **以 DB 实际值为准**（工具文案小瑕疵，已在下方记录）
