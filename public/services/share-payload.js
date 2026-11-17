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
    const raw = i.link || i.targetUrl || i.url || i.shareUrl || '';
    const link = toLocalPath(raw, i) || buildLink(i, kindFrom(i, raw));
    const kind = kindFrom(i, link);
    const id = i.contentId || i.id || i.postId || i.storyId || i.bookId || i.collectionId || '';
    const target = Object.assign({}, i.target || {}, {
      postId: i.postId || (kind === 'post' || kind === 'hub' ? id : ''),
      bookId: i.bookId || i.storyId || (kind === 'story' ? id : ''),
      collectionId: i.collectionId || (kind === 'collection' ? id : ''),
      boardId: i.boardId || i.genreId || '',
      chapterId: i.chapterId || '',
      chapterN: i.chapterN || '',
      reader: i.reader || '',
    });
    return Object.assign({}, i, {
      kind, id, link, target,
      url: absolute(link),
      targetUrl: link,
      contentId: i.contentId || id,
      contentType: i.contentType || (kind === 'story' ? 'books' : kind === 'post' || kind === 'hub' ? 'posts' : kind === 'collection' ? 'collections' : ''),
      title: i.title || '',
      sub: i.sub || '',
      img: i.img || '',
    });
  }

  function open(input) {
    if (typeof window.openShareModal !== 'function') return false;
    window.openShareModal(payload(input));
    return true;
  }

  window.DroboardShare = { payload, absolute, toLocalPath, open };
})();
