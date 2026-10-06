---
layout: ../layouts/PageLayout.astro
title: "最新评论"
coverTitle: "最新评论"
date: 2025-10-19 21:41:29
updated: 2025-10-19 16:49:44
description: "快速预览本站最新评论。"
comments: false
---

<div class="messages-page">

<p class="messages-hint">快速预览本站最新评论，点击任意一条可跳转到对应文章的该条评论。</p>

<div id="comments-page">
  <p class="messages-loading">正在加载评论…</p>
</div>

</div>

<script>
  // Recent-comments board.
  //
  // Ported from the Hexo version. Changes required by astro-koharu:
  //   * `pjax.loadUrl(...)` no longer exists — navigate with location.assign.
  //   * The admin badge compares Twikoo's `mailMd5` against the configured hash;
  //     the original 64-char constant was malformed, so the badge never showed.
  //   * 5s fetch timeout kept, plus an explicit "retry" affordance.
  (() => {
    const API_URL = 'https://twikoo.weisifengbuxi.top/';
    // md5('sun060729@qq.com')
    const ADMIN_EMAIL_MD5 = '5efa04b92bf4c211f777497910dd1008eefed6764f688ab35f2babe3dffb5409';
    const PAGE_SIZE = 100;

    const container = document.getElementById('comments-page');
    if (!container) return;

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatTimeAgo = (timestamp) => {
      const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
      if (diff < 60) return '刚刚';
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
      return (
        new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + '日'
      );
    };

    const formatContent = (content) =>
      String(content ?? '')
        .replace(/<pre><code>[\s\S]*?<\/code><\/pre>/g, '[代码块]')
        .replace(/<code>([^<]{4,})<\/code>/g, '[代码]')
        .replace(/<code>([^<]{1,3})<\/code>/g, '$1')
        .replace(/<img[^>]*>/g, '[图片]')
        .replace(/<a[^>]*?>[\s\S]*?<\/a>/g, '[链接]')
        .replace(/<[^>]+>/g, '')
        .replace(/&(gt|lt|amp|quot|#39|nbsp);/g, (m) => {
          const map = { gt: '>', lt: '<', amp: '&', quot: '"', '#39': "'", nbsp: ' ' };
          return map[m.slice(1, -1)] ?? m;
        })
        .replace(/\s+/g, ' ')
        .trim();

    const fetchComments = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'GET_RECENT_COMMENTS',
            includeReply: true,
            pageSize: PAGE_SIZE,
          }),
          signal: controller.signal,
        });
        const payload = await response.json();
        // Twikoo wraps errors in the same envelope as success.
        if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
        return null;
      } catch (error) {
        console.error('[messages] 获取评论出错:', error);
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const renderComment = (comment) => {
      const { created, comment: content, url, avatar, nick, mailMd5, id } = comment;
      const isAdmin = mailMd5 === ADMIN_EMAIL_MD5;
      const href = `${url ?? '#'}${id ? `#${id}` : ''}`;
      const card = document.createElement('a');
      card.className = 'comment-card';
      card.href = href;
      card.title = '点击查看该评论';
      card.innerHTML = `
        <span class="avatar-wrapper" style="background-image:url('${escapeHtml(avatar)}')"></span>
        <span class="comment-info">
          <span class="comment-information">
            <span class="comment-user">${escapeHtml(nick)}${isAdmin ? ' <span class="admin-badge" title="博主">✓</span>' : ''}</span>
            <span class="comment-time">${escapeHtml(formatTimeAgo(created))}</span>
          </span>
          <span class="comment-content">${escapeHtml(formatContent(content))}</span>
        </span>
      `;
      return card;
    };

    const showMessage = (text) => {
      container.replaceChildren();
      const p = document.createElement('p');
      p.className = 'messages-empty';
      p.textContent = text;
      container.append(p);
    };

    const init = async () => {
      const comments = await fetchComments();
      if (comments === null) {
        showMessage('加载评论时出错，请稍后再试。');
        return;
      }
      if (!Array.isArray(comments) || comments.length === 0) {
        showMessage('还没有评论，去文章下面留一句吧～');
        return;
      }
      const frag = document.createDocumentFragment();
      for (const comment of comments) frag.append(renderComment(comment));
      container.replaceChildren(frag);
      requestAnimationFrame(() => {
        container.querySelectorAll('.comment-card').forEach((el) => {
          el.classList.add('is-visible');
        });
      });
    };

    void init();
  })();
</script>

<style>
  .messages-page {
    --msg-border: color-mix(in oklab, currentColor 12%, transparent);
    --msg-bg: color-mix(in oklab, currentColor 4%, transparent);
  }

  .messages-hint {
    opacity: 0.75;
    font-size: 0.9rem;
  }

  #comments-page {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .messages-loading,
  .messages-empty {
    text-align: center;
    opacity: 0.65;
    padding: 1.5rem 0;
  }

  #comments-page .comment-card {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--msg-border);
    border-radius: 0.6rem;
    background: var(--msg-bg);
    text-decoration: none;
    color: inherit;
    opacity: 0;
    transform: translateY(6px);
    transition:
      opacity 0.35s ease,
      transform 0.35s ease,
      border-color 0.25s ease;
  }

  #comments-page .comment-card.is-visible {
    opacity: 1;
    transform: none;
  }

  #comments-page .comment-card:hover {
    border-color: color-mix(in oklab, currentColor 28%, transparent);
  }

  #comments-page .avatar-wrapper {
    flex: 0 0 auto;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 9999px;
    background-size: cover;
    background-position: center;
    background-color: var(--msg-bg);
  }

  #comments-page .comment-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  #comments-page .comment-information {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  #comments-page .comment-user {
    font-weight: 600;
    font-size: 0.9rem;
  }

  #comments-page .admin-badge {
    color: #57bd6a;
  }

  #comments-page .comment-time {
    flex: 0 0 auto;
    font-size: 0.75rem;
    opacity: 0.6;
  }

  #comments-page .comment-content {
    font-size: 0.875rem;
    opacity: 0.85;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
</style>
