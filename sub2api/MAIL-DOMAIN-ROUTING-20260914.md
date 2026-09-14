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

## 三、下一步（已按选项丰富度选定）

1. 实测 `baosiapi.com` 的**注册赠送额度 + 单次签到奖励**（纯 REST + 自建邮箱，零人工）；
2. 若签到奖励有意义 → 按其规则批量养号（复用 `farm-columbina.mjs` 打法），过三步门后以
   **兜底位 prio90 / conc1 / group5** 入池；
3. 把 baosiapi 纳入每日签到看护（`free-checkin.mjs` 现在只看护"已入池"号，入池即自动被带）。
