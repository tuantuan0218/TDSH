# GitHub 账号与池扩容交接 — 2026-09-14（本会话全成果汇总）

> **一份读完所有结论。** 供下个会话/用户本人续跑；每个主题指向证据文档。
> 权威状态文件：本文 + 下述各专题文档。

---

## 一、一句话总结

**"注册机/大量 GitHub 账号"路线已封死（三重否决 + 现场取证）；合法扩池主线 = 你已有号走
copilot 反代 + U8（NIM）+ U9（OpenRouter），全部只差你一个动作。**

---

## 二、注册机/批量账号路线：最终否决（含取证）

| 否决理由 | 证据 |
|---|---|
| GitHub ToS 明文禁止自动化建号/一人多免费号 | 平台条款（无需取证，属已知事实） |
| **DataDome 墙现场取证**：CDP 真实浏览器打开 github.com/signup，页面嵌入 `geo.captcha-delivery.com` + `ct.captcha-delivery.com/c.js`，验证不过表单不渲染（inputs=0/forms=0/bodyLen=0）——自动化连填表机会都没有 | `SIGNUP-WALL-DATADOME-EVIDENCE.md`（已并入 `SIGNUP-WALLS-FINAL-CLASSIFICATION.md` §3.5） |
| GitHub Models 已 410 退役（brownout），多号无可薅额度 | `OFFICIAL-FREE-RECHECK-20260914.md` §1.3 |
| copilot-api README 原文警告多号批量触发 GitHub 滥用检测（temporary suspension） | `MAC-COPILOT-RUNBOOK.md` §0 |

**结论：大量 GitHub 账号没有合法实现。** 但池子扩容有合法主线（见下）。

## 三、合法扩池主线（按优先级）

### ⭐1. 你已有 GitHub 号 → copilot 反代（就差你输 code）

- 状态：Mac（192.168.1.3）上 copilot-api auth 进程**存活等待中**，
  **device code：`37FA-7F20`** → 浏览器打开 **https://github.com/login/device** 输入即授权
- ⚠️ **网络前提（2026-09-14 实测）**：Mac 直连 github.com 超时，**必须走本机 mihomo
  代理 127.0.0.1:7897**（auth 与 token 刷新都要）；`start-copilot.sh` 已是代理版
- 授权后自动完成：启动反代 4141 → 三步门验证 → 入池（幂等 SQL）
- **预置脚本（Mac 上，授权后一键）**：
  - `~/copilot-api-run/start-copilot.sh` —— 启动反代（代理版，幂等 start/stop/status）
  - `~/copilot-api-run/copilot-pool.sh` —— **一键入池**：检查授权→启动→三步门验证→
    入池 SQL（自动取 /v1/models 首个模型做 Tuan 映射）→ 绑定 group 5 → 核对
  - 授权后执行 `bash ~/copilot-api-run/copilot-pool.sh` 即全链路闭环
- 完整操作：`MAC-COPILOT-RUNBOOK.md` + 用户侧清单 `USER-ACTION-CHECKLIST.md`
- 模型名不可写死：以启动后 `/v1/models` 实测 id 为准（源码确认动态拉取+直传无归一化）

### ⭐2. U8：NVIDIA NIM（40 RPM / 82 模型 / 无限制额度）

- 只差你过 1 次 hCaptcha：https://build.nvidia.com 免费注册 → Get API Key（nvapi-）
- 入池脚本已就绪：`liunxddo/add-nvidia-nim-pool.mjs`（key 到手即用）
- **推荐映射已生成**：`NIM-RECOMMENDED-MAPPINGS.md`（z-ai/glm-5.3-flash 首选等 23 个 chat 候选）

### ⭐3. U9：OpenRouter（445 模型 / 19 个 :free）

- 只差你给 1 个主流邮箱（qq/163）注册：https://openrouter.ai → Keys → sk-or-v1-*
- 配置已就绪：`openrouter-free-config.json`（19 个 :free 与当日直测零漂移，已核查）
- 入池：`$env:SF_NAME=...; $env:SF_KEY=...; $env:SF_MODELS='{"Tuan":"openrouter/free"}'; node add-free-api-pool.mjs`

### 4. ModelScope（每天 2000 次，待阿里云 token）

- 当日复核：`api-inference.modelscope.cn/v1/models` 200，48 模型
- 入池模板同 add-free-api-pool.mjs（SF_BASE=api-inference.modelscope.cn/v1）

## 四、官方免费层当日复核（2026-09-14 直测）

