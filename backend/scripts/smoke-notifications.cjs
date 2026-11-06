'use strict';
// Notifications live harness.
//
// Boots the real Express app on an in-memory MongoDB, drives real HTTP traffic
// through every /api/notifications endpoint and checks the JSON shape each one
// returns. The point is to answer two questions with data, not opinion:
//   1. Do the routes work end to end (list / unread-count / read / read-all /
//      PATCH /:id / settings GET+PUT)?
//   2. Does the list payload carry every field the notification-page frontend
//      (notification-store.js + notification-item.js) reads when it renders a
//      row?
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime. See smoke-user-counters.cjs.
process.env.NODE_ENV = 'test';
process.env.PORT = '4197';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 4197;
const BASE = 'http://127.0.0.1:' + PORT;
const N = BASE + '/api/notifications';
const OUT = require('path').join(__dirname, 'smoke-notifications.results.txt');

const results = [];
const logLines = [];
function say(s) { logLines.push(s); console.log(s); }
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
  say(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}
function finish() {
  const passed = results.filter(x => x.pass).length;
  say(`\n===== ${passed}/${results.length} notification assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => say(`  FAIL ${f.name} :: ${f.detail}`));
  try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (e) {}
  process.exit(passed === results.length ? 0 : 1);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_notif');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { signAccess } = require('../src/middleware/auth');
  const notifications = require('../src/services/notifications.service');

  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const mk = async (name) => User.create({
    fullName: name, email: `${name}@t.co`, username: name + Date.now() + Math.random(),
    passwordHash: DUMMY, status: 'active', roles: ['reader'],
  });
  const alice = await mk('alice');
  const bob = await mk('bob');

  const tok = (u) => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + signAccess(u) });
  async function call(u, method, url, body) {
    const init = { method, headers: tok(u) };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  /* ── seed a recipient's inbox directly through the service ── */
  await notifications.notify({ recipientId: String(alice.id), actorId: String(bob.id), type: 'like', title: 'Bob liked your post', desc: 'on Chapter 3', link: 'post-77' });
  await notifications.notify({ recipientId: String(alice.id), actorId: String(bob.id), type: 'comment', title: 'Bob commented', desc: 'great twist', link: 'c-991' });
  await notifications.notify({ recipientId: String(alice.id), type: 'payout', title: 'Withdrawal processed', desc: '$1,200 sent', link: 'tx' });

  /* ── 1. GET / list ── */
  let r = await call(alice, 'GET', N + '?limit=20');
  check('GET /notifications -> 200', r.status === 200, `status=${r.status}`);
  check('list returns {items,total,unreadCount,page,limit}',
    !!r.json && Array.isArray(r.json.items) && typeof r.json.total === 'number'
      && typeof r.json.unreadCount === 'number' && typeof r.json.page === 'number' && typeof r.json.limit === 'number',
    JSON.stringify(r.json && { total: r.json.total, unreadCount: r.json.unreadCount }));
  check('list returns the three seeded rows', r.json && r.json.items.length === 3, `n=${r.json && r.json.items.length}`);
  check('list total matches items', r.json && r.json.total === 3, `total=${r.json && r.json.total}`);
  check('list unreadCount is 3 before any read', r.json && r.json.unreadCount === 3, `unreadCount=${r.json && r.json.unreadCount}`);

  /* ── 2. recipient isolation ── */
  r = await call(bob, 'GET', N);
  check('bob sees an empty inbox (recipientId scoping)', r.json && r.json.items.length === 0, `n=${r.json && r.json.items.length}`);

  /* ── 3. GET /unread-count ── */
  r = await call(alice, 'GET', N + '/unread-count');
  check('GET /unread-count -> {count:3}', r.status === 200 && r.json && r.json.count === 3, JSON.stringify(r.json));

  /* ── 4. shape diff: what the frontend row renderer needs ── */
  // notification-store.js items carry cat, kind, audience, at(ms), link{label,href},
  // metrics[], chips[], icon{} and a stable id; the page filters by cat + audience
  // (role) and groups by day on `at`.
  const row = r && null; // placeholder
  const list = (await call(alice, 'GET', N + '?limit=20')).json.items;
  const first = list[0] || {};
  const wantFields = ['id', 'type', 'cat', 'audience', 'at', 'link', 'unread'];
  const hasAll = wantFields.every(k => first[k] !== undefined);
  check('list rows expose the frontend row fields (id,type,cat,audience,at,link,unread)', hasAll,
    'present=' + JSON.stringify(Object.keys(first)));
  check('list row id is a stable string the client can PATCH', typeof first.id === 'string' && first.id.length > 0, `id=${first.id}`);
  check('list row carries `cat` for the filter chips', first.cat !== undefined, `cat=${first.cat}`);
  check('list row carries `audience` for the reader/author role tabs', first.audience !== undefined, `audience=${first.audience}`);
  check('list row carries `at` as a numeric timestamp for day-grouping', typeof first.at === 'number', `at=${first.at} (${typeof first.at})`);
  check('list row link is an object with href (page reads n.link.href)',
    first.link && typeof first.link === 'object' && first.link.href !== undefined,
    'link=' + JSON.stringify(first.link));

  /* ── 5. PATCH /:id mark one read ── */
  const likeRow = list.find(x => x.type === 'like');
  r = await call(alice, 'PATCH', N + '/' + likeRow.id, { read: true });
  check('PATCH /:id {read:true} -> 200', r.status === 200, `status=${r.status}`);
  let after = (await call(alice, 'GET', N)).json;
  const likeAfter = after.items.find(x => x.id === likeRow.id);
  check('PATCH read cleared unread on that row', likeAfter && likeAfter.unread === false, `unread=${likeAfter && likeAfter.unread}`);
  check('PATCH read dropped unreadCount to 2', after.unreadCount === 2, `unreadCount=${after.unreadCount}`);

  /* ── 6. PATCH /:id mark unread again ── */
  r = await call(alice, 'PATCH', N + '/' + likeRow.id, { read: false });
  after = (await call(alice, 'GET', N)).json;
  check('PATCH {read:false} re-flags unread', after.items.find(x => x.id === likeRow.id).unread === true);
  check('unreadCount back to 3', after.unreadCount === 3, `unreadCount=${after.unreadCount}`);

  /* ── 7. POST /read with a single id ── */
  const payRow = after.items.find(x => x.type === 'payout');
  r = await call(alice, 'POST', N + '/read', { id: payRow.id });
  check('POST /read {id} -> 200', r.status === 200, `status=${r.status}`);
  after = (await call(alice, 'GET', N)).json;
  check('POST /read cleared only that row', after.items.find(x => x.id === payRow.id).unread === false && after.unreadCount === 2, `unreadCount=${after.unreadCount}`);

  /* ── 8. POST /read-all ── */
  r = await call(alice, 'POST', N + '/read-all', {});
  check('POST /read-all -> 200', r.status === 200, `status=${r.status}`);
  after = (await call(alice, 'GET', N)).json;
  check('read-all zeroed unreadCount', after.unreadCount === 0, `unreadCount=${after.unreadCount}`);
  check('unread-count endpoint agrees', (await call(alice, 'GET', N + '/unread-count')).json.count === 0);

  /* ── 9. GET ?unread=true filter ── */
  await notifications.notify({ recipientId: String(alice.id), type: 'follow', title: 'New follower', desc: '', link: 'profile' });
  r = await call(alice, 'GET', N + '?unread=true');
  check('GET ?unread=true returns only unread rows', r.json && r.json.items.length === 1 && r.json.items.every(x => x.unread === true),
    `n=${r.json && r.json.items.length}`);

  /* ── 10. pagination ── */
  r = await call(alice, 'GET', N + '?page=1&limit=2');
  check('GET ?page&limit windows the list', r.json && r.json.items.length === 2 && r.json.page === 1 && r.json.limit === 2 && r.json.total === 4,
    JSON.stringify(r.json && { n: r.json.items.length, total: r.json.total }));
  r = await call(alice, 'GET', N + '?page=2&limit=2');
  check('page 2 returns the remaining rows', r.json && r.json.items.length === 2, `n=${r.json && r.json.items.length}`);

  /* ── 11. PATCH /:id delete (explicit deleted flag) ── */
  const delRow = (await call(alice, 'GET', N)).json.items.find(x => x.type === 'follow');
  r = await call(alice, 'PATCH', N + '/' + delRow.id, {});
  check('PATCH /:id with empty body is a no-op (does not delete)', r.status === 200, `status=${r.status}`);
  after = (await call(alice, 'GET', N)).json;
  check('empty-body PATCH left the row in place', after.items.some(x => x.id === delRow.id), `total=${after.total}`);
  r = await call(alice, 'PATCH', N + '/' + delRow.id, { deleted: true });
  check('PATCH /:id {deleted:true} -> 200', r.status === 200, `status=${r.status}`);
  after = (await call(alice, 'GET', N)).json;
  check('deleted row is gone from the list', !after.items.some(x => x.id === delRow.id), `total=${after.total}`);

  /* ── 12. settings GET + PUT round-trip ── */
  r = await call(alice, 'PUT', N + '/settings', { highlights: { inapp: true, push: false, email: true }, all: true, mutedTypes: ['like'] });
  check('PUT /settings -> 200 ok', r.status === 200 && r.json && r.json.ok === true, `status=${r.status}`);
  r = await call(alice, 'GET', N + '/settings');
  const s = r.json && r.json.settings;
  check('GET /settings returns the saved matrix verbatim',
    s && s.highlights && s.highlights.email === true && s.highlights.push === false && Array.isArray(s.mutedTypes) && s.mutedTypes.indexOf('like') > -1,
    JSON.stringify(s));

  /* ── 13. auth guard ── */
  r = await fetch(N, { headers: {} }).then(x => ({ status: x.status }));
  check('GET /notifications without a token -> 401', r.status === 401, `status=${r.status}`);

  /* ── 14. rich milestone projection: metrics/chips/link survive write→read ── */
  const cara = await mk('cara');
  await notifications.notify({
    recipientId: String(cara.id), type: 'trending_enter', title: 'Your story entered Trending',
    desc: 'Climbed to #7', link: 'discover.html', key: 'trend:b7:1', rank: 7, rankNote: 'Romance',
    cover: 'https://x/cover.jpg', metrics: [{ label: 'Rank', value: '#7' }, { label: '24h reads', value: '48.2K' }],
    chips: ['+15 ranks'], linkLabel: 'See trending board',
  });
  const ms = (await call(cara, 'GET', N)).json.items[0];
  check('milestone row projects kind=milestone', ms && ms.kind === 'milestone', `kind=${ms && ms.kind}`);
  check('milestone row projects cat=highlights', ms && ms.cat === 'highlights', `cat=${ms && ms.cat}`);
  check('milestone row projects audience=author', ms && ms.audience === 'author', `audience=${ms && ms.audience}`);
  check('milestone row carries rank + rankNote', ms && ms.rank === 7 && ms.rankNote === 'Romance', JSON.stringify(ms && { rank: ms.rank, rankNote: ms.rankNote }));
  check('milestone row carries cover', ms && ms.cover === 'https://x/cover.jpg', `cover=${ms && ms.cover}`);
  check('milestone row carries metrics array', ms && Array.isArray(ms.metrics) && ms.metrics.length === 2 && ms.metrics[0].value === '#7', JSON.stringify(ms && ms.metrics));
  check('milestone row carries chips', ms && Array.isArray(ms.chips) && ms.chips[0] === '+15 ranks', JSON.stringify(ms && ms.chips));
  check('milestone row link is {href,label}', ms && ms.link && ms.link.href === 'discover.html' && ms.link.label === 'See trending board', JSON.stringify(ms && ms.link));
  check('milestone row exposes a numeric at for day-grouping', ms && typeof ms.at === 'number', `at=${ms && ms.at}`);
  // key idempotency: the same key from the cron must not create a second row.
  await notifications.notify({ recipientId: String(cara.id), type: 'trending_enter', title: 'dup', key: 'trend:b7:1' });
  check('duplicate key is deduped (still one row)', (await call(cara, 'GET', N)).json.items.length === 1, `n=${(await call(cara, 'GET', N)).json.items.length}`);

  finish();
}
main().catch(e => { say('FATAL ' + (e && e.stack || e)); try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (x) {} process.exit(1); });
