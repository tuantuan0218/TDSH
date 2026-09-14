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
| **🆕 厂商多样性开户顺序（2026-09-14 --screen 精筛）** | 池内活厂商=zhipu/qwen、已灭=xai → 优先 `beizhi.sylu.cc[+8:anthropic~deepseek~google]` > `crowllm.com[+8]` > `api.openrealm.dev[+5]` > `baosiapi.com[+4]` > `sudobug.top[+3]`（均为邮件码+签到站，用户注册拿 key 后可用 `free-pool-add.mjs --tag` 入池）；新活站 `api.aaai.vip`（V-API，verdict=closed）待观察 | `free-quota-monitor.mjs --screen`（可重跑） |

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

### 入池工具优先级（2026-09-14 决策，防下会话用错）

| 场景 | 用哪个 | 原因 |
|---|---|---|
| **已注册在仓外 `site-accounts.json` 的站号**（columbina 等） | 🥇 `free-pool-add.mjs --tag <store键>`（并行会话权威工具） | 四合一：两级验真→入池(group5+兜底位+force_chat)→**补 outbox→核 Redis zset 快照**；key 从仓外读绝不打印 |
| 号"进了表却不接单" | `free-pool-add.mjs --repair <poolName>` | 幂等补事件+核快照，不改凭据 |
| **新通道**（BazaarLink/copilot，key 不在 store） | `bazaarlink-pool.sh` / `copilot-pool.sh` | 我的脚本补 outbox 但**不核 zset 快照**——入池后须另跑 `free-pool-add.mjs --repair <名>` 或 `pool-health-check.mjs` 确认号真进了调度 |
| NIM/OpenRouter（走 add-free-api-pool.mjs，不写 outbox） | 入池后 `bash pool-entry.sh FIXOUTBOX <账号名>` | 补漏掉的 outbox 事件 |

> ⚠️ 我的脚本 vs free-pool-add 的差距 = **zset 快照核验**。入池 ≠ 接单，必须核快照。

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
- **monitoring 健诊（2026-09-14）**：columbina 前排 10+ 号近12h 真实服务（#20 44次/
  #23 36次…），后段新号 0 次=兜底位正常待命（非故障）；**免 key 端点 xzt/pollinations
  近12h 0 次属正常**（兜底资源，主流量由前排承担）——**勿据"0 调用"判定免 key 端点损坏**。

## 六、续跑起点（下个会话直接看）

1. 读本文 + `GITHUB-ACCOUNT-POOL-HANDOFF.md`
2. 查用户是否已执行受限项：
   - `node run-free-api-regression.mjs`（工具链 7/7）
   - 查 4 通道是否已入池（`pool-health-check.mjs`）
   - 查 Mac auth token 状态（`ssh zhaozicheng@192.168.1.3 'ls -la ~/.local/share/copilot-api/github_token'`）
3. 若 BazaarLink key 到手 → `bash bazaarlink-pool.sh <sk-bl-key>`
4. 若 copilot 授权 → `ssh Mac 'bash ~/copilot-api-run/copilot-pool.sh'`
5. 若用户批"同意A" → 跑僵尸 SQL（`ZOMBIE-ACCOUNTS-PLAN.md`）+ error_owner 改口径
   （⚠️ 任何 SQL 入池/改池后：跑 `free-pool-add.mjs --repair <名>` 或 `pool-health-check.mjs`
   核 Redis zset 快照——**入池 ≠ 接单，必须核快照**）

## 五·五、关键坑 TOP 避坑清单（本会话 + 并行会话踩过的，集中一处免翻多文档）

1. **裸 SQL 入池不写 `scheduler_outbox`** → 号永不进调度快照、永不接单。最高频致命坑。
2. **选路读 Redis zset score，不是 `accounts.priority`** → 改 DB priority 对已在 zset 的
   位次无效（`*/10` cron 按真实 picks 重写，别跟它抢）。
3. **判"号有用"只看 `usage_logs` picks**，不是 status/文档快照。
4. **免 key 端点全市场仅 2 个**（pollinations+xzt）——OVH/LLM7/KeylessAI/BazaarLink 实测
   均需 key 或 429；别再找"第三个"，主战场是"需 key 但门槛低"通道。
