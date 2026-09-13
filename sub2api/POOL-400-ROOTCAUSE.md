# 全池 HTTP 400 错误根因分析 — 2026-09-13

> 承接 `POOL-HEALTH-REPORT-EXPLAINED.md` 第三节提出的待查项：
> "12h 内 400 错误量很大，**本轮仅发现未深挖**"。本文给出完整根因。

## 一、结论先行

全池 12h 内 **95.29% 请求成功**（11863 成功 / 587 个 400），**整体健康**。
587 个 400 不是池的故障，而是**单一客户端脚本发出的超大/畸形请求**。

| 项 | 数值 |
|---|---|
| 成功请求 | 11863 |
| 400 错误 | 587（占 4.71%） |
| **成功率** | **95.29%** |
| 涉及 API key | **仅 1 个**（`api_key_id=1`，名为 `default`，`sk-d715fbcc4...`） |
| 涉及账号 | 8 个（跨账号，说明不是某账号的问题） |
| User-Agent | **`Python-urllib/3.9`**（脚本，非正常客户端） |
| 重试后成功 | **0 / 587**（全部未恢复） |

## 二、根因分类（587 个 400 逐一归类）

| 类别 | 数量 | 占比 | 真实原因 |
|---|---|---|---|
| **B. 超上下文窗口** | 209 | 35.6% | `ContextWindowExceededError`：输入达 **701991 / 702344 / 751498 tokens**，模型上限远低于此 |
| **D. 其它（也全是超窗口）** | 210 | 35.8% | 样本抽查**全部**是 `ContextWindowExceededError`，只是错误前缀不同致正则没归入 B |
| **A. 工具调用 name 为空** | 130 | 22.1% | `invalid tool_call function, function/name cannot be empty` |
| **C. 请求体缺字段** | 37 | 6.3% | `` `input[93]` missing required field `` |
| A2. 工具调用缺 name 属性 | 1 | 0.2% | `'name' is a required property - '***.***.function'` |

**更正我的分类**：初版把 B 单列 35.6%，但抽查后发现 **D 类 210 条样本同样是 `ContextWindowExceededError`**。
即**真实占比是 B+D ≈ 71.4% 都是"请求塞了 70 万+ token"**，这才是压倒性主因。
（教训：正则分类必须**抽查"其它"桶**，否则会把主因误判成杂项。）

## 三、关键发现：错误归属被错了

`ops_error_logs` 的归属字段**全部标为**：

```
error_phase  = upstream
error_source = upstream_http
error_owner  = provider      ← 587/587 全标成"上游问题"
```

**但这 587 个的真实责任在客户端**：

- `ContextWindowExceededError`（输入 70 万 token）= **请求方没做上下文管理**
- `tool_call function/name cannot be empty` = **请求方构造了非法工具调用**
- `missing required field` = **请求方请求体不完整**

⚠️ **这个误标有实际危害**：把客户端错误算作"上游 provider 的问题"，会污染账号的健康画像——
如果按 `error_owner` 做账号降权，会**错误地惩罚无辜的上游账号**（8 个账号被牵连）。

> **建议（需你决定）**：`error_owner` 的判定逻辑应识别 400 且 message 含
> `ContextWindow|invalid tool_call|required property|missing required` 时归为 **`client`**，
> 而非 `provider`。这属于改池行为，我**不擅自动手**。

## 四、另一个值得注意的点：重试未生效

587 个出错的 `request_id` 中，**没有任何一个**在 `usage_logs` 里出现（即重试后成功 = 0）。

- 对 `ContextWindowExceededError` 这类**确定性错误**，不重试是**正确**的（重试也必然失败）
- 但说明池**确实会区分可重试/不可重试**，行为合理 ✅

## 五、为什么只影响 1 个 key？

`api_key_id=1` 名为 `default`、`user_id=1`（即站长自用 key）。它是唯一在跑**自动化脚本**（Python-urllib）的 key，
其它流量来自正常客户端。**故这不是"池坏了"，而是"某个脚本在发不当请求"。**

## 六、复现（只读）

```bash
ssh -o BatchMode=yes -i ~/.ssh/id_ed25519 zhaozicheng@192.168.1.3 'bash -s' <<'EOF'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api -At -F'|' -c \
"SELECT error_owner, count(*) FROM ops_error_logs
 WHERE created_at > now() - interval '12 hours' AND upstream_status_code=400
 GROUP BY error_owner;"
EOF
```

## 七、待你决定的两项（我未擅自改池）

1. **`error_owner` 误标修正** —— 把客户端 400 从 `provider` 改判为 `client`，避免无辜账号被降权。
2. **是否提醒该脚本的作者** —— 其请求含 70 万 token / 非法 tool_call，属可自查问题。

> 补充：`node pool-health-check.mjs` 已能一键复现本报告的所有原始数据。
