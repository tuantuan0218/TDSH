# reverse-proxies 备选通道盘点 — 2026-09-14

> 只读盘点工作区 `reverse-proxies/` 下的反代项目，评估能否作为合法扩池备选通道。
> 结论：**copilot-api 仍是唯一值得主推的**；其余两个各有硬伤。

## 盘点结果

| 项目 | 技术栈 | 功能 | 账号依赖 | 判定 |
|---|---|---|---|---|
| **copilot-api**（已落地） | Node/TS，npx 直跑 | GitHub Copilot → OpenAI/Anthropic 兼容 | 1 个 GitHub 号 + Copilot 订阅 | ✅ **主推**：Mac 已预置部署脚本，只差 device code 授权 |
| **copilot-openai-api** | Python FastAPI + Docker | GitHub Copilot → OpenAI 兼容（chat/embeddings/responses） | 1 个 GitHub 号 + Copilot 订阅 | ⚠️ 备选：与 copilot-api 同源（同一 Copilot 额度），**无增量**；Mac 无 Docker/Python 栈，部署成本更高 |
| **cursor-free-api (cursor2api)** | TypeScript | Cursor Docs 免费额度 → Anthropic/OpenAI 兼容 | Cursor 账号（免费额度） | ❌ **README 自述受限**："As of 2026-04-01, Cursor Docs page only provides gemini-3-flash. This project may have limited functionality."——额度极小，不值得接 |
| **claude-code-proxy** | Python | Claude Code CLI → 任意 OpenAI 兼容上游（适配器） | 依赖上游 API key | ❌ 不是免费渠道，是协议转换器；无独立额度价值 |

## 关键结论

1. **copilot-api 是唯一值得接的反代**：同一 Copilot 额度下，copilot-openai-api 不产生增量，
   cursor 免费档已枯竭（只余 gemini-3-flash），claude-code-proxy 无自带额度。
2. **真正能扩容池子的不是"更多反代"，而是"更多官方免费层"**：
   - NVIDIA NIM：82 模型 / 40 RPM（2026-09-14 复核 200）——需用户过 1 次 hCaptcha（U8）
   - OpenRouter：445 模型 / 19 个 :free（当日复核 200）——需主流邮箱（U9）
   - ModelScope：48 模型 / 每天 2000 次（当日复核 200）——需阿里云 token
   - SiliconFlow：401 token 失效——需充值或额度重置
3. **一份额度只对应一个接入点**：copilot 1 号 = 1 条通道；再多 GitHub 号 = 批量注册
   （ToS 违规 + DataDome 墙 + 滥用检测），已否决并取证。

## 状态账

- 只读盘点，无部署、无 key、无池改动
- copilot-api Mac 侧：启动脚本 `~/copilot-api-run/start-copilot.sh` 就绪，auth 进程存活，
  device code 在 `~/copilot-api-run/auth.log`，**等用户用已有 GitHub 号授权**即闭环