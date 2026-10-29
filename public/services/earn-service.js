/* ===============================================================
   DROBOARD EARN SERVICE  (window.DroboardEarn)
   The one start→claim protocol for every "Earn coins" task, shared by the
   store page and the YouTube watch page. The server is the authority: coins,
   cooldown, destination and the required watch time all come from the
   validated EarnReward row, and a task that sends the reader away is paid only
   against the single-use token its own /earn/start handed out.

     DroboardEarn.tap(reward)              one tap on an Earn card
     DroboardEarn.start(code)              open a task, get {token, target, minWatchSec}
     DroboardEarn.claim(code, token)       pay it out (watch pages run their own timer)
     DroboardEarn.pending(code)            {token, at, exp, minWatchSec, coins} | null
     DroboardEarn.waitSec(pending)         seconds the reader still owes
     DroboardEarn.buttonText(reward)       label for the card, or null for a plain "Claim"

   Every call resolves to { kind, ... } with kind one of:
     ok | cooldown | early | restart | gone | auth | error | offline
   so the caller owns the wording and the demo fallback.
   =============================================================== */
(function () {
  'use strict';

  var API = '/api';
  var KEY = 'dro_earn_pending';
  var TOKEN_TTL_MS = 18 * 60 * 1000; // matches the server window

  // Local dev only: with the API down the store can still demo. A production
  // build must never credit coins from the browser, whatever the network does.
  function isLocal() {
    var h = String(location.hostname || '');
    return h === 'localhost' || h === '127.0.0.1' || h === '' || /^192\.168\./.test(h);
  }

  function post(path, body) {
    return fetch(API + path, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        return { ok: res.ok, status: res.status, j: j || {} };
      });
    }).catch(function () { return { ok: false, status: 0, j: {} }; });
  }

  function describe(out) {
    var j = out.j || {};
    if (out.status === 401 || out.status === 403) return { kind: 'auth', msg: 'Sign in to claim coins' };
    if (out.status === 429 || j.error === 'earn_cooldown') return { kind: 'cooldown', retryAfterSec: Number(j.retryAfterSec) || 0 };
    if (j.error === 'earn_too_soon') return { kind: 'early', retryAfterSec: Number(j.retryAfterSec) || 1 };
    if (j.error === 'unknown_reward') return { kind: 'gone', msg: 'This reward is no longer available' };
    if (j.error === 'earn_token' || j.error === 'earn_token_used' || j.error === 'earn_not_started' || j.error === 'earn_expired') {
      return { kind: 'restart', msg: 'Start the task again to earn this' };
    }
    if (!out.ok) return { kind: 'error', msg: j.error || 'Could not reach the earn service' };
    return { kind: 'ok', j: j };
  }

  /* ── the task the reader started but has not been paid for yet ── */
  function all() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; }
    catch (e) { return {}; }
  }
  function pending(code) {
    var p = all()[String(code)];
    if (!p || !p.token) return null;
    if (Date.now() > Number(p.exp || 0)) { clear(code); return null; }
    return p;
  }
  function save(code, token, minWatchSec, coins) {
    var m = all();
    m[String(code)] = {
      token: String(token), at: Date.now(), exp: Date.now() + TOKEN_TTL_MS,
      minWatchSec: Number(minWatchSec) || 0, coins: Number(coins) || 0,
    };
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {}
    return m[String(code)];
  }
  function clear(code) {
    var m = all();
    delete m[String(code)];
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {}
    return m;
  }
  function waitSec(p) {
    if (!p) return 0;
    return Math.max(0, Math.ceil((Number(p.at || 0) + (Number(p.minWatchSec) || 0) * 1000 - Date.now()) / 1000));
  }

  /* ── claim: the server decides the amount, the cooldown and whether the task
        was really performed (valid token + enough time on it) ── */
  function claim(code, token) {
    return post('/wallet/earn', { code: String(code), token: token || undefined }).then(function (out) {
      if (out.status === 0) return { kind: 'offline' };
      var d = describe(out);
      if (d.kind === 'ok') {
        clear(code);
        return { kind: 'ok', coins: Number(d.j.coins) || 0, balance: d.j.balance };
      }
      if (d.kind === 'early') {
        var p = pending(code);
        // The server clock wins: re-anchor so the button counts down from its answer.
        if (p) save(code, p.token, Math.max(Number(p.minWatchSec) || 0, d.retryAfterSec), p.coins);
      }
      if (d.kind === 'cooldown' || d.kind === 'restart') clear(code);
      return d;
    });
  }

  function start(code) {
    return post('/wallet/earn/start', { code: String(code) }).then(function (out) {
      if (out.status === 0) return { kind: 'offline' };
      var d = describe(out);
      if (d.kind !== 'ok') { if (d.kind === 'cooldown') clear(code); return d; }
      var j = d.j;
      if (!j.token) return { kind: 'ok', immediate: true, coins: Number(j.coins) || 0 };
      var p = save(code, j.token, j.minWatchSec, j.coins);
      return { kind: 'ok', pending: p, target: j.target || '', coins: Number(j.coins) || 0 };
    });
  }

  // Destinations come from the server (earn-rules targetFor), so this only ever
  // opens an https link it vetted or an in-app path.
  function go(target) {
    var t = String(target || '');
    if (!t) return;
    if (/^https:\/\//i.test(t)) { window.open(t, '_blank'); return; }
    if (/^[A-Za-z0-9._~!$&'()*+,;=@/?#%:-]+$/.test(t)) { location.href = t; return; }
  }

  function tap(reward) {
    var code = reward && (reward.code || reward.id);
    if (!code) return Promise.resolve({ kind: 'gone', msg: 'This reward is no longer available' });
    // In-app tasks (check-in) pay as they are tapped; anything that sends the
    // reader away needs its start first.
    if (!reward.needsProof) return claim(code, null);
    var p = pending(code);
    if (p && waitSec(p) === 0) return claim(code, p.token);
    return start(code).then(function (r) {
      if (r.kind !== 'ok') return r;
      if (r.immediate) return claim(code, null);
      go(r.target);
      return r;
    });
  }

  function buttonText(reward) {
    var p = pending(reward.code || reward.id);
    if (!p) return null;
    var w = waitSec(p);
    return w > 0 ? 'Back in ' + w + 's' : 'Claim +' + (p.coins || reward.coins);
  }

  window.DroboardEarn = {
    tap: tap, start: start, claim: claim, pending: pending, clear: clear,
    waitSec: waitSec, buttonText: buttonText, isLocal: isLocal, describe: describe, post: post,
  };
})();
