/* ═══════════════════════════════════════════════════════════════
   AD CARD COMPONENT
   Reusable ad renderers for any page. Self-contained CSS injection.
   Only BOOK ads (writer-promoted stories) get the golden background.
   Platform ads use neutral styling.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__adCard) return;
  window.__adCard = true;

  const CSS = `
    /* ── Base ad styles (no gold) ── */
    .ad-item{border:1px solid #e5e5ea;border-radius:12px;background:#fff;padding:12px;margin:6px 0;display:flex;gap:12px;position:relative}
    .ad-cover{width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;background:#f5f5f5;box-shadow:0 2px 8px rgba(0,0,0,.08);position:relative}
    .ad-cover img{width:100%;height:100%}
    .ad-tag{position:absolute;top:6px;left:6px;z-index:2;font-size:7px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:#999;color:#fff}
    .ad-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
    .ad-sponsor{font-size:9px;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:.05em}
    .ad-title{font-size:13.5px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .ad-preview{font-size:11.5px;color:#8e8e93;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .ad-foot{display:flex;align-items:center;gap:10px;margin-top:2px;flex-wrap:wrap}
    .ad-stat{display:flex;align-items:center;gap:3px;font-size:10px;color:#8e8e93;font-weight:600}
    .ad-author{color:#ff2d55;font-weight:800;cursor:pointer}
    .ad-cta{align-self:flex-start;margin-top:4px;font-size:10.5px;font-weight:800;color:#fff;background:#ff2d55;padding:5px 12px;border-radius:14px;cursor:pointer;transition:all .15s}
    .ad-cta:active{transform:scale(.95)}

    /* ── Compact variant (for horizontal rows) ── */
    .ad-item.ad-compact{flex-direction:column;padding:0;overflow:hidden}
    .ad-item.ad-compact .ad-cover{width:100%;height:120px;border-radius:9px 9px 0 0;border:none;border-bottom:1px solid #e5e5ea}
    .ad-item.ad-compact .ad-body{padding:10px 12px}

    /* ══ BOOK AD ONLY — golden background ══ */
    .ad-item.ad-book{border:1.5px solid #c9a227;background:#fdf7e6;border-bottom:1.5px solid #c9a227}
    .ad-item.ad-book .ad-cover{border:1.5px solid #c9a227}
    .ad-item.ad-book .ad-tag{background:#c9a227}
    .ad-item.ad-book .ad-sponsor{color:#c9a227}
    .ad-item.ad-book .ad-author{color:#c9a227}
    .ad-item.ad-book .ad-cta{background:#c9a227}
    .ad-item.ad-book.ad-compact .ad-cover{border-bottom:1.5px solid #c9a227}

    /* ── Native ad (feed-style) ── */
    .dac-native{background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:12px;margin:8px 0}
    .dac-native-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
    .dac-native-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover}
    .dac-native-brand{font-size:12px;font-weight:700;color:#1a1a1a}
    .dac-native-label{font-size:9px;font-weight:800;color:#999;background:#f0f0f0;padding:2px 6px;border-radius:4px;margin-left:auto}
    .dac-native-img{width:100%;height:180px;border-radius:8px;object-fit:cover;margin-bottom:10px}
    .dac-native-heading{font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px;line-height:1.3}
    .dac-native-body{font-size:12px;color:#666;line-height:1.5;margin-bottom:10px}
    .dac-native-cta{display:inline-block;background:#ff2d55;color:#fff;font-size:11px;font-weight:800;padding:8px 16px;border-radius:20px;cursor:pointer;border:none}
    .dac-native-cta:active{transform:scale(.95)}
    .dac-native-foot{display:flex;align-items:center;gap:14px;margin-top:10px;padding-top:10px;border-top:1px solid #e5e5ea}
    .dac-like{display:flex;align-items:center;gap:5px;font-size:11px;color:#888;cursor:pointer;background:none;border:none;font-weight:600}
    .dac-like.dac-liked{color:#ff2d55}
    .dac-like i{font-size:14px}

    /* ── Native BOOK ad — golden background ══ */
    .dac-native.dac-book{border:1.5px solid #c9a227;background:#fdf7e6}
    .dac-native.dac-book .dac-native-avatar{border:2px solid #c9a227}
    .dac-native.dac-book .dac-native-label{background:rgba(201,162,39,.15);color:#c9a227}
    .dac-native.dac-book .dac-native-cta{background:#c9a227}
    .dac-native.dac-book .dac-native-foot{border-top-color:rgba(201,162,39,.2)}

    /* ── Banner ad ── */
    .dac-banner{background:linear-gradient(135deg,#ff2d55,#d6165a);border-radius:12px;padding:16px;color:#fff;margin:8px 0}
    .dac-banner-brand{font-size:10px;font-weight:800;opacity:.8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
    .dac-banner-headline{font-size:16px;font-weight:800;margin-bottom:4px;line-height:1.2}
    .dac-banner-sub{font-size:11px;opacity:.8;margin-bottom:12px}
    .dac-banner-cta{background:#fff;color:#d6165a;font-size:11px;font-weight:800;padding:8px 18px;border-radius:20px;border:none;cursor:pointer}
    .dac-banner-cta:active{transform:scale(.95)}

    /* ── Follow promo ── */
    .dac-follow{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:12px;margin:8px 0}
    .dac-follow-avatar{width:48px;height:48px;border-radius:50%;object-fit:cover}
    .dac-follow-info{flex:1;min-width:0}
    .dac-follow-name{font-size:13px;font-weight:700;color:#1a1a1a}
    .dac-follow-tag{font-size:10px;color:#888}
    .dac-follow-btn{background:#ff2d55;color:#fff;font-size:10px;font-weight:800;padding:6px 14px;border-radius:16px;border:none;cursor:pointer}
    .dac-follow-btn:active{transform:scale(.95)}

    /* ── Story promo ── */
    .dac-story-promo{display:flex;gap:12px;background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:12px;margin:8px 0}
    .dac-story-promo-cover{width:80px;height:110px;border-radius:8px;overflow:hidden;flex-shrink:0}
    .dac-story-promo-cover img{width:100%;height:100%}
    .dac-story-promo-body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px}
    .dac-story-promo-cat{font-size:9px;font-weight:800;color:#ff2d55;text-transform:uppercase}
    .dac-story-promo-title{font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3}
    .dac-story-promo-author{font-size:10px;color:#888}
    .dac-story-promo-stats{display:flex;gap:8px;font-size:10px;color:#888}
    .dac-story-promo-cta{align-self:flex-start;background:#ff2d55;color:#fff;font-size:10px;font-weight:800;padding:6px 14px;border-radius:16px;border:none;cursor:pointer;margin-top:6px}
    .dac-story-promo-cta:active{transform:scale(.95)}

    /* ── Story BOOK promo — golden background ══ */
    .dac-story-promo.dac-book{border:1.5px solid #c9a227;background:#fdf7e6}
    .dac-story-promo.dac-book .dac-story-promo-cover{border:1.5px solid #c9a227}
    .dac-story-promo.dac-book .dac-story-promo-cat{color:#c9a227}
    .dac-story-promo.dac-book .dac-story-promo-cta{background:#c9a227}
  `;

  function injectStyles() {
    if (document.getElementById('ad-card-style')) return;
    const s = document.createElement('style');
    s.id = 'ad-card-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function storyHref(s) {
    const id = s.id || (s.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `bridge.html?id=${encodeURIComponent(id)}`;
  }

  function profileHref(author) {
    const handle = (author || '').replace('@', '');
    return `profile.html?u=${encodeURIComponent(handle)}`;
  }

  /* ═══════════════════════════════════════════════════════════
     NEW API
  ═══════════════════════════════════════════════════════════ */

  function platformAd(ad, opts) {
    injectStyles();
    const compact = opts && opts.compact;
    return `<div class="ad-item${compact ? ' ad-compact' : ''}" data-ad="platform">
      <div class="ad-cover"><span class="ad-tag">Ad</span><img src="${esc(ad.img)}" loading="lazy" alt=""/></div>
      <div class="ad-body">
        <div class="ad-sponsor">${esc(ad.sponsor || 'DroBoard')}</div>
        <div class="ad-title">${esc(ad.title)}</div>
        <div class="ad-cta">${esc(ad.cta || 'Learn More')}</div>
      </div>
    </div>`;
  }

  function bookAd(ad, opts) {
    injectStyles();
    const compact = opts && opts.compact;
    const href = storyHref(ad);
    return `<div class="ad-item ad-book${compact ? ' ad-compact' : ''}" data-ad="book" data-href="${href}" style="cursor:pointer" onclick="if(!event.target.closest('a'))window.location.href=this.dataset.href">
      <a class="ad-cover" href="${href}" style="text-decoration:none;color:inherit"><span class="ad-tag">Promoted</span><img src="${esc(ad.img)}" loading="lazy" alt=""/></a>
      <div class="ad-body">
        <div class="ad-sponsor">${esc(ad.genre || '')}</div>
        <a class="ad-title" href="${href}" style="text-decoration:none;color:inherit">${esc(ad.title)}</a>
        ${ad.preview ? `<div class="ad-preview">${esc(ad.preview)}</div>` : ''}
        <div class="ad-foot">
          <a class="ad-stat ad-author" href="${profileHref(ad.author)}" onclick="event.stopPropagation()">${esc(ad.author || '')}</a>
          ${ad.rating ? `<div class="ad-stat"><i class="fas fa-star" style="color:#f59e0b"></i> ${esc(ad.rating)}</div>` : ''}
          ${ad.chapters ? `<div class="ad-stat"><i class="fas fa-book-open"></i> ${ad.chapters} ch</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  function render(ad, opts) {
    if (!ad) return '';
    if (ad.type === 'platform' || ad.sponsor) return platformAd(ad, opts);
    return bookAd(ad, opts);
  }

  function renderAll(ads, opts) {
    if (!ads || !ads.length) return '';
    return ads.map(ad => render(ad, opts)).join('');
  }

  /* ═══════════════════════════════════════════════════════════
     LEGACY API — DroboardAdCard (feed.html)
  ═══════════════════════════════════════════════════════════ */

  function renderPlatform(ad) {
    injectStyles();
    return platformAd(ad);
  }

  function renderListPlatform(ad) {
    injectStyles();
    return `<div style="padding:8px 14px">${platformAd(ad)}</div>`;
  }

  function renderStoryPromo(ad) {
    injectStyles();
    const href = storyHref(ad);
    return `<div class="dac-story-promo${ad.isBook ? ' dac-book' : ''}" data-adid="${esc(ad.id || '')}" data-href="${href}" style="cursor:pointer" onclick="if(window.AdService)AdService.track(this.dataset.adid,'click');window.location.href=this.dataset.href">
      <div class="dac-story-promo-cover"><img src="${esc(ad.img || ad.cover)}" loading="lazy" alt=""/></div>
      <div class="dac-story-promo-body">
        <div class="dac-story-promo-cat">${esc(ad.cat || ad.genre || 'Story')}</div>
        <div class="dac-story-promo-title">${esc(ad.title)}</div>
        <div class="dac-story-promo-author">by ${esc(ad.author || ad.authorName || '')}</div>
        <div class="dac-story-promo-stats">
          ${ad.rating ? `<span><i class="fas fa-star" style="color:#f59e0b"></i> ${esc(ad.rating)}</span>` : ''}
          ${ad.chapters ? `<span><i class="fas fa-book-open"></i> ${ad.chapters} ch</span>` : ''}
          ${ad.views ? `<span><i class="fas fa-eye"></i> ${esc(ad.views)}</span>` : ''}
        </div>
        <button class="dac-story-promo-cta" onclick="window.location.href='${href}'">${esc(ad.cta || 'Read Now')}</button>
      </div>
    </div>`;
  }

  function renderListBook(ad) {
    injectStyles();
    const href = storyHref(ad);
    return `<div class="dac-story-promo dac-book" data-adid="${esc(ad.id || '')}" data-href="${href}" style="cursor:pointer" onclick="if(window.AdService)AdService.track(this.dataset.adid,'click');window.location.href=this.dataset.href">
      <div class="dac-story-promo-cover"><img src="${esc(ad.img || ad.cover)}" loading="lazy" alt=""/></div>
      <div class="dac-story-promo-body">
        <div class="dac-story-promo-cat">${esc(ad.cat || ad.genre || 'Story')}</div>
        <div class="dac-story-promo-title">${esc(ad.title)}</div>
        <div class="dac-story-promo-author">by ${esc(ad.author || ad.authorName || '')}</div>
        <div class="dac-story-promo-stats">
          ${ad.rating ? `<span><i class="fas fa-star" style="color:#f59e0b"></i> ${esc(ad.rating)}</span>` : ''}
          ${ad.chapters ? `<span><i class="fas fa-book-open"></i> ${ad.chapters} ch</span>` : ''}
          ${ad.views ? `<span><i class="fas fa-eye"></i> ${esc(ad.views)}</span>` : ''}
        </div>
        <button class="dac-story-promo-cta" onclick="window.location.href='${href}'">${esc(ad.cta || 'Read Now')}</button>
      </div>
    </div>`;
  }

  function renderFollowPromo(ad) {
    injectStyles();
    return `<div class="dac-follow">
      <img class="dac-follow-avatar" src="${esc(ad.avatar)}" loading="lazy" alt=""/>
      <div class="dac-follow-info">
        <div class="dac-follow-name">${esc(ad.name || ad.userName)}</div>
        <div class="dac-follow-tag">${esc(ad.tagline || '')}</div>
      </div>
      <button class="dac-follow-btn">${esc(ad.cta || 'Follow')}</button>
    </div>`;
  }

  function renderBanner(ad) {
    injectStyles();
    return `<div class="dac-banner">
      <div class="dac-banner-brand">${esc(ad.brand || 'DroBoard')}</div>
      <div class="dac-banner-headline">${esc(ad.headline || ad.title)}</div>
      <div class="dac-banner-sub">${esc(ad.sub || '')}</div>
      <button class="dac-banner-cta">${esc(ad.cta || 'Learn More')}</button>
    </div>`;
  }

  function renderFullscreen(ad) {
    injectStyles();
    return `<div class="dac-banner" style="text-align:center;padding:24px">
      <div class="dac-banner-brand">${esc(ad.brand || 'DroBoard')}</div>
      <div class="dac-banner-headline" style="font-size:20px">${esc(ad.headline || ad.title)}</div>
      <div class="dac-banner-sub">${esc(ad.sub || '')}</div>
      <button class="dac-banner-cta" style="margin-top:12px">${esc(ad.cta || 'Get Started')}</button>
    </div>`;
  }

  function renderNative(ad) {
    injectStyles();
    return `<div class="dac-native${ad.isBook ? ' dac-book' : ''}" data-adid="${esc(ad.id || '')}">
      <div class="dac-native-head">
        <img class="dac-native-avatar" src="${esc(ad.avatar || 'https://i.pravatar.cc/100?img=12')}" loading="lazy" alt=""/>
        <div class="dac-native-brand">${esc(ad.brand || 'Sponsored')}</div>
        <div class="dac-native-label">Sponsored</div>
      </div>
      ${ad.image ? `<img class="dac-native-img" src="${esc(ad.image)}" loading="lazy" alt=""/>` : ''}
      <div class="dac-native-heading">${esc(ad.heading || ad.title || '')}</div>
      <div class="dac-native-body">${esc(ad.body || ad.desc || '')}</div>
      <button class="dac-native-cta">${esc(ad.cta || 'Learn More')}</button>
      <div class="dac-native-foot">
        <button class="dac-like"><i class="far fa-heart"></i> <span class="dac-like-ct">${ad.likes || 0}</span></button>
        <span style="font-size:11px;color:#888"><i class="far fa-comment"></i> ${ad.comments || 0}</span>
      </div>
    </div>`;
  }

  function renderSponsored(post) {
    if (!post || !post.ad) return '';
    const fmt = post.adFormat || '';
    if (fmt === 'listBook' || fmt === 'book') return renderListBook(post.ad);
    if (fmt === 'listPlatform') return renderListPlatform(post.ad);
    if (fmt === 'storyPromo') return renderStoryPromo(post.ad);
    if (fmt === 'platform') return renderPlatform(post.ad);
    if (fmt === 'follow') return renderFollowPromo(post.ad);
    if (fmt === 'banner') return renderBanner(post.ad);
    if (fmt === 'fullscreen') return renderFullscreen(post.ad);
    if (fmt === 'native') return renderNative(post.ad);
    return renderNative(post.ad);
  }

  /* ═══════════════════════════════════════════════════════════
     ATTACH
  ═══════════════════════════════════════════════════════════ */

  let _handlers = {};

  function attach(el, handlers) {
    if (!el) return;
    _handlers = handlers || {};
    el.addEventListener('click', (e) => {
      const likeBtn = e.target.closest('.dac-like');
      if (likeBtn) {
        const card = likeBtn.closest('.dac-native');
        if (card && card.dataset.adid && _handlers.onLike) {
          _handlers.onLike({ id: card.dataset.adid });
        }
        return;
      }
      const ctaBtn = e.target.closest('.dac-native-cta, .ad-cta, .dac-banner-cta, .dac-follow-btn, .dac-story-promo-cta');
      if (ctaBtn && _handlers.onCta) {
        _handlers.onCta({});
      }
    });
  }

  function update(ad) {
    if (!ad || !ad.id) return;
    const card = document.querySelector(`.dac-native[data-adid="${ad.id}"]`);
    if (!card) return;
    const likeBtn = card.querySelector('.dac-like');
    if (likeBtn) {
      likeBtn.classList.toggle('dac-liked', !!ad.liked);
      likeBtn.querySelector('i').className = (ad.liked ? 'fas' : 'far') + ' fa-heart';
      const ct = likeBtn.querySelector('.dac-like-ct');
      if (ct) ct.textContent = ad.likes || 0;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     EXPORT
  ═══════════════════════════════════════════════════════════ */

  window.AdCard = { platformAd, bookAd, render, renderAll, esc, storyHref, profileHref };

  window.DroboardAdCard = {
    platformAd, bookAd, render, renderAll, esc, storyHref, profileHref,
    renderPlatform, renderListPlatform, renderStoryPromo, renderListBook,
    renderFollowPromo, renderBanner, renderFullscreen, renderNative,
    renderSponsored, attach, update,
  };
})();
