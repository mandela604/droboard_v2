'use strict';
/*
 * scripts/smoke-admin-boards.cjs — live HTTP test for the admin console's
 * Boards page (public/super-admin/genre-boards-service.js).
 *
 * A board is the category the CE created, so this asserts that the console's
 * every rendered cell comes from real rows:
 *   GET  /api/super-admin/boards       members/newWeek/growth/threads/postsWeek/
 *                                      repliesPerPost/reportsOpen/visits/
 *                                      returningPct/lastActiveMin/status chip
 *   PUT  /api/super-admin/boards/:id/crew   the board's ONE admin + moderator team
 *   POST /api/super-admin/boards/:id/flag   reason + password confirm, mirrors a
 *                                      pending Report; unflag settles it
 * plus that the assigned moderator can actually post in every child genre
 * without joining (the write gate reads the same columns).
 */
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4214';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');
const BASE = 'http://127.0.0.1:' + PORT;
const AB = '/api/super-admin/boards';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::' + String(detail).slice(0, 220) : ''}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const day = offset => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_admin_boards');
  require('../src/server');
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) { /* not up */ }
    await sleep(250);
  }

  const argon2 = require('argon2');
  const { User } = require('../src/models/user.model');
  const { Category, Genre, CategoryMembership } = require('../src/models/content.model');
  const { Discussion, Comment, InsightHit } = require('../src/models/social.model');
  const { Report } = require('../src/models/editorial.model');
  const { signAccess } = require('../src/middleware/auth');

  const stamp = Date.now();
  const ADMIN_PASS = 'BoardAdminPass123!';
  async function call(method, path, body, token) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }
  async function person(username, roles, password) {
    return User.create({
      id: 'usr_ab_' + username + '_' + stamp, username, fullName: username.replace(/_/g, ' '),
      email: username + '@t.co', passwordHash: await argon2.hash(password || 'ReaderPass123!'),
      roles, primaryRole: roles[0], status: 'active',
      avatar: 'https://i.pravatar.cc/100?img=32',
    });
  }
  // Mongoose owns createdAt on a timestamps schema and strips it from updates,
  // so every aged row here is written through the raw collection.
  const backdate = async (Model, filter, iso) =>
    Model.collection.updateOne(filter, { $set: { createdAt: new Date(iso) } });

  /* ═══ 1. THE BOARDS THE CE CREATED ═══ */
  const admin = await person('boards_admin_console', ['admin'], ADMIN_PASS);
  const reader1 = await person('boards_r1', ['reader']);
  const reader2 = await person('boards_r2', ['reader']);
  const mod = await person('boards_crew_mod', ['reader']);
  const boardAdmin = await person('boards_crew_admin', ['reader']);

  const fantasy = await Category.create({
    id: 'cat_fb_' + stamp, name: 'Fantasy', slug: 'fantasy', desc: 'Dragons and bargains.',
    icon: 'fa-hat-wizard', color: 'purple', status: 'active', membersCount: 99999,
  });
  const poetry = await Category.create({
    id: 'cat_pb_' + stamp, name: 'Poetry', slug: 'poetry', desc: 'Quiet corner.',
    icon: 'fa-feather', color: 'green', status: 'active', membersCount: 0,
  });
  const retired = await Category.create({
    id: 'cat_rb_' + stamp, name: 'Retired', slug: 'retired', desc: '', status: 'inactive', membersCount: 0,
  });
  const werewolf = await Genre.create({ id: 'gen_w_' + stamp, name: 'Werewolf', slug: 'werewolf', categoryId: fantasy.id, status: 'active' });
  const dragon = await Genre.create({ id: 'gen_d_' + stamp, name: 'Dragon Rider', slug: 'dragon-rider', categoryId: fantasy.id, status: 'active' });
  const verse = await Genre.create({ id: 'gen_v_' + stamp, name: 'Verse', slug: 'verse', categoryId: poetry.id, status: 'active' });

  /* ═══ 2. AUTH ═══ */
  let r = await call('GET', AB);
  check('boards list needs a session', r.status === 401, `status=${r.status}`);
  r = await call('GET', AB, undefined, signAccess(reader1));
  check('a reader cannot open the boards console', r.status === 403, `status=${r.status}`);
  r = await call('GET', AB, undefined, signAccess(admin));
  check('admin gets the paginated board list', r.status === 200 && Array.isArray(r.json.items)
    && typeof r.json.total === 'number' && r.json.page === 1, `status=${r.status} keys=${r.json && Object.keys(r.json)}`);

  /* ═══ 3. MEMBERS: THE LIVE JOIN ROWS, NOT THE STORED COUNT ═══ */
  const join = async (cat, user, daysAgo) => {
    const m = await CategoryMembership.create({ userId: user.id, categoryId: cat.id });
    if (daysAgo) await backdate(CategoryMembership, { _id: m._id }, new Date(Date.now() - daysAgo * 864e5).toISOString());
    return m;
  };
  await join(fantasy, reader1, 2);
  await join(fantasy, reader2, 3);
  await join(fantasy, mod, 5);
  await join(fantasy, boardAdmin, 10); // previous week
  const extra = await User.create({
    id: 'usr_ab_x_' + stamp, username: 'boards_x', fullName: 'Boards X', email: 'boards_x@t.co',
    passwordHash: 'x', roles: ['reader'], primaryRole: 'reader', status: 'active',
  });
  await join(fantasy, extra, 12); // previous week

  /* ═══ 4. THREADS, REPLIES AND THE MOD QUEUE ═══ */
  const thread = async (genre, title, hoursAgo) => {
    const d = await Discussion.create({ genreId: genre.id, authorId: reader1.id, title, body: 'x', tag: 'discussion' });
    if (hoursAgo) await backdate(Discussion, { _id: d._id }, new Date(Date.now() - hoursAgo * 36e5).toISOString());
    return d;
  };
  const t1 = await thread(werewolf, 'Best moon-bound mates?', 200);  // 8 days ago
  const t2 = await thread(werewolf, 'Pack politics', 5);              // this week
  const t3 = await thread(dragon, 'Hatchling bonding rules', 1);      // this week, newest
  const t4 = await thread(verse, 'Sonnet or free verse', 300);
  const reply = async (d, daysAgo) => {
    const c = await Comment.create({ authorId: reader2.id, scope: 'discussion', discussionId: d.id, text: 'agree' });
    if (daysAgo) await backdate(Comment, { _id: c._id }, new Date(Date.now() - daysAgo * 864e5).toISOString());
  };
  for (let i = 0; i < 4; i++) await reply(t1);
  for (let i = 0; i < 4; i++) await reply(t2);
  await reply(t3); await reply(t3);
  for (let i = 0; i < 8; i++) await reply(t4);

  const openReport = await Report.create({ discussionId: t2.id, title: 'Pack politics', desc: 'Spam or scam', type: 'spam', status: 'pending' });
  await Report.create({ discussionId: t2.id, title: 'Pack politics', desc: 'resolved earlier', type: 'other', status: 'resolved' });
  await Report.create({ discussionId: t1.id, title: 'Best moon-bound mates?', desc: 'still open', type: 'abuse', status: 'pending' });

  r = await call('GET', AB + '?sort=members', undefined, signAccess(admin));
  const fRow = (r.json.items || []).find(x => x.name === 'Fantasy') || {};
  const pRow = (r.json.items || []).find(x => x.name === 'Poetry') || {};
  const rRow = (r.json.items || []).find(x => x.name === 'Retired') || {};
  check('the row carries every field the page renders', ['id', 'name', 'slug', 'icon', 'color', 'status',
    'members', 'newWeek', 'postsWeek', 'repliesPerPost', 'returningPct', 'visits', 'threads', 'reportsOpen',
    'growth', 'lastActiveMin', 'mods', 'flagReason', 'flagNote', 'flaggedBy', 'flaggedAt']
    .every(k => k in fRow), Object.keys(fRow).join(','));
  check('members is the live join count', fRow.members === 5, `members=${fRow.members}`);
  check('newWeek counts joins in the last 7 days', fRow.newWeek === 3, `newWeek=${fRow.newWeek}`);
  check('growth compares this week to last week (3 vs 2 = +50%)', fRow.growth === 50, `growth=${fRow.growth}`);
  check('a board gaining members reads as growing', fRow.status === 'growing', `status=${fRow.status}`);
  check('threads counts the board discussions across child genres', fRow.threads === 3, `threads=${fRow.threads}`);
  check('postsWeek counts only this week threads', fRow.postsWeek === 2, `postsWeek=${fRow.postsWeek}`);
  check('repliesPerPost is board replies over board threads', fRow.repliesPerPost === 3.3, `replies=10/3=${fRow.repliesPerPost}`);
  check('reportsOpen counts only pending reports on board threads', fRow.reportsOpen === 2, `reportsOpen=${fRow.reportsOpen}`);
  check('lastActiveMin is measured from the newest thread', fRow.lastActiveMin >= 0 && fRow.lastActiveMin < 90, `min=${fRow.lastActiveMin}`);
  check('a board nobody joined or posted in is quiet', pRow.status === 'quiet', `status=${pRow.status} growth=${pRow.growth}`);
  check('Poetry still reports its own thread and reply depth', pRow.threads === 1 && pRow.repliesPerPost === 8, `t=${pRow.threads} r=${pRow.repliesPerPost}`);
  check('the CE switch beats the engagement chip', rRow.status === 'inactive', `status=${rRow.status}`);

  /* ═══ 5. VISITS FROM THE REAL TRACKER ═══ */
  // The hub tracker records whatever the reader had in the URL, so a board's
  // roll-up must gather its own key AND every child genre key.
  const hit1 = await call('POST', '/api/track/insight', { surface: 'hub', targetId: 'fantasy' }, signAccess(reader1));
  const hit2 = await call('POST', '/api/track/insight', { surface: 'hub', targetId: 'dragon-rider' }, signAccess(reader2));
  check('the tracker stores a hub visit', hit1.json.ok === true && hit2.json.ok === true, `${hit1.status} ${hit2.status} ${JSON.stringify(hit1.json)}`);
  const seedHit = async (targetId, user, dayStr, createdAtIso, n) => {
    // Raw insert: the ids plugin only mints `id` on a mongoose save, and the
    // collection has a unique index on it.
    await InsightHit.collection.insertOne({
      id: 'ih_' + stamp + '_' + (seedHit.n = (seedHit.n || 0) + 1),
      surface: 'hub', targetId, userId: user ? user.id : null, country: '', day: dayStr, count: n,
      createdAt: new Date(createdAtIso),
    });
  };
  await seedHit('fantasy', reader1, day(-20), new Date(Date.now() - 20 * 864e5).toISOString(), 7);
  await seedHit('werewolf', reader1, day(-14), new Date(Date.now() - 14 * 864e5).toISOString(), 3);
  await seedHit('fantasy', reader2, day(-3), new Date(Date.now() - 3 * 864e5).toISOString(), 4);
  await seedHit('verse', reader1, day(-1), new Date(Date.now() - 1 * 864e5).toISOString(), 5);
  await seedHit('fantasy', null, day(0), new Date().toISOString(), 9); // anonymous, today

  r = await call('GET', AB + '?sort=daily', undefined, signAccess(admin));
  const vF = (r.json.items || []).find(x => x.name === 'Fantasy') || {};
  const vP = (r.json.items || []).find(x => x.name === 'Poetry') || {};
  check('today visits count only rows stamped today', vF.visits.d === 1 + 1 + 9, `d=${vF.visits.d}`);
  check('week visits gather the board key and its child genre keys', vF.visits.w === 1 + 1 + 9 + 4, `w=${vF.visits.w}`);
  check('month visits include the rows older than this week', vF.visits.m === 1 + 1 + 9 + 4 + 7 + 3, `m=${vF.visits.m}`);
  check('a child genre visit lands on its own board only', vP.visits.w === 5 && vP.visits.d === 0, `poetry w=${vP.visits.w} d=${vP.visits.d}`);
  // reader1 visited this week AND 20 days ago; reader2 only this week.
  check('returning visitors are the share that came back this week', vF.returningPct === 50, `pct=${vF.returningPct}`);
  check('anonymous hits count as visits but never as returning', vF.visits.d > 2 && vF.returningPct === 50, `d=${vF.visits.d}`);

  /* ═══ 6. CREW — ONE TEAM PER BOARD, ASSIGNED HERE ═══ */
  r = await call('PUT', `${AB}/${fantasy.id}/crew`, { admins: ['nope'], moderators: [] }, signAccess(admin));
  check('an unknown crew id is refused', r.status === 400 && String(JSON.stringify(r.json)).includes('bad_user'), `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('PUT', `${AB}/${fantasy.id}/crew`, {}, signAccess(admin));
  check('an empty crew write is refused', r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('PUT', `${AB}/${fantasy.id}/crew`, { admins: [boardAdmin.id], moderators: [mod.id] }, signAccess(reader1));
  check('a reader cannot assign board crew', r.status === 403, `status=${r.status}`);
  r = await call('PUT', `${AB}/${fantasy.id}/crew`, { admins: [boardAdmin.id], moderators: [mod.id, boardAdmin.id] }, signAccess(admin));
  check('admin assigns the board team', r.status === 200 && r.json.admins.length === 1 && r.json.moderators.length === 1,
    `status=${r.status} ${JSON.stringify(r.json)}`);
  check('a person listed twice stays the admin, not also a mod', String(JSON.stringify(r.json.moderators)).indexOf(boardAdmin.id) === -1,
    JSON.stringify(r.json.moderators));

  r = await call('GET', AB + '?sort=members', undefined, signAccess(admin));
  const crewRow = (r.json.items || []).find(x => x.name === 'Fantasy') || {};
  const roles = (crewRow.mods || []).map(m => m.name + ':' + m.role);
  check('the board row lists its crew with names, avatars and roles',
    (crewRow.mods || []).length === 2 && crewRow.mods.every(m => m.name && m.avatar && m.role), JSON.stringify(crewRow.mods));
  check('the console shows one admin and one mod for the whole board',
    roles.includes('boards_crew_admin:Admin') && roles.includes('boards_crew_mod:Mod'), roles.join(' / '));

  /* the assigned moderator acts in EVERY child genre without joining */
  await CategoryMembership.deleteMany({ userId: mod.id, categoryId: fantasy.id });
  r = await call('POST', '/api/discussions', { genre: 'werewolf', title: 'Pack rules', tag: 'question' }, signAccess(mod));
  check('the board moderator posts in one child genre without joining', r.status === 201, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { genre: 'dragon-rider', title: 'Hatchling law', tag: 'question' }, signAccess(mod));
  check('the same moderator posts in another child genre too', r.status === 201, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { genre: 'verse', title: 'Not my board', tag: 'question' }, signAccess(mod));
  check('a crew member of one board cannot post in another', r.status === 403 && String(JSON.stringify(r.json)).includes('join_board_first'),
    `status=${r.status} ${JSON.stringify(r.json)}`);

  /* ═══ 7. FLAG / UNFLAG — REASON REQUIRED, PASSWORD CONFIRMED ═══ */
  r = await call('POST', `${AB}/${poetry.id}/flag`, { reason: 'Spam or scam', password: 'wrong-password' }, signAccess(admin));
  check('a wrong password does not flag the board', r.status === 401 && String(JSON.stringify(r.json)).includes('invalid_password'),
    `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', `${AB}/${poetry.id}/flag`, { password: ADMIN_PASS }, signAccess(admin));
  check('flagging without a reason is refused', r.status === 400, `status=${r.status}`);
  r = await call('POST', `${AB}/${poetry.id}/flag`, { reason: 'Spam or scam', note: 'Bots in the replies', password: ADMIN_PASS }, signAccess(admin));
  check('the admin flagged the board', r.status === 200 && r.json.flagReason === 'Spam or scam', `status=${r.status} ${JSON.stringify(r.json)}`);
  check('the flag mirrored into a pending Report', !!r.json.reportId, `reportId=${r.json && r.json.reportId}`);
  const flagReportId = r.json.reportId;
  const mirrored = await Report.findOne({ id: flagReportId }).lean();
  check('the report row names the board it was filed against',
    mirrored && mirrored.categoryId === poetry.id && mirrored.status === 'pending' && mirrored.title === 'Poetry',
    mirrored && JSON.stringify([mirrored.categoryId, mirrored.status, mirrored.title]));

  r = await call('GET', AB + '?status=flagged', undefined, signAccess(admin));
  check('the flagged filter returns only flagged boards',
    r.status === 200 && (r.json.items || []).length === 1 && r.json.items[0].name === 'Poetry', `n=${r.json && (r.json.items || []).length}`);
  const flagged = (r.json.items || [])[0] || {};
  check('the row carries the banner fields the page prints',
    flagged.flagReason === 'Spam or scam' && flagged.flagNote === 'Bots in the replies'
    && flagged.flaggedBy === admin.id && !!flagged.flaggedAt, JSON.stringify([flagged.flagReason, flagged.flaggedBy, flagged.flaggedAt]));
  r = await call('POST', `${AB}/${poetry.id}/flag`, { reason: 'Spam or scam', password: ADMIN_PASS }, signAccess(admin));
  check('flagging a board twice is refused', r.status === 409 && String(JSON.stringify(r.json)).includes('already_flagged'), `status=${r.status}`);

  r = await call('POST', `${AB}/${poetry.id}/unflag`, { password: 'nope' }, signAccess(admin));
  check('a wrong password does not unflag', r.status === 401, `status=${r.status}`);
  r = await call('POST', `${AB}/${poetry.id}/unflag`, { password: ADMIN_PASS }, signAccess(admin));
  check('unflag clears the board', r.status === 200 && r.json.flagReason === '', `status=${r.status} ${JSON.stringify(r.json)}`);
  const settled = await Report.findOne({ id: flagReportId }).lean();
  check('unflag settles the mirrored report',
    settled && settled.status === 'resolved' && String(settled.resolvedBy) === String(admin.id),
    JSON.stringify(settled && [settled.status, settled.resolutionNote]));
  check('unflagging leaves the thread reports in the queue alone',
    (await Report.findOne({ id: openReport.id }).lean() || {}).status === 'pending',
    JSON.stringify(await Report.findOne({ discussionId: t2.id, status: 'pending' }).lean() || {}).slice(0, 100));
  r = await call('POST', `${AB}/${poetry.id}/unflag`, { password: ADMIN_PASS }, signAccess(admin));
  check('unflagging a board that was never flagged is refused', r.status === 409, `status=${r.status}`);

  /* ═══ 8. SEARCH, SORT, PAGINATION ═══ */
  r = await call('GET', AB + '?q=fan', undefined, signAccess(admin));
  check('the search box matches the board name', r.status === 200 && r.json.total === 1 && r.json.items[0].name === 'Fantasy',
    `total=${r.json && r.json.total}`);
  r = await call('GET', AB + '?q=nothing-like-this', undefined, signAccess(admin));
  check('an unmatched search is an empty list, not an error', r.status === 200 && r.json.items.length === 0 && r.json.total === 0,
    `n=${r.json && (r.json.items || []).length}`);
  r = await call('GET', AB + '?sort=reports', undefined, signAccess(admin));
  check('sorting by open reports puts the busy board first',
    r.json.items[0].name === 'Fantasy' && r.json.items[0].reportsOpen >= r.json.items[1].reportsOpen,
    JSON.stringify(r.json.items.map(x => [x.name, x.reportsOpen])));
  r = await call('GET', AB + '?sort=name&limit=2&page=2', undefined, signAccess(admin));
  check('pagination walks the sorted catalogue', r.status === 200 && r.json.items.length === 1 && r.json.page === 2 && r.json.pages === 2,
    `n=${r.json && (r.json.items || []).length} pages=${r.json && r.json.pages}`);
  const failed = results.filter(x => !x.pass);
  console.log('\n===== ' + (results.length - failed.length) + '/' + results.length + ' live admin-boards assertions passed =====');
  failed.forEach(f => console.log('FAILED: ' + f.name));
  try { await mongod.stop(); } catch (e) { /* the box sometimes leaves mongod to the port reaper */ }
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
