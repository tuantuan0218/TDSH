# 本机凭据暴露全量地图（2026-09-13 · 24 仓普查 · 不含任何凭据值）

> 范围：`repos.txt` 列出的 24 个本地 git 仓，**0 跳过**。工具：`sweep_fast.py` / `sweep_v3.py` / `remote_ownership.py` / `hist_recheck.py`（均带阳性+阴性对照自检）。
> 本报告只含 仓 / 计数 / 字段名 / 值长度 / 字符类别指纹，**绝不含任何凭据原值或可识别前缀**。

## 一、HEAD 维度普查（v2 宽口径，含噪音，用于定位"哪里需要深挖"）

| 仓 | HEAD 命中 | 判读 |
|---|---|---|
| `/mnt/d/tdsh`（TDSH） | 317 | 多为 harness 自身 `apiKeyEnv = "DEEPSEEK_API_KEY"` 类**变量名**与测试 fixture |
| `/mnt/d/tdsh/sub2api-src` | 1245 | 第三方源码，JS `key=` 海量，噪音 |
| `/mnt/d/tdsh/resources/app/repo` | 412 | 第三方 harness，同上 |
| `/mnt/h/second-brain` | 46 | 需深挖（同第二大脑族） |
| `/mnt/i/Obsidian/vaults/第二大脑` | 53 | 已深挖，见 §三 |
| `/mnt/d/tdsh/黄金` | 1 | ⚠️ 更正：该计数出自 **v2 宽口径**（噪音版），v3 收紧后的清单里并无此项 → 属 `apiKey`/JSX `key=` 类假阳，非真实候选。我最初写"待判读"是不准确的措辞（并未真判读），现更正 |
| `whs_template` | 2 | 同上：v2 计数，v3 清单无此项；第三方模板源码噪音 |
| **suno迷笛 / personal-model / uumit / recording_gear / patchwork / 各 hs_* 第三方克隆** | **0** | 干净 |

**收紧后（v3，要求字段为"密钥语义名"+值像凭据+排除注入形态/占位符）**：全仓合计 645 处候选，其中 **harness/第三方源码占绝对多数**（`apiKeyEnv`、`policyKey`、JSX `key=` 等指向"名字"而非密钥本体），自有内容仓的真实候选集中在第二大脑族。

> 工具演进教训：v1 逐文件 `git show` → 600s 超时；v2 一次 `git grep` 但过杀（2076 命中 ~99% 假阳）；v3 加语义/形态双门限并把**真值与占位符分开计数**。收紧过程中 `hist_recheck`/`_assert_no_falseneg` 两次拦住"为降噪音而误杀真凭据"的改法——见 AGENTS.md §8 第 4/5/9 条。

## 二、Remote 合规维度（`remote_ownership.py`，按 URL owner 段判定，非路径猜测）

