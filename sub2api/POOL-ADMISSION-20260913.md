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

**模型映射**：`Tuan → deepseek-ai/DeepSeek-V3.2`（主）+ `nemotron-3-ultra` + `gemma-4-31b-it`（备）

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

## 五、待办

- 观察 `usage_logs` 中新账号是否被路由（兜底位只在主力打满/失败时接管，served=0 属结构性正常）
- ⚠️ 工具输出文案称"prio 90"，与实际写入的 **50** 不符 —— **以 DB 实际值为准**（工具文案小瑕疵，已在下方记录）
