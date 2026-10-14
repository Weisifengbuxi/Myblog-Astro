/**
 * 关于页数据。
 *
 * 卡片内容全部集中在这里，改内容不用动组件。
 * 形态参照 anheyu 官方关于页（https://blog.anheyu.com/about）的卡片结构。
 */

export const profile = {
  avatar: 'https://images.weserv.nl/?url=https://raw.githubusercontent.com/Weisifengbuxi/tuchuang/main/img/Wechat.jpg',
  /** 头像左右两侧的标签（左 4 右 4）。 */
  tagsLeft: ['🤖️ 科技软件爱好者', '🔍 分享与热心帮助', '🏠 智能家居小能手', '📘 平日里爱看小说'],
  tagsRight: ['专修计算机科学 💻', '脚踏实地行动派 🏃', '团队小组发动机 🔯', '热爱于竞技游戏 🎮'],
  /** 头像下方的页面大标题。 */
  heading: '关于本站',
};

export const hello = {
  greeting: '你好，很高兴认识你👋',
  name: '未似风不息',
  subtitle: '是一名学生、博主',
};

export const pursuit = {
  tips: '追求',
  line1: '源于',
  line2: '热爱而去 感受',
  /** 每个词一个颜色，轮换时颜色也跟着变，避免整卡只有一个色。 */
  words: [
    { text: '学习', color: '#4f7cff' },
    { text: '生活', color: '#2fb37a' },
    { text: '程序', color: '#e9536a' },
    { text: '体验', color: '#f0a020' },
  ],
};

export const skills = {
  tips: '技能',
  title: '开启创造力',
  /**
   * icon 可以是**完整图片地址**（http/https/data:），也可以是 simple-icons 的图标名
   * （如 `html5`、`vuedotjs`，见 https://simpleicons.org）；后者会拼上 {@link SKILL_ICON_BASE}。
   * 这批图标沿用原 Hexo 博客的图片（最多 16 个），因此这里全部写完整地址。
   */
  list: [
    { name: 'Java', color: '#fff', icon: 'https://bu.dusays.com/2023/04/09/643293b1184e9.jpg' },
    { name: 'Docker', color: '#57b6e6', icon: 'https://bu.dusays.com/2023/04/09/643293b0f0abe.png' },
    { name: 'Photoshop', color: '#4082c3', icon: 'https://bu.dusays.com/2022/12/15/639aa3a5c240e.png' },
    { name: 'Node', color: '#333', icon: 'https://npm.elemecdn.com/anzhiyu-blog@2.1.1/img/svg/node-logo.svg' },
    { name: 'Webpack', color: '#2e3a41', icon: 'https://bu.dusays.com/2023/04/09/643293b68026c.png' },
    {
      name: 'Premiere Pro',
      color: '#9A99FF',
      icon: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/PR1.png',
    },
    { name: 'Python', color: '#fff', icon: 'https://bu.dusays.com/2023/04/09/643293b1230f7.png' },
    { name: 'Vite', color: '#937df7', icon: 'https://npm.elemecdn.com/anzhiyu-blog@2.0.8/img/svg/vite-logo.svg' },
    {
      name: 'After Effects',
      color: '#9A99FF',
      icon: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/AE.png',
    },
    { name: 'Vue', color: '#b8f0ae', icon: 'https://bu.dusays.com/2023/04/09/643293b6788bd.png' },
    // { name: 'React', color: '#222', icon: 'https://unpkg.com/simple-icons@13/icons/react.svg' },
    { name: 'CSS3', color: '#2c51db', icon: 'https://bu.dusays.com/2022/12/15/639aa3a5c251e.png' },
    { name: 'JS', color: '#f7cb4f', icon: 'https://bu.dusays.com/2023/04/09/643293b121f02.png' },
    { name: 'HTML', color: '#e9572b', icon: 'https://bu.dusays.com/2022/12/15/639aa3a5c241c.png' },
    { name: 'Git', color: '#df5b40', icon: 'https://bu.dusays.com/2023/04/09/643293b10ccdd.webp' },
    // { name: 'Apifox', color: '#e65164', icon: 'https://bu.dusays.com/2022/11/19/6378d6458c6b6.png' },
    {
      name: 'C',
      color: '#ffffff',
      icon: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/Cyuyan.png',
    },
    {
      name: 'MYSQL',
      color: '#000000',
      icon: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/com037-scaled.jpg',
    },
  ],
};

/** simple-icons 的 CDN 前缀；换源只需改这一处。 */
export const SKILL_ICON_BASE = 'https://unpkg.com/simple-icons@13/icons';

/** 技能图标的最终地址：完整地址原样返回，simple-icons 名拼上 CDN 前缀。 */
export function skillIconSrc(icon: string): string {
  return /^(https?:)?\/\/|^data:/.test(icon) ? icon : `${SKILL_ICON_BASE}/${icon}.svg`;
}

export const careers = {
  tips: '生涯',
  title: '无限进步',
  desc: '北师香港浸会大学，计算机科学与技术',
  /** 换成你自己的图片地址即可；留空则不显示图片。 */
  image: 'https://s21.ax1x.com/2025/09/02/pVgMzY4.png',
};

