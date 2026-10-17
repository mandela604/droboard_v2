/* ═══════════════════════════════════════════════════════════════
   GENRE HUB EDIT SERVICE — call-and-render for genre-hub-edit.html
   Full hub editor: details, rules CRUD, moderators (staff assigns
   from existing members — no invite links). Demo storage is
   localStorage behind DATA LAYER functions (loadHub/saveDetails/
   loadRules/saveRules/loadMods/saveMods/seedDemoMods/resetHub) —
   at cutover swap those bodies for API calls, nothing else changes.
   URL: genre-hub-edit.html?genre=<id>
══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const DEFAULT_ID = (window.GenreDemoSeed && window.GenreDemoSeed.DEFAULT_GENRE_ID) || 'fantasy';
  const GENRE_ID = (params.get('genre') || DEFAULT_ID).toLowerCase();

  const ABOUT_KEY = 'dro_genre_about_override'; // same key the hub page reads
  const RULES_KEY = 'dro_hub_rules_' + GENRE_ID;
  const MODS_KEY = 'dro_hub_mods_' + GENRE_ID;

  let GENRE = null;      // base seed + about override
  let RULES = [];        // ['rule text', …]
  let MODS = [];         // [{handle,name,av,role:'Moderator',at}]
  let COVER_DATA = '';   // uploaded cover dataURL (replaces URL field)
  let USER_POOL = [];    // every demo user on the site, for mod search

  function toast(msg, dur) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, dur || 2000);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ══ DATA LAYER — demo now, API later ══ */
  function loadHub() {
    // Live swap: fetch GET /api/genre-hubs/<id>
    const seed = window.GenreDemoSeed;
    let base = (seed && seed.DEMO_GENRES && (seed.DEMO_GENRES[GENRE_ID] || seed.DEMO_GENRES[DEFAULT_ID])) || null;
    if (!base) base = { id: 'fantasy', name: 'Fantasy', tagline: 'Where imagination becomes legend.', icon: 'fa-hat-wizard', cover: '', blurb: 'Discuss tropes, argue theories.' };
    let ov = null;
    try { ov = (JSON.parse(localStorage.getItem(ABOUT_KEY) || '{}'))[GENRE_ID] || null; } catch (e) {}
    GENRE = Object.assign({}, base, ov || {});
    return Promise.resolve();
  }
  function loadRules() {
    // Live swap: GET /api/genre-hubs/<id>/rules
    try {
      const r = JSON.parse(localStorage.getItem(RULES_KEY) || 'null');
      if (Array.isArray(r)) { RULES = r; return Promise.resolve(); }
    } catch (e) {}
    // Fallback: split the seed rules-post prose into rule lines
    const seed = window.GenreDemoSeed;
    const pinned = (seed && seed.DEMO_PINNED && (seed.DEMO_PINNED[GENRE_ID] || seed.DEMO_PINNED[DEFAULT_ID])) || null;
    RULES = (pinned && pinned.desc ? pinned.desc.split('.') : [])
      .map(function (s) { return s.trim(); }).filter(Boolean);
    return Promise.resolve();
  }
  function saveDetails() {
    // Live swap: PATCH /api/genre-hubs/<id> (cover: upload to storage first)
    const patch = {
      name: document.getElementById('dName').value.trim() || GENRE.name,
      tagline: document.getElementById('dTagline').value.trim(),
      icon: document.getElementById('dIcon').value.trim() || GENRE.icon,
      cover: COVER_DATA || GENRE.cover || '',
      blurb: document.getElementById('dBlurb').value.trim(),
    };
    try {
      const m = JSON.parse(localStorage.getItem(ABOUT_KEY) || '{}');
      m[GENRE_ID] = Object.assign({}, m[GENRE_ID] || {}, patch);
      localStorage.setItem(ABOUT_KEY, JSON.stringify(m));
    } catch (e) {}
    Object.assign(GENRE, patch);
    document.getElementById('tbSub').textContent = GENRE.name + ' · hub editor';
    toast('Hub details saved');
  }
  function saveRules() {
    // Live swap: PUT /api/genre-hubs/<id>/rules
    RULES = RULES.map(function (r) { return String(r).trim(); }).filter(Boolean);
    try { localStorage.setItem(RULES_KEY, JSON.stringify(RULES)); } catch (e) {}
    renderRules();
    toast('Rules saved');
  }
  function loadMods() {
    // Live swap: GET /api/genre-hubs/<id>/mods
    try { MODS = JSON.parse(localStorage.getItem(MODS_KEY) || 'null') || null; } catch (e) { MODS = null; }
    if (!MODS) MODS = seedDemoMods();
    buildUserPool();
    return Promise.resolve();
  }
  /* Demo seed: first two hub members become moderators until the
     store exists. Live: the server seeds via the admin module. */
  function seedDemoMods() {
    const seed = window.GenreDemoSeed;
    const members = (seed && seed.DEMO_MEMBERS && (seed.DEMO_MEMBERS[GENRE_ID] || seed.DEMO_MEMBERS[DEFAULT_ID])) || [];
    const mods = members.slice(0, 2).map(function (m) {
      return { handle: m.handle, name: m.name, av: m.av, role: 'Moderator', at: Date.now() };
    });
    try { localStorage.setItem(MODS_KEY, JSON.stringify(mods)); } catch (e) {}
    return mods;
  }
  function saveMods() {
    // Live swap: role changes → PATCH /api/…
    try { localStorage.setItem(MODS_KEY, JSON.stringify(MODS)); } catch (e) {}
  }
  function resetHub() {
    // Live swap: DELETE the override set for this hub
    try {
      const m = JSON.parse(localStorage.getItem(ABOUT_KEY) || '{}');
      delete m[GENRE_ID];
      localStorage.setItem(ABOUT_KEY, JSON.stringify(m));
    } catch (e) {}
    localStorage.removeItem(RULES_KEY);
    localStorage.removeItem(MODS_KEY);
    toast('Hub edits reset');
    setTimeout(function () { location.reload(); }, 700);
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
  window.removeMod = function (i) {
    const m = MODS[i];
    MODS.splice(i, 1);
    saveMods();
    renderMods();
    const q = document.getElementById('modSearch').value;
    if (q) renderPicker(q);
    toast((m.name || m.handle) + ' is no longer a moderator');
  };
  window.searchMods = function (q) { renderPicker(q); };
  window.addModByHandle = function (handle) {
    const m = USER_POOL.find(function (x) { return x.handle === handle; });
    if (!m) return;
    MODS.push({ handle: m.handle, name: m.name, av: m.av, role: 'Moderator', at: Date.now() });
    saveMods();
    renderMods();
    const q = document.getElementById('modSearch').value;
    if (q) renderPicker(q);
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
