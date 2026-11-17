/* ═══════════════════════════════════════════════════════════════
   SHARE PAYLOAD — window.DroboardShare
   ───────────────────────────────────────────────────────────────
   ONE place that decides what a share means, no matter which page
   or card raised it. Call sites may pass whatever they happen to
   have (url, contentId, contentType, postId, storyId, genreId,
   chapter, collectionId, target…). This normalizes it to one shape:

     { title, sub, img, kind, id, link, url, target, contentId,
       contentType }

   `link` is a SITE-RELATIVE in-app path (/Pages/…). That is what gets
   stored in a repost, so the app can change domain without breaking
   "lead back to what was shared". `url` is the absolute form built
   from location.origin AT SHARE TIME — used for copying / platform
   links. No hardcoded droboard.app / droboard.com anywhere in call
   sites; legacy URLs of those domains are only translated here.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardShare) return;

  function origin() {
    try { return location.origin || (location.protocol + '//' + location.host); }
    catch (e) { return ''; }
  }
  function absolute(link) {
    const s = String(link || '');
    if (/^https?:\/\//i.test(s)) return s;
    if (s.indexOf('/') === 0) return origin() + s;
    return s;
  }
  function enc(v) { return encodeURIComponent(String(v == null ? '' : v)); }

  /* Preview/quote hint ONLY (used by "Post to Status"). Reposts never copy
     this body — the sharer writes their own note. Kept canonical so status
     shares of reviews/recommendations can quote the source if they want. */
  function sourceText(i) {
    if (i.text || i.note || i.reviewText || i.body) {
      return String(i.text || i.note || i.reviewText || i.body || '');
    }
    const p = i.post || {};
    const o = p.original || {};
    const s = p.storyRef || {};
    return String(p.note || p.reviewText || p.text || o.note || o.text || s.title || '');
  }
  function sourceTitle(i) {
    if (i.title) return String(i.title);
    const p = i.post || {};
    const o = p.original || {};
    const s = p.storyRef || {};
    const c = p.chapterRef || {};
    return String(p.title || p.heading || o.title || s.title || c.title || p.quote || '');
  }
  function sourceSub(i) {
    if (i.sub) return String(i.sub);
    const p = i.post || {};
    return p.name || p.handle ? '@' + String(p.name || p.handle) : '';
  }
  function sourceImg(i) {
    if (i.img) return String(i.img);
    const p = i.post || {};
    return String(p.image || (p.storyRef && p.storyRef.cover) || (p.chapterRef && p.chapterRef.cover) || (p.original && p.original.cover) || p.avatar || '');
  }

  /* Translate a legacy absolute URL (or a same-origin absolute URL) into a
     relative in-app path. Foreign URLs are left untouched — sharing an
     external link is still a valid share. */
  function toLocalPath(raw, input) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (s.indexOf('/Pages/') === 0 || (s.indexOf('/') === 0 && !s.startsWith('//'))) return s;
    try {
      const o = origin();
      if (o && s.indexOf(o + '/') === 0) {
        const u = new URL(s);
        return u.pathname + u.search + u.hash;
      }
    } catch (e) {}
    const m = s.match(/^https?:\/\/(?:www\.)?(?:droboard\.app|droboard\.com)\/(.*)$/i);
    if (!m) return s;
    const p = m[1].replace(/^\/+/, '');
    const hash = (p.match(/#ch(\d+)/i) || [])[1] || '';
    const qch = (p.match(/[?&]ch=(\d+)/i) || [])[1] || '';
    const ch = hash || qch || (input && (input.chapter || input.chapterN)) || '';
    const strip = p.split(/[?#]/)[0];
    const i = input || {};
    if (/^post\//i.test(strip)) return '/Pages/discussion.html?id=' + enc(strip.slice(5));
    if (/^story\/|^book\//i.test(strip)) {
      const bid = strip.replace(/^(story|book)\//i, '');
      return ch ? '/Pages/full-reader.html?story=' + enc(bid) + '&ch=' + enc(ch)
        : '/Pages/bridge.html?id=' + enc(bid);
    }
    if (/^collection\//i.test(strip)) return '/Pages/collection.html?id=' + enc(strip.slice(11));
    if (/^hub\/[^/]+\/(.+)$/i.test(strip)) {
      const parts = strip.split('/');
      const id = parts[2] || (i.contentId || i.id || '');
      const genre = (i.genreId || i.genre || parts[1] || '');
      return '/Pages/discussion.html?genre=' + enc(genre) + '&id=' + enc(id);
    }
    if (/^droboard\/post\//i.test(strip)) return '/Pages/discussion.html?id=' + enc(strip.slice(14));
    if (/^droboard\/?$/i.test(strip)) return '/Pages/droboard-page.html';
    if (/^ad\//i.test(strip)) return '/Pages/feed.html';
    return o ? s : s;
  }

  function kindFrom(input, link) {
    const i = input || {};
    if (i.kind) return String(i.kind);
    const ct = String(i.contentType || '').toLowerCase();
    if (ct === 'books') return 'story';
    if (ct === 'posts') return 'post';
    if (ct === 'collections') return 'collection';
    if (i.chapterId || i.chapterN) return 'chapter';
    if (i.storyId || i.bookId) return 'story';
    if (i.postId) return 'post';
    if (i.collectionId) return 'collection';
    if (i.genreId && (i.contentId || i.id)) return 'hub';
    if (/\/discussion\.html/i.test(link)) return 'post';
    if (/\/bridge\.html|\/full-reader\.html/i.test(link)) return 'story';
    if (/\/collection\.html/i.test(link)) return 'collection';
    if (/\/leaderboard\.html/i.test(link)) return 'league';
    if (/\/droboard-page\.html/i.test(link)) return 'page';
    return 'link';
  }

  function buildLink(i, kind) {
    const id = i.contentId || i.id || '';
    if ((kind === 'story' || kind === 'book') && id) {
      return i.chapterId || i.chapterN
        ? '/Pages/full-reader.html?story=' + enc(i.storyId || i.bookId || id) + '&ch=' + enc(i.chapterId || i.chapterN)
        : '/Pages/bridge.html?id=' + enc(id);
    }
    if (kind === 'chapter' && (i.storyId || i.bookId)) {
      return '/Pages/full-reader.html?story=' + enc(i.storyId || i.bookId) + '&ch=' + enc(i.chapterId || i.chapterN || '');
    }
    if ((kind === 'post' || kind === 'hub') && id) {
      return '/Pages/discussion.html' + (i.genreId || i.genre ? '?genre=' + enc(i.genreId || i.genre) + '&' : '?') + 'id=' + enc(id);
    }
    if (kind === 'collection' && (i.collectionId || id)) return '/Pages/collection.html?id=' + enc(i.collectionId || id);
    if (kind === 'league') return '/Pages/leaderboard.html';
    if (kind === 'page') return '/Pages/droboard-page.html';
    return '';
  }

  function payload(input) {
    const i = input || {};
    const p = i.post || {};
    // One normalized input: scalar args win, but a raw `post` is understood too
    // so a call site can hand over the whole card and stop rebuilding fields.
    const n = Object.assign({}, i, {
      contentId: i.contentId || p.id || '',
      postId: i.postId || p.id || '',
      storyId: i.storyId || (p.storyRef && p.storyRef.id) || (p.chapterRef && p.chapterRef.id) || '',
      bookId: i.bookId || (p.bookRef && p.bookRef.id) || '',
      collectionId: i.collectionId || p.collectionId || '',
      genreId: i.genreId || p._genreId || '',
      chapterId: i.chapterId || (p.chapterRef && p.chapterRef.id) || '',
      chapterN: i.chapterN || '',
      kind: i.kind || (p.type === 'repost' ? 'post' : ''),
    });
    const raw = n.link || n.targetUrl || n.url || n.shareUrl || '';
    const link = toLocalPath(raw, n) || buildLink(n, kindFrom(n, raw));
    const kind = kindFrom(n, link);
    const id = n.contentId || n.id || n.postId || n.storyId || n.bookId || n.collectionId || '';
    const target = Object.assign({}, n.target || {}, {
      postId: n.postId || (kind === 'post' || kind === 'hub' ? id : ''),
      bookId: n.bookId || n.storyId || (kind === 'story' ? id : ''),
      collectionId: n.collectionId || (kind === 'collection' ? id : ''),
      boardId: n.boardId || n.genreId || '',
      chapterId: n.chapterId || '',
      chapterN: n.chapterN || '',
      reader: n.reader || '',
    });
    return Object.assign({}, i, {
      kind, id, link, target,
      url: absolute(link),
      targetUrl: link,
      contentId: n.contentId || id,
      contentType: n.contentType || (kind === 'story' ? 'books' : kind === 'post' || kind === 'hub' ? 'posts' : kind === 'collection' ? 'collections' : ''),
      title: sourceTitle(n),
      sub: sourceSub(n),
      text: sourceText(n),
      img: sourceImg(n),
    });
  }

  function open(input) {
    if (typeof window.openShareModal !== 'function') return false;
    window.openShareModal(payload(input));
    return true;
  }

  window.DroboardShare = { payload, absolute, toLocalPath, open };
})();
