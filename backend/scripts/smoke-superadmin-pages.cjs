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

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_sa_pages');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  await new Promise(r => setTimeout(r, 2000));

  const { User, AuthorProfile } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { Wallet } = require('../src/models/money.model');
  const { signAccess } = require('../src/middleware/auth');

  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  
  // Create realistic test data
  const admin = await User.create({
    fullName: 'Tobenna Achebe', email: 'tobi@droboard.com',
    username: 'tobi_superadmin', passwordHash: DUMMY, status: 'active',
    roles: ['admin'], platformRoles: ['superadmin']
  });
  
  const editor = await User.create({
    fullName: 'Adaeze Bello', email: 'adaeze@droboard.com',
    username: 'adaede_se', passwordHash: DUMMY, status: 'active',
    roles: ['editor'], platformRoles: ['senior_editor']
  });
  
  const reader = await User.create({
    fullName: 'Chioma Reader', email: 'chioma@droboard.com',
    username: 'chioma_reader', passwordHash: DUMMY, status: 'active',
    roles: ['reader'], verified: true,
    stats: { reads: 523000, likes: 45200, saves: 12300, shares: 3400, chapters: 142, followers: 8900 }
  });
  
  const author = await User.create({
    fullName: 'Ifeanyi Story', email: 'ifeanyi@droboard.com',
    username: 'ifeanyi_author', passwordHash: DUMMY, status: 'active',
    roles: ['writer', 'author'], verified: true,
    avatar: 'https://i.pravatar.cc/150?img=12'
  });
  
  const book1 = await Book.create({
    title: 'The runaway bride — I left at the altar in my socked feet',
    authorId: String(author.id), status: 'published', genre: 'Twist Fiction',
    cover: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg'
  });
  const book2 = await Book.create({
    title: 'My stepmother stole my university fund',
    authorId: String(author.id), status: 'published', genre: 'Revenge Drama',
    cover: 'https://i.postimg.cc/ftRZbhKx/3.jpg'
  });

  // Create wallets with some spend history
  await Wallet.create({
    userId: String(reader.id), kind: 'reader',
    coinBalance: 500, bonusBalance: 0
  });
  
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
    check('user detail has statistics', ud.stories || ud.wordsRead, 
      `stories=${ud.stories},wordsRead=${ud.wordsRead}`);
  }

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
