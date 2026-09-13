# 僵尸账号上游归属排查 — 2026-09-13

> 上轮结论：4 个僵尸账号（#2/#5/#7/#8）`active+schedulable` 但缺 `base_url`。
> 本轮尝试**只读推断其归属厂商与正确端点** —— 若能确定，这些号可从"僵尸"变回可用产能。

## 一、★ 突破：#7 glm-zhipu 的 base_url **已找到**

### 端点

```
base_url = https://open.bigmodel.cn/api/paas/v4
（智谱 AI 开放平台，OpenAI 兼容路径 /chat/completions）
```

### 证据（含正负对照，排除"端点本就开放"的误判）

| 测试 | 结果 | 含义 |
|---|---|---|
| **带真 key** `GET /models` | **HTTP 200** ✅ | key **被接受**，返回模型列表（glm-4.5 / glm-4.5-air / glm-4.6 …） |
| **不带 key**（阴性对照） | HTTP 401 `未收到Authorization参数` | 端点**确实需要**鉴权 |
| **乱码 key**（阴性对照） | HTTP 401 `令牌已过期或验证不正确` | 真 key 与乱码 key **行为不同** → key 是真的 |
| **带真 key** `POST /chat/completions` | **HTTP 429** `余额不足或无可用资源包,请充值` | 鉴权通过，但**账户无余额** |

**结论**：`#7` 不是"配置未完成"，而是——
**key 有效、端点是智谱官方、但账户余额为 0**。

> 这也解释了它为何 `last_used_at` 为 NULL：**没有 base_url → 从未被派出**，
> 但即使补上 base_url，它也会因余额不足而失败（402/429）。

## 二、另外 3 个：未能确定归属

用同样方法（带 key vs 不带 key 对照）测试候选端点：

| 账号 | key 前缀 | 测试端点 | 结果 | 判定 |
|---|---|---|---|---|
| **#2 kimi2-hello4am** | `sk-dd23…`（67位） | `api.moonshot.cn/v1` | 带 key **401 Invalid Authentication** | ❌ 非 Moonshot |
| **#5 infer** | `sk-900e…`（67位） | `api.deepseek.com/v1` | 带 key **401 api key is invalid** | ❌ 非 DeepSeek |
| **#8 amd-radeon** | `rc-…`（51位） | 多个 AMD 域名 | 均 `000`/`404`（域名不存在或不可达） | ❓ 未定位 |

**诚实标注**：这 3 个的归属**我无法确定**。
`sk-` 前缀是通用格式，指向不明；AMD 的推理服务域名我没有找到有效候选。

## 三、由此得出的处置建议（分两类）

### 类型 A：#7 glm-zhipu —— 可修复（一行配置 + 充值）

```
必填: base_url = https://open.bigmodel.cn/api/paas/v4
前提: 该智谱账户需有余额（当前 429 余额不足）
```

- ✅ 端点已确认可用、key 已确认有效
- ⚠️ 但**账户无余额** → 即使补上 base_url 也接不了单
- **除非你给该账户充值，否则补 base_url 的价值有限**

### 类型 B：#2 / #5 / #8 —— 无法修复（归属不明）

- 我不知道它们该指向哪里
- 且 #2/#5 的 key 在各自"疑似归属"的厂商处**均被拒**（可能 key 已失效）

→ 建议**置 `schedulable=false`** 移除出调度序列（它们已排在第 19/20/22/28 位）

## 四、我这轮做对了什么（方法论）

**关键是"正负对照"**：
如果我只测"带 key 访问智谱端点 → 200"，**无法区分**：
- (a) key 有效，还是
- (b) 该端点本来就不需要 key

加上"不带 key"与"乱码 key"两个对照后，
**三者行为不同（200 / 401-无头 / 401-无效）** 才能确证 key 是真的。

这与本仓一贯的 `BAD_OUT` / 阳性对照纪律一致。

## 五、复现（只读）

```bash
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
K=$(psql -h 127.0.0.1 -U postgres -d sub2api -At -c \
   "SELECT credentials->>'api_key' FROM accounts WHERE id=7;")
# 正对照
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $K" \
  https://open.bigmodel.cn/api/paas/v4/models          # 期望 200
# 负对照
curl -s -o /dev/null -w '%{http_code}\n' \
  https://open.bigmodel.cn/api/paas/v4/models          # 期望 401
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer bogus" \
  https://open.bigmodel.cn/api/paas/v4/models          # 期望 401
```

## 六、待你决定

| 账号 | 建议 | 需你提供 |
|---|---|---|
| #7 glm-zhipu | 补 `base_url`（已知）**+ 确认该智谱账户是否有余额** | 余额情况 |
| #2 / #5 / #8 | 置 `schedulable=false`（归属无法确定） | 一句确认 |

**⚠️ 我仍未擅自改动任何配置**（补 base_url 与改 schedulable 都属池配置改动）。
