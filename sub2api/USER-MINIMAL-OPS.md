# 用户侧最短操作清单 — 一条命令一通道（2026-09-14）

> 你只需做下表"你的动作"列，跑完任一通道把 key/code 发我，我 10 分钟闭环入池。
> 全部在 Windows PowerShell 或浏览器操作，无需碰 Mac。

---

## 🥇 BazaarLink（门槛最低，优先）

1. 浏览器打开 https://bazaarlink.ai/keys
2. 点 "Sign up" → 填 Name + Email + 密码(≥8) + Confirm → Turnstile 点一下 → Create account
3. 控制台复制 `sk-bl-` 开头的 key
4. **发我 key**，我跑 `bash bazaarlink-pool.sh "sk-bl-xxx"` 30 秒入池

或你自己入池（拿到 key 后）：
```powershell
bash -c 'BAZ_KEY=<你的key> bash D:\tdsh\sub2api\pool-entry.sh BAZAARLINK'
```

## 🥈 copilot（需已有 GitHub 号）

1. 浏览器打开 https://github.com/login/device
2. 输入 device code **`F127-8205`**（可能过期，过期告诉我我重发）
3. 授权 → 告诉我"授权了"，我跑 Mac 一键入池 `bash pool-entry.sh COPILOT`

## 🥉 NIM（40 RPM / 82 模型）

1. 浏览器打开 https://build.nvidia.com → Accept All → Generate API Key → Create an Account
2. 过 hCaptcha + OTP → 控制台复制 `nvapi-` 开头 key
3. **发我 key**，我跑 `bash -c 'NIM_KEY=<key> bash D:\tdsh\sub2api\pool-entry.sh NIM'`

## 4. OpenRouter（445 模型 / 19 free）

1. 浏览器打开 https://openrouter.ai → Sign up（给主流邮箱，过 Turnstile）
2. 邮箱验证 → Keys 页复制 `sk-or-v1-` key
3. **发我 key**，我跑 `bash -c 'OR_KEY=<key> bash D:\tdsh\sub2api\pool-entry.sh OPENROUTER'`

## 5. 池优化（一句话）

- 说 **"同意A"** → 我执行僵尸账号处置（#2/#5/#8 schedulable=false，3 行 SQL）
  + error_owner 误标修复（400 归 client，调度口径改）

---

## 说明

- **BazaarLink 最快**（2 分钟，无信用卡无审核，Turnstile 点一下），建议优先
- copilot 需要你**已有** GitHub 号（批量注册已被 DataDome 墙否决，无合法替代）
- 任一通道完成即扩池成功；可多选并行（不同通道互不冲突）
