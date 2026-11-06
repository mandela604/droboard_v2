'use strict';
// Throwaway harness: exercises the LIVE frontend path (USE_API forced true)
// against the exact response shapes the backend smoke run produced.
const fs = require('fs');
const path = require('path');
const ROOT = require('path').join(__dirname, '..', '..', 'public');

const discoverPayload = {
  topWriters: [
    { id: 'usr_chief_src', handle: 'chiefsrc', name: 'Chief Src', avatar: 'https://example.com/av-chief.jpg', verified: false, followers: 0, books: 14, reads: 23600 },
    { id: 'usr_tw_a', handle: 'twalpha', name: 'Tw Alpha', avatar: 'https://example.com/av-twalpha.jpg', verified: false, followers: 5, books: 1, reads: 9000 },
    { id: 'usr_tw_b', handle: 'twbeta', name: 'Tw Beta', avatar: 'https://example.com/av-twbeta.jpg', verified: false, followers: 500, books: 2, reads: 3000 },
    { id: 'usr_tw_c', handle: 'twgamma', name: 'Tw Gamma', avatar: 'https://example.com/av-twgamma.jpg', verified: false, followers: 9, books: 1, reads: 3000 },
  ],
};
const writersPayload = [
  { handle: 'twalpha', statuses: [
    { id: '000001a1-9ea2-7d30-851c-15b4e1fecf35', bg: 'https://example.com/sa1.jpg', quote: 'Alpha slide one', caption: 'one', time: 'Just now', ts: Date.now(), likes: 0, liked: false, isLive: false, viewed: false, expiresAt: '2026-11-04T00:00:00.000Z' },
    { id: '000001a1-9ea2-7629-b1e1-93435ba8c88f', bg: 'https://example.com/sa2.jpg', quote: 'Alpha slide two', caption: 'two', time: '2h ago', ts: Date.now(), likes: 3, liked: false, isLive: true, viewed: true, expiresAt: '2026-11-04T00:00:00.000Z' },
  ] },
  { handle: 'twbeta', statuses: [] },
  { handle: 'twgamma', statuses: [] },
  { handle: 'ghostwriter', statuses: [] },
];

const calls = [];
global.fetch = function (url, opts) {
  calls.push(String(url));
  let body = {};
  if (String(url).indexOf('/statuses/writers') !== -1) body = writersPayload;
  else if (String(url).indexOf('/feed/discover') !== -1) body = discoverPayload;
  return Promise.resolve({ ok: true, json: function () { return Promise.resolve(body); } });
};

