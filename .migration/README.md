# Hexo → astro-koharu 迁移说明

本目录保存把 `D:\代码\myBlog-hexo`（Hexo + anzhiyu 主题）迁移到
`D:\myBlog-astro`（astro-koharu）所用的脚本与产物。

> **`manifest.json` 是构建产物的一部分，不要删除。**
> `astro.config.mjs` 会读取它来生成旧链接的 301 重定向。

## 为什么 script 保留在这里

迁移本身是一次性的，但博客会持续更新：

- 后续从 Hexo 补迁文章时可以重跑 `migrate-hexo.mjs`
- 旧链接重定向依赖 `manifest.json`
- `convert-hexo-tags.mjs` / `normalize-code-langs.mjs` 可重复执行（幂等），
  用于修复从 Hexo 复制过来的正文语法

## 执行顺序

```powershell
cd D:\myBlog-astro
pnpm migrate:hexo     # 1. frontmatter + 标签语法 + 代码块语言（等价于下面三条）
pnpm build            # 2. 构建（内含 migrate 检查与重定向展开）
pnpm preview          # 3. 预览生产构建
pnpm verify           # 4. 校验路由、内容与旧链接重定向
```

`migrate:hexo` 展开后是：

```powershell
node .migration\migrate-hexo.mjs          # frontmatter 转换 + 落盘
node .migration\convert-hexo-tags.mjs     # Hexo 标签语法转换
node .migration\normalize-code-langs.mjs  # 代码块语言名小写化
```

> `pnpm verify` 需要先 `pnpm build` 并让 `pnpm preview`（默认 http://localhost:4322）
> 处于运行状态，可用 `BASE_URL` 环境变量指向其它地址。

`configure-site.mjs` 是最初改写 `config/site.yaml` 的一次性脚本，已经执行过，
保留仅供追溯；**不要重跑**，否则会覆盖你后续对 `site.yaml` 的手工修改。

## 各脚本做了什么

| 脚本 | 作用 |
| --- | --- |
| `migrate-hexo.mjs` | 读取 `source/_posts/*.md`，转换 frontmatter（标题 / 日期 / 分类 / 标签 / 封面 / `abbrlink` → `link`），写入 `src/content/blog/`，并生成 `manifest.json` |
| `convert-hexo-tags.mjs` | 把 Hexo 标签插件翻译成 astro-koharu 语法（见下表） |
| `normalize-code-langs.mjs` | ````JAVA` → ````java` 等，避免 Shiki 因大小写失配而丢失高亮 |
| `postbuild-redirects.mjs` | 构建后把 `.html` 重定向桩从 `dir/index.html` 展平为 `file.html`，并从 sitemap 剔除重定向 URL |
| `verify.mjs` | 端到端校验：路由可达、内容已渲染、无残留 Hexo 语法、旧链接全部重定向 |
| `verify-pages.mjs` | 校验自定义页面：数据驱动内容已渲染、页脚 15 条链接全部可用 |
| `configure-site.mjs` | 一次性写入 `config/site.yaml`（站点信息、分类、友链、Twikoo、导航等） |

## 语法转换对照

| Hexo / anzhiyu | astro-koharu |
| --- | --- |
| `{% image URL %}` | `![alt](URL)` |
| `{% link 标题, URL, ... %}` | `[标题](URL)` |
| `{% note success no-icon %}…{% endnote %}` | `:::success no-icon` …… `:::` |
| `{% label LaTeX blue %}` | `` `LaTeX` `` |
| `{% checkbox red checked, 文本 %}` | `- [x] 文本` |
| `{% raw %}<div>{% endraw %}` | `<div>`（去掉保护标记） |
| `{% del 文本 %}` / `{% psw 文本 %}` | `~~文本~~` / `!!文本!!` |
| `{% tabs X %}` + `<!-- tab N -->` | `;;;tab1 N` …… `;;;`（`{% tabs %}` 外壳丢弃） |
| `/posts/<abbrlink>.html` | `/post/<abbrlink>` |

## URL 兼容性

Hexo 的固定链接是 `posts/:abbrlink.html`，astro-koharu 的文章路由固定为
`/post/<slug>`，无法改成 `/posts/xxx.html`。因此采用标准做法：

- 新规范地址：`/post/<abbrlink>`
- 旧地址 `/posts/<abbrlink>.html` 生成 301 重定向桩（`noindex` + `canonical` 指向新地址）
- 重定向映射由 `astro.config.mjs` 读取 `manifest.json` 生成，增删文章后重新构建即可

## 分类的坑（重要）

`config/site.yaml` 的 `categoryMap` 值**只能是单个 URL 段**，不能写 `a/b`：

```yaml
categoryMap:
  学习笔记: note      # 正确
  代码学习: code      # 正确
  # 代码学习: note/code   # 错误 → 会生成 /categories/note/note/code
```

层级由文章 frontmatter 的分类名数组决定：

```yaml
categories:
  - - 学习笔记
    - 代码学习        # → /categories/note/code
```

父级前缀由主题自动拼接。每个出现在 `categories` 里的分类名都必须是
`categoryMap` 的键，否则链接会变成 `undefined`，分类页 404。

## 演示内容

astro-koharu 自带的示例文章已备份到 `demo-content-backup/`，并已从
`src/content/blog/` 移除，避免与你的真实文章混在一起。如需要参考某个功能的
写法，可从这里取回。

## git 远程

主题仓库被克隆时远程名是 `origin`，已改名为 `upstream`：

```powershell
git remote rename origin upstream   # 已完成
```

原因有两个：

1. `pnpm koharu update`（`scripts/koharu/constants/update.ts` 里的
   `UPSTREAM_REMOTE`）查找的是名为 **`upstream`** 的远程，改名后主题更新才能用。
2. 避免误 `git push origin ...` 把内容推到主题作者的仓库。

要部署到自己的仓库，再添加一个远程即可：

```powershell
git remote add origin https://github.com/Weisifengbuxi/<你的仓库>.git
git push -u origin main
```

## 迁移后的检查清单

- [x] 13 篇文章全部迁移，frontmatter 合法（`pnpm koharu migrate --check` 通过）
- [x] 旧链接 `/posts/<abbrlink>.html` 全部 301 到 `/post/<abbrlink>`
- [x] 分类页可达（含二级分类）
- [x] Hexo 标签语法全部转换，构建产物中没有残留 `{% %}` / `;;;`
- [x] 说明页面迁移：cookies / privacy / copyright / wechat / link / messages
- [x] 数据驱动页面迁移：相册（album、wordScenery、dailyPhoto、gamePhotos）、
      equipment、essay、charts、air-conditioner
- [x] 页脚链接条（`footerLinks`）在每个页面底部显示
- [x] `pnpm build` 与 `pnpm verify` 全部通过（41 路由 + 26 重定向 + 15 自定义页面）
- [ ] **填写 Twikoo 地址**（见下方）
- [ ] **部署到你自己的仓库 / 平台**（未做，等你决定）
- [ ] **撤销旧仓库里泄漏的 GitHub token**（见下方安全提示）

