# BazaarLink 入池执行脚本（本地版）— 2026-09-14

> 用法：用户注册 bazaarlink.ai 拿 `sk-bl-*` key 后，设 `$env:SF_KEY` 跑本脚本。
> 入池参数已按 2026-09-14 实测固化（3 个零价模型 + auto:free 路由 + prio 90/conc 1/group 5）。

## 一键入池（PowerShell）

```powershell
$env:SF_NAME="bazaarlink-free"
$env:SF_BASE="https://api.bazaarlink.ai/v1"
$env:SF_KEY="sk-bl-<你的key>"
$env:SF_MODELS='{"Tuan":"auto:free"}'
node add-free-api-pool.mjs
```

## 可选映射（按模型精确入池，不用 auto:free 路由时）

```powershell
# 三选一（都是零价模型）：
# auto:free            —— 自动路由到任一免费模型（推荐，省心）
# qwen/qwen3.7-flash:free        —— 多模态（视觉+推理）
# deepseek/deepseek-v4-flash-0731v:free  —— 1M 上下文
```

## 实测依据（2026-09-14）

- /v1/models 匿名 200，173 模型（3 个零价）
- chat 匿名 401 需 key（`Bearer sk-bl-...`）
- 限流 10 RPM / 50 req/day；内容审查违规 403（站方行为非故障）
- 配额可编程查：key 信息含 `limit_remaining`/`requests_daily`（可接 free-quota-monitor）
- 详见 `FREE-TIER-ROUND3-20260914.md` 附2

## 注册（用户）

bazaarlink.ai → 登录页点 "Sign up" → Name + Email + 密码(≥8) + Confirm + Turnstile 点一下 →
Create account → 控制台复制 `sk-bl-*` key 发我
