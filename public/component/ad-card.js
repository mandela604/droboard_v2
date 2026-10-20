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
    .dac-like i{font-size:14px;transition:transform .2s}
    .dac-like.dac-liked i{animation:dacHeartPop .28s ease}
    @keyframes dacHeartPop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}
    .dac-comment{display:none;align-items:center;gap:5px;font-size:11px;color:#888;font-weight:600;text-decoration:none;cursor:pointer}

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

    /* ── Mini banner (compact horizontal image ad, ~74px — leaderboard) ── */
    .dac-minibanner{position:relative;height:74px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#221027,#3b0f22);background-size:cover;background-position:center;margin:8px 0}
    .dac-minibanner-scrim{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,4,12,.88) 0%,rgba(8,4,12,.55) 55%,rgba(8,4,12,.12) 100%)}
    .dac-minibanner-tag{position:absolute;top:7px;right:9px;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.22);color:#fff;padding:2px 7px;border-radius:6px;z-index:2}
    .dac-minibanner-body{position:relative;z-index:2;display:flex;align-items:center;gap:10px;height:100%;padding:0 12px}
    .dac-minibanner-text{flex:1;min-width:0;color:#fff}
    .dac-minibanner-brand{font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.8;margin-bottom:2px}
    .dac-minibanner-headline{font-size:13px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dac-minibanner-sub{font-size:9.5px;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
    .dac-minibanner-cta{flex-shrink:0}
    .dac-fs{position:relative;height:100%;min-height:420px;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#1a0a12,#3b0f22);background-size:cover;background-position:center;display:flex;flex-direction:column;justify-content:flex-end}
    .dac-fs-scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.35) 55%,rgba(0,0,0,.12) 100%)}
    .dac-fs-top{position:absolute;top:12px;left:12px;right:12px;display:flex;gap:6px;z-index:2}
    .dac-fs-tag{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:#ff0050;color:#fff;padding:4px 10px;border-radius:8px}
    .dac-fs-genre{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.18);color:#fff;padding:4px 10px;border-radius:8px}
    .dac-fs-body{position:relative;z-index:2;padding:18px 16px 20px;color:#fff;font-family:inherit}
    .dac-fs-brand{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#ff9db8;margin-bottom:6px}
    .dac-fs-title{font-size:22px;font-weight:800;line-height:1.2;margin-bottom:6px}
    .dac-fs-by{font-size:12px;color:rgba(255,255,255,.8);margin-bottom:8px}
    .dac-fs-sub{font-size:13px;line-height:1.5;color:rgba(255,255,255,.85);margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .dac-fs-cta{background:#fff;color:#D6165A;font-size:12px;font-weight:800;padding:11px 22px;border-radius:24px;border:none;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(0,0,0,.3)}
    .dac-fs-cta:active{transform:scale(.96)}

    /* ── Follow promo ── */
    .dac-follow{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:12px;margin:8px 0}
    .dac-follow-avatar{width:48px;height:48px;border-radius:50%;object-fit:cover}
    .dac-follow-info{flex:1;min-width:0}
    .dac-follow-name{font-size:13px;font-weight:700;color:#1a1a1a}
    .dac-follow-tag{font-size:10px;color:#888}
    .dac-follow-btn{background:#ff2d55;color:#fff;font-size:10px;font-weight:800;padding:6px 14px;border-radius:16px;border:none;cursor:pointer}
    .dac-follow-btn:active{transform:scale(.95)}
    .dac-follow.dac-rich{display:block;padding:0;overflow:hidden}
    .dac-follow-cover{height:110px;background-size:cover;background-position:center;background-color:#1a0a14}
    .dac-follow-cover img{width:100%;height:100%;object-fit:cover}
    .dac-follow-main{display:flex;align-items:center;gap:12px;padding:12px}
    .dac-follow-headline{font-size:12.5px;font-weight:800;color:#1a1a1a;margin-top:3px}
    .dac-follow-body{font-size:11px;color:#666;margin-top:2px;line-height:1.45}

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
    // Rich variant when the ad carries native-level creative (cover /
    // headline / body). Plain follow ads render exactly as before.
    if (ad.cover || ad.headline || ad.body) {
      return `<div class="dac-follow dac-rich">
      ${ad.cover ? `<div class="dac-follow-cover"><img src="${esc(ad.cover)}" loading="lazy" alt=""/></div>` : ''}
      <div class="dac-follow-main">
        <img class="dac-follow-avatar" src="${esc(ad.avatar)}" loading="lazy" alt=""/>
        <div class="dac-follow-info">
          <div class="dac-follow-name">${esc(ad.name || ad.userName)}</div>
          ${ad.handle ? `<div class="dac-follow-tag">${esc(ad.handle)}</div>` : ''}
          ${ad.headline ? `<div class="dac-follow-headline">${esc(ad.headline)}</div>` : ''}
          ${ad.body ? `<div class="dac-follow-body">${esc(ad.body)}</div>` : ''}
          ${ad.tagline && !ad.headline ? `<div class="dac-follow-tag">${esc(ad.tagline)}</div>` : ''}
        </div>
        <button class="dac-follow-btn">${esc(ad.cta || 'Follow')}</button>
      </div>
    </div>`;
    }
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

  /* Compact horizontal image banner (~74px leaderboard) — the small strip
     between content sections (NovelHub/AliExpress style). Creative fields:
     img (wide image), brand, headline, sub, cta. CTA reuses dac-banner-cta
     so existing click handlers keep working. */
  function renderMiniBanner(ad) {
    injectStyles();
    ad = ad || {};
    const img = ad.img || ad.image || '';
    return `<div class="dac-minibanner"${img ? ` style="background-image:url('${esc(img)}')"` : ''}>
      <div class="dac-minibanner-scrim"></div>
      <span class="dac-minibanner-tag">Ad</span>
      <div class="dac-minibanner-body">
        <div class="dac-minibanner-text">
          ${ad.brand ? `<div class="dac-minibanner-brand">${esc(ad.brand)}</div>` : ''}
          <div class="dac-minibanner-headline">${esc(ad.headline || ad.title || '')}</div>
          ${ad.sub ? `<div class="dac-minibanner-sub">${esc(ad.sub)}</div>` : ''}
        </div>
        <button class="dac-banner-cta dac-minibanner-cta">${esc(ad.cta || 'Learn More')}</button>
      </div>
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

  /* Full-bleed creatives (status viewer, index hero slides): cover +
     scrim + badges — same visual language as index fullscreen ads. */
  function renderFullscreenStory(ad) {
    injectStyles();
    ad = ad || {};
    const cover = ad.cover || ad.img || ad.image || '';
    const byName = String(ad.author || ad.authorName || '').replace(/^@/, '');
    return `<div class="dac-fs"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>` +
      `<div class="dac-fs-scrim"></div>` +
      `<div class="dac-fs-top"><span class="dac-fs-tag">Ad</span>${ad.genre || ad.cat ? `<span class="dac-fs-genre">${esc(ad.genre || ad.cat)}</span>` : ''}</div>` +
      `<div class="dac-fs-body">` +
        `<div class="dac-fs-title">${esc(ad.title || '')}</div>` +
        (byName ? `<div class="dac-fs-by">By ${esc(byName)}</div>` : '') +
        ((ad.desc || ad.body || ad.text || ad.preview) ? `<div class="dac-fs-sub">${esc(ad.desc || ad.body || ad.text || ad.preview)}</div>` : '') +
        `<button class="dac-fs-cta" data-fs-story="${esc(ad.storyId || ad.title || '')}">${esc(ad.cta || 'Read Now')}</button>` +
      `</div></div>`;
  }
  function renderFullscreenBrand(ad) {
    injectStyles();
    ad = ad || {};
    const img = ad.image || ad.cover || '';
    const brand = ad.brand || ad.sponsor || '';
    return `<div class="dac-fs"${img ? ` style="background-image:url('${esc(img)}')"` : ''}>` +
      `<div class="dac-fs-scrim"></div>` +
      `<div class="dac-fs-top"><span class="dac-fs-tag">Sponsored</span></div>` +
      `<div class="dac-fs-body">` +
        (brand ? `<div class="dac-fs-brand">${esc(brand)}</div>` : '') +
        `<div class="dac-fs-title">${esc(ad.headline || ad.heading || ad.title || brand)}</div>` +
        ((ad.body || ad.text) ? `<div class="dac-fs-sub">${esc(ad.body || ad.text)}</div>` : '') +
        `<button class="dac-fs-cta" data-fs-url="${esc(ad.url || '')}">${esc(ad.cta || 'Learn More')}</button>` +
      `</div></div>`;
  }

  /* Third-party network embeds: raw script/HTML pasted in ad-manager.
     Code runs with full page privileges — only paste from networks you
     trust. Scripts execute on hydration (see below).
     Tags that call document.write() (Monetag / Adsterra legacy zones) are
     isolated in an iframe, where document.write still works instead of
     wiping the host page. Everything else runs inline so top-level APIs
     (notification prompts, popunders) keep working. */
  const _embedCode = {};
  function renderEmbed(ad) {
    injectStyles();
    if (!ad || !ad.code) return '';
    const id = String(ad.id || ('em' + Math.random().toString(36).slice(2)));
    const code = String(ad.code);
    _embedCode[id] = code;
    const iframeMode = /document\s*\.\s*write\s*\(/.test(code);
    return `<div class="dac-embed" data-embedid="${esc(id)}" data-adid="${esc(ad.id || '')}"${iframeMode ? ' data-embedmode="iframe"' : ''}></div>`;
  }
  function _livenScripts(box) {
    let dead = [];
    try { dead = Array.from(box.querySelectorAll('script')); } catch (e) { return; }
    dead.forEach(function (d) {
      try {
        const s = document.createElement('script');
        Array.from(d.attributes || []).forEach(function (a) { try { s.setAttribute(a.name, a.value); } catch (e2) {} });
        s.text = d.text || '';
        d.replaceWith(s);
      } catch (e3) {}
    });
  }
  /* srcdoc iframes share our origin, so we can read their height and stretch
     the frame to fit whatever the network tag grew to. Poll for ~10s — most
     tags settle well inside that. */
  function _fitEmbedFrame(box, f) {
    let tries = 0;
    const fit = function () {
      try {
        const doc = f.contentDocument;
        const h = doc && doc.documentElement
          ? Math.max(doc.documentElement.scrollHeight, (doc.body && doc.body.scrollHeight) || 0)
          : 0;
        if (h > 0) f.style.height = Math.min(h + 4, 2000) + 'px';
      } catch (e) {}
      if (tries++ < 40) setTimeout(fit, 250);
    };
    setTimeout(fit, 250);
    try { f.addEventListener('load', fit); } catch (e) {}
  }
  function hydrateEmbeds(scopeEl) {
    let nodes = [];
    try {
      const root = scopeEl || document;
      if (root.querySelectorAll) nodes = Array.from(root.querySelectorAll('[data-embedid]:not([data-embeddone])'));
      if (root.dataset && root.dataset.embedid && !root.dataset.embeddone) nodes.unshift(root);
    } catch (e) { return; }
    nodes.forEach(function (box) {
      const code = _embedCode[box.getAttribute('data-embedid')];
      if (!code) return;
      try {
        box.setAttribute('data-embeddone', '1');
        if (box.getAttribute('data-embedmode') === 'iframe') {
          const f = document.createElement('iframe');
          f.setAttribute('scrolling', 'no');
          f.setAttribute('title', 'Advertisement');
          f.style.width = '100%';
          f.style.border = '0';
          f.style.display = 'block';
          box.appendChild(f);
          f.srcdoc = code;
          _fitEmbedFrame(box, f);
        } else {
          box.innerHTML = code;
          _livenScripts(box);
        }
      } catch (e) {}
    });
  }
  // Auto-hydrate embeds the moment ad markup lands in the DOM, so comment
  // slots, page slots and feed cards all render network code with no
  // caller changes. Runs once per embed (data-embeddone guard).
  if (typeof MutationObserver !== 'undefined' && !window.__dacEmbedObs) {
    window.__dacEmbedObs = true;
    try {
      const mo = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          (m.addedNodes || []).forEach(function (n) {
            if (!n || n.nodeType !== 1) return;
            if (n.dataset && n.dataset.embedid) hydrateEmbeds(n.parentNode || document);
            else if (n.querySelectorAll && n.querySelector('[data-embedid]:not([data-embeddone])')) hydrateEmbeds(n);
          });
        });
      });
      if (document.documentElement) mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  /* ── Native-ad like state (plain heart toggle — no reaction picker).
     Persisted per ad id in localStorage; count = seed likes + liked. ── */
  function _likeStore() { try { return JSON.parse(localStorage.getItem('dro_ad_likes') || '{}'); } catch (e) { return {}; } }
  function _saveLikeStore(s) { try { localStorage.setItem('dro_ad_likes', JSON.stringify(s)); } catch (e) {} }
  function _num(v) { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function toggleLike(btn) {
    if (!btn) return;
    const card = btn.closest('.dac-native');
    if (!card) return;
    const id = card.getAttribute('data-adid') || '';
    const base = _num(card.getAttribute('data-base-likes'));
    const st = _likeStore();
    const liked = st[id] !== 1;
    st[id] = liked ? 1 : 0;
    _saveLikeStore(st);
    btn.classList.toggle('dac-liked', liked);
    const ic = btn.querySelector('i');
    if (ic) ic.className = (liked ? 'fas' : 'far') + ' fa-heart';
    const ct = btn.querySelector('.dac-like-ct');
    if (ct) ct.textContent = String(base + (liked ? 1 : 0));
    if (window.AdService && id) { try { AdService.track(id, liked ? 'like' : 'unlike'); } catch (e) {} }
  }

  function renderNative(ad) {
    injectStyles();
    const id = esc(ad.id || '');
    const baseLikes = _num(ad.likes);
    const cmt = _num(ad.comments);
    let liked = false;
    try { liked = _likeStore()[ad.id || ''] === 1; } catch (e) {}
    const shownLikes = baseLikes + (liked ? 1 : 0);
    return `<div class="dac-native${ad.isBook ? ' dac-book' : ''}" data-adid="${id}" data-base-likes="${baseLikes}">
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
        <button class="dac-like${liked ? ' dac-liked' : ''}" data-adid="${id}" onclick="window.DroboardAdCard&&DroboardAdCard.toggleLike(this)"><i class="${liked ? 'fas' : 'far'} fa-heart"></i> <span class="dac-like-ct">${shownLikes}</span></button>
        <a class="dac-comment" href="discussion.html" onclick="event.stopPropagation()"><i class="far fa-comment"></i> ${cmt}</a>
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
    if (fmt === 'minibanner') return renderMiniBanner(post.ad);
    if (fmt === 'fullscreen') return renderFullscreen(post.ad);
    if (fmt === 'native') return renderNative(post.ad);
    if (fmt === 'embed') return renderEmbed(post.ad);
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
    renderFollowPromo, renderBanner, renderMiniBanner, renderFullscreen, renderFullscreenStory, renderFullscreenBrand, renderNative,
    renderEmbed, hydrateEmbeds,
    renderSponsored, attach, update, toggleLike,
  };
})();