/** 所在地。图片换成你自己的即可；留空则显示占位块。 */
export const location = {
  tips: '我现在住在',
  label: '中国，广东省，珠海市',
  image: 'https://images.weserv.nl/?url=https://raw.githubusercontent.com/Weisifengbuxi/tuchuang/main/img/ditu.png',
};

export const selfInfo = [
  { tips: '生于', content: '2006' },
  { tips: '北师香港浸会大学', content: '计算机科学与技术' },
  { tips: '现在职业', content: '大三学生👨‍🎓' },
];

export const personality = {
  tips: '性格',
  name: '提倡者',
  type: 'INFJ-A',
  image: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/INFJ-A.svg',
  link: 'https://www.16personalities.com/ch/infj-%E4%BA%BA%E6%A0%BC',
};

/** 右侧照片位（可换成自己的照片）。 */
export const photo = 'https://s21.ax1x.com/2025/09/02/pVgQUpj.jpg';

export const maxim = { tips: '座右铭', line1: '谁无狂风劲雨时', line2: '拨开云雾见天日' };
export const buff = { tips: '特长', line1: 'MOBA，非射击类竞技游戏', line2: '意识流编写代码' };

/**
 * 爱好的游戏。
 *
 * 这张卡就放**一张图片**（版式对齐 anheyu 的 .game-yuanshen 卡：整块铺满）。
 * 图片换成你自己的即可；留空时显示占位提示。href 可留空。
 */
export const game = {
  tips: '爱好的游戏',
  title: '王者荣耀 英雄联盟',
  image: 'https://s21.ax1x.com/2025/10/23/pVXmmND.png',
  href: '',
};

/**
 * 在追的小说（或番剧）。
 *
 * 版式与交互来自旧博客 anzhiyu 主题的 `.comic-content` 卡片：
 * 封面斜切（skew -10deg）横向排成一条，悬停时该张横向展开并把封面放大。
 * cover 用竖版封面图效果最好（卡片高度固定，图片会被裁成竖条）。
 */
export const comic = {
  tips: '在追小说',
  title: '最近在看',
  /** 卡片左下角的小字，可留空。 */
  date: '',
  list: [
    {
      name: '怪谈游戏设计师',
      cover: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/guaitan.webp',
      href: 'https://www.qidian.com/book/1036804203/',
    },
    {
      name: '仙宫开物',
      cover: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/xiangongkaiwu.webp',
      href: 'https://www.qidian.com/book/1039889503/',
    },
    {
      name: '异兽迷城',
      cover: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/yishoumicheng.jpg',
      href: 'https://fanqienovel.com/page/7081535608648109069?enter_from=search',
    },
    {
      name: '万劫之主',
      cover: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/wanjiejiezhu.jpg',
      href: 'https://www.tadu.com/book/1033848/',
    },
    {
      name: '十日终焉',
      cover: 'https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/shirizhongyan.webp',
      href: 'https://fanqienovel.com/page/7143038691944959011?enter_from=search',
    },
  ],
};

/**
 * 十年之约进度条。
 *
 * 移植自 https://blog.gbfun.cc/posts/5498433.html（原版是 Solitude 主题的效果）。
 * 按其「8-25 修正版」实现：日期在渲染阶段格式化成 `Y/M/D` 并写入 data-date，
 * 避免 `new Date(文本)` 在不同系统语言下被解析成 M/D/YYYY。
 */
export const tenyear = {
  tips: '十年之约',
  title: '一个人的寂寞，一群人的狂欢。',
  start: '2025/07/18',
  end: '2035/07/18',
};

/**
 * 倒计时卡片。
 *
 * 移植自 https://blog.bsgun.cn/posts/68c5cdb9（原版是安知鱼主题的侧边栏组件）。
 * 左侧显示目标事件与剩余天数，右侧是今日/本周/本月/本年的进度条，
 * hover 时进度条上浮出「还剩 X」，右侧百分比常驻显示。
 *
 * targetDate 请用 `Y/M/D` 或 `YYYY-MM-DD` 书写；脚本会统一转成 `Y/M/D` 再交给
 * Date 解析——带连字符的 `YYYY-MM-DD` 会被当成 UTC，东八区会差一天。
 */
export const countdown = {
  tips: '倒计时',
  targetDate: '2027/02/06',
  targetName: '春节',
  units: {
    day: { text: '今日', unit: '小时' },
    week: { text: '本周', unit: '天' },
    month: { text: '本月', unit: '天' },
    year: { text: '本年', unit: '天' },
  },
};

export const rewardList = [
  { name: '嘟乐妈', amount: 1125.6, date: '2025-10-16' },
  { name: '老孙', amount: 1, date: '2025-07-27' },
  { name: '*哥', amount: 1, date: '2025-07-27' },
  { name: '孙点点', amount: 200, date: '2025-07-29' },
  { name: '华', amount: 500, date: '2025-07-30' },
  { name: '睡觉哇', amount: 6, date: '2025-07-30' },
];
