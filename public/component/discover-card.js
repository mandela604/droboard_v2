/* ═══════════════════════════════════════════════════════════════
   DISCOVER CARD COMPONENT
   The one card renderer for every story surface: Discover rows, the
   "More Stories" feed and the browse overlay's genre list (which
   skins these rows as raised cards). Self-contained CSS injection.
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
      border-radius:7px;overflow:hidden;background:#e8e8ed;margin-bottom:6px;
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
    /* Category under the card — plain text, platform red, no emoji. */
    .dc-scard-cat{font-size:9.5px;color:var(--acc,var(--pink,#ff0050));font-weight:700;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dc-scard-rating{font-size:9.5px;color:#f59e0b;font-weight:600}
    .dc-cont-ch{font-size:9.5px;color:#8e8e93;margin-bottom:4px}
    .dc-prog-track{height:3px;background:#e5e5ea;border-radius:2px;overflow:hidden}
    .dc-prog-fill{height:100%;background:#ff2d55;border-radius:2px}

    .dc-coll-card{flex:0 0 200px;width:200px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ebebed;box-shadow:0 1px 4px rgba(0,0,0,.04);cursor:pointer}
    .dc-coll-covers{display:grid;grid-template-columns:1fr 1fr;height:100px}
    .dc-coll-covers div{background-size:cover;background-position:center;background-color:#f3f1f5}
    .dc-coll-covers .dc-coll-ph{display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#c7c4cc;background:#f3f1f5}
    .dc-coll-info{padding:10px 12px}
    .dc-coll-name{font-size:13px;font-weight:700;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dc-coll-meta{font-size:11px;color:#8e8e93}

    .dc-list-item{display:flex;gap:12px;padding:13px 0;position:relative}
    .dc-list-cover{width:76px;height:102px;border-radius:7px;overflow:hidden;flex-shrink:0;background:#e8e8ed;box-shadow:0 2px 8px rgba(0,0,0,.08);position:relative}
    .dc-list-cover img{width:100%;height:100%}
    .dc-list-cover-link,.dc-list-title-link{display:block;cursor:pointer}
    .dc-list-cover-link:active .dc-list-cover,.dc-list-title-link:active .dc-list-title{opacity:.7}
    .dc-list-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
    .dc-list-catrow{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .dc-list-cat{font-size:9px;font-weight:800;color:#8e8e93;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dc-list-trope{font-size:9px;font-weight:800;color:#ff2d55;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap;flex-shrink:0}
    .dc-list-title{font-size:13.5px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dc-list-preview{font-size:11.5px;color:#8e8e93;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dc-list-foot{display:flex;align-items:center;gap:10px;margin-top:2px;flex-wrap:wrap}
    .dc-list-stat{display:flex;align-items:center;gap:3px;font-size:10px;color:#8e8e93;font-weight:600}
    .dc-list-author{color:#ff2d55;font-weight:800;cursor:pointer}

    @keyframes dcIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .dc-list-item{animation:dcIn .2s ease both}
    [data-theme="dark"] .dc-coll-card{background:#0b0b10;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .dc-list-item{border-bottom-color:rgba(255,255,255,.08)}
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

  function storyHref(s) {    const id = s.id || (s.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
    // Continue-reading is the only card that carries `ch`, and there the
    // progress bar is the whole point: rating must not win the branch.
    if (s.ch) extra = `<div class="dc-cont-ch">${esc(s.ch)}</div>${s.pct != null ? `<div class="dc-prog-track"><div class="dc-prog-fill" style="width:${s.pct}%"></div></div>` : ''}`;
    else if (s.rating) extra = `<div class="dc-scard-rating">★ ${esc(s.rating)}</div>`;
    else if (s.cat) extra = `<div class="dc-scard-cat">${esc(s.cat)}</div>`;
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
    // A live collection with one story has one cover: it must fill the tile,
    // not sit in the top-left quarter of a 2x2 grid.
    const covers = (col.covers && col.covers.length ? col.covers : (col.cover ? [col.cover] : [])).filter(Boolean).slice(0, 4);
    // A 2x2 grid with 1 or 3 covers leaves a blank cell, so those get the first
    // tile full-width and the rest fall into a clean row.
    const span = covers.length === 1 || covers.length === 3 ? ';grid-column:1/-1' : '';
    // No art at all still gets a tile with the collection's initial, never a
    // blank white box — an empty card tells the reader nothing.
    const tiles = covers.length
      ? covers.map(img => `<div style="background-image:url('${esc(img)}')${span}"></div>`).join('')
      : `<div class="dc-coll-ph" style="grid-column:1/-1">${esc(String(col.name || '?').trim().charAt(0).toUpperCase())}</div>`;
    return `<a class="dc-coll-card" href="collection.html?id=${encodeURIComponent(id)}" style="text-decoration:none;color:inherit">
      <div class="dc-coll-covers">${tiles}</div>
      <div class="dc-coll-info">
        <div class="dc-coll-name">${esc(col.name)}</div>
        <div class="dc-coll-meta">${col.count} stories</div>
      </div>
    </a>`;
  }

  /* Trope per story: explicit trope/tropes win, else a stable pick from the
     CE catalog pool for the story's genre (live books carry tropes). */
  const TROPE_POOL = {
    romance: ['Enemies to Lovers', 'Secret Baby', 'Second Chance'],
    billionaire: ['Billionaire Boss', 'Secret Baby', 'Fake Dating'],
    ceo: ['CEO Romance', 'Fake Dating', 'Billionaire Boss'],
    werewolf: ['Fated Mates', 'Alpha Romance', 'Second Chance'],
    fantasy: ['Royal Romance', 'Royal Secret', 'Fated Mates'],
    mafia: ['Mafia Romance', 'Forced Proximity', 'Secret Baby'],
    campus: ['Fake Dating', 'Forced Proximity', 'Love Triangle'],
    revenge: ['Second Chance', 'Forced Proximity', 'Secret Baby'],
    drama: ['Second Chance', 'Marriage of Convenience', 'Forbidden Love'],
    betrayal: ['Secret Baby', 'Love Triangle', 'Second Chance'],
    family: ['Arranged Marriage', 'Secret Baby', 'Second Chance'],
    heartbreak: ['Second Chance', 'Forbidden Love', 'Love Triangle'],
    horror: ['Forbidden Love', 'Fated Mates', 'Vampire Romance'],
    mystery: ['Secret Baby', 'Forced Proximity', 'Love Triangle'],
    marriage: ['Arranged Marriage', 'Marriage of Convenience', 'Second Chance'],
    vampire: ['Vampire Romance', 'Forbidden Love', 'Fated Mates'],
  };
  const TROPE_FALLBACK = ['Second Chance', 'Forbidden Love', 'Secret Baby'];
  function storyTrope(s) {
    if (s.trope) return s.trope;
    if (s.tropes && s.tropes.length) return s.tropes[0];
    const pool = TROPE_POOL[String(s.genre || '').toLowerCase()] || TROPE_FALLBACK;
    const key = String(s.id || s.title || '');
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
  }

  function listItem(s) {
    injectStyles();
    const href = storyHref(s);
    const cat = (s.cat || s.category || s.genre || '');
    const trope = storyTrope(s);
    return `<div class="dc-list-item">
      <a class="dc-list-cover-link" href="${href}"><div class="dc-list-cover"><img src="${esc(s.img)}" loading="lazy" alt=""/></div></a>
      <div class="dc-list-body">
        <div class="dc-list-catrow"><span class="dc-list-cat">${esc(cat)}</span>${trope ? `<span class="dc-list-trope"><i class="fas fa-wand-magic-sparkles"></i> ${esc(trope)}</span>` : ''}</div>
        <a class="dc-list-title-link" href="${href}"><div class="dc-list-title">${esc(s.title)}</div></a>
        ${s.preview ? `<div class="dc-list-preview">${esc(s.preview)}</div>` : ''}
        <div class="dc-list-foot">
          <a class="dc-list-stat dc-list-author" href="${profileHref(s.author)}" onclick="event.stopPropagation()">${esc(s.author || '')}</a>
          ${s.rating ? `<div class="dc-list-stat"><i class="fas fa-star" style="color:#f59e0b"></i> ${esc(s.rating)}</div>` : ''}
          ${s.chapters ? `<div class="dc-list-stat"><i class="fas fa-book-open"></i> ${s.chapters} ch</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  /* Ad rows are the shared ad card, not a discover skin — one renderer,
     so theme-safe ink and the golden book style land identically here. */
  function platformAdItem(ad) {
    injectStyles();
    return DroboardAdCard.renderListPlatform(ad);
  }

  function bookAdItem(ad) {
    injectStyles();
    return DroboardAdCard.renderListBook(ad);
  }

  function writersRow(writers) {
    injectStyles();
    if (!window.DroboardWritersRow || typeof window.DroboardWritersRow.render !== 'function') return '';
    return window.DroboardWritersRow.render({ people: writers });
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
