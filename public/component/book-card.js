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
 *   }
 *
 * Optional: renderNewBookCard() for the dashed "New Book" CTA.
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
    .dbc-title{font-size:14.5px;font-weight:700;line-height:1.3}
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
    .dbc-status.revision{background:var(--danger-soft,#fdeaea);color:#c92a2a}

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
  `;

  const STATUS_LABEL = {
    published: 'Published',
    ongoing: 'Ongoing',
    draft: 'Draft',
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
    return `
      <div class="dbc-card${b.open ? ' dbc-open' : ''}" data-book-id="${_esc(b.id || '')}">
        <div class="dbc-cover"><img src="${_esc(cover)}" alt="${_esc(b.title || '')}" loading="lazy"/></div>
        <div class="dbc-info">
          <div class="dbc-title-row">
            <div class="dbc-title">${_esc(b.title || '')}</div>
            ${chev}
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

    let html = `<div class="dbc-list">${list.map(render).join('')}</div>`;
    if (h.showNew) html += renderNewBookCard(h.newOpts);

    el.innerHTML = html;

    el.querySelectorAll('.dbc-card').forEach((card, i) => {
      card.addEventListener('click', () => {
        if (typeof h.onOpen === 'function') h.onOpen(list[i], i);
      });
    });
    const neu = el.querySelector('[data-dbc-new]');
    if (neu && typeof h.onNew === 'function') {
      neu.addEventListener('click', () => h.onNew());
    }
  }

  window.DroboardBookCard = { render, renderList, renderNewBookCard, STATUS_LABEL };
})();
