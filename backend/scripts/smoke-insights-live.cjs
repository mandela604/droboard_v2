'use strict'
// Live insights contract. The Insights page renders one payload shape for
// four surfaces (board / profile / collection / droboard), so this boots the
// REAL Express app against in-memory MongoDB and asserts:
//   POST /api/track/insight   → raw visits AND unique visits, where one reader
//                               reloading inside the 20-minute window counts
//                               once, and counts again after it lapses
//   GET  /api/insights/:surface → hero labels, card set, bucket shapes
//   the per-surface access gates (board crew, profile self, collection owner,
//                               staff-only droboard)
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_INSIGHTS_PORT || '4219';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 220) : ''}`);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('droboard_insights');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const origin = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(origin + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Category } = require('../src/models/content.model');
  const { Collection, InsightVisitor } = require('../src/models/social.model');
  const jwt = require('jsonwebtoken');

  async function call(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(origin + path, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  const stamp = Date.now();
  const MIN = 60000;
  const tok = (u, roles) => jwt.sign({ sub: u.id, roles: roles || ['reader'] }, process.env.JWT_ACCESS_SECRET);

  const chief = await User.create({
    id: 'usr_ic_' + stamp, username: 'insight_chief', fullName: 'Insight Chief',
    email: 'insight_chief@t.co', passwordHash: 'x', roles: ['chief_editor'], primaryRole: 'editor',
    status: 'active', avatar: 'https://i.postimg.cc/fkdXzjSj/wife.jpg',
  });
  const crew = await User.create({
    id: 'usr_ib_' + stamp, username: 'insight_board', fullName: 'Insight Board Admin',
    email: 'insight_board@t.co', passwordHash: 'x', roles: ['writer'], primaryRole: 'writer',
    status: 'active', avatar: 'https://i.postimg.cc/fkdXzjSj/wife.jpg',
  });
  const reader = await User.create({
    id: 'usr_ir_' + stamp, username: 'insight_reader', fullName: 'Insight Reader',
    email: 'insight_reader@t.co', passwordHash: 'x', roles: ['reader'], primaryRole: 'reader',
    status: 'active', avatar: 'https://i.postimg.cc/fkdXzjSj/wife.jpg',
  });
  const chiefTok = tok(chief, ['chief_editor']);
  const crewTok = tok(crew, ['writer']);
  const readerTok = tok(reader);

  const cat = await Category.create({
    id: 'cat_ins_' + stamp, name: 'Fantasy', slug: 'fantasy-board',
    desc: 'Dragons, courts and bargains.', status: 'active',
    booksCount: 0, membersCount: 0, adminIds: [crew.id], moderatorIds: [],
  });
  const col = await Collection.create({
    id: 'coll_ins_' + stamp, title: 'Night Reads', name: 'Night Reads', ownerId: chief.id,
    stories: [], storiesCount: 0, followers: 0, visits: 12, sharesCount: 0,
  });

  /* ═══ 1. THE 20-MINUTE UNIQUE WINDOW ═══ */
  const hit = (body, token) => call('POST', '/api/track/insight', Object.assign({ surface: 'profile', targetId: 'insight_chief' }, body), token);
  const stats = () => call('GET', '/api/track/insight?surface=profile&targetId=insight_chief&period=7d', undefined, chiefTok);

  for (let i = 0; i < 3; i++) await hit({ deviceId: 'dev-same' }, chiefTok);
  let s = (await stats()).json;
  check('three reloads by one reader = 3 raw visits', s.visits === 3, JSON.stringify({ visits: s.visits }));
  check('three reloads inside the window = 1 unique visit', s.unique === 1, JSON.stringify({ unique: s.unique }));
  check('unique window is published as 20 minutes', s.uniqueWindowMinutes === 20, s.uniqueWindowMinutes);

  // Same reader, another tab/device id: still one person, so still one unique.
  await hit({ deviceId: 'dev-other-tab' }, chiefTok);
  s = (await stats()).json;
  check('signed-in reader dedupes by user, not by device', s.unique === 1, JSON.stringify({ visits: s.visits, unique: s.unique }));

  // Backdate past the window and hit again — the reader counts a second time.
  await InsightVisitor.updateOne(
    { surface: 'profile', targetId: 'insight_chief', visitorKey: 'u:' + chief.id },
    { $set: { lastSeenAt: new Date(Date.now() - 21 * MIN) } },
  );
  await hit({ deviceId: 'dev-same' }, chiefTok);
  s = (await stats()).json;
  check('the same reader counts again after 20 minutes', s.unique === 2, JSON.stringify({ visits: s.visits, unique: s.unique }));

  // An anonymous visitor is deduped by the device id the tracker mints.
  await hit({ deviceId: 'dev-anon-1' }, null);
  await hit({ deviceId: 'dev-anon-1' }, null);
  s = (await stats()).json;
  check('anonymous device dedupes by deviceId', s.unique === 3 && s.uniqueVisitors === 2, JSON.stringify({ unique: s.unique, uniqueVisitors: s.uniqueVisitors }));

  // No identity at all: the raw counter keeps the hit, the unique counter
  // cannot tell two visitors apart so it stays where it was.
  const beforeUnique = s.unique;
  await call('POST', '/api/track/insight', { surface: 'profile', targetId: 'insight_chief' }, null);
  s = (await stats()).json;
  check('hit with no user and no device still counts as a visit', s.visits === 8, s.visits);
  check('hit with no identity never inflates unique visits', s.unique === beforeUnique, JSON.stringify({ before: beforeUnique, after: s.unique }));

  /* ═══ 2. PAYLOAD SHAPE PER SURFACE ═══ */
  const prof = await call('GET', '/api/insights/profile?period=7d&handle=insight_chief', undefined, chiefTok);
  check('profile hero is "Profile views"', prof.status === 200 && prof.json.hero.label === 'Profile views', prof.json.hero && prof.json.hero.label);
  check('profile leads with the Unique visits card', prof.json.cards[0].label === 'Unique visits' && prof.json.cards[0].v === '3', JSON.stringify(prof.json.cards[0]));
  const allTime = await call('GET', '/api/insights/profile?period=all&handle=insight_chief', undefined, chiefTok);
  check('unique card names how many readers the visits were, with no delta to show',
    /^2 visitors$/.test(allTime.json.cards[0].s.t), allTime.json.cards[0].s.t);

  await call('POST', '/api/track/insight', { surface: 'hub', targetId: 'fantasy-board' }, crewTok);
  await call('POST', '/api/track/insight', { surface: 'hub', targetId: 'fantasy-board' }, crewTok);
  const hub = await call('GET', '/api/insights/hub?period=7d&genre=fantasy-board', undefined, crewTok);
  check('board hero is "Board views"', hub.status === 200 && hub.json.hero.label === 'Board views', hub.json.hero && hub.json.hero.label);
  check('board unique visits dedupe two crew reloads to 1', hub.json.cards[0].label === 'Unique visits' && hub.json.cards[0].v === '1', JSON.stringify(hub.json.cards[0]));

  await call('POST', '/api/track/insight', { surface: 'collection', targetId: col.id }, chiefTok);
  const coll = await call('GET', '/api/insights/collection?period=7d&id=' + col.id, undefined, chiefTok);
  check('collection hero is "Collection views"', coll.status === 200 && coll.json.hero.label === 'Collection views', coll.json.hero && coll.json.hero.label);
  check('collection keeps the all-time Total views card', coll.json.cards.some(c => c.label === 'Total views'), JSON.stringify(coll.json.cards.map(c => c.label)));

  await call('POST', '/api/track/insight', { surface: 'droboard', targetId: '' }, chiefTok);
  const drb = await call('GET', '/api/insights/droboard?period=7d', undefined, chiefTok);
  check('droboard hero is "Page visits"', drb.status === 200 && drb.json.hero.label === 'Page visits', drb.json.hero && drb.json.hero.label);

  /* ═══ 3. PERIOD BUCKETS ═══ */
  const shapes = { today: 6, '7d': 7, month: 10, all: 6 };
  for (const [p, n] of Object.entries(shapes)) {
    const r = await call('GET', '/api/insights/profile?period=' + p + '&handle=insight_chief', undefined, chiefTok);
    check('period ' + p + ' answers ' + n + ' buckets', r.status === 200 && r.json.series.length === n, r.json && r.json.series && r.json.series.length);
  }
  const bad = await call('GET', '/api/insights/profile?period=nope&handle=insight_chief', undefined, chiefTok);
  check('unknown period is rejected, not silently defaulted', bad.status === 400 && bad.json.error === 'invalid_input', bad.status + ' ' + (bad.json && bad.json.error));

  /* ═══ 4. GATES ═══ */
  check('board crew reads their board', hub.status === 200, hub.status);
  const outsider = await call('GET', '/api/insights/hub?period=7d&genre=fantasy-board', undefined, readerTok);
  check('a reader who is not crew gets 403 on the board', outsider.status === 403, outsider.status);
  const otherProfile = await call('GET', '/api/insights/profile?period=7d&handle=insight_reader', undefined, readerTok);
  check('a reader can read their own profile', otherProfile.status === 200, otherProfile.status);
  const spyProfile = await call('GET', '/api/insights/profile?period=7d&handle=insight_chief', undefined, readerTok);
  check('a reader cannot read someone else profile', spyProfile.status === 403, spyProfile.status);
  const staff = await call('GET', '/api/insights/profile?period=7d&handle=insight_chief', undefined, chiefTok);
  check('staff reads any profile', staff.status === 200, staff.status);
  const drbReader = await call('GET', '/api/insights/droboard?period=7d', undefined, readerTok);
  check('droboard insights stay staff-only', drbReader.status === 403, drbReader.status);
  const anon = await call('GET', '/api/insights/hub?period=7d&genre=fantasy-board');
  check('anonymous cannot read insights', anon.status === 401 || anon.status === 403, anon.status);

  const summary = results.filter(r => r.pass).length + '/' + results.length;
  console.log('\n' + summary + ' checks passed');
  await mongod.stop();
  process.exit(results.every(r => r.pass) ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
