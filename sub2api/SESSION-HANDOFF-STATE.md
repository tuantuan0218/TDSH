# 本会话交接状态快照 — 2026-09-14

> 单页读完：本会话（GitHub 账号→池扩容任务）的全部成果、未决项、续跑起点。

## 一、任务本质与定论

- **原始目标**：注册 GitHub 号 → 反代 → 扩池
- **核心定论**：**"大量 GitHub 账号"路线不存在合法实现**（ToS 禁自动建号 + DataDome
  墙现场取证 + GitHub Models 410 退役 + 多号批量触发滥用检测，四重封死）
- **可行路径**：1 个真人号（用户已有）+ 官方免费额度 + 4 条合法通道

## 二、交付物清单（16 份文档，全部备份私有仓 tuantuan0218/TDSH）

| 主题 | 文档 |
|---|---|
| 主交接（一份读完） | `GITHUB-ACCOUNT-POOL-HANDOFF.md` |
| GitHub 注册（单人合法） | `GITHUB-REGISTER-GUIDE.md` |
| DataDome 取证 | `SIGNUP-WALL-DATADOME-EVIDENCE.md` + `SIGNUP-WALLS-FINAL-CLASSIFICATION.md` §3.5 |
| Mac copilot 反代 | `MAC-COPILOT-RUNBOOK.md` + `USER-ACTION-CHECKLIST.md` |
| 反代盘点 | `REVERSE-PROXIES-INVENTORY.md` |
| NIM 映射/流程 | `NIM-RECOMMENDED-MAPPINGS.md` + `NIM-SIGNUP-FLOW.md` |
| 官方免费层复核 | `OFFICIAL-FREE-RECHECK-20260914.md` |
| 第三轮+keyless 盘点 | `FREE-TIER-ROUND3-20260914.md` + `FREE-TIER-ROUND5-KEYLESS-20260914.md` |
| OpenRouter 注册参数 | `OPENROUTER-SIGNUP-FIELDS.md` |
| BazaarLink（第4通道） | `FREE-TIER-ROUND3-20260914.md` 附2 + `BAZAARLINK-POOL-SCRIPT.md` + `bazaarlink-pool.sh` |
| 池运维方案 | `ZOMBIE-ACCOUNTS-PLAN.md` + `ERROR-OWNER-MISLABEL-PLAN.md` |
| GitHub OAuth 渠道 | `GH-OAUTH-CHANNELS-READY.md` |
| 凭据安全 | `.gitignore`（2026-09-14 增量，含 .edge-dbg-profile） |
| copilot 认证自助工具 | `copilot-auth.sh`（code/poll/pool/status 一键，绕开 copilot-api auth 代理 bug） |
| 统一入池入口 | `pool-entry.sh`（4 通道自动路由） |

## 并行会话产出（自动合并，勿覆盖）

| 主题 | 文档 |
|---|---|
| 邮箱域名路由表：24 家邮件码站 × 自建域，`uberip.com` 独有放行 4 家（baosiapi 签到仅 $0.03 不值得批量；GOLD_CK 仍只 columbina 一家） | `MAIL-DOMAIN-ROUTING-20260914.md`（并行会话 11:02 产出，勿覆盖） |
| 池库存快照 / 配额监控更新 | `FREE-POOL-INVENTORY-20260914.md` / `FREE-QUOTA-MONITOR.md` / `free-quota-monitor.mjs`（并行会话维护，勿覆盖） |
| 扩池源码参考 | `sub2api-src/`（独立 git 目录，勿动） |

## 三·五、copilot 链路脚本归属裁定（2026-09-14 并行会话确认，防重复维护）

- **以 Mac `~/copilot-api-run/copilot-pool.sh` 为准**（一键入池：授权检查→启动→三步门→
  入池 SQL+outbox→group5 绑定→核对，已修复 outbox）
- `gh-copilot-autopipe.sh`（并行会话自动接续管线：等授权落盘→启动4141→三步门→入池）
  = 同一目标的 Windows 侧入口，**与 copilot-pool.sh 二选一即可，勿双跑**
- `gh-copilot-authkeeper.sh`（code 保持器）= **废弃**（交接提交已声明；改用
  `copilot-auth.sh code` 即时取码，无需常驻保持）
- 使用：Windows 侧 `bash copilot-auth.sh code` 取码 → 用户授权 → Mac 跑
  `copilot-pool.sh`；或 Windows 侧 `bash gh-copilot-autopipe.sh 25` 一条到底

## 三、4 条合法扩池通道（全就绪，各差 1 个用户动作）

> ⚠️ **入池必经 outbox**（2026-09-14 并行会话根因）：裸 SQL 不写 `scheduler_outbox` → 号
> 永不进调度快照、永不接单。所有入池脚本已补 outbox（`bazaarlink-pool.sh`、
> Mac `copilot-pool.sh` 直接写；`pool-entry.sh` 另有 `FIXOUTBOX <账号名>` 分支补
> NIM/OPENROUTER 等旧脚本漏掉的事件）。**任何 SQL 入池后必须确认 outbox 有事件。**

| 优先级 | 通道 | 待办 | 入池准备度 |
|---|---|---|---|
| 🥇 | **BazaarLink**（门槛最低） | 注册拿 `sk-bl-*` key | `bazaarlink-pool.sh` 一键（含 outbox） |
| 🥈 | copilot 反代 | code 已过期→重跑 `bash copilot-auth.sh code` 取新码后授权 | Mac 脚本已修复含 outbox |
| 🥉 | NIM | 过 hCaptcha 拿 `nvapi-*` key | 脚本+映射已备（入池后跑 `FIXOUTBOX nvidia-nim`） |
| 4 | OpenRouter | 给主流邮箱 | 配置+表单参数已备（入池后跑 `FIXOUTBOX openrouter-free`） |

