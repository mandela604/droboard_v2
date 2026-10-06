/**
 * characters-service.js — owns data + render + bindings for characters.html.
 * TODO backend: GET/POST /api/author/books/:id/characters
 */
(function () {
  'use strict';
  if (window.CharactersService && window.CharactersService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var DEMO = [{ id: 'c1', name: 'Aria Cole', role: 'Protagonist', desc: 'Lead' }, { id: 'c2', name: 'Darius Kane', role: 'Antagonist', desc: 'Obsessive heir' }];

  var ROLES = [
    { id: 'all', label: 'All', count: 6 },
    { id: 'lead', label: 'Lead', count: 2 },
    { id: 'antagonist', label: 'Antagonist', count: 1 },
    { id: 'support', label: 'Support', count: 2 },
    { id: 'minor', label: 'Minor', count: 1 }
  ];

  var CHARACTERS = [
    { name: 'Adrian Cole', role: 'lead', roleLabel: 'Lead', img: 'https://i.pravatar.cc/100?img=12',
      meta: '29 · Anti-hero', tags: ['Ruthless', 'Guarded', 'Business Heir'],
      arc: 'Starts as cold and vengeance-driven; arc ends with him choosing trust and vulnerability over control.',
      chapters: '48 of 56', mentions: '312' },
    { name: 'Elena Marsh', role: 'lead', roleLabel: 'Lead', img: 'https://i.pravatar.cc/100?img=32',
      meta: '27 · Protagonist', tags: ['Guarded', 'Loyal', 'Determined'],
      arc: 'Enters guarded and self-protective after a past betrayal; learns to let someone in without losing herself.',
      chapters: '52 of 56', mentions: '298' },
    { name: 'Victor Cole', role: 'antagonist', roleLabel: 'Antagonist', img: 'https://i.pravatar.cc/100?img=53',
      meta: '58 · Antagonist', tags: ['Manipulative', 'Powerful', 'Secretive'],
      arc: 'Revealed as the true architect of the original scandal; drives the Act III unmasking.',
      chapters: '19 of 56', mentions: '87' },
    { name: 'Josephine Marsh', role: 'support', roleLabel: 'Support', img: 'https://i.pravatar.cc/100?img=45',
      meta: '24 · Support', tags: ['Witty', 'Honest', 'Protective'],
      arc: "Elena's sister; provides the outside perspective that pushes both leads toward honesty.",
      chapters: '22 of 56', mentions: '64' },
    { name: 'Marcus Reyes', role: 'support', roleLabel: 'Support', img: 'https://i.pravatar.cc/100?img=33',
      meta: '41 · Support', tags: ['Loyal', 'Calculated'],
      arc: "The Cole family's longtime lawyer, quietly aware of more than he lets on — his silence becomes a plot point in Act III.",
      chapters: '14 of 56', mentions: '39' },
    { name: 'Grace Cole', role: 'minor', roleLabel: 'Minor', img: 'https://i.pravatar.cc/100?img=49',
      meta: 'Flashback only', tags: ['Flashback', 'Beloved'],
      arc: "Adrian's late mother, seen only in memory — her death is the wound both Cole men are still circling.",
      chapters: '6 of 56', mentions: '21' }
  ];

  var RELATIONSHIPS = [
    { a: 'https://i.pravatar.cc/100?img=12', b: 'https://i.pravatar.cc/100?img=32',
      names: 'Adrian Cole & Elena Marsh', type: 'Forced Fiancés → True Love',
      desc: 'What began as leverage in a family feud slowly becomes the realest thing in either of their lives.' },
    { a: 'https://i.pravatar.cc/100?img=12', b: 'https://i.pravatar.cc/100?img=53',
      names: 'Adrian Cole & Victor Cole', type: 'Father & Son — Estranged',
      desc: "Adrian's drive for control traces directly back to Victor's decades of manipulation." },
    { a: 'https://i.pravatar.cc/100?img=32', b: 'https://i.pravatar.cc/100?img=45',
      names: 'Elena Marsh & Josephine Marsh', type: 'Sisters — Protective',
      desc: 'Josephine is the only person Elena lets see her unguarded.' },
    { a: 'https://i.pravatar.cc/100?img=53', b: 'https://i.pravatar.cc/100?img=33',
      names: 'Victor Cole & Marcus Reyes', type: 'Long-Time Conspirators',
      desc: 'Marcus has covered for Victor for twenty years — until his conscience starts to slip in Act III.' }
  ];

  var activeRole = 'all';
  var selectedRole = 'lead';
  var charTags = [];

  function renderRoleFilter() {
    document.getElementById('roleFilter').innerHTML = ROLES.map(function (r) {
      return '<button class="role-chip ' + (r.id === activeRole ? 'active' : '') + '" data-role="' + r.id + '">' + r.label + ' <span class="ct">' + r.count + '</span></button>';
    }).join('');
    document.querySelectorAll('.role-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        activeRole = chip.dataset.role;
        renderRoleFilter();
        renderCharacters();
      });
    });
  }

  function renderCharacters() {
    var filtered = activeRole === 'all' ? CHARACTERS : CHARACTERS.filter(function (c) { return c.role === activeRole; });
    document.getElementById('characterList').innerHTML = filtered.map(function (c, i) {
      return '<div class="character-card fade" style="animation-delay:' + (i * 0.03) + 's" onclick="location.href=\'character-profile.html\'">'
        + '<div class="cc-avatar"><img src="' + c.img + '" alt="' + c.name + '"/></div>'
        + '<div class="cc-body"><div class="cc-top-row"><span class="cc-name">' + c.name + '</span><span class="cc-role ' + c.role + '">' + c.roleLabel + '</span></div>'
        + '<div class="cc-meta">' + c.meta + '</div><div class="cc-arc">' + c.arc + '</div>'
        + '<div class="cc-tags">' + c.tags.map(function (t) { return '<span class="cc-tag">' + t + '</span>'; }).join('') + '</div>'
        + '<div class="cc-stats"><span class="cc-stat"><i class="fas fa-book-open"></i> ' + c.chapters + '</span>'
        + '<span class="cc-stat"><i class="fas fa-quote-right"></i> ' + c.mentions + ' mentions</span></div></div>'
        + '<i class="fas fa-chevron-right cc-chev"></i></div>';
    }).join('');
    document.getElementById('emptyState').classList.toggle('show', filtered.length === 0);
  }

  function renderRelationships() {
    document.getElementById('relList').innerHTML = RELATIONSHIPS.map(function (r) {
      return '<div class="rel-card fade"><div class="rel-avatars"><img class="rel-av" src="' + r.a + '" alt=""/><img class="rel-av" src="' + r.b + '" alt=""/></div>'
        + '<div class="rel-body"><div class="rel-names">' + r.names + '</div><div class="rel-type">' + r.type + '</div><div class="rel-desc">' + r.desc + '</div></div></div>';
    }).join('');
  }

  function openCharModal() {
    document.getElementById('charModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { document.getElementById('charName').focus(); }, 280);
  }
  function closeCharModal() {
    document.getElementById('charModal').classList.remove('open');
    document.body.style.overflow = '';
    resetCharForm();
  }
  function resetCharForm() {
    document.getElementById('charName').value = '';
    document.getElementById('charMeta').value = '';
    document.getElementById('charArc').value = '';
    document.getElementById('charAvatar').value = '';
    document.getElementById('charTagInput').value = '';
    charTags = [];
    selectedRole = 'lead';
    document.getElementById('avatarPreview').classList.remove('has-img');
    document.getElementById('avatarPreview').innerHTML = '<i class="fas fa-user"></i>';
    document.querySelectorAll('#rolePicks .role-pick').forEach(function (p) {
      p.classList.toggle('active', p.dataset.role === 'lead');
    });
    renderCharTags();
  }
  function renderCharTags() {
    document.getElementById('charTagList').innerHTML = charTags.map(function (t, i) {
      return '<span class="tag-item">' + t + '<button type="button" data-i="' + i + '" aria-label="Remove"><i class="fas fa-xmark"></i></button></span>';
    }).join('');
    document.querySelectorAll('#charTagList button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        charTags.splice(+btn.dataset.i, 1);
        renderCharTags();
      });
    });
  }
  function addCharTag() {
    var inp = document.getElementById('charTagInput');
    var v = inp.value.trim();
    if (!v || charTags.includes(v) || charTags.length >= 8) return;
    charTags.push(v);
    inp.value = '';
    renderCharTags();
  }

  function bindModal() {
    document.querySelector('.new-character-btn').addEventListener('click', openCharModal);
    document.getElementById('charModalClose').addEventListener('click', closeCharModal);
    document.getElementById('charModalCancel').addEventListener('click', closeCharModal);
    document.getElementById('charModal').addEventListener('click', function (e) { if (e.target === document.getElementById('charModal')) closeCharModal(); });
    document.querySelectorAll('#rolePicks .role-pick').forEach(function (p) {
      p.addEventListener('click', function () {
        selectedRole = p.dataset.role;
        document.querySelectorAll('#rolePicks .role-pick').forEach(function (x) { x.classList.remove('active'); });
        p.classList.add('active');
      });
    });
    document.getElementById('charTagAdd').addEventListener('click', addCharTag);
    document.getElementById('charTagInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addCharTag(); }
    });
    document.getElementById('avatarUrlBtn').addEventListener('click', function () {
      var url = prompt('Paste image URL:');
      if (!url) return;
      document.getElementById('charAvatar').value = url;
      var prev = document.getElementById('avatarPreview');
      prev.classList.add('has-img');
      prev.innerHTML = '<img src="' + url + '" alt=""/>';
    });
    document.getElementById('avatarUploadBtn').addEventListener('click', function () {
      document.getElementById('charAvatarFile').click();
    });
    document.getElementById('charAvatarFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
      var reader = new FileReader();
      reader.onload = function () {
        document.getElementById('charAvatar').value = reader.result;
        var prev = document.getElementById('avatarPreview');
        prev.classList.add('has-img');
        prev.innerHTML = '<img src="' + reader.result + '" alt=""/>';
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('charModalSave').addEventListener('click', function () {
      var name = document.getElementById('charName').value.trim();
      if (!name) {
        document.getElementById('charName').focus();
        document.getElementById('charName').style.borderColor = 'var(--danger)';
        setTimeout(function () { document.getElementById('charName').style.borderColor = ''; }, 1500);
        return;
      }
      var roleLabels = { lead: 'Lead', antagonist: 'Antagonist', support: 'Support', minor: 'Minor' };
      var avatar = document.getElementById('charAvatar').value || ('https://i.pravatar.cc/100?u=' + encodeURIComponent(name));
      CHARACTERS.unshift({
        name: name,
        role: selectedRole,
        roleLabel: roleLabels[selectedRole],
        img: avatar,
        meta: document.getElementById('charMeta').value.trim() || 'New character',
        tags: charTags.length ? charTags.slice() : ['New'],
        arc: document.getElementById('charArc').value.trim() || 'Arc not set yet.',
        chapters: '0 of 56',
        mentions: '0'
      });
      var counts = { all: CHARACTERS.length, lead: 0, antagonist: 0, support: 0, minor: 0 };
      CHARACTERS.forEach(function (c) { if (counts[c.role] !== undefined) counts[c.role]++; });
      ROLES.forEach(function (r) { r.count = counts[r.id] !== undefined ? counts[r.id] : 0; });
      document.querySelector('.characters-title').textContent = 'Characters (' + CHARACTERS.length + ')';
      activeRole = 'all';
      renderRoleFilter();
      renderCharacters();
      closeCharModal();
    });
  }

  function init() {
    renderRoleFilter();
    renderCharacters();
    renderRelationships();
    if (window.AuthorDrawer) { window.AuthorDrawer.render('characters.html'); window.AuthorDrawer.bind(); }
    bindModal();
    if (window.DroboardWorkspaceTabs) window.DroboardWorkspaceTabs.configure({ active: 'characters' });
    if (window.DroboardNav) window.DroboardNav.configure({ active: 'profile' });
  }

  var api = window.CharactersService || {};
  api.list = api.list || async function (bookId) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/characters'); if (r.ok) return await r.json(); } catch (e) {} } await delay(); return clone(DEMO); };
  api.getRelationships = api.getRelationships || async function (bookId) { await delay(80); return [{ from: 'Aria Cole', to: 'Darius Kane', type: 'Complicated' }]; };
  api.save = api.save || async function (bookId, data) {
    if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (r.ok) return await r.json(); } catch (e) {} }
    await delay(200); return Object.assign({ id: 'c' + Date.now() }, data);
  };
  api.init = init;
  api._CHARACTERS = CHARACTERS;
  api._ROLES = ROLES;
  window.CharactersService = api;
})();
