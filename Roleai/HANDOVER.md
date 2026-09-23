# RoleAI Studio 官网本地部署 — 交接文档

> 权威状态文件。变更请追加"变更记录"章节，勿覆写历史结论。

## 一、任务

把 `https://roleai.studio/` 部署到工作区 `D:\tdsh\Roleai`，本地启动后打开查看。

## 二、当前状态（已验证）

| 项 | 值 |
|---|---|
| 站点镜像根目录 | `D:\tdsh\Roleai\site`（51 文件，约 0.91 MB） |
| 本地访问地址 | **http://127.0.0.1:8088/** |
| 服务器脚本 | `D:\tdsh\Roleai\serve.js`（零依赖，Node 内置模块） |
| 启动方式 | `node D:\tdsh\Roleai\serve.js` |
| Node 版本 | v22.23.2（本机） |
| 端口 | 8088（已确认启动前空闲） |
| 镜像源 | `https://roleai.studio`（nginx，静态站） |

### 验证证据（2026-09-24）

- **18 个页面全部 HTTP 200**：`/`、`skill.html`、`downloads.html`、`pricing.html`、`updates.html`、`login.html`、`client-auth.html`、`identity.html`、`payment.html`、`support.html`、`agent.html`、`legal/user-agreement.html`、`legal/privacy-policy.html`、`admin/`、`admin/monitoring.html`、`admin/security.html`、`admin/settings.html`
- **引用闭包完整性**：缺失引用数 = **0**（脚本自动校验）
- **字节级一致性**：本地首页与源站首页 SHA256 均为 `A3F2E7EFA8661E662E37A825A81A41372D576E952B620D06152E61043CBF17B8`，零差异
- **浏览器实测**（bsk 会话 `dtwq`，Chrome 实例 `59aae417`）：
  - 首页语义树完整，标题/导航/7 个内容区块/页脚全部渲染，中文无乱码
  - 定价页 4 个真实套餐渲染成功（月度 ¥49 / 年度 ¥499 / 创始终身 ¥699 / 标准终身 ¥999）+ 8 条权益清单
  - 网络面板确认：`assets/wechat-customer-service.jpg` 200、`api/v1/product` 200、`api/v1/web/session` 401（未登录，与源站一致）、`api/v1/analytics/event` 200
  - 像素取色：主色 `#080808` 占 81.9%，深色主题灰阶层次完整，排除白屏/样式丢失

### 说明：`/admin` vs `/admin/`

`GET /admin`（无尾斜杠）返回 404，`GET /admin/` 返回 200。这是**源站 nginx 的真实行为**（未配置目录重定向），本地服务器保持一致，未做额外改写。

## 三、架构与关键设计决策

### 3.1 为什么需要 API 反向代理（核心发现）

`site/runtime-config.js` 内容：

```js
if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
  window.ROLEAI_API_BASE = '/api';
}
```

而 `site/pricing.js:4`：

```js
const endpoint = `${window.ROLEAI_API_BASE || 'https://api.roleai.studio'}/v1/product`;
```

**矛盾点**：`runtime-config.js` 在 localhost 下把 API 基址设为 `/api`（假定存在本地后端），但纯静态镜像没有后端。
若不处理，`/api/v1/product` 会打到静态服务器并返回 404 HTML，`response.json()` 解析失败，页面显示"授权方案暂时无法加载，请稍后重试"。

**处置**：`serve.js` 内置反向代理，`/api/*` → `https://api.roleai.studio/*`。
这样 `ROLEAI_API_BASE=/api` 的设计意图被真实满足，动态功能可用。

### 3.2 结论：源站 `/api/*` 返回 404 属**正常现象**，不是缺陷

> **本节曾于初版误判为"线上缺陷"，已于 2026-09-24 修正。** 保留修正过程以免后人重蹈。

**事实一：`roleai.studio` 只托管静态前端，真实后端在 `api.roleai.studio`。**

