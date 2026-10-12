/**
 * community-cards.js — Droboard reusable Communities cards
 * (genre hub + writer circle). Self-contained CSS injection.
 *
 * Drop one <script src="community-cards.js"></script> in any page, then:
 *
 *   DroboardCommunityCards.mount('#hubsWrap', {
 *     genre:  { name, icon, members, joined },
 *     circle: { name, members, perks, joined, avatar },
 *     showCircle: true,             // false = genre board only
 *     boardWord: 'Board',           // category hub renders as "<Genre> Board"
 *     genreHref: 'genre-hub.html?genre=betrayal',   // optional override
 *     onJoin: (type, joined, state) => { ... },     // required for persistence
 *   });
 *
 *   DroboardCommunityCards.boardName('Romance')       → 'Romance Board'
 *   DroboardCommunityCards.boardName('Betrayal Hub')  → 'Betrayal Board'
 *   DroboardCommunityCards.demoMembers('romance')     → stable demo number
 *
 * Re-mount with updated state to refresh (hosts own the data):
 *   DroboardCommunityCards.mount('#hubsWrap', nextOpts);
 */
(function () {
  'use strict';

  if (window.__droboardCommunityCards) return;
  window.__droboardCommunityCards = true;

  /* Every token below is owned by this component (dark default, light
     override) — the card looks identical on every host page, whether or
     not that page defines theme variables. */
  const CSS = `
    :root{
      --dcc-card:#161616; --dcc-text:#f0f0f0; --dcc-muted:#a1a1aa;
      --dcc-bd:rgba(255,255,255,.08); --dcc-iconbg:rgba(255,0,80,.12);
      --dcc-pri:#ff0050; --dcc-gold:#d97706; --dcc-green:#22c55e;
      --dcc-joindim:#0f1013;
    }
    body.theme-white{
      --dcc-card:#ffffff; --dcc-text:#171717; --dcc-muted:#8a8a8a;
      --dcc-bd:rgba(0,0,0,.08); --dcc-iconbg:rgba(255,0,80,.07);
      --dcc-joindim:#f0f0f2;
    }
    .dcc-card{display:flex;align-items:center;gap:11px;background:var(--surface,var(--dcc-card));border:1.5px solid var(--dcc-bd);border-radius:14px;padding:13px;cursor:pointer;transition:.15s;margin-bottom:9px;}
    .dcc-card:active{transform:scale(.99)}
    .dcc-icon{width:44px;height:44px;border-radius:12px;background:var(--dcc-iconbg);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
    .dcc-icon.circle-icon{border-radius:50%;overflow:hidden;background:var(--dcc-joindim);border:2px solid var(--dcc-gold);padding:0}
    .dcc-icon.circle-icon img{width:100%;height:100%;object-fit:cover}
    .dcc-body{flex:1;min-width:0}
    .dcc-name{font-size:12.5px;font-weight:800;color:var(--dcc-text);display:flex;align-items:center;gap:5px}
    .dcc-sub{font-size:10px;color:var(--dcc-muted);margin-top:3px;display:flex;align-items:center;gap:4px}
    .dcc-join-btn{flex-shrink:0;background:var(--dcc-joindim);color:var(--dcc-text);border:1.5px solid var(--dcc-bd);padding:8px 14px;border-radius:999px;font-size:10.5px;font-weight:800;transition:.18s;cursor:pointer;font-family:inherit;}
    .dcc-join-btn.joined{background:rgba(34,197,94,.12);border-color:rgba(22,163,74,.3);color:var(--dcc-green)}
    .dcc-join-btn.circle-btn{background:var(--dcc-pri);border-color:var(--dcc-pri);color:#fff;}
    .dcc-join-btn.circle-btn.joined{background:rgba(217,119,6,.12);border-color:rgba(217,119,6,.35);color:var(--dcc-gold)}
    .dcc-join-btn:active{transform:scale(.94)}
  `;

  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _fmtN(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function _ensureStyle() {
    if (document.getElementById('dcc-style')) return;
    const style = document.createElement('style');
    style.id = 'dcc-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function _genreId(name) {
    return (name || '').toLowerCase().replace(/[^a-z]+/g, '').replace('hub', '').replace('board', '').trim() || 'betrayal';
  }
  // "Romance" → "Romance Board", "Betrayal Hub" → "Betrayal Board".
  // Emoji prefixes ("📖 Story") are stripped first.
  function boardName(raw, word) {
    word = word || 'Board';
    let s = String(raw || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
    s = s.replace(/\s+(hub|board)$/i, '').trim() || 'Story';
    return s + ' ' + word;
  }
  // "💔 Betrayal" → { icon:'💔', name:'Betrayal' }; "Romance" → { icon:'📖', name:'Romance' }.
  function genreInfo(raw) {
    const parts = String(raw || '').trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const isEmoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(first);
    return isEmoji
      ? { icon: first, name: parts.slice(1).join(' ') || 'Story' }
      : { icon: '📖', name: parts.join(' ') || 'Story' };
  }
  function demoMembers(key, min, max) {
    let h = 2166136261;
    const str = String(key || '');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    const r = (h >>> 0) / 4294967296;
    return Math.round((min || 800) + r * ((max || 9000) - (min || 800)));
  }

  function mount(sel, opts) {
    _ensureStyle();
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    opts = opts || {};
    const genre = opts.genre || {};
    const circle = opts.circle || {};
    const showCircle = opts.showCircle !== false;
    const boardWord = opts.boardWord || 'Board';
    const genreHref = opts.genreHref || ('genre-hub.html?genre=' + _genreId(genre.name));
    const genreLabel = boardName(genre.name, boardWord);

    el.innerHTML = `
      <div class="dcc-card" data-dcc-go="${_esc(genreHref)}">
        <div class="dcc-icon">${_esc(genre.icon || '')}</div>
        <div class="dcc-body">
          <div class="dcc-name">${_esc(genreLabel)}</div>
          <div class="dcc-sub"><i class="fas fa-users" style="font-size:9px"></i> ${_fmtN(genre.members)} members · Tap to open hub</div>
        </div>
        <button class="dcc-join-btn${genre.joined ? ' joined' : ''}" data-dcc-join="genre">${genre.joined ? '✓ Joined' : '+ Join'}</button>
      </div>` +
      (showCircle ? `
      <div class="dcc-card">
        <div class="dcc-icon circle-icon">${circle.avatar ? `<img src="${_esc(circle.avatar)}" alt=""/>` : ''}</div>
        <div class="dcc-body">
          <div class="dcc-name">${_esc(circle.name || '')}</div>
          <div class="dcc-sub"><i class="fas fa-star" style="font-size:9px;color:var(--dcc-gold)"></i> ${_fmtN(circle.members)} members · ${ _esc(circle.perks || '')}</div>
        </div>
        <button class="dcc-join-btn circle-btn${circle.joined ? ' joined' : ''}" data-dcc-join="circle">${circle.joined ? '✓ Joined' : '+ Join'}</button>
      </div>` : '');

    const go = el.querySelector('[data-dcc-go]');
    if (go) go.addEventListener('click', () => { window.location.href = go.dataset.dccGo; });
    el.querySelectorAll('[data-dcc-join]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.dccJoin;
        const next = type === 'genre' ? !genre.joined : !circle.joined;
        if (typeof opts.onJoin === 'function') opts.onJoin(type, next, { genre, circle });
      });
    });
  }

  window.DroboardCommunityCards = { mount, boardName, genreInfo, demoMembers };
})();
