/**
 * services/profile-data.js — Profile data layer (window.ProfileData)
 * ───────────────────────────────────────────────────────────────
 * Thin, live-only wrapper over the backend. No seed files, no demo
 * store, no fallbacks: every method is a real fetch that throws on
 * failure so pages surface a real error state. Profile counters
 * (followers/following/posts/books) are denormalized on the User row
 * and come back inside GET /api/users/:handle — they are never
 * computed client-side.
 *
 * Routes used:
 *   GET    /api/users/:handle          profile (stats, posts, books, library,
 *                                      collections, following rows, statuses)
 *   PATCH  /api/users/me               genre edits
 *   POST   /api/users/:handle/follow   (+ DELETE) follow / unfollow
 *   POST   /api/posts                  create post
 *   PATCH  /api/posts/:id              edit post / pin / unpin
 *   DELETE /api/posts/:id              delete post
 *   POST   /api/collections            create collection
 *   PATCH  /api/collections/:id        update collection
 *   DELETE /api/collections/:id        delete collection
 *
 * Scripts: services/auth-session.js
 */
(function (global) {
  'use strict';

  const API_BASE = '/api';

  /* Live transport: 2xx → parsed body; anything else throws with the
     server's message (or the status) — callers show it, never paper over it. */
  async function api(path, opts) {
    const res = await fetch(API_BASE + path, Object.assign(
      { credentials: 'include', headers: { 'Content-Type': 'application/json' } },
      opts || {}
    ));
    let json = null;
    try { json = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error((json && (json.error || json.message)) || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      console.error('[profile-data api] FAILED', opts && opts.method || 'GET', path, res.status, json);
      throw err;
    }
    return json;
  }

  function normalizeHandle(handle) {
    return (handle || '').replace(/^@/, '');
  }

  async function getCurrentUserHandle() {
    if (global.AuthSession && AuthSession.getCurrentUserHandle) {
      return AuthSession.getCurrentUserHandle();
    }
    return '';
  }

  /* Public profile — the server decides ownership (isOwner), privacy and
     the viewer's follow flag; posts arrive card-ready (posts.service
     shape) so the page never re-maps them. */
  async function getProfile(handle) {
    const key = normalizeHandle(handle);
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(key)}`, { credentials: 'include' });
    if (!res.ok) {
      const err = new Error('Profile API failed: ' + res.status);
      err.status = res.status;
      throw err;
    }
    const d = await res.json();
    d.name = d.name || d.fullName || d.username || '';
    d.handle = d.handle || d.username || '';
    d.isOwner = !!d.isOwner;
    return d;
  }

  /* Every mutation refetches the profile so counters, lists and the
     post feed all come back from the same authoritative source. */
  function refetch(handle) { return getProfile(handle); }

  async function updateGenres(handle, genreIds) {
    const ids = Array.isArray(genreIds) ? genreIds.filter(Boolean) : [];
    await api('/users/me', { method: 'PATCH', body: JSON.stringify({ genres: ids }) });
    return refetch(handle);
  }

  async function followUser(_handle, targetHandle) {
    return api('/users/' + encodeURIComponent(normalizeHandle(targetHandle)) + '/follow', { method: 'POST' });
  }

  async function unfollowUser(_handle, targetHandle) {
    return api('/users/' + encodeURIComponent(normalizeHandle(targetHandle)) + '/follow', { method: 'DELETE' });
  }

  async function createPost(handle, payload) {
    const { type = 'post', text = '', quote = '', caption = '', note = '',
      chapterRef, storyRef, amaData, pinned = false,
      image = '', poll, debateData } = payload || {};
    const body = { type, pinned: !!pinned };
    if (text) body.text = text;
    if (quote) body.quote = quote;
    if (caption) body.caption = caption;
    if (note) body.note = note;
    if (image) body.image = image;
    if (chapterRef) body.chapterRef = chapterRef;
    if (storyRef) body.storyRef = storyRef;
    if (amaData) body.amaData = amaData;
    if (poll) body.poll = poll;
    if (debateData) body.debateData = debateData;

    console.log('[createPost] sending to POST /api/posts', JSON.stringify(body));
    try {
      const result = await api('/posts', { method: 'POST', body: JSON.stringify(body) });
      console.log('[createPost] success', result);
      return refetch(handle);
    } catch (e) {
      console.error('[createPost] FAILED — status:', e.status, '— message:', e.message);
      throw e;
    }
  }

  async function pinPost(handle, postId, pinned) {
    if (pinned === undefined) pinned = true;
    await api('/posts/' + encodeURIComponent(postId), { method: 'PATCH', body: JSON.stringify({ pinned }) });
    return refetch(handle);
  }

  async function updatePost(handle, postId, patch) {
    await api('/posts/' + encodeURIComponent(postId), { method: 'PATCH', body: JSON.stringify(patch || {}) });
    return refetch(handle);
  }

  async function deletePost(handle, postId) {
    await api('/posts/' + encodeURIComponent(postId), { method: 'DELETE' });
    return refetch(handle);
  }

  async function createCollection(handle, input) {
    const name = ((input && input.name) || '').trim() || 'Untitled Collection';
    const privacy = (input && input.privacy) || 'Public';
    const stories = (input && Array.isArray(input.stories)) ? input.stories : [];
    await api('/collections', {
      method: 'POST',
      body: JSON.stringify({ name, privacy, stories: stories.map(s => (s && s.id) || s) }),
    });
    return refetch(handle);
  }

  async function updateCollection(handle, collId, patch) {
    const body = {};
    if (patch && patch.name !== undefined && String(patch.name).trim()) body.name = String(patch.name).trim();
    if (patch && patch.privacy !== undefined) body.privacy = patch.privacy;
    if (patch && Array.isArray(patch.stories)) body.stories = patch.stories.map(s => (s && s.id) || s);
    await api('/collections/' + encodeURIComponent(collId), { method: 'PATCH', body: JSON.stringify(body) });
    return refetch(handle);
  }

  async function deleteCollection(handle, collId) {
    await api('/collections/' + encodeURIComponent(collId), { method: 'DELETE' });
    return refetch(handle);
  }

  global.ProfileData = {
    getCurrentUserHandle: getCurrentUserHandle,
    getProfile: getProfile,
    updateGenres: updateGenres,
    followUser: followUser,
    unfollowUser: unfollowUser,
    createPost: createPost,
    pinPost: pinPost,
    updatePost: updatePost,
    deletePost: deletePost,
    createCollection: createCollection,
    updateCollection: updateCollection,
    deleteCollection: deleteCollection,
  };
})(window);
