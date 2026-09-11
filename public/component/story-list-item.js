/**
 * story-list-item.js — Vertical list item for genre feeds + infinite "More Stories"
 * ───────────────────────────────────────────────────────────────────────────────
 * <script src="component/story-list-item.js"></script>
 *
 * Shared by:
 *   • Discover page  → #moreList (infinite scroll)
 *   • browse-overlay → genre mode list
 *
 * Class names (bro-list-*) are intentional so both places stay visually identical.
 * Styles are injected once; safe to load from multiple pages.
 *
 * ── RENDER HELPERS ───────────────────────────────────────────────────────
 *   StoryListItem.story(s)          → normal story row
 *   StoryListItem.platformAd(ad)    → DroBoard house ad (gold fill + CTA)
 *   StoryListItem.bookAd(ad)        → writer-promoted book (gold border + tag)
 *   StoryListItem.writersRow(list)  → one-time avatar row
 *   StoryListItem.render(entry)     → dispatches by entry.kind
 *                                     { kind: 'story'|'platformAd'|'bookAd'|'writers', data? }
 *
 * Story / bookAd shape:
 *   { id, title, author, img, genre, preview, rating, chapters }
 *
 * Platform ad shape:
 *   { title, sponsor, cta, img }
 *
 * Writers shape (array):
 *   [{ name, handle, avatar }, …]
 *
 * Optional config:
 *   StoryListItem.configure({
 *     storyHref:   s => `bridge.html?id=${s.id}`,
 *     profileHref: author => `profile.html?u=${handle}`,
 *   });
 */

