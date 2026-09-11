/**
 * story-card.js — Horizontal story card for feed rows (.h-row)
 * ─────────────────────────────────────────────────────────────
 * <script src="component/story-card.js"></script>
 *
 * Used on Discover (and anywhere you need a compact horizontal card):
 *   Continue Reading, Top Romance, Trending, New Releases,
 *   Editor's Picks, Recommended, Complete Stories, Recently Updated.
 *
 * ── RENDER ───────────────────────────────────────────────────
 *   StoryCard.render(story)  → HTML string
 *   StoryCard.renderMany(items) → joined HTML string
 *
 * Story shape (all fields optional except title + img for a useful card):
 *   {
 *     id, title, author, img,
 *     badge: 'new' | 'hot' | 'update',   // coloured pill
 *     rank: 1|2|3…,                     // numbered rank badge (overrides badge)
 *     rating: '4.8',                    // shows ★ rating
 *     ch: 'Ch. 12', pct: 40,            // continue-reading progress
 *     meta: '2.1M reads'                // plain meta line
 *   }
 *
 * Links:
 *   Cover + title → bridge.html?id=…
 *   Author        → profile.html?u=…  (stopPropagation so it doesn't open story)
 *
 * Optional config (once, before first render):
 *   StoryCard.configure({
 *     storyHref:  s => `bridge.html?id=${s.id}`,
 *     profileHref: author => `profile.html?u=${handle}`,
 *   });
 */

(function () {
  'use strict';
  if (window.__droboardStoryCard) return;
  window.__droboardStoryCard = true;

  /* ═══════════════════════ STYLES ═══════════════════════ */
  const CSS = `
    /* ── Horizontal story card (4 fit in one viewport width) ── */
    .scard{flex:0 0 calc((100% - 30px) / 4);width:calc((100% - 30px) / 4)}
    .scard-link{display:block;cursor:pointer}
    .scard:active{opacity:.85}
    .scard-cover{
      position:relative;width:100%;aspect-ratio:110/148;
      border-radius:9px;overflow:hidden;background:#e8e8ed;margin-bottom:6px;
      box-shadow:0 2px 8px rgba(0,0,0,.08);
    }
    .scard-cover img{width:100%;height:100%;display:block;object-fit:cover}
    .scard .badge{
      position:absolute;top:5px;left:5px;
      font-size:7px;font-weight:800;padding:2px 4px;border-radius:4px;
      letter-spacing:.2px;text-transform:uppercase;z-index:2;
    }
    .scard .badge.new{background:#22c55e;color:#fff}
    .scard .badge.hot{background:#ef4444;color:#fff}
    .scard .badge.update{background:#ff2d55;color:#fff}
    .scard .rank{
      position:absolute;top:5px;left:5px;
      width:18px;height:18px;border-radius:5px;
      background:#ff2d55;color:#fff;font-size:10px;font-weight:800;
      display:flex;align-items:center;justify-content:center;z-index:2;
    }
    .scard-title{
      font-size:10.5px;font-weight:600;line-height:1.3;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;
    }
    .scard-author{
      font-size:9.5px;color:#8e8e93;font-weight:500;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;
      display:inline-block;cursor:pointer;
    }
    .scard-meta{font-size:9.5px;color:#8e8e93;font-weight:500}
    .scard-rating{font-size:9.5px;color:#f59e0b;font-weight:600}
    .scard .cont-ch{font-size:9.5px;color:#8e8e93;margin-bottom:4px}
    .scard .prog-track{height:3px;background:#e5e5ea;border-radius:2px;overflow:hidden}
    .scard .prog-fill{height:100%;background:#ff2d55;border-radius:2px}
  `;

  let _hrefs = {
    storyHref: function (s) {
      const id = s.id || _slugify(s.title);
      return 'bridge.html?id=' + encodeURIComponent(id);
    },
    profileHref: function (author) {
      const handle = (author || '').replace('@', '');
      return 'profile.html?u=' + encodeURIComponent(handle);
    },
  };

  function _esc(s) {
    return (s || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _slugify(str) {
    return (str || '').toString().toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function _injectStyles() {
    if (document.getElementById('scard-styles')) return;
    const el = document.createElement('style');
    el.id = 'scard-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function configure(opts) {
    opts = opts || {};
    if (typeof opts.storyHref === 'function') _hrefs.storyHref = opts.storyHref;
    if (typeof opts.profileHref === 'function') _hrefs.profileHref = opts.profileHref;
  }

  /**
   * Render one horizontal story card.
   * @param {object} s  story object
   * @returns {string} HTML
   */
  function render(s) {
    _injectStyles();
    s = s || {};

    let badge = '';
    if (s.badge === 'new') badge = '<span class="badge new">NEW</span>';
    else if (s.badge === 'hot') badge = '<span class="badge hot">HOT</span>';
    else if (s.badge === 'update') badge = '<span class="badge update">Update</span>';
    else if (s.rank) badge = '<span class="rank">' + _esc(String(s.rank)) + '</span>';

    let extra = '';
    if (s.rating) {
      extra = '<div class="scard-rating">★ ' + _esc(s.rating) + '</div>';
    } else if (s.ch) {
      extra = '<div class="cont-ch">' + _esc(s.ch) + '</div>';
      if (s.pct != null) {
        extra += '<div class="prog-track"><div class="prog-fill" style="width:' +
          Number(s.pct) + '%"></div></div>';
      }
    } else if (s.meta) {
      extra = '<div class="scard-meta">' + _esc(s.meta) + '</div>';
    }

    const author = s.author
      ? '<a class="scard-author" href="' + _esc(_hrefs.profileHref(s.author)) +
        '" onclick="event.stopPropagation()">' + _esc(s.author) + '</a>'
      : '';

    return (
      '<div class="scard">' +
        '<a class="scard-link" href="' + _esc(_hrefs.storyHref(s)) + '">' +
          '<div class="scard-cover"><img src="' + _esc(s.img) +
            '" loading="lazy" alt=""/>' + badge + '</div>' +
          '<div class="scard-title">' + _esc(s.title) + '</div>' +
        '</a>' +
        author +
        extra +
      '</div>'
    );
  }

  function renderMany(items) {
    if (!items || !items.length) return '';
    return items.map(render).join('');
  }

  window.StoryCard = { render: render, renderMany: renderMany, configure: configure };
})();