| 渠道 | 结果 | 状态 |
|---|---|---|
| NVIDIA NIM | 200，82 模型 | ✅ 零漂移 |
| OpenRouter | 200，445 模型 / 19 :free | ✅ 零漂移 |
| ModelScope | 200，48 模型 | ✅ 可达 |
| SiliconFlow | 401 Token invalid | ⚠️ 额度耗尽（与文档一致） |
| Pollinations | 200 "pong" | ✅ 无损 |

详见 `OFFICIAL-FREE-RECHECK-20260914.md`。

## 五、备选反代盘点（结论：copilot-api 唯一值得接）

`REVERSE-PROXIES-INVENTORY.md`：copilot-openai-api（同额度无增量）、cursor2api（README
自述 2026-04 起仅 gemini-3-flash 受限）、claude-code-proxy（非免费渠道）。

## 五·五、本会话其它产出（2026-09-14，按主题引用）

| 主题 | 文档 |
|---|---|
| 免费层第三轮盘点：OVH 免 key 候选三出口 429 不入池，9-13 结论维持 | `FREE-TIER-ROUND3-20260914.md` |
| 僵尸账号处置方案（#5/#2/#8，选项A：schedulable=false，待批准） | `ZOMBIE-ACCOUNTS-PLAN.md` |
| 400 错误 error_owner 误标 provider 建议（方案A：语义识别归 client，待批准） | `ERROR-OWNER-MISLABEL-PLAN.md` |
| U9 OpenRouter 注册填表参数（CDP 实测 5 字段） | `OPENROUTER-SIGNUP-FIELDS.md` |
| U8 NIM 注册流程形态（4 步引导，点 Accept All 后再点 Generate API Key） | `NIM-SIGNUP-FLOW.md` |
| 凭据/`.edge-dbg-profile` gitignore 安全加固 | `.gitignore`（2026-09-14 增量） |

## 六、注册方法指南（如果还要注册 1 个号）

`GITHUB-REGISTER-GUIDE.md`：Gmail + 声音验证 + 纯净 IP；outlook/163/qq 实测易失败。

## 七、受限项待办（需用户动作）

| 项 | 动作 | 状态 |
|---|---|---|
| **copilot 授权** | 打开 github.com/login/device 输 **`37FA-7F20`**（最新；旧码 0989-1311/D3CA-973D 已过期） | ⏳ 等待（Mac auth 进程存活） |
| U8 NIM | build.nvidia.com 过 hCaptcha 拿 key 发我 | ⏳ 待做 |
| U9 OpenRouter | 注册给邮箱拿 key 发我 | ⏳ 待做 |

## 八、下一会话快速上手

```bash
cd D:\tdsh\sub2api
node run-free-api-regression.mjs      # 工具链健康（7 项全过）
node pool-health-check.mjs            # 池只读巡检
# copilot：ssh Mac 看 ~/copilot-api-run/auth.log 确认 code；授权后
#   ~/copilot-api-run/start-copilot.sh start && 三步门验证 && 入池 SQL
```

## 九、边界声明（维持不变）

- ❌ 注册机/批量注册 GitHub：否决（三重封死，见第二节）
- ❌ 打码平台/绕过人机验证：不提供
- ❌ 批量薅 Copilot：滥用检测，号全灭
- ✅ 单账号官方额度（copilot free / NIM / OpenRouter :free）：合规可做

## 十、池健康基线（2026-09-14 巡检，扩池前快照）

- **成功率 96.61%**（12h：成功 10141 / 400 356）
- 400 全为客户端问题（超上下文 84.3% + 非法 tool_call），**error_owner 误标 provider**，
  建议语义识别后归 client（勿据此降权无辜账号）
- **僵尸账号 3 个**（active+schedulable 但无 base_url）：#5 infer、#2 kimi2-hello4am、
  #8 amd-radeon —— 排在调度位次 23/24/28，其后 16 个可用账号被挡（failover 救回，
  不降成功率但耗重试）。**处置需用户点头**：补 base_url 或 schedulable=false
- 上下文画像：8 个号能吃 >500K（#10/#11/#13/#19/#1/#15 等）；#3 agenes 排第 3 位但
  天花板 490K → 超长请求会先打它并必然 400（机制：按名次从前到后选号）
- 完整报告：`POOL-HEALTH-REPORT.md`（可重跑 `node pool-health-check.mjs`）
- 数字会漂移：以实时查询为准，勿信文档快照