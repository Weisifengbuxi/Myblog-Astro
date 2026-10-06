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

## 小空调（/air-conditioner）

`src/components/pages/AirConditioner.astro`，无第三方依赖。功能：

| 功能 | 说明 |
| --- | --- |
| 温度 −/＋ | 16~30 ℃，**按住 400ms 后连续调节**（pointerdown + interval） |
| 开机 / 关机 | 屏幕与 LED 状态、风口动效随之开关 |
| **制冷 / 制热** | 见下 |
| **按键音** | Web Audio 合成，无音频文件；可静音并记忆 |
| 键盘 | 面板聚焦后 `↑` `↓` 调温、`M` 切模式、`P` 开关机 |

### 制冷 / 制热模式

切换按钮在第二行（关机时禁用）。两套模式在三个地方有区别：

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
- 音色：温度/模式键是短促方波「哔」；开机是上行两音 660→990Hz，关机是下行 660→440Hz
- 每个音符带快速指数衰减包络，避免爆音
- 静音开关写入 `localStorage['air-conditioner-sound']`，**刷新后保持**
- 优先 `window.AudioContext`，回退 `webkitAudioContext`；构造失败时静默降级（不影响其它功能）

> 无头浏览器听不到声音，所以验证方式是**替换 `AudioContext` 并统计振荡器创建次数**：
> 开机 1 次、切模式 2 次、升温 5 次…… 静音后再按键计数不变，即可证明调用链被正确切断。

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
| `src/constants/site-config.ts` | 新增 `footerLinks` / `filings` / `badges` / `mournConfig` / `universeConfig` 导出 |
| `src/layouts/AppShell.astro` | 挂 `<UniverseCanvas />` |
| `src/layouts/BootScripts.astro` | 新增纪念日变灰的首屏内联脚本 |
| `src/layouts/Layout.astro` | 新增去色 CSS |

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

