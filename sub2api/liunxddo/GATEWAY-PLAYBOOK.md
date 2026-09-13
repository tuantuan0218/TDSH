# keyless 公益 API 网关建设 Playbook（可复用指南）

> 来源：2026-09-13 六轮源扩充实战（6→8→14→17→23→26→33 源），沉淀为通用流程。
> 目标读者：后续任何"聚合免费公共 API 为本地单入口"的任务。

## 一、完整流程（六步闭环）

```
1. 候选探测   → 2. 筛选加入   → 3. 语法+重启 → 4. 全源验证 → 5. 文档同步 → 6. 备份
```

### 步骤 1：候选探测（每次 8-10 个候选）
```powershell
# 批量探测 HTTP 状态码 + 响应体大小（小响应体顺便看内容）
$sites=@{'name1'='url1';'name2'='url2'}; foreach($k in $sites.Keys){
  $code=curl.exe -sS --max-time 12 -o "$env:TEMP\x_$k.json" -w "%{http_code}" $sites[$k] 2>&1
  $sz=(Get-Item "$env:TEMP\x_$k.json" -ErrorAction SilentlyContinue).Length
  echo "$k => $code (${sz}b)" }
```
**筛选标准**：
- ✅ 200 + 有真实 JSON 内容 → 加入
- ⚠️ 301/308 → 用 `-L` 跟随重测，可用则加（网关已支持 301 跟随）
- ⚠️ 401/403 → 需 key 或 Cloudflare 挑战页（Cerebras 403 是 CF 页非数据）→ 剔除
- ❌ TLS 拒（schannel 35）/ 404 / 超时 → 剔除并记录
- 同源去重：已有同域（如 open-meteo=weather2 已有）不重复加

### 步骤 2：筛选加入（SOURCES 统一格式）
```js
name: {
  url: (p) => `https://.../${encodeURIComponent(p.param || 'default')}`,
  desc: '中文描述（.md 也同步）',
  headers: { Accept: 'application/json' },   // 仅需要特殊头时（如 icanhazdadjoke）
  skip_health: true                          // 仅代理下抖动频繁的源（见踩坑）
}
```
参数用 `?key=value` 透传，`p.xxx` 读取，默认值兜底。

### 步骤 3：语法 + 重启
```powershell
node --check keyless-gateway.mjs     # 必须先过
# 重启：kill 旧 job → 清 gateway.log → cmd /c start-keyless-gateway.cmd（后台 job）
```
⚠️ 重启后必须实测，不能只靠语法检查。

### 步骤 4：全源验证
```powershell
curl http://127.0.0.1:8787/health    # 看 ok + ok_count/total + 失败源列表
# 新源各发一请求看真实数据（不是只看 200）
```

### 步骤 5：文档同步（防漂移）
- `KEYLESS-GATEWAY-README.md`：源表 + 实测记录 + 失败剔除记录（三处都要改）
- `FREE-API-CHANNELS.md`：网关源数 + 功能描述
- `TUAN-POOL-HANDOVER.md`：恢复点（进程 PID/重启方式/源清单）

### 步骤 6：备份
```powershell
cd D:\tdsh; git add sub2api/liunxddo/; git commit -m "sub2api: liunxddo 网关N轮扩展至M源(...)"; git push origin main
# 注意：commit message 含 $/% 用单引号（AGENTS §8.12），推送后 ls-remote 验证
```

## 二、踩坑清单（实测教训）

| # | 坑 | 现象 | 解法 |
|---|----|------|------|
| 1 | **代理 TLS 抖动** | `Client network socket disconnected before secure TLS connection was established`，间歇性 | 区分"代码 bug"与"网络层抖动"：直测 200 但网关偶败 = 上游/网络问题；多次重试确认；持续失败源标 `skip_health`（不进健康判定，路由保留） |
| 2 | **任一源失败即整体红** | 一个公益源抖动导致 /health ok=False | 改为**可用率 ≥90% 即 ok**（公益源抖动是常态），返回 `ok_count/total` 明细 |
| 3 | **301/302 不跟随** | 源返回 301 但网关原样透传 | fetchUrl 加 301/302/307/308 跟随（最多 3 跳，处理相对 Location） |
| 4 | **需要特殊请求头** | icanhazdadjoke 默认返回 HTML | SOURCES 支持 `headers` 字段 → fetchUrl 透传 |
| 5 | **.cmd 中文注释乱码** | cmd.exe GBK 解析 UTF-8 中文报 `'y.log' is not recognized` | 启动脚本纯 ASCII；中文说明放 README |
| 6 | **curl 走代理环境变量** | 探测 127.0.0.1 的 DeepLX 也走 7897 代理 → 400 | 探测本地服务用 node 直连，或确认 curl 没吃 HTTP_PROXY |
| 7 | **Cerebras 403 误判** | 403 响应体 5KB 看着像数据 | 403 是 Cloudflare 挑战页（HTML），非 API 数据 → 需 key |
| 8 | **缓存陈旧** | 二维码等动态内容被缓存 | qrcode 排除缓存；其它 TTL 60s 足够 |
| 9 | **keyless 源时效差** | 老帖公益站大量失效（7xnn/图床/Pixiv） | 入池前必实测；失效源记录在 README"已剔除"清单 |

## 三、健康判定设计（v2 沉淀）

```
/health 返回：
  ok: 可用率≥90% 或全部跳过
  ok_count/total: 探测通过数/参与探测总数
  sources[]: 每源 status + ok + error（skip_health 源标 skipped 不计入 total）
设计动机：公益 API 源抖动是常态，单源失败不判整体挂；但明细保留，谁挂了看得见。
```

## 四、性能与安全基线

- 零依赖（node 内置 http/https），仅监听 127.0.0.1
- 缓存 TTL 60s / 限流每 IP 10s 30 次（防误刷，非精确）
- 优雅错误 JSON：含 source 名 + 降级提示（`/health` 看状态）
- 不在 C 盘落盘（本机准则 §1）；不注册任何计划任务/服务（准则 §2）