## 自定义页面说明

原 Hexo 博客里有一批「小页面」，分三类处理：

**一、纯正文页**（`.md`，用主题的 `PageLayout`）

| 路由 | 来源 |
| --- | --- |
| `/cookies` | `source/cookies/index.md` |
| `/privacy` | `source/privacy/index.md` |
| `/copyright` | `source/copyright/index.md` |
| `/wechat` | `source/wechat/index.md` |

正文里的站内死链（`https://www.weisifengbuxi.top/privacy/` 之类）已改为站内相对路径。

**二、依赖主题 JS 的页面**

| 路由 | 说明 |
| --- | --- |
| `/link` | 友链申请页。免责声明 / 申请要求 / 五个复选框 + Twikoo 提交拦截全部保留，但**重写**了脚本：原版假设 Twikoo 同步注入，而 koharu 通过 React 异步加载，因此改用 `MutationObserver` 等待 `.tk-submit`；预填文本框也补上了 `change` 事件（Element Plus 不认单独的 `input`） |
| `/messages` | 最新评论页。直接调 Twikoo 的 `GET_RECENT_COMMENTS`，**不依赖 Twikoo 前端**，所以即使评论服务没配好也能优雅降级 |

**三、数据驱动页面**（`.mdx` + `.astro` 组件）

| 路由 | 数据来源 |
| --- | --- |
| `/album` | `config/pages.yaml` → 相册集索引 |
| `/wordScenery`、`/dailyPhoto`、`/gamePhotos` | 同上 → 各相册详情（含灯箱） |
| `/equipment` | 同上 → 我的装备 |
| `/essay` | 同上 → 即刻短文时间线 |
| `/charts` | 构建期从文章数据实时统计，CSS 柱状图 |
| `/air-conditioner` | 全新实现，见下 |

原 Hexo 的数据在 `source/_data/{album,equipment,essay}.yml`，已转成
`config/pages.yaml`，改内容不用动组件。

> **`/charts` 为什么不用 ECharts**：原页面为了画三个柱状图从 CDN 引入
> `echarts@4.9.0-rc`（约 700KB）。现在改成构建期算好、CSS 渲染，
> 零客户端 JS，且自动跟随主题深浅色。
>
> **`/air-conditioner` 为什么要重写**：原页面依赖第三方 CDN 上的预编译 Vue
> 组件（`npm.elemecdn.com/anzhiyu-air-conditioner`），既无法改样式也是外部
> 故障点。现在是无依赖的自实现，支持键盘操作与 `prefers-reduced-motion`。

### `.mdx` 的坑（重要）

本项目的 `.mdx` **不能包含 `<style>` 块**。主题用自定义 markdown processor
（`markdown.processor: unified({...})`），MDX 解析 `<style>` 里的 CSS 花括号时
会报 `Unexpected content after expression`，构建直接失败（Windows 上表现为
退出码 3221226505）。

**样式一律写在 `.astro` 组件里**（Astro 组件支持 `<style>` 且默认 scoped）。

另外 `@astrojs/mdx` 锁在 **7.0.8**：8.x 要求 `astro >= 7.2.6`，而本仓库
（astro-koharu 7.2.1）锁定 `astro@7.1.3`。

## 访客欢迎卡片

仿原 Hexo 博客的 `card-welcome.js`：在首页**侧边栏信息槽**显示

```plain
欢迎来自 广东 广州 的朋友
你当前距博主约 45 公里！
你的 IP 地址：113.76.*.*      ← 点击才展开完整地址
即将下班🚶 记得按时吃饭~
Tip：饮茶先啦！🍵
```

| 文件 | 作用 |
| --- | --- |
| `src/components/welcome/WelcomeCard.astro` | 卡片外壳（标题 + 容器），按 `enabled` / `homeOnly` 决定是否输出 |
| `src/components/welcome/WelcomeVisitor.tsx` | `client:load` 岛，全部客户端逻辑 |
| `src/styles/components/welcome.css` | 岛内样式 |
| `src/constants/site-config.ts` | `welcomeConfig` 导出 |
| `config/site.yaml` | `welcome:` 段（开关、坐标、问候语、缓存） |

配置：

```yaml
welcome:
  enabled: true
  homeOnly: true            # 仅首页（与原博客一致）
  blogLocation: { lng: 113.666, lat: 22.666 }   # 博主坐标，算「距离」
  cacheHours: 1
  greetings:                # 国家 → 省 → 市 逐级回退，末级取「其他」
    中国:
      广东: 饮茶先啦！🍵
      其他: 欢迎来自中国的朋友～
    其他: 欢迎来自世界各地的朋友～🌍
```

### 与原始实现的四处差异（都是有意的）

1. **去掉了硬编码的第三方 API Key。** 原文里 `IP_CONFIG.API_KEY` 是**别人博客的
   key**（v1.nsuuu.com）。现改为无 key 的公开服务，双服务降级：
   `ipapi.co` → `ipwho.is`。
2. **定位权限改为可选增强。** 原版拒绝授权就弹对话框、卡片基本不可用；
   现在拒绝只是不显示「距离」那一行，其余照常。
3. **IP 默认脱敏。** 原文把完整 IP 写进 DOM 再用 CSS `blur(5px)` 遮住 ——
   复制、截图、脚本都还能拿到。现改为 JS 层输出 `113.76.*.*`，点击才展开。
4. **失败静默降级。** 原版弹错误框 + 重试图标；现在查不到就只显示时段问候，
   并保留一个低调的「↻」手动重试。

### 实测中发现并修掉的问题

- **首次加载发 4 次请求**：`sider-content` 在桌面侧栏与移动抽屉各渲染一次，
  两个岛各跑一遍查询。已加进程内 Promise 共享，降为 2 次（首选失败 + 回退成功）；
  二次访问 0 次（sessionStorage 命中）。
- **地名语言不一致**：ipwho.is 返回 `China / Guangdong Sheng / Guangzhou`，
  与中文配置键和观感都不符。已加 `CN_NAMES_BY_CODE` / `CN_REGIONS` / `CN_CITIES`
  三张归一化表（仅在确认是中国时翻译，避免误伤同名外国地名）。
- **ipapi.co 在服务器 IP 上会被 Cloudflare 拦**（403 `Just a moment...`，连续实测 3 次皆失败）。
  但真实访客浏览器通常正常，且它返回中文地名，因此**仍保留为首选**，
  ipwho.is 作回退。不要因为本机测不通就删掉它。

### 对齐原博客的第二轮修正

首版做出来后与用户预期有差距，已按原版逐项对齐：

