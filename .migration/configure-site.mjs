#!/usr/bin/env node
/**
 * Rewrites config/site.yaml for the migrated blog, preserving the upstream
 * comment blocks (which double as documentation) and replacing only the
 * site-specific values.
 */
import fs from 'node:fs';

const FILE = 'D:\\myBlog-astro\\config\\site.yaml';
let s = fs.readFileSync(FILE, 'utf8');

/** Replace a top-level block: from `key:` to the next line starting at column 0 that is not blank/comment. */
function replaceBlock(src, key, replacement) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.startsWith(key + ':'));
  if (start === -1) throw new Error(`block not found: ${key}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '' || l.startsWith(' ') || l.startsWith('\t')) continue;
    end = i;
    break;
  }
  // absorb leading comment lines that belong to the following block
  while (end > start + 1 && lines[end - 1].trimStart().startsWith('#')) end--;
  const out = [...lines.slice(0, start), ...replacement.split('\n'), ...lines.slice(end)];
  return out.join('\n');
}

// ---------------------------------------------------------------- site
s = replaceBlock(
  s,
  'site',
  `site:
  title: 未似风不息 # 网站名称
  alternate: Weisifengbuxi # 网站英文名称 用于页脚、Logo、@ handle 等
  subtitle: 学习技术 分享生活 # 网站副标题
  name: 未似风不息 # 作者名称
  description: 未似风不息的个人技术博客，分享计算机组成原理、数据结构与算法、数学建模等学习笔记，以及生活感悟与博客搭建教程。 # 网站描述
  avatar: /img/avatar.jpg # 网站头像
  showLogo: false # 是否显示图形 Logo
  author: 未似风不息 # 作者名称
  url: https://www.weisifengbuxi.top # 站点 URL 用于 RSS 和 SEO
  defaultOgImage: /img/avatar.jpg # 默认 Open Graph 图片
  startYear: 2025 # 建站年份
  timezone: Asia/Shanghai # 时区配置 (IANA 格式)
  keywords: # SEO 关键词 (全局)
    - 博客
    - 学习笔记
    - 计算机组成原理
    - 数据结构
    - 算法
    - 数学建模
    - Hexo
    - 个人博客
  # breadcrumbHome: 首页  # 面包屑导航中首页的显示名称（默认: '首页'）
  # icp:                         # ICP 备案号（可自定义链接）
  #   text: "粤ICP备xxxxxxxxxx号"
  #   link: "https://beian.miit.gov.cn/"
  # Enable slug transliteration (converts CJK characters to pinyin/romaji)
  # Note: enabling this will break existing CJK URLs. Run \`pnpm save-slugs\` first to save old slugs into frontmatter.link
  # enableSlugTransliteration: true`
);

// ---------------------------------------------------------------- i18n
s = replaceBlock(
  s,
  'i18n',
  `i18n:
  defaultLocale: zh
  locales:
    - code: zh
      label: 中文
    # 内容与 UI 翻译尚未提供，如需启用多语言请先补齐 src/i18n/translations/<code>.ts
    - code: en
      label: English
      enabled: false
    - code: ja
      label: 日本語
      enabled: false
    - code: ko
      label: 한국어
      enabled: false`
);

// ---------------------------------------------------------------- categoryMap
s = replaceBlock(
  s,
  'categoryMap',
  `categoryMap:
  # 一级分类
  生活日常: life
  学习笔记: note
  工具: tools
  # 学习笔记下的二级分类（URL 形如 /categories/note/code）
  代码学习: note/code
  理论学习: note/theory
  排序: note/algorithm
  比赛: note/contest
  美化: note/beautify
  数学建模: note/modeling
  # 其他
  教程: tools
  福利: tools
  # 可按需继续添加：
  # 书摘: reading
  # 项目: project`
);

// ---------------------------------------------------------------- featuredCategories
s = replaceBlock(
  s,
  'featuredCategories',
  `featuredCategories:
  - link: note
    label: 学习笔记
    image: /img/cover/4.webp
    description: 计算机组成原理、数据结构与算法等课程笔记
  - link: note/code
    label: 代码学习
    image: /img/cover/1.webp
    description: Java 数据结构、链表栈队列与递归
  - link: tools
    label: 工具
    image: /img/cover/11.webp
    description: 博客美化、CDN 加速与效率工具
  - link: life
    label: 生活日常
    image: /img/cover/2.webp
    description: 生活记录、随想与见闻`
);

