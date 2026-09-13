# NodeSeek 公益站注册攻略（待用户执行）— 2026-09-13

> 按帖热度×额度×模型覆盖挑 3 家，用户任选 1-2 家注册即可。注册全程用小号邮箱，
> 不要在任何公益站输入付费 key 或个人敏感信息。

## 首选：注册送100刀+每日签到（Opus 5/GPT-5.6）

- 帖：https://www.nodeseek.com/post-852858-1
- 步骤：打开帖内站址 → 注册账号 → 控制台复制 key → 发我 `base_url + key + 1个模型名` → 我入池验证。

## 次选：每日200刀订阅制

- 帖：https://www.nodeseek.com/post-781728-1
- 同上流程。订阅制多为"按日重置"，适合当兜底，不适合跑量。

## 三选：Codex 7天订阅（Codex 向）

- 帖：https://www.nodeseek.com/post-740464-1
- 每日 30 USD、倍率 1x，Codex 需求大时用。

## key 到手后我这边一键入池（用户不用管）

```
$env:SF_NAME="nodeseek-<站名>"; $env:SF_BASE="<站base>/v1"; $env:SF_KEY="<key>"
$env:SF_MODELS='{"Tuan":"<模型ID>"}'; node add-free-api-pool.mjs
```

铁律：prio 90 / concurrency 1 / group 5 兜底位，先单发 200 验证再进池。