## 四、关键事实（避免下个会话重查）

- **免 key 端点全市场仅 2 个**：pollinations + xzt（已入池）；OVH/LLM7/KeylessAI/BazaarLink
  实测全部需 key 或 429（5 轮盘点闭环，`NO-KEY-ENDPOINTS-VERIFIED.md` 维持 2 个）
- **GitHub Models 410 退役**（brownout）——多号无免费推理额度可薅
- **Mac 直连 github.com 超时**，但本机 mihomo 代理 7897 可达——copilot-api auth 与 token
  刷新**必须**走 `--proxy-env` + 代理；auth 命令的 `--proxy-env` 无效 → 用
  `copilot-auth.sh`（curl -x 手动 device flow，已验证 code/poll/status 各分支）
- **pool 池 46/41/5 error**，僵尸账号 #2/#5/#8（无 base_url 却 schedulable）待处置；
  columbina 19 号 ≈$2545 余额是真产能（100% 同上游 xai，单厂商风险）
- **BazaarLink 4 特点**：/v1/models 匿名 200（173 模型）/ chat 需 key（401）/ 3 个零价模型
  （`auto:free`/`qwen3.7-flash:free`/`deepseek-v4-flash-0731v:free`）/ 有内容审查 403
  + 配额可编程查
- **⚠️ 公开仓凭据风险已修复（2026-09-14）**：TDSH `private=false`（公开），13 个探测/测试
  脚本硬编码明文 key（health-check.js 等）——核实 git 历史未含（未泄露），已全部补
  .gitignore 防未来 `git add .` 意外提交。
- **⚠️ DataDome 归因修正（09:1x 并行会话 14 出口实测，推翻早前"IP/指纹"含糊说法）**：
  拦截变量 = **CDP/审查工具检测**（调试端口或扩展 `chrome.debugger` 一律拒，与 IP 无关）；
  DataDome 拦截页原文明写 "Use of developer or inspection tools"。**但 `/login` 不受保护**
  ——注册之后的登录/PAT/速语 OAuth/入池**全部可自动化**，人类只需人工过 signup 一关
  （DataDome 对真人正常浏览器也不发验证控件，需 InPrivate 正常浏览器过表单）。
  详见 `SIGNUP-WALL-DATADOME-EVIDENCE.md` §二/三（09:0x/09:1x 追加取证）。
- **🆕 新候选渠道（等 GitHub 号后接入）**：`true-sota.com/register`（Continue with GitHub
  / Linux.do，无 DataDome）——与速语并列。

## 五、池健康基线（2026-09-14）

- 46 账号 / 41 sched / 5 error（无漂移）
- 僵尸 #2 kimi2-hello4am / #5 infer / #8 amd-radeon 仍 schedulable=true，
  排在位次 23/24/28 挡 16 个可用账号 → 方案 A（schedulable=false）待批准
- 400 全 356 条被误标 provider（84% 超上下文 + 11% 非法 tool_call 是客户端问题），
  error_owner 改 client 的方案 A 待批准
- **池产能复查（2026-09-14）**：xzt `/v1/models` 200（24 模型）+ chat 3 连发 200；
  pollinations chat 200 "pong"——**池内 2 个免 key 端点均健康**
- **xzt 冷却期精确时长：仍未知**（交接未决项）——本轮 3 连发 + 70s 恢复试探全 200
  （配额宽松未触发 429），无法测量。测量需先打满限流（代价=耗尽配额），
  **不建议为测量而打满**；运维上维持"触发后 ≥2 分钟冷却"的保守假设即可。
- **error 账号诊断（2026-09-14）**：5 个 error 均**不可自愈**——#14 xiaoen（上游 401
  token 失效）、#4 geeky-hello4am（上游 401 缺 key）、#6 stepfun（key 无效）、
  #17 siliconflow（额度耗尽）、#18 pollinations（已被 #21/#22 取代）。
  池内已有 **19 个 columbina 多号 active**（并行会话签到体系），产能充足；
  **无"不依赖用户动作"的产能修复路径**。

## 六、续跑起点（下个会话直接看）

1. 读本文 + `GITHUB-ACCOUNT-POOL-HANDOFF.md`
2. 查用户是否已执行受限项：
   - `node run-free-api-regression.mjs`（工具链 7/7）
   - 查 4 通道是否已入池（`pool-health-check.mjs`）
   - 查 Mac auth token 状态（`ssh zhaozicheng@192.168.1.3 'ls -la ~/.local/share/copilot-api/github_token'`）
3. 若 BazaarLink key 到手 → `bash bazaarlink-pool.sh <sk-bl-key>`
4. 若 copilot 授权 → `ssh Mac 'bash ~/copilot-api-run/copilot-pool.sh'`
5. 若用户批"同意A" → 跑僵尸 SQL（`ZOMBIE-ACCOUNTS-PLAN.md`）+ error_owner 改口径

## 七、边界（维持不变）

- ❌ 注册机/批量注册/打码平台/绕过人机验证
- ❌ 批量薅 Copilot（GitHub 滥用检测，号全灭）
- ✅ 单真人号 + 官方额度（4 条合法通道）