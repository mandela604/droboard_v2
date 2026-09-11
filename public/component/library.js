/**
 * library.js — Droboard Reusable "My Library" Grid Component
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="library.js"></script> in any page. Load order:
 * put this AFTER share-modal.js if you want "Share" in the card menu to
 * open the real share sheet — omit it and Share falls back to a toast.
 *
 *   const lib = DroboardLibrary.attach('#libraryMount', {
 *     items: LIBRARY,             // see shape below
 *     maxItems: 12,                // optional cap — omit/0 for unlimited
 *     subtitleEl: '#libSubtitle',  // optional — auto-updates "N saved stories"
 *     footnoteEl: '#libFootnote',  // optional — auto-updates slots-remaining copy
 *
 *     onOpen(item)   { location.href = 'bridge.html?story=' + item.id; },
 *     onShare(item)  { ... },   // optional — falls back to share-modal.js or a toast
 *     onRemove(item) { ... },   // optional — fires after the item is already removed
 *   });
 *
 *   lib.setItems(newList);   // replace all items, re-render
 *   lib.addItem(item);       // push one item (respects maxItems)
 *   lib.removeItem(id);      // remove by id
 *   lib.getItems();          // read current in-memory state
 *   lib.destroy();           // remove and clean up
 *
 * Item shape (any field but id/title/cover can be omitted):
 *   {
 *     id, cover, cat, title, author, avatar,
 *     status,     // 'reading' | 'completed' | 'saved'
 *     progress,   // 0-100, only meaningful when status === 'reading'
 *     lastCh,     // e.g. 'S2·Ch4', 'Complete', 'Not started'
 *     url,        // optional — used as the share-modal URL, else a droboard.app guess
 *   }
 *
 * This component does NOT know about your backend. It keeps its own
 * in-memory list (or the array you pass in, if you prefer to own it —
 * either way, call setItems()/removeItem() to keep things in sync) and
 * calls your hooks so the host page can persist changes.
 */