```
GET https://roleai.studio/api/v1/product      -> 404 (nginx, Content-Length: 2291)
GET https://api.roleai.studio/v1/product       -> 200 真实 JSON
```

**事实二：线上站点根本不请求 `/api/*`。** 用真实浏览器加载 `https://roleai.studio/pricing.html`，网络面板权威记录：

| 请求 | 状态 |
|---|---|
| `https://api.roleai.studio/v1/product` | 200（定价数据） |
| `https://api.roleai.studio/v1/web/session` | 401（未登录，正常） |
| `https://api.roleai.studio/v1/analytics/event` | 200（埋点） |

**零个 `/api/*` 请求。**

**事实三：线上定价页渲染完全正常** —— 4 个套餐（月度 ¥49 / 年度 ¥499 / 创始终身 ¥699 / 标准终身 ¥999）+ 8 条权益清单全部呈现，与本地镜像一致。

**机制解释**：`runtime-config.js` 仅在 `hostname` 为 `127.0.0.1` 或 `localhost` 时设置 `ROLEAI_API_BASE = '/api'`。线上 `hostname` 是 `roleai.studio`，分支不成立，`ROLEAI_API_BASE` 保持 `undefined`，各脚本的 `window.ROLEAI_API_BASE || 'https://api.roleai.studio'` 正确回退到真实后端。**设计是对的。**

**为什么本地需要反代**：本地访问时 hostname 是 `127.0.0.1`，分支成立 → `ROLEAI_API_BASE='/api'` → 指向本地后端。这正是原设计的意图（本地开发用本地后端）。但我们是纯静态镜像，没有那个后端，所以 `serve.js` 用反向代理把 `/api/*` 接到 `api.roleai.studio`，等价复现线上行为。

**修正过程（教训）**：初版仅凭 `curl https://roleai.studio/api/v1/product` 返回 404 就推断"线上定价页会加载失败"，属于**从单一必要条件跳到结论**。真正的判据应当是用浏览器观察线上实际发出的请求——那才是用户真实路径。事后全站 JS 审计也证实：**没有任何脚本硬编码 `/api` 路径**，唯一的 `/api` 出现在 `runtime-config.js:4` 的 localhost 分支里。

### 3.3 404 响应形态

`serve.js` 的 404 返回 nginx 风格 HTML（`<center><h1>404 Not Found</h1></center>`），与源站形态对齐，避免前端脚本拿到格式不同的兜底响应。

### 3.4 静态服务加固（serve.js）

