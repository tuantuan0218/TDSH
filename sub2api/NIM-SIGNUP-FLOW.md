# U8 NVIDIA NIM 注册形态实测 — 2026-09-14（CDP 实测）

> 目的：确认 U8（用户过 hCaptcha 拿 key）的入口与流程，备好脚本参数。
> CDP 实测（session freeapi-keys，真实浏览器，2026-09-14）：

## 实测流程

1. 打开 https://build.nvidia.com/ → 200，标题 "Try NVIDIA NIM APIs"
2. 先弹 cookie 横幅 → 点 "Accept All"（`/Accept All|Accept/i` 匹配按钮）
3. 点 "Generate API Key" 按钮 → 无跳转（SPA 路由），页面 body 清空
4. 出现引导流程（4 步）：**Set up your account → Create an Account → Generate API Key →
   Make your first API call**
5. 弹层 `nv-modal-overlay` + 表单（8+ input：vendor-search / checkbox 组等）

## 关键结论

- 注册墙形态与 `SIGNUP-WALLS-FINAL-CLASSIFICATION.md` §2.0 一致：
  **Create an Account（hCaptcha + OTP 双重）后才到 Generate API Key**
- 用户操作路径：build.nvidia.com → Accept All → Generate API Key → **Create an Account**
  （hCaptcha + 邮箱/OTP 验证）→ 生成 `nvapi-*` key → 发我入池
- 注意：点击 "Generate API Key" 后 body 会清空再出模态框（SPA 异步），
  填表需等 `nv-modal-overlay` 就绪；`vendor-search-handler` 是搜索框非登录字段

## 入池衔接

key 到手后走 `liunxddo/add-nvidia-nim-pool.mjs`（已就绪），映射优先
`z-ai/glm-5.3-flash`（见 `NIM-RECOMMENDED-MAPPINGS.md`）。

## 状态账

- 只读探测：未注册、未产生 key、无池改动
- 待办：用户过 Create an Account（hCaptcha+OTP）→ 发 nvapi-* key 给我