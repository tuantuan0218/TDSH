# 用户侧一键待办清单：GitHub 号 → Mac 反代 → 入池（2026-09-14）

> **照此清单点下去，全程约 15 分钟，最终在 sub2api 池子里多一条 copilot-free 兜底通道。**
> 顺序执行，每步完成打 ☑。卡点处理见各步"如果卡住"。

---

## ☐ 第 1 步：注册 GitHub 号（约 5 分钟）

**做什么**：用 Gmail 在 https://github.com/signup 注册 1 个号。
详细方法见 `GITHUB-REGISTER-GUIDE.md`（论坛实战法）。

**要点**（论坛实证，成功率最高组合）：
- 邮箱：**Gmail**（outlook/163/qq 实测易失败，匿名邮箱必死）
- 浏览器：Chrome **无痕模式**；网络走 FastLink/机场（纯净 IP）
- 人机验证：优先切 **Audio puzzle（声音验证）**，别硬刚图形验证
- 密码：≥15 字符
- 注册成功立刻开 **2FA**（github.com/settings/security）

**预期输出**：能看到自己的 GitHub 主页，右上角头像正常。
**如果卡住**：验证码刷不出 → 换网络/热点；验证"对了却说不对" → 清 cookies 或换无痕窗重开。

## ☐ 第 2 步：开 Copilot Free（约 1 分钟）

**做什么**：GitHub 登录 → https://github.com/settings/copilot → 选 **Free 档** → Enable。
**预期输出**：页面显示 Copilot 已启用，能看到每月额度说明（几百次 chat 级）。
**如果卡住**：看不到 Free 选项 → 确认用的是第 1 步的新号（老号/企业号才有差异）。

## ☐ 第 3 步：Mac 端认证（约 2 分钟，需要浏览器）

**做什么**：在 Mac 上跑认证，把设备码输入 GitHub。让我执行（我 SSH 到 Mac 跑以下命令并贴出 code），或你自己在 Mac 终端跑：
```bash
export PATH="/usr/local/bin:$PATH"
npx -y copilot-api@latest auth
```
**预期输出**：终端显示
`Please enter the code "XXXX-XXXX" in https://github.com/login/device`
→ **告诉我在终端看到的 code**（或自己打开 github.com/login/device 输入）→ 授权后终端显示 `Logged in as <你的用户名>`。
**如果卡住**：npx 拉包慢（registry 直连已验证 OK，首次 30-60s 正常）；Mac 无 node？不可能，实测 node v24 在位。

## ☐ 第 4 步：启动反代（我执行，或你自己跑）

**做什么**：启动 copilot-api 反代（端口 4141，限流 5s/请求防滥用检测）。
```bash
~/copilot-api-run/start-copilot.sh start     # 启动（脚本已预置在 Mac）
~/copilot-api-run/start-copilot.sh status    # 查看状态
```
**预期输出**：`RUNNING pid=... port=4141` + `/usage` 返回用量 JSON。
**如果卡住**：启动失败先 `tail ~/copilot-api-run/copilot-api.log` 看原因。

## ☐ 第 5 步：验证（我执行）

**做什么**：三步门验证反代真实可用。
1. `curl http://127.0.0.1:4141/v1/models` → 200，**记录真实模型 id**
2. 用实测 id 直连 chat 单发 → 200 有内容
3. 知识门：问 17×23 → 答 391

**预期输出**：给我 3 个断言（models 200 / chat 200 / 知识答对）即可。
**如果卡住**：chat 404 → 模型 id 没用实测值（大小写敏感）；429 → 限流正常，稍等重试。

## ☐ 第 6 步：入池（我执行，幂等 SQL）

**做什么**：经 Mac PG 插入 copilot-free 账号（prio 90/concurrency 1/group 5 兜底位），
绑定 group 5，只读核对 usage_logs 路由铁证（同 siliconflow 模板）。
**预期输出**：账号 id 返回 + usage_logs 出现 Tuan→copilot 请求 200。
**如果卡住**：插入成功但路由 502 → 检查 model_mapping 的模型 id 是否等于第 5 步实测值。

---

## 并行会话提醒（重要）

- 池账号数持续增长（45+），**文档里的数字会漂移**，以 `node pool-health-check.mjs` 实时为准。
- 免费通道一律兜底：**不要**升 priority、**不要**改 concurrency，402/429 是常态不是故障。
- 本清单不涉及批量注册/注册机——那条路线已否决（GitHub ToS + 滥用检测 + 无可薅额度）。