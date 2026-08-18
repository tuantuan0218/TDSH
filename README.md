# TDSH — 团团的 DeepSeek 桌面壳

> **T** = 团团（开发者）· **DSH** = DeepSeek Harness
> 把 DeepSeek Harness 的 Web 界面装进一个原生桌面窗口。双击即用，无需浏览器。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 这是什么

TDSH 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的轻量 Electron 桌面壳：

- 原生窗口承载 DSH Web GUI（Electron 33，无边框深色风格）
- **attach-or-spawn**：检测本地 `dsh web` 是否已运行——已运行则直接开窗复用；未运行则自动拉起一个新实例
- **Hanako 式窗口交互**：对话头部即拖拽区、右上角圆角胶囊内嵌最小化/最大化/关闭三键；原 "Session log" 按钮已永久隐藏，其导出能力迁至 **设置 → 会话日志** 入口（缩放/重渲染不会闪现）
- 单实例锁、外链走系统浏览器、关闭窗口自动回收服务进程
- **磁盘友善**：userData / Chromium 缓存 / 日志全部落在应用所在目录，不写系统盘（可用环境变量重定向）

## 截图

![TDSH](assets/screenshot.png)

## 快速开始

前置：能跑 `dsh web` 的 DeepSeek Harness 环境，**Node.js ≥ 22.19（或 ≥ 24.0）**。
> dsh 官方要求 `^22.19.0 || >=24.0.0`（其打包代码会 ESM 导入 `node:util` 的 `parseEnv`，Node 20 会加载失败）。
> TDSH 启动时按 `DSH_NODE` 环境变量 → 应用目录 `config.json` 的 `node` 字段 → PATH 上 `node` 的顺序探测并校验版本；
> 找不到合规 Node 时弹出明确错误框，不会静默失败。

```bash
git clone https://github.com/tuantuan0218/TDSH.git
cd TDSH
pnpm install        # 安装 electron（安装期缓存可用 ELECTRON_CACHE 等重定向到任意目录）
pnpm start          # 启动桌面端
```

### 环境变量（可覆盖）

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_REPO` | 由仓库位置推断 | DSH 源码根（`apps/cli/src/bin.ts` 所在） |
| `DSH_HOME` | 继承环境 | DSH 数据主目录（sessions / settings / storages） |
| `DSH_NODE` | `config.json` 的 `node` 字段，回退 `node`（PATH） | 启动 `dsh web` 用的 Node 可执行文件（需 ≥22.19） |

### 配置 Node 路径

双击桌面快捷方式（Explorer 环境）的 PATH 可能与终端不同，推荐在 `config.json` 固化合规 Node：

```json
{ "node": "H:\\nodejs\\v24.16.0\\node.exe" }
```

### 行为

1. 启动探测 `http://127.0.0.1:3080`：已活 → 开窗 **attach**；未活 → spawn `dsh web --port 0`，从 stdout 解析真实 URL 后开窗
2. 单实例锁；关闭窗口 → 结束并回收自起服务
3. 右上角胶囊内：最小化 / 最大化 / 关闭（关闭红态悬停）
4. 对话头部 = 拖拽区（内部按钮仍可点击）；非对话页回退为顶部 8px 隐形拖拽带
5. 运行日志：应用目录下 `app.log`

## 配置

`config.json`（应用目录内）：当前为壳自身说明注释；Session log 按钮永久隐藏、经 设置→会话日志 访问，无开关项。

## 开发钩子（验证用）

| 环境变量 | 行为 |
|---|---|
| `DSH_CAPTURE=1` | GUI 加载后截图 `capture.png` 并退出 |
| `DSH_MORPHCHECK=1` | 输出注入状态（session-log 隐藏/窗口键/拖拽区）`morphcheck.json` 并退出 |
| `DSH_SETTINGSDUMP=1` | 打开设置页并输出注入验证 `settingsdump.json` 并退出 |
| `DSH_DOMDUMP=1` | dump 页面 DOM / 动画状态 `domdump.json` 并退出 |
| `DSH_FORCE_SPAWN=1` | 强制自起新服务（不 attach） |

## 更新记录

- **0.1.0** 首个开源版本：attach-or-spawn 桌面壳、无边框 + 右上角胶囊窗口键、对话头部拖拽、Hanako 式交互
- **0.1.1** 修复 Windows 无障碍"减少动画"导致的界面动效失效：启动时经 CDP 强制 `prefers-reduced-motion: no-preference` + CSS 兜底；窗口常驻前台渲染（`win.focus()` + 关闭后台节流）
- **0.1.2** 应用图标换为 DeepSeek 官方黑白鲸鱼标记（`assets/icon.ico` / `icon.png`，源自 DSH Web 的官方 favicon.svg）
- **0.1.3** Session log 按钮改为永久隐藏（MutationObserver 瞬时响应，无缩放闪现）；窗口三键独立圆角胶囊并跟随窗口缩放重定位；会话日志能力迁入 设置 → 会话日志；修复最大化图标状态同步
- **0.1.4** 设置注入改用设置面板限定锚点 + React 移除后自动重注入；config.json 移除无效的 hideSessionLog 死字段
- **0.1.5** 设置内「会话日志」项改为克隆原生设置项（navCell 同构样式 + 下载图标 + 无选中态）；修复 observer 自循环；剥离哈希激活类名
- **0.1.6** 设置内「会话日志」项与原生项像素级一致（去除 ID 级样式覆盖、保留原生 navLabel 结构、图标归一 16×16）；Node 探测链改为 `DSH_NODE` → `config.json.node` → PATH 并按官方要求（`^22.19.0 || >=24.0.0`）校验版本，双击桌面快捷方式即可一键拉起 `dsh web` 整套系统

## 商标与图标

应用图标使用 **DeepSeek Harness** 官方 favicon 中的鲸鱼标记（黑白化渲染），该标记商标归 DeepSeek 所有；本项目为非官方个人项目（TDSH = 团团的 DeepSeek），与 DeepSeek 无隶属关系。图标仅作本地应用标识，不构成商标授权。

## 安全与隐私

- 本仓库不含任何 API 密钥、凭据或用户数据（`.gitignore` 排除 userData / 日志 / 测试产物）
- 与 DSH 的交互仅限本地 loopback（`127.0.0.1`），无遥测、无外部请求

## License

[MIT](LICENSE) © 2026 tuantuan0218