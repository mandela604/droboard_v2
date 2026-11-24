/* ═══════════════════════════════════════════════════════════════
   REWARDED UNLOCK — the ONLY client path that turns watched ads
   into a real chapter Entitlement.

   Every view is started and claimed against /api/wallet/unlock-ad*.
   The server issues a signed token, enforces the minimum watch time,
   counts the ads saved on the chapter's pricing, and books the
   Entitlement. Nothing here grants access locally: onUnlocked is
   only called after the server says the chapter is owned.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var API = '/api/wallet';

  async function post(path, body) {
    var res = await fetch(API + path, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var e = new Error((j && (j.error || j.message)) || ('HTTP ' + res.status));
      e.status = res.status; e.body = j;
      throw e;
    }
    return j;
  }

  function friendly(e) {
    var m = String((e && e.message) || '').toLowerCase();
    if (m.indexOf('ad_too_soon') !== -1) return 'Watch the ad to the end to earn your unlock.';
    if (m.indexOf('ad_expired') !== -1 || m.indexOf('ad_token') !== -1) return 'That ad session expired. Please start again.';
    if (m.indexOf('ad_unlock_disabled') !== -1) return 'This chapter does not allow ad unlocks.';
    if (m.indexOf('free_chapter') !== -1) return 'This chapter is already free.';
    if (m.indexOf('auth') !== -1 || (e && e.status) === 401) return 'Sign in to unlock chapters.';
    return 'Could not complete the ad unlock. Please try again.';
  }

  /* opts: { bookId, chapterId, ads, onProgress(done, required, payload),
             onUnlocked(payload), onError(message) } */
  async function watchAndUnlock(opts) {
    opts = opts || {};
    var bookId = String(opts.bookId || '');
    var chapterId = String(opts.chapterId || '');
    if (!bookId || !chapterId) {
      if (opts.onError) opts.onError('This chapter is not available for ad unlock.');
      return;
    }

    var payload = null;
    try {
      payload = await post('/unlock-ad/start', { bookId: bookId, chapterId: chapterId });
      if (payload.alreadyOwned) {
        if (opts.onUnlocked) opts.onUnlocked(payload);
        return;
      }
      var required = Math.max(1, Number(payload.required) || 1);
      var done = Number(payload.progress) || 0;
      if (opts.onProgress) opts.onProgress(done, required, payload);

      async function next() {
        var st = await post('/unlock-ad/start', { bookId: bookId, chapterId: chapterId });
        if (st.alreadyOwned) { if (opts.onUnlocked) opts.onUnlocked(st); return; }
        if (!window.DroboardRewardedAd) throw new Error('ads_unavailable');
        await new Promise(function (resolve, reject) {
          window.DroboardRewardedAd.show({
            ads: opts.ads || [],
            seconds: Math.max(15, Number(st.minWatchSec) || 15),
            rewardLabel: 'Watch to the end (' + ((Number(st.progress) || 0) + 1) + ' of '
              + (Number(st.required) || required) + ') to unlock this chapter',
            onComplete: resolve,
            onQuit: function () { reject(new Error('Ad not finished — no credit')); },
          });
        });
        var claimed = await post('/unlock-ad', {
          bookId: bookId, chapterId: chapterId, token: st.token,
        });
        if (claimed.unlocked || claimed.alreadyOwned) {
          if (opts.onUnlocked) opts.onUnlocked(claimed);
          return;
        }
        if (opts.onProgress) {
          opts.onProgress(Number(claimed.progress) || 0, Number(claimed.required) || required, claimed);
        }
        return next(); // more ads still required
      }

      await next();
    } catch (e) {
      if (opts.onError) opts.onError(friendly(e));
    }
  }

  // Read-only progress for rendering the paywall label. Does not grant anything.
  async function progress(bookId, chapterId) {
    try {
      var j = await post('/unlock-ad/start', { bookId: String(bookId), chapterId: String(chapterId) });
      return {
        done: j.alreadyOwned ? (Number(j.required) || 1) : (Number(j.progress) || 0),
        required: Math.max(1, Number(j.required) || 1),
        owned: !!j.alreadyOwned,
      };
    } catch (e) {
      return { done: 0, required: 1, owned: false };
    }
  }

  window.RewardedUnlock = { watchAndUnlock: watchAndUnlock, progress: progress };
})();
