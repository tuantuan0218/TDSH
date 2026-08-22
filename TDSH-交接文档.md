# TDSH 自包含桌面应用 — 交接文档

## 项目定位

TDSH = DeepSeek Harness 的桌面壳：把 DSH Web 界面装进原生无边框窗口，带汉化、窗口控件、自动更新等增强。目标：双击即用，不限联网，不依赖 pnpm/npm/clone。

## 仓库

- 源码: `G:\dsh-desktop`
- GitHub: `https://github.com/tuantuan0218/TDSH`
- 运行实例: `D:\tdsh` (v0.1.27, 从 USB 安装到本机)
- 当前版本: **0.1.27** (git HEAD `f1b79c5`)

## 架构

```
TDSH.exe (Electron 33)
  ├── main.js          — Electron 主进程
  │   ├── splash       — 首跑解压 tar.gz 进度 (splash.html)
  │   ├── ensureProfile — 首跑复制 dsh-plugins 到 profile
  │   └── spawn dsh web — 启动 dsh-cordis 服务
  ├── dsh-plugins/     — TDSH 特有插件 (5 个)
  │   ├── dsh-window-controls   — 最小化/最大化/关闭按钮
  │   ├── dsh-update-btn        — 右上角更新按钮
  │   ├── dsh-version-label     — 版本号角标
  │   ├── dsh-session-log       — 会话日志导出
  │   └── dsh-global-agent      — AGENTS.md 编辑器 (热重载)
  ├── resources/
  │   ├── dsh-repo.tar.gz       — 打包的 DSH 完整仓库 (430MB)
  │   └── portable-node/        — Node v24.16.0 便携版
  └── dist/            — 构建产物
```

### 首次运行流程

1. splash 窗口显示进度条
2. 解压 `resources/app/repo/` 到 `{installDir}/resources/app/repo` (82K 文件, 本地 SSD ~2min, USB ~40min)
3. 创建 `{installDir}/dsh-home/` (DSH 数据目录)
4. 调用 `ensureProfile()` 复制 `dsh-plugins/` 到 profile 的 node_modules
5. 启动 `dsh-cordis` web 服务
6. 打开 webview 到 `http://127.0.0.1:{port}/?dshDesktopVersion={ver}&dshDesktopPort=24000`
7. 热加载插件, 注入窗口控件/更新按钮/版本号

### 插件加载机制

- 插件源码在 `dsh-plugins/`，构建时通过 `electron-builder.yml` 的 `files: [dsh-plugins/**/*]` 打包
- 首跑 `ensureProfile()` 逐文件复制到 `{dsh-home}/profiles/web/node_modules/`
- 插件是 `module-loader` 兼容的 `factory(require) => { exports }` 模块
- 载入顺序由 `cordis.patch.yml` 的 `bundles` 数组控制
- 插件间通信通过 HTTP carrier (`http://127.0.0.1:24000/__tdsh/*`)

## 构建流程

### 前置条件

| 项目 | 路径 | 说明 |
|------|------|------|
| 源码 | `G:\dsh-desktop` | git 仓库 |
| Node v24.16.0 | `H:\nodejs\v24.16.0` | 便携版，不依赖系统 Node |
| pnpm v11 | `H:\npm-global\pnpm` | 独立安装，绕开 corepack |
| 已展开的 repo | `G:\dsh-desktop\reltmp\hoisted` | 1.37GB, 946 包 |
| repo tar.gz | `G:\dsh-desktop\reltmp\dsh-repo-final.tar.gz` | ~430MB |
| 构建 shim | `G:\dsh-desktop\reltmp\buildbin\` | pnpm.cmd + node.cmd |

### 构建步骤

```bash
# 1. 升版本
编辑 package.json version 字段

# 2. 构建
powershell -ExecutionPolicy Bypass -File "G:\dsh-desktop\reltmp\build.ps1"

# 3. 验证
ls -la dist/TDSH-Setup-0.1.XX.exe

# 4. 拷 U 盘
powershell "Copy-Item dist/TDSH-Setup-0.1.XX.exe I:/ -Force"

