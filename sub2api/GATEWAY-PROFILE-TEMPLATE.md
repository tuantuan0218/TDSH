# 网关档案模板（GATEWAY-PROFILE-TEMPLATE）— 通用 LLM 网关建档方法

> 由 olomc 深度画像（`OLOMC-GATEWAY-PROFILE-20260914.md`）提炼的**通用方法**。
> 对池内任何"纯主机名 base"的站：先建档 → 再入池/修 chatPath，杜绝"巧合正确"。

## 一、何时用

- store 里 base 为纯主机名（无路径前缀）的新站要入池；
- 某站被 `free-lane-audit` 报 BAD 且错误是 404/HTML（疑似假 BAD）；
- 想给池子评估"第二映射"候选模型。

## 二、五分钟建档流程（全部只读、无 key）

```bash
# 1) 公共端点探测（status/stats/catalog 各系通用端点）
node gateway-probe.mjs https://<host> --models --chat
```

1. **公共端点**：`/api/status`（new-api 系）、`/stats.json`、`/gw/catalog`（自研网关）、
   `/gw/v1/models`、`/v1/models`（标准 OpenAI 兼容）——200=公开、401=存在需认证。
2. **API 前缀扫描**：逐一试 `/v1` `/gw/v1` `/api/v1` `/openai/v1` `/v1beta` `/oai/v1`，
   401 即该前缀为真实 OpenAI 兼容路径 → **这就是 chatPath 的前半段**。
3. **chat 认证形态**：POST 无 key，看 401 错误格式（`invalid_api_key`=标准、
   `Invalid token`=new-api 系、`Unauthorized`=其他）。
4. **目录/来源**：若有 `/gw/catalog` 或 `/api/models`，拉模型清单与上下文参数
   （cl/mo/by 字段 = 权威来源标注）。
5. **探活路径定案**：`chatPath = <真实前缀>/chat/completions`，
   `verifiedModel = <实测存在且热的模型名>`（防 audit 回退成 grok-4.5 之类假 BAD）。

## 三、档案字段（一个站一段，填进池台账）

```markdown
### <tag>（<host>）
- 类型: new-api系 / 自研网关 / 其他
- base: <store 里现值>          ← 是否纯主机名？
- 真实API前缀: /v1 或 /gw/v1 或 …
- chatPath: <定案值>            ← 无前缀站 = 不填（默认拼法正确）
- verifiedModel: <热模型>
- 协议: openai / anthropic / 双协议（看 /v1beta 是否 401）
- 公共端点: stats/catalog/status 可用性
- 来源标注（by 字段）: <autoclaw-relay/workbuddy/windsurf/官方/无>
- 风险: 522源站挂 / 429连败 / 名义模型非直连 / key不对外分发
```

## 四、坑位清单（本模板源自的实测教训）

1. **纯主机名 base ≠ 路径正确**：new-api 系站根路径就是 /v1（巧合正确），
   自研网关常带前缀（olomc=/gw/v1）→ 必须实测前缀，别猜。
2. **探测请求过密会自伤**：14 站连打时 sudobug/tmlab/tokenra 的 /v1 首轮被误判，
   二轮间隔充足后 401 确认 → **重测优先于下结论**（同 DECISION-CARD 探针自伤提醒）。
3. **CF 522 是站点故障不是配置**：beizhi.sylu.cc 浏览器 UA 也 522 → 别把 audit BAD
   归因为 chatPath 问题；台账标注"源站故障待复查"。
4. **audit 默认拼法只对无前缀站成立**：任何 chatPath 覆盖都必须与 DB base_url 对账
   （`free-lane-pathcheck.mjs`），静态探测只解决"猜对前缀"，不替代 DB 权威比对。
5. **"名义模型"提醒**：resp/ 前缀、utility/ 前缀多为第三方映射，模型行为≠官方；
   涉及隐私/生产用途前先做一次真词验证。

## 五、与既有工具的关系

| 工具 | 定位 |
|---|---|
| `gateway-probe.mjs` | 新站建档探针（本文档配套，只读） |
| `free-lane-pathcheck.mjs` | store↔DB 路径漂移权威比对（需 Mac SSH） |
| `free-lane-audit.mjs` | 池健康审计（读 store 探活） |
| `free-pool-add.mjs` | 入池（含 chatPath/verifiedModel 校验） |
