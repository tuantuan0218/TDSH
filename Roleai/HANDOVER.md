# RoleAI Studio 官网本地部署 — 交接文档

> 权威状态文件。变更请追加"变更记录"章节，勿覆写历史结论。

## 一、任务

把 `https://roleai.studio/` 部署到工作区 `D:\tdsh\Roleai`，本地启动后打开查看。

## 二、当前状态（已验证）

| 项 | 值 |
|---|---|
| 站点镜像根目录 | `D:\tdsh\Roleai\site`（40 文件，约 0.83 MB） |
| 本地访问地址 | **http://127.0.0.1:8088/** |
| 服务器脚本 | `D:\tdsh\Roleai\serve.js`（零依赖，Node 内置模块） |
| 启动方式 | `node D:\tdsh\Roleai\serve.js` |
| Node 版本 | v22.23.2（本机） |
| 端口 | 8088（已确认启动前空闲） |
| 镜像源 | `https://roleai.studio`（nginx，静态站） |

### 验证证据（2026-09-24）

- **13 个页面全部 HTTP 200**：`/`、`skill.html`、`downloads.html`、`pricing.html`、`updates.html`、`login.html`、`client-auth.html`、`identity.html`、`payment.html`、`support.html`、`agent.html`、`legal/user-agreement.html`、`legal/privacy-policy.html`
- **静态引用完整性**：脚本枚举全部 HTML/CSS 引用，缺失数为 0
- **浏览器实测**（bsk 会话 `dtwq`，Chrome 实例 `59aae417`）：
  - 首页语义树完整，标题/导航/7 个内容区块/页脚全部渲染，中文无乱码
  - 定价页 4 个真实套餐渲染成功（月度 ¥49 / 年度 ¥499 / 创始终身 ¥699 / 标准终身 ¥999）+ 8 条权益清单
  - 网络面板确认：`assets/wechat-customer-service.jpg` 200、`api/v1/product` 200、`api/v1/web/session` 401（未登录，与源站一致）、`api/v1/analytics/event` 200

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
   ├─ admin/index.html      # 管理页（robots.txt 已 Disallow）
   ├─ styles.css suite.css common-ui.css pages.css
   ├─ motion.js pages.js pricing.js skill-downloads.js runtime-config.js
   ├─ robots.txt sitemap.xml
   └─ assets/               # site.css site.js auth.css payment.css + 图片/图标
```

## 五、镜像方法（可复现）

`_mirror.ps1` 用 curl 做引用闭包抓取。**关键设计**：

1. **只从 HTML/CSS/XML 提取引用，不解析 JS**。原因：初次版本解析 JS 时，正则误抓模板串里的 `${root}${path}`、`size, size, function(x, y` 等噪声，产生 209 个假失败。JS 里的路径是运行时拼装的，静态镜像无需展开。
2. 引用过滤规则：跳过 `#`/`data:`/`mailto:`/`javascript:`/`tel:`/`blob:` 开头；跳过含 `$ { } ( ) 空格 ,` 的模板噪声；跳过非 `roleai.studio` 的外链。
3. 路径规范化：折叠 `./` 与 `../`，剥离查询串与 hash。
4. 种子页含 robots.txt 中的 Disallow 页面（login/payment/support/agent 等），确保完整性。

**已知坑**：`payment.html` 首次抓取时 curl 返回 000（网络抖动），重试即 200。镜像脚本对失败的 URL 不重试，需手工补抓。

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

1. `D:\tdsh\Roleai\index.html`（根目录那个）是早期单文件抓取残留，与 `site/index.html` 重复，可删。
2. `admin/index.html` 已抓取（18.6 KB），但源站 robots.txt `Disallow: /admin/`，且该页可能依赖登录态。
3. 线上 `/api/*` 返回 404 的现象需进一步定位来源（见 §3.2）。
4. 未做增量更新机制：源站若改版，需重跑 `_mirror.ps1`。

## 八、变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-24 | 初次部署：镜像 40 文件、编写 serve.js、增加 API 反向代理、浏览器验证通过 |