| 类别 | 数量 | 明细 |
|---|---|---|
| 自有仓已内嵌 token（合规） | 8 | tdsh / recording_gear / suno-midi / uumit / gold-ea / second-brain / 第二大脑 / personal-model |
| **自有仓裸 URL（会弹 GCM）** | **0** | — |
| **第三方仓 origin 内含个人 token（违反 §5 例外）** | **4** | `hs_card_sdk`、`hs_plugin_src`、`hs_strategy_sdk`、`炉石传说/_gh_strategy_plugin`（owner 均为同一第三方账号） |
| 第三方仓裸 URL（只拉不推，合规） | 10 | reference/*、sub2api-src、whs_template、resources/app/repo、hss-src-build 等 |
| 无 origin 无法判定 | 1 | `G:/dsh-verify/patchwork` |

⚠️ 我一度用"路径含 hs_/reference"猜归属，把 `hss-src-build`（实为第三方）误报成"自有裸 URL"、把 3 个自有 SDK 目录误分类——**必须按 URL owner 判，不能按目录名猜**。

**U3 的不确定性已消除（09:2x 追补）**：曾以为"若那些仓是私有、pull 依赖 token，改了会拉不动"。实测否证：

- 第一版探测用 `api.github.com` → **7 仓全部 403，包括明显公开的 `Wei-Shaw/sub2api` 与 `xjw580/Hearthstone-Script`** → 那是未授权限流，不是可见性信号，**该结论无效**（已弃用 `repo_visibility.py`）。
- 改用 git 协议直接测【剥掉凭据的裸 URL】（`repo_visibility_git.py`，`GIT_TERMINAL_PROMPT=0` 保证不弹 GCM、不送凭据）：**7 仓全部 exit 0，裸 URL 可正常列引用** → 全部是公开仓。

→ **结论：给那 4 个第三方仓去掉 origin 里的个人 token，零功能风险**（pull 不受影响）。U3 从"需先确认是否私有"降级为"仅待执行授权"，每仓一行命令：
`git -C <仓> remote set-url origin https://github.com/<owner>/<repo>.git`
**未擅自执行**：改他人项目的 git 配置超出资料整理边界，且 §8 禁止把含 token 的旧 URL 存档（无法留回滚凭据），故只交付判定与命令。


**这 4 个第三方仓的处置需用户点头**（受限项）：清 token 需 `git remote set-url` 改裸 URL，但若该第三方仓是私有需 token 才能 pull，改了会导致拉取失败。故登记待办、不擅改。

## 三、QQ SMTP 授权码真实状态（本轮两次更正后的定稿）

| 位置 | 状态 |
|---|---|
| suno-midi **公开仓** HEAD + 全历史 12 提交 | **0 命中**（filter-repo 后，本轮用正确方法独立复验）✅ |
| 第二大脑 **HEAD**（含活动 `automation/stock/config.py`、归档副本、OH-Works 审计报告） | **3 处均为 `REDACTED-…` 占位符，无真值** ✅（我上一轮误报为"活凭据"，已更正） |
| 第二大脑 **历史** | **含真值形态的提交 = 161 / 215**（排除占位符后重算）→ 真值仍可从历史读出，**未失效** |
| TDSH / personal-model / uumit / gold-ea / recording_gear | 0 命中 |

### 🔴 功能性副作用（比泄漏更紧急，需用户决定）
`automation/stock/config.py` 里 `SENDER_AUTH` 被**就地涂成占位符字面量**，而该文件**没有任何 `os.environ`/`getenv`**（全文 31 行已核）→ **stock 邮件当前必然认证失败**。修法见 AGENTS.md §8"正确修法"（改注入 + 重置授权码 + 可选历史清洗，三步缺一不可）。

### ✅ 已做成可复用检查器：`redaction_fixed_check.py`
判据不是"值被涂掉"，而是三件事同时成立：①字段不再是字面量 ②文件确有 `os.environ/getenv` ③HEAD 无真值形态。实测：

| 目标 | 判定 |
|---|---|
| `automation/stock/config.py`（活动） | **NOT_FIXED**（涂占位符但无 env 注入 ⇒ 假清 + 功能坏） |
| `99_archive/…/stock/config.py`（归档） | **NOT_FIXED**（同上） |
| `OH-Works/…/script-audit-report-20260811.md` | PARTIAL（文档含占位符 + 提及 env，属记录形态） |

→ 可直接当**验收门**用：任何一次"脱敏"改动后跑它，只有全 `FIXED` 才算真到位，防止再出现"涂值即算清"。

## 四、待用户决定（受限项，本次一律未擅动）

| # | 事项 | 备注 |
|---|---|---|
| U1 | 重置 QQ SMTP 授权码 | 唯一能令历史 161 个提交里的真值彻底失效的动作 |
| U2 | `automation/stock/config.py` 改环境变量注入 | 修当前邮件功能坏；属实质代码改动，需点头 |
| U3 | 4 个第三方仓 origin 去 token | **已证实零功能风险**（7 仓裸 URL 均可拉，全公开）；仅待执行授权，命令见 §二 |
| U4 | 第二大脑历史是否 filter-repo 清洗 | 有并发会话在提交，须先协调；`-S` 与"树含明文"两口径别混 |
| U5 | `dsh-home`（含 AGENTS.md 全局教训）是否建私有备份 | 现无备份；该目录含 settings 里的 token，裸推有风险，须先剥离 |

## 五、方法学产出（已并入 AGENTS.md §8，共 9 条）

假绿 4 类：bash `'a'+'b'` 非拼接 / `git log --regex` 查提交信息非 blob / WSL 盘符路径静默跳过 / 逐文件子进程超时。
假阳 2 类：字段名缺词界 / 未按语义筛字段。
假阴 2 类：值字符类漏 `_ -` / 为降噪排除"全大写值"会误杀真凭据。
定则 1 类：**真值形态与占位符形态必须分开计数**，合并成单一"命中数"会同时制造假阳与假阴。