// ---------------------------------------------------------------- featuredSeries
s = replaceBlock(
  s,
  'featuredSeries',
  `featuredSeries:
  # 暂未启用系列文章功能。
  # 如需启用，取消下面的注释并按需修改（slug 不能与 about/categories/tags/friends/posts/archives 等保留路由冲突）：
  - slug: weekly
    categoryName: 学习笔记
    label: 我的周刊
    fullName: 我的技术周刊
    description: |
      这是周刊/系列文章功能的示例配置。
    cover: /img/weekly_header.webp
    enabled: false
    icon: ri:newspaper-line`
);

// ---------------------------------------------------------------- social
s = replaceBlock(
  s,
  'social',
  `social:
  github:
    url: https://github.com/Weisifengbuxi
    icon: ri:github-fill
    color: '#191717'
  email:
    url: mailto:sun060729@qq.com
    icon: ri:mail-line
    color: '#55acd5'
  rss:
    url: /rss.xml
    icon: ri:rss-line
    color: '#ff6600'
  # bilibili:
  #   url: https://space.bilibili.com/451525062
  #   icon: ri:bilibili-fill
  #   color: '#da708a'`
);

// ---------------------------------------------------------------- friends
s = replaceBlock(
  s,
  'friends',
  `friends:
  intro:
    title: 友情链接
    subtitle: 欢迎交换友链！
    applyTitle: 申请友链
    applyDesc: 请在本页留言，格式如下
    exampleYaml: |
      - site: 你的博客名称 # 站点名称
        url: https://your-blog.com/ # 站点网址
        owner: 你的昵称 # 昵称
        desc: 站点简介 # 站点简介
        image: https://your-blog.com/avatar.jpg # 头像链接
        color: "#ffc0cb" # 主题色（可选）
  data:
    # —— 框架 ——
    - site: Hexo
      url: https://hexo.io/zh-tw/
      owner: Hexo
      desc: 快速、简单且强大的网站框架
      image: https://d33wubrfki0l68.cloudfront.net/6657ba50e702d84afb32fe846bed54fba1a77add/827ae/logo.svg
      color: '#0e83cd'
    - site: anzhiyu主题
      url: https://blog.anheyu.com/
      owner: 安知鱼
      desc: 生活明朗，万物可爱
      image: https://npm.elemecdn.com/anzhiyu-blog-static@1.0.4/img/avatar.jpg
      color: '#425aef'
    # —— 推荐博客 ——
    - site: 小嗷犬的技术小站
      url: https://blog.marquis.eu.org/
      owner: 小嗷犬
      desc: 为天地立心，为生民立命，为往圣继绝学，为万世开太平
      image: https://blog.marquis.eu.org/img/avatar/2.png
      color: '#BEDCFF'
    - site: Akilarの糖果屋
      url: https://akilar.top/
      owner: Akilar
      desc: 欢迎光临糖果屋
      image: https://npm.elemecdn.com/akilar-friends@latest/avatar/akilar.top.jpg
      color: '#FBC1CC'
    - site: 青桔气球
      url: https://blog.qjqq.cn/
      owner: 青桔气球
      desc: 分享网络安全与科技生活
      image: https://q2.qlogo.cn/headimg_dl?dst_uin=1645253&spec=640
      color: '#ABDCFF'
    - site: 张洪Heo
      url: https://blog.zhheo.com/
      owner: 张洪Heo
      desc: 分享设计与科技生活
      image: https://img.zhheo.com/i/67d8fa75943e4.webp
      color: '#6ec6ff'
    - site: 山岳库博
      url: https://kmar.top/
      owner: 山岳库博
      desc: 开发学习启发性二刺螈
      image: https://s21.ax1x.com/2025/09/01/pVcHzGt.png
      color: '#ffb3c1'
    - site: 梦爱吃鱼
      url: https://blog.bsgun.cn/
      owner: 梦爱吃鱼
      desc: 不负心灵，不负今生
      image: https://oss-cdn.bsgun.cn/logo/avatar.256.png
      color: '#a0e7e5'
    - site: 周润发
      url: https://blog.zrf.me/
      owner: 周润发
      desc: 收录开源，好用的互联网项目
      image: https://blog.zrf.me/img/logo.webp
      color: '#ffd6a5'
    - site: 清羽飞扬
      url: https://blog.liushen.fun/
      owner: 清羽飞扬
      desc: 柳影曳曳，清酒孤灯，扬笔撒墨，心境如霜
      image: https://blog.liushen.fun/info/avatar.ico
      color: '#cdb4db'
    - site: 杜老师说
      url: https://dusays.com
      owner: 杜老师
      desc: 师者，传道，受业，解惑！
      image: https://cdn.dusays.com/favicon.ico
      color: '#bde0fe'
    # —— 小伙伴 ——
    - site: 谢大大
      url: https://xiedada.net/
      owner: 谢大大
      desc: 现实中的技术大佬
      image: https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/youlian1.jpg
      color: '#ffc8dd'
    - site: 洛元の小屋
      url: https://blog.dimeta.top/
      owner: 洛元
      desc: 科技，游戏，生活
      image: https://blog.dimeta.top/upload/avatar.jpg
      color: '#b8e0d2'
    - site: 碧水荡漾
      url: https://blog.yvyang.top
      owner: 碧水荡漾
      desc: 澄空碧山 绿水余漾
      image: https://blog.yvyang.top/favicon.webp
      color: '#c7f9cc'
    - site: Lifeline
      url: https://lifelinest.github.io/
      owner: Lifeline
      desc: 经世致用 自强不息
      image: http://p2.music.126.net/x55FPD2xWTqmMIFjDKXogw==/109951163513084093.jpg?param=130y130
      color: '#d0f4de'
    - site: 辰渊尘の个人博客
      url: https://blog.mcxiaochen.top/
      owner: 辰渊尘
      desc: 偏技术
      image: https://blog.mcxiaochen.top/favicon.ico
      color: '#e4c1f9'
    - site: KangQi の Blog
      url: https://www.kangqiovo.com
      owner: KangQi
      desc: 惟有忍耐到底的，必然得救
      image: https://www.kangqiovo.com/wp-content/uploads/2025/10/KangQi-.png
      color: '#fcf6bd'`
);