| 项目 | 首版（我的实现） | 现在（对齐原版） |
| --- | --- | --- |
| 位置显示 | 偶发英文（`Guangdong`） | **中文**：新增 `COUNTRY_CN` 国名表，配合已有的省/市表 |
| 距离来源 | 定位 + IP 两套坐标，渲染出**两条**距离行 | **只用 IP 城市级坐标**，合并为一条，且与显示的地名同源 |
| IP 展示 | JS 层脱敏成 `113.76.*.*`，点击展开 | **常态 `blur(5px)`、hover `blur(0)`**，与原版 `.ip-address` 一致 |
| Tip | 自拟的省份猜测（常回退到「其他」） | **逐条照搬原表**：39 国 / 中国 35 省 / 广东含 4 市 |
| 文案 | 「你当前距博主约 N 公里！」 | 「您距离博主位置约 N 公里！」（用户指定措辞） |

关于「位置不准确」的根因：首版把**浏览器定位坐标**用于算距离，却用 **IP 地名**
做显示，两者不一致 —— 显示「广州」但距离按真实位置算，或反之。现在两者都来自
IP 解析，天然一致，也不再弹定位授权（因此 `GEO_TIMEOUT_MS` 已删除）。

> ⚠️ IP 现在是**纯视觉模糊**，完整地址仍在 DOM 中（与原版一致）。这是用户明确
> 要求的观感，但它不再是隐私保护手段 —— 若将来需要真正的隐藏，要改回 JS 脱敏。

> 详细记录（含原实现逐函数分析、行为对照表）：`.migration/NOTES-welcome-card.md`
> 原版提取的原始数据（greetings 全表、扫光 CSS、模糊样式）：`.migration/REF-welcome-original.md`

**中国地名只显示已归一成中文的部分**：`CN_REGIONS` / `CN_CITIES` 覆盖了全部省级
行政区与主要城市；若某个小城市没命中，宁可只显示「中国」，也不把 `Shantou`
这类罗马化名字混进中文地名。已用七个地区用例验证（含未映射省、市级无表、
省级无市级、境外国家、未知国家）。

### 定位准确性：关键是「用哪个 IP 库」，不是 GPS

一开始误以为 IP 定位不够准、必须上浏览器定位。实际情况是**换库**就够了 ——
原 Hexo 博客从头到尾只用 IP（`v1.nsuuu.com/api/ipip`，ipip.net 的镜像，
带 API Key），从来没用过 `navigator.geolocation`，而它是准的。

对同一个国内 IP（`113.76.180.239`，中国电信广东节点）实测各家库：

| 服务 | 返回城市 | 判断 |
| --- | --- | --- |
| ip-api.com | 广州市 | ❌ 省出口节点 |
| ipwho.is | Guangzhou | ❌ 同上 |
| ipapi.co | HTTP 403（Cloudflare 拦） | — |
| **api.ip.sb** | **珠海市** | ✅ 座标 22.28, 113.57 确为珠海 |

所以**首选 `api.ip.sb`**（数据库把国内 IP 解析到真实城市），国际服务只作备份。
最终方案**纯 IP、不申请任何定位权限**，与原博客一致：

1. `api.ip.sb/geoip` → `ipwho.is` → `ipapi.co` → `ipinfo.io` 依次降级；
2. 由拿到的那一条同时提供**地名和距离**（同源，杜绝「写着广州、距离按珠海算」的割裂）。

实测（未授予任何权限、无弹窗）：`欢迎来自 广东 珠海 的朋友 / 约 44 公里 /
Tip：珠玑璀璨传千古，渔歌悠扬荡天涯`，且 `navigator.permissions` 的 geolocation
状态始终是 `prompt`（即从未请求过）。只发一个请求、845ms 出结果。

### 地名归一化踩过的坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `欢迎来自 CN · Dongguan` | ipinfo.io 把 ISO 代码放在 `country` 字段（`"CN"`），不是国名 | `normalizeIp` 识别两位代码并查 `CN_NAMES_BY_CODE` |
| Tip 回退到「带我去你的国家逛逛吧」 | 返回的正式国名 `中华人民共和国` 与表键 `中国` 不匹配 | `COUNTRY_ALIASES` 把中文全名/英文名/简称都折叠到 `中国` |
| 珠海命中不了市级问候 | 返回 `珠海市`（带行政后缀），表键是 `珠海` | `stripAdminSuffix` 去掉 省/市/县/区/自治区 后再查表 |
| 距离整行不显示 | ipinfo.io 用 `loc: "23.018,113.748"`（lat,lng）而非数值字段 | `parseCoords` 解析 `loc` |
| 英文城市名混进中文地名 | `api.ip.sb` / `ipwho.is` 返回 `Zhuhai` | `CN_CITIES` 覆盖广东 21 个地级市 + 全国主要城市 |

### 加载闪动：根因是骨架的脉冲动画

用户反馈「第一次加载闪现了三次」。用像素哈希每 120ms 采样卡片可见状态，
最终定位到根因：骨架块带 `welcome-pulse` 透明度动画，**每次采样都得到不同画面**
（一屏内 14 次变化），主观感受就是不停在闪。

去掉动画、改为静态色块后：**可见状态由 15 次降到 2 次**（骨架 → 内容），
且时段问候改为同步渲染（首帧即出现，不再依赖网络），卡片每次加载只变化一次。

另外骨架只在网络查询期间显示，查询结束才整体替换，避免「内容 → 又缩回骨架」。

## 点击特效：社会主义核心价值观文字

**默认生效**。点击可交互元素时，从指针处冒出一个词、上浮淡出，**每次随机换色**。

配置在 `config/site.yaml`：

```yaml
motion:
  clickBurst: true
  clickEffect: text      # text = 文字（默认）；petals = 樱花花瓣

clickShowText:
  text: [富强, 民主, 文明, 和谐, 自由, 平等, 公正, 法治, 爱国, 敬业, 诚信, 友善]
  fontSize: 20px
  colors: []             # 留空 = 每次随机生成颜色
```

| 文件 | 作用 |
| --- | --- |
| `src/lib/click-text/click-text.ts` | 特效实现 |
| `src/styles/global/motion.css` | `.click-text-layer` / `.click-text` 样式 |
| `src/layouts/AppShell.astro` | 按 `motion.clickEffect` 二选一挂载 |

来源：原博客 `_config.anzhiyu.yml` 的 `ClickShowText`（anzhiyu 用的是
butterfly-extsrc 的 `click-show-text.min.js`，CDN 加载）。原版**没有颜色随机**，
按你的要求补上了。

要点：

- **颜色随机**：`hsl(随机色相 72~96% 46~62%)` —— 饱和度/亮度限制在鲜艳且
  浅色深色底都看得见的区间，避免出现近白或近黑的字。
- **可配置颜色池**：`colors` 非空时改用固定色，随机逻辑自动让位。
- **文字池为空即禁用**：不需要额外的 `enable` 开关，删掉 `text` 就关掉。
- **`fontSize` 支持非 px 单位**：非 px 时用一个隐藏元素量一次实际像素值。
- 与樱花特效**共用同一套层契约**（层挂在 `<html>` 上以挺过 ClientRouter 换页、
  空中时带 `view-transition-name` 以免被冻进快照、换页冻结时暂停后原地恢复）。
