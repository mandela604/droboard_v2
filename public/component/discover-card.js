/* ═══════════════════════════════════════════════════════════════
   DISCOVER CARD COMPONENT
   Reusable card renderers for discover page (horizontal rows,
   list items, ads, writers row). Self-contained CSS injection.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__discoverCard) return;
  window.__discoverCard = true;

  const CSS = `
    .dc-scard{flex:0 0 calc((100% - 30px) / 4);width:calc((100% - 30px) / 4)}
    .dc-scard-link{display:block;cursor:pointer}
    .dc-scard:active{opacity:.85}
    .dc-scard-cover{
      position:relative;width:100%;aspect-ratio:110/148;
      border-radius:9px;overflow:hidden;background:#e8e8ed;margin-bottom:6px;
      box-shadow:0 2px 8px rgba(0,0,0,.08);
    }
    .dc-scard-cover img{width:100%;height:100%}
    .dc-badge{position:absolute;top:5px;left:5px;font-size:7px;font-weight:800;padding:2px 4px;border-radius:4px;letter-spacing:.2px;text-transform:uppercase;z-index:2}
    .dc-badge.new{background:#22c55e;color:#fff}
    .dc-badge.hot{background:#ef4444;color:#fff}
    .dc-badge.update{background:#ff2d55;color:#fff}
    .dc-rank{position:absolute;top:5px;left:5px;width:18px;height:18px;border-radius:5px;background:#ff2d55;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:2}
    .dc-scard-title{font-size:10.5px;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
    .dc-scard-author{font-size:9.5px;color:#8e8e93;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;display:inline-block;cursor:pointer}
    .dc-scard-meta{font-size:9.5px;color:#8e8e93;font-weight:500}
    .dc-scard-rating{font-size:9.5px;color:#f59e0b;font-weight:600}
    .dc-cont-ch{font-size:9.5px;color:#8e8e93;margin-bottom:4px}
    .dc-prog-track{height:3px;background:#e5e5ea;border-radius:2px;overflow:hidden}
    .dc-prog-fill{height:100%;background:#ff2d55;border-radius:2px}

    .dc-coll-card{flex:0 0 200px;width:200px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ebebed;box-shadow:0 1px 4px rgba(0,0,0,.04);cursor:pointer}
    .dc-coll-covers{display:grid;grid-template-columns:1fr 1fr;height:100px}
    .dc-coll-covers div{background-size:cover;background-position:center}
    .dc-coll-info{padding:10px 12px}
    .dc-coll-name{font-size:13px;font-weight:700;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dc-coll-meta{font-size:11px;color:#8e8e93}

    .dc-list-item{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid #ebebed;position:relative}
    .dc-list-cover{width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;background:#e8e8ed;box-shadow:0 2px 8px rgba(0,0,0,.08);position:relative}
    .dc-list-cover img{width:100%;height:100%}
    .dc-list-cover-link,.dc-list-title-link{display:block;cursor:pointer}
    .dc-list-cover-link:active .dc-list-cover,.dc-list-title-link:active .dc-list-title{opacity:.7}
    .dc-list-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
    .dc-list-genre{font-size:9px;font-weight:800;color:#ff2d55;text-transform:uppercase;letter-spacing:.05em}
    .dc-list-title{font-size:13.5px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dc-list-preview{font-size:11.5px;color:#8e8e93;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dc-list-foot{display:flex;align-items:center;gap:10px;margin-top:2px;flex-wrap:wrap}
    .dc-list-stat{display:flex;align-items:center;gap:3px;font-size:10px;color:#8e8e93;font-weight:600}
    .dc-list-author{color:#ff2d55;font-weight:800;cursor:pointer}

    .dc-list-item.dc-ad{border:1px solid #e5e5ea;border-radius:12px;background:#fff;padding:12px;margin:6px 0}
    .dc-ad-tag{position:absolute;top:6px;left:6px;z-index:2;font-size:7px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:#999;color:#fff}
    .dc-ad .dc-list-cover{border:1px solid #e5e5ea}
    .dc-ad-cta{align-self:flex-start;margin-top:4px;font-size:10.5px;font-weight:800;color:#fff;background:#ff2d55;padding:5px 12px;border-radius:14px}

    .dc-list-item.dc-book-ad{border:1.5px solid #c9a227;border-radius:12px;background:#fdf7e6;padding:10px;margin:4px 0;border-bottom:1.5px solid #c9a227}

    .dc-writers-row{padding:14px 0 8px;border-bottom:1px solid #ebebed;margin-bottom:4px}
    .dc-writers-head{font-size:12.5px;font-weight:800;margin-bottom:10px}
    .dc-writers-scroll{display:flex;gap:16px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
    .dc-writers-scroll::-webkit-scrollbar{display:none}
    .dc-writer{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;width:64px;text-align:center}
    .dc-writer-avatar{width:52px;height:52px;border-radius:50%;object-fit:cover}
    .dc-writer-name{font-size:10.5px;font-weight:600;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}

    @keyframes dcIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .dc-list-item,.dc-writers-row{animation:dcIn .2s ease both}
    [data-theme="dark"] .dc-coll-card{background:#0b0b10;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .dc-list-item{border-bottom-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .dc-list-item.dc-ad{background:#0b0b10;border-color:rgba(255,255,255,.1)}
    [data-theme="dark"] .dc-writers-row{border-bottom-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .dc-writer-name{color:#f0f0f5}
    [data-theme="dark"] .dc-scard-cover,[data-theme="dark"] .dc-list-cover{background:#1a1a24}
  `;

  function injectStyles() {
    if (document.getElementById('dc-style')) return;
    const s = document.createElement('style');
    s.id = 'dc-style';
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

  function scard(s) {
    injectStyles();
    let badge = '';
    if (s.badge === 'new') badge = '<span class="dc-badge new">NEW</span>';
    else if (s.badge === 'hot') badge = '<span class="dc-badge hot">HOT</span>';
    else if (s.badge === 'update') badge = '<span class="dc-badge update">Update</span>';
    else if (s.rank) badge = `<span class="dc-rank">${s.rank}</span>`;
    let extra = '';
    if (s.rating) extra = `<div class="dc-scard-rating">\u2605 ${esc(s.rating)}</div>`;
    else if (s.ch) extra = `<div class="dc-cont-ch">${esc(s.ch)}</div>${s.pct != null ? `<div class="dc-prog-track"><div class="dc-prog-fill" style="width:${s.pct}%"></div></div>` : ''}`;
    else if (s.meta) extra = `<div class="dc-scard-meta">${esc(s.meta)}</div>`;
    const author = s.author
      ? `<a class="dc-scard-author" href="${profileHref(s.author)}" onclick="event.stopPropagation()">${esc(s.author)}</a>`
      : '';
    return `<div class="dc-scard">
      <a class="dc-scard-link" href="${storyHref(s)}">
        <div class="dc-scard-cover"><img src="${esc(s.img)}" loading="lazy" alt=""/>${badge}</div>
        <div class="dc-scard-title">${esc(s.title)}</div>
      </a>
      ${author}
      ${extra}
    </div>`;
  }

  function collCard(col) {
    injectStyles();
    const id = col.id || (col.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `<a class="dc-coll-card" href="collection.html?id=${encodeURIComponent(id)}" style="text-decoration:none;color:inherit">
      <div class="dc-coll-covers">${(col.covers || []).map(img => `<div style="background-image:url('${esc(img)}')"></div>`).join('')}</div>
      <div class="dc-coll-info">
        <div class="dc-coll-name">${esc(col.name)}</div>
        <div class="dc-coll-meta">${col.count} stories</div>
      </div>
    </a>`;
  }

  function listItem(s) {
    injectStyles();
    const href = storyHref(s);
    return `<div class="dc-list-item">
      <a class="dc-list-cover-link" href="${href}"><div class="dc-list-cover"><img src="${esc(s.img)}" loading="lazy" alt=""/></div></a>
      <div class="dc-list-body">
        <div class="dc-list-genre">${esc(s.genre || '')}</div>
        <a class="dc-list-title-link" href="${href}"><div class="dc-list-title">${esc(s.title)}</div></a>
        ${s.preview ? `<div class="dc-list-preview">${esc(s.preview)}</div>` : ''}
        <div class="dc-list-foot"><a class="dc-list-stat dc-list-author" href="${profileHref(s.author)}" onclick="event.stopPropagation()">${esc(s.author || '')}</a></div>
      </div>
    </div>`;
  }

  function platformAdItem(ad) {
    injectStyles();
    return `<div class="dc-list-item dc-ad" data-ad="platform" data-adid="${esc(ad.id || '')}">
      <div class="dc-list-cover"><span class="dc-ad-tag">Ad</span><img src="${esc(ad.img)}" loading="lazy" alt=""/></div>
      <div class="dc-list-body">
        <div class="dc-list-genre">${esc(ad.sponsor || 'DroBoard')}</div>
        <div class="dc-list-title">${esc(ad.title)}</div>
        <div class="dc-ad-cta">${esc(ad.cta || 'Learn More')}</div>
      </div>
    </div>`;
  }

  function bookAdItem(ad) {
    injectStyles();
    const href = storyHref(ad);
    return `<div class="dc-list-item dc-book-ad" data-ad="book" data-adid="${esc(ad.id || '')}" data-href="${href}" style="cursor:pointer" onclick="if(!event.target.closest('a'))window.location.href=this.dataset.href">
      <a class="dc-list-cover-link" href="${href}"><div class="dc-list-cover"><span class="dc-ad-tag">Promoted</span><img src="${esc(ad.img)}" loading="lazy" alt=""/></div></a>
      <div class="dc-list-body">
        <div class="dc-list-genre">${esc(ad.genre || '')}</div>
        <a class="dc-list-title-link" href="${href}"><div class="dc-list-title">${esc(ad.title)}</div></a>
        ${ad.preview ? `<div class="dc-list-preview">${esc(ad.preview)}</div>` : ''}
        <div class="dc-list-foot">
          <a class="dc-list-stat dc-list-author" href="${profileHref(ad.author)}" onclick="event.stopPropagation()">${esc(ad.author || '')}</a>
          ${ad.rating ? `<div class="dc-list-stat"><i class="fas fa-star" style="color:#f59e0b"></i> ${esc(ad.rating)}</div>` : ''}
          ${ad.chapters ? `<div class="dc-list-stat"><i class="fas fa-book-open"></i> ${ad.chapters} ch</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  function writersRow(writers) {
    injectStyles();
    return `<div class="dc-writers-row">
      <div class="dc-writers-head">Top Writers</div>
      <div class="dc-writers-scroll">
        ${writers.map(w => `<a class="dc-writer" href="profile.html?u=${esc(w.handle)}">
          <img class="dc-writer-avatar" src="${esc(w.avatar)}" loading="lazy" alt=""/>
          <div class="dc-writer-name">${esc(w.name)}</div>
        </a>`).join('')}
      </div>
    </div>`;
  }

  function renderRow(elId, items, emptyText) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = (items && items.length)
      ? items.map(scard).join('')
      : `<div style="display:flex;align-items:center;gap:8px;padding:14px 4px;color:#8e8e93;font-size:12.5px;font-weight:500"><i class="fas fa-circle-info" style="opacity:.7"></i>${esc(emptyText || 'Nothing here yet.')}</div>`;
  }

  function renderCollRow(elId, items, emptyText) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = (items && items.length)
      ? items.map(collCard).join('')
      : `<div style="display:flex;align-items:center;gap:8px;padding:14px 4px;color:#8e8e93;font-size:12.5px;font-weight:500"><i class="fas fa-circle-info" style="opacity:.7"></i>${esc(emptyText || 'No collections yet.')}</div>`;
  }

  function renderList(elId, items) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = items.map(listItem).join('');
  }

  window.DiscoverCard = {
    scard,
    collCard,
    listItem,
    platformAdItem,
    bookAdItem,
    writersRow,
    renderRow,
    renderCollRow,
    renderList,
    esc,
    storyHref,
    profileHref,
  };
})();
