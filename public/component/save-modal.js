/**
 * save-modal.js — Droboard Reusable Save Modal
 * ─────────────────────────────────────────────
 * Drop one <script src="save-modal.js"></script> in any page.
 * Then call:  openSaveModal({ title, sub, img, storyId, type })
 *   type: 'story' (default) → Library row; anything else
 *   ('post', 'repost', 'debate'…) → Save row (Library → Saved section).
 *
 * Exposes globals:
 *   openSaveModal(data)    — opens the save sheet
 *   closeSaveModal()       — closes it
 *   isSaved()              — returns true if anything is saved for current story
 *
 * Production API hooks (optional — set before the script tag):
 *   window.DroboardSaveAPI = {
 *     getSaveState:       async (storyId) => { ok, state:{library,save}, collections:[{id,name,icon,count,saved}] }
 *     toggleQuickSave:    async (storyId, key, value) => { ok }   // key: 'library' | 'save'
 *     toggleCollection:   async (storyId, collId, value) => { ok, count }
 *   }
 *   If DroboardSaveAPI is not defined, falls back to in-memory demo state.
 *   Demo collections come from CollectionData (live inventory) with a
 *   bundled fallback list. "Create new collection" always routes to
 *   profile.html?tab=collections&create=1 — all creation lives there.
 *
 * onSaveChange callback (optional):
 *   window.onDroboardSaveChange = (storyId, isSaved) => { ... }
 *   Called whenever save state changes — use it to update your bookmark icon.
 */

