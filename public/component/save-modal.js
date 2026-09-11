/**
 * save-modal.js — Droboard Reusable Save Modal
 * ─────────────────────────────────────────────
 * Drop one <script src="save-modal.js"></script> in any page.
 * Then call:  openSaveModal({ title, sub, img, storyId })
 *
 * Exposes globals:
 *   openSaveModal(data)    — opens the save sheet
 *   closeSaveModal()       — closes it
 *   isSaved()              — returns true if anything is saved for current story
 *
 * Production API hooks (optional — set before the script tag):
 *   window.DroboardSaveAPI = {
 *     getSaveState:       async (storyId) => { ok, state:{library,fav,later}, collections:[{id,name,icon,count,saved}] }
 *     toggleQuickSave:    async (storyId, key, value) => { ok }
 *     toggleCollection:   async (storyId, collId, value) => { ok, count }
 *     createCollection:   async (storyId, name, icon) => { ok, collection:{id,name,icon,count,saved} }
 *   }
 *   If DroboardSaveAPI is not defined, falls back to in-memory demo state.
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

    /* ════════════════════════════════════════
       NEW COLLECTION MODAL
    ════════════════════════════════════════ */
    .dsv-modal-bg {
      position: fixed; inset: 0; z-index: 2610;
      background: rgba(0,0,0,.78); backdrop-filter: blur(10px);
      display: none; align-items: center; justify-content: center;
      padding: 20px;
    }
    .dsv-modal-bg.open { display: flex; }

    .dsv-modal-box {
      background: #0d0d0d;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 20px; padding: 24px 20px;
      width: 100%; max-width: 340px;
      animation: dsv-modal-in .26s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes dsv-modal-in {
      from { opacity: 0; transform: scale(.88) translateY(16px); }
      to   { opacity: 1; transform: scale(1)   translateY(0);    }
    }

    .dsv-modal-title {
      font-size: 16px; font-weight: 800; color: #e0e0e0;
      margin-bottom: 4px; font-family: inherit;
    }
    .dsv-modal-sub {
      font-size: 11px; color: #555; margin-bottom: 18px;
      line-height: 1.5;
    }

    .dsv-modal-lbl {
      font-size: 9px; font-weight: 800; color: #555;
      text-transform: uppercase; letter-spacing: .08em;
      margin-bottom: 6px; display: block;
    }
    .dsv-modal-inp {
      width: 100%; background: rgba(255,255,255,.06);
      border: 1.5px solid rgba(255,255,255,.08);
      border-radius: 10px; padding: 10px 13px;
      color: #e0e0e0; font-family: inherit; font-size: 13px;
      outline: none; margin-bottom: 14px; transition: border-color .2s;
    }
    .dsv-modal-inp:focus { border-color: rgba(255,0,80,.35); }

    .dsv-emoji-row {
      display: flex; gap: 7px; flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .dsv-emoji-btn {
      width: 36px; height: 36px; border-radius: 9px;
      background: rgba(255,255,255,.05);
      border: 1.5px solid rgba(255,255,255,.07);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; cursor: pointer; transition: .15s;
    }
    .dsv-emoji-btn:active { transform: scale(.88); }
    .dsv-emoji-btn.on {
      border-color: rgba(255,0,80,.4);
      background: rgba(255,0,80,.12);
    }

    .dsv-modal-actions { display: flex; gap: 10px; }
    .dsv-modal-cancel {
      flex: 1; padding: 11px; border-radius: 12px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.07);
      font-size: 13px; font-weight: 700; color: #aaa;
      cursor: pointer; font-family: inherit;
    }
    .dsv-modal-confirm {
      flex: 1; padding: 11px; border-radius: 12px;
      background: #ff0050; border: none;
      font-size: 13px; font-weight: 800; color: #fff;
      cursor: pointer; font-family: inherit;
      box-shadow: 0 2px 12px rgba(255,0,80,.3);
    }
    .dsv-modal-confirm:active { transform: scale(.97); }
    .dsv-modal-confirm:disabled {
      background: #1a1a1a; color: #444;
      box-shadow: none; cursor: not-allowed;
    }

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
          <h3>Save Story</h3>
          <button class="dsv-close" id="dsvClose">✕</button>
        </div>

        <!-- Quick save -->
        <div class="dsv-section-lbl">Quick Save</div>
        <div class="dsv-opts">

          <div class="dsv-opt" id="dsvOptLibrary" data-key="library">
            <div class="dsv-opt-icon" style="background:rgba(255,0,80,.1)">📚</div>
            <div class="dsv-opt-body">
              <div class="dsv-opt-title">Library</div>
              <div class="dsv-opt-sub">Your personal reading list</div>
            </div>
            <div class="dsv-opt-check" id="dsvChkLibrary">
              <i class="far fa-circle"></i>
            </div>
          </div>

          <div class="dsv-opt" id="dsvOptFav" data-key="fav">
            <div class="dsv-opt-icon" style="background:rgba(250,204,21,.08)">⭐</div>
            <div class="dsv-opt-body">
              <div class="dsv-opt-title">Favourites</div>
              <div class="dsv-opt-sub">Stories you love most</div>
            </div>
            <div class="dsv-opt-check" id="dsvChkFav">
              <i class="far fa-circle"></i>
            </div>
          </div>

          <div class="dsv-opt" id="dsvOptLater" data-key="later">
            <div class="dsv-opt-icon" style="background:rgba(96,165,250,.08)">🕐</div>
            <div class="dsv-opt-body">
              <div class="dsv-opt-title">Read Later</div>
              <div class="dsv-opt-sub">Finish when you're ready</div>
            </div>
            <div class="dsv-opt-check" id="dsvChkLater">
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

    <!-- ── New Collection Modal ── -->
    <div class="dsv-modal-bg" id="dsvModalBg">
      <div class="dsv-modal-box">
        <div class="dsv-modal-title">📂 New Collection</div>
        <div class="dsv-modal-sub">Give your collection a name and pick an emoji.</div>

        <label class="dsv-modal-lbl">Collection Name</label>
        <input class="dsv-modal-inp" id="dsvCollName"
               placeholder="e.g. Midnight Reads…" maxlength="40"/>

        <label class="dsv-modal-lbl">Pick an Icon</label>
        <div class="dsv-emoji-row" id="dsvEmojiRow"></div>

        <div class="dsv-modal-actions">
          <button class="dsv-modal-cancel" id="dsvModalCancel">Cancel</button>
          <button class="dsv-modal-confirm" id="dsvModalConfirm">Create</button>
        </div>
      </div>
    </div>

    <div class="dsv-toast" id="dsvToast"></div>
  `;

  // ════════════════════════════════════════════════════════════════════════
  // Constants
  // ════════════════════════════════════════════════════════════════════════
  const COLL_EMOJIS = ['📖','💕','😭','🔥','🌙','✨','👑','🏆','💎','🎭','📝','🌟','💔','🕊️','⚡'];

  const QUICK_OPTS = [
    { key: 'library', optId: 'dsvOptLibrary', chkId: 'dsvChkLibrary' },
    { key: 'fav',     optId: 'dsvOptFav',     chkId: 'dsvChkFav'     },
    { key: 'later',   optId: 'dsvOptLater',   chkId: 'dsvChkLater'   },
  ];

  // ════════════════════════════════════════════════════════════════════════
  // Demo in-memory state
  // Keyed by storyId so state is independent per story
  // ════════════════════════════════════════════════════════════════════════
  const _demoState = {};

  function _getDemoState(storyId) {
    if (!_demoState[storyId]) {
      _demoState[storyId] = {
        quickSave: { library: false, fav: false, later: false },
        collections: [
          { id: 'c1', name: 'Romance Reads',       icon: '💕', count: 14, saved: false },
          { id: 'c2', name: 'Weekend Binge',        icon: '📺', count: 8,  saved: false },
          { id: 'c3', name: 'Tear-jerkers',         icon: '😭', count: 22, saved: false },
          { id: 'c4', name: 'Nigerian Narratives',  icon: '🇳🇬', count: 31, saved: false },
        ],
      };
    }
    return _demoState[storyId];
  }

  // ════════════════════════════════════════════════════════════════════════
  // Module state
  // ════════════════════════════════════════════════════════════════════════
  let _data            = {};
  let _quickSave       = { library: false, fav: false, later: false };
  let _collections     = [];
  let _selectedEmoji   = '📖';
  let _loading         = false;
  let _posting         = false;

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

    document.getElementById('dsvBg').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Load state
    try {
      if (window.DroboardSaveAPI && typeof window.DroboardSaveAPI.getSaveState === 'function') {
        // ── Production ─────────────────────────────────────────────────
        const result = await window.DroboardSaveAPI.getSaveState(_data.storyId);
        if (!result || !result.ok) throw new Error(result?.message || 'Failed to load');
        _quickSave   = result.state       || { library: false, fav: false, later: false };
        _collections = result.collections || [];
      } else {
        // ── Demo ───────────────────────────────────────────────────────
        await new Promise(r => setTimeout(r, 400)); // simulate network
        const demo = _getDemoState(_data.storyId || 'default');
        _quickSave   = { ...demo.quickSave };
        _collections = demo.collections.map(c => ({ ...c }));
      }
    } catch (err) {
      _toast('❌ ' + (err.message || 'Could not load save state'));
    }

    _loading = false;
    _renderQuickSave();
    _renderCollections();
  }

  function closeSaveModal() {
    document.getElementById('dsvBg').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Toggle quick save option
  // ════════════════════════════════════════════════════════════════════════
  async function _toggleQuickSave(key) {
    if (_posting) return;
    _posting = true;

    const newVal = !_quickSave[key];

    // Optimistic update
    _quickSave[key] = newVal;
    _renderQuickSave();
    _notifyChange();

    try {
      if (window.DroboardSaveAPI && typeof window.DroboardSaveAPI.toggleQuickSave === 'function') {
        const result = await window.DroboardSaveAPI.toggleQuickSave(_data.storyId, key, newVal);
        if (!result || !result.ok) throw new Error(result?.message || 'Failed');
      } else {
        // Demo: persist in memory
        await new Promise(r => setTimeout(r, 200));
        const demo = _getDemoState(_data.storyId || 'default');
        demo.quickSave[key] = newVal;
      }

      const labels = { library: 'Library', fav: 'Favourites', later: 'Read Later' };
      _toast(newVal ? `📌 Saved to ${labels[key]}!` : `Removed from ${labels[key]}`);
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
      if (window.DroboardSaveAPI && typeof window.DroboardSaveAPI.toggleCollection === 'function') {
        const result = await window.DroboardSaveAPI.toggleCollection(_data.storyId, collId, newVal);
        if (!result || !result.ok) throw new Error(result?.message || 'Failed');
        if (result.count !== undefined) coll.count = result.count;
        _renderCollections();
      } else {
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
  function _openNewCollection() {
    _selectedEmoji = '📖';
    document.getElementById('dsvCollName').value = '';
    document.getElementById('dsvModalConfirm').disabled = true;

    const row = document.getElementById('dsvEmojiRow');
    row.innerHTML = COLL_EMOJIS.map(e =>
      `<div class="dsv-emoji-btn${e === '📖' ? ' on' : ''}" data-emoji="${e}">${e}</div>`
    ).join('');

    row.querySelectorAll('.dsv-emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectedEmoji = btn.dataset.emoji;
        row.querySelectorAll('.dsv-emoji-btn').forEach(b => b.classList.toggle('on', b === btn));
      });
    });

    document.getElementById('dsvModalBg').classList.add('open');
  }

  function _closeNewCollection() {
    document.getElementById('dsvModalBg').classList.remove('open');
  }

  async function _confirmNewCollection() {
    const name = document.getElementById('dsvCollName').value.trim();
    if (!name) { document.getElementById('dsvCollName').focus(); return; }

    const confirmBtn = document.getElementById('dsvModalConfirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Creating…';

    try {
      let newColl;

      if (window.DroboardSaveAPI && typeof window.DroboardSaveAPI.createCollection === 'function') {
        // ── Production ──────────────────────────────────────────────────
        const result = await window.DroboardSaveAPI.createCollection(
          _data.storyId, name, _selectedEmoji
        );
        if (!result || !result.ok) throw new Error(result?.message || 'Failed');
        newColl = result.collection;
      } else {
        // ── Demo ────────────────────────────────────────────────────────
        await new Promise(r => setTimeout(r, 500));
        newColl = { id: 'c_' + Date.now(), name, icon: _selectedEmoji, count: 1, saved: true };
        const demo = _getDemoState(_data.storyId || 'default');
        demo.collections.push({ ...newColl });
      }

      _collections.push(newColl);
      _closeNewCollection();
      _renderCollections();
      _notifyChange();
      _toast(`${_selectedEmoji} "${name}" created!`);
    } catch (err) {
      _toast('❌ ' + (err.message || 'Could not create collection'));
    }

    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Create';
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

    // New collection
    document.getElementById('dsvNewColl').addEventListener('click', _openNewCollection);

    // Modal cancel / confirm / backdrop
    document.getElementById('dsvModalCancel').addEventListener('click', _closeNewCollection);
    document.getElementById('dsvModalConfirm').addEventListener('click', _confirmNewCollection);
    document.getElementById('dsvModalBg').addEventListener('click', function (e) {
      if (e.target === this) _closeNewCollection();
    });

    // Enable confirm button when name is typed
    document.getElementById('dsvCollName').addEventListener('input', function () {
      document.getElementById('dsvModalConfirm').disabled = this.value.trim().length === 0;
    });
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