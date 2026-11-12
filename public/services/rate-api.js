/* ═══════════════════════════════════════════════════════════════
   RATE API — window.DroboardRateAPI (rate-modal.js live contract)

     getRating(storyId)                  -> { ok, mine, avg, count }
     submitRate(storyId, {stars,text,spoiler}) -> { ok, mine, avg, count }

   Backend: GET/POST /api/stories/:id/rating (dro_access cookie auth).
   Saving a rating with text also upserts a feed review post
   (type:'review', storyRef, score, reviewText) — see
   backend/src/services/ratings.service.js syncReviewPost().

   Demo: leave USE_API=false → rate-modal keeps its in-memory fallback.
   Live: set USE_API=true.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BASE = '/api/stories';

  if (window.DroboardRateAPI) return;

  function url(storyId) {
    return BASE + '/' + encodeURIComponent(storyId) + '/rating';
  }

  window.DroboardRateAPI = {
    getRating: function (storyId) {
      return fetch(url(storyId), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return r.ok ? j : Object.assign({ ok: false }, j);
        });
      });
    },
    submitRate: function (storyId, payload) {
      return fetch(url(storyId), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          stars: payload.stars,
          text: payload.text || '',
          spoiler: !!payload.spoiler,
        }),
      }).then(function (r) {
        // Normalize non-2xx: the error handler answers {error:'not_enough_reading'}
        // with no ok flag, so callers must see ok:false to avoid a false success.
        return r.json().catch(function () { return {}; }).then(function (j) {
          return r.ok ? j : Object.assign({ ok: false }, j);
        });
      });
    },
  };
})();
