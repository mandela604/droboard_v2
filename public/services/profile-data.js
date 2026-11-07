/**
 * services/profile-data.js — Demo Profile API (window.ProfileData)
 * ───────────────────────────────────────────────────────────────
 * DEMO ONLY. UI calls these methods and only renders.
 * Reads/writes in-memory store seeded from data/profile-demo-seed.js,
 * extended on demand from the central USERS directory (DemoData) so any
 * linked user resolves. Posts are returned card-ready (toCardPost) so
 * the profile page never needs adaptPost.
 *
 * When going live: set USE_API = true (API: GET /api/users/:handle with
 * the same shapes), then delete the seed files.
 *
 * Scripts:
 *   services/auth-session.js
 *   data/profile-demo-seed.js
 *   services/profile-data.js
 */
(function (global) {
  'use strict';

  /* Demo sources: profile seed first (approved visuals), central USERS
     directory second (every other user). Live: USE_API → /api/users. */
  const USE_API = true;
  const API_BASE = '/api';

  const seed = global.ProfileDemoSeed;
  if (!seed || !seed.DEMO_PROFILES) {
    console.error('[ProfileData] Load data/profile-demo-seed.js first');
  }

  const GENRES_ALL = (seed && seed.GENRES_ALL) || [];
  const COVERS = (seed && seed.COVERS) || {};
  const STORE = seed ? JSON.parse(JSON.stringify(seed.DEMO_PROFILES)) : {};

  function centralUsers() {
    const d = global.DemoData || {};
    return d.USERS || {};
  }
  /* Merge a central-directory user into the store on first access so all
     mutation APIs work uniformly no matter which demo file they came from. */
  function ensureProfile(key) {
    if (STORE[key]) return STORE[key];
    const cu = centralUsers()[key];
    if (!cu) return null;
    STORE[key] = JSON.parse(JSON.stringify(cu));
    return STORE[key];
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* Live API (credentials = login cookie). Always resolves: {ok, status, json}
     or null on network failure. Callers use unwrap() below. */
  async function api(path, opts) {
    try {
      // A dead backend can leave fetch() pending forever, and every demo page
      // that awaits it then paints a skeleton for good. Bound the wait so an
      // unreachable API falls back to demo instead of hanging the screen.
      const res = await Promise.race([
        fetch(API_BASE + path, Object.assign(
          { credentials: 'include', headers: { 'Content-Type': 'application/json' } },
          opts || {}
        )),
        new Promise((_, reject) => setTimeout(() => reject(new Error('api_timeout')), 2500)),
      ]);
      let json = null;
      try { json = await res.json(); } catch (e) {}
      return { ok: res.ok, status: res.status, json };
    } catch (e) { return null; }
  }
  /* live-or-throw: 2xx -> json; other 4xx/5xx -> throw server message;
     401/network -> null so callers fall back to demo (logged-out/offline). */
  function unwrap(r) {
    if (!r) return null;
    if (r.ok) return r.json;
    if (r.status === 401) return null;
    throw new Error((r.json && (r.json.error || r.json.message)) || ('Request failed (' + r.status + ')'));
  }

  /* Backend collection card -> profile card shape (id/name/count/privacy/
     covers/stories[{id,cover}]) used by collection-card.js + story picker. */
  function backendToProfile(c, pickedStories) {
    const covers = (c.covers && c.covers.length ? c.covers : (pickedStories || []).slice(0, 4).map(s => s.cover));
    const ids = c.storyIds || (c.storyList || []).map(s => s.id || s);
    return {
      id: c.id, name: c.name || c.title, count: c.count != null ? c.count : (c.stories || 0),
      privacy: c.privacy || 'Public', covers: covers || [],
      stories: ids.map((sid, i) => ({ id: String(sid), cover: (covers || [])[i] || '' })),
    };
  }

  function normalizeHandle(handle) {
    return (handle || '').replace(/^@/, '');
  }

  /* Handles are case-insensitive: the backend stores usernames lowercased
     ("you_reader") while demo seeds keep display casing ("You_Reader"). A
     strict === here marks your own profile as someone else's. */
  function sameHandle(a, b) {
    const norm = (h) => String(h || '').trim().replace(/^@/, '').toLowerCase();
    const na = norm(a);
    return !!na && na === norm(b);
  }

  function genreLabel(id) {
    const local = GENRES_ALL.find(g => g.id === id);
    if (local) return local.label;
    const d = global.DemoData || {};
    const central = (d.GENRES || []).find(g => g.id === id);
    return (central && (central.name || central.label)) || id;
  }

  function requireProfile(key) {
    const p = ensureProfile(key);
    if (!p) throw new Error('Profile not found');
    return p;
  }

  function findPost(profile, postId) {
    const post = (profile.posts || []).find(x => x.id === postId);
    if (!post) throw new Error('Post not found');
    return post;
  }

  /** Shape a raw post for post-card.js (UI never does this). */
  function toCardPost(post, profile, isOwner) {
    return Object.assign({}, post, {
      name: profile.name,
      avatar: profile.avatar,
      verified: !!profile.verified,
      type: post.type === 'repost' ? 'recommendation' : post.type,
      mine: !!isOwner,
    });
  }

  /**
   * Generated cover for a demo-created book (title initials on a gradient),
   * so the approved book has art without depending on external assets.
   */
  function flowCover(title) {
    const initials = String(title).split(/\s+/).slice(0, 2)
      .map(w => (w[0] || '').toUpperCase()).join('') || 'B';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ff0050"/><stop offset="1" stop-color="#a78bfa"/>' +
      '</linearGradient></defs>' +
      '<rect width="120" height="160" fill="url(#g)"/>' +
      '<text x="60" y="92" font-family="Arial" font-size="40" font-weight="700" fill="#ffffff" text-anchor="middle">' +
      initials.replace(/[<>&]/g, '') + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /**
   * Clone a profile for the UI: isOwner flag + card-ready posts.
   * STORE stays raw; only the returned copy is adapted.
   */
  async function presentProfile(raw) {
    if (!raw) return null;
    const me = await getCurrentUserHandle();
    const isOwner = sameHandle(raw.handle, me);
    const p = clone(raw);
    p.isOwner = isOwner;
    // Backend owns the isWriter flag — roles are set server-side on approval.
    if (isOwner && !p.isWriter) {
      try {
        const flow = JSON.parse(localStorage.getItem('dro_writer_flow') || 'null');
        if (flow && flow.status === 'approved') {
          p.isWriter = true;
          const t = String(flow.title || '').trim();
          if (t && !(p.books || []).some(b => b.title === t)) {
            p.books = (p.books || []);
            p.books.unshift({
              id: 'me_' + (flow.at || Date.now()),
              title: t,
              cat: flow.genre || 'Fiction',
              cover: flowCover(t),
              reads: '0', likes: '0', rating: 'New',
              status: 'ongoing',
              chapters: Number(flow.chapters) || 1,
            });
            p.stats = p.stats || {};
            p.stats.books = p.books.length;
          }
        }
      } catch (e) {}
    }
    p.posts = (p.posts || []).map(post => toCardPost(post, p, isOwner));
    return p;
  }

  async function getCurrentUserHandle() {
    if (global.AuthSession && AuthSession.getCurrentUserHandle) {
      return AuthSession.getCurrentUserHandle();
    }
    return 'You_Reader';
  }

  async function getProfile(handle) {
    const key = normalizeHandle(handle);
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(key)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Profile API failed: ' + res.status);
    const d = await res.json();
    d.name = d.name || d.fullName || d.username || '';
    d.handle = d.handle || d.username || '';
    d.isOwner = !!d.isOwner;
    return d;
  }

  async function updateProfile(handle, patch) {
    const allowed = ['name', 'fullName', 'bio', 'location', 'avatar', 'cover', 'about'];
    const safe = {};
    allowed.forEach(k => { if (patch && patch[k] !== undefined) safe[k] = patch[k]; });
    const r = await api('/users/me', { method: 'PATCH', body: JSON.stringify(safe) });
    const updated = unwrap(r);
    if (!updated) throw new Error('Update profile failed');
    updated.name = updated.name || updated.fullName || updated.username || '';
    updated.handle = updated.handle || updated.username || '';
    return updated;
  }

  async function updateGenres(handle, genreIds) {
    const key = normalizeHandle(handle);
    const ids = Array.isArray(genreIds) ? genreIds.filter(Boolean) : [];
    const r = await api('/users/me', { method: 'PATCH', body: JSON.stringify({ genres: ids }) });
    if (!unwrap(r)) throw new Error('Update genres failed');
    return getProfile(key);
  }

  async function followUser(handle, targetHandle) {
    const key = normalizeHandle(handle);
    const target = normalizeHandle(targetHandle);
    await api('/users/' + encodeURIComponent(target) + '/follow', { method: 'POST' });
    return getProfile(key);
  }

  async function unfollowUser(handle, targetHandle) {
    const key = normalizeHandle(handle);
    const target = normalizeHandle(targetHandle);
    await api('/users/' + encodeURIComponent(target) + '/follow', { method: 'DELETE' });
    return getProfile(key);
  }

  async function createPost(handle, payload) {
    const key = normalizeHandle(handle);
    const { type = 'post', text = '', quote = '', caption = '', note = '',
      chapterRef = null, storyRef = null, amaData = null, pinned = false,
      image = '', poll = null, debateData = null } = payload || {};
    const body = { type, text, quote, caption, note, chapterRef, storyRef, amaData, pinned, image, poll, debateData };
    const r = await api('/posts', { method: 'POST', body: JSON.stringify(body) });
    if (!unwrap(r)) throw new Error('Create post failed');
    return getProfile(key);
  }

  async function pinPost(handle, postId, pinned) {
    if (pinned === undefined) pinned = true;
    const key = normalizeHandle(handle);
    await api('/posts/' + encodeURIComponent(postId), { method: 'PATCH', body: JSON.stringify({ pinned }) });
    return getProfile(key);
  }

  async function likePost(handle, postId) {
    const key = normalizeHandle(handle);
    await api('/posts/' + encodeURIComponent(postId) + '/like', { method: 'POST' });
    return getProfile(key);
  }

  async function unlikePost(handle, postId) {
    const key = normalizeHandle(handle);
    await api('/posts/' + encodeURIComponent(postId) + '/like', { method: 'DELETE' });
    return getProfile(key);
  }

  async function savePost(handle, postId) {
    const key = normalizeHandle(handle);
    await api('/posts/' + encodeURIComponent(postId) + '/save', { method: 'POST' });
    return getProfile(key);
  }

  async function deletePost(handle, postId) {
    const key = normalizeHandle(handle);
    await api('/posts/' + encodeURIComponent(postId), { method: 'DELETE' });
    return getProfile(key);
  }

  async function updatePost(handle, postId, patch) {
    const key = normalizeHandle(handle);
    await delay(200);
    const base = requireProfile(key);
    const post = findPost(base, postId);
    Object.assign(post, patch || {});
    // keep mine flag cleared, presentProfile will re-add
    return presentProfile(base);
  }

  async function becomeWriter(handle, payload) {
    const key = normalizeHandle(handle);
    // Note: This method is NOT used in production workflow.
    // Writer promotion happens ONLY when SE approves book review via senior-editor/reviews/:id/decide endpoint.
    // Backend automatically calls grantWriterRole(submission.authorId) on approval.
    // This demo fallback is only for UI testing.
    const base = requireProfile(key);
    return presentProfile(base);
  }

  async function createCollection(handle, input) {
    const key = normalizeHandle(handle);
    const name = ((input && input.name) || '').trim() || 'Untitled Collection';
    const privacy = (input && input.privacy) || 'Public';
    const stories = (input && Array.isArray(input.stories)) ? input.stories : [];
    const base = requireProfile(key);
    base.collections = base.collections || [];
    // production: persist (POST /api/collections) — 4xx throws, else demo below
    const created = unwrap(await api('/api/collections', {
      method: 'POST',
      body: JSON.stringify({ name, privacy, stories: stories.map(s => (s && s.id) || s) }),
    }));
    if (created && created.id) {
      base.collections.unshift(backendToProfile(created, stories));
      return presentProfile(base);
    }
    await delay(250);
    base.collections.unshift({
      id: 'coll_' + Date.now(),
      name: name,
      count: stories.length,
      privacy: privacy,
      covers: stories.slice(0, 4).map(s => s.cover),
      stories: stories,
    });
    return presentProfile(base);
  }

  async function updateCollection(handle, collId, patch) {
    const key = normalizeHandle(handle);
    const base = requireProfile(key);
    // production: persist (PATCH /api/collections/:id)
    const body = {};
    if (patch && patch.name !== undefined && String(patch.name).trim()) body.name = String(patch.name).trim();
    if (patch && patch.privacy !== undefined) body.privacy = patch.privacy;
    if (patch && Array.isArray(patch.stories)) body.stories = patch.stories.map(s => (s && s.id) || s);
    const saved = unwrap(await api('/api/collections/' + encodeURIComponent(collId), { method: 'PATCH', body: JSON.stringify(body) }));
    if (saved && saved.id) {
      const i = (base.collections || []).findIndex(c => String(c.id) === String(collId));
      const next = backendToProfile(saved, patch && patch.stories);
      if (i !== -1) base.collections[i] = next;
      else (base.collections = base.collections || []).unshift(next);
      return presentProfile(base);
    }
    await delay(250);
    const col = (base.collections || []).find(c => c.id === collId);
    if (!col) throw new Error('Collection not found');
    if (patch && patch.name !== undefined && String(patch.name).trim()) col.name = String(patch.name).trim();
    if (patch && patch.privacy !== undefined) col.privacy = patch.privacy;
    if (patch && Array.isArray(patch.stories)) {
      col.stories = patch.stories;
      col.covers = patch.stories.slice(0, 4).map(s => s.cover);
      col.count = patch.stories.length;
    }
    return presentProfile(base);
  }

  async function deleteCollection(handle, collId) {
    const key = normalizeHandle(handle);
    const base = requireProfile(key);
    // production: persist (DELETE /api/collections/:id); 401/404 -> demo path
    const r = await api('/api/collections/' + encodeURIComponent(collId), { method: 'DELETE' });
    let gone = null;
    if (r && r.ok) gone = r.json;
    else if (r && r.status !== 401 && r.status !== 404) gone = unwrap(r); // throws server message
    if (gone && gone.ok !== false) {
      base.collections = (base.collections || []).filter(c => String(c.id) !== String(collId));
      return presentProfile(base);
    }
    await delay(250);
    base.collections = (base.collections || []).filter(c => String(c.id) !== String(collId));
    return presentProfile(base);
  }

  global.ProfileData = {
    GENRES_ALL: GENRES_ALL,
    getCurrentUserHandle: getCurrentUserHandle,
    getProfile: getProfile,
    updateProfile: updateProfile,
    updateGenres: updateGenres,
    followUser: followUser,
    unfollowUser: unfollowUser,
    createPost: createPost,
    pinPost: pinPost,
    likePost: likePost,
    unlikePost: unlikePost,
    savePost: savePost,
    deletePost: deletePost,
    updatePost: updatePost,
    becomeWriter: becomeWriter,
    createCollection: createCollection,
    updateCollection: updateCollection,
    deleteCollection: deleteCollection,
  };
})(window);