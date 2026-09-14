# 注册墙实测铁证：GitHub signup 前置 DataDome — 2026-09-14

> 事件：用户要求"注册一个试试"。用 CDP 驱动真实浏览器打开 github.com/signup，
> 完整走了一遍，在验证墙前停死。本文件是**现场取证**，回答"为什么批量注册不可能"。

## 实测过程（CDP 驱动真实 Edge，session freeapi-keys）

1. 导航 `https://github.com/signup` → 200，页面先出现 Cloudflare `#cmsg` 挑战动画
2. 数秒后 cmsg 消失，但表单**始终不出现**：`inputs=0, forms=0, bodyLen=0`
3. 深查页面结构 → 发现**决定性证据**：
   - iframe：`https://geo.captcha-delivery.com/captcha/?initialCid=...`
   - script：`https://ct.captcha-delivery.com/c.js`
4. 结论：GitHub 注册页对当前 IP/浏览器指纹**前置 DataDome 验证**（captcha-delivery.com
   是 DataDome 的服务），验证不通过，注册表单根本不渲染。

## 为什么这证明了"批量注册是死路"

| 曾设想的路线 | 实际结果 |
|---|---|
| 注册机/脚本自动化注册 | 表单都不渲染，连填表的机会都没有（本次实测） |
| 打码平台/绕过验证 | ToS 违规 + 可能触法；且 DataDome 是动态指纹挑战，成本极高 |
| 临时邮箱批量 | 9-13 已实测：触发 10-15 次验证码且过不了 |
| 真人手动注册 1 个 | ✅ 唯一可行：人过验证 → 邮箱收码 → 一个号 |

## 与已有结论的印证

- 印证 `SIGNUP-WALLS-FINAL-CLASSIFICATION.md`："2026 年免费 key 全前置反羊毛，
  人机验证/OAuth/手机/实名四选一"
- 印证 `REGISTER-BATTLE-20260913.md`："CDP 只能解决我方浏览器自动化，解决不了
  人机验证——验证是设计来拦软件的"
- 印证 `OFFICIAL-FREE-RECHECK-20260914.md`：GitHub Models 已退役，多号无可薅额度

## 结论（决策固化）

- **批量注册 GitHub 账号：技术上不可行（DataDome 墙）+ 合规上不可做（ToS 禁自动化建号）**
- **copilot-api 反代链路：1 个真人号即可**（copilot-api README 亦警告多号批量触发
  GitHub 滥用检测 → 号全灭）
- 正确路径不变：用户已有 1 个 GitHub 号（用户自述"我已经注册过了"）→ device flow
  授权 → 启动反代 → 入池。code 已就绪（详见 MAC-COPILOT-RUNBOOK.md）。

## 状态账

- 本文件为只读取证产物；未创建账号、未产生 key、未改动池
- 待办：用户用已有号在 https://github.com/login/device 输入最新 device code 授权
  （auth 进程在 Mac 上存活，code 见 auth.log）