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
  words: ['学习', '生活', '程序', '体验'],
};

export const skills = {
  tips: '技能',
  title: '开启创造力',
  /** icon 取 simple-icons 的图标名（https://simpleicons.org）。 */
  list: [
    { name: 'HTML5', icon: 'html5', color: '#e34f26' },
    { name: 'CSS3', icon: 'css3', color: '#1572b6' },
    { name: 'JavaScript', icon: 'javascript', color: '#f7df1e' },
    { name: 'TypeScript', icon: 'typescript', color: '#3178c6' },
    { name: 'Vue', icon: 'vuedotjs', color: '#4fc08d' },
    { name: 'React', icon: 'react', color: '#20232a' },
    { name: 'Node.js', icon: 'nodedotjs', color: '#339933' },
    { name: 'Python', icon: 'python', color: '#3776ab' },
    { name: 'Java', icon: 'openjdk', color: '#e76f00' },
    { name: 'Git', icon: 'git', color: '#f05032' },
  ],
};

/** simple-icons 的 CDN 前缀；换源只需改这一处。 */
export const SKILL_ICON_BASE = 'https://unpkg.com/simple-icons@13/icons';

export const careers = {
  tips: '生涯',
  title: '无限进步',
  timeline: { startYear: '2025', endLabel: '现在', desc: '北师香港浸会大学，计算机科学与技术' },
};

/** 所在地。lon/lat 用于拼静态地图瓦片，label 用于文案。 */
export const location = {
  tips: '我现在住在',
  city: '珠海市',
  label: '中国，广东省，珠海市',
  lon: 113.5767,
  lat: 22.2707,
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

export const game = { tips: '爱好的游戏', title: '王者荣耀 英雄联盟', uid: 'ID(微信): 未似风不息　ID(QQ): Keepsilent' };
export const comic = { tips: '爱看小说', title: '在追小说', count: 5 };
export const likeTech = { tips: '关注偏好', title: '科技', bottom: '手机、电脑软件' };
export const likeMusic = { tips: '音乐偏好', title: '流行音乐、电音', bottom: '跟未似风不息一起欣赏更多音乐', link: '/music' };
export const tenyear = { tips: '十年之约', title: '一个人的寂寞，一群人的狂欢。', range: '2025/07/18 — 2035/07/18' };

export const rewardList = [
  { name: '嘟乐妈', amount: 1125.6, date: '2025-10-16' },
  { name: '老孙', amount: 1, date: '2025-07-27' },
  { name: '*哥', amount: 1, date: '2025-07-27' },
  { name: '孙点点', amount: 200, date: '2025-07-29' },
  { name: '华', amount: 500, date: '2025-07-30' },
  { name: '睡觉哇', amount: 6, date: '2025-07-30' },
];
