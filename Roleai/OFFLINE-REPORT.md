# RoleAI Studio 镜像 — 离线能力报告

> 结论先行：**纯浏览完全离线可用；凡涉及"人机验证"或"登录/下单"的写操作，必须联网。**
> 依据：源文件静态扫描 + 真实浏览器网络面板实测（2026-09-24）。

## 一、外部依赖清单（实证）

### 1.1 静态源文件中的绝对 URL

对 `site/` 下全部 `.html/.css/.js/.xml/.json` 做域名扫描，排除自有域与规范域名后得到：

| 域名 | 出现位置 | 性质 | 离线影响 |
|---|---|---|---|
| `www.d-project.com` | `assets/qrcode-generator-2.0.4.js:7` | 版权注释 | 无 |
| `www.opensource.org` | `assets/qrcode-generator-2.0.4.js:10` | MIT 许可链接注释 | 无 |
| `www.denso-wave.com` | `assets/qrcode-generator-2.0.4.js:14` | 专利问答参考注释 | 无 |
| `stackoverflow.com` | `assets/qrcode-generator-2.0.4.js:2253` | 算法出处注释 | 无 |
| `o.alicdn.com` | `assets/login.js:114`、`assets/support.js:11` | **运行时动态加载** | **有** |
| `www.sitemaps.org` | `sitemap.xml` | XML 命名空间（非网络请求） | 无 |

**关键区分**：前 4 个 + sitemap 命名空间都只存在于**注释或 XML 命名空间**中，不产生任何网络请求。
唯一真实的运行时外部依赖是 `o.alicdn.com`（阿里云验证码 SDK 入口）。

### 1.2 浏览器实测的运行时外部请求（登录页）

真实加载 `http://127.0.0.1:8088/login.html` 后的网络面板记录，外部请求共涉及 **5 个域名**：

| 域名 | 请求内容 | 说明 |
|---|---|---|
| `o.alicdn.com` | `captcha-frontend/aliyunCaptcha/AliyunCaptcha.js` | SDK 入口脚本 |
| `g.alicdn.com` | `FeiLin/1.5.1/feilin026.*.js`、`dynamicJS/3.29.0/main.css`、`pe.0xx.*.js` | 验证码前端资源 |
| `static-captcha.aliyuncs.com` | `qst/PUZZLE/online/873/<uuid>/back.png`、`shadow.png` | 滑块拼图题目图片 |
| `cloudauth-device-dualstack.cn-shanghai.aliyuncs.com` | `POST /` | 设备指纹上报 |
| `upload.captcha-open.aliyuncs.com` / `<prefix>.captcha-open.aliyuncs.com` | `POST /` | 验证结果上报 |

注意：后两个域名的具体子域（如实测出现的 `178xah` 前缀）**由后端 `/v1/auth/compliance/documents` 动态下发**，
不是硬编码在页面里——因此离线时无法预知其确切地址，也就无法预先镜像。

## 二、离线能力分级

| 能力 | 离线可用 | 依据 |
|---|---|---|
| 首页及全部营销页浏览 | ✅ | 全部资源本地化，引用缺失 0 |
| 图片/样式/动效（含 canvas 动画） | ✅ | 本地资源，`check.ps1` 已守护 |
| 法律页（用户协议/隐私政策） | ✅ | 纯静态文本 |
| 更新日志、下载页、定价页**展示** | ⚠️ 部分 | 页面骨架离线可用；定价数据来自 `api.roleai.studio`，离线时显示"授权方案暂时无法加载" |
| 登录 / 注册 | ❌ | 依赖阿里云验证码 SDK |
| 提交工单 | ❌ | 依赖验证码 + 后端 |
| 支付下单 | ❌ | 依赖后端与登录态 |
| 管理后台 `admin/*` | ❌ | 依赖登录态与后端 |

## 三、为什么这些依赖无法本地化

阿里云验证码是**第三方风控服务**，其设计目的就是防止自动化绕过：

1. 入口脚本 `o.alicdn.com/.../AliyunCaptcha.js` 会二次加载 `g.alicdn.com` 下的随机命名 chunk（实测版本 `3.29.0` / `1.5.1`，文件名含内容哈希）；
2. 题目图片（滑块底图/阴影图）带**每次会话唯一的 UUID**，且从 `static-captcha.aliyuncs.com` 按需拉取；
3. 设备指纹上报域名由后端下发，含地域与实例前缀。

即便把 SDK 静态文件全部下载到本地，**验证结果仍需服务端校验**，离线状态下拿不到 `captcha_verify_param`，
登录流程依然无法完成。因此这是**架构性限制，不是镜像缺陷**。

## 四、如果确实需要离线演示

若目的只是"演示界面长什么样"，可行做法（按侵入性从低到高）：

1. **接受现状**：营销页与法律页已完整离线可用，演示时避开登录/支付入口即可。
2. **绕过 API 层做只读演示**：`serve.js` 已内置 `/api/*` 反向代理，若将其改为返回**预置的 JSON 快照**，
   定价页等只读展示即可离线渲染。注意：这需要抓取并固化接口响应，且快照会随源站改版失效。
3. **不推荐**：伪造验证码流程——那会掩盖真实的风控行为，且无实际意义。

## 五、验证方法（可复现）

```powershell
# 1. 静态源文件域名扫描（本报告 §1.1）
$s="D:\tdsh\Roleai\site"
Get-ChildItem $s -Recurse -Include *.html,*.css,*.js,*.xml,*.json | ForEach-Object {
  $c = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
  if($c){ [regex]::Matches($c,'https?://([A-Za-z0-9\.\-]+)') | ForEach-Object { $_.Groups[1].Value } }
} | Sort-Object -Unique

# 2. 运行时实测（本报告 §1.2）
#    用浏览器打开 http://127.0.0.1:8088/login.html，查看网络面板的跨域请求

# 3. 日常回归
& D:\tdsh\Roleai\check.ps1
```

## 六、结论

- **镜像本身完整**：51 个文件、静态与运行时引用缺失均为 0、与源站 43 文件哈希一致。
- **离线边界清晰**：静态浏览 100% 可用；动态写操作 0% 可用，且原因是第三方风控服务，非镜像缺失。
- **无需为此改动镜像**；若将来确需离线演示表单，按 §4 的方案 2 处理。