(function () {
  'use strict';
  if (window.__droboardStoryListItem) return;
  window.__droboardStoryListItem = true;

  /* ═══════════════════════ STYLES ═══════════════════════ */
  const CSS = `
    :root{
      --bro-gold:#c9a227;--bro-gold-soft:#fdf7e6;--bro-shadow:rgba(0,0,0,.08);
      --bro-border:#ebebed;--bro-text:#1a1a1a;--bro-muted:#8e8e93;--bro-acc:#ff2d55;
    }

    .bro-list{display:flex;flex-direction:column}
    .bro-list-item{
      display:flex;gap:12px;padding:13px 0;
      border-bottom:1px solid var(--bro-border);position:relative;
    }
    .bro-list-cover{
      width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;
      background:#e8e8ed;box-shadow:0 2px 8px var(--bro-shadow);position:relative;
    }
    .bro-list-cover img{width:100%;height:100%;display:block;object-fit:cover}
    .bro-list-cover-link,.bro-list-title-link{display:block;cursor:pointer}
    .bro-list-cover-link:active .bro-list-cover,
    .bro-list-title-link:active .bro-list-title{opacity:.7}
    .bro-list-body{
      flex:1;min-width:0;display:flex;flex-direction:column;
      justify-content:center;gap:4px;
    }
    .bro-list-genre{
      font-size:9px;font-weight:800;color:var(--bro-acc);
      text-transform:uppercase;letter-spacing:.05em;
    }
    .bro-list-title{
      font-size:13.5px;font-weight:700;line-height:1.3;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    }
    .bro-list-preview{
      font-size:11.5px;color:var(--bro-muted);line-height:1.45;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    }
    .bro-list-foot{
      display:flex;align-items:center;gap:10px;margin-top:2px;flex-wrap:wrap;
    }
    .bro-list-stat{
      display:flex;align-items:center;gap:3px;
      font-size:10px;color:var(--bro-muted);font-weight:600;
    }
    .bro-list-author{color:var(--bro-acc);font-weight:800;cursor:pointer}

    /* platform (house) ad — filled gold-tint box with CTA */
    .bro-list-item.bro-ad{
      border:1.5px solid var(--bro-gold);border-radius:12px;
      background:var(--bro-gold-soft);padding:12px;margin:6px 0;
      border-bottom:1.5px solid var(--bro-gold);
    }
    .bro-ad-tag{
      position:absolute;top:6px;left:6px;z-index:2;
      font-size:7px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;
      padding:2px 6px;border-radius:4px;background:var(--bro-gold);color:#fff;
    }
    .bro-ad .bro-list-cover{border:1.5px solid var(--bro-gold)}
    .bro-ad-cta{
      align-self:flex-start;margin-top:4px;font-size:10.5px;font-weight:800;
      color:#fff;background:var(--bro-gold);padding:5px 12px;border-radius:14px;
    }

    /* book ad — writer-promoted book */
    .bro-list-item.bro-book-ad{
      border:1.5px solid var(--bro-gold);border-radius:12px;padding:10px;margin:4px 0;
    }

    /* top writers row — plain avatars, no card frame */
    .bro-writers-row{
      padding:14px 0 8px;border-bottom:1px solid var(--bro-border);margin-bottom:4px;
    }
    .bro-writers-head{font-size:12.5px;font-weight:800;margin-bottom:10px}
    .bro-writers-scroll{
      display:flex;gap:16px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;
    }
    .bro-writers-scroll::-webkit-scrollbar{display:none}
    .bro-writer{
      display:flex;flex-direction:column;align-items:center;gap:6px;
      flex-shrink:0;width:64px;text-align:center;
    }
    .bro-writer-avatar{width:52px;height:52px;border-radius:50%;object-fit:cover}
    .bro-writer-name{
      font-size:10.5px;font-weight:600;color:var(--bro-text);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;
    }

    @keyframes broIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .bro-list-item,.bro-writers-row{animation:broIn .2s ease both}
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
    if (document.getElementById('sli-styles')) return;
    const el = document.createElement('style');
    el.id = 'sli-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function configure(opts) {
    opts = opts || {};
    if (typeof opts.storyHref === 'function') _hrefs.storyHref = opts.storyHref;
    if (typeof opts.profileHref === 'function') _hrefs.profileHref = opts.profileHref;
  }

  function _authorLink(s) {
    return (
      '<a class="bro-list-stat bro-list-author" href="' +
      _esc(_hrefs.profileHref(s.author)) +
      '" onclick="event.stopPropagation()">' +
      _esc(s.author || '') +
      '</a>'
    );
  }

  /** Normal story list row (genre shown above title). */
  function story(s) {
    _injectStyles();
    s = s || {};
    const href = _hrefs.storyHref(s);
    return (
      '<div class="bro-list-item">' +
        '<a class="bro-list-cover-link" href="' + _esc(href) + '">' +
          '<div class="bro-list-cover"><img src="' + _esc(s.img) +
            '" loading="lazy" alt=""/></div>' +
        '</a>' +
        '<div class="bro-list-body">' +
          (s.genre ? '<div class="bro-list-genre">' + _esc(s.genre) + '</div>' : '') +
          '<a class="bro-list-title-link" href="' + _esc(href) + '">' +
            '<div class="bro-list-title">' + _esc(s.title) + '</div>' +
          '</a>' +
          (s.preview ? '<div class="bro-list-preview">' + _esc(s.preview) + '</div>' : '') +
          '<div class="bro-list-foot">' + _authorLink(s) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /** DroBoard house ad — gold fill + CTA. */
  function platformAd(ad) {
    _injectStyles();
    ad = ad || {};
    return (
      '<div class="bro-list-item bro-ad" data-ad="platform">' +
        '<div class="bro-list-cover">' +
          '<span class="bro-ad-tag">Ad</span>' +
          '<img src="' + _esc(ad.img) + '" loading="lazy" alt=""/>' +
        '</div>' +
        '<div class="bro-list-body">' +
          '<div class="bro-list-genre">' + _esc(ad.sponsor || 'DroBoard') + '</div>' +
          '<div class="bro-list-title">' + _esc(ad.title) + '</div>' +
          '<div class="bro-ad-cta">' + _esc(ad.cta || 'Learn More') + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /** Writer-promoted book — looks like a story + gold border + "Promoted" tag. */
  function bookAd(ad) {
    _injectStyles();
    ad = ad || {};
    const href = _hrefs.storyHref(ad);
    return (
      '<div class="bro-list-item bro-book-ad" data-ad="book">' +
        '<a class="bro-list-cover-link" href="' + _esc(href) + '">' +
          '<div class="bro-list-cover">' +
            '<span class="bro-ad-tag">Promoted</span>' +
            '<img src="' + _esc(ad.img) + '" loading="lazy" alt=""/>' +
          '</div>' +
        '</a>' +
        '<div class="bro-list-body">' +
          (ad.genre ? '<div class="bro-list-genre">' + _esc(ad.genre) + '</div>' : '') +
          '<a class="bro-list-title-link" href="' + _esc(href) + '">' +
            '<div class="bro-list-title">' + _esc(ad.title) + '</div>' +
          '</a>' +
          (ad.preview ? '<div class="bro-list-preview">' + _esc(ad.preview) + '</div>' : '') +
          '<div class="bro-list-foot">' +
            _authorLink(ad) +
            (ad.rating
              ? '<div class="bro-list-stat"><i class="fas fa-star" style="color:#f59e0b"></i> ' +
                _esc(ad.rating) + '</div>'
              : '') +
            (ad.chapters
              ? '<div class="bro-list-stat"><i class="fas fa-book-open"></i> ' +
                ad.chapters + ' ch</div>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /**
   * Top Writers avatar row.
   * @param {Array<{name,handle,avatar}>} writers
   */
  function writersRow(writers) {
    _injectStyles();
    writers = writers || [];
    if (!writers.length) return '';
    return (
      '<div class="bro-writers-row">' +
        '<div class="bro-writers-head">Top Writers</div>' +
        '<div class="bro-writers-scroll">' +
          writers.map(function (w) {
            return (
              '<a class="bro-writer" href="profile.html?u=' + _esc(w.handle) + '">' +
                '<img class="bro-writer-avatar" src="' + _esc(w.avatar) +
                  '" loading="lazy" alt=""/>' +
                '<div class="bro-writer-name">' + _esc(w.name) + '</div>' +
              '</a>'
            );
          }).join('') +
        '</div>' +
      '</div>'
    );
  }

  /**
   * Dispatch helper for feed entries produced by interleaveExtras().
   * entry = { kind: 'story'|'platformAd'|'bookAd'|'writers', data?: object|array }
   */
  function render(entry) {
    if (!entry) return '';
    if (entry.kind === 'writers') return writersRow(entry.data);
    if (entry.kind === 'platformAd') return platformAd(entry.data);
    if (entry.kind === 'bookAd') return bookAd(entry.data);
    return story(entry.data || entry);
  }

  window.StoryListItem = {
    story: story,
    platformAd: platformAd,
    bookAd: bookAd,
    writersRow: writersRow,
    render: render,
    configure: configure,
  };
})();