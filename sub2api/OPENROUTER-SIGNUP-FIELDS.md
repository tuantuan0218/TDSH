# U9 OpenRouter 注册填表参数 — 2026-09-14（CDP 实测）

> 目的：用户给主流邮箱后，即可半自动完成 OpenRouter 注册（人工只做验证码/邮箱确认）。
> CDP 实测（session freeapi-keys，真实浏览器，2026-09-14）：
> 注册页 `https://openrouter.ai/auth/sign-up` 正常加载（**无 Cloudflare 挑战**），
> 自动重定向到 `https://openrouter.ai/sign-up?redirect_url=...`。

## 表单字段（实测 DOM）

| 字段 | selector (id) | name | 类型 | 必填 |
|---|---|---|---|---|
| 名 | `#firstName-field` | firstName | text | 否（Optional） |
| 姓 | `#lastName-field` | lastName | text | 否（Optional） |
| 邮箱 | `#emailAddress-field` | emailAddress | text | ✅ |
| 密码 | `#password-field` | password | password | ✅ |
| 条款勾选 | `#legalAccepted-field` | legalAccepted | checkbox | ✅ |
| 提交 | （按钮）"Continue" | — | button | — |

页面另有 "Sign in" 链接（已有账号）；"or" 下方是 OAuth 入口（GitHub/Google，CDP 实测页面标记存在）。

## 填表参数（用户给邮箱后直接用）

```bash
# 经 10086 CDP 桥（session freeapi-keys），参考 cdp-fill.mjs 模式
# 1) 填邮箱
#    document.querySelector('#emailAddress-field')  → 用户邮箱
# 2) 填密码（≥8 位，含大小写/数字）
#    document.querySelector('#password-field')
# 3) 勾选条款
#    document.querySelector('#legalAccepted-field').click()
# 4) 点 Continue → 观察后续（可能出邮箱验证码 / Turnstile，需用户读邮件）
```

## 预期卡点（提交后）

1. **邮箱验证码**：OpenRouter 会发验证邮件，需用户读一次邮件（唯一人工环节）
2. **Turnstile**：提交时可能弹 Cloudflare 人机验证（9-13 注册战报记录），需用户点一次
3. 注册成功 → Keys 页建 `sk-or-v1-*` → 发我入池（配置已就绪 `openrouter-free-config.json`）

## 状态账

- 只读探测：未填表、未提交、无账号产生
- 待办：用户给主流邮箱（qq/163）→ 我按本参数半自动注册（人工=验证码+可能 Turnstile）