| 能力 | 实现 | 验证证据 |
|---|---|---|
| 目录穿越防护 | `path.resolve` 归一化后校验前缀必须落在 ROOT 内 | 9 种攻击变体（`/../`、`/..%2f`、`/%2e%2e%2f`、`/....//`、`/..\`、双重编码等）**全部拦截**（403/404），无一 200 |
| HTTP Range | 支持 `bytes=a-b` / `bytes=a-` / `bytes=-N` 三种语法 | `0-99`→206 + `bytes 0-99/271448` + CL:100；`1000-`→206 + CL:270448；`-500`→206 + `bytes 270948-271447/271448` + CL:500 |
| 不可满足区间 | 返回 `416` + `Content-Range: bytes */size` | `bytes=999999999-` → 416 |
| 流式传输 | `fs.createReadStream` 替代 `fs.readFile` | 大文件不再整体读入内存 |
| 并发 | Node 单进程异步 I/O | 200 请求 / 并发 50 → **200 成功 0 失败，QPS 1031** |
| HEAD | 显式处理，不发 body | — |

所有响应均带 `Accept-Ranges: bytes`，便于客户端断点续传与媒体拖动。

### 3.5 API 反向代理的边界与健壮性

`/api/*` 与 `/api` 前缀才走代理，其余一律静态查找，**不构成开放代理**（不会被用作任意站点的转发跳板）。
上游不可达时返回 `502` + JSON 错误体。

**实测证据（2026-09-24）**：

| 场景 | 结果 |
|---|---|
| 方法透传 GET/POST/PUT/DELETE/OPTIONS/HEAD | 与直连上游**逐一对照一致**（见下） |
| POST + JSON body | 真实透传，返回上游的 `{"ok":false,"error":{"code":"bad_request"...}}` |
| 查询串 `?a=1&b=2` | 保留 |
| 上游 4xx/5xx | 如实透传（`/v1/nonexistent-endpoint`→404、`/v1/web/session`→401） |
| 上游不可达 | **502 Bad Gateway** + JSON 错误体（125 字节）；**同实例静态请求仍 200**，代理故障不拖垮静态服务 |
| 并发代理 300 请求 / 并发 30 | 3 轮复测均 **300/300 全部 200**，QPS 224–247（优于直连上游的 1.54s） |

**重要区分（避免误判）**：`POST/PUT/DELETE/HEAD /api/v1/product` 返回 404，这是**上游的行为**，
不是代理缺陷——直连 `https://api.roleai.studio/v1/product` 用同样方法也全部 404，且响应体是上游的
`{"ok":false,"error":{"code":"not_found","message":"接口不存在"}}`（JSON），不是本代理的文本响应。
**判断代理是否正常的正确方法是对照直连上游**，而非只看状态码。

**已知现象**：首轮并发测试曾出现 1/300 的 502（上游瞬时抖动），随后 3 轮复测零失败。
代理本身未观测到缺陷。

## 四、目录结构

```
D:\tdsh\Roleai\
├─ HANDOVER.md              # 本文档
├─ serve.js                 # 本地服务器（静态 + API 反代 + Range）
├─ check.ps1                # 一键健康巡检（9 项，含源站差异比对）
├─ OFFLINE-REPORT.md        # 离线能力报告（外部依赖清单与分级）
├─ _mirror.ps1              # 镜像脚本（可复跑做增量更新）
├─ _sitemap.xml             # 源站 sitemap 存档
└─ site/                    # 站点根目录
   ├─ index.html skill.html downloads.html pricing.html updates.html
   ├─ login.html client-auth.html identity.html payment.html support.html agent.html
   ├─ legal/{user-agreement,privacy-policy}.html
   ├─ admin/{index,monitoring,security,settings}.html + admin/assets/{admin,admin-pages,admin-security}.{css,js}
   ├─ styles.css suite.css common-ui.css pages.css
   ├─ motion.js pages.js pricing.js skill-downloads.js runtime-config.js
   ├─ robots.txt sitemap.xml
   └─ assets/               # site.css site.js auth.css payment.css payment.js
                            # qrcode-generator-2.0.4.js + 图片/图标
```

## 五、镜像方法（可复现）

`_mirror.ps1` 用 curl 做引用闭包抓取。**关键设计**：

1. **只从 HTML/CSS/XML 提取引用，不解析 JS**。原因：初次版本解析 JS 时，正则误抓模板串里的 `${root}${path}`、`size, size, function(x, y` 等噪声，产生 209 个假失败。JS 里的路径是运行时拼装的，静态镜像无需展开。
2. 引用过滤规则：跳过 `#`/`data:`/`mailto:`/`javascript:`/`tel:`/`blob:` 开头；跳过含 `$ { } ( ) 空格 ,` 的模板噪声；跳过非 `roleai.studio` 的外链。
3. 路径规范化：折叠 `./` 与 `../`，剥离查询串与 hash。
4. 种子页含 robots.txt 中的 Disallow 页面（login/payment/support/agent 等），确保完整性。

**已知坑**：`payment.html` 首次抓取时 curl 返回 000（网络抖动），重试即 200。镜像脚本对失败的 URL 不重试，需手工补抓。`login.html` 同样出现过一次 000。

**闭包校验（重要）**：脚本末尾会自动扫描已下载的 HTML/CSS/XML，列出仍缺失的引用并输出 `缺失引用数=N`。
首轮 BFS 曾漏掉 10 个边角引用（`admin/` 下的子页面深链、`assets/payment.js`、`assets/qrcode-generator-2.0.4.js`），
因为 `admin/index.html` 是独立入口、其子页不在任何种子页的引用链上。**收敛后该值必须为 0**；
若非 0，按清单手工补抓对应 URL 后再跑一次，直到为 0。

**运行时资源审计（第二道防线）**：脚本还会扫描所有 JS 里的 `assets/...` 字符串，与磁盘比对并输出 `运行时资源引用数=N 缺失=M`。
原因：`pages.js:76` 用模板串 `${root}assets/wechat-customer-service.jpg` 拼装路径——**路径不以引号开头，HTML/CSS 正则提取不到**，
而脚本又刻意不解析 JS（早期解析 JS 会产生大量 `${...}` 噪声假失败）。这类资源一旦漏抓，只在浏览器运行到对应功能时才暴露：
本轮就因此让「微信客服二维码」在清空重跑后丢失，点开该面板才 404。
处置：**在种子列表显式登记此类路径**（已含来源行号注释），并由审计步骤持续守护。

**脚本内部坑**：`Normalize-Ref` 中**不要用 `[System.IO.Path]::GetDirectoryName`** 处理站内相对路径——
根级文件（如 `/index.html`）会抛 `The path is not of a legal form.`，虽被 `$ErrorActionPreference='Continue'` 吞掉不中断抓取，
但会把错误栈刷满日志（实测 355 行日志里 340 行是噪声），掩盖真正的结果行。已改为字符串取目录。

## 六、启动与停止

```powershell
# 启动（前台）
node D:\tdsh\Roleai\serve.js

# 换端口
$env:PORT=8090; node D:\tdsh\Roleai\serve.js

# 换 API 上游
$env:API_ORIGIN="https://api.roleai.studio"; node D:\tdsh\Roleai\serve.js
```

**注意**：长驻进程须用 managed background job 启动（DSH 侧），否则调用中止时整棵进程树会被连坐杀死，表现为静默退出。

## 六-b、健康巡检 `check.ps1`

```powershell
& D:\tdsh\Roleai\check.ps1            # 快速模式（约 10 秒）
& D:\tdsh\Roleai\check.ps1 -Remote    # 含源站逐文件 SHA256 比对（约 1 分钟）
```

退出码：`0`=全绿，`1`=发现问题。9 项检查：服务存活 / 24 路径可达 / 静态引用闭包 /
运行时资源审计 / API 反代 / Range 支持 / 目录穿越防护 / 镜像统计 / 源站差异。

**双向验证证据**：
- 正路径：全绿退出码 0；`-Remote` 比对 43 个文件**差异 0**
- 负路径：故意移除 `roleai-icon.png` 后报出 **32 个问题、退出码 1**，精确定位 404、
  24 处引用缺失、运行时资源缺失；恢复后复检全绿 —— 证明它真能检测故障，不是装饰品

### ⚠️ 关键坑：含中文的 .ps1 必须存为 UTF-8 **with BOM**

本轮在此耗费大量时间。现象：脚本语法明显正确（花括号配平、`ParseInput` 通过），
但 `ParseFile` 与直接执行都报 `Missing closing '}' in statement block`，
且**报错行号比实际行号少 2 行**（报 144 行，实际语句在 146 行）。

根因：无 BOM 时 PowerShell 5.1 用 GBK 解码 UTF-8 中文，中文字符被拆错，
导致解析器内部的行号/列偏移，进而误判块未闭合。

处置：`[System.IO.File]::WriteAllText($p, $raw, (New-Object System.Text.UTF8Encoding($true)))`。
**注意**：用 `edit`/`write` 工具改过的含中文 .ps1 可能丢失 BOM，改完要复检并补回。

诊断顺序（省时间的做法）：先执行脚本看真实报错 → 用 `ParseInput` 对比 `ParseFile`
（两者结论不一致就是编码问题，不是语法问题）。

## 六-c、脚本可移植性与编码审计（2026-09-24）

| 脚本 | 路径解析 | BOM | 说明 |
|---|---|---|---|
| `serve.js` | `__dirname` 相对解析 | 不需要 | Node 原生 UTF-8，591 个非 ASCII 字节正常 |
| `check.ps1` | `$PSScriptRoot` 相对解析 | ✅ 需要且已有 | — |
| `_mirror.ps1` | `$PSScriptRoot` + `-OutDir` 参数 | ✅ 需要且已有 | 本轮修复：原为硬编码路径 |

**`_mirror.ps1` 修复说明**：原第 3 行 `$outDir = 'D:\tdsh\Roleai\site'` 是硬编码，
整目录搬迁后会写回旧位置。已改为：

```powershell
param([string]$OutDir = (Join-Path $PSScriptRoot 'site'))
```

验证：`& _mirror.ps1 -OutDir D:\tdsh\tmp\mirror-test` → 产物正确落到指定目录（51 文件、
闭包缺失 0），且**真实 `site` 目录时间戳未变**，证明参数化生效且无副作用。

**错误处理约定**：三个脚本统一「静默降级」——PowerShell 侧
`$ErrorActionPreference='Continue'` + 逐调用 `-ErrorAction SilentlyContinue`，
失败通过 `[FAIL]`/退出码 1 上报而不中断脚本；Node 侧对上游错误注册 `on('error')` 返回 502。

## 七、待办 / 未决项

1. `admin/*` 页面已抓取但依赖登录态与后端管理接口，本地打开预计显示未授权或加载失败——属预期，非镜像缺陷。
2. 未做增量更新机制：源站若改版，需重跑 `_mirror.ps1`（已能自动报告缺失引用）。
3. 离线自持性**已审计**，结论见 OFFLINE-REPORT.md：静态浏览 100% 离线可用；
   **已发现的线索**：登录相关页面会动态加载阿里云验证码 SDK（`o.alicdn.com`、`g.alicdn.com`、
   `static-captcha.aliyuncs.com`、`cloudauth-device-*.aliyuncs.com`）——这类依赖无法本地化（是第三方风控服务），
   离线时登录/验证码功能必然不可用，属预期限制。
4. `serve.js` 未实现 HTTP Range，大文件（如 265 KB 工作区图）无断点续传；未做目录穿越与并发的实测验证。

## 八、变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-24 | 初次部署：镜像 40 文件、编写 serve.js、增加 API 反向代理、浏览器验证通过 |
| 2026-09-24 | 闭包补全：新增 admin 子页与 payment.js/qrcode 库等 11 文件（42→51），引用缺失数收敛至 0；`_mirror.ps1` 加入自动闭包校验，种子页补 `/admin/` |
| 2026-09-24 | **修正 §3.2 误判**：用真实浏览器验证线上站点发出的是 `api.roleai.studio` 直连请求（非 `/api/*`），定价页渲染正常，「线上缺陷」结论撤回；§3.2 重写为机制解释 + 误判教训 |
| 2026-09-24 | **修复 BFS 漏抓运行时资源**：`pages.js:76` 模板串拼装的微信客服二维码在清空重跑后丢失（打开该面板才 404）。种子列表显式登记 + 新增运行时资源审计（扫描 JS 中 `assets/` 路径比对磁盘）+ 修复 `GetDirectoryName` 日志噪声。清空重跑验证：静态缺失=0、运行时缺失=0、27 路径全 200 |
| 2026-09-24 | **serve.js 加固**：实现 HTTP Range（原实现忽略 Range 头，大图无法断点续传）、改流式传输、416 处理、HEAD 支持。验证：Range 5 用例正确、穿越 9 变体全拦、并发 200/200 成功 QPS 1031、回归 27/27 |
| 2026-09-24 | **API 反代健壮性验证**：方法透传与直连上游逐一对照一致、POST body 真透传、查询串保留、4xx/5xx 如实透传、上游不可达返回 502 且不影响静态服务、并发 300/300 全 200。明确「404 来自上游而非代理」的判据 |