(function () {
  'use strict';

  if (window.__droboardLibrary) return;
  window.__droboardLibrary = true;

  // ══════════════════════════════════════════════════════════════════════
  // CSS  (dlb- prefixed, self-contained — same responsive grid trick as
  // the original library.html: explicit grid-template-rows on each card
  // so cover/progress/title/author all sit on the same baseline across
  // every card in a row, regardless of how long any text is.)
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .dlb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;box-sizing:border-box;overflow-x:hidden}
    .dlb-card{
      min-width:0;cursor:pointer;transition:.18s;
      display:grid;
      grid-template-rows:auto 4px 16px 13px;
      row-gap:4px;
    }
    .dlb-card:active{transform:scale(.96)}

    .dlb-cover{position:relative;border-radius:9px;overflow:hidden;background:#08090c;aspect-ratio:3/4;box-shadow:0 3px 10px rgba(0,0,0,.5);width:100%}
    .dlb-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .dlb-scrim{position:absolute;bottom:0;left:0;right:0;height:46%;background:linear-gradient(0deg,rgba(0,0,0,.9),transparent)}
    .dlb-cat{position:absolute;top:4px;left:0;font-size:6px;font-weight:800;color:#fff;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);padding:2px 5px 2px 4px;border-radius:0 5px 5px 0;letter-spacing:.02em;white-space:nowrap;max-width:82%;overflow:hidden;text-overflow:ellipsis}
    .dlb-menu-btn{position:absolute;top:3px;right:3px;width:17px;height:17px;border-radius:50%;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;cursor:pointer;z-index:3;flex-shrink:0}
    .dlb-pill{position:absolute;bottom:4px;right:4px;font-size:7px;font-weight:800;padding:2px 5px;border-radius:7px;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);color:#fff;display:flex;align-items:center;gap:2px;white-space:nowrap}
    .dlb-pill.done{background:rgba(52,211,153,.85);color:#052e1e}
    .dlb-pill.saved{background:rgba(255,0,80,.85)}

    .dlb-bar-row{display:flex;align-items:center;min-width:0}
    .dlb-bar{width:100%;height:2.5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
    .dlb-bar-fill{height:100%;background:linear-gradient(90deg,#ff0050,#ff4d7a);border-radius:3px}

    .dlb-title{min-width:0;font-size:9.5px;font-weight:700;line-height:1.3;color:#e8e8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    .dlb-sub{display:flex;align-items:center;gap:3px;min-width:0}
    .dlb-av{width:10px;height:10px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,.07)}
    .dlb-sub span{min-width:0;flex:1;font-size:7.5px;color:#71717a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    .dlb-dots-menu{position:fixed;z-index:1900;background:#13141a;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:5px;min-width:170px;box-shadow:0 8px 32px rgba(0,0,0,.9);display:none}
    .dlb-dots-menu.open{display:block}
    .dlb-dots-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;font-size:12px;font-weight:600;color:#a8b0ba;cursor:pointer;transition:.12s}
    .dlb-dots-item:active{background:rgba(255,255,255,.05);color:#e8e8e8}
    .dlb-dots-item.danger{color:#f87171}
    .dlb-dots-item i{font-size:12px;width:14px;text-align:center}
    .dlb-menu-overlay{position:fixed;inset:0;z-index:1898;display:none}
    .dlb-menu-overlay.on{display:block}

    .dlb-empty{grid-column:1/-1;text-align:center;padding:56px 24px;color:#71717a}
    .dlb-empty i{font-size:36px;margin-bottom:12px;display:block;color:#3f3f46}
    .dlb-empty h4{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:#a8b0ba;margin-bottom:6px}
    .dlb-empty p{font-size:12px;line-height:1.55;max-width:230px;margin:0 auto}

    .dlb-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(16px);background:#13141a;border:1px solid rgba(255,255,255,.07);color:#a8b0ba;padding:8px 18px;border-radius:28px;font-size:12px;font-weight:600;z-index:2200;opacity:0;transition:.28s;pointer-events:none;white-space:nowrap;font-family:'DM Sans',sans-serif}
    .dlb-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'dlb-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('dlbToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dlbToast';
      el.className = 'dlb-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function _resolveEl(target) {
    if (!target) return null;
    return typeof target === 'string' ? document.querySelector(target) : target;
  }

  let _instanceCounter = 0;

  // ══════════════════════════════════════════════════════════════════════
  // attach()
  // ══════════════════════════════════════════════════════════════════════
  function attach(target, options) {
    options = options || {};
    _injectStyles();

    const container = _resolveEl(target);
    if (!container) { console.warn('[DroboardLibrary] Target not found:', target); return null; }

    const instId = 'dlb' + (++_instanceCounter);
    const maxItems = options.maxItems || 0; // 0 = unlimited
    let items = (options.items || []).slice();
    let openMenuId = null;

    const subtitleEl = _resolveEl(options.subtitleEl);
    const footnoteEl = _resolveEl(options.footnoteEl);

    container.innerHTML = `<div class="dlb-grid" id="${instId}-grid"></div>`;
    const gridEl = document.getElementById(instId + '-grid');

    function findItem(id) { return items.find(x => x.id === id); }

    function pillHtml(it) {
      if (it.status === 'reading') return `<div class="dlb-pill">${Math.max(0, Math.min(100, +it.progress || 0))}%</div>`;
      if (it.status === 'completed') return `<div class="dlb-pill done"><i class="fas fa-check" style="font-size:6px"></i> Done</div>`;
      if (it.status === 'saved') return `<div class="dlb-pill saved"><i class="fas fa-bookmark" style="font-size:6px"></i></div>`;
      return '';
    }

    function updateSideLabels() {
      if (subtitleEl) subtitleEl.textContent = `${items.length} saved ${items.length === 1 ? 'story' : 'stories'}`;
      if (footnoteEl) {
        if (!maxItems) {
          footnoteEl.textContent = '';
        } else if (items.length >= maxItems) {
          footnoteEl.textContent = `Your library holds up to ${maxItems} stories — remove one to save something new.`;
        } else {
          const left = maxItems - items.length;
          footnoteEl.textContent = `${left} more ${left === 1 ? 'slot' : 'slots'} free in your library.`;
        }
      }
    }

    function render() {
      updateSideLabels();

      if (!items.length) {
        gridEl.innerHTML = `<div class="dlb-empty"><i class="fas fa-book"></i><h4>Your library is empty</h4><p>Stories you save will show up here.</p></div>`;
        return;
      }

      gridEl.innerHTML = items.map(it => `
        <div class="dlb-card" data-id="${it.id}">
          <div class="dlb-cover">
            <img src="${it.cover || ''}" loading="lazy" alt=""/>
            <div class="dlb-scrim"></div>
            ${it.cat ? `<div class="dlb-cat">${_esc(it.cat)}</div>` : ''}
            <div class="dlb-menu-btn" data-menu="${it.id}"><i class="fas fa-ellipsis-vertical"></i></div>
            ${pillHtml(it)}
          </div>
          <div class="dlb-bar-row">${it.status === 'reading' ? `<div class="dlb-bar"><div class="dlb-bar-fill" style="width:${Math.max(0, Math.min(100, +it.progress || 0))}%"></div></div>` : ''}</div>
          <div class="dlb-title">${_esc(it.title)}</div>
          <div class="dlb-sub">
            ${it.avatar ? `<img class="dlb-av" src="${it.avatar}" loading="lazy" alt=""/>` : ''}
            <span>${it.author ? '@' + _esc(it.author) : ''}${it.author && it.lastCh ? ' · ' : ''}${it.lastCh ? _esc(it.lastCh) : ''}</span>
          </div>
        </div>
      `).join('');

      bindCardEvents();
    }

    function bindCardEvents() {
      gridEl.querySelectorAll('.dlb-card').forEach(card => {
        const id = card.dataset.id;
        card.addEventListener('click', (e) => {
          if (e.target.closest('.dlb-menu-btn')) return;
          const it = findItem(coerceId(id));
          if (!it) return;
          if (typeof options.onOpen === 'function') options.onOpen(it);
          else _toast('📖 Opening story…');
        });
      });
      gridEl.querySelectorAll('.dlb-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openCardMenu(coerceId(btn.dataset.menu), btn);
        });
      });
    }

    // ids may be numeric or string — keep whatever type the host passed in
    function coerceId(rawId) {
      const numeric = items.find(x => String(x.id) === String(rawId));
      return numeric ? numeric.id : rawId;
    }

    // ── Per-card dots menu (Open / Share / Remove) ──
    function closeCardMenu() {
      if (openMenuId !== null) {
        document.getElementById(instId + '-dm-' + openMenuId)?.remove();
        document.getElementById(instId + '-menuov')?.classList.remove('on');
        openMenuId = null;
      }
    }
    function openCardMenu(id, triggerEl) {
      if (openMenuId === id) { closeCardMenu(); return; }
      closeCardMenu();
      openMenuId = id;

      let overlay = document.getElementById(instId + '-menuov');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = instId + '-menuov';
        overlay.className = 'dlb-menu-overlay';
        overlay.addEventListener('click', closeCardMenu);
        document.body.appendChild(overlay);
      }
      overlay.classList.add('on');

      const it = findItem(id);
      const menu = document.createElement('div');
      menu.className = 'dlb-dots-menu open';
      menu.id = instId + '-dm-' + id;
      menu.innerHTML = `
        <div class="dlb-dots-item" data-act="open"><i class="fas fa-book-open"></i> Open story</div>
        <div class="dlb-dots-item" data-act="share"><i class="fas fa-share-nodes"></i> Share</div>
        <div class="dlb-dots-item danger" data-act="remove"><i class="fas fa-trash"></i> Remove from library</div>
      `;
      document.body.appendChild(menu);

      const rect = triggerEl.getBoundingClientRect();
      let top = rect.bottom + 4, left = rect.right - 175;
      if (left < 8) left = 8;
      if (top + 140 > window.innerHeight) top = rect.top - 145;
      menu.style.top = top + 'px';
      menu.style.left = left + 'px';

      menu.querySelectorAll('.dlb-dots-item').forEach(el => {
        el.addEventListener('click', () => { cardMenuAction(el.dataset.act, it); closeCardMenu(); });
      });
    }
    function cardMenuAction(action, it) {
      if (!it) return;
      if (action === 'open') {
        if (typeof options.onOpen === 'function') options.onOpen(it);
        else _toast('📖 Opening story…');
      } else if (action === 'share') {
        if (typeof options.onShare === 'function') {
          options.onShare(it);
        } else if (typeof window.openShareModal === 'function') {
          window.openShareModal({
            title: it.title,
            sub: (it.author ? '@' + it.author : '') + ' · from your library',
            img: it.cover,
            url: it.url || ('https://droboard.app/story/' + it.id),
          });
        } else {
          _toast('📤 Share link copied!');
        }
      } else if (action === 'remove') {
        removeItem(it.id);
        _toast('🗑️ Removed from library');
        if (typeof options.onRemove === 'function') options.onRemove(it);
      }
    }

    // ── Public methods ──
    function setItems(list) { items = (list || []).slice(); render(); }
    function addItem(item) {
      if (maxItems && items.length >= maxItems) { _toast(`Library is full — remove a story first.`); return false; }
      items.push(item);
      render();
      return true;
    }
    function removeItem(id) {
      items = items.filter(x => x.id !== id);
      render();
    }
    function getItems() { return items; }
    function destroy() {
      closeCardMenu();
      container.innerHTML = '';
    }

    render();

    return { setItems, addItem, removeItem, getItems, destroy };
  }

  window.DroboardLibrary = { attach };

})();

/*─── USAGE ──────────────────────────────────────────────────────────────

  <div id="libGrid"></div>
  <script src="component/share-modal.js"></script>  <!-- optional -->
  <script src="component/library.js"></script>
  <script>
    const LIBRARY = [
      { id:1, cover:'...', cat:'💔 Betrayal', title:'...', author:'Ada_Writes',
        avatar:'...', status:'reading', progress:64, lastCh:'S2·Ch4' },
      { id:2, cover:'...', cat:'✨ Twist', title:'...', author:'Ifeanyi_Story',
        avatar:'...', status:'completed', progress:100, lastCh:'Complete' },
    ];

    const lib = DroboardLibrary.attach('#libGrid', {
      items: LIBRARY,
      maxItems: 12,
      subtitleEl: '#libSubtitle',
      footnoteEl: '#libFootnote',
      onOpen(item)  { location.href = 'bridge.html?story=' + item.id; },
      onRemove(item){ console.log('removed', item.id); },
    });
  </script>

───────────────────────────────────────────────────────────────────────*/