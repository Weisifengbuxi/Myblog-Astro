---
layout: ../layouts/PageLayout.astro
title: "歌单"
description: "我喜欢的音乐"
---

{% media audio %}
- title: 我喜欢
  list:
    - https://y.qq.com/n/ryqq/playlist/4218963770
- title: 循环
  list:
    - https://y.qq.com/n/ryqq/playlist/8854224676
- title: 电音
  list:
    - https://y.qq.com/n/ryqq/playlist/8298787839
{% endmedia %}

> 列表里带 **VIP** 标记的歌需要 QQ 音乐会员，点它会提示并可以跳去 QQ 音乐收听；其余歌曲点击即可播放。