# 5. 发布 auto-update (需要 gh auth)
gh release create v0.1.XX dist/TDSH-Setup-0.1.XX.exe dist/TDSH-Setup-0.1.XX.exe.blockmap dist/latest.yml --repo tuantuan0218/TDSH --title "TDSH 0.1.XX" --notes "..."
```

### 构建脚本关键点

`reltmp/build.ps1`:
- 设 PATH 优先使用 v24 Node + npm-global pnpm
- 禁用 corepack (`COREPACK_ENABLE_PROJECT_SPEC=0`, `COREPACK_ENABLE_STRICT=0`)
- 缓存目录 `G:\dsh-desktop\reltmp\.cache` (非 C 盘)
- 构建命令: `node node_modules/electron-builder/cli.js --win --x64`
- 构建约 2 分钟, 产物 ~535MB

### 构建产物

| 文件 | 用途 |
|------|------|
| `dist/TDSH-Setup-0.1.XX.exe` | NSIS 安装包 (给新用户 / USB) |
| `dist/TDSH-Setup-0.1.XX.exe.blockmap` | 增量更新 (auto-update 用) |
| `dist/latest.yml` | 版本检测 (auto-update 用, 需上传到 Release) |
| `dist/win-unpacked/` | 解包目录 (调试用) |

## 已知问题 & 坑

### 1. 重新打包 tar.gz 流程 (容易忘)

当 `reltmp/hoisted/` 里的 dsh 源码更新后，需要重新打包：

```bash
# 重建 hoisted (pnpm 扁平化)
rm -rf reltmp/hoisted
# 在 G:\dsh-desktop 运行 pnpm install --shamefully-hoist 或其他方式
# 然后打包
tar -czf reltmp/dsh-repo-final.tar.gz -C reltmp/hoisted .
```

> 当前 `reltmp/dsh-repo-final.tar.gz` 是 2026-08-18 打包的静态快照。DSH 源码更新后需要重新打包。

### 2. 首跑解压死锁 (已修复)

`tar -xzf -v` 在 Windows 的 64KB pipe buffer 满时阻塞 (tar 写 stdout 满 → write 阻塞 → tar 不继续读 stdin → 解压卡死)。

**修复:** `main.js` 中移除 `-v` flag, 用 `spinner` 动画代替进度条。

### 3. USB 解压极慢 (已知)

USB 随机 I/O 瓶颈: 82K 文件解压需要 ~40 分钟。本地 SSD 仅需 ~2 分钟。
**建议:** 首次安装选本地 SSD，不要用 USB 直接运行。

### 4. auto-update 版本号回退

electron-updater 禁止降级。如果 GitHub Release 版本号低于本地版本，更新按钮显示"检测到新版本但无法降级"。
**修复:** 确保每次发布版本号严格递增。

### 5. 窗口控件在首页不可见 (已修复, v0.1.27)

**根因:** dsh web 在首页隐藏 `<header>` (class `headerHidden`, 0×0), 窗口控件挂在 header 内 → 不可见。
**修复:** `.dsh-pill` 改用 `position:fixed` 挂 `document.body`，固定 `right:12px; top:10px`。

### 6. getBase() 端口丢失 (已修复, v0.1.27)

**根因:** 插件通过 `URLSearchParams(location.search).get("dshDesktopPort")` 读端口，但 SPA 导航后 query params 丢失 → 返回 null → 插件跳过注入。
**修复:** 所有 3 个插件 (window-controls, update-btn, global-agent) 的 `getBase()` 增加 fallback `if (!port) port = "24000"`。

### 7. 构建时的 GH_TOKEN 错误

electron-builder 构建最后尝试 publish 到 GitHub，但缺少 `GH_TOKEN` 环境变量。报错 `Cannot cleanup: GitHub Personal Access Token is not set`。
**不影响产物:** exe/blockmap/latest.yml 在 publish 前已生成。发布 Release 需手动用 `gh release create`。

### 8. 窗口控件用 Segoe MDL2 Assets 字体

### 9. agent-loop 无限自动续跑 (harness 补丁, 非打包内)

**重要：此补丁直接改运行时文件，不随 TDSH 安装包分发，重装会被覆盖。**

- 位置: `D:/tdsh/resources/app/repo/packages/core/agent-loop/`
  - `lib/index.js`（运行时实际加载）
  - `lib/types/agent.js` + `src/agent.ts`（同步但仅参考）
  - `bundle/base/node_modules/@deepseek-ai/dsh-agent-loop` 是同一文件的硬链接，改一处即可
- 内容: `ReactLoopAgent.turn()` 中，当模型产出无工具调用消息且 inbox 为空时，无限次注入
  `[自动续跑]` 继续指令（**无 `autoContinued` 守卫**），直到模型响应 → GPT 风格永不 yield。
  模型响应后调 `complete_goal` → 触发 nong 的 `goal-complete-inject` → MCTS → 新目标，循环不断。
- 效果: deepseek-v4-flash 连续自主运行 133+ 分钟 / 21 个目标 / 零停止
- 备份: `G:/dsh-desktop/harness-patches/agent-loop/` (已 push tuantuan0218/TDSH 仓库)
- 恢复: 替换回原始文件（来自 `@deepseek-ai/dsh-agent-loop` 包）

按钮渲染依赖 Windows 系统字体 `Segoe MDL2 Assets` (Win 10+ 自带)。如果缺失，字体会回退到 `Segoe UI`，显示为乱码占位符而非图标。**目前无此问题报告。**

## 插件清单

### dsh-window-controls
- 文件: `dsh-plugins/dsh-window-controls/lib/client.js`
- 功能: 右上角最小化/最大化/关闭按钮
- 端口: 通过 getBase() 获取 carrier 端口 (24000), 发送 POST /__tdsh/win
- 定位: `position:fixed`, `right:12px`, `top:10px`, 挂 `document.body`
- 样式: 黑色背景 (#0D0E12), 边框 (#1E1F24), 圆角 16px

### dsh-update-btn
- 文件: `dsh-plugins/dsh-update-btn/lib/client.js`
- 功能: 检测 GitHub Release 新版本, 显示下载/安装按钮
- 检测: 每 5 分钟 GET /__tdsh/update-check
- 下载: 调用 electron-updater downloadUpdate, 安装: quitAndInstall

### dsh-version-label
- 文件: `dsh-plugins/dsh-version-label/lib/client.js`
- 功能: 版本号角标 (从 URL 参数 `dshDesktopVersion` 读取)
- 注入: 挂到 `<header>` 的 `<span>`, 无 carrier 调用

### dsh-session-log
- 文件: `dsh-plugins/dsh-session-log/lib/client.js`
- 功能: 会话日志导出按钮, 点击触发隐藏的 session-log 下载
- 注意: 无 getBase(), 仅触发 DOM 按钮

### dsh-global-agent
- 文件: `dsh-plugins/dsh-global-agent/lib/client.js`
- 功能: 侧边栏 AGENTS.md 编辑器, 支持热重载 (SHA-1 文件监视)
- 路由: `GET/POST /__tdsh/agent`
- 挂载: 设置面板入口, 通过 carrier 读写文件

## 授权 & 发布

- auto-update 检测: `https://github.com/tuantuan0218/TDSH/releases/latest/download/latest.yml`
- electron-updater 使用 GitHub Releases 的 latest.yml 检测版本
- 需要 `GH_TOKEN` 或 `gh auth` 来推送 Release
- 当前 gh auth 已认证, token 在 keyring

## 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| 0.1.27 | 2026-08-20 | 窗口控件 `position:fixed` 修复; update-btn getBase fallback; 发布 Release |
| 0.1.26 | 2026-08-19 | dsh-global-agent 插件; 修复所有 getBase(); 解压死锁修复; 进度条动画 |
| 0.1.25 | 2026-08-19 | 自包含构建链: hoisted 布局 + tar.gz 打包 + NSIS |
| 0.1.24 | 2026-08-19 | dsh-update-btn 检测更新按钮 |
| 0.1.23 | 2026-08-19 | dsh-window-controls 窗口控件 |
| 0.1.18-22 | 2026-08-19 | 解压进度条、splash、超时修复 |
| 0.1.15 | 2026-08-18 | 初始发布 (GitHub Latest) |
| 0.1.11-14 | 2026-08-18 | 早期版本 (无自包含, 需 clone + pnpm install) |