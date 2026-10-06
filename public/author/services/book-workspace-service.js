/**
 * book-workspace-service.js — Data layer for book-workspace.html.
 * TODO backend: GET /api/author/books/:id, GET /api/author/books/:id/chapters?page=
 */
(function () {
  'use strict';
  if (window.BookWorkspaceService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 180); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  async function callBackend(path, opts) {
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, CFG.TIMEOUT_MS);
    try { var res = await fetch(CFG.API_BASE + path, Object.assign({ signal: c.signal }, opts || {})); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }
  var TITLES = ['The Beginning of Obsession', "The Girl He Shouldn't Want", 'Secrets in the Dark', 'Falling Too Deep', 'The Truth He Hides'];
  function demoChapters() {
    var out = []; for (var i = 0; i < 56; i++) {
      var n = i + 1; var st = n === 56 ? 'draft' : n === 55 ? 'scheduled' : 'published';
      out.push({ num: n, title: TITLES[i % TITLES.length] + ' #' + n, words: 2100 + (i * 37) % 700, status: st, date: 'May ' + (10 + i % 20) + ', 2025', views: st === 'published' ? (45 - i * 0.5).toFixed(1) + 'K' : '–' });
    } return out;
  }
  window.BookWorkspaceService = {
    PAGE_SIZE: 12,
    async getBook(bookId) { if (CFG.USE_API) { try { return await callBackend('/books/' + bookId); } catch (e) {} } await delay(); return { id: bookId || 'b1', title: 'Bound By Obsession', genre: 'Romance · Drama', status: 'published', reads: '2.3M', likes: '189K', updated: 'Updated 2 hours ago', cover: 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=300&h=400&fit=crop' }; },
    async getChapters(bookId, page, pageSize) {
      if (CFG.USE_API) { try { return await callBackend('/books/' + bookId + '/chapters?page=' + page); } catch (e) {} }
      await delay(); var all = demoChapters(); var ps = pageSize || 12;
      return { total: all.length, items: clone(all.slice((page - 1) * ps, page * ps)) };
    }
  };
})();
