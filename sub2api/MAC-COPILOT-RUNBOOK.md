# Mac 端 copilot-api 反代落地操作包 — 2026-09-14

> 链路：**GitHub 号（单人注册）→ GitHub Copilot（官方免费档/订阅）→ Mac copilot-api 反代
> → OpenAI 兼容端点 → sub2api 池**。
> 本操作包基于 Mac 实测环境（zhaozicheng@192.168.1.3, Darwin 23.6 x86_64）与源码阅读编写。

---

## 0. 边界与风险（先读）

- ✅ **单账号合规**：自己注册 1 个 GitHub 号 → 官方 Copilot 授权 → 反代接入，属
  copilot-api 项目 README 设计的正规用法。
- ❌ **批量/注册机路线否决**：GitHub ToS 禁自动化建号；copilot-api README 明确警告
  **"Excessive automated or scripted use of Copilot (rapid/bulk requests) may trigger
  GitHub's abuse-detection systems"** —— 批量注册多号薅 Copilot 额度 = 号全灭 + 可能
  触发 GitHub 安全警告，收益为负。
- ⚠️ 反代是**逆向工程代理**，非官方 API，可能随时失效；入池一律 prio 90 /
  concurrency 1 / group 5 兜底位，不升权。

---

## 1. 前置：GitHub 号（用户操作，5 分钟）

按 `GITHUB-REGISTER-GUIDE.md`（论坛实战法）：
- **Gmail** 邮箱 + Chrome 无痕 + 纯净 IP（有 FastLink/机场即可）
- 人机验证优先选 **Audio puzzle（声音验证）**
- 密码 ≥15 字符；注册后开 2FA

## 2. 前置：开启 Copilot（用户操作，1 分钟）

GitHub 登录 → https://github.com/settings/copilot → 选择 **Free 档**（或已有订阅）
→ 启用。免费档有每月额度（几百次 chat 级别），够兜底用。

## 3. Mac 端部署（已实测可拉包）

环境事实（2026-09-14 实测）：
- node v24.13.0 / npm 11.6.2 在 `/usr/local/bin`（非交互 PATH 不含此目录，需显式 export）
- bun 缺失 → **无需装**，copilot-api bin 是编译产物 `dist/main.js`（纯 ESM JS），node 直跑
- `npx -y copilot-api@latest --help` 已验证可达（registry.npmjs.org 直连 OK）
- 网关 8092 在 Mac 上运行中（Python 进程）——反代完成后经 8092 网关入池

### 3.1 认证（一次性，需用户浏览器授权）

> ⚠️ **网络前提（2026-09-14 实测修正）**：Mac **直连 github.com 超时**（Connect Timeout
> 10s，curl 000），但本机 **mihomo 代理 127.0.0.1:7897 可达**（实测 github 200）。
> auth **必须走代理**，且**授权成功后 token 刷新（refresh_in 周期）同样走 GitHub——
> 启动反代也必须 `--proxy-env` + 代理环境变量**，否则反代跑一会 token 刷新超时即失效。
> `~/copilot-api-run/start-copilot.sh` 已是代理版（内置 export + --proxy-env）。

```bash
export PATH="/usr/local/bin:$PATH"
export HTTP_PROXY="http://127.0.0.1:7897"
export HTTPS_PROXY="http://127.0.0.1:7897"
npx -y copilot-api@latest auth --proxy-env
# 输出: Please enter the code "XXXX-XXXX" in https://github.com/login/device
```
→ 用户浏览器（已登录 GitHub 的任意设备）打开 https://github.com/login/device → 输入
user_code → 授权 → 终端显示 `Logged in as <用户名>` → token 持久化在
`~/.local/share/copilot-api/`（容器内对应 /root/.local/share/copilot-api）。

### 3.2 启动反代（长驻进程）

