'use strict';
// Author dashboard live harness.
//
// Boots the real Express app on an in-memory MongoDB and drives
// GET /api/author/dashboard — the endpoint behind author-center.html's four
// stat cards (Total Reads / Followers / Earnings / Completion Rate). It proves
// two things with data, not demo numbers:
//   1. Every card's value comes from a real collection (Book.reads, User.followerCount,
//      Wallet.lifetimeEarned, published/total, ChapterReviewRequest pending).
//   2. The 30-day growth percentages come from genuine time-series and are
//      null (never fabricated) whenever there is no prior base to compare to —
//      including the brand-new author whose database is empty.
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime. See smoke-store.cjs.
process.env.NODE_ENV = 'test';
process.env.PORT = '4199';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 4199;
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = require('path').join(__dirname, 'smoke-author-dashboard.results.txt');

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
  say(`\n===== ${passed}/${results.length} author-dashboard assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => say(`  FAIL ${f.name} :: ${f.detail}`));
  try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (e) {}
  process.exit(passed === results.length ? 0 : 1);
}
const dayStr = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_author_dash');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  async function get(url, headers) {
    const res = await fetch(url, { headers: headers || {}, credentials: 'include' });
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  const { User } = require('../src/models/user.model');
  const { Book, BookDailyStat } = require('../src/models/content.model');
  const { Wallet, LedgerEntry } = require('../src/models/money.model');
  const { Follow } = require('../src/models/social.model');
  const { ChapterReviewRequest } = require('../src/models/application.model');
  const { signAccess } = require('../src/middleware/auth');
  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  /* ── seed an author with a full, knowable history ── */
  const ada = await User.create({
    fullName: 'ada', email: 'ada@t.co', username: 'ada' + Date.now() + Math.random(),
    passwordHash: DUMMY, status: 'active', roles: ['author'],
  });
  // 120 followers, 10 of them created in the last 30 days → base 30d ago = 110.
  await User.updateOne({ id: ada.id }, { $set: { followerCount: 120 } });
  for (let i = 0; i < 10; i++) {
    await Follow.create({ followerId: 'fan' + i + ada.id, followingId: ada.id }); // createdAt = now (in window)
  }

  const b1 = await Book.create({ title: 'Published One', authorId: ada.id, status: 'published', reads: 1000 });
  const b2 = await Book.create({ title: 'Draft Two', authorId: ada.id, status: 'draft', reads: 500 });

  // Daily reads snapshot: 300 in the last 30d, 200 in the 30–60d window → growth 50%.
  await BookDailyStat.create({ bookId: b1.id, day: dayStr(5), reads: 300 });
  await BookDailyStat.create({ bookId: b2.id, day: dayStr(45), reads: 200 });

  // Author wallet credited 8,642 lifetime; 1,000 in last 30d, 500 in prior 30d → growth 100%.
  await Wallet.create({ userId: ada.id, kind: 'author', lifetimeEarned: 8642 });
  async function ledger(amount, daysAgo) {
    const stamp = new Date(Date.now() - daysAgo * DAY);
    const e = await LedgerEntry.create({
      entryId: 'led_' + ada.id + '_' + daysAgo + '_' + amount,
      journalId: 'j_' + daysAgo + '_' + amount,
      debitAcct: 'pool:readers', creditAcct: 'wallet:author:' + ada.id,
      amount, coins: 0, authorId: ada.id, kind: 'sale', idempotencyKey: 'idem_' + ada.id + '_' + daysAgo + '_' + amount,
    });
    // create() stamps createdAt=now; move the accrual into its window with a raw
    // driver update so the mongoose update hooks (and the ids plugin) stay out.
    await LedgerEntry.collection.updateOne({ _id: e._id }, { $set: { createdAt: stamp } });
  }
  await ledger(1000, 10); // last 30d
  await ledger(500, 45);  // 30–60d window

  await ChapterReviewRequest.create({ bookId: b1.id, chapterNum: 1, status: 'pending' });

  /* ── 1. auth gate ── */
  let r = await get(BASE + '/api/author/dashboard');
  check('GET /api/author/dashboard (no token) -> 401', r.status === 401, `status=${r.status}`);

  /* ── 2. payload shape ── */
  r = await get(BASE + '/api/author/dashboard', { Authorization: 'Bearer ' + signAccess(ada) });
  check('GET /api/author/dashboard (author) -> 200', r.status === 200, `status=${r.status}`);
  const d = r.json || {};
  check('response has stats{} + growth{}', d.stats && d.growth, JSON.stringify(Object.keys(d)));
  const statsFields = ['books', 'contracts', 'reads', 'followers', 'earnings', 'completionRate', 'pendingReviews'];
  check('stats carries every card field', statsFields.every(k => typeof d.stats[k] === 'number'),
    JSON.stringify(d.stats));
  const growthFields = ['reads', 'followers', 'earnings', 'completionRate'];
  check('growth has reads/followers/earnings/completionRate keys',
    growthFields.every(k => k in d.growth), JSON.stringify(d.growth));

  /* ── 3. each stat is real, not a placeholder ── */
  check('stats.books = 2 (two authored books)', d.stats.books === 2, d.stats.books);
  check('stats.reads = 1500 (1000 + 500 across books)', d.stats.reads === 1500, d.stats.reads);
  check('stats.followers = 120 (User.followerCount)', d.stats.followers === 120, d.stats.followers);
  check('stats.earnings = 8642 (Wallet.lifetimeEarned)', d.stats.earnings === 8642, d.stats.earnings);
  check('stats.completionRate = 50 (1 published of 2)', d.stats.completionRate === 50, d.stats.completionRate);
  check('stats.pendingReviews = 1 (pending ChapterReviewRequest)', d.stats.pendingReviews === 1, d.stats.pendingReviews);

  /* ── 4. growth percentages from the real time-series ── */
  check('growth.reads = 50 (300 last30 vs 200 prior)', d.growth.reads === 50, d.growth.reads);
  check('growth.followers = 9.1 (120 vs base 110)', d.growth.followers === 9.1, d.growth.followers);
  check('growth.earnings = 100 (1000 last30 vs 500 prior)', d.growth.earnings === 100, d.growth.earnings);
  check('growth.completionRate is null (no historical ratio to diff)', d.growth.completionRate === null, d.growth.completionRate);

  /* ── 5. brand-new author: zeros for stats, NULL for every growth delta ──
     This is the honesty check — an empty database must not render "0%" or a
     made-up figure; the frontend hides a null delta. */
  const bob = await User.create({
    fullName: 'bob', email: 'bob@t.co', username: 'bob' + Date.now() + Math.random(),
    passwordHash: DUMMY, status: 'active', roles: ['author'],
  });
  r = await get(BASE + '/api/author/dashboard', { Authorization: 'Bearer ' + signAccess(bob) });
  const bd = r.json || {};
  check('empty author -> 200 with stats+growth', r.status === 200 && bd.stats && bd.growth, `status=${r.status}`);
  check('empty author stats are all zero',
    ['books', 'reads', 'followers', 'earnings', 'completionRate', 'pendingReviews'].every(k => bd.stats[k] === 0),
    JSON.stringify(bd.stats));
  check('empty author growth is all null (never fabricated)',
    growthFields.every(k => bd.growth[k] === null), JSON.stringify(bd.growth));

  finish();
}
main().catch(e => { say('FATAL ' + (e && e.stack || e)); try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (x) {} process.exit(1); });
