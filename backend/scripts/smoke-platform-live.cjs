'use strict';
// Live platform-analytics + ad-revenue contract. Boots the REAL Express app
// against in-memory MongoDB and asserts the two rollup surfaces the marketing
// and super-admin consoles read:
//   GET  /api/track/platform?days=30            → pageviews, returning rate,
//                                                 DAU/WAU/MAU, country mix
//   GET  /api/super-admin/ad-revenue/ledger     → raw rows (dated + paged)
//   GET  /api/super-admin/ad-revenue/summary    → totals + bySurface/Story/Author
//   POST /api/super-admin/ad-revenue/network    → import a network report
//   GET  /api/super-admin/ad-revenue/network    → list imports
//   POST /api/super-admin/ad-revenue/pay        → stamp author rows paid
// Each assertion mirrors a value the page renders, so "live mode" cannot
// silently half-paint with the demo numbers still showing.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4331';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}

async function startMongo() {
  // instance.launchTimeout is the option this build honours — startupTimeout
  // is silently ignored, and a cold mongod "fails" at the built-in 10s.
  return MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
}

async function main() {
  const mongod = await startMongo();
  process.env.MONGO_URI = mongod.getUri('droboard_platform');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const origin = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(origin + '/health'); if (p.ok) break; } catch (e) { /* not up */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { InsightHit, ReadingProgress } = require('../src/models/social.model');
  const { AdInventory } = require('../src/models/platform.model');
  const { AdRevenueLedger, NetworkEarning } = require('../src/models/revenue.model');
  const { Campaign } = require('../src/models/marketing.model');
  const jwt = require('jsonwebtoken');

  const stamp = Date.now();
  const DAY = 86400000;
  const tok = (u, roles) => jwt.sign({ sub: u.id, roles: roles || ['reader'] }, process.env.JWT_ACCESS_SECRET);
  const api = (path, opts = {}) => fetch(origin + path, Object.assign({ credentials: 'include' }, opts))
    .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
  const adminHeaders = (u) => Object.assign({ Authorization: 'Bearer ' + tok(u, ['admin']) });
  const asAdmin = (u) => ({ headers: adminHeaders(u) });
  const asAdminPost = (u, body) => ({
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, adminHeaders(u)),
    body: JSON.stringify(body),
  });

  /* ═══ SEED — users + content + the traffic the rollup must find ═══ */
  const admin = await User.create({
    id: 'usr_pa_admin_' + stamp, username: 'pa_admin', fullName: 'Platform Admin',
    email: 'pa_' + stamp + '@e.io', emailVerified: true, status: 'active', roles: ['admin'],
  });
  const author = await User.create({
    id: 'usr_pa_author_' + stamp, username: 'pa_author', fullName: 'PA Author',
    email: 'pa_auth_' + stamp + '@e.io', status: 'active', roles: ['author'],
  });
  const returning = await User.create({
    id: 'usr_pa_returning_' + stamp, username: 'pa_returning', fullName: 'Rita Reader',
    email: 'pa_ret_' + stamp + '@e.io', status: 'active', roles: ['reader'],
  });
  const oneDay = await User.create({
    id: 'usr_pa_oneday_' + stamp, username: 'pa_oneday', fullName: 'Oliver OneDay',
    email: 'pa_od_' + stamp + '@e.io', status: 'active', roles: ['reader'],
  });

  const book = await Book.create({
    id: 'bk_pa_1_' + stamp, title: 'The Reader Who Came Back', authorId: author.id,
    genre: 'Romance', status: 'published', reads: 0, contractStatus: 'contracted',
  });

  /* InsightHits across surfaces + countries + two calendar days so DAU/WAU/MAU
     have something to bucket. Rita visits hub twice and droboard once; Oliver
     visits hub once. */
  const today = new Date();
  const yesterday = new Date(Date.now() - DAY);
  const dayStr = (d) => d.toISOString().slice(0, 10);
  const hits = [
    { surface: 'hub', userId: returning.id, country: 'NG', day: dayStr(today), count: 3 },
    { surface: 'hub', userId: returning.id, country: 'NG', day: dayStr(yesterday), count: 1 },
    { surface: 'droboard', userId: returning.id, country: 'US', day: dayStr(today), count: 2 },
    { surface: 'profile', userId: oneDay.id, country: 'NG', day: dayStr(today), count: 4 },
    { surface: 'collection', userId: oneDay.id, country: 'GB', day: dayStr(today), count: 1 },
  ];
  for (const h of hits) {
    await InsightHit.create(Object.assign({ targetId: '', surface: h.surface }, h, { createdAt: new Date() }));
  }

  /* ReadingProgress: Rita reads on TWO distinct days → returning. Oliver reads
     on ONE day → not returning. */
  await ReadingProgress.create({ userId: returning.id, storyId: book.id, chapterId: 'ch_1', lastReadAt: today, pct: 40, secondsSpent: 500 });
  await ReadingProgress.create({ userId: returning.id, storyId: book.id, chapterId: 'ch_2', lastReadAt: yesterday, pct: 100, secondsSpent: 900 });
  await ReadingProgress.create({ userId: oneDay.id, storyId: book.id, chapterId: 'ch_1', lastReadAt: today, pct: 10, secondsSpent: 120 });

  /* AdInventory + Campaign + AdRevenueLedger for the ad-revenue console.
     Two ledger rows: a story slot (30% author share, unpaid) and a platform
     surface (100% platform). */
  const camp = await Campaign.create({
    id: 'cmp_pa_1_' + stamp, name: 'PA Wolf Push', currency: 'USD', budget: 500, spent: 0,
    status: 'live', type: 'story',
    startDate: dayStr(yesterday), endDate: dayStr(new Date(Date.now() + 30 * DAY)),
  });
  await AdInventory.create({
    id: 'ad_pa_1_' + stamp, title: 'PA wolf creative', format: 'book', active: true,
    campaign: camp.id, url: 'https://droboard.com/story',
    startDate: dayStr(yesterday), endDate: dayStr(new Date(Date.now() + 30 * DAY)),
  });
  const led1 = await AdRevenueLedger.create({
    date: dayStr(today), storyId: book.id, storyTitle: book.title,
    authorId: author.id, authorName: author.fullName,
    adId: 'ad_pa_1_' + stamp, slot: 'fullReader:per-300-words', page: 'fullReader', country: 'NG',
    impressions: 100, clicks: 4, revenue: 0.64, platformShare: 0.448, authorShare: 0.192,
    network: false, billed: true, paidAt: null,
  });
  await AdRevenueLedger.create({
    date: dayStr(today), storyId: '', adId: 'ad_pa_1_' + stamp,
    slot: 'home:top', page: 'home', country: 'US',
    impressions: 500, clicks: 10, revenue: 2.5, platformShare: 2.5, authorShare: 0,
    network: false, billed: true, paidAt: null,
  });

  /* ═══ 1. PLATFORM ROLLUP ═══ */
  const p = await api('/api/track/platform?days=30');
  check('GET /api/track/platform returns 200', p.status === 200, { status: p.status });
  const ps = p.json || {};
  check('platform payload has every rollup key the console reads',
    ['days', 'pageviews', 'returningReaderRate', 'activeUsers', 'countries'].every(k => ps[k] !== undefined),
    Object.keys(ps));
  check('pageviews.bySurface names all four InsightHit surfaces',
    ps.pageviews && ['hub', 'droboard', 'profile', 'collection'].every(s => typeof ps.pageviews.bySurface[s] === 'number'),
    ps.pageviews && ps.pageviews.bySurface);
  check('pageviews.bySurface sums the seeded counts, not one row',
    ps.pageviews && ps.pageviews.bySurface.hub === 4 && ps.pageviews.bySurface.droboard === 2
      && ps.pageviews.bySurface.profile === 4 && ps.pageviews.bySurface.collection === 1,
    ps.pageviews && ps.pageviews.bySurface);
  check('pageviews.total is the roll-up of every surface',
    ps.pageviews && ps.pageviews.total === 11, { total: ps.pageviews && ps.pageviews.total });

  const rr = ps.returningReaderRate || {};
  check('returningReaderRate is a percentage with definition + window',
    typeof rr.pct === 'number' && typeof rr.definition === 'string' && rr.windowDays === 30, rr);
  check('returning reader = 1 of 2 seeded readers = 50%',
    rr.returningReaders === 1 && rr.totalReaders === 2 && rr.pct === 50,
    { returningReaders: rr.returningReaders, totalReaders: rr.totalReaders, pct: rr.pct });

  const au = ps.activeUsers || {};
  check('activeUsers exposes dau/wau/mau series + definition',
    Array.isArray(au.dau) && Array.isArray(au.wau) && Array.isArray(au.mau) && au.definition && au.definition.dau,
    au.definition && Object.keys(au.definition));
  check('DAU is per calendar day with distinct signed-in users',
    au.dau && au.dau.length === 2 && au.dau.reduce((m, d) => Math.max(m, d.users), 0) === 2,
    au.dau);
  check('WAU/MAU bucket by YYYY-WW and YYYY-MM with distinct users',
    au.wau && au.wau[0] && typeof au.wau[0].week === 'string' && au.wau[0].week.length === 8
      && au.mau && au.mau[0] && au.mau[0].month.length === 7 && au.mau[0].users === 2,
    { w: au.wau && au.wau[0], m: au.mau && au.mau[0] });

  const ctys = ps.countries || [];
  check('countries come top-ranked with the two-letter codes we tracked',
    ctys.length >= 3 && ctys[0].country === 'NG' && ctys.some(c => c.country === 'US') && ctys.some(c => c.country === 'GB'),
    ctys);
  check('country counts sum to the InsightHit rows (NG=8, US=2, GB=1)',
    ctys.find(c => c.country === 'NG').reads === 8 && ctys.find(c => c.country === 'US').reads === 2
      && ctys.find(c => c.country === 'GB').reads === 1, ctys);

  const noAuth = await api('/api/track/platform');
  check('anonymous GET /api/track/platform still works (console may not have a session yet)',
    noAuth.status === 200);

  /* ═══ 2. AD REVENUE LEDGER ═══ */
  const led = await api('/api/super-admin/ad-revenue/ledger?days=30', asAdmin(admin));
  check('GET /api/super-admin/ad-revenue/ledger returns 200 for admin', led.status === 200, led.status);
  const rows = (led.json && led.json.rows) || [];
  check('ledger rows expose every field the console table renders',
    rows.length >= 2 && ['date', 'storyId', 'adId', 'slot', 'page', 'impressions', 'clicks',
      'revenue', 'platformShare', 'authorShare', 'country', 'network', 'billed', 'paid'].every(k =>
        rows.every(r => r[k] !== undefined)),
    rows[0] && Object.keys(rows[0]));
  check('ledger sums story + platform rows correctly',
    rows.length === 2 && rows.reduce((a, r) => a + r.impressions, 0) === 600 && rows.reduce((a, r) => a + r.clicks, 0) === 14,
    { rows: rows.length, imps: rows.reduce((a, r) => a + r.impressions, 0), clicks: rows.reduce((a, r) => a + r.clicks, 0) });

  /* ═══ 3. AD REVENUE SUMMARY ═══ */
  const sm = await api('/api/super-admin/ad-revenue/summary?days=30', asAdmin(admin));
  check('GET /api/super-admin/ad-revenue/summary returns 200', sm.status === 200, sm.status);
  const sum = sm.json || {};
  check('summary returns totals + bySurface + byStory + byAuthor',
    sum.totals && Array.isArray(sum.bySurface) && Array.isArray(sum.byStory) && Array.isArray(sum.byAuthor),
    Object.keys(sum));
  check('totals reconcile with the ledger (600 imps, 14 clicks, $3.14)',
    sum.totals.impressions === 600 && sum.totals.clicks === 14
      && Math.abs(sum.totals.revenue - 3.14) < 0.005, sum.totals);
  check('byStory isolates the story-owned row and pays its author 30%',
    sum.byStory.length === 1 && sum.byStory[0].storyId === book.id && sum.byStory[0].impressions === 100
      && Math.abs(sum.byStory[0].authorShare - 0.192) < 0.005,
    sum.byStory[0] && { s: sum.byStory[0].storyId, imps: sum.byStory[0].impressions, author: sum.byStory[0].authorShare });
  check('byAuthor keeps unpaid share visible so the payable column reconciles',
    sum.byAuthor.length === 1 && Math.abs(sum.byAuthor[0].authorShare - 0.192) < 0.005 && sum.totals.authorShareUnpaid > 0,
    sum.byAuthor[0] && { author: sum.byAuthor[0].authorName, unpaid: sum.totals.authorShareUnpaid });

  /* ═══ 4. NETWORK IMPORT + LISTING ═══ */
  const nw = await api('/api/super-admin/ad-revenue/network', asAdmin(admin));
  check('GET /api/super-admin/ad-revenue/network lists imports (currently empty)',
    nw.status === 200 && Array.isArray(nw.json.rows) && nw.json.total === 0, nw.json && nw.json.total);

  const post = await api('/api/super-admin/ad-revenue/network', asAdminPost(admin, {
    network: 'AdSense', from: dayStr(yesterday), to: dayStr(today), amount: 120, currency: 'USD',
  }));
  check('POST /api/super-admin/ad-revenue/network imports a report row',
    post.status === 200 && post.json && post.json.id && post.json.amountUsd === 120,
    post.json && { id: post.json.id, allocated: post.json.allocated });
  check('an import with no matching network tag books itself to platform without author share',
    post.json && post.json.allocated === 0, { allocated: post.json && post.json.allocated });

  const bad = await api('/api/super-admin/ad-revenue/network', asAdminPost(admin, {
    from: dayStr(yesterday), to: dayStr(today), amount: 0,
  }));
  check('amount=0 is rejected with 400 instead of silently booking nothing',
    bad.status === 400, bad.json);

  /* ═══ 5. PAY AUTHORITY ═══ */
  const pay = await api('/api/super-admin/ad-revenue/pay', asAdminPost(admin, { authorId: author.id }));
  check('POST /api/super-admin/ad-revenue/pay marks the author rows paid',
    pay.status === 200 && pay.json && pay.json.ok === true && pay.json.modified === 1,
    pay.json);
  const paid = await api('/api/super-admin/ad-revenue/ledger?days=30', asAdmin(admin));
  const storyRow = (paid.json.rows || []).find(r => r.storyId === book.id);
  check('the story row now reports paid=true so payable balance drops to zero',
    storyRow && storyRow.paid === true, storyRow && { paid: storyRow.paid });

  const sum2 = await api('/api/super-admin/ad-revenue/summary?days=30', asAdmin(admin));
  check('after payment, authorShareUnpaid falls to 0 (payable column reconciles)',
    sum2.json && sum2.json.totals.authorShareUnpaid === 0,
    sum2.json && sum2.json.totals);

  /* ═══ 6. RBAC — non-admin blocked ═══ */
  const forbidden = await api('/api/super-admin/ad-revenue/ledger', asAdmin(returning));
  check('a reader cannot read the ad ledger (403, not a soft empty list)', forbidden.status === 403, forbidden.status);

  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + total + ' platform + ad-revenue live assertions passed');
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error('harness crashed:', e); process.exit(2); });
