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
    /* ── Rich horizontal story card (Discover sections) ─────────────── */
    .sr-card{
      flex:0 0 calc((100% - 30px) / 4);width:calc((100% - 30px) / 4);
      margin-left:0;margin-right:0;
    }
    .sr-cover{
      position:relative;width:100%;aspect-ratio:110/148;
      border-radius:9px;overflow:hidden;background:#e8e8ed;margin-bottom:5px;
      box-shadow:0 2px 8px rgba(0,0,0,.08);
    }
    .sr-cover img{width:100%;height:100%;object-fit:cover}
    .sr-tags-row{display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap}
    .sr-genre-badge{
      font-size:7px;font-weight:700;padding:2px 5px;border-radius:4px;
      background:#f5f5f7;color:#8e8e93;text-transform:uppercase;letter-spacing:.2px;
    }
    .sr-trope-badge{
      font-size:7px;font-weight:700;padding:2px 5px;border-radius:4px;
      background:rgba(255,45,85,.12);color:#ff2d55;display:flex;align-items:center;gap:3px;
    }
    .sr-trope-badge i{font-size:6px}
    .sr-title{
      font-size:10px;font-weight:700;line-height:1.3;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;
    }
    .sr-synopsis{
      font-size:8.5px;color:#6e6e73;line-height:1.5;
      margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    }
    .sr-meta{display:flex;align-items:center;gap:6px;font-size:8.5px}
    .sr-author{
      color:#ff2d55;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      cursor:pointer;
    }
    .sr-avatar{width:14px;height:14px;border-radius:50%;object-fit:cover}
    .sr-stats{display:flex;align-items:center;gap:8px;font-size:8.5px;margin-top:2px}
    .sr-stat{display:flex;align-items:center;gap:3px;color:#8e8e93}
    .sr-stat i{font-size:7px}
    .sr-stat span{color:#8e8e93}
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
   * Render one horizontal story card (rich format with genre/trope badges, synopsis, @author, stats).
   * @param {object} s  story object with optional rich fields:
   *   genre, tropes[], synopsis, authorAv, rating, ch → displays full metadata like in Discover sections
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

    // Build rich metadata: genre badge, trope badges, synopsis, author, stats
    const hasGenre = s.genre;
    const hasTropes = (s.tropes || []).length > 0;
    const hasSynopsis = s.synopsis && s.synopsis.length > 0;
    const hasAvatar = s.authorAv && s.author;
    const hasAuthorText = s.author;
    const hasRating = s.rating != null;
    const hasChapters = s.chapters != null || s.chapterCount != null;

    // Tags row (genre + tropes)
    let tagsHTML = '';
    if (hasGenre) {
      tagsHTML += `<div class="sr-genre-badge">${_esc(s.genre)}</div>`;
    }
    if (hasTropes) {
      tagsHTML += (s.tropes || []).map(t => 
        `<div class="sr-trope-badge"><i class="fas fa-bolt"></i>${_esc(t)}</div>`
      ).join('');
    }
    tagsHTML = tagsHTML ? `<div class="sr-tags-row">${tagsHTML}</div>` : '';

    // Title
    const titleHTML = '<div class="sr-title">' + _esc(s.title) + '</div>';

    // Synopsis (max 2 lines, truncated)
    const synop = hasSynopsis ? (s.synopsis.length > 120 ? s.synopsis.slice(0, 120) + '...' : s.synopsis) : '';
    const synopHTML = synop ? '<div class="sr-synopsis">' + _esc(synop) + '</div>' : '';

    // Stats row (rating + chapters)
    let statsHTML = '';
    if (hasRating || hasChapters) {
      statsHTML = '<div class="sr-stats">';
      if (hasRating) statsHTML += '<div class="sr-stat"><i class="fas fa-star" style="color:#f59e0b"></i><span>' + _esc(s.rating) + '</span></div>';
      if (hasChapters) statsHTML += '<div class="sr-stat"><i class="fas fa-book"></i><span>' + _esc(s.chapterCount || s.chapters || s.ch || '') + ' ch</span></div>';
      statsHTML += '</div>';
    }

    // Author row
    let authorHTML = '';
    if (hasAvatar) {
      authorHTML = '<div class="sr-meta">' +
        '<img src="' + _esc(s.authorAv) + '" class="sr-avatar" alt=""/>' +
        '<a class="sr-author" href="' + _esc(_hrefs.profileHref(s.author)) + '" onclick="event.stopPropagation()">@' + _esc(s.author.replace(/^@?/, '')) + '</a>' +
        '</div>';
    } else if (hasAuthorText) {
      authorHTML = '<div class="sr-meta">' +
        '<a class="sr-author" href="' + _esc(_hrefs.profileHref(s.author)) + '" onclick="event.stopPropagation()">@' + _esc(s.author.replace(/^@?/, '')) + '</a>' +
        '</div>';
    }

    return (
      '<div class="sr-card">' +
        '<a class="scard-link" href="' + _esc(_hrefs.storyHref(s)) + '">' +
          '<div class="sr-cover"><img src="' + _esc(s.img || s.cover) +
            '" loading="lazy"/>' + badge + '</div>' +
          tagsHTML +
          titleHTML +
          synopHTML +
          statsHTML +
          authorHTML +
        '</a>' +
      '</div>'
    );
  }

  /**
   * Render a compact story card (legacy format for progress bars, simple rating rows).
   * Used where only minimal metadata is needed.
   * @deprecated use render() for modern rich cards
   */
  function renderCompact(s) {
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
          '<div class="scard-cover"><img src="' + _esc(s.img || s.cover) +
            '" loading="lazy"/>' + badge + '</div>' +
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

  window.StoryCard = { 
    render: render, 
    renderMany: renderMany, 
    configure: configure 
  };
})();