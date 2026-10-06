/**
 * characters-service.js — Data layer for characters.html.
 * TODO backend: GET/POST /api/author/books/:id/characters
 */
(function () {
  'use strict';
  if (window.CharactersService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var DEMO = [{ id: 'c1', name: 'Aria Cole', role: 'Protagonist', desc: 'Lead' }, { id: 'c2', name: 'Darius Kane', role: 'Antagonist', desc: 'Obsessive heir' }];
  window.CharactersService = {
    async list(bookId) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/characters'); if (r.ok) return await r.json(); } catch (e) {} } await delay(); return clone(DEMO); },
    async getRelationships(bookId) { await delay(80); return [{ from: 'Aria Cole', to: 'Darius Kane', type: 'Complicated' }]; },
    async save(bookId, data) {
      if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (r.ok) return await r.json(); } catch (e) {} }
      await delay(200); return Object.assign({ id: 'c' + Date.now() }, data);
    }
  };
})();
