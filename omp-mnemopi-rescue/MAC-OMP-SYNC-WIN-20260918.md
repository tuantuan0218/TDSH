# Mac omp 配置 ← 对齐 Windows（WSL）侧 — 2026-09-18 15:25 完成

## 1. 做了什么

把 Mac（192.168.1.3 / zhaozicheng）的 omp 两件套，**逐字节替换**为本机 Windows 侧（WSL Ubuntu `/root/.omp/agent/`）的权威配置：

| 文件 | Mac 路径 | 改前 sha256(前8) / 大小 | 改后 sha256(前8) / 大小 | 与 WSL 一致 |
|---|---|---|---|---|
| `models.yml` | `/Users/zhaozicheng/.omp/agent/models.yml` | `20e14302` / 1713 B | **`e230a4db`** / 3305 B | ✅ 完全一致 |
| `config.yml` | `/Users/zhaozicheng/.omp/agent/config.yml` | `f2b92452` / 1940 B | **`07a01558`** / 2808 B | ✅ 完全一致 |

**一致性证据**：WSL 侧 `shasum -a 256` 输出与上表"改后"哈希逐字符相同
（`e230a4dbbfdb0bda92a7598ed71760dd71177c9876178c7c74637d7f39e1588c` /
`07a01558ca6fe3cf4a78be6ed9d581c09219ad9541d2f78668c9b8f505c30397`）。

## 2. 备份（可一键回滚）

```
/Users/zhaozicheng/.omp/agent/models.yml.bak-beforesync-1789716304   (1713 B, 原 mtime Aug 18 21:30)
/Users/zhaozicheng/.omp/agent/config.yml.bak-beforesync-1789716304   (1940 B, 原 mtime Aug 17 22:58)
```
回滚 = 把 `.bak-beforesync-1789716304` 后缀去掉覆盖回原文件名。

## 3. 配置内容（**密钥已打码，本地明文见 Mac/WSL 上的文件**）

### providers（7 个，全部 `api: openai-completions` / `auth: apiKey`）

| provider | baseUrl | models | apiKey |
|---|---|---|---|
| `agnes` | `https://apihub.agnes-ai.com/v1` | agnes-2.0-flash, claude-fable-5, grok-4.5 | `sk-wr****fBr` |
| `agnes-bak1` | 同上 | 同上 | `sk-Bu****I2BY` |
| `agnes-bak2` | `https://api.agnes-ai.cn/v1` | 同上 | `sk-H9****nkGR` |
| **`olo`**（主） | `https://voyager.olomc.top/gw/v1` | `cb/deepseek-v4.1-flash` | `olo_ab****ae73` |
| **`aio`**（副） | `https://freeshare.cc.cd/v1` | `deepseek-v4.1-flash` | `sk-bm****X9z` |
| **`tuan`**（兜底） | `https://api.xn--20t60kxs4bjxb.top/v1` | `Tuan` | `sk-d7****e21` |
| `wb`（局域网） | `http://192.168.1.3:7863/v1` | `deepseek-v4.1-flash` | `5a7a****ab7` |

`olo` / `aio` / `tuan` 带 `compat.supportsDeveloperRole: false`；`tuan` 另带 `supportsReasoningEffort: false`
（实测：Tuan 收到 `reasoning_effort` 会挂死 90s）。

### modelRoles / fallback 链（config.yml）

- 主线角色 `default / task / plan / slow / advisor / mimo` → **`olo/cb/deepseek-v4.1-flash`**
- 视觉/提交/设计/轻量角色 `vision / commit / designer / smol / tiny / mimo-fast / agnes*` → `agnes/agnes-2.0-flash`
- 主线 fallback 链：`olo → aio → wb → tuan`
- agnes 链：`agnes → agnes-bak1 → agnes-bak2 → olo → aio → wb → tuan`
- `maxRetries: 8`，`fallbackRevertPolicy: cooldown-expiry`

> 2026-09-17 背景：原 `yunshu` 订阅到期（403 SUBSCRIPTION_NOT_FOUND），主线已全部迁到 `olo`。
> Mac 侧改前仍指向 `yunshu/deepseek-v4-flash` —— 这就是"Mac 上 omp 不好使"的直接原因。

## 4. 改后实测（Mac 出口，真实 completion 探针，问「17×23」）

