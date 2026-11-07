/**
 * component/book-card.js — Droboard Book Card (Author Center layout)
 * ─────────────────────────────────────────────────────────────────
 * Exact layout from author-center "My Books" list. Self-contained CSS.
 *
 *   <script src="component/book-card.js"></script>
 *
 *   // Single card HTML string
 *   el.innerHTML = DroboardBookCard.render(book);
 *
 *   // List into a container
 *   DroboardBookCard.renderList('#bookList', books, {
 *     onOpen: (book) => { location.href = 'book-workspace.html?id=' + book.id; },
 *   });
 *
 * Book shape:
 *   {
 *     id?, title, genre, cover, desc?,
 *     reads, likes, chapters,          // or stats: [{ icon: 'far fa-eye', text: '2.3M' }]
 *     status: 'published'|'ongoing'|'draft'|'scheduled'|'paused'|'rejected'|'pending'|'revision',
 *     statusLabel?, statusClass?,      // override the badge text/style
 *     chevron: 'right'|'down'|'none',  // open: true rotates it
 *     trailing: '<div class="dbc-amount">$120</div>'   // right-hand slot
 *     onEngage: true,                                // show the ⋯ menu
 *   }
 *
 * Optional: renderNewBookCard() for the dashed "New Book" CTA.
 *
 * The ⋯ button opens a story-wide engagement picker (Poll / Prediction /
 * Debate) anchored under the dots; picking one hands the kind to
 * hooks.onEngage(book, anchorEl, kind) — or straight to
 * DroboardEngagementCreator.open({ kind }) when no hook is set.
 */
