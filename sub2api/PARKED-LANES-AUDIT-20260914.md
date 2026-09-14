# 停放站号只读审计 + A6API 死路确认 — 2026-09-14

> 触发：GitHub 注册目标完成后，MCTS 选路到"把已有 A6API 账号变成真实渠道（免浏览器 REST 直连）"。
> 结论：**A6API 这条路是死的**，但过程中把 15 个停放号一次筛清，**省掉后面所有会话重复试错**。
> 本文件独立成文，避免与并行 agent 抢改 `FREE-API-SITES-20260913.md`。
> 审计脚本：`gh-parked-audit.mjs`（**零写入**：不建令牌、不领签到、不动池、不写 store）。

## 一、A6API（a6api.com）：确认死路，别再试

| 事实 | 证据 |
|---|---|
| 后台不是 `/api/session` 路由 | `POST /api/session` → `404 Invalid URL (POST /api/session)`，登录实为 `/api/user/login`（200） |
| 仓存凭据无效 | `.wb-a6-cred.txt` 的 `tuanpoolgwsxp/…` 登录返回 `Username or password is incorrect, or user has been banned` |
| 该号很可能当年就没建成 | `FREE-API-SITES-20260913.md:271` 已把 `a6api.com` 判为 `closed`；`/api/status` 有 `email_verification=true` 但**不发 `register_enabled` 键**（该 fork 的特征，正是当初探测器漏采它的原因） |
| 未进池 | `gh-lane-query.sh` 查 `name LIKE '%a6%'/'%suyu%'/'%copilot%'` → **0 行**（池 active_total=41，prio≥90=0） |

⇒ 处置：A6API 从待接清单划掉；若日后 `register_enabled` 变开放，由 `free-quota-monitor.mjs --screen` 的 `🔄` 自动捕，不需要人记。

## 二、15 个停放号（有用户名密码但未入池）的真实状态

| 站点 | 结论 | 备注 |
|---|---|---|
| **newapi.columbina.eu.org（母号）** | ✅ **$155.21 未用**，tokens=2，今日已签（累计 2） | 唯一"有闲置余额但未入池"的号；19 个子号 `columbina-free-1..19` 已在池 |
| **baosiapi.com** | ⚠️ $0.09（used $0.03），tokens=1，签到已开（今日 1 次） | 额度太小，直接入池会秒 402；可作"每日签到养号"观察对象 |
| easymax.ai / tian-shu.org | ❌ $0，tokens=0 | 与昨日 `gold_nocheckin` 判定一致 |
| api.tmlab.store / tokenra.io / newapi.pollyai.net | ❌ $0 | 印证 `FREE-API-SITES` 第五轮"注册赠送 $0"结论（uid 2203 / 52097 / 568） |
| api.justwoker.icu | 🔒 登录要 **Turnstile token** | 非人机不可，自动化止步 |
| ai.furry.vg | 🔒 登录要 **hCaptcha** | 同上 |
| api.tu-zi.com | 🔒 登录要**滑动验证** | 同上 |
| crowllm.com / emtf.aipm9527.online / ai.mrcwoods.com / beizhi.sylu.cc / sudobug.top | ❌ **凭据本身无效**（`Username or password is incorrect, or user has been banned`） | 这些是"邮箱白名单拒了但 store 留了尝试凭据"的**假号**——别再去登 |

### 我在这轮自己踩并修正的一个测量坑（值得记）
第一版审计把 `api.tmlab.store / tokenra.io / baosiapi.com / newapi.pollyai.net` 误判为 `LOGIN_FAIL`：
这些**老版 fork 登录只回 session cookie、不给 `access_token`**，而我只认 `access_token`。
本仓 `FREE-API-SITES-20260913.md` §开户三件套第 3 条早就写了这个坑（必须带 cookie + `New-Api-User` 头）。
修正回退后，4 家里 baosiapi 立刻显出真实余额。**教训：负结论前先怀疑自己的鉴权路径，别急着给站判死。**

## 三、对"下一条免费渠道"的净判断

- 免浏览器 REST 直连这条路**技术上完全通**（登录/读余额/令牌都能纯 HTTP 做），
  比抢用共享 Chrome tab 干净得多（并行 agent 正在 `D:/tdsh/forum_leads_20260913` 活跃写文件）。
- 但**新增免费渠道的瓶颈不在方法，在钥匙**：
  1. 能收码的**常规邮箱**（解 10 家 `email_code_ck` + 12 家 `email_code`）；
  2. 或 **GitHub / L 站登录态**（解 8 家 `oauth_only` + 速语/TrueSOTA）。
  GitHub 注册又只能真人过 DataDome（见 `SIGNUP-WALL-DATADOME-EVIDENCE.md` §三）。
- ⇒ 今天真正可自主兑现的只剩一件：**columbina 母号 $155 闲置余额**（以及 baosiapi 的养号）。
  是否把它作为 `columbina-free-base` 以兜底位入池 = **池写操作**，且该目录有并行 agent 在动，
  故本轮**不擅自写池**，列为待用户点头项。

## 四、受限项待办（需用户点头）

| 项 | 动作 | 我能立刻做的 |
|---|---|---|
| columbina 母号 $155 入池 | 以 `columbina-free-base` prio 90 / conc 1 / group 5 兜底位插入 | 已备好只读证据与令牌计数，一句确认即可执行 |
| baosiapi 养号 | 每日签到累计到可用阈值再入池 | 已进观察名单（`gh-parked-audit.mjs` 可重跑） |
| GitHub 注册 | 真人 InPrivate 走一遍（资料已备好） | 注册完成后登录/建 PAT/OAuth/入池全我接手 |