- 仅在 `lively` 动效等级生效；切到后台或降级会取消并清空。
- 与樱花二选一，由 `motion.clickEffect` 决定；两个同时配也不会叠加。

### 依赖注入 + 单元测试

`click-text.ts` **不直接 import site.yaml**，而是由 `AppShell` 通过
`setupClickText(clickShowTextConfig)` 注入配置。这样模块不牵入 YAML 导入链，
可以用裸 `node --test` 测试（YAML 在 node 下无法直接 import）。

`src/lib/click-text/click-text.test.ts` 6 个用例（已并入 `npm run test:motion`）：
按池出词、颜色随机（40 次点击 >5 种）、颜色池覆盖随机、动画从指针向上飘出、
动效/可见性变化时取消且 transition 后不恢复、空词池禁用。

`tests/motion/mobile-viewers.spec.ts` 里的 `screenshotReady()` 原本只等樱花播完，
已改为同时匹配两种特效的层，切换 `clickEffect` 后依然有效。

## 文章卡片 hover 擦亮（扫光）

照搬原 Hexo 博客 `source/css/home.css`（原文仅 15 行）：

```css
::before { content:""; position:absolute; top:0; left:0;
           width:100%; height:200%;
           background: linear-gradient(to right, transparent, white, transparent);
           transform: translateX(-200%);
           transition: transform 0.5s linear; z-index:1; }
:hover::before { transform: translateX(100%) skewX(-60deg); }
```

落在 `src/styles/components/post.css` 的 `.post-item-card::before`。适配点：

- 显式补 `overflow: hidden`（原版靠主题卡片裁剪），否则 200% 高度的渐变会溢出卡片
- `border-radius: inherit` 让扫光贴合圆角
- 仅 `@media (hover: hover)` 启用，避免触屏点一下就闪
- `prefers-reduced-motion: reduce` 时整条 `display: none`

实测 `::before` 的 `translateX` 时间序列（500ms 内完成）：

```plain
   0ms  -1856px      300ms   -34px
 100ms  -1281px      400ms   541px
 200ms   -650px      500ms   928px  ← 到位
```

## 小空调（/air-conditioner）

`src/components/pages/AirConditioner.astro`，无第三方依赖。功能：

| 功能 | 说明 |
| --- | --- |
| 温度 −/＋ | 16~30 ℃，**按住 400ms 后连续调节**（pointerdown + interval） |
| 开机 / 关机 | 屏幕与 LED 状态、风口动效随之开关 |
| **制冷 / 制热** | 见下 |
| **按键音** | Web Audio 合成，无音频文件；**常开**（无静音开关） |
| 键盘 | 面板聚焦后 `↑` `↓` 调温、`M` 切模式、`P` 开关机 |

面板尺寸：桌面 `min(100%, 28rem)`；≤420px 时收窄内边距与按键高度。

按键布局：

```plain
[    −    ] [    开机    ] [    ＋    ]    ← −/＋ 固定 5rem，开机键占据剩余空间
[              切制热              ]       ← 模式键铺满整行
```

### 制冷 / 制热模式

切换按钮在第二行（关机时禁用）。两套模式在多个地方有区别：

| | 制冷 | 制热 |
| --- | --- | --- |
| 面板配色 | 冷蓝渐变 | 暖橙渐变 |
| 屏幕文字 | `❄ 制冷`（青绿发光） | `☀ 制热`（橙色发光） |
| 强度分级 | ≤20 强力制冷 / ≤26 制冷 / 其余送风 | ≥28 强力制热 / ≥24 制热 / 其余送风 |
| 风口与风扇 | 正向 | **反向**（呼应热风上浮） |
| LED | 绿 | 橙 |
| 切换音 | 高音 740Hz | 低音 520Hz |

### 按键音怎么做的

用 **Web Audio 合成**，不引入任何音频文件（避免体积与 404）：

- `AudioContext` 在**首次用户交互**时才创建，符合浏览器自动播放策略
- 音色：温度键是短促三角波「哔」；开机是上行两音 660→990Hz，关机是下行 660→440Hz
- 每个音符带快速淡入 + 指数衰减包络，避免爆音
- 优先 `window.AudioContext`，回退 `webkitAudioContext`；构造失败时静默降级（不影响其它功能）

**音量**（`blip` 的 `gain` 参数，线性幅度）：

| 音效 | 初版 | 现在 |
| --- | --- | --- |
| 温度键 tick | 0.035（方波） | **0.16**（三角波） |
| 开机 on | 0.06 | **0.20** |
| 关机 off | 0.05 | **0.18** |
| 切模式 | 0.05 / 0.055 | **0.18 / 0.19** |

整体上调约 3~4.5 倍，并把方波换成三角/正弦 —— 方波同音量下听感更"尖"，
一味加 gain 会刺耳。

> 无头浏览器听不到声音，所以验证方式是**替换 `AudioContext` 并记录每次振荡器的
> 频率与增益峰值**，断言：按钮按下确实发声、且增益落在新档位上。
> 示例输出（实测）：开机 `freq=660 gain=0.2`、按 + `freq=880 gain=0.16`、
> 切制热 `freq=520 gain=0.19`。

动画部分遵循 `prefers-reduced-motion`：减弱动效时风口与风扇停止旋转。

## 页脚链接条

`config/site.yaml` 的 `footerLinks` 控制每个页面底部的链接条：

```yaml
footerLinks:
  - name: 关于本人
    path: /about
  # 置空（footerLinks: []）即可整条隐藏
```

由 `src/constants/site-config.ts` 读取、`src/components/layout/FooterLinks.astro`
渲染，并挂在 `src/components/layout/Footer.astro`。

## 顶部导航

`config/site.yaml` 的 `navigation` 控制顶部导航。当前为：
首页 · 文章（下拉：分类 / 标签 / 归档）· 友链 · 关于 · 歌单 · 装备。

「装备」指向 `/equipment`（`src/pages/equipment.mdx`，数据在 `config/pages.yaml`），
文案走 i18n key `nav.equipment`：

| 文件 | 值 |
| --- | --- |
| `src/i18n/translations/zh.ts` | 装备 |
| `en.ts` / `ja.ts` / `ko.ts` | Gear / ガジェット / 장비 |

> `TranslationKey` 来自 `keyof typeof zhStrings`，所以**新增 key 必须先加到
> `zh.ts`**，否则 `nameKey` 无法通过类型检查。

回归检查：`node .migration/check-nav-equipment.mjs`（已并入 `pnpm verify`）。

## 对主题文件的改动清单

`pnpm koharu update` 时下列文件可能冲突，更新后按需加回新增的几行即可
（其余文件都是**新增**文件，upstream 没有，git 不会动）：

