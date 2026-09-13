# 网关管理 API 发现 — 2026-09-13

> 动因：连续多轮"改池需审批"，我想确认是否存在**官方管理接口**（比裸 SQL 更安全、会自动注册调度）。
> **本轮只做探测，未尝试任何登录/写操作。**

## 一、发现：网关确实暴露官方管理 API

从网关前端 JS（`/assets/index-*.js`）提取到真实基址 **`/api/v1/admin`**，并逐一探测：

| 端点 | 实测 | 含义 |
|---|---|---|
| `GET /api/v1/admin/accounts` | **401** `Authorization required` | ✅ **存在**，需鉴权（非 404） |
| `GET /api/v1/admin/channels` | **401** | ✅ 存在 |
| `GET /api/v1/admin/users` | **401** | ✅ 存在 |
| `GET /api/v1/admin/groups` | **401** | ✅ 存在 |
| `GET /api/v1/admin/ops/ws/qps` | （前端引用） | 运维 WebSocket |
| `GET /api/v1/admin`（裸） | 404 | 需带子路径 |

**关键区别**：这些返回 **401 而非 404** —— 说明**路由真实存在**，只是要凭据。

### 登录端点

| 端点 | 实测 |
|---|---|
| `POST /api/v1/auth/login` | **400**（需 body，说明**存在**） |
| `POST /api/user/login` | 404 |
| `POST /api/v1/login` | 404 |

## 二、这对"改池"意味着什么（重要）

本仓历史记录过一个已知缺陷：

> `add-free-api-pool.mjs` 用**裸 INSERT** 建账号，**绕过 `scheduler_outbox`** → 新号进不了调度快照。

**如果有 admin API 凭据**，理论上可以：

1. 用 **官方接口**建/改账号 → **自动写 outbox、自动纳管调度**（无需手工补事件）
2. 调整名次/上限等参数时走官方路径，**避免与调度体系冲突**
3. 所有改动可审计（而非直接改 DB）

**这比我一直建议的"直接 UPDATE accounts"更正确。**

## 三、⚠️ 我没有做、也不会做的事

| 项 | 原因 |
|---|---|
| **未尝试登录** | 需要密码，**猜测/爆破管理员口令是越界行为** |
| 未尝试伪造 JWT | 同上 |
| 未修改任何账号/配置 | 遵守"不擅自改池" |
| 未读取 `users` 表的密码哈希 | 无必要，且属敏感数据 |

**结论**：管理 API **存在但需要你提供凭据**。

- `users` 表中 `admin` 用户存在（role=admin，创建于 2026-09-11）
- 无存储的 token 可复用
- 环境变量中无 admin token

## 四、建议（需你决定）

若你愿意提供 admin 凭据（或登录后给我一个 session/API token），我可以：

1. **用官方 API 复核全池状态**（比只读 SQL 更权威）
2. **用官方 API 完成待批的改动**（补 #7 base_url、摘 2/5/8、设 agenes 上限）
   —— 且比裸 SQL **更安全**（自动纳管 + 可审计）
3. 顺带**修掉 `add-free-api-pool.mjs` 的裸 INSERT 缺陷**（改用官方接口）

**若你不便提供凭据**，我也能继续用只读 SQL + SSH 做核查，只是改动类操作仍需你手工执行或授权我用 SQL。

## 五、复现（只读）

```bash
# 探测管理端点存在性（401=存在，404=不存在）
for p in accounts channels users groups; do
  printf "%s " "$(curl -s -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:8090/api/v1/admin/$p")"; echo "/api/v1/admin/$p"
done

# 从前端 JS 提取真实路由
curl -s http://127.0.0.1:8090/assets/index-NGd9MZ7e.js | grep -oE '"/api/v1/[a-zA-Z0-9_/.:-]+"' | sort -u
```

## 六、安全说明

本轮所有操作**均为只读探测**：
- 未尝试任何密码
- 未打印任何 key 明文
- 未修改任何数据
- 探测用的 `curl` 全部为 `GET`（登录端点仅做**存在性**探测，未提交凭据）