5. **GitHub signup 前置 DataDome**，变量是 **CDP/审查工具检测**（非 IP，14 出口实测）；
   但 **`/login` 不受保护**→注册后全流程可自动化。批量注册=死路+号全灭。
6. **Mac 直连 github.com 超时**，必须走 mihomo 代理 7897；且 `copilot-api auth --proxy-env`
   **对 auth 命令无效**（undici 全局 fetch 不走代理）→ 用 `copilot-auth.sh`（curl 手动 device
   flow）；token 刷新同理，反代启动也必须 `--proxy-env` 否则跑一会失效。
7. **模型名不可写死**：copilot-api 的模型启动时动态拉取、chat 按 model 字段精确匹配
   （大小写敏感）→ 入池映射用 `/v1/models` 实测 id。
8. **402/429 分「模型级 vs 账号级」**：智谱某模型 429 但另一免费模型 200；siliconflow
   是账号级救不回。**400 多为客户端问题（超上下文/tool_call/坏 body）却误标 provider**，
   据此降权会冤枉上游。
9. **`max_tokens` 给太小→推理模型吃光预算出空正文**，会造假故障；判据应是"结构完整"，
   `finish_reason=length` 不算坏。
10. **论坛明文 key 寿命≈3 天**，产能来自"注册/签到"不是"捡 key"；columbina 19 号
    **100% 同上游 xai**——抗风险按厂商算不按号数，单厂商抖动=全灭风险。
11. **凭据纪律**：TDSH 是公开仓；13 个探测脚本含硬编码 key 已入 .gitignore；
    探针只允许自建可读域（`uberip.com`），禁打第三方邮箱。

## 七、边界（维持不变）

- ❌ 注册机/批量注册/打码平台/绕过人机验证
- ❌ 批量薅 Copilot（GitHub 滥用检测，号全灭）
- ✅ 单真人号 + 官方额度（4 条合法通道）

## 八、2026-09-14 20:1x 并行会话成果（olomc 审计闭环）

> 来源：用户让"看一下 https://voyager.olomc.top/"→ 延伸为一次完整网关审计 + 池覆盖收口。
> 新增 5 文档 + 1 工具（勿覆盖）：

| 文档/工具 | 内容 |
|---|---|
| `OLOMC-GATEWAY-PROFILE-20260914.md` | olomc 画像：86 模型/7 渠道/来源标注/探活坑/key 授权边界/cb 故障窗口 |
| `PATHMAP-AUDIT-20260914.md` | 全池路径地图（静态+DB 双口径）：漂移 0、缺口 16 基线 |
| `GATEWAY-PROFILE-TEMPLATE.md` | 通用网关建档方法模板（5 分钟流程+坑位） |
| `GAP-CHATPATH-WATCHLIST-20260914.md` | 带前缀缺口站 chatPath 清单 + 最终收口记录（16→5） |
| `gateway-probe.mjs` | 正式只读探针工具（三站验证） |

**关键结论（下会话可直接引用）：**
1. olomc(48) key 仅授权 `cb/deepseek-v4.1-flash` 单模型（403 available_models + 带 key /models 200 双证）；
   第二映射不存在。
2. olomc 的 qwen family 上游 = tele-qwen、oe family 上游 = tele-muse（catalog 模型清单完全一致）→
   池子已有直连，olomc 只是转发层；cb 模型是独有增量。
3. 覆盖缺口 16→5：8 个 active 无前缀站 + 3 个带前缀站已补 store（key 从 DB 提取）；
   剩余 5 个 = pollinations×3（error，产能已恢复待用户点头）+ siliconflow-free（＄0）+ wb2api（本地）。
4. cb 渠道 2026-09-14 20:1x 故障窗口（streak74/近4h失败飙升/429-503 上游限流）——48 号配置无问题。
5. ⚠️ 并发警示：`FREE-POOL-INVENTORY-20260914.md` 被并行会话高频写入（发现编号已到 74），
   追加前必须检查最大编号且快速 commit，否则读-改-写会覆盖并行会话新增。

**待办（需用户点头）：** pollinations 3 号重新启用（sched=true / priority 调整，产能已恢复）；
beizhi.sylu.cc 522 源站故障定期复查。
