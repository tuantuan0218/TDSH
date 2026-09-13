# 本地 keyless 公益 API 网关

> 聚合实测可用的免费公共 API 为本地单入口，零依赖（node 内置模块）、无任何账号/key。
> 2026-09-13 实测 **33 源**（六轮扩展，含汇率/天气/笑话/猫图双源；支持 301/302 跟随与
> per-source headers）。
> **v2 功能**：内存缓存（TTL 60s，X-Cache: MISS/HIT 可查）、简单限流（每 IP 每 10s 30 次）、
> 优雅错误 JSON（含 source 名+降级提示）。
> ⚠️ openlib/lyrics 在代理环境间歇 TLS 抖动（直连/家庭宽带预计稳定），其余源稳定。

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
| `/api/gender` | 姓名性别预测（genderize.io） | `?name=chen` |
| `/api/agify` | 姓名年龄预测（agify.io） | `?name=chen` |
| `/api/openlib` | 开放图书馆书目 | `?id=OL7353617M`（⚠️ 代理下间歇 TLS 抖动） |
| `/api/lyrics` | 歌词查询（lyrics.ovh） | ⚠️ 代理下间歇 TLS 抖动 |
| `/api/cat` | 随机猫图（thecatapi） | |
| `/api/postcodes` | 英国随机邮编（postcodes.io） | |
| `/api/rickmorty` | 瑞克与莫蒂角色 | `?id=1` |
| `/api/swapi` | 星球大战人物（SWAPI） | `?id=1` |
| `/api/jokeapi` | 随机笑话（JokeAPI） | |
| `/api/zenquotes` | 名言金句（ZenQuotes） | |
| `/api/currency2` | 汇率（Frankfurter 欧洲央行） | `?from=USD&to=CNY`（支持重定向） |
| `/api/weather2` | 天气（Open-Meteo） | `?lat=39.9&lon=116.4` |
| `/api/memes` | 随机梗图（Meme API） | |
| `/api/ipify` | 公网 IP（ipify） | |
| `/api/randomuser` | 随机用户资料（randomuser.me） | |
| `/api/drug` | FDA 药品不良事件（openFDA） | |
| `/api/football` | 足球赛事（football-data.org） | `?id=PL` |
| `/api/chuck` | Chuck Norris 笑话 | |
| `/api/eq` | 全球 24h 地震（USGS） | |
| `/api/dadjoke` | 爸爸笑话（icanhazdadjoke） | |
| 任意端点加 `?raw=1` | 原样透传上游 JSON | |

## 实测记录（2026-09-13）

- 🔬 **稳定性验证（10 轮探测：短间隔 6 轮 + 长间隔 30s 4 轮）**：14 源全绿、**0 失败**，
  成功轮 10/10。此前一次 ok=False 为瞬时抖动（免费上游常态），非持续故障。
- 🔬 **33 源稳定性（4 轮探测）**：32/32 探测源全绿（openlib 已 skip_health 跳过，代理下
  TLS 抖动频繁不参与判定）；health 判定为**可用率 ≥90% 即 ok**（公益源抖动是常态，单源失败
  不判整体挂），`/health` 返回 `ok_count/total` 明细。
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
- ✅ 性别（genderize.io）200 / 年龄（agify.io）200 / 书目（openlibrary.org）200（直测）
- ✅ 猫图（thecatapi）200 / 英国邮编（postcodes.io）200 / 瑞克莫蒂（rickandmortyapi）200
- ✅ 星战（swapi.dev）200 / 笑话（jokeapi.dev）200 / 名言（zenquotes.io）200
- ✅ 汇率2（frankfurter.app）200（301 跟随）/ 天气2（open-meteo.com）200 / 梗图（meme-api.com）200
- ✅ 公网IP（ipify）200 / 随机用户（randomuser.me）200 / FDADrug（api.fda.gov）200
- ✅ 足球（football-data.org）200 / Chuck笑话（chucknorris.io）200 / 地震（USGS）200 /
  老爸笑话（icanhazdadjoke，Accept头）200
- ❌ ipapi.co TLS 失败（已剔除，勿加回）
- ❌ api.btstu.cn（壁纸/唐诗/毒鸡汤）TLS 失败（已剔除）
- ❌ boredapi.com 连接失败（已剔除）
- ❌ zhihu-daily 404 / douban-book 400 / bigdatacloud geo 400 / quotable TLS 拒（未采用）
- ❌ numbersapi 404 / animechan 404 / oick poem 404 / universities 502 / worldtimeapi TLS 拒（未采用）
- ❌ 第七批探测（2026-09-13）：spacexdata 525（CF 源超时）/ kvdb HTML 非纯 keyless /
  qr-decode 需可达 URL（代理下失败）/ programming-quotes 429 / futurama TLS 拒 / numbersapi 404
  ——本批无可新增源，33 源保持（常见免费 keyless API 已高覆盖）

## 安全与运维

- 仅监听 127.0.0.1；如需对外暴露请自行加反向代理鉴权
- 上游为免费公益服务，随时可能失效；/health 可监控
- 遵循 AGENTS：本文件与网关代码位于非 C 盘，未建任何 Windows 自动化任务
