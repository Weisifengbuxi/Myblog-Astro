---
title: AnZhiYu主题美化：为爱好的游戏卡片添加头像
link: e4925c7a
date: '2025-01-01T00:00:00.000Z'
updated: '2025-11-15T17:45:44.558Z'
description: >-
  之前看张洪heo大佬的博客，在他的个人主页，爱好的游戏卡片上，发现了他将自己喜欢的英雄展示了出来。
  因为我也喜欢玩联盟（尤其他喜欢玩的英雄恰巧我也喜欢玩），于是也想在自己的博客中添加类似的功能。花了一下午的时间，终于实现了这个功能。 效果： 教程
  打开文件：博客根目录/themes/anzhiyu/
categories:
  - - 学习笔记
    - 美化
tags:
  - 博客美化
  - hexo
  - AnZhiYu
cover: >-
  https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/fengmian11.2.webp
---

之前看张洪 heo 大佬的[博客](https://blog.zhheo.com/)，在他的个人主页，爱好的游戏卡片上，发现了他将自己喜欢的英雄展示了出来。

![fengmian11.1.webp](https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/fengmian11.1.webp)

因为我也喜欢玩联盟（尤其他喜欢玩的英雄恰巧我也喜欢玩），于是也想在自己的博客中添加类似的功能。花了一下午的时间，终于实现了这个功能。

效果：
![fengmian11.webp](https://images.weserv.nl/?url=https://cdn.jsdelivr.net/gh/Weisifengbuxi/tuchuang@main/img/fengmian11.webp)
## 教程

打开文件：博客根目录/themes/anzhiyu/layout/includes/page/about.pug

在大约 175 行，找到如下代码段：

```pug
      .author-content
        - let {game_tips, game_title, game_uid, game_bg} = item.game
        .author-content-item.game-yuanshen(style=`background: url(${game_bg}) top / cover no-repeat;`)
          .card-content
            .author-content-item-tips=game_tips
            span.author-content-item-title=game_title
            .content-bottom
              .icon-group
                .loading-bar(role='presentation', aria-hidden='true' style=`${game_title != "原神" ? "display: none": ""}`)
              .tips.game-yuanshen-uid=game_uid
        .author-content-item.comic-content
          .card-content
            - let {comic_tips, comic_title, comic_list} = item.comic
            .author-content-item-tips=comic_tips
            .author-content-item-title=comic_title
            .comic-box
              if comic_list
                each i in comic_list
                  a.comic-item(href=i.href, target="_blank", title=i.name)
                    .comic-item-cover
                      img(src=i.cover, alt=i.name)
```

将其修改为：

```pug
      .author-content
        - let {game_tips, game_title, game_uid, game_bg} = item.game
        .author-content-item.game-yuanshen(style=`background: url(${game_bg}) top / cover no-repeat;`)
          .card-content
            .author-content-item-tips=game_tips
            span.author-content-item-title=game_title
            .hero-group
              img.hero-group-item(
                data-tooltip="提示信息1"                            //替换为你喜欢的角色名称
                src="https://xxxxxxxxxx.com/your-image1.webp"     //替换为你喜欢的角色头像
                alt="提示信息1")                                   //替换为你喜欢的角色名称
              img.hero-group-item(
                data-tooltip="提示信息2"
                src="https://xxxxxxxxxx.com/your-image1.webp"
                alt="提示信息2")
              img.hero-group-item(
                data-tooltip="提示信息3"
                src="https://xxxxxxxxxx.com/your-image1.webp"
                alt="提示信息3")
            .hero-tooltip
            .content-bottom
              .icon-group
                .loading-bar(role='presentation', aria-hidden='true' style=`${game_title != "原神" ? "display: none" : ""}`)
              .tips.game-yuanshen-uid=game_uid
        .author-content-item.comic-content
          .card-content
            - let {comic_tips, comic_title, comic_list} = item.comic
            .author-content-item-tips=comic_tips
            .author-content-item-title=comic_title
            .comic-box
              if comic_list
                each i in comic_list
                  a.comic-item(href=i.href, target="_blank", title=i.name)
                    .comic-item-cover
                      img(src=i.cover, alt=i.name)
```
复制粘贴之后，你需要先修改这段代码格式。

然后，需要修改这段代码中的这一部分：
```pug
img.hero-group-item(
data-tooltip="提示信息1"                            //替换为你喜欢的角色名称
src="https://xxxxxxxxxx.com/your-image1.webp"     //替换为你喜欢的角色头像
alt="提示信息1")                                    //替换为你喜欢的角色名称
```
每一段这个代码即表示一个头像，展示顺序为从左到右，你可以根据自己的喜好，添加多个头像。

然后还是这个文件,在文件最下方，也就是 script 标签内，添加如下代码：
```pug
      function initEventDelegation() {
          const heroGroup = document.querySelector('.hero-group');
          const tooltip = document.querySelector('.hero-tooltip');

          if (!heroGroup) {
              setTimeout(initEventDelegation, 100);
              return;
          }

          if (!tooltip) {
              console.error('提示框元素未找到');
              return;
          }

          // 使用事件委托，在父元素上监听
          heroGroup.addEventListener('mouseover', function (e) {
              if (e.target.classList.contains('hero-group-item')) {
                  const allItems = document.querySelectorAll('.hero-group-item');

                  // 变暗其他头像
                  allItems.forEach(item => {
                      if (item !== e.target) item.classList.add('dimmed');
                  });

                  // 显示提示框
                  const tipText = e.target.getAttribute('data-tooltip');
                  if (tipText) {
                      tooltip.textContent = tipText;

                      // 计算提示框位置
                      const targetRect = e.target.getBoundingClientRect();
                      const tooltipRect = tooltip.getBoundingClientRect();

                      // 计算提示框位置（在头像上方居中）
                      let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                      let top = targetRect.top - tooltipRect.height - 10;

                      // 边界检查，确保提示框不会超出屏幕
                      if (left < 10) left = 10;
                      if (left + tooltipRect.width > window.innerWidth - 10) {
                          left = window.innerWidth - tooltipRect.width - 10;
                      }
                      if (top < 10) {
                          top = targetRect.bottom + 10;
                      }

                      tooltip.style.left = left + 'px';
                      tooltip.style.top = top + 'px';
                      tooltip.classList.add('show');

                      console.log('显示提示框:', tipText, '位置:', left, top);
                  }
              }
          });

          heroGroup.addEventListener('mouseout', function (e) {
              if (e.target.classList.contains('hero-group-item')) {
                  const allItems = document.querySelectorAll('.hero-group-item');

                  // 恢复所有头像
                  allItems.forEach(item => item.classList.remove('dimmed'));

                  // 隐藏提示框
                  tooltip.classList.remove('show');
              }
          });

          console.log('英雄头像事件委托初始化完成');
      }

      // 使用多种方式确保执行
      document.addEventListener('DOMContentLoaded', initEventDelegation);
      window.addEventListener('load', initEventDelegation);
      document.addEventListener('pjax:complete', initEventDelegation);
```
如果你不知道格式，可以使用快捷键来格式化代码。

打开第二个文件：博客根目录/themes/anzhiyu/source/css/_page/about.styl
在文件最下方，添加如下代码：

```stylus
.author-content-item.game-yuanshen {
  position: relative !important;
  overflow: hidden !important; /* 保持 hidden 确保圆角裁剪 */
}

.author-content-item.game-yuanshen .card-content .hero-group {
  position: absolute;
  bottom: 20px;
  left: 40px;
  display: flex;
  align-items: center;
  z-index: 3;
}

.hero-group-item {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--anzhiyu-main);
  object-fit: cover;
  position: relative;
  z-index: 1;
  transition: z-index 0.2s, transform 0.2s;
  cursor: pointer;
}

.hero-group-item:nth-child(n+2) {
  margin-left: -10px; /* 调整这个值控制重叠程度 */
}

.hero-group-item img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

.hero-group-item:hover {
  transform: scale(1.1) !important;
  z-index: 10 !important;
}

/* 英雄提示框样式 */
/* 提示框样式 - 使用固定定位 */
.hero-tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 10000;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  font-weight: 500;
  max-width: 200px;
  text-align: center;
  /* 添加小箭头 */
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }
}

.hero-tooltip.show {
  opacity: 1;
  visibility: visible;
}

/* 英雄头像基础样式 */
.hero-group-item {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--anzhiyu-main);
  object-fit: cover;
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
  cursor: pointer;
}

/* 重叠效果 */
.hero-group-item:nth-child(n+2) {
  margin-left: -10px;
}

/* 悬停效果 */
.hero-group-item:hover {
  z-index: 10;
  transform: scale(1.1);
}

/* 变暗效果 */
.hero-group-item.dimmed {
  opacity: 0.3;  
}
```
这个样式是头像之间有一些重叠效果，因为我的喜欢玩的英雄很多（嘿嘿）。

你可以根据注释来针对你的喜好进行修改
```stylus
/* 英雄头像样式 */
.author-content-item.game-yuanshen {
  position: relative !important;
  overflow: hidden !important; /* 保持 hidden 确保圆角裁剪 */
}

.author-content-item.game-yuanshen .card-content .hero-group {
  position: absolute !important;
  bottom: 20px !important;
  left: 40px !important;
  display: flex !important;
  gap: 8px !important;
  z-index: 3 !important;
}

.hero-group-item {
  width: 40px !important;
  height: 40px !important;
  border-radius: 50% !important;
  border: 2px solid var(--anzhiyu-main) !important;
  overflow: hidden !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
}

.hero-group-item img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

.hero-group-item:hover {
  transform: scale(1.1) !important;
  z-index: 10 !important;
}

/* 英雄提示框样式 */
.hero-tooltip {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  z-index: 10000;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  transition: opacity 0.2s ease;
  white-space: nowrap;
}

.hero-tooltip.show {
  opacity: 1;
}

.hero-group-item.dimmed {
  opacity: 0.5;
  transition: opacity 0.3s ease;
}
```

然后一键三连即可查看效果啦。

