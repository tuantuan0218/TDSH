# 本地 keyless 公益 API 网关

> 聚合实测可用的免费公共 API 为本地单入口，零依赖（node 内置模块）、无任何账号/key。
> 2026-09-13 实测 **14/14 源全绿**（二轮扩展：+lyrics/iss/dog/bible/qrcode/coffee）。

## 启动

**方式 A：双击启动（推荐，防连坐）**
双击 `start-keyless-gateway.cmd` —— 自动 cd 到脚本目录、日志重定向到同目录 `gateway.log`。
启动后窗口保持前台（关窗即停）。换端口：编辑 .cmd 里的 `set PORT=8787`。

**方式 B：命令行手动**
```powershell
node D:\tdsh\sub2api\liunxddo\keyless-gateway.mjs 8787
```

（默认端口 8787，可用参数覆盖；仅监听 127.0.0.1）

## 验证与停止

```powershell
curl http://127.0.0.1:8787/health   # 8 源健康状态（全 ok:true 即正常）
# 停止：关闭启动窗口（方式 A）或 Ctrl+C / kill 对应 node 进程（方式 B）
# 日志：D:\tdsh\sub2api\liunxddo\gateway.log（方式 A 自动追加）
```

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
| `/api/lyrics` | 歌词查询（lyrics.ovh） | `?artist=Queen&song=...` |
| `/api/iss` | 国际空间站实时位置 | |
| `/api/dog` | 随机狗狗图片 URL | |
| `/api/bible` | 圣经经文 | `?ref=john+3:16` |
| `/api/qrcode` | 二维码生成（返回 PNG） | `?data=hello&size=200x200` |
| `/api/coffee` | 随机咖啡图片 URL | |
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
- ✅ 歌词（api.lyrics.ovh）200 / ISS 位置（wheretheiss.at）200 / 狗狗图（dog.ceo）200
- ✅ 圣经（bible-api.com）200 / 二维码（qrserver）200 / 咖啡图（alexflipnote.dev）200
- ❌ ipapi.co TLS 失败（已剔除，勿加回）
- ❌ api.btstu.cn（壁纸/唐诗/毒鸡汤）TLS 失败（已剔除）
- ❌ boredapi.com 连接失败（已剔除）
- ❌ zhihu-daily 404 / douban-book 400 / bigdatacloud geo 400 / quotable TLS 拒（未采用）

## 安全与运维

- 仅监听 127.0.0.1；如需对外暴露请自行加反向代理鉴权
- 上游为免费公益服务，随时可能失效；/health 可监控
- 遵循 AGENTS：本文件与网关代码位于非 C 盘，未建任何 Windows 自动化任务
