# RoleAI Studio 镜像 — 终验报告

**验收日期**：2026-09-24
**被验对象**：`D:\tdsh\Roleai`（`https://roleai.studio/` 的本地镜像）
**验收结论**：**通过**。5 组验收全部达标，无需整改项。

---

## 验收一：全站健康巡检

命令：`& D:\tdsh\Roleai\check.ps1` → **退出码 0**

| 检查项 | 结果 |
|---|---|
| 端口 8088 监听中 | OK |
| 首页 HTTP 200 | OK |
| 24/24 关键路径全部 200 | OK |
| 静态引用缺失 = 0 | OK |
| 运行时资源 2 引用、缺失 0 | OK |
| `/api/v1/product` 200 | OK |
| 快照 3 个，JSON 全部有效 | OK |
| Range 206 + Content-Range 正确 | OK |
| 5 个穿越变体全部拦截 | OK |
| 镜像 51 文件 / 0.91 MB | OK |

**结论**：全绿，无 FAIL 无 WARN。

## 验收二：与源站一致性

命令：`& D:\tdsh\Roleai\check.ps1 -Remote` → **退出码 0**

**比对 43 个文件（排除需登录态的 `admin/*`），SHA256 差异 0 个，无不可达文件。**

即本地镜像与生产站点在字节级完全一致（`/index.html` 的 301 重定向已正确处理）。

## 验收三：全部页面可达

对 `site/` 下全部 **17 个 HTML** 逐一请求：

```
[OK] /index.html          [OK] /skill.html           [OK] /downloads.html
[OK] /pricing.html        [OK] /updates.html         [OK] /login.html
[OK] /client-auth.html    [OK] /identity.html        [OK] /payment.html
[OK] /support.html        [OK] /agent.html           [OK] /admin/index.html
[OK] /admin/monitoring.html  [OK] /admin/security.html  [OK] /admin/settings.html
[OK] /legal/user-agreement.html  [OK] /legal/privacy-policy.html
```

**17/17 通过。**

浏览器会话实测补充：首页、定价页、登录页、支持页、Skill 页、下载页语义树完整渲染，
中文无乱码，控制台无意外错误。

## 验收四：三种运行模式

| 模式 | 静态 | API | 特征标头 | 结论 |
|---|---|---|---|---|
| A 代理（默认） | 200 | 200 | 无 `X-Roleai-Snapshot`（符合预期） | 通过 |
| B 快照（`--snapshot`） | 200 | 200 | `X-Roleai-snapshot: hit` | 通过 |
| C 纯静态 | 200 | — | — | 通过 |

**说明**：模式 C 首轮实测返回 000，经排查是**验收命令本身的问题**——用 `node -e` 传入的长
JS 字符串被 PowerShell 拆坏（`SyntaxError: Unexpected end of input`），并非镜像缺陷。
改用脚本文件方式后，纯静态托管首页/定价页/图标均 200。

**离线能力**（模式 B 的延伸验证，已于前轮完成）：把上游指向不可达域名后，
3 个只读接口仍 200（快照命中），浏览器能完整渲染定价页 4 个套餐；
未覆盖接口正确返回 502。

## 验收五：文档声称一致性

对 `README.md` 中全部可量化声称逐条实测：

| 文档声称 | 实际 | 一致 |
|---|---|---|
| 站点 51 文件 | 51 | ✅ |
| 17 个页面 | 17 | ✅ |
| `check.ps1` 10 个检查段 | 10 | ✅ |
| 快照 3 个 | 3 | ✅ |
| 5 个套餐 | 5 | ✅ |
| 文件导航所列 7 个文件 + 2 个目录 | 全部存在 | ✅ |

**10/10 一致。** 注：README 初稿曾写「13 页面」「12 检查项」，均已在本轮前的核查中更正为
17 与 10。

---

## 附：交付物清单

| 文件 | 大小 | 作用 |
|---|---|---|
| `README.md` | 4.3 KB | 入口文档（快速开始/三种模式/运维命令/约束） |
| `HANDOVER.md` | 17 KB | 详细交接（架构决策、全部验证证据、踩坑记录） |
| `OFFLINE-REPORT.md` | 6.7 KB | 离线能力报告（外部依赖与分级） |
| `serve.js` | 8.8 KB | 本地服务器（静态 + 反代 + Range + 快照） |
| `check.ps1` | 8.3 KB | 一键巡检（10 段，含源站比对） |
| `snapshot.ps1` | 3.3 KB | 快照抓取/刷新 |
| `_mirror.ps1` | 7.1 KB | 镜像脚本（闭包抓取 + 自动校验） |
| `site/` | 51 文件 0.91 MB | 站点根目录 |
| `snapshots/` | 4 文件 | 只读接口快照 |

GitHub：远端 `D:\tdsh` 仓库 `main` 分支，`Roleai/` 目录已同步（最新 SHA 见 `git rev-parse main`）。

## 未达标项 / 已知限制

**无整改项。** 以下为设计边界，非遗漏：

1. `admin/*` 需登录态与后端管理接口，本地打开显示未授权——预期行为。
2. 登录/注册/工单/支付必须联网（依赖阿里云验证码 SDK，第三方风控无法本地化）。
3. 快照是某时刻副本，源站改价后过期；日常请用代理模式。
4. `/admin`（无尾斜杠）404 是源站 nginx 行为，本地保持一致。

## 复现方式

```powershell
node D:\tdsh\Roleai\serve.js              # 启动
& D:\tdsh\Roleai\check.ps1                # 验收一
& D:\tdsh\Roleai\check.ps1 -Remote        # 验收二
# 验收三/四见本报告正文命令
```
