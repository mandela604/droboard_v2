'use strict'
// Live HTTP + Mongo test for Super Admin Dashboard / Users / Insights surfaces.
// This verifies the backend returns EXACT shapes that frontend services expect.
process.env.NODE_ENV = 'test';
process.env.PORT = '4192';  // different from auth(4193) and coins(4181)
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const OUT = 'scripts/smoke-superadmin-pages.results.txt';

const PORT = 4192;
const BASE = 'http://127.0.0.1:' + PORT;
const SA = '/api/super-admin';

const results = [];
const logLines = [];
function say(s) { logLines.push(s); console.log(s); }
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
  say(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}
// UTC day arithmetic: iso(0) is now, iso(-1) exactly 24 h earlier — two
// consecutive reading days, which is what a streak is measured on.
function iso(dayOffset) { return new Date(Date.now() + dayOffset * 86400000).toISOString(); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Boot is async (listen fires after the role seed), and the fetch below would
// otherwise race it.
async function waitReady() {
  for (let i = 0; i < 160; i++) {
    try { const res = await fetch(BASE + '/health'); if (res.ok) return; } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('api never came up on ' + BASE);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_sa_pages');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  // Boot now ends with ensureIdIndexes(), so listen can land later than a fixed
  // sleep assumed — poll /health instead of guessing.
  await waitReady();

  const { User, AuditLog } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { Wallet, AuthorTransaction, SubscriptionPlan } = require('../src/models/money.model');
  const { Reaction, ShareEvent, LibraryItem, ReadingProgress } = require('../src/models/social.model');
  const { AdminRole } = require('../src/models/admin.model');
  const { signAccess } = require('../src/middleware/auth');

  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  
  // Create realistic test data
  const admin = await User.create({
    fullName: 'Tobenna Achebe', email: 'tobi@droboard.com',
    username: 'tobi_superadmin', passwordHash: DUMMY, status: 'active',
    primaryRole: 'admin', roles: ['admin'], platformRoles: ['superadmin']
  });
  
  const editor = await User.create({
    fullName: 'Adaeze Bello', email: 'adaeze@droboard.com',
    username: 'adaede_se', passwordHash: DUMMY, status: 'active',
    primaryRole: 'senior_editor', roles: ['senior_editor']
  });
  
  const reader = await User.create({
    fullName: 'Chioma Reader', email: 'chioma@droboard.com',
    username: 'chioma_reader', passwordHash: DUMMY, status: 'active',
    primaryRole: 'reader', roles: ['reader'], emailVerified: true
  });
  
  const author = await User.create({
    fullName: 'Ifeanyi Story', email: 'ifeanyi@droboard.com',
    username: 'ifeanyi_author', passwordHash: DUMMY, status: 'active',
    primaryRole: 'writer', roles: ['writer'], emailVerified: true,
    avatar: 'https://i.pravatar.cc/150?img=12'
  });
  
  const book1 = await Book.create({
    title: 'The runaway bride — I left at the altar in my socked feet',
    authorId: String(author.id), status: 'published', genre: 'Twist Fiction',
    reads: 900, cover: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg'
  });
  const book2 = await Book.create({
    title: 'My stepmother stole my university fund',
    authorId: String(author.id), status: 'published', genre: 'Revenge Drama',
    reads: 300, cover: 'https://i.postimg.cc/ftRZbhKx/3.jpg'
  });

  // Create wallets with some spend history
  await Wallet.create({
    userId: String(reader.id), kind: 'reader',
    coinBalance: 500, bonusBalance: 0
  });

  /* What the console claims about a reader must come from the collections the
     reader-facing services actually write. Seed those, production field shapes
     exactly, and assert the numbers the console returns. */
  await Promise.all([
    // 3 reactions given, 2 distinct shares, 2 distinct saves
    Reaction.create([
      { userId: String(reader.id), targetType: 'post', targetId: 'post_a', rid: 'love' },
      { userId: String(reader.id), targetType: 'post', targetId: 'post_b', rid: 'like' },
      { userId: String(reader.id), targetType: 'comment', targetId: 'cmt_c', rid: 'like' },
    ]),
    ShareEvent.create([
      { userId: String(reader.id), targetType: 'story', targetId: String(book1.id), channel: 'wa' },
      { userId: String(reader.id), targetType: 'post', targetId: 'post_a', channel: 'x' },
    ]),
    LibraryItem.create([
      { userId: String(reader.id), storyId: String(book1.id), list: 'saved', status: 'saved' },
      { userId: String(reader.id), storyId: String(book2.id), list: 'library', status: 'progress' },
    ]),
    // Reading: 3 chapter sessions across 2 consecutive days (yesterday, today),
    // 1800 s total → 0.5 h read, 10 min/session, 1.5 sessions per reading day,
    // streak 2.
    ReadingProgress.create([
      { userId: String(reader.id), storyId: String(book1.id), chapterId: 'ch1', secondsSpent: 600, wordsRead: 1200, lastReadAt: iso(-1) },
      { userId: String(reader.id), storyId: String(book1.id), chapterId: 'ch2', secondsSpent: 900, wordsRead: 1800, lastReadAt: iso(-1) },
      { userId: String(reader.id), storyId: String(book2.id), chapterId: 'ch3', secondsSpent: 300, wordsRead: 600, lastReadAt: iso(0) },
    ]),
    // What book1 actually earned its author.
    AuthorTransaction.create({
      authorId: String(author.id), bookId: String(book1.id), type: 'earned',
      status: 'completed', amount: 12500, desc: 'Chapter unlocks'
    }),
    // The plan the insights MRR card prices against.
    SubscriptionPlan.create({
      code: 'sub-monthly', name: 'Monthly', period: 'month', durationDays: 30,
      basePriceNGN: 3000, prices: { USD: 2 }, status: 'active'
    }),
    // Real RBAC doc: grants the contracts + moderation groups, nothing else.
    AdminRole.create({
      name: 'Platform Ops', slug: '', memberIds: [String(admin.id)],
      perms: { approve_contracts: true, ban_users: true, view_financials: false }
    }),
  ]);
  
  const tok = (u) => ({ 
    'Content-Type': 'application/json', 
    Authorization: 'Bearer ' + signAccess(u) 
  });
  
  async function call(method, path, body) {
    const init = { method, headers: tok(admin) };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(BASE + path, init);
    let json = null; try { json = await res.json(); } catch (e) {}
    return { status: res.status, json };
  }

  /* ── DASHBOARD SUMMARY ───────────────────────────────────── */
  say('\n=== TESTING DASHBOARD SUMMARY ===\n');
  await waitReady();
  
  let r = await call('GET', `${SA}/dashboard/summary`);
  check('GET /dashboard/summary -> 200', r.status === 200, `status=${r.status}`);
  
  const ds = r.json || {};
  check('dashboard has kpiCards array', Array.isArray(ds.kpiCards), `kpiCards type=${typeof ds.kpiCards}`);
  check('dashboard has revenueChart array', Array.isArray(ds.revenueChart), `revenueChart type=${typeof ds.revenueChart}`);
  check('dashboard has topStories array', Array.isArray(ds.topStories), `topStories type=${typeof ds.topStories}`);
  check('dashboard has activityLog array', Array.isArray(ds.activityLog), `activityLog type=${typeof ds.activityLog}`);
  check('dashboard has adminTeam array', Array.isArray(ds.adminTeam), `adminTeam type=${typeof ds.adminTeam}`);
  
  // Check KPI card structure
  if (ds.kpiCards && ds.kpiCards.length > 0) {
    const kpi = ds.kpiCards[0];
    check('kpiCard has required fields', !!kpi.n && !!kpi.l && !!kpi.ico, 
      `kpi={n:${!!kpi.n},l:${!!kpi.l},ico:${!!kpi.ico}}`);
  }
  
  // Check revenue chart structure
  if (ds.revenueChart && ds.revenueChart.length > 0) {
    const rev = ds.revenueChart[0];
    check('revenueChart row has m and v', !!rev.m && typeof rev.v === 'number', 
      `rev={m:${!!rev.m},v:${rev.v}}`);
  }
  
  // Check top stories structure (must match frontend expectations)
  if (ds.topStories && ds.topStories.length > 0) {
    const story = ds.topStories[0];
    check('topStory has title, writer, genre, reads, revenue', 
      !!story.title && !!story.writer && !!story.genre && typeof story.reads === 'number' && typeof story.revenue === 'number',
      JSON.stringify(story));
    // Also check cover URL exists
    check('topStory has cover url', !!story.cover || !!story.coverUrl, 
      `cover=${story.cover||story.coverUrl}`);
  }
  
  // Check activity feed structure
  if (ds.activityLog && ds.activityLog.length > 0) {
    const act = ds.activityLog[0];
    check('activityLog has ico, cls, text, time', 
      !!act.ico && !!act.cls && !!act.text && !!act.time,
      `act.ico=${act.ico},cls=${act.cls}`);
  }
  
  // Check admin team structure
  if (ds.adminTeam && ds.adminTeam.length > 0) {
    const adminRow = ds.adminTeam[0];
    check('adminTeam row has id, name, email, role, perms', 
      !!adminRow.id && !!adminRow.name && !!adminRow.email && !!adminRow.role,
      JSON.stringify(adminRow));
    check('adminTeam row has perms object', 
      adminRow.perms && typeof adminRow.perms === 'object',
      `perms=${JSON.stringify(adminRow.perms)}`);
  }

  /* ── REAL WRITES: activity, perms, revenue ───────────────── */
  say('\n=== TESTING ACTIVITY / PERMS / REVENUE FROM REAL DATA ===\n');

  // A staff action through the ordinary route is what records activity:
  // audit() writes AuditLog and the console feed reads from it.
  const wr = await call('PATCH', `${SA}/users/${reader.id}`, { notes: 'Top reader — watch the tip flow' });
  check('PATCH /users/:id -> 200', wr.status === 200, `status=${wr.status} ${JSON.stringify(wr.json)}`);
  await sleep(400); // audit() writes fire-and-forget on response finish

  const audited = await AuditLog.countDocuments({});
  check('audit() wrote AuditLog rows', audited > 0, `count=${audited}`);

  r = await call('GET', `${SA}/dashboard/summary`);
  const ds2 = r.json || {};
  check('activityLog panel is not permanently empty', (ds2.activityLog || []).length > 0,
    `len=${(ds2.activityLog || []).length}`);
  const act0 = (ds2.activityLog || [])[0] || {};
  check('activity names the real actor', /Tobenna Achebe/.test(act0.text || ''), `text=${act0.text}`);
  check('activity humanises the audit action', /Users updated/.test(act0.text || ''), `text=${act0.text}`);

  // book1 leads on reads and has one completed earning row.
  const top = (ds2.topStories || []).find(s => s.title === book1.title) || {};
  check('topStories[].revenue is what the book earned', top.revenue === 12500, `revenue=${top.revenue}`);

  const team = (ds2.adminTeam || []).find(a => String(a.id) === String(admin.id)) || {};
  check('adminTeam role label comes from the AdminRole doc', team.role === 'Platform Ops', `role=${team.role}`);
  check('adminTeam perms roll up from the real role flags',
    JSON.stringify(team.perms) === JSON.stringify({ contracts: true, campaigns: false, moderation: true, finance: false, admins: false }),
    `perms=${JSON.stringify(team.perms)}`);

  /* ── DASHBOARD PANEL ENDPOINTS (the page fetches these individually) ── */
  say('\n=== TESTING DASHBOARD PANEL ENDPOINTS ===\n');
  const panels = [
    ['kpis', 'kpiCards'], ['revenue', 'revenueChart'],
    ['top-stories', 'topStories'], ['activity', 'activityLog'],
  ];
  for (const [path, field] of panels) {
    const pr = await call('GET', `${SA}/dashboard/${path}`);
    check(`GET /dashboard/${path} -> 200`, pr.status === 200, `status=${pr.status}`);
    check(`/dashboard/${path} returns the summary's ${field}`, Array.isArray(pr.json),
      `type=${Array.isArray(pr.json) ? 'array' : typeof pr.json}`);
    check(`/dashboard/${path} matches /dashboard/summary`, JSON.stringify(pr.json) === JSON.stringify(ds2[field]),
      `panel=${(pr.json || []).length} summary=${(ds2[field] || []).length}`);
  }

  r = await call('GET', `${SA}/admins`);
  check('GET /admins -> 200', r.status === 200, `status=${r.status}`);
  check('GET /admins returns the admin team', Array.isArray(r.json) && r.json.some(a => String(a.id) === String(admin.id)),
    `len=${(r.json || []).length}`);

  /* ── ADMIN TEAM CRUD (Add Admin modal) ── */
  say('\n=== TESTING ADMIN TEAM CRUD ===\n');
  const newAdminEmail = 'ops.lead@droboard.com';
  const adminCreated = await call('POST', `${SA}/admins`, {
    name: 'Ops Lead', email: newAdminEmail, password: 'Sup3rSecret!',
    role: 'Chief Editor', status: 'active',
  });
  check('POST /admins -> 201', adminCreated.status === 201, `status=${adminCreated.status} ${JSON.stringify(adminCreated.json)}`);
  check('new admin can be found by email', !!adminCreated.json && adminCreated.json.email === newAdminEmail, `email=${adminCreated.json && adminCreated.json.email}`);
  const newAdminId = adminCreated.json && adminCreated.json.id;
  check('new admin stores the admin role', !!newAdminId, `id=${newAdminId}`);

  const newAdminDoc = newAdminId ? await User.findOne({ id: newAdminId }).select('roles passwordHash').lean() : null;
  check('new admin is a real sign-in account (argon2 hash)', !!(newAdminDoc && /^\$argon2/.test(String(newAdminDoc.passwordHash || ''))),
    `hash=${newAdminDoc ? String(newAdminDoc.passwordHash).slice(0, 10) : 'missing'}`);
  check('new admin carries the admin gate role', !!(newAdminDoc && (newAdminDoc.roles || []).includes('admin')),
    `roles=${newAdminDoc ? JSON.stringify(newAdminDoc.roles) : 'missing'}`);

  const dupAdmin = await call('POST', `${SA}/admins`, {
    name: 'Ops Lead Again', email: newAdminEmail, password: 'Sup3rSecret!', role: 'Chief Editor',
  });
  check('POST /admins rejects a duplicate email', dupAdmin.status === 409, `status=${dupAdmin.status}`);

  const shortPw = await call('POST', `${SA}/admins`, {
    name: 'No Password', email: 'nopw@droboard.com', password: 'short', role: 'Chief Editor',
  });
  check('POST /admins rejects a short password', shortPw.status === 400, `status=${shortPw.status} ${JSON.stringify(shortPw.json)}`);

  const ua = await call('PUT', `${SA}/admins/${newAdminId}`, { name: 'Ops Lead II', role: 'Content Moderator', status: 'suspended' });
  check('PUT /admins/:id -> 200', ua.status === 200, `status=${ua.status} ${JSON.stringify(ua.json)}`);
  check('PUT /admins/:id applies the edit', ua.json && ua.json.name === 'Ops Lead II', `name=${ua.json && ua.json.name}`);

  const selfRm = await call('DELETE', `${SA}/admins/${admin.id}`);
  check('DELETE /admins/:id refuses removing yourself', selfRm.status === 400, `status=${selfRm.status} ${JSON.stringify(selfRm.json)}`);

  const da = await call('DELETE', `${SA}/admins/${newAdminId}`);
  check('DELETE /admins/:id -> 200', da.status === 200, `status=${da.status} ${JSON.stringify(da.json)}`);
  const goneDoc = newAdminId ? await User.findOne({ id: newAdminId }).select('deletedAt status').lean() : null;
  check('removed admin is soft-deleted', !!(goneDoc && goneDoc.deletedAt), `deletedAt=${goneDoc && goneDoc.deletedAt}`);

  /* ── GIVING ROLES (Users console -> AdminRole membership -> perms) ── */
  say('\n=== TESTING ROLE GRANTS: CHIEF / SENIOR EDITOR / FINANCE / MARKETING ===\n');
  const roleList = await call('GET', `${SA}/roles`);
  check('GET /roles -> 200 array', roleList.status === 200 && Array.isArray(roleList.json),
    `status=${roleList.status} len=${(roleList.json || []).length}`);
  const GRANTS = [
    ['Chief Editor', 'chief_editor'],
    ['Senior Editor', 'senior_editor'],
    ['Finance', 'finance'],
    ['Marketing', 'marketing'],
  ];
  for (const [label, slug] of GRANTS) {
    const gr = await call('PATCH', `${SA}/users/${reader.id}`, { role: label });
    check(`PATCH /users/:id role=${label} -> 200`, gr.status === 200, `status=${gr.status} ${JSON.stringify(gr.json && gr.json.error)}`);
    check(`user row now shows ${label}`, gr.json && gr.json.role === label, `role=${gr.json && gr.json.role}`);

    const doc = await User.findOne({ id: String(reader.id) }).select('roles primaryRole').lean();
    check(`stored roles include ${slug}`, !!(doc && (doc.roles || []).includes(slug)),
      `roles=${JSON.stringify((doc && doc.roles) || [])}`);

    const rolesNow = await call('GET', `${SA}/roles`);
    const roleDoc = (rolesNow.json || []).find(x => x.slug === slug) || {};
    const members = await AdminRole.findOne({ slug }).select('memberIds').lean();
    check(`${label} role lists this member on the Roles page`,
      !!(members && (members.memberIds || []).map(String).includes(String(reader.id))),
      `members=${(members && members.memberIds || []).length} roleDocMembers=${roleDoc.memberCount}`);
  }

  const revoked = await call('PATCH', `${SA}/users/${reader.id}`, { roles: ['reader'] });
  check('PATCH /users/:id roles=[reader] -> 200', revoked.status === 200, `status=${revoked.status}`);
  const afterRevoke = await User.findOne({ id: String(reader.id) }).select('roles').lean();
  check('revoked roles are gone from the user',
    !!(afterRevoke && !(afterRevoke.roles || []).some(r => GRANTS.some(g => g[1] === r))),
    `roles=${JSON.stringify(afterRevoke && afterRevoke.roles)}`);
  const staleDocs = await AdminRole.find({ slug: { $in: GRANTS.map(g => g[1]) } }).select('slug memberIds').lean();
  check('revoked member is pulled from every role page',
    staleDocs.every(d => !(d.memberIds || []).map(String).includes(String(reader.id))),
    `docs=${staleDocs.length}`);

  /* ── USERS LIST ──────────────────────────────────────────── */
  say('\n=== TESTING USERS LIST ===\n');
  
  r = await call('GET', `${SA}/users?limit=50&q=&role=&status=`);
  check('GET /users -> 200', r.status === 200, `status=${r.status}`);
  check('users list has items array', Array.isArray(r.json.items), `items type=${Array.isArray(r.json.items) ? 'OK' : typeof r.json.items}`);
  
  const users = r.json.items || [];
  check('users list returns created users', users.length >= 4, `found=${users.length} expected>=4`);
  
  if (users.length > 0) {
    const user = users[0];
    check('user row has id, name, email, username', 
      !!user.id && !!user.name && !!user.email && !!user.username,
      JSON.stringify(user));
    check('user row has role field', !!user.role || Array.isArray(user.roles), 
      `role=${user.role},roles=${JSON.stringify(user.roles)}`);
    check('user row has stats object', user.stats && typeof user.stats === 'object',
      `stats=${JSON.stringify(user.stats)}`);
    check('user row has wallet.balance.coins', typeof user.wallet?.balance?.coins === 'number',
      `coins=${user.wallet?.balance?.coins}`);
    check('user row has coinsSpent (not naira)', typeof user.coinsSpent === 'number',
      `coinsSpent=${user.coinsSpent}`);
  }

  // Engagement + reading figures are aggregated from the collections the
  // reader services write, so the seeded rows above have to show up as numbers.
  const rdRow = users.find(x => String(x.id) === String(reader.id)) || {};
  check('likesGiven counts the reader Reaction rows', rdRow.likesGiven === 3, `likesGiven=${rdRow.likesGiven}`);
  check('sharesCount counts distinct ShareEvent targets', rdRow.sharesCount === 2, `sharesCount=${rdRow.sharesCount}`);
  check('savesCount counts distinct saved + library stories', rdRow.savesCount === 2, `savesCount=${rdRow.savesCount}`);
  check('readingHours comes from secondsSpent', rdRow.readingHours === 0.5, `readingHours=${rdRow.readingHours}`);
  check('avgSessionMin is minutes per chapter session', rdRow.avgSessionMin === 10, `avgSessionMin=${rdRow.avgSessionMin}`);
  check('streakDays is the consecutive-day run', rdRow.streakDays === 2, `streakDays=${rdRow.streakDays}`);
  check('topGenres are the genres actually read',
    JSON.stringify(rdRow.topGenres) === JSON.stringify([{ name: 'Revenge Drama', count: 1 }, { name: 'Twist Fiction', count: 1 }]),
    `topGenres=${JSON.stringify(rdRow.topGenres)}`);

  /* ── SINGLE USER DETAILS ────────────────────────────────── */
  say('\n=== TESTING SINGLE USER DETAILS ===\n');
  
  if (users.length > 0) {
    const uid = users[0].id;
    r = await call('GET', `${SA}/users/${uid}`);
    check('GET /users/:id -> 200', r.status === 200, `status=${r.status}`);
    
    const ud = r.json || {};
    check('user detail matches list fields', ud.id === uid && ud.name && ud.email, 
      `id=${ud.id},name=${ud.name}`);
    check('user detail has profile info', ud.profile || ud.avatar, 
      `profile=${JSON.stringify(ud.profile)},avatar=${ud.avatar}`);
  }

  // The detail route has to aggregate the same figures the list shows —
  // otherwise the drawer renders zeros next to a populated table row.
  const det = await call('GET', `${SA}/users/${reader.id}`);
  check('GET /users/:id -> 200 for the reader', det.status === 200, `status=${det.status}`);
  const dd = det.json || {};
  check('user detail carries engagement aggregates',
    dd.likesGiven === 3 && dd.sharesCount === 2 && dd.savesCount === 2,
    `likes=${dd.likesGiven},shares=${dd.sharesCount},saves=${dd.savesCount}`);
  check('user detail carries reading aggregates',
    dd.readingHours === 0.5 && dd.avgSessionMin === 10 && dd.streakDays === 2 && (dd.topGenres || []).length === 2,
    `h=${dd.readingHours},min=${dd.avgSessionMin},streak=${dd.streakDays},genres=${JSON.stringify(dd.topGenres)}`);

  /* ── INSIGHTS OVERVIEW ───────────────────────────────────── */
  say('\n=== TESTING INSIGHTS OVERVIEW ===\n');
  
  r = await call('GET', `${SA}/insights/overview`);
  check('GET /insights/overview -> 200', r.status === 200, `status=${r.status}`);
  
  const io = r.json || {};
  check('overview has users array', Array.isArray(io.users), `users type=${typeof io.users}`);
  check('overview has ex array (expenditure)', Array.isArray(io.ex), `ex type=${typeof io.ex}`);
  check('overview has cohorts array', Array.isArray(io.cohorts), `cohorts type=${typeof io.cohorts}`);
  
  // Check user rows in overview
  if (io.users && io.users.length > 0) {
    const ovUser = io.users[0];
    check('overview user has coinsSpent, coinsBought', 
      typeof ovUser.coinsSpent === 'number' && typeof ovUser.coinsBought === 'number',
      `coinsSpent=${ovUser.coinsSpent},coinsBought=${ovUser.coinsBought}`);
  }
  
  // Check expenditure rows
  if (io.ex && io.ex.length > 0) {
    const expRow = io.ex[0];
    check('expenditure row has u (userId) and x object', 
      !!expRow.u && !!expRow.x && typeof expRow.x === 'object',
      JSON.stringify(expRow));
    check('expenditure x has funded', typeof expRow.x.funded === 'number',
      `funded=${expRow.x.funded}`);
  }

  // MRR = premium count × plan price, so the price has to be the catalog's,
  // and sessionsPerDay has to be sessions — not words divided by a guess.
  check('subPrice is the live monthly plan USD leg', io.subPrice === 2, `subPrice=${io.subPrice}`);
  const readerEx = (io.ex || []).find(x => String(x.u) === String(reader.id)) || {};
  check('sessionsPerDay is chapter sessions per reading day',
    readerEx.x && readerEx.x.sessionsPerDay === 1.5, `sessionsPerDay=${readerEx.x && readerEx.x.sessionsPerDay}`);
  const ioReader = (io.users || []).find(x => String(x.id) === String(reader.id)) || {};
  check('insights user rows carry engagement + reading too',
    ioReader.likesGiven === 3 && ioReader.savesCount === 2 && ioReader.streakDays === 2,
    `likes=${ioReader.likesGiven},saves=${ioReader.savesCount},streak=${ioReader.streakDays}`);
  const otherRow = (io.users || []).find(x => String(x.id) === String(author.id)) || {};
  check('a user with no activity reads as zero, not as a gap',
    otherRow.likesGiven === 0 && otherRow.readingHours === 0 && Array.isArray(otherRow.topGenres),
    `likes=${otherRow.likesGiven},h=${otherRow.readingHours}`);

  /* ── LEADERBOARD ─────────────────────────────────────────── */
  say('\n=== TESTING LEADERBOARD ===\n');
  
  r = await call('GET', `${SA}/insights/leaderboard?type=tips&role=&limit=20`);
  check('GET /insights/leaderboard -> 200', r.status === 200, `status=${r.status}`);
  
  const lb = r.json || {};
  check('leaderboard has items array', Array.isArray(lb.items), `items type=${typeof lb.items}`);
  
  if (lb.items && lb.items.length > 0) {
    const leader = lb.items[0];
    check('leaderboard row has id, name, value', 
      !!leader.id && !!leader.name && typeof leader.value === 'number',
      JSON.stringify(leader));
  }

  /* ── ANALYTICS SUMMARY ───────────────────────────────────── */
  say('\n=== TESTING ANALYTICS SUMMARY ===\n');
  
  r = await call('GET', `${SA}/analytics/summary`);
  check('GET /analytics/summary -> 200', r.status === 200, `status=${r.status}`);
  
  const as = r.json || {};
  check('analytics summary has totalUsers', typeof as.totalUsers === 'number', 
    `totalUsers=${as.totalUsers}`);
  check('analytics summary has totalRevenue', typeof as.totalRevenue === 'number',
    `totalRevenue=${as.totalRevenue}`);
  check('analytics summary has monthlyRevenue array', Array.isArray(as.monthlyRevenue),
    `monthlyRevenue type=${typeof as.monthlyRevenue}`);

  /* ── THE SAME FEED IN EVERY CONSOLE ──────────────────────── */
  say('\n=== TESTING CHIEF / FINANCE / MARKETING ACTIVITY FEED ===\n');

  // All four "Recent activity" panels read AuditLog through
  // activity-feed.service, so one recorded staff action lights them all up.
  for (const [label, path] of [
    ['chief', '/api/chief/dashboard'],
    ['finance', '/api/finance/dashboard'],
    ['marketing', '/api/marketing/dashboard'],
  ]) {
    const rr = await call('GET', path);
    const list = (rr.json && rr.json.recentActivity) || [];
    check(`${label} dashboard activity feeds from AuditLog`,
      rr.status === 200 && list.length > 0, `status=${rr.status} len=${list.length} body=${JSON.stringify(rr.json && rr.json.recentActivity)}`);
    if (list.length) check(`${label} activity row has icon/color/text/time`,
      !!list[0].icon && !!list[0].color && !!list[0].text && !!list[0].time, JSON.stringify(list[0]));
  }

  const ca = await call('GET', '/api/chief/activity?limit=10');
  check('GET /api/chief/activity -> 200 with rows',
    ca.status === 200 && Array.isArray(ca.json.items) && ca.json.items.length > 0,
    `status=${ca.status} items=${ca.json && ca.json.items && ca.json.items.length}`);
  const car = (ca.json && ca.json.items || [])[0] || {};
  check('chief activity row carries action + actor + time',
    !!car.action && !!car.userLabel && !!car.at, JSON.stringify(car).slice(0, 200));

  finish();
}

function finish() {
  const passed = results.filter(x => x.pass).length;
  const line = `\n===== ${passed}/${results.length} Super Admin page assertions passed =====`;
  say(line);
  results.filter(x => !x.pass).forEach(f => say(`  FAIL ${f.name} :: ${f.detail}`));
  try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (e) {}
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { say('FATAL ' + (e && e.stack || e)); try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (x) {} process.exit(1); });
