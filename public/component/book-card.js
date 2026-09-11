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
 *     id?, title, genre, cover,
 *     reads, likes, chapters,
 *     status: 'published'|'ongoing'|'draft'|'scheduled'|'paused'|'rejected'
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
      display:flex;gap:12px;background:var(--card,#fff);border:1px solid var(--border,#ebebed);
      border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.04);padding:12px;cursor:pointer;
      color:var(--text,#1a1a1a);
    }
    .dbc-card:active{opacity:.85}
    .dbc-cover{width:64px;height:88px;border-radius:9px;overflow:hidden;flex-shrink:0;background:#e8e8ed}
    .dbc-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .dbc-info{flex:1;min-width:0;display:flex;flex-direction:column}
    .dbc-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
    .dbc-title{font-size:14.5px;font-weight:700;line-height:1.3}
    .dbc-chev{color:var(--muted,#8e8e93);font-size:12px;margin-top:3px;flex-shrink:0}
    .dbc-genre{font-size:11.5px;color:var(--muted,#8e8e93);font-weight:500;margin-top:2px;margin-bottom:8px}
    .dbc-stats{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-bottom:auto}
    .dbc-stat{display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:var(--muted,#8e8e93)}
    .dbc-stat i{font-size:9.5px}
    .dbc-foot{display:flex;align-items:center;margin-top:9px}
    .dbc-status{font-size:9px;font-weight:800;padding:3px 8px;border-radius:20px;letter-spacing:.02em;text-transform:uppercase}
    .dbc-status.published{background:var(--success-soft,#e9fbf0);color:#158a48}
    .dbc-status.ongoing{background:var(--warning-soft,#fef3e2);color:#b7690a}
    .dbc-status.draft{background:var(--blue-soft,#e7f0fe);color:#1d5fd6}
    .dbc-status.scheduled{background:var(--warning-soft,#fef3e2);color:#b7690a}
    .dbc-status.paused{background:#f1f1f4;color:#5c5c66}
    .dbc-status.rejected{background:var(--danger-soft,#fdeaea);color:#c92a2a}
    .dbc-status.completed{background:var(--success-soft,#e9fbf0);color:#158a48}

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
      background:var(--l1,#08090c);border-color:var(--bd,rgba(255,255,255,.07));color:var(--tx-high,#e0e0e0);
    }
    [data-theme="dark"] .dbc-title{color:var(--tx-high,#e0e0e0)}
    [data-theme="dark"] .dbc-genre,
    [data-theme="dark"] .dbc-stat,
    [data-theme="dark"] .dbc-chev{color:var(--tx-muted,#71717a)}
    [data-theme="dark"] .dbc-cover{background:var(--l2,#0e0f13)}
    [data-theme="dark"] .dbc-status.paused{background:rgba(255,255,255,.08);color:var(--tx-muted,#71717a)}
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

  function render(book) {
    _ensureStyle();
    const b = book || {};
    const status = b.status || 'draft';
    const label = STATUS_LABEL[status] || status;
    const cover = b.cover || b.img || '';
    const chapters = b.chapters != null ? b.chapters : (b.ch || '');
    return `
      <div class="dbc-card" data-book-id="${_esc(b.id || '')}">
        <div class="dbc-cover"><img src="${_esc(cover)}" alt="${_esc(b.title || '')}" loading="lazy"/></div>
        <div class="dbc-info">
          <div class="dbc-title-row">
            <div class="dbc-title">${_esc(b.title || '')}</div>
            <i class="fas fa-chevron-right dbc-chev"></i>
          </div>
          <div class="dbc-genre">${_esc(b.genre || b.cat || '')}</div>
          <div class="dbc-stats">
            <div class="dbc-stat"><i class="far fa-eye"></i> ${_esc(String(b.reads != null ? b.reads : '—'))}</div>
            <div class="dbc-stat"><i class="far fa-heart"></i> ${_esc(String(b.likes != null ? b.likes : '—'))}</div>
            <div class="dbc-stat"><i class="fas fa-list-ul"></i> ${_esc(String(chapters))}${chapters !== '' && !String(chapters).toLowerCase().includes('ch') ? ' ch' : ''}</div>
          </div>
          <div class="dbc-foot">
            <span class="dbc-status ${ _esc(status) }">${_esc(label)}</span>
          </div>
        </div>
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
