# 本地 keyless 公益 API 网关

> 聚合实测可用的免费公共 API 为本地单入口，零依赖（node 内置模块）、无任何账号/key。
> 2026-09-13 实测 6/6 源均 200。

## 启动

```powershell
node D:\tdsh\sub2api\liunxddo\keyless-gateway.mjs 8787
```

（默认端口 8787，可用参数覆盖；仅监听 127.0.0.1）

## 端点

| 端点 | 说明 | 备注 |
|------|------|------|
| `/health` | 各上游健康状态（并发探测） | |
| `/api/hitokoto` | 一言（中文句子） | `?cat=d` 选类型 |
| `/api/60s` | 60 秒读懂世界（今日资讯） | |
| `/api/weather` | 天气 JSON（wttr.in） | `?city=北京` 可选 |
| `/api/rate?base=CNY` | 汇率（exchangerate-api） | 默认 USD |
| `/api/joke` | 英文随机笑话 | |
| `/api/catfact` | 随机猫事实 | |
| `/api/zip` | 邮编地理查询 | `?country=us&code=90210`（zippopotam.us 仅部分国家） |
| `/api/advice` | 随机人生建议（英文） | |
| 任意端点加 `?raw=1` | 原样透传上游 JSON | |

## 实测记录（2026-09-13）

- ✅ 一言 hitokoto（v1.hitokoto.cn）200
- ✅ 60s（60s.viki.moe/v2/60s）200
- ✅ 天气（wttr.in/?format=j1）200
- ✅ 汇率（api.exchangerate-api.com/v4）200
- ✅ 笑话（official-joke-api.appspot.com）200
- ✅ 猫事实（catfact.ninja）200
- ✅ 邮编地理（api.zippopotam.us）200
- ✅ 人生建议（api.adviceslip.com）200
- ❌ ipapi.co TLS 失败（已剔除，勿加回）
- ❌ api.btstu.cn（壁纸/唐诗/毒鸡汤）TLS 失败（已剔除）
- ❌ boredapi.com 连接失败（已剔除）

## 安全与运维

- 仅监听 127.0.0.1；如需对外暴露请自行加反向代理鉴权
- 上游为免费公益服务，随时可能失效；/health 可监控
- 遵循 AGENTS：本文件与网关代码位于非 C 盘，未建任何 Windows 自动化任务
