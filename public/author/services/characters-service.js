/**
 * characters-service.js — owns data + render + bindings for characters.html.
 *
 * Real endpoints only: /api/author/books/:id (header) and
 * /api/author/books/:id/characters (CRUD). Every request failure surfaces a
 * retry banner; nothing is seeded locally.
 */
(function () {
  'use strict';
  if (window.CharactersService && window.CharactersService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 8000 };

  var ROLES = [
    { id: 'lead', label: 'Lead' },
    { id: 'antagonist', label: 'Antagonist' },
    { id: 'support', label: 'Support' },
    { id: 'minor', label: 'Minor' }
  ];
  var ROLE_LABEL = { lead: 'Lead', antagonist: 'Antagonist', support: 'Support', minor: 'Minor' };

  var BOOK_ID = null;
  var BOOK = null;
  var CHARACTERS = [];
  var activeRole = 'all';
  var searchQuery = '';
  var editingId = null;
  var selectedRole = 'lead';
  var charTags = [];
  var pendingAvatar = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m) {
    if (window.AuthorDrawer && window.AuthorDrawer.toast) { window.AuthorDrawer.toast(m); return; }
    var t = document.getElementById('toastEl') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toastEl', className: 'toast' }));
    t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }
  function fmtDate(v) {
    var d = new Date(v);
    if (!v || isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtRelative(v) {
    var d = new Date(v);
    if (!v || isNaN(d.getTime())) return '';
    var mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(hrs / 24);
    if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
    return fmtDate(v);
  }

  /* ── API ── */
  async function call(path, opts) {
    opts = opts || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.TIMEOUT_MS);
    var init = Object.assign({ credentials: 'include', signal: controller.signal }, opts);
    if (init.body && typeof init.body !== 'string') {
      init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
      init.body = JSON.stringify(init.body);
    }
    var res;
    try { res = await fetch(CFG.API_BASE + path, init); }
    catch (e) { clearTimeout(timer); throw new Error(e && e.name === 'AbortError' ? 'Request timed out' : 'Network error'); }
    clearTimeout(timer);
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var msg = (body && (body.message || body.error)) || ('Request failed (' + res.status + ')');
      var err = new Error(String(msg).replace(/_/g, ' ')); err.status = res.status; throw err;
    }
    return body;
  }

  var api = window.CharactersService || {};
  api.getBook = async function (bookId) { return await call('/books/' + encodeURIComponent(bookId)); };
  api.listBooks = async function () { return await call('/books'); };
  api.list = async function (bookId) { return await call('/books/' + encodeURIComponent(bookId) + '/characters'); };
  api.create = async function (bookId, data) { return await call('/books/' + encodeURIComponent(bookId) + '/characters', { method: 'POST', body: data }); };
  api.update = async function (bookId, charId, data) { return await call('/books/' + encodeURIComponent(bookId) + '/characters/' + encodeURIComponent(charId), { method: 'PUT', body: data }); };
  api.remove = async function (bookId, charId) { return await call('/books/' + encodeURIComponent(bookId) + '/characters/' + encodeURIComponent(charId), { method: 'DELETE' }); };

  async function resolveBookId() {
    var q = new URLSearchParams(location.search).get('book');
    if (q && q !== 'b1') return q;
    var list = await api.listBooks();
    if (list && list.length) return list[0].id;
    var e = new Error('No books yet'); e.status = 404; throw e;
  }

  /* ── header ── */
  function renderHeader() {
    var title = document.querySelector('.bh-title');
    var genre = document.querySelector('.bh-genre');
    var cover = document.querySelector('.bh-cover img');
    var badge = document.querySelector('.bh-info .status-badge');
    var updated = document.querySelector('.bh-updated');
    var stats = document.querySelector('.bh-stats');
    if (!BOOK) return;
    document.title = (BOOK.title || 'Book') + ' · Characters · Droboard';
    if (title) title.textContent = BOOK.title || 'Untitled';
    if (genre) genre.textContent = [BOOK.genre, BOOK.category].filter(Boolean).join(' · ') || 'No genre set';
    if (cover) {
      cover.src = BOOK.cover || '../assets/droboard-icon.png';
      cover.alt = BOOK.title || 'Book cover';
      cover.onerror = function () { this.onerror = null; this.src = '../assets/droboard-icon.png'; };
    }
    if (badge) {
      var labels = { published: 'Published', ongoing: 'Ongoing', draft: 'Draft', under_review: 'Under Review', completed: 'Completed', paused: 'Paused', flagged: 'Flagged' };
      badge.textContent = labels[BOOK.status] || BOOK.status || 'Draft';
      badge.className = 'status-badge ' + (BOOK.status === 'under_review' ? 'ongoing' : (BOOK.status || 'draft'));
    }
    if (updated) updated.textContent = BOOK.updatedAt ? 'Updated ' + fmtRelative(BOOK.updatedAt) : '';
    if (stats) {
      var leads = CHARACTERS.filter(function (c) { return c.role === 'lead'; }).length;
      var support = CHARACTERS.filter(function (c) { return c.role === 'support' || c.role === 'antagonist'; }).length;
      stats.innerHTML = '<div class="bh-stat"><i class="fas fa-user-group"></i> ' + CHARACTERS.length + ' Characters</div>'
        + '<div class="bh-stat"><i class="fas fa-crown"></i> ' + leads + ' Leads</div>'
        + '<div class="bh-stat"><i class="fas fa-users"></i> ' + support + ' Supporting</div>';
    }
    var heading = document.querySelector('.characters-title');
    if (heading) heading.textContent = 'Characters (' + CHARACTERS.length + ')';
  }

  /* ── filters + list ── */
  function counts() {
    var out = { all: CHARACTERS.length };
    ROLES.forEach(function (r) {
      out[r.id] = CHARACTERS.filter(function (c) { return c.role === r.id; }).length;
    });
    return out;
  }

  function renderRoleFilter() {
    var c = counts();
    var chips = [{ id: 'all', label: 'All' }].concat(ROLES);
    var el = document.getElementById('roleFilter');
    el.innerHTML = chips.map(function (r) {
      return '<button class="role-chip ' + (r.id === activeRole ? 'active' : '') + '" data-role="' + r.id + '">' + r.label + ' <span class="ct">' + (c[r.id] || 0) + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.role-chip'), function (chip) {
      chip.addEventListener('click', function () {
        activeRole = chip.dataset.role;
        renderRoleFilter();
        renderCharacters();
      });
    });
  }

  function renderCharacters() {
    var listEl = document.getElementById('characterList');
    var emptyEl = document.getElementById('emptyState');
    if (!CHARACTERS.length) {
      listEl.innerHTML = '';
      emptyEl.classList.add('show');
      emptyEl.innerHTML = '<i class="fas fa-user-plus"></i>No characters yet. Add your cast to start tracking roles and arcs.';
      return;
    }
    var filtered = activeRole === 'all' ? CHARACTERS.slice() : CHARACTERS.filter(function (c) { return c.role === activeRole; });
    if (searchQuery) {
      filtered = filtered.filter(function (c) {
        var hay = (c.name + ' ' + (c.meta || '') + ' ' + (c.arc || '') + ' ' + (c.traits || []).join(' ')).toLowerCase();
        return hay.indexOf(searchQuery) !== -1;
      });
    }
    if (!filtered.length) {
      listEl.innerHTML = '';
      emptyEl.classList.add('show');
      emptyEl.innerHTML = '<i class="fas fa-user-large-slash"></i>No characters match this filter.';
      return;
    }
    emptyEl.classList.remove('show');
    listEl.innerHTML = filtered.map(function (c, i) {
      var tags = (c.traits || []).map(function (t) { return '<span class="cc-tag">' + esc(t) + '</span>'; }).join('');
      var avatar = c.avatar || '';
      return '<div class="character-card" style="animation-delay:' + (i * 0.03) + 's" data-id="' + esc(c.id) + '">'
        + '<div class="cc-avatar">' + (avatar
          ? '<img src="' + esc(avatar) + '" alt="' + esc(c.name) + '" onerror="this.style.display=\'none\'"/>'
          : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-2)"><i class="fas fa-user"></i></div>')
        + '</div>'
        + '<div class="cc-body"><div class="cc-top-row"><span class="cc-name">' + esc(c.name) + '</span><span class="cc-role ' + esc(c.role) + '">' + esc(ROLE_LABEL[c.role] || c.role) + '</span></div>'
        + '<div class="cc-meta">' + esc(c.meta || '') + '</div>'
        + (c.arc ? '<div class="cc-arc">' + esc(c.arc) + '</div>' : '')
        + (tags ? '<div class="cc-tags">' + tags + '</div>' : '')
        + '<div class="cc-stats"><span class="cc-stat"><i class="fas fa-users"></i> ' + esc(ROLE_LABEL[c.role] || c.role) + '</span>'
        + ((c.traits || []).length ? '<span class="cc-stat"><i class="fas fa-tags"></i> ' + c.traits.length + ' traits</span>' : '') + '</div></div>'
        + '<i class="fas fa-chevron-right cc-chev"></i></div>';
    }).join('');
    Array.prototype.forEach.call(listEl.querySelectorAll('.character-card'), function (card) {
      card.addEventListener('click', function () { openModal(card.dataset.id); });
    });
  }

  /* ── modal ── */
  function pickRole(role) {
    selectedRole = role;
    Array.prototype.forEach.call(document.querySelectorAll('.role-pick'), function (b) {
      b.classList.toggle('active', b.dataset.role === role);
    });
  }

  function renderTags() {
    document.getElementById('charTagList').innerHTML = charTags.map(function (t, i) {
      return '<span class="tag-item">' + esc(t) + '<button type="button" data-i="' + i + '"><i class="fas fa-xmark"></i></button></span>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#charTagList button'), function (b) {
      b.addEventListener('click', function () {
        charTags.splice(parseInt(b.dataset.i, 10), 1);
        renderTags();
      });
    });
  }

  function addTag() {
    var input = document.getElementById('charTagInput');
    var v = input.value.trim();
    if (!v) return;
    if (charTags.indexOf(v) === -1 && charTags.length < 12) charTags.push(v);
    input.value = '';
    renderTags();
  }

  function setAvatar(url) {
    pendingAvatar = url || '';
    document.getElementById('charAvatar').value = pendingAvatar;
    var preview = document.getElementById('avatarPreview');
    if (pendingAvatar) {
      preview.classList.add('has-img');
      preview.innerHTML = '<img src="' + esc(pendingAvatar) + '" alt="Character avatar" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>';
    } else {
      preview.classList.remove('has-img');
      preview.innerHTML = '<i class="fas fa-user"></i>';
    }
  }

  function openModal(id) {
    editingId = id || null;
    var c = id ? CHARACTERS.filter(function (x) { return String(x.id) === String(id); })[0] : null;
    document.getElementById('charModalTitle').textContent = c ? 'Edit Character' : 'New Character';
    document.getElementById('charName').value = c ? (c.name || '') : '';
    document.getElementById('charMeta').value = c ? (c.meta || '') : '';
    document.getElementById('charArc').value = c ? (c.arc || '') : '';
    charTags = c && c.traits ? c.traits.slice() : [];
    renderTags();
    pickRole(c ? (c.role || 'support') : 'lead');
    setAvatar(c ? (c.avatar || '') : '');
    var del = document.getElementById('charDeleteBtn');
    if (del) del.remove();
    if (c) {
      var foot = document.querySelector('.modal-foot');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'charDeleteBtn';
      btn.className = 'modal-btn ghost';
      btn.style.color = 'var(--danger)';
      btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
      btn.addEventListener('click', deleteCurrent);
      foot.insertBefore(btn, foot.firstChild);
    }
    document.getElementById('charModal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('charModal').classList.remove('open');
    editingId = null;
  }

  async function saveCurrent() {
    var name = document.getElementById('charName').value.trim();
    if (!name) { document.getElementById('charName').focus(); toast('Enter a character name'); return; }
    var btn = document.getElementById('charModalSave');
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    var payload = {
      name: name,
      role: selectedRole,
      meta: document.getElementById('charMeta').value.trim(),
      arc: document.getElementById('charArc').value.trim(),
      traits: charTags.slice(),
      avatar: pendingAvatar || ''
    };
    try {
      if (editingId) await api.update(BOOK_ID, editingId, payload);
      else await api.create(BOOK_ID, payload);
      closeModal();
      toast(editingId ? 'Character updated' : 'Character added');
      await reload();
    } catch (e) {
      toast('Could not save: ' + (e.message || 'unknown error'));
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  async function deleteCurrent() {
    if (!editingId) return;
    if (!confirm('Delete this character? This cannot be undone.')) return;
    try {
      await api.remove(BOOK_ID, editingId);
      closeModal();
      toast('Character deleted');
      await reload();
    } catch (e) {
      toast('Could not delete: ' + (e.message || 'unknown error'));
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    var fd = new FormData();
    fd.append('file', file);
    try {
      var res = await fetch('/api/uploads/image', { method: 'POST', credentials: 'include', body: fd });
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error((body && (body.message || body.error)) || ('Upload failed (' + res.status + ')'));
      setAvatar(body.url);
    } catch (e) {
      toast('Upload failed: ' + (e.message || 'unknown error'));
    }
  }

  /* ── load ── */
  async function reload() {
    var results = await Promise.all([api.getBook(BOOK_ID), api.list(BOOK_ID)]);
    BOOK = results[0];
    CHARACTERS = (results[1] || []).slice().sort(function (a, b) {
      var order = { lead: 0, antagonist: 1, support: 2, minor: 3 };
      return (order[a.role] || 9) - (order[b.role] || 9) || String(a.name).localeCompare(String(b.name));
    });
    renderHeader();
    renderRoleFilter();
    renderCharacters();
  }

  function load() {
    reload().then(function () {
      if (window.AuthorFinance) window.AuthorFinance.clearPageError();
    }).catch(function (e) {
      if (window.AuthorFinance) window.AuthorFinance.pageError('Could not load this book\'s characters. ' + (e.message || ''), load);
      else console.error(e);
    });
  }

  /* ── init ── */
  async function init() {
    if (window.AuthorDrawer) { window.AuthorDrawer.render('characters.html'); window.AuthorDrawer.bind(); }
    if (window.AuthorFinance) window.AuthorFinance.mountIdentity();
    if (window.DroboardWorkspaceTabs) window.DroboardWorkspaceTabs.configure({ active: 'characters' });

    document.querySelector('.new-character-btn').addEventListener('click', function () { openModal(null); });
    var filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) filterBtn.addEventListener('click', function () { document.getElementById('roleFilter').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    document.getElementById('charSearch').addEventListener('input', function (e) {
      searchQuery = e.target.value.trim().toLowerCase();
      renderCharacters();
    });
    document.getElementById('charModalClose').addEventListener('click', closeModal);
    document.getElementById('charModalCancel').addEventListener('click', closeModal);
    document.getElementById('charModalSave').addEventListener('click', saveCurrent);
    document.getElementById('charModal').addEventListener('click', function (e) {
      if (e.target === document.getElementById('charModal')) closeModal();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.role-pick'), function (b) {
      b.addEventListener('click', function () { pickRole(b.dataset.role); });
    });
    document.getElementById('charTagAdd').addEventListener('click', addTag);
    document.getElementById('charTagInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    });
    document.getElementById('avatarUploadBtn').addEventListener('click', function () {
      document.getElementById('charAvatarFile').click();
    });
    document.getElementById('charAvatarFile').addEventListener('change', function (e) {
      uploadAvatar(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('avatarUrlBtn').addEventListener('click', function () {
      var url = prompt('Paste the uploaded image URL (https://res.cloudinary.com/…)');
      if (url === null) return;
      setAvatar(url.trim());
    });

    try {
      BOOK_ID = await resolveBookId();
      load();
    } catch (e) {
      if (window.AuthorFinance) window.AuthorFinance.pageError('Could not open a book. ' + (e.message || ''), init);
      else console.error(e);
    }
  }

  api.init = init;
  window.CharactersService = api;
})();