| 主题文件 | 改动 |
| --- | --- |
| `src/components/layout/Footer.astro` | 挂 `<FooterLinks />`，并渲染备案 / 徽章 |
| `src/components/layout/HomeSider.astro` | 挂 `<WelcomeCard />`；侧栏 `w-64` → `w-72`、`px-3` → `px-2` |
| `src/constants/layout.ts` | `MAX_WIDTH.content` 1280px → `min(视口 - 6rem, 1760px)` |
| `src/constants/site-config.ts` | 新增 `footerLinks` / `filings` / `badges` / `mournConfig` / `universeConfig` / `welcomeConfig` 导出 |
| `src/layouts/AppShell.astro` | 挂 `<UniverseCanvas />` |
| `src/layouts/BootScripts.astro` | 新增纪念日变灰的首屏内联脚本 |
| `src/layouts/Layout.astro` | 新增去色 CSS |
| `src/components/ui/cover/Cover.astro` | 首页开场文字加 `cover-intro-fade` 类；`alternate` 为空时不渲染空 `h2` |
| `src/styles/components/cover.css` | 新增开场文字淡出的变量与关键帧 |
| `src/components/layout/FooterLinks.astro` | 重写：支持分组多栏（`footerLinkGroups`），保留扁平列表作回退 |
| `src/components/layout/Header.astro` | 页头挂 `<ToolsMenu />`（左上角实用工具按钮） |

## 页脚分栏（footerLinkGroups）

原 Hexo 博客的页脚是**多栏纵向**排布：`footer.pug` 把
`theme.footer.list.project` 渲染成 `#anzhiyu-footer` 下若干 `.footer-group`，
每栏一个 `.footer-title` + 纵向的 `.footer-links`。koharu 之前是一行 `·` 分隔、
靠 `flex-wrap` 折行，15 个链接时很乱。

现在照原结构分四栏（配置在 `config/site.yaml` 的 `footerLinkGroups`）：

| 栏 | 链接 |
| --- | --- |
| 关于 | 关于本人 / 友链申请 / 最新评论 / 公众号说明 |
| 我的 | 相册集 / 我的日常 / 世界各地风景 / 游戏荣誉 / 我的装备 / 即刻短文 |
| 工具 | 网站统计 / 小空调 |
| 协议 | 隐私政策 / Cookies 政策 / 版权协议 |

- 宽屏 `grid-template-columns: repeat(auto-fit, minmax(7rem, max-content))` 并排
- ≤768px 折成两栏并居中
- **未配置 `footerLinkGroups` 时自动回退**到原来那份扁平 `footerLinks` 单行样式
  （配置项都保留，不影响既有部署）

实测：4 栏、每栏链接纵向对齐、文字无折断换行。

### 排版与间距（对齐首页「文章列表」模块）

第一版每栏只占内容宽（约 112px）挤在中间，且标题与链接同为 12px、间距仅 5px，
标题和链接分不出来。现在两组数值都照首页模块的**实测值**来：

| 项 | 数值 | 依据 |
| --- | --- | --- |
| 栏标题 | **15px / 600** | 与侧栏「欢迎」标题 14.4px/600 同量级 |
| 条目文字 | **13px** | 原 12px 偏小 |
| 条目间距 | **16px** | 文章列表容器 `gap-4` 的实测值 |
| 标题→链接 | 12px | 让标题自成一组 |
| 栏宽 | 各 202px（4 栏等分） | 铺满整行，两侧留白 0 |

标题另加一道**主色竖条**（`::before`，`hsl(var(--primary) / 0.65)`），
让「关于 / 我的 / 工具 / 协议」一眼能认出是标题而非链接。

窄屏（≤992px）折成 2 栏并收紧条目间距到 12px；480px 下 2 栏、无横向溢出。

## 页头「实用工具」按钮（toolsMenu）

移植自原主题 `nav.pug` 的 `.back-home-button`：页头左上角一个抓手图标，
点开是分组的外链工具面板（原配置在 `_config.anzhiyu.yml` 的 `nav.menu`）。

```plain
网页：博客 / 个人主页
项目：路过图床 / PDF派 / ITDOG / draw.io / GeoGebra / 萌盘
服务：51la统计 / 开往
```

实现要点：

- `src/components/layout/ToolsMenu.astro`，**纯 CSS 开合**（checkbox + label），
  不引入客户端 JS —— 页头每页都渲染，保持零 JS 成本
- 移动端 `tablet:hidden`（抽屉里已有导航）
- 外链一律 `target="_blank" rel="noopener noreferrer"`

> ⚠️ **颜色变量必须包 `hsl()`**：主题的 `--card` 是 HSL 分量（`0 12% 99%`），
> 不是完整颜色。一开始写 `background: var(--card, #fff)`，因值不合法整条失效，
> 面板变成透明的（头像透过来了）。正确写法：`background: hsl(var(--card, 0 0% 100%))`。

实测：初始隐藏 → 点击展开；背景不透明（浅色 `rgb(253,252,252)` /
深色 `rgb(35,31,45)`）；10 个工具项、分组正确、面板不溢出视口；移动端隐藏。

## 版心宽度与侧栏（布局调整）

原主题 `MAX_WIDTH.content = 'max-w-7xl'`（1280px），在宽屏下留白很大：
实测 1600px 视口左右留白 156 / 708，1920px 时 316 / 868 —— 因为内容居中、
侧栏又固定 256px，多出的宽度全堆在右侧。

已改为：

```ts
content: 'max-w-[min(100%-6rem,110rem)]'   // 视口 - 6rem，上限 1760px
```

| 视口 | 侧栏宽 | 侧栏内卡片 | 主内容列 | 文章封面 | 左右留白 |
| --- | --- | --- | --- | --- | --- |
| 1440 | 288 | 272 | 968 | 452 | 各 48 |
| 1600 | 288 | 272 | 1128 | 532 | 各 48 |
| 1920 | 288 | 272 | 1392 | 664 | 各 76/124 |

侧栏同时由 `w-64`（256px）放宽到 `w-72`（288px），内边距 `px-3` → `px-2`，
因此卡片从 232px 增到 272px。

窄屏回归已验证：侧栏在 ≤992px 正常隐藏（1024 显示、992 起隐藏），
375 / 480 / 768 / 900 / 992 / 1024 各宽度**均无横向溢出**。

> ⚠️ **正文宽度取舍**：版心变宽后文章详情页的 `.prose` 也变宽
> （1600 视口 1128px、1920 视口 1392px）。中文一行约 100~130 字，
> 比常规阅读舒适区（约 70~90 字）宽。若想收窄，在 `post.css` 给 `.prose`
> 加 `max-width` 即可 —— 代价是图片/代码块不再铺满，或需一并限制。

## 纪念日 / 哀悼日变灰

