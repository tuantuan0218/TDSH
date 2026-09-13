# CF Worker 无限免费绘图 API 部署包（linux.do 帖 222639）

> 来源：linux.do/t/topic/222639（wangdefa 第四弹，2024-10）；代码提取自原始帖，
> 语法已验证完整（node --check 通过）。
> 原理：用 Cloudflare Workers AI 的免费额度（每天 10,000 神经元 / 约 100 张图）跑
> FLUX.1 / SDXL 等绘图模型，包装成 OpenAI 兼容 `/v1/chat/completions` + `/v1/models`，
> 可直接接入 one-api / new-api / sub2api 池。**无第三方 key 依赖，仅需 CF 账号**。

## 一、前置（受限项：需用户注册）

1. **Cloudflare 账号**：https://www.cloudflare.com 免费注册
   - 控制台 → Workers & Pages → 创建 Worker → 粘贴 `cf-worker-drawing.js` 代码 → 保存并部署
   - Workers AI 免费额度：每天 10,000 神经元（免费版自动包含），FLUX.1 约 100 张/天
2. （可选）**sm.ms 图床 key**：https://sm.ms 申请；为空时 API 返回 base64 图片

## 二、Worker 配置（代码内三个常量）

```js
const API_KEY = "sk-1234567890";        // ← 改成自己的强随机 key（入池时用）
const SMMS_API_KEY = '';                // ← 留空返回 base64，或填 sm.ms key
const CF_ACCOUNT_LIST = [{
  account_id: "xxxxxxxxx",              // ← 控制台首页可查 account id
  token: "xxxxxxxxx"                    // ← Workers AI token（控制台→API Tokens→创建）
}];
```

## 三、部署步骤（Cloudflare 控制台 / wrangler 二选一）

### 方式 A：网页控制台（最简单）
1. dash.cloudflare.com → Workers & Pages → Create → Worker
2. 删除模板代码 → 粘贴 `cf-worker-drawing.js` 全文 → Deploy
3. 记下 worker 域名：`https://<name>.<subdomain>.workers.dev`

### 方式 B：wrangler CLI（可脚本化）
```bash
npm i -g wrangler
wrangler login                 # 浏览器授权（或 CLOUDFLARE_API_TOKEN 环境变量）
wrangler deploy cf-worker-drawing.js --name cf-drawing
```

## 四、验证命令（部署后立即测）

```powershell
# 1. 未授权应 401
curl https://<name>.<subdomain>.workers.dev/v1/models
# 2. 带 key 应 200 列出模型
curl -H "Authorization: Bearer sk-你的key" https://<name>.<subdomain>.workers.dev/v1/models
# 3. 生图测试（test 模型 = 测速用，不真画图）
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer sk-你的key" `
  -d '{"model":"test","messages":[{"role":"user","content":"hi"}],"stream":false}' `
  https://<name>.<subdomain>.workers.dev/v1/chat/completions
# 4. 真绘图（FLUX.1，图片以 base64 返回）
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer sk-你的key" `
  -d '{"model":"FLUX.1","messages":[{"role":"user","content":"a cute cat --16:9"}],"stream":false}' `
  https://<name>.<subdomain>.workers.dev/v1/chat/completions
```

## 五、模型清单（CUSTOMER_MODEL_MAP）

| 模型 id | 底层 CF 模型 | 说明 |
|---------|-------------|------|
| test | — | 测速用，不绘图 |
| FLUX.1 | @cf/black-forest-labs/flux-1-schnell | 默认，速度快 |
| dreamshaper-8 | @cf/lykon/dreamshaper-8-lcm | LCM 加速 |
| stable-diffusion-xl-base | @cf/stabilityai/stable-diffusion-xl-base-1.0 | |
| stable-diffusion-xl-lightning | @cf/bytedance/stable-diffusion-xl-lightning | |
| stable-diffusion-v1-5 | @cf/runwayml/stable-diffusion-v1-5-inpainting | 支持 img2img |
| stable-diffusion-v1-5-img2img | @cf/runwayml/stable-diffusion-v1-5-img2img | img2img |

- 比例参数：`--1:1 --1:2 --3:2 --4:3 --16:9 --9:16`
- 翻译开关：`--tl` 强制翻译优化提示词 / `--ntl` 关闭
- img2img：prompt 里附图片 URL 即可

## 六、接入 sub2api Tuan 池（部署成功后）

```powershell
$env:SF_NAME="cf-drawing"; $env:SF_BASE="https://<name>.<subdomain>.workers.dev/v1"
$env:SF_KEY="sk-你的key"
$env:SF_MODELS='{"Tuan":"FLUX.1"}'
node add-free-api-pool.mjs
```
（Tuan 池若只调度文本模型，绘图渠道可按需独立接入 one-api/new-api 侧。）

## 七、注意事项

- 免费额度：每天 10,000 神经元，FLUX.1 约 100 张；用完次日重置
- Workers AI 是共享 GPU，高峰期可能排队/超时（正常）
- 代码中的 API_KEY 是 Worker 侧鉴权，与 Tuan 池 account key 是同一把
- 若 CF 模型下架（如 qwen1.5 翻译模型被替换），把 CF_TRANSLATE_MODEL 换成
  `@cf/qwen/qwen1.5-14b-chat-awq` 现有模型或改 false 关闭翻译