(function () {
  'use strict';
  if (window.__droboardBookCard) return;
  window.__droboardBookCard = true;

  const CSS = `
    .dbc-list{display:flex;flex-direction:column;gap:10px;margin-bottom:10px;font-family:'Inter',-apple-system,sans-serif}
    .dbc-card{
      display:flex;gap:12px;background:var(--card,#fff);border:1px solid var(--border,var(--bd,#ebebed));
      border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.04);padding:12px;cursor:pointer;
      color:var(--text,var(--tx-high,#1a1a1a));
    }
    .dbc-card:active{opacity:.85}
    .dbc-cover{width:64px;height:88px;border-radius:9px;overflow:hidden;flex-shrink:0;background:#e8e8ed}
    .dbc-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .dbc-info{flex:1;min-width:0;display:flex;flex-direction:column}
    .dbc-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
    .dbc-title{font-size:14.5px;font-weight:700;line-height:1.3;flex:1;min-width:0}
    .dbc-chev{color:var(--muted,var(--tx-muted,#8e8e93));font-size:12px;margin-top:3px;flex-shrink:0;transition:transform .2s}
    .dbc-card.dbc-open .dbc-chev{transform:rotate(180deg)}
    .dbc-genre{font-size:11.5px;color:var(--muted,var(--tx-muted,#8e8e93));font-weight:500;margin-top:2px;margin-bottom:8px}
    .dbc-stats{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-bottom:auto}
    .dbc-desc{font-size:11.5px;line-height:1.45;color:var(--muted,var(--tx-muted,#8e8e93));margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dbc-stat{display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:var(--muted,var(--tx-muted,#8e8e93))}
    .dbc-stat i{font-size:9.5px}
    .dbc-foot{display:flex;align-items:center;margin-top:9px}
    .dbc-trailing{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:3px;flex-shrink:0;text-align:right}
    .dbc-amount{font-size:16px;font-weight:800;color:var(--success,#22c55e)}
    .dbc-sub{font-size:10px;font-weight:600;color:var(--muted,var(--tx-muted,#8e8e93))}
    .dbc-status{font-size:9px;font-weight:800;padding:3px 8px;border-radius:20px;letter-spacing:.02em;text-transform:uppercase}
    .dbc-status.published{background:var(--success-soft,#e9fbf0);color:#158a48}
    .dbc-status.ongoing{background:var(--warning-soft,#fef3e2);color:#b7690a}
    .dbc-status.draft{background:var(--blue-soft,#e7f0fe);color:#1d5fd6}
    .dbc-status.scheduled{background:var(--warning-soft,#fef3e2);color:#b7690a}
    .dbc-status.paused{background:#f1f1f4;color:#5c5c66}
    .dbc-status.rejected{background:var(--danger-soft,#fdeaea);color:#c92a2a}
    .dbc-status.completed{background:var(--success-soft,#e9fbf0);color:#158a48}
    .dbc-status.pending{background:var(--warning-soft,#fef3e2);color:#b7690a}
    .dbc-status.under_review{background:var(--warning-soft,#fef3e2);color:#b7690a}
    .dbc-status.revision{background:var(--danger-soft,#fdeaea);color:#c92a2a}

    /* Three-dot trigger in the title row */
    .dbc-menu-btn{
      width:28px;height:28px;flex-shrink:0;margin:-3px -5px 0 0;border-radius:9px;
      display:flex;align-items:center;justify-content:center;
      color:var(--muted,var(--tx-muted,#8e8e93));font-size:13.5px;cursor:pointer;
      background:none;border:none;transition:background .15s,color .15s;position:relative;
    }
    .dbc-menu-btn:hover{background:rgba(127,127,127,.14);color:var(--text,var(--tx-high,#1a1a1a))}
    .dbc-menu-btn:active{transform:scale(.92)}
    .dbc-menu-btn.on{background:rgba(255,45,85,.12);color:var(--pink,#ff2d55)}

    /* Story-wide engagement picker — viewport-clamped dropdown on <body> */
    .dbc-pop-overlay{position:fixed;inset:0;z-index:1790;display:none}
    .dbc-pop-overlay.on{display:block}
    .dbc-pop{
      position:fixed;z-index:1800;min-width:236px;max-width:280px;
      background:var(--card,#fff);border:1px solid var(--border,var(--bd,#ebebed));
      border-radius:15px;padding:6px;box-shadow:0 14px 44px rgba(0,0,0,.18);
      opacity:0;transform:translateY(-6px) scale(.97);pointer-events:none;
      transition:opacity .16s ease,transform .16s ease;
      font-family:'Inter',-apple-system,sans-serif;
    }
    .dbc-pop.on{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
    .dbc-pop-head{padding:9px 10px 8px;border-bottom:1px solid var(--border,var(--bd,#ebebed));margin-bottom:5px}
    .dbc-pop-title{font-size:12.5px;font-weight:800;color:var(--text,var(--tx-high,#1a1a1a))}
    .dbc-pop-sub{font-size:10.5px;color:var(--muted,var(--tx-muted,#8e8e93));margin-top:2px;line-height:1.4}
    .dbc-pop-item{
      display:flex;align-items:center;gap:10px;width:100%;text-align:left;
      padding:9px 10px;border-radius:10px;border:none;background:none;cursor:pointer;
      font-family:inherit;transition:background .14s;
    }
    .dbc-pop-item:hover{background:rgba(127,127,127,.1)}
    .dbc-pop-ico{
      width:30px;height:30px;flex-shrink:0;border-radius:9px;
      display:flex;align-items:center;justify-content:center;font-size:13px;
    }
    .dbc-pop-ico.poll{background:var(--blue-soft,#e7f0fe);color:var(--blue,#3b82f6)}
    .dbc-pop-ico.prediction{background:var(--purple-soft,#f3e8ff);color:var(--purple,#9333ea)}
    .dbc-pop-ico.debate{background:var(--warning-soft,#fef3e2);color:var(--warning,#f59e0b)}
    .dbc-pop-txt{min-width:0;flex:1}
    .dbc-pop-lbl{display:block;font-size:12.5px;font-weight:700;color:var(--text,var(--tx-high,#1a1a1a))}
    .dbc-pop-hint{display:block;font-size:10.5px;color:var(--muted,var(--tx-muted,#8e8e93));margin-top:1px;line-height:1.35}
    .dbc-pop-item .fa-chevron-right{font-size:9.5px;color:var(--muted,var(--tx-muted,#8e8e93));flex-shrink:0;opacity:.7}

    .dbc-new{
      border:1.5px dashed #ffb8c8;background:rgba(255,45,85,.05);border-radius:14px;
      padding:20px 16px;text-align:center;cursor:pointer;
      font-family:'Inter',-apple-system,sans-serif;
    }
    .dbc-new:active{opacity:.85}
    .dbc-new-plus{
      width:38px;height:38px;border-radius:50%;background:#fff;color:#ff2d55;
      display:flex;align-items:center;justify-content:center;font-size:16px;margin:0 auto 8px;
      box-shadow:0 1px 4px rgba(0,0,0,.06);
    }
    .dbc-new-title{font-size:13.5px;font-weight:800;color:#ff2d55;margin-bottom:3px}
    .dbc-new-sub{font-size:11.5px;color:#c23a63;font-weight:500}

    @media (max-width:359px){
      .dbc-cover{width:56px;height:78px}
      .dbc-title{font-size:13.5px}
    }

    /* Dark theme (profile / feed pages) */
    [data-theme="dark"] .dbc-card{
      background:var(--l1,var(--card,#08090c));border-color:var(--bd,var(--border,rgba(255,255,255,.07)));color:var(--tx-high,var(--text,#e0e0e0));
    }
    [data-theme="dark"] .dbc-title{color:var(--tx-high,var(--text,#e0e0e0))}
    [data-theme="dark"] .dbc-genre,
    [data-theme="dark"] .dbc-desc,
    [data-theme="dark"] .dbc-sub,
    [data-theme="dark"] .dbc-stat,
    [data-theme="dark"] .dbc-chev{color:var(--tx-muted,var(--muted,#71717a))}
    [data-theme="dark"] .dbc-cover{background:var(--l2,var(--border,#0e0f13))}
    [data-theme="dark"] .dbc-status.paused{background:rgba(255,255,255,.08);color:var(--tx-muted,var(--muted,#71717a))}
    [data-theme="dark"] .dbc-menu-btn{color:var(--tx-muted,var(--muted,#71717a)}
    [data-theme="dark"] .dbc-menu-btn:hover{background:rgba(255,255,255,.1);color:var(--tx-high,#e0e0e0)}
    [data-theme="dark"] .dbc-pop{background:#16171d;border-color:rgba(255,255,255,.09);box-shadow:0 14px 44px rgba(0,0,0,.5)}
    [data-theme="dark"] .dbc-pop-head{border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .dbc-pop-title{color:#e6e6ea}
    [data-theme="dark"] .dbc-pop-sub,[data-theme="dark"] .dbc-pop-hint,[data-theme="dark"] .dbc-pop-item .fa-chevron-right{color:#8a8f99}
    [data-theme="dark"] .dbc-pop-item:hover{background:rgba(255,255,255,.07)}
    [data-theme="dark"] .dbc-pop-lbl{color:#e6e6ea}
    [data-theme="dark"] .dbc-pop-ico.poll{background:rgba(59,130,246,.16);color:#60a5fa}
    [data-theme="dark"] .dbc-pop-ico.prediction{background:rgba(147,51,234,.18);color:#c084fc}
    [data-theme="dark"] .dbc-pop-ico.debate{background:rgba(245,158,11,.16);color:#fbbf24}
  `;

  const STATUS_LABEL = {
    published: 'Published',
    ongoing: 'Ongoing',
    draft: 'Draft',
    under_review: 'Under Review',
    scheduled: 'Scheduled',
    paused: 'Paused',
    rejected: 'Rejected',
    completed: 'Completed',
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _ensureStyle() {
    if (document.getElementById('dbc-style')) return;
    const style = document.createElement('style');
    style.id = 'dbc-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function _statsHtml(b) {
    if (Array.isArray(b.stats)) {
      return b.stats.map(function (s) {
        return '<div class="dbc-stat">' + (s.icon ? '<i class="' + _esc(s.icon) + '"></i> ' : '') + _esc(s.text) + '</div>';
      }).join('');
    }
    const chapters = b.chapters != null ? b.chapters : (b.ch || '');
    return '<div class="dbc-stat"><i class="far fa-eye"></i> ' + _esc(String(b.reads != null ? b.reads : '—')) + '</div>'
      + '<div class="dbc-stat"><i class="far fa-heart"></i> ' + _esc(String(b.likes != null ? b.likes : '—')) + '</div>'
      + '<div class="dbc-stat"><i class="fas fa-list-ul"></i> ' + _esc(String(chapters))
      + (chapters !== '' && !String(chapters).toLowerCase().includes('ch') ? ' ch' : '') + '</div>';
  }

  function render(book) {
    _ensureStyle();
    const b = book || {};
    const status = b.status || 'draft';
    const statusClass = b.statusClass || status;
    const label = b.statusLabel || STATUS_LABEL[status] || status;
    const cover = b.cover || b.img || '';
    const chevIcon = b.chevron === 'down' ? 'fa-chevron-down' : 'fa-chevron-right';
    const chev = b.chevron === 'none' ? '' : '<i class="fas ' + chevIcon + ' dbc-chev"></i>';
    const foot = (b.status === false && !b.statusLabel) ? ''
      : '<div class="dbc-foot"><span class="dbc-status ' + _esc(statusClass) + '">' + _esc(label) + '</span></div>';
    const trailing = b.trailing ? '<div class="dbc-trailing">' + b.trailing + '</div>' : '';
    // Three-dot menu button with author-wide actions (story-wide engagement, etc.)
    // No inline onclick: the card owns navigation, so the menu is intercepted in
    // renderList's delegated listener instead of racing it from an attribute.
    const menuBtn = b.id && b.onEngage ?
      '<button type="button" class="dbc-menu-btn" data-menu="' + _esc(b.id) + '" aria-label="More options">' +
        '<i class="fas fa-ellipsis-v"></i>' +
      '</button>' : '';
    return `
      <div class="dbc-card${b.open ? ' dbc-open' : ''}" data-book-id="${_esc(b.id || '')}">
        <div class="dbc-cover"><img src="${_esc(cover)}" alt="${_esc(b.title || '')}" loading="lazy"/></div>
        <div class="dbc-info">
          <div class="dbc-title-row">
            <div class="dbc-title">${_esc(b.title || '')}</div>
            ${chev}
            ${menuBtn}
          </div>
          ${(b.genre || b.cat) ? '<div class="dbc-genre">' + _esc(b.genre || b.cat) + '</div>' : ''}
          <div class="dbc-stats">${_statsHtml(b)}</div>
          ${b.desc ? '<div class="dbc-desc">' + _esc(b.desc) + '</div>' : ''}
          ${foot}
        </div>
        ${trailing}
      </div>`;
  }

  function renderNewBookCard(opts) {
    _ensureStyle();
    const o = opts || {};
    return `
      <div class="dbc-new" data-dbc-new="1">
        <div class="dbc-new-plus"><i class="fas fa-plus"></i></div>
        <div class="dbc-new-title">${_esc(o.title || 'New Book')}</div>
        <div class="dbc-new-sub">${_esc(o.sub || 'Start writing your next great story.')}</div>
      </div>`;
  }

  /**
   * @param {string|Element} mount
   * @param {Array} books
   * @param {{ onOpen?: Function, onNew?: Function, showNew?: boolean, newOpts?: object }} hooks
   */
  function renderList(mount, books, hooks) {
    _ensureStyle();
    const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!el) return;
    const h = hooks || {};
    const list = books || [];
    _remember(list);

    let html = `<div class="dbc-list">${list.map(render).join('')}</div>`;
    if (h.showNew) html += renderNewBookCard(h.newOpts);

    el.innerHTML = html;
    _closePop(); // stale anchors die with the re-render

    el.querySelectorAll('.dbc-card').forEach((card, i) => {
      card.addEventListener('click', (e) => {
        // The dots live inside the card — intercept before navigation, or the
        // menu click would open the workspace instead of the picker.
        const menu = e.target.closest('.dbc-menu-btn');
        if (menu) { openMenu(menu.getAttribute('data-menu'), menu); return; }
        if (typeof h.onOpen === 'function') h.onOpen(list[i], i);
      });
    });
    const neu = el.querySelector('[data-dbc-new]');
    if (neu && typeof h.onNew === 'function') {
      neu.addEventListener('click', () => h.onNew());
    }
  }

  // Host pages register their engagement handler once:
  //   DroboardBookCard.configure({ onEngage: (book, anchorEl, kind) => ... });
  let _hooks = {};
  function configure(h) { _hooks = Object.assign({}, _hooks, h || {}); }

  // The sheet needs more than an id (title for its subtitle, and the row to
  // update on create), so keep the last-rendered list addressable by id.
  const _byId = {};
  function _remember(list) { (list || []).forEach(function (b) { if (b && b.id) _byId[b.id] = b; }); }

  // ── Story-wide engagement picker ──────────────────────────────────────
  // The dots open a small dropdown (Poll / Prediction / Debate) anchored
  // under the button; picking a kind dispatches to the host, which decides
  // whether it opens the creator sheet. Dropdown lives on <body> so card
  // overflow never clips it; a fixed overlay closes it on any outside tap.
  let _pop = null, _popOv = null, _popAnchor = null;

  const FALLBACK_KINDS = [
    { kind: 'poll', label: 'Poll', icon: 'fa-square-poll-horizontal', hint: 'Readers pick one option.' },
    { kind: 'prediction', label: 'Prediction', icon: 'fa-crystal-ball', hint: 'Readers call what happens next.' },
    { kind: 'debate', label: 'Debate', icon: 'fa-scale-balanced', hint: 'Readers argue both sides of a motion.' },
  ];
  function _kinds() {
    const c = window.DroboardEngagementCreator;
    return (c && Array.isArray(c.TYPES) && c.TYPES.length) ? c.TYPES : FALLBACK_KINDS;
  }

  function _ensurePop() {
    if (_pop) return;
    _popOv = document.createElement('div');
    _popOv.className = 'dbc-pop-overlay';
    _popOv.addEventListener('click', _closePop);
    document.body.appendChild(_popOv);

    _pop = document.createElement('div');
    _pop.className = 'dbc-pop';
    _pop.setAttribute('role', 'menu');
    _pop.addEventListener('click', function (e) {
      const item = e.target.closest('.dbc-pop-item');
      if (!item || !_pop) return;
      const book = _popBook, anchor = _popAnchor;
      const kind = item.getAttribute('data-kind');
      _closePop();
      if (book) _dispatch(book, anchor, kind);
    });
    document.body.appendChild(_pop);

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') _closePop(); });
    window.addEventListener('resize', _closePop);
    window.addEventListener('scroll', _closePop, true);
  }

  let _popBook = null;

  function _dispatch(book, anchorEl, kind) {
    if (typeof _hooks.onEngage === 'function') { _hooks.onEngage(book, anchorEl, kind); return; }
    if (window.DroboardEngagementCreator) {
      window.DroboardEngagementCreator.open({ bookId: book.id, bookTitle: book.title, kind: kind });
      return;
    }
    if (typeof window.toast === 'function') window.toast('Engagement creator not loaded');
  }

  function _positionPop() {
    if (!_pop || !_popAnchor || !_popAnchor.isConnected) { _closePop(); return; }
    const mw = _pop.offsetWidth || 240;
    const mh = _pop.offsetHeight || 180;
    const r = _popAnchor.getBoundingClientRect();
    let top = r.bottom + 6;
    let left = r.right - mw; // right-align to the dots
    if (top + mh > window.innerHeight - 8) top = r.top - mh - 6; // flip above
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - mh - 8));
    _pop.style.top = top + 'px';
    _pop.style.left = left + 'px';
  }

  function _closePop() {
    if (_popAnchor) _popAnchor.classList.remove('on');
    if (_pop) _pop.classList.remove('on');
    if (_popOv) _popOv.classList.remove('on');
    _popAnchor = null;
    _popBook = null;
  }

  function openMenu(bookId, anchorEl) {
    const book = _byId[bookId] || { id: bookId };
    // Toggle: same dots twice closes it.
    if (_pop && _pop.classList.contains('on') && _popBook && _popBook.id === bookId) { _closePop(); return; }
    _ensurePop();
    _popBook = book;
    _popAnchor = anchorEl || null;
    _pop.innerHTML =
      '<div class="dbc-pop-head">' +
        '<div class="dbc-pop-title">Story-wide engagement</div>' +
        '<div class="dbc-pop-sub">Runs across every chapter of ' + _esc(book.title || 'this story') + '.</div>' +
      '</div>' +
      _kinds().map(function (t) {
        return '<button type="button" class="dbc-pop-item" role="menuitem" data-kind="' + _esc(t.kind) + '">' +
          '<span class="dbc-pop-ico ' + _esc(t.kind) + '"><i class="fas ' + _esc(String(t.icon || '').split(' ')[0]) + '"></i></span>' +
          '<span class="dbc-pop-txt">' +
            '<span class="dbc-pop-lbl">' + _esc(t.label) + '</span>' +
            '<span class="dbc-pop-hint">' + _esc(t.hint || '') + '</span>' +
          '</span>' +
          '<i class="fas fa-chevron-right"></i>' +
        '</button>';
      }).join('');
    _pop.classList.add('on');
    _popOv.classList.add('on');
    if (anchorEl) anchorEl.classList.add('on');
    requestAnimationFrame(_positionPop);
  }

  window.DroboardBookCard = { render, renderList, renderNewBookCard, STATUS_LABEL, openMenu, configure };
})();
