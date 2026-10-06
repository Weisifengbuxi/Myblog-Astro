---
layout: ../layouts/PageLayout.astro
title: "友链申请"
coverTitle: "友链申请"
date: 2025-07-26 22:19:45
updated: 2025-10-28 18:20:44
description: "申请本站友情链接的格式、要求与免责声明。已收录的友链列表请见友链页面。"
comments: true
---

<div class="friendlink-gate">

## 我的友链格式

请按下面任意一种格式提供你的站点信息（推荐第一种）。已收录的友链列表见 [友链页面](/friends)。

;;;tab1 anzhiyu
```yml
- name: 未似风不息
  link: https://www.weisifengbuxi.top/
  avatar: https://s21.ax1x.com/2025/09/26/pVIFGXq.jpg
  descr: 学习技术 分享生活
  siteshot: https://s21.ax1x.com/2025/09/29/pVomdB9.png
```
;;;

;;;tab1 Volantis
```json
{
  "title": "未似风不息",
  "screenshot": "https://s21.ax1x.com/2025/09/29/pVomdB9.png",
  "url": "https://www.weisifengbuxi.top/",
  "avatar": "https://s21.ax1x.com/2025/09/26/pVIFGXq.jpg",
  "description": "学习技术 分享生活",
  "keywords": "博客,技术,生活"
}
```
;;;

;;;tab1 Fluid
```yml
- {
    title: "未似风不息",
    intro: "学习技术 分享生活",
    link: "https://www.weisifengbuxi.top/",
    image: "https://s21.ax1x.com/2025/09/26/pVIFGXq.jpg",
  }
```
;;;

;;;tab1 通用表格

|  名称   |         内容         |
|:-----:|:------------------:|
| 站点名称  | 用于统计站内访问情况，进行针对性优化 |
| 站点截图  |  <https://s21.ax1x.com/2025/09/29/pVomdB9.png>  |
| 站点链接  |  <https://www.weisifengbuxi.top/>  |
| 站长头像  |  <https://s21.ax1x.com/2025/09/26/pVIFGXq.jpg>  |
| 站点描述  |        学习技术 分享生活         |
| 站点关键词  |        博客,技术,生活         |

;;;

:::warning 免责声明
本博客遵守中华人民共和国相关法律。本页内容仅作为方便学习而产生的快速链接的链接方式，对与友情链接中存在的链接、好文推荐链接等均为其他网站。因本人能力有限无法逐个甄别每篇文章的每个字，并无法获知是否在收录后原作者是否对链接增加了违反法律甚至其他破坏用户计算机等行为。因为部分友链网站甚至没有做备案、域名并未做实名认证等，所以友链网站均可能存在风险，请您须知。

## 所以在我力所能及的情况下，我会包括但不限于

- 针对收录的博客中的绝大多数内容通过标题来鉴别是否存在有风险的内容；
- 在收录的友链好文推荐中检查是否存在风险内容；

## 但是您在访问的时候，仍然无法避免，包括但不限于

1. 作者更换了超链接的指向，替换成了其他内容
2. 作者的服务器被恶意攻击、劫持、被注入恶意内容
3. 作者的域名到期，被不法分子用作他用
4. 作者修改了文章内容，增加钓鱼网站、广告等无效信息
5. 不完善的隐私保护对用户的隐私造成了侵害、泄漏
6. 最新文章部分为机器抓取，本站作者未经过任何审核和筛选，本着友链信任原则添加的。如果您发现其中包含违反中华人民共和国法律的内容，请及时联系和举报。该友链会被拉黑。

如果因为从本页跳转给您造成了损失，深表歉意，并且建议用户如果发现存在问题在本页面进行回复。通常会很快处理。

如果长时间无法得到处理，建议联系 [sun060729@qq.com](mailto:sun060729@qq.com)
:::

:::info 本站添加的友链要求
1. 能够正常访问
2. 含本站友链
3. 网站类型为个人博客

评论申请后在我不忙的时候会统一添加，即使不通过也会给予邮件回复。
:::

