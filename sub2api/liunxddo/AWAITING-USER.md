# 受限项清单（需用户点头/注册）

> 收集与部署就绪已完成，以下动作需要用户注册账号/提供 key 后才能执行。
> 按 AGENTS §6：受限项一律登记为待办，不擅自执行。

## 1. 注册领取 key（拿到即可一键入池，命令见 DEPLOY-RUNBOOK.md）

| # | 渠道 | 用户动作 | 入池命令（key 到手后） |
|---|------|---------|----------------------|
| 1 | hub.linux.do | linux.do 账号 → Connect 登录 hub.linux.do → 创建 API key | `$env:SF_NAME=...; node add-free-api-pool.mjs` |
| 2 | NVIDIA NIM | build.nvidia.com 免费注册 → Get API Key (nvapi-) | `node liunxddo\add-nvidia-nim-pool.mjs` |
| 3 | **FreeModel.dev** | ✅ key 已给且**有效**（`Insufficient balance`=鉴权过但余额 0）→ **登录 freemodel.dev 完成邮箱/手机验证**（FAQ：验证后发免费 credits）或找兑换码（/api/redeem）→ 余额 >0 后复测 | `node add-free-api-pool.mjs`（见 RUNBOOK §3，OpenAI 面 `api.` / Anthropic 面 `cc.`） |
| 4 | ModelScope | modelscope.cn 注册 → 创建 token | `node add-free-api-pool.mjs` |
| 5 | 火山方舟 / 七牛 | volcengine / qiniu 注册领取免费额度 | 同上模板 |
| 6 | DeepLX 翻译 | connect.linux.do 领取 DeepLX Api Key | 翻译类另行评估 |

## 2. CF Worker 免费绘图部署（代码+文档已就绪）

- 文件：`liunxddo/cf-worker-drawing.js`（已验证语法完整）+ `CF-WORKER-DRAWING-DEPLOY.md`
- 用户动作：注册 cloudflare.com → Workers & Pages 粘贴代码 → 部署
- 部署后验证 4 条 curl 命令见文档第四节；入池命令见第六节

## 3. 已自主完成（无需用户）

- ✅ linux.do 6 帖原文采集（topic-*.txt）
- ✅ 收集清单 `LINUXDO-PUBLIC-API-COLLECTION.md`
- ✅ 部署 runbook `DEPLOY-RUNBOOK.md`
- ✅ NIM 入池脚本 `add-nvidia-nim-pool.mjs`
- ✅ CF Worker 部署包 `cf-worker-drawing.js` + 部署文档
- ✅ 实测：NIM /models 匿名 200（82 模型）、oaipro/WONG 活、7xnn 死、
  DeepLX 需 connect key、hub 无匿名通道、一言/60s keyless 可用
- ✅ GitHub TDSH 私有仓备份 3 次 push（1f610e1 / 4a4741c / 9e59b8b）