(function () {
  'use strict';

  if (window.__droboardSaveModal) return;
  window.__droboardSaveModal = true;

  // ════════════════════════════════════════════════════════════════════════
  // CSS
  // ════════════════════════════════════════════════════════════════════════
  const CSS = `
    /* ── Save sheet backdrop ── */
    .dsv-bg {
      position: fixed; inset: 0; z-index: 2600;
      background: rgba(0,0,0,.72); backdrop-filter: blur(8px);
      display: none; align-items: flex-end; justify-content: center;
    }
    .dsv-bg.open { display: flex; }

    /* ── Sheet ── */
    .dsv-sheet {
      width: 100%; max-width: 480px;
      background: #0a0a0a;
      border-radius: 20px 20px 0 0;
      border-top: 1px solid rgba(255,255,255,.07);
      animation: dsv-up .28s cubic-bezier(.4,0,.2,1);
      max-height: 88vh; overflow-y: auto; scrollbar-width: none;
      padding-bottom: max(20px, env(safe-area-inset-bottom));
    }
    .dsv-sheet::-webkit-scrollbar { display: none; }

    @keyframes dsv-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    .dsv-handle {
      width: 36px; height: 4px;
      background: rgba(255,255,255,.1);
      border-radius: 4px; margin: 12px auto 0;
    }

    /* ── Header ── */
    .dsv-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px 10px;
    }
    .dsv-hdr h3 { font-size: 14px; font-weight: 800; color: #e0e0e0; margin: 0; }
    .dsv-close {
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.07);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 12px; color: #888; font-family: inherit;
    }
    .dsv-close:hover { background: rgba(255,0,80,.15); color: #ff4d7a; }

    /* ── Section label ── */
    .dsv-section-lbl {
      font-size: 9px; font-weight: 800; color: #555;
      text-transform: uppercase; letter-spacing: .08em;
      padding: 0 16px 8px;
    }

    /* ── Quick save options ── */
    .dsv-opts { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }

    .dsv-opt {
      display: flex; align-items: center; gap: 12px;
      padding: 13px 14px;
      background: rgba(255,255,255,.04);
      border: 1.5px solid rgba(255,255,255,.07);
      border-radius: 11px; cursor: pointer; transition: .18s;
    }
    .dsv-opt:active { transform: scale(.99); border-color: rgba(255,0,80,.3); }
    .dsv-opt.saved  { border-color: rgba(74,222,128,.3); background: rgba(74,222,128,.05); }

    .dsv-opt-icon {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .dsv-opt-body { flex: 1; }
    .dsv-opt-title { font-size: 13px; font-weight: 700; color: #e0e0e0; }
    .dsv-opt-sub   { font-size: 10px; color: #555; margin-top: 1px; }
    .dsv-opt-check { font-size: 16px; color: #555; transition: color .18s; }
    .dsv-opt.saved .dsv-opt-check { color: #4ade80; }

    /* ── Collections ── */
    .dsv-colls { padding: 0 16px; display: flex; flex-direction: column; gap: 7px; }

    .dsv-coll {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 14px;
      background: rgba(255,255,255,.04);
      border: 1.5px solid rgba(255,255,255,.07);
      border-radius: 11px; cursor: pointer; transition: .18s;
    }
    .dsv-coll:active { transform: scale(.99); }
    .dsv-coll.saved {
      border-color: rgba(255,0,80,.3);
      background: rgba(255,0,80,.06);
    }

    .dsv-coll-thumb {
      width: 38px; height: 38px; border-radius: 9px;
      background: rgba(255,255,255,.06);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .dsv-coll-info { flex: 1; }
    .dsv-coll-name  { font-size: 12px; font-weight: 700; color: #e0e0e0; }
    .dsv-coll-count { font-size: 10px; color: #555; margin-top: 1px; }
    .dsv-coll-check { font-size: 15px; color: #555; transition: color .18s; }
    .dsv-coll.saved .dsv-coll-name  { color: #ff4d7a; }
    .dsv-coll.saved .dsv-coll-check { color: #ff4d7a; }

    /* ── New collection button ── */
    .dsv-new-coll {
      display: flex; align-items: center; gap: 8px;
      padding: 11px 14px; margin: 4px 16px 0;
      border: 1.5px dashed rgba(255,255,255,.1);
      border-radius: 11px; cursor: pointer;
      font-size: 12px; font-weight: 700; color: #555;
      transition: .18s;
    }
    .dsv-new-coll:hover { border-color: rgba(255,0,80,.3); color: #ff4d7a; }
    .dsv-new-coll i { font-size: 14px; }

    /* ── Loading skeleton for collections ── */
    .dsv-skeleton {
      height: 62px; border-radius: 11px;
      background: linear-gradient(90deg,
        rgba(255,255,255,.04) 25%,
        rgba(255,255,255,.08) 50%,
        rgba(255,255,255,.04) 75%);
      background-size: 200% 100%;
      animation: dsv-shimmer 1.4s infinite;
      margin: 0 16px 7px;
    }
    @keyframes dsv-shimmer {
      from { background-position: 200% 0; }
      to   { background-position: -200% 0; }
    }

    /* ── Toast ── */
    .dsv-toast {
      position: fixed; bottom: 88px; left: 50%;
      transform: translateX(-50%) translateY(16px);
      background: #111; border: 1px solid rgba(255,255,255,.08);
      color: #e0e0e0; padding: 8px 18px; border-radius: 24px;
      font-size: 12px; font-weight: 600; z-index: 2700;
      opacity: 0; transition: .28s; pointer-events: none;
      white-space: nowrap; font-family: inherit;
    }
    .dsv-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;

  // ════════════════════════════════════════════════════════════════════════
  // HTML
  // ════════════════════════════════════════════════════════════════════════
  const HTML = `
    <!-- ── Save Sheet ── -->
    <div class="dsv-bg" id="dsvBg">
      <div class="dsv-sheet">
        <div class="dsv-handle"></div>

        <div class="dsv-hdr">
          <h3 id="dsvTitle">Save Story</h3>
          <button class="dsv-close" id="dsvClose">✕</button>
        </div>

        <!-- Quick save: Library for stories, Save for everything else -->
        <div class="dsv-section-lbl">Quick Save</div>
        <div class="dsv-opts">

          <div class="dsv-opt" id="dsvOptLibrary" data-key="library">
            <div class="dsv-opt-icon" style="background:rgba(255,0,80,.1)">📚</div>
            <div class="dsv-opt-body">
              <div class="dsv-opt-title">Library</div>
              <div class="dsv-opt-sub">Stories live here</div>
            </div>
            <div class="dsv-opt-check" id="dsvChkLibrary">
              <i class="far fa-circle"></i>
            </div>
          </div>

          <div class="dsv-opt" id="dsvOptSave" data-key="save">
            <div class="dsv-opt-icon" style="background:rgba(96,165,250,.08)">📌</div>
            <div class="dsv-opt-body">
              <div class="dsv-opt-title">Save</div>
              <div class="dsv-opt-sub">Posts, reposts, debates & more</div>
            </div>
            <div class="dsv-opt-check" id="dsvChkSave">
              <i class="far fa-circle"></i>
            </div>
          </div>

        </div>

        <!-- Collections -->
        <div class="dsv-section-lbl" style="margin-top:18px">My Collections</div>
        <div id="dsvCollsWrap"></div>
        <div class="dsv-new-coll" id="dsvNewColl">
          <i class="fas fa-plus"></i> Create new collection
        </div>
      </div>
    </div>

    <div class="dsv-toast" id="dsvToast"></div>
  `;

  // ════════════════════════════════════════════════════════════════════════
  // Constants
  // ════════════════════════════════════════════════════════════════════════
  const QUICK_OPTS = [
    { key: 'library', optId: 'dsvOptLibrary', chkId: 'dsvChkLibrary' },
    { key: 'save',    optId: 'dsvOptSave',    chkId: 'dsvChkSave'    },
  ];

  // Demo collections (shown until backend integration lands).
  const DEMO_COLLECTIONS = [
    { id: 'c1', name: 'Romance Reads',       icon: '💕', count: 14 },
    { id: 'c2', name: 'Weekend Binge',        icon: '📺', count: 8  },
    { id: 'c3', name: 'Tear-jerkers',         icon: '😭', count: 22 },
    { id: 'c4', name: 'Nigerian Narratives',  icon: '🇳🇬', count: 31 },
  ];

  // ════════════════════════════════════════════════════════════════════════
  // Demo in-memory state
  // Keyed by storyId so state is independent per story
  // ════════════════════════════════════════════════════════════════════════
  const _demoState = {};

  function _getDemoState(storyId) {
    if (!_demoState[storyId]) {
      _demoState[storyId] = {
        quickSave: { library: false, save: false },
        collections: DEMO_COLLECTIONS.map(c => ({ ...c, saved: false })),
      };
    }
    return _demoState[storyId];
  }

  // ════════════════════════════════════════════════════════════════════════
  // Module state
  // ════════════════════════════════════════════════════════════════════════
  let _data            = {};
  let _quickSave       = { library: false, save: false };
  let _collections     = [];
  let _loading         = false;
  let _posting         = false;

  function _itemType() {
    const t = String((_data && _data.type) || 'story').toLowerCase();
    return t === 'story' ? 'story' : 'post';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Toast
  // ════════════════════════════════════════════════════════════════════════
  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    const el = document.getElementById('dsvToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Notify host page of save state change
  // ════════════════════════════════════════════════════════════════════════
  function _notifyChange() {
    const saved = _isSaved();
    if (typeof window.onDroboardSaveChange === 'function') {
      window.onDroboardSaveChange(_data.storyId || null, saved);
    }
  }

  function _isSaved() {
    return Object.values(_quickSave).some(Boolean) ||
           _collections.some(c => c.saved);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════
  function _renderQuickSave() {
    // Both rows always show: Library takes stories, Save takes posts,
    // reposts, debates and everything else (Library → Saved section).
    QUICK_OPTS.forEach(({ key, optId, chkId }) => {
      const on = _quickSave[key];
      const opt = document.getElementById(optId);
      const chk = document.getElementById(chkId);
      if (opt) opt.classList.toggle('saved', on);
      if (chk) chk.innerHTML = on
        ? '<i class="fas fa-check-circle"></i>'
        : '<i class="far fa-circle"></i>';
    });
  }

  function _renderCollections() {
    const wrap = document.getElementById('dsvCollsWrap');
    if (!wrap) return;

    if (_loading) {
      wrap.innerHTML = [1, 2, 3].map(() => '<div class="dsv-skeleton"></div>').join('');
      return;
    }

    if (!_collections.length) {
      wrap.innerHTML = `<div style="text-align:center;padding:16px;font-size:11px;color:#444">No collections yet — create one below!</div>`;
      return;
    }

    wrap.innerHTML = _collections.map(c => `
      <div class="dsv-colls">
        <div class="dsv-coll${c.saved ? ' saved' : ''}" data-collid="${c.id}">
          <div class="dsv-coll-thumb">${c.icon}</div>
          <div class="dsv-coll-info">
            <div class="dsv-coll-name">${_esc(c.name)}</div>
            <div class="dsv-coll-count">${c.count} ${c.count === 1 ? 'story' : 'stories'}</div>
          </div>
          <div class="dsv-coll-check">
            ${c.saved
              ? '<i class="fas fa-check-circle"></i>'
              : '<i class="far fa-circle"></i>'}
          </div>
        </div>
      </div>
    `).join('');

    // Bind collection clicks
    wrap.querySelectorAll('.dsv-coll[data-collid]').forEach(el => {
      el.addEventListener('click', () => _toggleCollection(el.dataset.collid));
    });
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ════════════════════════════════════════════════════════════════════════
  // Open / close — save sheet
  // ════════════════════════════════════════════════════════════════════════
  async function openSaveModal(data) {
    _data = data || {};
    _loading = true;
    _renderCollections(); // show skeletons immediately

    document.getElementById('dsvTitle').textContent =
      _itemType() === 'story' ? 'Save Story' : 'Save Post';
    document.getElementById('dsvBg').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Load state: live API first, demo on any failure (no backend yet —
    // a failed fetch must never surface as an error here).
    try {
      let result = null;
      if (window.DroboardSaveAPI && typeof window.DroboardSaveAPI.getSaveState === 'function') {
        try {
          result = await window.DroboardSaveAPI.getSaveState(_data.storyId);
        } catch (e) { result = null; }
      }
      if (result && result.ok) {
        // ── Production ─────────────────────────────────────────────────
        _quickSave   = { library: !!result.state?.library, save: !!result.state?.save };
        _collections = result.collections || [];
      } else {
        // ── Demo ───────────────────────────────────────────────────────
        await new Promise(r => setTimeout(r, 400)); // simulate network
        const demo = _getDemoState(_data.storyId || 'default');
        _quickSave   = { ...demo.quickSave };
        _collections = await _demoCollections();
        // keep per-item saved flags across opens (demo)
        const flagged = {};
        demo.collections.forEach(c => { if (c.saved) flagged[c.id] = true; });
        _collections.forEach(c => { if (flagged[c.id]) c.saved = true; });
      }
    } catch (err) {
      _toast('❌ ' + (err.message || 'Could not load save state'));
    }

    _loading = false;
    _renderQuickSave();
    _renderCollections();
  }

  // Demo collections: live inventory first, bundled demo list as fallback.
  async function _demoCollections() {
    try {
      if (window.CollectionData && typeof window.CollectionData.getCollections === 'function') {
        const live = await window.CollectionData.getCollections();
        if (Array.isArray(live) && live.length) {
          return live.map((c, i) => ({
            id: c.id || ('coll_' + i),
            name: c.name || c.title || 'Collection',
            icon: c.icon || c.emoji || '📁',
            count: c.count || c.stories || 0,
            saved: false,
          }));
        }
      }
    } catch (e) {}
    return DEMO_COLLECTIONS.map(c => ({ ...c, saved: false }));
  }

  function closeSaveModal() {
    document.getElementById('dsvBg').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Toggle quick save option
  // ════════════════════════════════════════════════════════════════════════
  // Demo: mirror the toggle into DemoData so the Library page reflects
  // it immediately in-session (Library row → Library section, Save row
  // → Saved section).
  function _syncLibraryStore(key, on) {
    try {
      const d = window.DemoData;
      if (!d || !_data.storyId) return;
      const item = { id: _data.storyId, title: _data.title, sub: _data.sub, img: _data.img };
      const listName = key === 'save' ? 'SAVED' : 'LIBRARY';
      d[listName] = d[listName] || [];
      const i = d[listName].findIndex(s => s.id === item.id);
      if (on && i === -1) d[listName].unshift(item);
      if (!on && i !== -1) d[listName].splice(i, 1);
    } catch (e) {}
  }

  async function _toggleQuickSave(key) {
    if (_posting) return;
    _posting = true;

    const newVal = !_quickSave[key];

    // Optimistic update
    _quickSave[key] = newVal;
    _renderQuickSave();
    _notifyChange();

    try {
      let ok = false;
      if (window.DroboardSaveAPI && typeof window.DroboardSaveAPI.toggleQuickSave === 'function') {
        try {
          const result = await window.DroboardSaveAPI.toggleQuickSave(_data.storyId, key, newVal);
          ok = !!(result && result.ok);
        } catch (e) { ok = false; }
      }
      if (!ok) {
        // Demo: persist in memory
        await new Promise(r => setTimeout(r, 200));
        const demo = _getDemoState(_data.storyId || 'default');
        demo.quickSave[key] = newVal;
      }

      const labels = { library: 'Library', save: 'Saved' };
      _syncLibraryStore(key, newVal);
      _toast(newVal ? (key === 'library' ? `📌 Saved to Library!` : `📌 Saved! Find it in Library → Saved.`) : `Removed from ${labels[key]}`);
    } catch (err) {
      // Rollback
      _quickSave[key] = !newVal;
      _renderQuickSave();
      _notifyChange();
      _toast('❌ ' + (err.message || 'Something went wrong'));
    }

    _posting = false;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Toggle collection
  // ════════════════════════════════════════════════════════════════════════
  async function _toggleCollection(collId) {
    if (_posting) return;
    _posting = true;

    const coll = _collections.find(c => c.id === collId);
    if (!coll) { _posting = false; return; }

    const newVal = !coll.saved;

    // Optimistic update
    coll.saved  = newVal;
    coll.count += newVal ? 1 : -1;
    _renderCollections();
    _notifyChange();

    try {
      let ok = false;
      if (window.DroboardSaveAPI && typeof window.DroboardSaveAPI.toggleCollection === 'function') {
        try {
          const result = await window.DroboardSaveAPI.toggleCollection(_data.storyId, collId, newVal);
          if (result && result.ok) {
            ok = true;
            if (result.count !== undefined) coll.count = result.count;
            _renderCollections();
          }
        } catch (e) { ok = false; }
      }
      if (!ok) {
        await new Promise(r => setTimeout(r, 200));
        const demo = _getDemoState(_data.storyId || 'default');
        const dc = demo.collections.find(c => c.id === collId);
        if (dc) { dc.saved = newVal; dc.count = coll.count; }
      }

      _toast(newVal ? `📌 Added to "${coll.name}"!` : `Removed from "${coll.name}"`);
    } catch (err) {
      // Rollback
      coll.saved  = !newVal;
      coll.count -= newVal ? 1 : -1;
      _renderCollections();
      _notifyChange();
      _toast('❌ ' + (err.message || 'Something went wrong'));
    }

    _posting = false;
  }

  // ════════════════════════════════════════════════════════════════════════
  // New collection modal
  // ════════════════════════════════════════════════════════════════════════
  // New collections are created ONLY on the profile collection section —
  // this row closes the sheet and takes the user there.
  function _openNewCollection() {
    closeSaveModal();
    window.location.href = 'profile.html?tab=collections&create=1';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Inject
  // ════════════════════════════════════════════════════════════════════════
  function inject() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = HTML.trim();
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    _bindEvents();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Bind events
  // ════════════════════════════════════════════════════════════════════════
  function _bindEvents() {
    // Close
    document.getElementById('dsvClose').addEventListener('click', closeSaveModal);
    document.getElementById('dsvBg').addEventListener('click', function (e) {
      if (e.target === this) closeSaveModal();
    });

    // Quick save opts
    QUICK_OPTS.forEach(({ key, optId }) => {
      document.getElementById(optId).addEventListener('click', () => _toggleQuickSave(key));
    });

    // New collection → profile section
    document.getElementById('dsvNewColl').addEventListener('click', _openNewCollection);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Expose globals
  // ════════════════════════════════════════════════════════════════════════
  window.openSaveModal  = openSaveModal;
  window.closeSaveModal = closeSaveModal;
  window.isSaved        = _isSaved;

  // ════════════════════════════════════════════════════════════════════════
  // Init
  // ════════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

})();