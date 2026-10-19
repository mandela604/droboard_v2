/* ============================================================
   DroboardMoreLikeThis — shared "More Like This" section.

   Renders the section header (icon + title) plus a horizontal
   row of story cards. Card markup comes from DiscoverCard.scard
   (the same universal card bridge + discover use) whenever that
   component is loaded; otherwise a self-contained fallback card
   is used so the section never renders empty.

   Usage:
     DroboardMoreLikeThis.mount('#simScroll', items, {
       title: 'More Like This',   // header text
       icon:  '✨',               // header icon
       heading: true,             // false = page renders its own header
       limit: 8,
       href:  (item) => 'book-reader.html?id=' + encodeURIComponent(item.id),
     });

   item: { id, img | cover, title, author, badge?, meta?, rating?, ch?, pct? }

   Header + row CSS is self-contained (mlt- prefixed) so it matches on
   every host page and never collides with page styles.
============================================================ */
(function () {
  'use strict';

  if (window.DroboardMoreLikeThis) return;

  const CSS = `
    .mlt-hdr{display:flex;align-items:center;gap:9px;margin-bottom:10px}
    .mlt-ico{width:26px;height:26px;border-radius:9px;background:rgba(124,58,237,.1);
      display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
    .mlt-title{font-family:var(--font-d,'Playfair Display',Georgia,serif);font-size:16px;
      font-weight:900;color:var(--tx,var(--tx-high,#17151b));line-height:1.2}
    .mlt-row{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}
    .mlt-row::-webkit-scrollbar{display:none}
    .mlt-row a{color:inherit;text-decoration:none}
    .mlt-row .dc-scard-link{display:block;cursor:pointer}
    .mlt-row .dc-scard-title{color:var(--tx-high,#17151b)}
    .mlt-row .dc-scard-author{color:#8e8e93;text-decoration:none}
    .mlt-card{flex:0 0 auto;width:110px;text-decoration:none;color:inherit;display:block}
    .mlt-card:active{opacity:.85}
    .mlt-cover{width:110px;height:148px;border-radius:10px;overflow:hidden;
      background:var(--l2,#f1f1f1);margin-bottom:6px}
    .mlt-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .mlt-card-title{font-size:11px;font-weight:700;line-height:1.3;color:var(--tx-high,#17151b);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mlt-card-author{font-size:10px;color:#8e8e93;margin-top:2px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  `;

  let _injected = false;
  function injectStyles() {
    if (_injected) return;
    _injected = true;
    const s = document.createElement('style');
    s.id = 'mlt-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function hrefFor(item, opts) {
    if (typeof opts.href === 'function') return opts.href(item);
    return 'bridge.html?id=' + encodeURIComponent(item.id != null ? item.id : (item.title || ''));
  }

  function cardHtml(item, opts) {
    const img = item.img || item.cover || '';
    if (window.DiscoverCard && typeof DiscoverCard.scard === 'function') {
      return DiscoverCard.scard({
        id: item.id, img: img, title: item.title, author: item.author,
        badge: item.badge, meta: item.meta, rating: item.rating,
        ch: item.ch, pct: item.pct,
      });
    }
    return `<a class="mlt-card" href="${esc(hrefFor(item, opts))}">
      <div class="mlt-cover"><img src="${esc(img)}" loading="lazy" alt=""/></div>
      <div class="mlt-card-title">${esc(item.title)}</div>
      ${item.author ? `<div class="mlt-card-author">${esc(item.author)}</div>` : ''}
    </a>`;
  }

  /* target: selector or element. items: story objects. opts: see header. */
  function mount(target, items, opts) {
    injectStyles();
    opts = opts || {};
    const el = typeof target === 'string' ? document.querySelector(target)
      : (target && target.nodeType === 1 ? target : null);
    if (!el) return;

    const list = (items || []).slice(0, opts.limit || 8);
    if (!list.length) { el.innerHTML = ''; return; }

    let html = '';
    if (opts.heading !== false) {
      html += `<div class="mlt-hdr">
        <div class="mlt-ico">${opts.icon || '✨'}</div>
        <div class="mlt-title">${esc(opts.title || 'More Like This')}</div>
      </div>`;
    }
    html += `<div class="mlt-row">${list.map(it => cardHtml(it, opts)).join('')}</div>`;
    el.innerHTML = html;

    // DiscoverCard always links to bridge.html — point cards at the
    // host page's target instead (author links stay profile links).
    if (typeof opts.href === 'function') {
      el.querySelectorAll('a.dc-scard-link').forEach((a, i) => {
        if (list[i]) a.setAttribute('href', hrefFor(list[i], opts));
      });
    }
  }

  window.DroboardMoreLikeThis = { mount: mount };
})();
