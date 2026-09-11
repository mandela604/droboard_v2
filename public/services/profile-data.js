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
  const USE_API = false;
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

  function normalizeHandle(handle) {
    return (handle || '').replace(/^@/, '');
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
   * Clone a profile for the UI: isOwner flag + card-ready posts.
   * STORE stays raw; only the returned copy is adapted.
   */
  async function presentProfile(raw) {
    if (!raw) return null;
    const me = await getCurrentUserHandle();
    const isOwner = raw.handle === me;
    const p = clone(raw);
    p.isOwner = isOwner;
    p.posts = (p.posts || []).map(post => toCardPost(post, p, isOwner));
    return p;
  }

  async function getCurrentUserHandle() {
    if (global.AuthSession && AuthSession.getCurrentUserHandle) {
      return AuthSession.getCurrentUserHandle();
    }
    return 'Ada_Writes';
  }

  async function getProfile(handle) {
    const key = normalizeHandle(handle);
    if (USE_API) {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error('Profile API failed');
      return presentProfile(await res.json());
    }
    await delay(180);
    return presentProfile(ensureProfile(key));
  }

  async function updateProfile(handle, patch) {
    const key = normalizeHandle(handle);
    const allowed = ['name', 'bio', 'location', 'avatar', 'cover', 'about'];
    const safe = {};
    allowed.forEach(k => {
      if (patch && patch[k] !== undefined) safe[k] = patch[k];
    });
    await delay(250);
    const base = requireProfile(key);
    if (safe.about !== undefined) {
      base.about = Object.assign({}, base.about || {}, safe.about || {});
      if (Array.isArray(safe.about.favoriteGenres)) {
        base.genres = safe.about.favoriteGenres.slice();
      }
      delete safe.about;
    }
    Object.assign(base, safe);
    return presentProfile(base);
  }

  async function updateGenres(handle, genreIds) {
    const key = normalizeHandle(handle);
    const ids = Array.isArray(genreIds) ? genreIds.filter(Boolean) : [];
    await delay(200);
    const base = requireProfile(key);
    base.genres = ids.slice();
    base.about = base.about || {};
    base.about.favoriteGenres = ids.slice();
    return presentProfile(base);
  }

  async function followUser(handle, targetHandle) {
    const key = normalizeHandle(handle);
    const target = normalizeHandle(targetHandle);
    await delay(200);
    const base = requireProfile(key);
    base.following = base.following || [];
    let row = base.following.find(f => f.name === target);
    if (row) row.following = true;
    else {
      base.following.push({
        name: target,
        av: 'https://i.pravatar.cc/100?u=' + encodeURIComponent(target),
        meta: 'On Droboard',
        following: true,
      });
    }
    base.stats = base.stats || {};
    base.stats.following = base.following.filter(f => f.following).length;
    return presentProfile(base);
  }

  async function unfollowUser(handle, targetHandle) {
    const key = normalizeHandle(handle);
    const target = normalizeHandle(targetHandle);
    await delay(200);
    const base = requireProfile(key);
    base.following = base.following || [];
    const row = base.following.find(f => f.name === target);
    if (row) row.following = false;
    base.stats = base.stats || {};
    base.stats.following = base.following.filter(f => f.following).length;
    return presentProfile(base);
  }

  async function createPost(handle, payload) {
    const key = normalizeHandle(handle);
    const {
      type = 'post', text = '', quote = '', caption = '', note = '',
      chapterRef = null, storyRef = null, amaData = null, pinned = false,
    } = payload || {};
    await delay(300);
    const base = requireProfile(key);
    base.posts = base.posts || [];
    const post = {
      id: 'p_' + Date.now(), type, time: 'Just now', pinned: !!pinned,
      liked: false, likes: 0, comments: 0, saved: false,
      text, quote, caption, note, chapterRef, storyRef, amaData,
    };
    if (pinned) base.posts.forEach(p => { p.pinned = false; });
    base.posts.unshift(post);
    return presentProfile(base);
  }

  async function pinPost(handle, postId, pinned) {
    if (pinned === undefined) pinned = true;
    const key = normalizeHandle(handle);
    await delay(200);
    const base = requireProfile(key);
    const post = findPost(base, postId);
    if (pinned) (base.posts || []).forEach(p => { p.pinned = false; });
    post.pinned = !!pinned;
    if (post.pinned) {
      base.posts = [post].concat(base.posts.filter(p => p.id !== postId));
    }
    return presentProfile(base);
  }

  async function likePost(handle, postId) {
    const key = normalizeHandle(handle);
    await delay(120);
    const base = requireProfile(key);
    const post = findPost(base, postId);
    if (!post.liked) {
      post.liked = true;
      post.likes = (post.likes || 0) + 1;
    }
    return presentProfile(base);
  }

  async function unlikePost(handle, postId) {
    const key = normalizeHandle(handle);
    await delay(120);
    const base = requireProfile(key);
    const post = findPost(base, postId);
    if (post.liked) {
      post.liked = false;
      post.likes = Math.max(0, (post.likes || 0) - 1);
    }
    return presentProfile(base);
  }

  async function savePost(handle, postId, saved) {
    if (saved === undefined) saved = true;
    const key = normalizeHandle(handle);
    await delay(120);
    const base = requireProfile(key);
    const post = findPost(base, postId);
    post.saved = !!saved;
    base.stats = base.stats || {};
    if (saved) base.stats.saved = (base.stats.saved || 0) + 1;
    else base.stats.saved = Math.max(0, (base.stats.saved || 0) - 1);
    return presentProfile(base);
  }

  async function deletePost(handle, postId) {
    const key = normalizeHandle(handle);
    await delay(200);
    const base = requireProfile(key);
    base.posts = (base.posts || []).filter(p => p.id !== postId);
    return presentProfile(base);
  }

  async function becomeWriter(handle, payload) {
    const key = normalizeHandle(handle);
    const firstBookTitle = (payload && payload.firstBookTitle) || 'Untitled';
    const genre = payload && payload.genre;
    await delay(400);
    const base = requireProfile(key);
    base.isWriter = true;
    base.verified = true;
    base.stats = base.stats || {};
    base.stats.books = (base.stats.books || 0) + 1;
    base.books = base.books || [];
    base.books.unshift({
      id: 'new_' + Date.now(),
      title: firstBookTitle,
      cat: genreLabel(genre) || 'Story',
      cover: COVERS.c5 || '',
      reads: '0',
      likes: '0',
      rating: '—',
      chapters: 1,
    });
    base.achievements = base.achievements || [];
    if (!base.achievements.some(a => a.label === 'Verified Writer')) {
      base.achievements.unshift({ label: 'Verified Writer', cls: 'blue' });
    }
    return presentProfile(base);
  }

  async function createCollection(handle, input) {
    const key = normalizeHandle(handle);
    const name = ((input && input.name) || '').trim() || 'Untitled Collection';
    const privacy = (input && input.privacy) || 'Public';
    const stories = (input && Array.isArray(input.stories)) ? input.stories : [];
    await delay(250);
    const base = requireProfile(key);
    base.collections = base.collections || [];
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
    await delay(250);
    const base = requireProfile(key);
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
    await delay(250);
    const base = requireProfile(key);
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
    becomeWriter: becomeWriter,
    createCollection: createCollection,
    updateCollection: updateCollection,
    deleteCollection: deleteCollection,
  };
})(window);