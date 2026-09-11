/* ═══════════════════════════════════════════════════════════════
   LIBRARY CARD COMPONENT
   Self-contained CSS + renderers for library page cards.
   4-per-row grid, continue reading row, list items.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__libraryCard) return;
  window.__libraryCard = true;

  const CSS = `
    /* ── GRID CARD (4 per row) ── */
    .lb-gcard{cursor:pointer;min-width:0}
    .lb-gcard:active{opacity:.85}
    .lb-gcard-cover{
      position:relative;width:100%;aspect-ratio:110/148;
      border-radius:9px;overflow:hidden;background:#e8e8ed;margin-bottom:6px;
      box-shadow:0 2px 8px rgba(0,0,0,.08)
    }
    .lb-gcard-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .lb-badge{
      position:absolute;top:5px;left:5px;font-size:7px;font-weight:800;
      padding:2px 5px;border-radius:4px;letter-spacing:.2px;text-transform:uppercase;z-index:2;color:#fff
    }
    .lb-badge.hot{background:#ef4444}
    .lb-badge.new{background:#22c55e}
    .lb-badge.update{background:#ff2d55}
    .lb-badge.done{background:#10b981}
    .lb-prog-track{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.2)}
    .lb-prog-fill{height:100%;background:#ff2d55;border-radius:2px}
    .lb-gcard-title{
      font-size:10.5px;font-weight:600;line-height:1.3;color:#1a1a1a;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px
    }
    .lb-gcard-author{font-size:9.5px;color:#8e8e93;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lb-gcard-meta{font-size:9.5px;color:#8e8e93;font-weight:500}

    /* ── CONTINUE CARD ── */
    .lb-cont{cursor:pointer;min-width:0}
    .lb-cont:active{opacity:.85}
    .lb-cont-cover{
      position:relative;width:100%;aspect-ratio:110/148;
      border-radius:9px;overflow:hidden;background:#e8e8ed;margin-bottom:6px;
      box-shadow:0 2px 8px rgba(0,0,0,.08)
    }
    .lb-cont-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .lb-cont-prog{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.2)}
    .lb-cont-prog-fill{height:100%;background:#ff2d55;border-radius:2px}
    .lb-cont-badge{position:absolute;top:5px;left:5px;font-size:7px;font-weight:800;padding:2px 5px;border-radius:4px;background:#ff2d55;color:#fff;letter-spacing:.02em}
    .lb-cont-title{font-size:10.5px;font-weight:600;line-height:1.3;margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .lb-cont-meta{font-size:9.5px;color:#8e8e93;font-weight:500}

    /* ── LIST CARD ── */
    .lb-list-item{
      display:flex;gap:12px;padding:13px 0;border-bottom:1px solid #ebebed;cursor:pointer
    }
    .lb-list-item:last-child{border-bottom:none}
    .lb-list-item:active{opacity:.85}
    .lb-list-cover{width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;background:#e8e8ed;box-shadow:0 2px 8px rgba(0,0,0,.08);position:relative}
    .lb-list-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .lb-list-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
    .lb-list-genre{font-size:9px;font-weight:800;color:#ff2d55;text-transform:uppercase;letter-spacing:.05em}
    .lb-list-title{font-size:13.5px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#1a1a1a}
    .lb-list-preview{font-size:11.5px;color:#8e8e93;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .lb-list-foot{display:flex;align-items:center;gap:10px;margin-top:2px;flex-wrap:wrap}
    .lb-list-stat{display:flex;align-items:center;gap:3px;font-size:10px;color:#8e8e93;font-weight:600}
    [data-theme="dark"] .lb-gcard-title,[data-theme="dark"] .lb-list-title,[data-theme="dark"] .lb-cont-title{color:#f0f0f5}
    [data-theme="dark"] .lb-gcard-cover,[data-theme="dark"] .lb-list-cover,[data-theme="dark"] .lb-cont-cover{background:#1a1a24}
    [data-theme="dark"] .lb-list-item{border-bottom-color:rgba(255,255,255,.08)}
  `;

  function injectStyles() {
    if (document.getElementById('lb-style')) return;
    const s = document.createElement('style');
    s.id = 'lb-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Grid Card (4 per row) ── */
  function gridCard(s) {
    injectStyles();
    let badge = '';
    if (s.status === 'finished') badge = '<span class="lb-badge done">DONE</span>';
    else if (s.status === 'unread') badge = '<span class="lb-badge new">NEW</span>';
    else if (s.pct > 0 && s.pct < 100) badge = `<span class="lb-badge update">${s.pct}%</span>`;
    let prog = '';
    if (s.pct > 0 && s.pct < 100) prog = `<div class="lb-prog-track"><div class="lb-prog-fill" style="width:${s.pct}%"></div></div>`;
    return `<div class="lb-gcard">
      <div class="lb-gcard-cover">
        <img src="${esc(s.img || s.cover || '')}" loading="lazy" alt=""/>
        ${badge}
        ${prog}
      </div>
      <div class="lb-gcard-title">${esc(s.title)}</div>
      <div class="lb-gcard-author">${esc(s.author || '')}</div>
    </div>`;
  }

  /* ── Continue Reading Card ── */
  function continueCard(s) {
    injectStyles();
    const badge = s.badge ? `<span class="lb-cont-badge">${esc(s.badge)}</span>` : '';
    return `<div class="lb-cont">
      <div class="lb-cont-cover">
        <img src="${esc(s.img || s.cover || '')}" loading="lazy" alt=""/>
        ${badge}
        <div class="lb-cont-prog"><div class="lb-cont-prog-fill" style="width:${Math.max(0, Math.min(100, +s.pct || 0))}%"></div></div>
      </div>
      <div class="lb-cont-title">${esc(s.title)}</div>
      <div class="lb-cont-meta">${esc(s.ch)} · ${esc(s.pct)}%</div>
    </div>`;
  }

  /* ── List Item ── */
  function listItem(s) {
    injectStyles();
    let prog = '';
    if (s.pct > 0 && s.pct < 100) prog = `<div class="lb-list-stat">${esc(s.pct)}% complete</div>`;
    return `<div class="lb-list-item">
      <div class="lb-list-cover"><img src="${esc(s.img || s.cover || '')}" loading="lazy" alt=""/></div>
      <div class="lb-list-body">
        <div class="lb-list-genre">${esc(s.ch || '')}</div>
        <div class="lb-list-title">${esc(s.title)}</div>
        ${s.preview ? `<div class="lb-list-preview">${esc(s.preview)}</div>` : ''}
        <div class="lb-list-foot">
          <div class="lb-list-stat">${esc(s.author || '')}</div>
          ${prog}
        </div>
      </div>
    </div>`;
  }

  /* ── Bulk Renderers ── */
  function renderGrid(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="lib-grid">${items.map(gridCard).join('')}</div>`;
  }

  function renderList(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="lib-list">${items.map(listItem).join('')}</div>`;
  }

  function renderContinue(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = items.map(continueCard).join('');
  }

  window.LibraryCard = {
    gridCard,
    continueCard,
    listItem,
    renderGrid,
    renderList,
    renderContinue,
  };
})();