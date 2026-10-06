# 访客欢迎卡片 — 现状与实现计划

## 原博客的实现（anzhiyu，已读完源码）

入口：`source/js/card-welcome.js`（462 行），挂载点 `#welcome-info`，只在首页
（`HOME_PAGE_ONLY: true`），由 `card_visitor` / `card_ip` 开关 + `greetingBox` 时段问候语驱动。

输出的 HTML（`generateWelcomeMessage`，第 148 行）：

```plain
欢迎来自 <b>${pos}</b> 的朋友
您当前距博主约 <b>${dist}</b> 公里！
您的IP地址：<b class="ip-address">${ipDisplay}</b>
${getTimeGreeting()}
Tip：<b>${getGreeting(country, province, city)}</b>
```

关键逻辑：

| 函数 | 行为 |
| --- | --- |
| `IP_CONFIG.BLOG_LOCATION` | 博主坐标，硬编码 `lng:113.666, lat:22.666`（珠海） |
| `calculateDistance(lng,lat)` | Haversine 公式，`R=6371`，返回四舍五入的公里数 |
| `getTimeGreeting()` | 按本地小时给问候：<6 深夜 / <11 早上 / <13 中午 / <17 下午 / <19 即将下班 / else 晚上 |
| `getGreeting(country, province, city)` | 从 `greetings` 对象按 国家→省→市 逐级回退取地域问候 |
| `formatLocation` | 中国 → `省 市`；其它国家 → 国家名；无 → `神秘地区` |
| `formatIpDisplay` | IPv6 时替换为「好复杂，咱看不懂~(ipv6)」 |
| `getUserIP()` | 5 个服务依次降级：api.ip.sb → api64.ipify.org → ip.3322.net → myip.ipip.net → ipapi.co |
| `getIpInfoFromCache` | IP 信息缓存 1 小时 |
| `checkLocationPermission` | 需要浏览器定位权限，拒绝时弹自定义对话框 |

样式要点：高度 212px、圆角 12px；`.ip-address` 默认 `blur(5px)`，**hover 才清晰**。

## 必须改动的地方（原文照抄会有问题）

1. **硬编码的第三方 API Key**：`API_KEY: '33ef54a143c8f723'`（v1.nsuuu.com）。
   这是**别人博客的 key**，不该沿用。改为无 key 的公开服务。
2. **强行要求定位权限**：原版拒绝权限就弹对话框、卡片不可用。改为**可选增强** ——
   定位成功才显示「距离 N 公里」，拒绝/失败则该行自动隐藏，其余照常。
3. **IP 显示**：原文把 IP 明文写进 DOM 再靠 CSS 模糊，复制/截图仍能拿到。
   改为**默认只显示脱敏形式（如 `113.76.*.*`）**，点击/toggle 才展开完整 IP。
   更保护隐私，也保留了原来的趣味。
4. **第三方 IP 服务**：保留多服务降级思路，但去掉需要 key 的，并加超时。
5. 原版有 `#welcome-info` 固定 212px 高 + loading spinner。改为骨架/淡入，
   并遵循 `prefers-reduced-motion`。

## 落点选择（已实施）

koharu 的首页侧边栏信息槽是 `src/components/layout/HomeSider.astro` 里的
`[data-slot-type="info"]`，原本只放 `HomeInfo.astro`。已实施：

- `src/components/welcome/WelcomeCard.astro` —— 服务端渲染外壳（标题 + 卡片容器），
  并按 `enabled` / `homeOnly` 决定是否输出
- `src/components/welcome/WelcomeVisitor.tsx` —— `client:load` 岛，含全部客户端逻辑
- `src/styles/components/welcome.css` —— 岛内样式
- `src/components/layout/HomeSider.astro` —— 在 info 槽里挂载
- `src/constants/site-config.ts` —— 导出 `welcomeConfig`
- `config/site.yaml` —— `welcome:` 段

## 实测中发现并修掉的问题

### 1. 首次加载发 4 次请求

`sider-content` 在**桌面侧栏和移动抽屉里各渲染一次**，两个岛各自跑了一遍
`lookupIp()`。加了**进程内 Promise 共享**（`resolveIp()`），并发合并成一次，
降到 2 次（ipapi.co 失败 + ipwho.is 成功）。第二次访问 0 次（sessionStorage 命中）。

### 2. 国家/省/市名语言不一致

- ipwho.is 返回 `country: "China"`、`region: "Guangdong Sheng"`、`city: "Guangzhou"`
- ipapi.co 返回 `country_name: "中国"`、`region: "广东"`、`city: "广州"`

中文配置键匹配不上罗马化名称，且显示出来很怪。已加两张归一化表：

- `CN_NAMES_BY_CODE`：`CN → 中国` 等
- `CN_REGIONS`（34 个省级）、`CN_CITIES`（40+ 主要城市）：罗马化 → 中文

仅在确认是中国时才翻译，避免把 Dublin 之类的地名误伤。

### 3. ipapi.co 会被 Cloudflare 拦（重要）

实测从服务器/VPS IP 请求 `https://ipapi.co/json/` 一律 **403 + `Just a moment...`**
（Cloudflare 人机验证），连续 3 次都失败。

但**真实访客的浏览器**通常能正常访问，且它返回的是中文地名（比 ipwho.is 更适合）。
因此**仍把 ipapi.co 放在首选**，ipwho.is 作为回退 —— 回退时靠上面的归一化表补齐中文。
这个取舍是刻意的：不要因为本机测不通就把它去掉。

### 4. 缓存键

原版按 IP 作缓存键（`welcome-ip-v1:<ip>`）。但拿 IP 本身就是那一次请求的目的，
所以改为单个 `self` 键（sessionStorage + 内存 + 1 小时 TTL）——
语义上是「本次会话内不再重复查询」，对个人博客足够。

## 与原始实现的行为差异（对照）

| 方面 | 原版 | 现在 |
| --- | --- | --- |
| API Key | 硬编码第三方 key | 无 key，双服务降级 |
| 定位权限 | 必需，拒绝则弹框 + 卡片不可用 | **可选增强**，拒绝只是不显示「距离」那行 |
| IP 展示 | 明文进 DOM + CSS `blur(5px)` | **JS 层脱敏** `113.76.*.*`，点击展开 |
| 失败表现 | 弹错误框 + 重试图标 | 静默降级，仍显示时段问候 |
| 加载态 | 固定 212px + spinner | 骨架条 + 自适应高度，遵循 reduced-motion |
| 缓存 | 按 IP，1 小时 | 单键 + 内存 + 1 小时 |
| 显示范围 | 仅首页 | `homeOnly` 可配，默认仍仅首页 |

## 待确认

- 博主坐标当前用珠海（113.666, 22.666）。要更精确给我经纬度即可。
- 「距离」依赖浏览器定位授权。若多数访客不愿授权，可以让它默认隐藏得更彻底，
  或者干脆改成「基于 IP 的城市到博主的距离」（IP 已带 lng/lat，无需授权）。
  目前是「授权就用精确定位，拒绝就退化为 IP 坐标」—— 后者其实已经可用，
  因为 `info.lng/lat` 一直在手。若你想让距离永不依赖授权，我可以改成纯 IP 计算。