原 Hexo 博客用 anzhiyu 的 `mourn` 选项：在首页第一页执行
`document.documentElement.style.filter = 'grayscale(1)'`（`themes/anzhiyu/layout/includes/mourn.pug`，
由 `layout.pug` 的 `is_home_first_page()` 控制）。

```yaml
mourn:
  enabled: true
  affect: cover   # 'cover' 仅首页整页变灰（默认）；'page' 首页与其它页面都变灰
  days:
    - '4-5'   # 清明
    - '5-12'  # 汶川地震
    - '7-7'   # 七七事变
    - '9-18'  # 九一八
    - '12-13' # 南京大屠杀死难者国家公祭日
```

### 生效范围（容易搞错，重点）

**只在首页**（路径为 `/`，多语言下为 `/zh`）整页去色 —— 导航、头图、正文、
侧边栏、页脚全部变灰；**点进文章 / 分类 / 归档等任何其它页面立即恢复彩色**。
这与原 Hexo 博客 `is_home_first_page()` 的行为一致。

> 命名说明：`affect: cover` 里的 cover 指「只在首页这个封面页生效」，
> **不是**「只处理头图」。`affect: page` 则是首页之外也一起变灰。

实现分三处，都是新增代码：

| 文件 | 作用 |
| --- | --- |
| `src/constants/site-config.ts` | 读取并规范化 `mourn`（导出 `mournConfig`） |
| `src/layouts/BootScripts.astro` | **首屏前**判断「今天是否纪念日」+「当前是否首页」，给 `<html>` 打 `data-mourn` |
| `src/layouts/Layout.astro` | 全局 CSS：`html[data-mourn=cover]{filter:grayscale(1)}` |

### 与原实现的差异

1. **不再有彩色闪烁**：原版在内联脚本里直接设 `style.filter`，而脚本位于
   `#body-wrap` 之前但仍在 body 内，首屏可能先渲染彩色；这里改为在 `<head>` 的
   `BootScripts` 中打类名，去色由样式表接管。
2. **换页时会重新判断**：原版是整页刷新，天然按新地址重新执行；本站启用了
   View Transition（客户端路由），所以 `astro:before-swap` 里按**目标**地址重算，
   `astro:after-swap` 再按真实地址纠正一次 —— 否则从首页点进文章会一直保持灰色。

### 刷新时机

判断在**浏览器端**执行、使用**访客本地时间**（与原版一致，刻意不用 UTC）。
静态站点不会自己重新构建，所以**到日子不需要重新部署** —— 当天首次打开首页即生效。

### 验证

```powershell
node .migration/test-mourn-dates.mjs   # 11 个日期的边界用例（含跨年、闰日）
node .migration/verify-mourn.mjs       # 构建产物里脚本 + 配置 + CSS + 首页判断链路
```

想用真实浏览器核对范围（需要 `pnpm build && pnpm preview`）：

```powershell
# 伪造系统时钟到某个纪念日，逐个路由断言 filter 值
node .migration/tools-check-mourn-scope.mjs

# 或者截图肉眼看
node .migration/tools-shoot-mourn.mjs
```

`tools-check-mourn-scope.mjs` 会用 `addInitScript` 覆盖 `Date`，因此走的是
**真实日期判断分支**，而不是手动加类名 —— 能同时验证日期门与路径门。

## 首页开场文字淡出动画

首页头图上的站名与副标题会**淡入上浮 → 保持 1 秒 → 淡出上移**，之后保持隐藏。

实现只有两处：

| 位置 | 内容 |
| --- | --- |
| `src/components/ui/cover/Cover.astro` | 「无 title / 无 data」分支的文本元素加 `cover-intro-fade` 类 |
| `src/styles/components/cover.css` | 变量 + `@keyframes cover-intro-life` |

**作用范围**：`cover-intro-fade` 只标在「无 title / 无 data」分支上，也就是只有
`index.astro` 的 `<Cover slot="cover" />` 会渲染它。归档、友链、404 等页面都传了
`title`，走另一分支，因此天然不受影响，不需要判断首页路径。

### 踩过的两个坑

**1. 起初拆成两个动画，结果淡出永远不触发。**

一开始用 `motion-rise-focus`（入场）+ `cover-intro-fade-out`（淡出）两个动画，但：

- 两个都会改 `opacity` / `translate`，按 CSS 规则逐属性合成
- `--i` 元素同时带 `.motion-rise` 类，而那条规则在样式表里**更靠后**，
  它的 `animation-delay` 会覆盖本规则的 delay

结果淡出的 delay 被重置成入场延迟，实测 3200ms 后 opacity 仍是 1（完全没有淡出）。

**改法**：合并成**单一关键帧** `cover-intro-life`（0% 淡入 → 20% 完成 →
48% 保持结束 → 100% 淡出），只用一个 `animation` 简写与一个 delay，
并去掉冗余的 `.motion-rise` 类，彻底避开层叠冲突。

**2. `alternate` 被注释掉时，会渲染出一个空的 `<h2>`。**

`site.alternate` 为 `undefined` 时那个 `h2` 仍会渲染（高度 0）但占着 `mt-3`
的边距，把版面顶歪。现已改为条件渲染：

```astro
{siteConfig?.alternate && <h2 class="cover-intro-fade …">{siteConfig.alternate}</h2>}
```

### 时间参数

| 变量 | 默认 | 含义 |
| --- | --- | --- |
| `--fade-in` | `0.7s` | 淡入上浮时长 |
| `--fade-hold` | `1s` | 完整可见时长 |
| `--fade-out` | `0.5s` | 淡出时长 |

总时长 = 三者之和（当前 2.2s），由 `--fade-total` 自动算出。
用 `animation-fill-mode: both`，开场前即处于 `0%` 状态，不会先亮一下再消失。
元素按 DOM 顺序带 `--i`（0/1/2），入场有轻微错落。

> ⚠️ **改这三个变量后要同步两个关键帧百分比。**
> `@keyframes` 的选择器不能写 `var()`，只能是字面百分比，所以断点写死为
> 当前值对应的 `31.82%` / `77.27%`。换算公式（已写在 `cover.css` 注释里）：
> `淡入结束 = --fade-in / --fade-total`、`保持结束 = (--fade-in + --fade-hold) / --fade-total`。

### 验证方式

无头浏览器按时间轴采样计算后的 `opacity`，当前配置实测：

```plain
  时刻(ms)      [站名, 副标题]
      0        [0, 0]          ← 开场不可见
    400        [0.32, 0.16]    ← 淡入中
    900        [1, 0.89]       ← 淡入完成（约 0.7s）
   1300        [1, 1]          ← 全亮
   1700        [1, 1]          ← 保持结束（约 1s）
   1900        [0.93, 1]       ← 淡出刚开始
   2300        [0.11, 0.33]    ← 淡出中
   2700        [0, 0]          ← 完全消失（淡出约 0.5s）
```

解析出的 `animation-duration` 应为 `2.2s`。

