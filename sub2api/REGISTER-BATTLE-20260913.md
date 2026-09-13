# 注册战报 — 2026-09-13 夜（用户已批准注册，临时邮箱已建，卡在各站反羊毛门外）

> 临时邮箱：mail.tm（`uberip.com` 域）建号+收件箱轮询均正常，全程 0 封验证邮件。
> 凭据（邮箱密码/token/各站随机密码）只在本地 `.tmp-mailtm.json`（已进 `sub2api/.gitignore`），绝不入库。
> 本文件只记门槛与形态，不记任何地址/密码/token。

## 各站门槛实测（Edge CDP 真浏览器走）

| 站 | 注册形态 | 卡点 | 判定 |
|---|---|---|---|
| OpenRouter sign-up | 邮箱+密码+条款勾选，直注表单 | 点 Continue 后 Cloudflare Turnstile 人机验证 | 需人手过验证 |
| NVIDIA build | 邮箱→跳 nvgs 建账号页（双密码+4 checkbox） | 创建账户按钮 disabled（规则不明），0 邮件 | 需人手点 |
| SambaNova | Auth0 identifier（username+Continue） | 点后无跳转、无邮件 | 疑拒临时域 |
| Mistral | Ory 登录流，输入框动态挂载 | CDP 定位不到 email 输入 | 需人手 |
| 硅基流动 | 只要手机号+短信码+网易易盾 | 不认邮箱 | 需用户手机号收 1 条 |
| Groq | 点 Continue with email → 直接跳 Google OAuth | 要 Google 号 | 用户说谷歌已登录但 CDP 是我方浏览器，无其登录态 |
| ModelScope | 注册页纯展示，表单 JS 挂载 | 自动化填不进 | 需人手 |
| MiniMax | 要付款方式 | — | 放弃 |
| Google AI Studio | 要 Google 登录 | 同 Groq | 同 Groq |
| GitHub tokens 页 | 我方浏览器无登录态，跳 login | — | 用户说已登录但那是其浏览器，我方拿不到 |

## 教训

1. 2026 年免费 key 全前置反羊毛：Turnstile / OAuth / 手机 / 实名四选一，纯"邮箱直注即发 key"已不存在。
2. CDP 只能解决"我方浏览器自动化"，解决不了"用户浏览器登录态"——两者是隔离的 profile。
   用户给的 `ws://127.0.0.1:10086` 实测 HTTP 404 + WS 握手失败（要完整 `/devtools/...` 地址或带鉴权）。
3. 最短路径仍是：用户在其已登录浏览器点两次（AI Studio Create key / GitHub Generate token）→
   发我 `base_url + key + 模型名` → 我走 `add-free-api-pool.mjs` 验证入池（prio90/conc1）。

## 存量巡检（同夜，只读）

- tokenrouter `z-ai/glm-5.3-free`：200（5.2s）
- aio `deepseek-v4-flash`：200（1.6s）；`qwen3.8-flash`：200（2.6s）
- Pollinations `openai-fast` 双端点：200（~340ms）
- GitHub Models：410 退役 brownout；duck.ai：模型表可读（GPT-5.4 等，chat 端点待测）；poli-text 匿名可列。

## 待用户（任选其一即推进）

1. AI Studio `AIza...` / GitHub token 发我 → 5 分钟入池
2. 完整 CDP ws 地址（含 `/devtools/` 后缀）→ 我直连其浏览器拿 key
3. 手机号收 1 条硅基流动验证码