// ---------------------------------------------------------------- navigation
s = replaceBlock(
  s,
  'navigation',
  `navigation:
  - name: 首页
    nameKey: nav.home
    path: /
    icon: ri:home-heart-fill
  - name: 文章
    nameKey: nav.posts
    icon: ri:quill-pen-ai-fill
    children:
      - name: 分类
        nameKey: nav.categories
        path: /categories
        icon: ri:grid-fill
      - name: 标签
        nameKey: nav.tags
        path: /tags
        icon: fa6-solid:tags
      - name: 归档
        nameKey: nav.archives
        path: /archives
        icon: ri:archive-2-fill
  - name: 友链
    nameKey: nav.friends
    path: /friends
    icon: ri:links-line
  - name: 关于
    nameKey: nav.about
    path: /about
    icon: fa6-regular:circle-user
  - name: 歌单
    nameKey: nav.music
    path: /music
    icon: ri:music-2-fill`
);

// ---------------------------------------------------------------- comment
s = replaceBlock(
  s,
  'comment',
  `comment:
  provider: twikoo # 'remark42' | 'giscus' | 'waline' | 'twikoo' | 'none'
  # 沿用 Hexo 博客原有的 Twikoo 服务，历史评论在相同 pathname 下继续可见。
  # 注意：文章路径由 /posts/<abbrlink>.html 变为 /post/<abbrlink>，
  # 如需让旧评论也显示，请在 Twikoo 后台按新路径迁移评论数据。
  twikoo:
    envId: https://twikoo.weisifengbuxi.top
    lang: zh-CN`
);

// ---------------------------------------------------------------- analytics
s = replaceBlock(
  s,
  'analytics',
  `analytics:
  umami:
    enabled: false
    id: your-umami-id
    endpoint: https://stats.example.com
    # statistics_display:
    #   token: your-umami-share-token
    #   article_page_views: true
    #   footer_site_stats: true`
);

// ---------------------------------------------------------------- bangumi
s = replaceBlock(
  s,
  'bangumi',
  `# bangumi:
#   userId: cosine
#   # label: 追番
#   # icon: ri:bilibili-fill`
);

// ---------------------------------------------------------------- bgm
s = replaceBlock(
  s,
  'bgm',
  `bgm:
  enabled: false  # 没有配置 audio 时保持关闭
  # metingApi: https://163.hyc.moe/  # Meting API 地址，推荐自部署
  # audio:
  #   - title: 最爱山山
  #     list:
  #       - https://music.163.com/playlist?id=8676645748`
);

// ---------------------------------------------------------------- dev
s = replaceBlock(
  s,
  'dev',
  `dev:
  localProjectPath: 'D:/myBlog-astro' # 本地项目绝对路径
  contentRelativePath: 'src/content/blog'
  editors:
    - id: vscode
      name: VS Code
      icon: devicon-plain:vscode
      urlTemplate: 'vscode://file/{path}'
    - id: cursor
      name: Cursor
      icon: simple-icons:cursor
      urlTemplate: 'cursor://file/{path}'
    - id: zed
      name: Zed
      icon: simple-icons:zedindustries
      urlTemplate: 'zed://file/{path}'`
);

fs.writeFileSync(FILE, s, 'utf8');
console.log('config/site.yaml rewritten.');
