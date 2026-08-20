# TDSH — 团团的 DeepSeek 桌面壳

> **T** = 团团（开发者）· **DSH** = DeepSeek Harness
> 把 DeepSeek Harness 的 Web 界面装进一个原生桌面窗口，双击即用。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 功能特性

- **DeepSeek 鲸鱼闪屏** — 启动时显示官方 DeepSeek 鲸鱼 Logo + "探索未至之境" 动画，窗口加载完成后自动关闭
- **一键自动更新** — 检测到新版本时弹出确认对话框，点击确认后后台下载并显示进度条，下载完成后自动安装
- **版本标签** — 窗口右下角显示当前版本号（如 `v0.1.15`），点击可触发更新检查
- **attach-or-spawn 模式** — 检测本地 `dsh web` 是否已运行，已运行则直接开窗复用，否则自动拉起新实例
- **Hanako 式窗口交互** — 对话头部即拖拽区，右上角独立圆角胶囊内嵌最小化/最大化/关闭三键
- **单实例锁** — 防止重复启动，关闭窗口自动回收子进程
- **磁盘友善** — 所有数据落盘在应用目录，不写系统盘

## 安装方式

### 从 GitHub Releases 下载安装包

1. 前往 [GitHub Releases](https://github.com/tuantuan0218/TDSH/releases) 下载最新版 `TDSH-Setup-x.x.x.exe`
2. 运行安装程序，按提示完成安装
3. 安装完成后在桌面启动 TDSH

### 开发模式运行

```bash
git clone https://github.com/tuantuan0218/TDSH.git
cd TDSH
pnpm install
npx electron . --no-sandbox
```

## 配置说明

`config.json` 位于应用根目录：

| 字段 | 说明 |
|---|---|
| `node` | 指定 Node.js 可执行文件路径（如 `H:\\nodejs\\v24.16.0\\node.exe`），用于启动 `dsh web` 后端服务 |
| `desktopPort` | HTTP carrier 监听端口，默认 `24000`，渲染进程插件通过 `dshDesktopPort` 读取 |

## 更新机制

TDSH 内置了完整的自动更新流水线：

1. 启动时检测 `electron-updater` 更新
2. 有新版本时，窗口右下角显示更新按钮
3. 点击按钮 → 确认对话框 → 后台下载（进度条显示） → 自动安装
4. 安装器下载完成后调用 `electron-updater` 的 `quitAndInstall` 完成替换

更新包的构建和发布流程：

```bash
# 构建 NSIS 安装包
npx electron-builder --win --x64 --publish never

# 上传到 GitHub Releases
gh release upload vx.x.x dist/TDSH-Setup-x.x.x.exe dist/latest.yml dist/TDSH-Setup-x.x.x.exe.blockmap --clobber
```

## 开发钩子

| 环境变量 | 行为 |
|---|---|
| `DSH_CAPTURE=1` | GUI 加载后截图 `capture.png` 并退出 |
| `DSH_MORPHCHECK=1` | 输出注入状态验证 JSON |
| `DSH_SETTINGSDUMP=1` | 打开设置页并输出注入验证 |
| `DSH_FORCE_SPAWN=1` | 强制自起新服务（不 attach） |
| `DSH_SHOT=1` | 截图验证（用于 CI 测试） |

## 技术栈

- **Electron 33** — 桌面应用框架
- **dsh plugin architecture** — 插件化架构，客户端插件通过 HTTP carrier bridge 与主进程通信
- **electron-updater** — 自动更新机制
- **electron-builder** — NSIS 安装包构建
- **Node.js ≥ 22.19** — 后端服务运行环境

## 项目结构

```
TDSH/
├── main.js                # Electron 主进程
├── preload.js             # 预加载脚本（已弃用，功能迁移至 HTTP carrier）
├── config.json            # 应用配置
├── electron-builder.yml   # 构建配置
├── assets/
│   ├── icon.ico           # 应用图标
│   ├── icon.png           # 应用图标（PNG）
│   └── deepseek-whale.svg # DeepSeek 鲸鱼 Logo（闪屏用）
├── updater/
│   └── updater.cjs        # 更新检查模块
├── dsh-plugins/           # 客户端插件
│   └── dsh-update-btn/
│       └── lib/client.js  # 更新按钮插件
└── dist/                  # 构建输出
    ├── TDSH-Setup-*.exe   # NSIS 安装包
    └── latest.yml         # 更新清单
```

## 商标声明

应用图标和闪屏使用的 **DeepSeek 鲸鱼 Logo** 版权归 DeepSeek 所有。本项目为非官方个人项目，与 DeepSeek 无隶属关系。图标仅作本地应用标识，不构成商标授权。

## 许可证

[MIT](LICENSE) © 2026 tuantuan0218