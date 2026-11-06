'use strict';
// Story reviews (option 1) live harness.
//
// Boots the real Express app on an in-memory MongoDB and drives the reader-facing
// reviews endpoints behind book-reader.html's "Top reviews" grid:
//   GET    /api/stories/:id/ratings                 (list, paginated, sorted)
//   POST   /api/stories/:id/ratings/:ratingId/helpful   (mark helpful)
//   DELETE /api/stories/:id/ratings/:ratingId/helpful   (unmark)
//
// It proves the reviews come from the REAL BookRating rows (stars are the seeded
// value, never a client-side hash), each card carries the author id/name/avatar
// the live status ring needs, the three sort orders + pagination work, and the
// denormalized helpful tally is paired 1:1 with RatingHelpful rows (a re-mark
// never double-counts). It also proves draft books 404 and the gate is authed.
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime. See smoke-store.cjs.
process.env.NODE_ENV = 'test';
process.env.PORT = '4200';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 4200;
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = require('path').join(__dirname, 'smoke-story-ratings.results.txt');
const DAY = 864e5;

const results = [];
const logLines = [];
function say(s) { logLines.push(s); console.log(s); }
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
  say(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}
function finish() {
  const passed = results.filter(x => x.pass).length;
  say(`\n===== ${passed}/${results.length} story-ratings assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => say(`  FAIL ${f.name} :: ${f.detail}`));
  try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (e) {}
  process.exit(passed === results.length ? 0 : 1);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_ratings');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  async function call(method, url, token, body) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { method, headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  const { User } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { BookRating, RatingHelpful } = require('../src/models/social.model');
  const { signAccess } = require('../src/middleware/auth');
  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  const author = await User.create({ fullName: 'writer', email: 'w@t.co', username: 'w' + Date.now(), passwordHash: DUMMY, status: 'active', roles: ['author'] });
  const book = await Book.create({ title: 'Live Story', authorId: author.id, status: 'published', genre: 'Romance' });
  const draft = await Book.create({ title: 'Draft Story', authorId: author.id, status: 'draft' });

  // Three readers author three reviews with distinct stars, helpful tallies and ages.
  async function reader(n) {
    return User.create({ fullName: 'rev' + n, email: `r${n}@t.co`, username: `rev${n}_${Date.now()}`, passwordHash: DUMMY, status: 'active', roles: ['reader'] });
  }
  const ra = await reader('a'), rb = await reader('b'), rc = await reader('c');

  async function seedRating(reviewer, stars, text, helpfulCount, daysAgo) {
    const r = await BookRating.create({ bookId: book.id, userId: reviewer.id, stars, text, spoiler: false, helpfulCount });
    // create() stamps createdAt=now; move it into its age window with a raw update.
    await BookRating.collection.updateOne({ _id: r._id }, { $set: { createdAt: new Date(Date.now() - daysAgo * DAY) } });
    return r;
  }
  const r1 = await seedRating(ra, 3, 'meh', 5, 1);  // newest,   5 helpful
  const r2 = await seedRating(rb, 5, 'loved it', 1, 2); // highest stars, 1 helpful
  const r3 = await seedRating(rc, 4, 'good', 9, 3);  // most helpful, 9

  /* ── 1. list: shape + real stars + author identity ── */
  let res = await call('GET', `${BASE}/api/stories/${book.id}/ratings`);
  check('GET /:id/ratings (anon) -> 200', res.status === 200, `status=${res.status}`);
  const d = res.json || {};
  check('list returns {items[], total, page, limit}', Array.isArray(d.items) && typeof d.total === 'number', JSON.stringify({ total: d.total, n: (d.items || []).length }));
  check('total = 3 reviews', d.total === 3, d.total);
  const cardFields = ['id', 'userId', 'name', 'avatar', 'stars', 'text', 'spoiler', 'createdAt', 'helpful', 'mineHelpful'];
  const bad = (d.items || []).find(x => cardFields.some(f => x[f] === undefined));
  check('every card has the full render contract', !bad, bad ? 'missing in ' + JSON.stringify(bad) : '');
  check('stars are the REAL seeded values (not a hash)',
    [d.items.find(x => x.userId === ra.id).stars, d.items.find(x => x.userId === rb.id).stars, d.items.find(x => x.userId === rc.id).stars].join(',') === '3,5,4',
    d.items.map(x => x.stars).join(','));
  check('author ids are surfaced for the live status ring', d.items.every(x => x.userId && typeof x.userId === 'string'));
  check('anonymous viewer has mineHelpful=false everywhere', d.items.every(x => x.mineHelpful === false));

  /* ── 2. the three sort orders ── */
  res = await call('GET', `${BASE}/api/stories/${book.id}/ratings?sort=helpful`);
  check('sort=helpful orders by tally desc (9,5,1)', res.json.items.map(x => x.helpful).join(',') === '9,5,1', res.json.items.map(x => x.helpful).join(','));
  res = await call('GET', `${BASE}/api/stories/${book.id}/ratings?sort=rating`);
  check('sort=rating orders by stars desc (5,4,3)', res.json.items.map(x => x.stars).join(',') === '5,4,3', res.json.items.map(x => x.stars).join(','));
  res = await call('GET', `${BASE}/api/stories/${book.id}/ratings?sort=newest`);
  check('sort=newest orders by age asc (r1,r2,r3)', res.json.items.map(x => x.userId).join(',') === [ra.id, rb.id, rc.id].join(','), res.json.items.map(x => x.userId).join(','));

  /* ── 3. pagination ── */
  res = await call('GET', `${BASE}/api/stories/${book.id}/ratings?limit=1&page=1`);
  check('limit=1 returns one item but keeps total=3', res.json.items.length === 1 && res.json.total === 3, JSON.stringify({ n: res.json.items.length, total: res.json.total }));
  res = await call('GET', `${BASE}/api/stories/${book.id}/ratings?limit=1&page=3`);
  // Default sort is helpful desc (9,5,1), so the last page is r2 — the 1-helpful review.
  check('page=3 returns the last review in default (helpful) order', res.json.items.length === 1 && res.json.items[0].userId === rb.id, JSON.stringify(res.json.items.map(x => x.userId)));

  /* ── 4. helpful mark: +1, idempotent, mineHelpful, then unmark ── */
  const tokB = signAccess(rb);
  res = await call('POST', `${BASE}/api/stories/${book.id}/ratings/${r2.id}/helpful`, tokB);
  check('POST helpful -> 200, tally 1 -> 2', res.status === 200 && res.json.helpful === 2, JSON.stringify(res.json));
  res = await call('POST', `${BASE}/api/stories/${book.id}/ratings/${r2.id}/helpful`, tokB);
  check('re-mark by the same reader does NOT double-count (stays 2)', res.json.helpful === 2, JSON.stringify(res.json));
  res = await call('GET', `${BASE}/api/stories/${book.id}/ratings`, tokB);
  const mine = res.json.items.find(x => x.id === String(r2.id));
  check('signed-in viewer sees mineHelpful=true on their mark', mine && mine.mineHelpful === true, JSON.stringify(mine));
  res = await call('GET', `${BASE}/api/stories/${book.id}/ratings`);
  check('a different viewer still sees mineHelpful=false', res.json.items.find(x => x.id === String(r2.id)).mineHelpful === false);

  const marks = await RatingHelpful.countDocuments({ ratingId: String(r2.id) });
  check('exactly one RatingHelpful row backs the tally', marks === 1, marks);

  res = await call('DELETE', `${BASE}/api/stories/${book.id}/ratings/${r2.id}/helpful`, tokB);
  check('DELETE helpful -> tally back to 1', res.json.helpful === 1, JSON.stringify(res.json));
  check('unmark removed the RatingHelpful row', (await RatingHelpful.countDocuments({ ratingId: String(r2.id) })) === 0);

  /* ── 5. auth + not-found gates ── */
  res = await call('POST', `${BASE}/api/stories/${book.id}/ratings/${r1.id}/helpful`); // no token
  check('POST helpful without auth -> 401', res.status === 401, `status=${res.status}`);
  res = await call('GET', `${BASE}/api/stories/${draft.id}/ratings`);
  check('ratings list on a DRAFT book -> 404', res.status === 404, `status=${res.status}`);
  res = await call('POST', `${BASE}/api/stories/${book.id}/ratings/nonexistent/helpful`, tokB);
  check('helpful on a nonexistent review -> 404', res.status === 404, `status=${res.status}`);

  finish();
}
main().catch(e => { say('FATAL ' + (e && e.stack || e)); try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (x) {} process.exit(1); });
