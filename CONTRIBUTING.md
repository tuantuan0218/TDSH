# 贡献指南 (CONTRIBUTING)

感谢你对 TDSH 的关注！TDSH 是 DeepSeek Harness 的桌面封装壳，任何帮助都受欢迎——报告 bug、提功能、写文档、修代码。

## 仓库结构

```
G:/dsh-desktop
├── main.js              # Electron 主进程：窗口、单实例锁、attach-or-spawn、自动更新
├── installer.c          # 自定义 NSIS 安装器源码
├── dsh-plugins/         # TDSH 预装的 dsh 插件
│   ├── dsh-plugin-nong/         # "弄就行了" AGI 模式
│   ├── dsh-plugin-advisor/      # 被动审核 (Advisor)
│   └── dsh-plugin-everything/   # 全盘搜索工具
├── agent-presets/       # 内置 agent 预设
├── build.ps1            # NSIS 安装包构建脚本
└── resources/app/repo   # 上游 dsh 框架（只读，勿直接改）
```

## 开发环境

- Node.js ≥ 20（Windows 用 portable-node，见 `build.ps1`）
- pnpm（工作区管理）
- Windows 10/11（TDSH 仅支持 Windows）

```bash
git clone https://github.com/tuantuan0218/TDSH.git
cd TDSH
pnpm install
npx electron . --no-sandbox
```

## 提 issue 前

- 先搜索是否已有相同 issue
- 用模板并提供：TDSH 版本、复现步骤、预期 vs 实际、日志（`tdsh-out.log` / `tdsh-err.log`）
- 崩溃问题附上崩溃日志

## 提交 PR

1. fork 仓库，建分支 `fix/<描述>` 或 `feat/<描述>`
2. 改动保持最小，聚焦单一目的
3. `node --check` 验证改动的 JS 文件语法
4. PR 描述：改了什么、为什么、如何验证
5. 关联相关 issue

## 代码规范

- 先读现有模式，跟随既有风格（第二条惯例是禁止的）
- 改 `main.js` / 插件：遵守全局规则（不写 C 盘、不建 Windows 计划任务）
- 涉及导出符号：先查调用点再改
- 不引入无意义抽象；奥卡姆剃刀

## dsh 框架改动

`resources/app/repo` 是上游 dsh 的编译产物，**不要直接修改**。若需改动 dsh 框架行为，在 TDSH 侧（main.js、插件、预设）通过配置/扩展实现。

## 编译与发布（维护者）

```powershell
# 构建 NSIS 安装包
.\build.ps1

# 发布到 GitHub Releases（需 GH_TOKEN）
.\build.ps1 -Publish
```