```bash
export PATH="/usr/local/bin:$PATH"
mkdir -p ~/copilot-api-run && cd ~/copilot-api-run
nohup npx -y copilot-api@latest start --port 4141 \
  --rate-limit 5 --wait --proxy-env > ~/copilot-api-run/copilot-api.log 2>&1 &
# --rate-limit 5 --wait: 请求间隔 5s、超限排队而非报错 —— 防止触发 GitHub 滥用检测
# --proxy-env + HTTP(S)_PROXY: token 刷新需访问 GitHub，Mac 直连超时必须走 mihomo 7897
# 便捷方式: ~/copilot-api-run/start-copilot.sh start（已内置代理参数，幂等）
```
- 端点：`http://127.0.0.1:4141/v1`（OpenAI 兼容：/v1/models, /v1/chat/completions,
  /v1/embeddings；另有 /v1/messages Anthropic 兼容 + /usage 用量面板）
- 状态自查：`curl -s http://127.0.0.1:4141/usage | head`；`npx -y copilot-api@latest check-usage`

## 4. 验证（三步门，照搬 probe-keyless 纪律）

> ⚠️ **模型名不可写死**（2026-09-14 源码确认）：反代的模型列表**启动时从
> Copilot API 动态拉取**（`getModels()`，无硬编码），chat 按请求体 `model` 字段
> **精确匹配**（大小写敏感，`/v1/models` 返回的 `id`）。入池映射必须用实测 id。
> 已查源码 `create-chat-completions.ts`：请求体 `model` 字段**原样直传 Copilot
> （无归一化映射）**→ `/v1/models` 实测 id 即入池 id，二者必定一致。

1. `curl -s http://127.0.0.1:4141/v1/models` → 200 列出模型，**记录真实 id**
   （格式示例：`gpt-4o` / `gpt-5-codex` / `claude-*` 之类，以返回为准）
2. 直连 chat 单发（用上一步实测的 id 替换 `MODEL_ID`）：
   `curl -s http://127.0.0.1:4141/v1/chat/completions -H
   "Content-Type: application/json" -d '{"model":"MODEL_ID","messages":[{"role":"user",
   "content":"ping"}]}'` → 200 有内容
3. 知识门：问 17×23 → 答 391（防假服务）

## 5. 入池（衔接 sub2api）

参照 `mac-add-siliconflow.sh`（Windows→WSL→SSH→Mac PG 直改，幂等）：

```bash
# 在 Mac 上（或经 ssh 执行）；MODEL_ID = 第 4 步 /v1/models 实测的真实 id
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api <<SQL
INSERT INTO accounts (name, platform, type, credentials, extra, status, schedulable, priority, concurrency, rate_multiplier, quota_dimension, auto_pause_on_expired)
SELECT 'copilot-free','openai','apikey',
  jsonb_build_object('api_key','copilot-local','base_url','http://127.0.0.1:4141/v1','model_mapping', jsonb_build_object('Tuan','MODEL_ID')),
  jsonb_build_object('model_mapping', jsonb_build_object('Tuan','MODEL_ID'),'openai_responses_mode','force_chat_completions','openai_responses_supported',false,'openai_long_context_billing_enabled',false),
  'active', true, 46, 3, 1.0, 'global', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name='copilot-free' AND deleted_at IS NULL)
RETURNING id, name, status, schedulable, priority;
SQL
```
→ 绑定 group 5 + 只读核对 usage_logs 路由（同 siliconflow 模板）。

## 6. 待办分工

| 步骤 | 谁 | 状态 |
|---|---|---|
| 注册 GitHub 号（Gmail 法） | 用户 | ⏳ 待做（指南已交付） |
| 开 Copilot Free | 用户 | ⏳ 待做 |
| Mac auth（device flow 输入 code） | 用户浏览器 | ⏳ 待做（code 由我贴出） |
| 启动反代 4141 + 验证 | 我（可自主） | 待认证完成后 |
| 入池 SQL + usage 核对 | 我（可自主） | 待启动验证后 |

> 全部就绪后：一条命令或一次 ssh 即可完成 启动→验证→入池 闭环。