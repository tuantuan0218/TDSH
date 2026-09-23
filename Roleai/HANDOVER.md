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

### 3.2 重要事实：源站 `/api/*` 本身就是 404

实测源站 `https://roleai.studio/api/v1/product`（及 `/releases`、`/web/session`、`/analytics/event`）**全部返回 404**（nginx，Content-Length: 2291 的 HTML）。

即：`roleai.studio` 只托管静态前端，真实后端在 **`api.roleai.studio`**（实测 `https://api.roleai.studio/v1/product` → 200 真实 JSON）。

**这是一个线上缺陷**：访问 `https://roleai.studio/pricing.html` 时，因 `runtime-config.js` 只在 localhost 分支设置 `ROLEAI_API_BASE`，线上 `window.ROLEAI_API_BASE` 为 undefined → 回退到 `https://api.roleai.studio` → 本应正常工作。
（待复核：线上 404 的 `/api/v1/product` 请求来自何处，可能是站点其他脚本的硬编码路径。）

### 3.3 404 响应形态

`serve.js` 的 404 返回 nginx 风格 HTML（`<center><h1>404 Not Found</h1></center>`），与源站形态对齐，避免前端脚本拿到格式不同的兜底响应。

## 四、目录结构

```
D:\tdsh\Roleai\
├─ HANDOVER.md              # 本文档
├─ serve.js                 # 本地服务器（静态 + API 反代）
├─ _mirror.ps1              # 镜像脚本（可复跑做增量更新）
├─ _sitemap.xml             # 源站 sitemap 存档
├─ index.html               # （冗余）早期单文件抓取残留
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

**已知坑**：`payment.html` 首次抓取时 curl 返回 000（网络抖动），重试即 200。镜像脚本对失败的 URL 不重试，需手工补抓。

**闭包校验（重要）**：脚本末尾会自动扫描已下载的 HTML/CSS/XML，列出仍缺失的引用并输出 `缺失引用数=N`。
首轮 BFS 曾漏掉 10 个边角引用（`admin/` 下的子页面深链、`assets/payment.js`、`assets/qrcode-generator-2.0.4.js`），
因为 `admin/index.html` 是独立入口、其子页不在任何种子页的引用链上。**收敛后缺失数必须为 0**；
若非 0，按清单手工补抓对应 URL 后再跑一次，直到为 0。

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

## 七、待办 / 未决项

1. `admin/*` 页面已抓取但依赖登录态与后端管理接口，本地打开预计显示未授权或加载失败——属预期，非镜像缺陷。
2. 线上 `/api/*` 返回 404 的现象需进一步定位来源（见 §3.2）。
3. 未做增量更新机制：源站若改版，需重跑 `_mirror.ps1`（已能自动报告缺失引用）。

## 八、变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-24 | 初次部署：镜像 40 文件、编写 serve.js、增加 API 反向代理、浏览器验证通过 |
| 2026-09-24 | 闭包补全：新增 admin 子页与 payment.js/qrcode 库等 11 文件（42→51），引用缺失数收敛至 0；`_mirror.ps1` 加入自动闭包校验，种子页补 `/admin/` |