`prefers-reduced-motion` 或站点动效等级为 `reduced` 时**不加动画**，文字保持常显。
回归检查已并入 `pnpm verify`：首页必须含 `cover-intro-fade`，归档/关于页必须不含。

## site.title / alternate 写反了（踩过的坑）

迁移时 `configure-site.mjs` 把这两个字段的值**写反了**，而且一直没有报错：

```yaml
# 错误（迁移时的实际状态）
site:
  title: Weisifengbuxi     # ← 英文名放在了 title
  alternate: 未似风不息     # ← 中文名放在了 alternate
```

语义（见主题自带示例 `title: 余弦の博客` / `alternate: cosine`）：

| 字段 | 含义 | 被谁用 |
| --- | --- | --- |
| `title` | 网站**母语全名** | RSS 频道标题、SEO、分享卡片、`<title>` |
| `alternate` | 网站**英文短名** | 页头 Logo 文字、页脚 `@ handle` |

写反的症状很隐蔽：**RSS 订阅里博客名变成英文**，页头显示中文名。
因为构建完全正常，只有断言能兜住 —— 是 `verify.mjs` 里 `/rss.xml` 那条
「应包含 未似风不息」的检查把它暴露出来的。

已修正为 `title: 未似风不息` / `alternate: Weisifengbuxi`。
另外 `alternate` 会被拼进 `<title>`（形如
`Weisifengbuxi = 未似风不息 = 学习技术 分享生活`），若想更接近原 Hexo 的
`未似风不息 | 学习技术 分享生活`，把 `alternate` 注释掉即可（页头会退化为显示 title）。

回归检查：`check-site-config.mjs` 现在会断言
`title` 含中日韩字符、`alternate` 为纯 ASCII、且**构建出的 RSS 频道标题 === site.title**。
反向验证过：故意写反时 3 项失败。

## 主题示例数据泄漏（踩过的坑）

迁移过程中出现过一次事故：页面标题渲染成了主题作者的「余弦 = cosine」。

**原因**：`UniverseCanvas.astro` 为了读 `universe:` 段，直接
`import yamlConfig from '../../../config/site.yaml'`。这会把**整个** site.yaml 拉进该
组件的模块图，Astro 于是在客户端脚本里内联了作者的示例 `site:` 段，覆盖了页面标题。

**规则**：组件一律从 `@constants/site-config` 读取规范化后的值
（或在 `src/lib/config/*` 中新增导出），**不要**直接导入 `config/site.yaml` 的根对象。

同类问题还有一个：`site.showLogo: true` 会渲染主题自带的
`src/assets/svg/logo.svg`，那是手写体的 **"Cosine"**。已改为 `showLogo: false`
（页头显示站点名称文字）。想用图形 logo 就把该 SVG 换成自己的。

回归检查（已并入 `pnpm verify`）：

```powershell
node .migration/check-no-theme-samples.mjs   # 扫描构建产物里的主题示例值
node .migration/check-site-config.mjs        # site-config.ts 结构自检
```

## 更新主题（实测记录）

### 完整流程

```powershell
git add -A && git commit -m "..."   # 先提交手头改动
pnpm koharu update                  # 选「备份」
pnpm install                        # 若 CLI 的装依赖步骤失败（见下）
pnpm build
pnpm verify
git push                            # 成功后推送存档
```

> ⚠️ **DSH 环境下 `pnpm koharu update` 会在装依赖那步失败**（`spawn EINVAL`）：
> CLI 用 `child_process.spawn` + 管道 stdio 调用 git/npm，而沙箱禁止管道 stdio。
> **合并本身已经成功**（git 操作走同步 execSync），只需手动补 `pnpm install`。

### 手头有未提交改动时怎么办（实测）

**先提交，再更新。** 实测三种情况：

| 情况 | git 行为 |
| --- | --- |
| 有未提交改动 + 上游改了同一文件 | **直接拒绝合并**：`error: Your local changes ... would be overwritten by merge`。改动完好无损，提交后重跑即可；此时**不要**手动 `git merge` |
| 已提交 + 改了同一文件的**不同位置** | 自动合并成功，无需干预 |
| 已提交 + 改了**同一行** | CONFLICT，git 打标记，需手动解决 |

因为自动保留只覆盖 `USER_CONTENT_PREFIXES`，且未提交改动会让 git 直接中止，
所以「先 commit」是最省事也最安全的入口：

```powershell
git add -A
git commit -m "wip: 本次改动"     # 只存本地，四舍五入零成本，且给了回滚点
pnpm koharu update               # 选「备份」
pnpm install
pnpm build && pnpm verify
git push                         # 自己的改动 + 合并一起推
```

> 不想留 wip 提交也可以用 `git stash`，但 stash 的恢复冲突**不受主题的自动保留
> 策略保护**，反而更难处理。推荐直接 commit。
>
> `git fetch upstream` 是只读的（只更新远程快照），想先看有没有新版本又不碰工作区：
> `git log --oneline HEAD..upstream/main`。

### 不要用 `--clean`

`pnpm koharu update --clean` 会用上游替换全部主题文件，再**从备份还原**用户内容。
但备份对 `src/pages/` 的规则是 `pattern: '*.md'` —— **不备 `.mdx`**，所以会删掉
本项目的 8 个 `.mdx` 页面且无法还原；`.migration/` 也会被删（含 `manifest.json`，
删除后构建直接失败）。用默认 merge 模式即可。

### v7.2.1 → v7.4.0 实测结果

- 上游 **91 个文件**变更（含索引页重设计）
- **零冲突**：`AppShell.astro` / `Layout.astro` 虽被上游改动，但改动行不重叠
- 我改的 5 个主题文件全部保留
- 依赖只 +1 −2，`@astrojs/mdx` 仍锁 7.0.8（上游未升 Astro）

### 更新暴露出的一个潜在 bug（已修）

v7.4.0 把分类页从「用 slug 重新映射」改成「按分类名精确解析」
（新增 `src/lib/content/index-categories.ts`，路由里生成 `path: string[]`），
于是暴露出 `config/site.yaml` 的一个旧问题：

```yaml
categoryMap:
  工具: tools
  教程: tools   # ← 重复 slug
  福利: tools   # ← 重复 slug
```

主题用 `slugToName`（反向 Map）从 URL 反查分类名，重复 slug 会**后者覆盖前者**，
反查 `tools` 得到「福利」，而分类树里只有「工具」→ `/categories/tools` 标题变空、
文章列表也匹配不到。

**修法**：删掉 `教程` / `福利` 这两个没有任何文章使用的映射。
**规则**：`categoryMap` 里一个 slug 只能对应一个分类名。

回归检查：`node .migration/check-categories.mjs`（已并入 `pnpm verify`），
校验 slug 唯一性、文章用到的分类名都已映射、以及构建出的分类页标题非空。

## 页脚备案信息

原 Hexo 博客页脚挂了三条备案（`_config.anzhiyu.yml` 的 `footer.linkList`），
已全部迁移。主题原生只支持一条 `site.icp`，所以另外扩展了两处配置。

