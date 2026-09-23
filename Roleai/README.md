# RoleAI Studio 官网 — 本地镜像

`https://roleai.studio/` 的完整离线可运行副本。

**这是官网的静态镜像 + 本地服务**，包含全部 17 个页面、资源文件，以及一个零依赖的本地服务器
（静态托管 / API 反向代理 / HTTP Range / 快照模式）。**上游站点是别人的生产环境，本目录只读镜像，我们不改线上任何东西。**

---

## 快速开始

```powershell
# 1. 启动（默认代理模式，数据实时来自上游）
node D:\tdsh\Roleai\serve.js

# 2. 打开
#    http://127.0.0.1:8088/
```

换端口：`$env:PORT=8090; node D:\tdsh\Roleai\serve.js`

---

## 三种运行模式

| 模式 | 启动方式 | 数据来源 | 适用场景 |
|---|---|---|---|
| **代理**（默认） | `node serve.js` | 实时转发到 `api.roleai.studio` | 日常浏览，数据最新 |
| **快照** | `node serve.js --snapshot` | 优先读 `snapshots/*.json`，未命中回退代理 | 断网演示、规避上游抖动 |
| **纯静态** | 任何静态服务器指向 `site/` | 无后端 | 只看营销页与法律页 |

快照模式实测：把上游指向不可达域名后，定价页仍能完整渲染 5 个套餐（¥0/¥49/¥499/¥699/¥999）。

---

## 日常运维

```powershell
# 健康巡检（约 10 秒，退出码 0=全绿 1=有问题）
& D:\tdsh\Roleai\check.ps1

# 巡检 + 与源站逐文件哈希比对（约 1 分钟，用于检测源站改版）
& D:\tdsh\Roleai\check.ps1 -Remote

# 刷新快照（源站改价/发新版后执行）
& D:\tdsh\Roleai\snapshot.ps1            # 经本地服务抓
& D:\tdsh\Roleai\snapshot.ps1 -Direct    # 直连上游抓

# 重新镜像整站（源站改版后执行，可指定输出目录）
& D:\tdsh\Roleai\_mirror.ps1
& D:\tdsh\Roleai\_mirror.ps1 -OutDir D:\somewhere\else\site
```

`_mirror.ps1` 跑完会报告 **两个收敛指标**，都必须为 0：
`缺失引用数`（HTML/CSS 引用闭包）与 `运行时资源缺失`（JS 模板串拼装的 assets 路径）。

---

## 文件导航

| 文件 | 作用 |
|---|---|
| `serve.js` | 本地服务器：静态托管 + `/api/*` 反向代理 + Range + 快照模式 |
| `site/` | 站点根目录（51 文件 / 0.91 MB），**唯一需要托管的目录** |
| `check.ps1` | 一键健康巡检（10 个检查段，含源站差异比对） |
| `snapshot.ps1` | 快照抓取/刷新 |
| `snapshots/` | 只读接口的本地 JSON 快照 |
| `_mirror.ps1` | 镜像脚本（curl 驱动引用闭包抓取 + 自动校验） |
| `HANDOVER.md` | **详细交接文档**：架构决策、全部验证证据、踩坑记录 |
| `OFFLINE-REPORT.md` | 离线能力报告：外部依赖清单与能力分级 |
| `ACCEPTANCE.md` | **终验报告**：5 组验收的完整证据与结论 |

---

## 关键约束（改动前必读）

1. **含中文的 `.ps1` 必须存为 UTF-8 with BOM**。否则 PowerShell 5.1 按 GBK 解码，
   中文字符被拆错导致行号偏移，表现为诡异的 `Missing closing '}'` 误报
   （脚本其实语法正确，`ParseInput` 能通过而 `ParseFile` 失败就是此症状）。
   用 `edit`/`write` 工具改过含中文的 `.ps1` 后要复检 BOM。

2. **判断代理是否正常，必须对照直连上游**。`POST /api/v1/product` 返回 404 是**上游行为**
   （直连同样 404），不是代理缺陷。只看状态码会误判。

3. **长驻进程用 managed background job 启动**。普通工具调用中止时会连坐杀死整棵进程树，
   表现为静默退出、无错误栈。

4. **`runtime-config.js` 只在 localhost 下把 API 基址设为 `/api`**。
   线上 hostname 是 `roleai.studio`，不满足条件，各脚本回退到 `api.roleai.studio` —— **这是设计，不是 bug**。

---

## 已知限制

- `admin/*` 页面需登录态与后端管理接口，本地打开显示未授权——属预期。
- 登录、注册、工单、支付**必须联网**：依赖阿里云验证码 SDK（第三方风控，无法本地化）。
  详见 `OFFLINE-REPORT.md`。
- `/admin`（无尾斜杠）返回 404 是源站 nginx 行为，本地保持一致。
- 快照是**某一时刻的副本**，源站改价后即过期；日常请用代理模式。

---

## 交付状态

- 站点 51 文件，与源站 43 个可比对文件**哈希完全一致**
- 巡检 10 个检查段全绿，静态与运行时引用缺失均为 0
- 已通过 5 组终验（见 `ACCEPTANCE.md`）
- 已推送 GitHub（`D:\tdsh` 仓库，`Roleai/` 目录）

详细证据与决策记录见 `HANDOVER.md`。