| provider | Mac 直连 | Mac 走本地代理 127.0.0.1:7897 | 判读 |
|---|---|---|---|
| `olo` | **HTTP 200**，出词 `391`，20.1s | HTTP 000（超时） | ✅ **主力可用，且必须直连** |
| `aio` | HTTP 000（连不上） | **HTTP 200** 出词 | ⚠️ **必须走代理**，直连不通 |
| `tuan` | **HTTP 200** 出词 | HTTP 000 | ✅ 兜底可用（直连） |
| `wb`（LAN 桥） | HTTP 503 `no_healthy_account` | 同 | ❌ 桥上无健康号，与本地池状态一致 |
| `agnes` | HTTP 429 免费用户限流 | 同 | ❌ 免费额度打满（agnes-bak1/2 备用） |

**结论**：新配置在 Mac 上**至少 3 条道真能出词**（olo 主 / tuan 兜底 直连；aio 走代理）。
⚠️ **注意 `olo` 与 `aio` 对代理的需求正好相反**——omp 是全局单代理设置，无法按 provider 分别设定
（已 grep 二进制确认：只有 `httpProxy/httpsProxy/noProxy` 这类全局环境变量，无 provider 级 proxy 字段）。
当前 `com.omp.plist` 里是 `unset ... http_proxy https_proxy`（即**无代理**），所以 olo/tuan 走通、aio 走不通。
这属于可接受状态：主线 olo 已通，aio 仅为副链第二跳。

## 4b. 副产物（追加，15:20）：`olo/aio` 代理互斥已解决

发现 omp **不支持 per-provider proxy**（grep 二进制：只有全局 `httpProxy/httpsProxy/noProxy`），
但 Mac 实测三条道对代理的需求互相冲突：olo/tuan 必须**直连**、aio 必须**走代理**。

**解法（零侵入，不碰 omp 本体）**：全局开代理 + `NO_PROXY` 白名单放行直连域名。
已落地为启动包装脚本 `~/.local/bin/omp-with-proxy.sh`：

```bash
export HTTPS_PROXY=http://127.0.0.1:7897
export NO_PROXY='voyager.olomc.top,api.xn--20t60kxs4bjxb.top,192.168.1.3,localhost,127.0.0.1'
exec ~/.local/bin/omp "$@"
```

**包装环境实测（2026-09-18 15:20，真实 completion）**：

| provider | HTTP | 出词 |
|---|---|---|
| `olo` | **200** | `391` ✅ |
| `aio` | **200** | 正常出词 ✅ |
| `tuan` | **200** | ✅ |

即**副链第二跳 aio 由"完全不可用"变为可用**，且主线 olo/tuan 不受影响。

**启用方式**（需你手动，属进程边界我没动）：
- 方式 A（临时）：终端里直接 `omp-with-proxy.sh` 代替 `omp`
- 方式 B（永久）：把 `com.omp.plist` 的 ProgramArguments 末项 `omp-bin` 换成
  `/Users/zhaozicheng/.local/bin/omp-with-proxy.sh`，然后重启该 LaunchAgent
  —— **需要你点头**，因为会重启常驻进程；且该 plist 的字符串区有损坏字节段，改它有风险，
  所以我**没有**替你改。

> Windows/WSL 侧**不需要**这个包装：WSL 出口 `freeshare.cc.cd` 直连可达（`/models` 回 401 而非 000），
> 三道均为直连，故两侧行为差异属网络出口所致，非配置差异。

## 5. 生效条件（需用户操作）

omp 只在**会话启动时**读一次 config/models。Mac 上当前仍有：
- pid 90791 `omp __omp_worker_mnemopi_embed`（后台 embed worker）
- pid 757 `omp_bridge_mac_v4.js`（:9015 桥）
- LaunchAgent `com.omp` 用 `omp-bin` 常驻（KeepAlive=true）

**已落盘的新配置对已运行的进程不生效；新开的 omp 会话即刻生效。**
未做任何 kill / 重启（进程边界，需用户点头）。

## 6. 未做 / 待批

- ❌ 未重启或 kill 任何 Mac 上 omp 进程（用户未授权）
- ❌ 未升级 omp（双方同为 17.3.0，无需）
- ❌ 未改 `com.omp.plist`（其 ProgramArguments 字符串区有损坏字节段，改它风险高且非必需）

## 7. 复现 / 验证命令

```bash
# 只读比对（Mac 侧）
shasum -a 256 ~/.omp/agent/models.yml ~/.omp/agent/config.yml
# 期望: e230a4db...  /  07a01558...

# 列出生效 provider
omp models | head -40

# 回滚
cd ~/.omp/agent
cp -p models.yml.bak-beforesync-1789716304 models.yml
cp -p config.yml.bak-beforesync-1789716304 config.yml
```