| 原博客条目 | 现在的位置 |
| --- | --- |
| `晋ICP备-2025067606号` → beian.miit.gov.cn | `site.icp`（主题原生字段） |
| `晋公网安备14010502990310号` → beian.mps.gov.cn | `filings`（新增） |
| `萌ICP备20250740号` → icp.gov.moe（图片徽章） | `badges`（新增） |

```yaml
site:
  icp:                       # 主题原生字段，渲染为一行文字链接
    text: '晋ICP备-2025067606号'
    link: 'https://beian.miit.gov.cn/'

filings:                     # 额外备案，渲染为一行文字链接（用 · 分隔）
  - text: 晋公网安备14010502990310号
    link: https://beian.mps.gov.cn/#/

badges:                      # 图片徽章；有 image 显示图片，否则显示文字
  - text: 萌ICP备20250740号
    link: https://icp.gov.moe/?keyword=20250740
    image: https://img.shields.io/badge/...
```

`filings` 与 `badges` 由 `src/constants/site-config.ts` 读取，
在 `src/components/layout/Footer.astro` 中渲染（版权行下方、Powered by 上方），
置空数组即可隐藏对应一行。

> ℹ️ 萌 ICP 徽章的图片地址用的是普通 shields.io 静态徽章，替代了原博客 URL 里内嵌
一大段 base64 PNG logo 的写法（那种写法不可读、难维护）。观感是粉色
> `萌ICP备 20250740` 徽章，与原来接近。想完全复刻可以换回带 `logo=` 参数的地址。

> ⚠️ 公安网安备是**在中国大陆备案并托管于大陆机房**时需要的。你的原博客部署在
> Vercel，按规则本来也拿不到公安备案。这条我仍按你的原样加上了，如果确认不需要，
> 把 `filings` 置空即可。

## 背景特效（星空 / 流星）

原 Hexo 博客的「流星」来自 anzhiyu 主题的 **`universe`** 深色模式粒子效果：
`themes/anzhiyu/layout/includes/additional-js.pug` 挂一个 `<canvas id="universe">`，
再异步加载主题作者 CDN 上的 `anzhiyu-theme-static@1.0.0/dark/dark.js` 驱动。

已完整移植到 `src/components/effects/UniverseCanvas.astro`，**去掉 CDN 依赖**，
挂在 `src/layouts/AppShell.astro`。原始的三种粒子全部保留：

| 粒子 | 外观 |
| --- | --- |
| 大星 giant | 半径 2px，蓝白 `rgba(180,184,240)` |
| 普通星 star | 黄白小方块 `rgba(226,225,142)`，边长 1.1~2.6px |
| 流星 comet | 白色，30 段渐隐拖尾，斜向飞过 |

配置见 `config/site.yaml`：

```yaml
universe:
  enabled: true
  density: 0.216   # 粒子数 = ceil(density × 视口宽度)
  onlyDark: true   # 仅在深色模式显示（与原作者一致）
```

### 移植时做的必要修改

原文的 `dark.js` 是压缩过的，直接抄会出现几个问题，这里都修了：

1. **深色判定**：原站是 `html[data-theme="dark"]`，koharu 用 `html.dark`。
2. **流星方向**：原实现 `dy` 取负值（意图向上飞），但 canvas 的 y 轴向下，
   配合它 `this.y < 0` 的回收条件，粒子会被反复重置 —— 这在原站本身就是个观感
   bug。这里改为向下飞并调整回收边界，流星才真正横穿画面。
3. **叠加方式**：原站 `#universe` 是 `z-index: 1`，而 `body` 背景不透明
   （`--global-bg: #18171d`）、正文容器又是 `z-index: 4+`，所以那个 canvas
   基本被盖住了。这里改为 `z-index: 5` + `mix-blend-mode: screen`：screen 混合
   下暗色像素完全透明，只有星点会加亮，因此**正文始终清晰可读**，特效也真的看得见。
4. **性能与可访问性**：支持 `prefers-reduced-motion`、动效等级 `reduced`、
   标签页后台暂停、devicePixelRatio（限制到 2 倍）与 ResizeObserver 重排。

> ⚠️ 这是第 3 处对主题文件的修改（`AppShell.astro` 加一行 import + 一行挂载）。
> `pnpm koharu update` 时若该文件冲突，把这两行加回即可。

### 关闭樱花飘落

`config/site.yaml` 的 `motion.heroPetals` 已设为 `false`：

```yaml
motion:
  level: lively
  heroPetals: false   # 头图樱花飘落：关闭
  clickBurst: true    # 点击迸出花瓣：保留
```

两者是独立的开关。`heroPetals` 关闭后，`SakuraPetals` 组件不再渲染
（构建产物里没有 `cover-petals`，其 CSS 也被 tree-shake 掉了）。
如果连点击花瓣也想关掉，把 `clickBurst` 也设为 `false`。

访客若自己在右下角「设置 → 通用」里选了更高的动效强度，仍会以访客选择为准 ——
`motion.level` 只是**默认值**。

## ⚠️ Twikoo 评论服务已失效

配置里原本沿用的 `https://twikoo.weisifengbuxi.top` **已经无法解析**
（DNS NXDOMAIN，apex 域名正常但该子域没有记录）。也就是说**老站评论区现在同样是坏的**，
不只是新站的问题。

因此 `config/site.yaml` 里目前是占位地址：

```yaml
comment:
  provider: twikoo
  twikoo:
    envId: https://your-twikoo.example.com # TODO: 替换为你的 Twikoo 地址
```

重新部署 Twikoo 后，把 `envId` 换成真实地址即可，无需改其它文件。
暂时不想要评论就把 `provider` 改成 `none`。

**旧评论数据的迁移**：文章规范地址已由 `/posts/<abbrlink>.html` 变为
`/post/<abbrlink>`，而 Twikoo 默认以 `location.pathname` 作为评论归属键，
所以旧评论不会自动出现在新地址下。若需要延续，有两种做法：

1. 在 Twikoo 管理面板导出评论，把 `url` 字段批量改写后重新导入：
   `/posts/e4925c7a.html` → `/post/e4925c7a`
2. 给 Twikoo 配置 `path` 参数做映射（较麻烦，不推荐）

## 安全提示

旧仓库 `D:\代码\myBlog-hexo\deploy_config.json` 里的 `token` 字段**已被提交并推送到
公开仓库** `Weisifengbuxi/Weisifengbuxi.github.io`（该仓库为 public）。
这个 token 现在必须视为已泄漏：

1. 立刻到 https://github.com/settings/tokens 撤销该 token
2. 改用 GitHub Actions + `GITHUB_TOKEN`，或把凭据放到本地 `.env`（不要提交）
3. 如果该 token 有 `repo` 权限，检查仓库是否被异常推送或改动

本次迁移没有把任何凭据写入新博客。