<p style="padding:0 0 0 .8rem">
    请<strong>勾选</strong>您符合的条件：
</p>
<div id="friendlink_checkboxs" style="padding:0 0 0 1.6rem">
    <p>
        <label class="checkbox">
            <input type="checkbox" id="checkbox1">
            我已添加 <b>未似风不息</b> 博客的友情链接
        </label>
    </p>
    <p>
        <label class="checkbox">
            <input type="checkbox" id="checkbox2">
            我的链接主体为 <b>个人</b>，网站类型为<b>博客</b>
        </label>
    </p>
    <p>
        <label class="checkbox">
            <input type="checkbox" id="checkbox3">网站现在可以在中国大陆区域正常访问
        </label>
    </p>
    <p>
        <label class="checkbox">
            <input type="checkbox" id="checkbox4">网站内容符合中国大陆法律法规
        </label>
    </p>
    <p>
        <label class="checkbox">
            <input type="checkbox" id="checkbox5">网站正常可以在 15s 内加载完成首屏
        </label>
    </p>
</div>

:::success no-icon
确定自己的博客符合以上条件后，直接在评论框的默认文字后填写补充对应信息即可（当五个条件全部被勾选时才会弹出评论框）。
:::

</div>

<script>
  // Gate the Twikoo comment box behind the five checkboxes.
  //
  // Differences from the Hexo version, which could assume a synchronously
  // injected `#tcomment`:
  //   * astro-koharu renders Twikoo through React and loads the UMD bundle
  //     lazily, so `.tk-submit` does not exist on DOMContentLoaded — watch for
  //     it with a MutationObserver.
  //   * The textarea is Element Plus (`.el-textarea__inner`), not a Vue
  //     `el-textarea__inner` reachable at a fixed index.
  //   * Prefilling the value is not enough: Element Plus tracks state
  //     internally, so a plain `input` event is not always honoured. We set the
  //     value and dispatch both `input` and `change`.
  (() => {
    const CHECKBOX_IDS = ['checkbox1', 'checkbox2', 'checkbox3', 'checkbox4', 'checkbox5'];
    const PLACEHOLDER = '- name: \n  link: \n  avatar: \n  descr: \n  siteshot: ';
    const root = document.querySelector('.friendlink-gate');
    if (!root) return;

    const allChecked = () =>
      CHECKBOX_IDS.every((id) => {
        const el = document.getElementById(id);
        return el instanceof HTMLInputElement && el.checked;
      });

    const prefill = () => {
      const input = root.querySelector('.tk-submit .el-textarea__inner');
      if (!(input instanceof HTMLTextAreaElement)) return;
      if (input.value.trim()) return; // never clobber what the visitor typed
      input.value = PLACEHOLDER;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    };

    const sync = () => {
      const submit = root.querySelector('.tk-submit');
      if (!(submit instanceof HTMLElement)) return;
      submit.classList.toggle('friendlink-gate-open', allChecked());
      if (allChecked()) {
        prefill();
        submit.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    for (const id of CHECKBOX_IDS) {
      document.getElementById(id)?.addEventListener('change', sync);
    }

    // The gate class is applied by CSS only after Twikoo mounts.
    const observer = new MutationObserver(() => {
      if (root.querySelector('.tk-submit')) sync();
    });
    observer.observe(root, { childList: true, subtree: true });
    sync();
  })();
</script>

<style>
  /* Hidden until all five conditions are ticked. Scoped to this page so other
     articles keep their comment box visible. */
  .friendlink-gate .tk-submit {
    opacity: 0;
    height: 0;
    overflow: hidden;
    transition:
      opacity 0.5s,
      height 0.5s;
  }

  .friendlink-gate .tk-submit.friendlink-gate-open {
    opacity: 1;
    height: auto;
    overflow: visible;
  }

  .friendlink-gate #friendlink_checkboxs .checkbox {
    cursor: pointer;
  }

  .friendlink-gate #friendlink_checkboxs input[type='checkbox'] {
    margin-right: 0.35rem;
  }
</style>
