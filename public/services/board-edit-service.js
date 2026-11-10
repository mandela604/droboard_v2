/* ═══════════════════════════════════════════════════════════════
   BOARD EDIT SERVICE — call-and-render for board-edit.html
   Full board editor: details, rules CRUD, moderators.
   Live: uses /api/chief/categories/:id for CRUD, /api/users for user search.
   URL: board-edit.html?board=<id>
══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';
  const params = new URLSearchParams(location.search);
  const DEFAULT_ID = 'fantasy';
  const GENRE_ID = (params.get('board') || DEFAULT_ID).toLowerCase();

  let GENRE = null;      // genre data from API
  let RULES = [];        // ['rule text', …]
  let MODS = [];         // [{handle,name,av,role:'Moderator',at}]
  let COVER_DATA = '';   // uploaded cover dataURL (replaces URL field)
  let USER_POOL = [];    // user search results

  function toast(msg, dur) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, dur || 2000);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ══ DATA LAYER — Live API ══ */
  async function loadHub() {
    try {
      const r = await fetch(API_BASE + '/genres/' + encodeURIComponent(GENRE_ID), { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        GENRE = data.genre || data.data || data;
      } else {
        GENRE = { id: GENRE_ID, name: GENRE_ID.charAt(0).toUpperCase() + GENRE_ID.slice(1), tagline: '', icon: 'fa-star', cover: '', blurb: '' };
      }
    } catch (e) {
      GENRE = { id: GENRE_ID, name: GENRE_ID.charAt(0).toUpperCase() + GENRE_ID.slice(1), tagline: '', icon: 'fa-star', cover: '', blurb: '' };
    }
  }

  async function loadRules() {
    try {
      const r = await fetch(API_BASE + '/genres/' + encodeURIComponent(GENRE_ID), { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        RULES = (data.genre && data.genre.rules) || [];
      }
    } catch (e) {}
  }

  async function saveDetails() {
    const name = document.getElementById('dName').value.trim() || GENRE.name;
    const tagline = document.getElementById('dTagline').value.trim();
    const icon = document.getElementById('dIcon').value.trim() || GENRE.icon;
    const blurb = document.getElementById('dBlurb').value.trim();
    
    const patch = { name, tagline, icon, blurb };
    if (COVER_DATA) patch.cover = COVER_DATA;

    try {
      const r = await fetch(API_BASE + '/chief/genres/' + encodeURIComponent(GENRE_ID), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch)
      });
      if (!r.ok) throw new Error('Failed to save');
      GENRE = { ...GENRE, ...patch };
      document.getElementById('tbSub').textContent = GENRE.name + ' · hub editor';
      toast('Hub details saved');
    } catch (e) {
      toast('Failed to save details');
    }
  }

  async function saveRules() {
    const cleanRules = RULES.map(function (r) { return String(r).trim(); }).filter(Boolean);
    try {
      const r = await fetch(API_BASE + '/chief/genres/' + encodeURIComponent(GENRE_ID), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rules: cleanRules })
      });
      if (!r.ok) throw new Error('Failed to save rules');
      RULES = cleanRules;
      renderRules();
      toast('Rules saved');
    } catch (e) {
      toast('Failed to save rules');
    }
  }

  async function loadMods() {
    // Get genre details which includes moderators
    try {
      const r = await fetch(API_BASE + '/genres/' + encodeURIComponent(GENRE_ID), { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        MODS = (data.genre && data.genre.moderators) || [];
      }
    } catch (e) {
      MODS = [];
    }
    return loadUserPool('');
  }

  async function loadUserPool(q) {
    try {
      const url = API_BASE + '/users?q=' + encodeURIComponent(q || '') + '&limit=20';
      const r = await fetch(url, { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        USER_POOL = (data.users || data.items || data.data || []).map(function(u) {
          return { handle: u.handle, name: u.name || u.handle, av: u.avatar || '' };
        });
      }
    } catch (e) {
      USER_POOL = [];
    }
  }

  async function addMod(user) {
    const exists = MODS.some(function(m) { return m.handle === user.handle; });
    if (exists) return;
    MODS.push({ handle: user.handle, name: user.name, av: user.av, role: 'Moderator', at: Date.now() });
    await syncMods();
  }

  async function removeModByHandle(handle) {
    MODS = MODS.filter(function(m) { return m.handle !== handle; });
    await syncMods();
  }

  async function syncMods() {
    try {
      const r = await fetch(API_BASE + '/chief/genres/' + encodeURIComponent(GENRE_ID), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ moderatorIds: MODS.map(function(m) { return m.handle; }) })
      });
      if (!r.ok) throw new Error('Failed to update moderators');
    } catch (e) {}
  }

  async function resetHub() {
    toast('Reset not available in live mode');
  }

  /* ══ RENDER ══ */
  function renderDetails() {
    document.getElementById('dName').value = GENRE.name || '';
    document.getElementById('dTagline').value = GENRE.tagline || '';
    document.getElementById('dIcon').value = GENRE.icon || '';
    document.getElementById('dBlurb').value = GENRE.blurb || '';
    COVER_DATA = '';
    if (GENRE.cover) showCoverPreview(GENRE.cover);
    document.getElementById('tbSub').textContent = GENRE.name + ' · hub editor';
    document.title = 'Edit ' + GENRE.name + ' · DroBoard';
  }
  function renderRules() {
    document.getElementById('rulesList').innerHTML = RULES.length
      ? RULES.map(function (r, i) {
          return '<div class="rule-row"><input class="inp" value="' + esc(r) + '" oninput="updateRule(' + i + ',this.value)"/><div class="row-del" onclick="removeRule(' + i + ')" title="Delete"><i class="fas fa-times"></i></div></div>';
        }).join('')
      : '<div class="empty">No rules yet — add the first one.</div>';
  }
  function renderMods() {
    document.getElementById('modsList').innerHTML = MODS.length
      ? MODS.map(function (m, i) {
          return '<div class="mod-row"><img class="mod-av" src="' + esc(m.av || 'https://i.pravatar.cc/100?img=1') + '" alt=""/><div class="mod-txt"><div class="mod-n">' + esc(m.name || m.handle) + '</div><div class="mod-r">@' + esc(m.handle) + ' · ' + esc(m.role || 'Moderator') + '</div></div><div class="row-del" onclick="removeMod(' + i + ')" title="Remove moderator"><i class="fas fa-user-minus"></i></div></div>';
        }).join('')
      : '<div class="empty">No moderators — add one from the members below.</div>';
  }
  function buildUserPool() {
    // Live swap: GET /api/users?search=… (debounced) instead of a local pool
    const seed = window.GenreDemoSeed;
    const seen = {};
    USER_POOL = [];
    if (seed && seed.DEMO_MEMBERS) {
      Object.keys(seed.DEMO_MEMBERS).forEach(function (gid) {
        seed.DEMO_MEMBERS[gid].forEach(function (m) {
          if (seen[m.handle]) return;
          seen[m.handle] = 1;
          USER_POOL.push({ handle: m.handle, name: m.name, av: m.av });
        });
      });
    }
    // A few extra site-wide accounts so search feels bigger than one hub
    [
      { name: 'You (Reader)', handle: 'You_Reader', av: 'https://i.pravatar.cc/100?img=68' },
      { name: 'Ese_Uyi', handle: 'Ese_Uyi', av: 'https://i.pravatar.cc/100?img=44' },
      { name: 'Samantha Shannon', handle: 'S_Shannon', av: 'https://i.pravatar.cc/100?img=26' },
      { name: 'James Islington', handle: 'J_Islington', av: 'https://i.pravatar.cc/100?img=51' },
    ].forEach(function (m) {
      if (seen[m.handle]) return;
      seen[m.handle] = 1;
      USER_POOL.push(m);
    });
  }
  function searchPool(q) {
    q = String(q || '').toLowerCase().replace(/^@/, '');
    if (!q) return [];
    return USER_POOL.filter(function (u) {
      return u.handle.toLowerCase().indexOf(q) > -1 || (u.name || '').toLowerCase().indexOf(q) > -1;
    }).filter(function (u) {
      return !MODS.some(function (x) { return x.handle === u.handle; });
    }).slice(0, 8);
  }
  function renderPicker(q) {
    const results = searchPool(q);
    const box = document.getElementById('addModPicker');
    if (!String(q || '').trim()) { box.innerHTML = ''; return; }
    box.innerHTML = results.length
      ? results.map(function (m) {
          return '<div class="mod-row"><img class="mod-av" src="' + esc(m.av) + '" alt=""/><div class="mod-txt"><div class="mod-n">' + esc(m.name) + '</div><div class="mod-r" style="color:var(--tx-faint)">@' + esc(m.handle) + '</div></div><button class="pick-add" onclick="addModByHandle(\'' + esc(m.handle) + '\')"><i class="fas fa-plus"></i> Add</button></div>';
        }).join('')
      : '<div class="empty">No one matches "' + esc(q) + '" on Droboard.</div>';
  }

  /* ══ BINDINGS (exported for inline handlers) ══ */
  function showCoverPreview(url) {
    const img = document.getElementById('coverPrev');
    if (url) { img.src = url; img.style.display = ''; } else { img.style.display = 'none'; }
  }
  window.handleCoverFile = function (ev) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = function () {
      COVER_DATA = r.result;
      showCoverPreview(COVER_DATA);
      toast('Cover ready — save to apply');
    };
    r.readAsDataURL(f);
    ev.target.value = '';
  };
  window.saveDetails = saveDetails;
  window.saveRules = saveRules;
  window.addRule = function () {
    if (RULES.length >= 15) { toast('Max 15 rules'); return; }
    RULES.push('');
    renderRules();
    const rows = document.querySelectorAll('#rulesList .rule-row .inp');
    if (rows.length) rows[rows.length - 1].focus();
  };
  window.updateRule = function (i, v) { RULES[i] = v; };
  window.removeRule = function (i) { RULES.splice(i, 1); renderRules(); };
  /* ── Custom confirm modal (replaces instant removal / browser confirm) ── */
  function confirmDialog(opts) {
    var ov = document.getElementById('geConfirmOv');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'geConfirmOv';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(5,6,10,.66);z-index:4000;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .15s';
      ov.innerHTML = '<div style="background:#17181d;border:1px solid rgba(255,255,255,.09);border-radius:16px;max-width:340px;width:100%;padding:22px 20px 18px;box-shadow:0 24px 60px rgba(0,0,0,.5)">' +
        '<h3 id="geConfirmTitle" style="font-size:15.5px;font-weight:800;color:#fff;margin:0 0 8px"></h3>' +
        '<p id="geConfirmBody" style="font-size:13px;line-height:1.6;color:#9aa0ab;margin:0 0 18px"></p>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button id="geConfirmNo" style="padding:9px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#c7ccd6;font-size:12.5px;font-weight:700;cursor:pointer">Cancel</button>' +
        '<button id="geConfirmYes" style="padding:9px 16px;border-radius:10px;border:none;background:#ff0050;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer">Confirm</button>' +
        '</div></div>';
      document.body.appendChild(ov);
    }
    var resolveFn;
    var promise = new Promise(function (res) { resolveFn = res; });
    function close(v) { ov.style.opacity = '0'; setTimeout(function () { ov.style.display = 'none'; }, 150); resolveFn(v); }
    document.getElementById('geConfirmTitle').textContent = opts.title || 'Are you sure?';
    document.getElementById('geConfirmBody').innerHTML = opts.body || '';
    document.getElementById('geConfirmYes').textContent = opts.confirmText || 'Confirm';
    ov.style.display = 'flex';
    requestAnimationFrame(function () { ov.style.opacity = '1'; });
    ov.onclick = function (e) { if (e.target === ov) close(false); };
    document.getElementById('geConfirmNo').onclick = function () { close(false); };
    document.getElementById('geConfirmYes').onclick = function () { close(true); };
    return promise;
  }
  window.removeMod = function (i) {
    const m = MODS[i];
    confirmDialog({
      title: 'Remove moderator?',
      body: '<b>' + (m.name || m.handle) + '</b> will lose moderator access to this hub.',
      confirmText: 'Remove',
    }).then(function (ok) {
      if (!ok) return;
      removeModByHandle(m.handle).then(function() {
        renderMods();
        const q = document.getElementById('modSearch').value;
        if (q) { loadUserPool(q).then(function() { renderPicker(q); }); }
        toast((m.name || m.handle) + ' is no longer a moderator');
      });
    });
  };
  window.searchMods = function (q) { 
    loadUserPool(q).then(function() { renderPicker(q); }); 
  };
  window.addModByHandle = async function (handle) {
    const m = USER_POOL.find(function (x) { return x.handle === handle; });
    if (!m) return;
    await addMod(m);
    renderMods();
    const q = document.getElementById('modSearch').value;
    if (q) { await loadUserPool(q); renderPicker(q); }
    toast(m.name + ' is now a moderator');
  };
  window.resetHub = resetHub;
  window.goStats = function () {
    location.href = 'insights.html?surface=hub&genre=' + encodeURIComponent(GENRE_ID);
  };

  /* ══ INIT ══ */
  loadHub().then(function () {
    renderDetails();
    return Promise.all([loadRules(), loadMods()]);
  }).then(function () {
    renderRules();
    renderMods();
  });
})();
