# 邮箱域名接受度路由表（24 家邮件码站 × 自建域）— 2026-09-14

> 目的：把"要不要等人给常规邮箱"从模糊判断变成一张可路由的表。
> 探针纪律：**只允许自建可读域 `uberip.com`**，硬护栏拒绝任何第三方地址
> （工作区曾发生过用随机 `@qq.com` 触发发信的不当操作并自纠，见 `probe-whitelist-safe.mjs` 头注；
> 本轮沿用同一护栏，`--selftest` 拦截 4/4、放行 1/1 = PASS）。
> 复现：`node gh-mail-routing.mjs`（结论 json 落 `ghproxy/mail-routing.json`，gitignore 内不外传）。

## 一、结论总览（24 家 `email_code` / `email_code_ck`）

### ✅ uberip.com 放行 → **现在就能零人工全自动开户**（4 家）

| 站点 | 有签到 | 备注 |
|---|---|---|
| **baosiapi.com** | **✓ 有签到** | ⭐ 最高价值：**第二个"免第三方邮箱 + 签到给额度"的站**（昨日结论"GOLD_CK 仅 columbina 一家"被本轮实测推翻）。且仓内已有一个可用号（`gh-parked-audit.mjs` 读到 $0.09 / 1 令牌 / 今日已签 1 次） |
| api.tu-zi.com | · | 发码放行，但**注册要滑动验证**（昨日已记）→ 开户仍卡人机，只算"发码可用" |
| poolrouter.com | · | 放行、无签到 → 注册赠送多少待测 |
| tian-shu.org | · | 放行、无签到；仓内已有号但实测 **$0** → 低价值 |

### ❌ 域名白名单挡死（uberip 不可用，需常规邮箱）—— 20 家

`688.qzz.io` · `api.qfgapi.com` · `api.uu6.top` · `api.wuai.ai` · `api.ykh.ai` · `api.yunhe.one` ·
`api.ywcode.top` · `byesu.com` · `qiuqiutoken.com` · `sub2api.closeapi.top` · `www.sotamodel.net` ·
`wuai.ai` · `straitapi.com` · `api.hcnsec.cn` · `crowllm.com` · `beizhi.sylu.cc` ·
`api.openrealm.dev` · `ai.mrcwoods.com`（以上本轮/既有日志实证）
+ `cli.999554.xyz`（文案明示"**当前只允许 @qq.com 注册**"）
+ `api.aiaiai001.com`（文案明示"**目前仅支持 QQ 邮箱和 …**"）

## 二、这张表改变了什么

1. **不再需要"等一个常规邮箱"才能动**：`baosiapi.com` 一家就同时满足
   「自建域可收码 + 每日签到给额度」，可以按 columbina 的成熟打法（多号 + 每日签到）自持产能。
2. **`@qq.com` 专属的两家**（`cli.999554.xyz`、`api.aiaiai001.com`）：用户现有 `wcchengzi@qq.com`
   正好对得上 —— 若哪天愿意给一个 QQ 邮箱别名/新号，这两家立刻可开。
3. 其余 18 家要常规邮箱（gmail/qq/163），**钥匙只有一把**：用户给邮箱或注册完 GitHub，
   路由表直接决定先开哪家，不用再逐家试错。

## 四、baosiapi.com 实测结论（2026-09-14 新号一次性闭环，纯 REST）

- 注册配置：`register_enabled=true` / `password_register_enabled=true` /
  `email_verification=true` / `turnstile_check=false` / `checkin_enabled=true` /
  `quota_per_unit=500000`
- 自建 `uberip.com` 邮箱：`/api/verification` 200 `success:true`，6 位码 120s 内可达，
  `POST /api/user/register {username,password,email,verification_code}` 200 成功
  （登录为 cookie 会话形态，无 `access_token`，需 cookie + `New-Api-User` 头，
  与 FREE-API-SITES 开户三件套第 3 条一致）
- **注册赠送 = $0.0000；单次签到奖励 = $0.0307**（15346 units；签到前 $0 → 签到后 $0.0307）
- **建令牌后列表 0 行、拿不到明文 key** → chat 三步门在本轮无法闭环（需 UI 点"复制"）
- 判定：**不值得按 columbina 打法批量养号**（columbina 单次签到均值约 $114，
  baosiapi 仅 $0.03，差约 3700 倍；且不给注册赠送）。保留为"自建域可收码"路由，
  不列入产能。
- 修正上文 §一"第二个 GOLD_CK"的说法：baosiapi 有签到但奖励可忽略，
  **GOLD_CK 仍只有 columbina 一家**，原结论维持。