const listeners = {};
global.document = {
  addEventListener: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  getElementById: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return { style: {}, appendChild() {}, setAttribute() {} }; },
  head: { appendChild() {} },
  body: { appendChild() {} },
  documentElement: { setAttribute() {}, style: {} },
};
global.localStorage = {
  _d: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
global.location = { href: '' };
global.window = global;
global.AuthSession = null;

function load(file, forceLive) {
  let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (forceLive) {
    // Flip the demo gate on for the test. A page already wired live needs no
    // flip, so only complain when there is no gate at all.
    src = src.replace('var USE_API = false;', 'var USE_API = true;')
             .replace('const USE_API = false;', 'const USE_API = true;')
             .replace('let USE_API = false;', 'let USE_API = true;');
    if (!/USE_API\s*=\s*true/.test(src)) throw new Error('no live USE_API gate in ' + file);
  }
  const fn = new Function('window', 'document', 'localStorage', 'fetch', 'location', src);
  fn(global.window, global.document, global.localStorage, global.fetch, global.location);
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 220) : ''}`);
}

load('services/status-service.js', true);
load('services/people-service.js', true);

// StatusStore stand-in: the client owns viewed state, keyed like _hKey().
const seen = {};
window.StatusStore = {
  register: function (id, statuses) {
    if (!(statuses || []).length) return 'ring-none';
    const unseen = statuses.filter(function (s) { return !seen[id + '|' + s.id]; }).length;
    return unseen ? 'ring-has' : 'ring-viewed';
  },
  isStatusSeen: function (id, slide) { return !!seen[id + '|' + slide.id]; },
  syncLive: function () {},
  ringOf: function () { return null; },
};

(async function run() {
  const P = window.DroboardPeople, S = window.DroboardStatus;

  // 1. directory comes from the backend ranking, in server order
  P.setLiveWriters(discoverPayload.topWriters);
  const row = P.writersFor('all', 10);
  check('people-service serves the backend-ranked writers, unmodified order',
    row.map(w => w.handle).join(',') === 'chiefsrc,twalpha,twbeta,twgamma', row.map(w => w.handle).join(','));
  check('no fabricated avatar reaches a real handle',
    row.every(w => w.avatar && w.avatar.indexOf('pravatar') === -1), JSON.stringify(row.map(w => w.avatar)));
  check('reads/books/followers ride along for a future label',
    row[1].reads === 9000 && row[1].books === 1 && row[1].followers === 5, JSON.stringify(row[1]));

  // 2. rings come from /api/statuses/writers, not the demo seed
  await S.loadWriters(['@TwAlpha', 'twbeta', 'twgamma', 'ghostwriter']);
  const a = S.writerStatuses('twalpha');
  check('loadWriters resolves the live slides for a handle', a.length === 2 && a[0].bg === 'https://example.com/sa1.jpg', JSON.stringify(a.map(s => s.quote)));
  check('slide ids stay the backend ids (viewer can post /view for them)',
    a.every(s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id)), JSON.stringify(a.map(s => s.id)));
  const b = S.writerStatuses('twbeta');
  check('a live writer with no story gets NO ring, and no demo seed',
    Array.isArray(b) && b.length === 0, JSON.stringify(b));
  check('@ prefix + case normalized before the request', calls.some(u => u.indexOf('handles=twalpha%2Ctwbeta%2Ctwgamma%2Cghostwriter') !== -1 || u.indexOf('handles=twalpha,twbeta,twgamma,ghostwriter') !== -1), JSON.stringify(calls));

  // 3. decorateWriters (what writers-row calls) binds the live lineup
  const decorated = S.decorateWriters(row);
  const chief = decorated.filter(w => w.handle === 'chiefsrc')[0];
  const alpha = decorated.filter(w => w.handle === 'twalpha')[0];
  check('decorated row keeps real avatar + handle for the profile link',
    alpha && alpha.avatar === 'https://example.com/av-twalpha.jpg' && alpha.id === 'wr:twalpha', JSON.stringify(alpha && { id: alpha.id, av: alpha.avatar }));
  check('ring binds to the live slides', alpha && alpha.statuses.length === 2 && alpha.ring === 'ring-has', JSON.stringify(alpha && { n: alpha.statuses.length, ring: alpha.ring }));
  check('a writer with no live story renders ring-none (no invented border)',
    chief && (!chief.statuses || !chief.statuses.length) && chief.ring === 'ring-none', JSON.stringify(chief && { n: (chief.statuses || []).length, ring: chief.ring }));

  // 4. viewed state stays client-side: marking slides seen flips the ring only
  seen['wr:twalpha|' + a[0].id] = true;
  seen['wr:twalpha|' + a[1].id] = true;
  const after = S.decorateWriters([row[1]]);
  check('viewed state comes from StatusStore, not the payload',
    after[0].statuses.every(s => s.viewed) && after[0].ring === 'ring-viewed', JSON.stringify({ ring: after[0].ring, viewed: after[0].statuses.map(s => s.viewed) }));

  // 5. cached handles are never refetched; a cold page fills the directory itself
  calls.length = 0;
  await S.loadWriters(['twalpha']);
  check('an answered handle is served from cache with no second request', calls.length === 0, JSON.stringify(calls));

  const fresh = new Function('window', 'document', 'localStorage', 'fetch', 'location',
    fs.readFileSync(path.join(ROOT, 'services/people-service.js'), 'utf8').replace('const USE_API = false;', 'const USE_API = true;'));
  fresh(global.window, global.document, global.localStorage, global.fetch, global.location);
  const cold = window.DroboardPeople;
  check('a page with no Discover visit starts from the demo pool', cold.writersFor('romance', 3).every(w => String(w.handle).length > 0), JSON.stringify(cold.writersFor('romance', 3).map(w => w.handle)));
  await new Promise(r => setTimeout(r, 30));
  check('writersFor triggers the one-shot directory fetch on a cold page',
    calls.some(u => u.indexOf('/feed/discover') !== -1), JSON.stringify(calls));
  check('after the fetch the same pills show real ranked writers',
    cold.writersFor('all', 4).map(w => w.handle).join(',') === 'chiefsrc,twalpha,twbeta,twgamma', JSON.stringify(cold.writersFor('all', 4).map(w => w.handle)));

  const passed = results.filter(r => r.pass).length;
  console.log(`\n${passed}/${results.length} frontend live-path assertions passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('Fatal:', e && e.stack || e); process.exit(1); });
