# GitHub OAuth 渠道待接清单（只读探测版）— 2026-09-14

> 前置：先用 `GITHUB-REGISTER-GUIDE.md` 让用户注册 1 个 GitHub 号（Gmail+声音验证）。
> 本清单是**只读网络探测**结论，未驱动任何浏览器、未入池、未产生 key。

---

## 一、渠道状态总表（按可用性排序）

| 渠道 | 域名 | 探测结果 | GitHub OAuth 形态 | 判定 |
|---|---|---|---|---|
| **速语公益站** | `free.suyu.io`（CF 托管） | ✅ 首页 200，标题"速语API-公益站 - 免费的GPT-5.5、Claude、DeepSeek和Gemini API服务"；`/v1/models` 匿名 200，模型含 **gpt-5.5 / gpt-5.4-mini / claude / deepseek / gemini 系** | 主页含"使用 GitHub 登录"按钮（此前 `wb-suyu-gh.cjs` 已写点击逻辑，本地可见该文案） | ✅ **GitHub 号到位即接**（登录→生成 key→add-free-api-pool.mjs） |
| **A6API** | `a6api.com`（nginx，无 CF） | ✅ 首页 200，标题 A6API | 站点含 GitHub 登录入口（`wb-a6api-gh.cjs` 曾定位 GitHub 按钮）；另支持邮箱发码 | ⭐ 次优候选，可邮箱直注也可以 GitHub |
| **hub.linux.do** | `hub.linux.do`（CF 托管） | ✅ 首页 200（SPA Loading...）；`/v1/models` **401 Invalid API key** | **Linux.do Connect** 登录（GitHub 账号是 L 站注册方式之一，另需 L 站邀请码/等级） | ⏸ 需 linux.do 账号，本轮不动 |
| **辉哥公益站** | `lzhiyu.ccwu.cc` | ❌ **两次 TLS 断连**（Client network socket disconnected before secure TLS） | 原为注册控制台生成密钥 | ❌ 疑似已挂/换域，**不接**（每周可复查） |

---

## 二、重点：速语渠道详情（首选）

- 平台性质：免费公益站（`github.com/suyu-ai/chatGPT-apiKey` 是其上游仓库）
- API 兼容：OpenAI 兼容 `/v1`，`/v1/models` 匿名可列（gpt-5.5 / gpt-5.4-mini 等）
- 登录方式：**GitHub OAuth 一键登录**（主页按钮文案"使用 GitHub 登录"）
- 入池路径（GitHub 号就绪后）：
  1. 浏览器打开 free.suyu.io → 点"使用 GitHub 登录"→ GitHub 授权
  2. 站内生成 API key
  3. `$env:SF_NAME="suyu-free"; $env:SF_BASE="https://free.suyu.io/v1"; $env:SF_KEY="<key>"; $env:SF_MODELS='{"Tuan":"gpt-5.5"}' ; node add-free-api-pool.mjs`
  4. SSH→Mac PG 核对 usage_logs 路由成功（参照 mac-add-siliconflow.sh 模板）
- ⚠️ 注意：免费公益站额度/稳定性以站方为准，入池一律 prio 90 / concurrency 1 / group 5 兜底位

---

## 三、A6API 渠道详情（次优）

- 平台性质：聚合中转站（New API 系，nginx 直连无 CF）
- 登录：支持邮箱验证码 + GitHub（此前 `wb-a6api-gh.cjs` 走 GitHub 按钮分支）
- 判定：GitHub 号注册后同样可试；若 GitHub 跳转不顺，邮箱直注亦可

---

## 四、状态账

- 探测为**只读**：无浏览器驱动、无账号创建、无 key、无池改动
- 已产出：本清单 + `GITHUB-REGISTER-GUIDE.md`（注册方法）
- 待用户：① 按指南注册 GitHub 号 → ② 告诉我 → ③ 我跑速语登录+key+入池
- 待复查：辉哥渠道（下次会话可重新探测域名是否恢复）