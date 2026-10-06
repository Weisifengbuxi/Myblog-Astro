/** 直接读写文件（避开控制台编码问题）验证导航项。 */
import fs from 'node:fs';

const html = fs.readFileSync('D:\\myBlog-astro\\dist\\index.html', 'utf8');

// 顶部导航里应出现指向 /equipment 的链接，且文案为「装备」
const navBlock = /<nav[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
const hasEquipmentLink = /href="\/equipment"/.test(html);
const labelInNav = navBlock.includes('装备');
const iconRendered = /ri:device-line|device-line/.test(html);

console.log('存在 /equipment 链接      :', hasEquipmentLink);
console.log('导航文案含「装备」        :', labelInNav);
console.log('device 图标已渲染         :', iconRendered);

// 顺序：应排在「歌单」之后
const iMusic = html.indexOf('/music');
const iEquip = html.indexOf('/equipment');
console.log('位置（歌单 idx / 装备 idx）:', iMusic, '/', iEquip, '→', iEquip > iMusic ? '在歌单之后 ✓' : '顺序异常');

const ok = hasEquipmentLink && labelInNav;
console.log(ok ? '\n✓ 装备已加入顶部导航' : '\n✗ 导航项未生效');
process.exit(ok ? 0 : 1);
