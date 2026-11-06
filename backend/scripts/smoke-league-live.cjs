'use strict';
// Live reader-league contract (leaderboard.html ← league-service.js).
// Boots the REAL Express app against in-memory MongoDB and asserts the two
// things the page could not do before:
//   1. GET /api/league/board carries the league config (enabled, weights,
//      action labels/icons, prizes) — the only config endpoint is staff-gated,
//      so a reader used to score and read prizes from their own localStorage.
//   2. Badges are earned server-side when the week settles and come back on
//      GET /api/league/me, instead of being minted in the browser.
// Plus the scoring, scope and gate behaviour around them.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_LEAGUE_PORT || '4235';
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
  process.env.MONGO_URI = mongod.getUri('droboard_league');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const origin = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(origin + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { LeagueActivity, LeagueBadge } = require('../src/models/marketing.model');
  const surfaces = require('../src/services/marketing-surfaces.service');
  const scheduler = require('../src/services/scheduler.service');
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
  const DAY = 86400000;
  const tok = (u, roles) => jwt.sign({ sub: u.id, roles: roles || ['reader'] }, process.env.JWT_ACCESS_SECRET);
  const mk = (role, name, slug) => User.create({
    id: 'usr_lg_' + slug + '_' + stamp, username: slug, fullName: name,
    email: slug + '@t.co', passwordHash: 'x', roles: [role], primaryRole: role,
    status: 'active', avatar: 'https://i.postimg.cc/fkdXzjSj/wife.jpg',
  });
  const marketer = await mk('marketing', 'Mira League', 'league_marketer');
  const champ = await mk('reader', 'Ada Champion', 'ada_champ');
  const second = await mk('reader', 'Ben Second', 'ben_second');
  const third = await mk('reader', 'Cleo Third', 'cleo_third');
  const nobody = await mk('reader', 'Dee Nobody', 'dee_nobody');
  const mktTok = tok(marketer, ['marketing']);
  const champTok = tok(champ);
  const nobodyTok = tok(nobody);

  /* ═══ 1. THE BOARD CARRIES THE CONFIG A READER NEEDS ═══ */
  const anonBoard = await call('GET', '/api/league/board');
  check('anonymous readers can read the board', anonBoard.status === 200, anonBoard.status);
  check('board ships enabled', anonBoard.json.enabled === true, anonBoard.json.enabled);
  check('board ships the default weights', anonBoard.json.weights.chapter === 10 && anonBoard.json.weights.win === 25, JSON.stringify(anonBoard.json.weights));
  check('board ships the prize ladder', Array.isArray(anonBoard.json.prizes) && anonBoard.json.prizes.length === 3, JSON.stringify((anonBoard.json.prizes || []).map(p => p.place)));
  check('board ships actionLabels/actionIcons maps', !!anonBoard.json.actionLabels && !!anonBoard.json.actionIcons, Object.keys(anonBoard.json).join(','));

  // Marketing edits the config; a reader must see the edit on the board.
  const saved = await call('PUT', '/api/marketing/league/config', {
    weights: { chapter: 12, speedread: 7 },
    actionLabels: { speedread: 'Speed read' },
    actionIcons: { speedread: 'fa-bolt' },
    prizes: [
      { place: 1, badge: 'Crown of the Week', icon: 'fa-crown', color: '#f59e0b' },
      { place: 2, badge: 'Silver Week', icon: 'fa-medal', color: '#a0a0b0' },
      { place: 3, badge: 'Bronze Week', icon: 'fa-medal', color: '#a07040' },
    ],
  }, mktTok);
  check('marketing can save the league config', saved.status === 200, saved.status);
  const b2 = (await call('GET', '/api/league/board')).json;
  check('board reflects the edited weight', b2.weights.chapter === 12, b2.weights.chapter);
  check('board reflects a custom action label + icon', b2.actionLabels.speedread === 'Speed read' && b2.actionIcons.speedread === 'fa-bolt', JSON.stringify(b2.actionLabels));
  check('board reflects the edited prize names', b2.prizes[0].badge === 'Crown of the Week', b2.prizes[0].badge);

  /* ═══ 2. SCORING ═══ */
  const t1 = await call('POST', '/api/league/track', { action: 'chapter', n: 3 }, champTok);
  check('a weighted action scores weight × n', t1.status === 200 && t1.json.points === 36, JSON.stringify(t1.json));
  const t2 = await call('POST', '/api/league/track', { action: 'speedread' }, champTok);
  check('a custom admin action scores without a code change', t2.json.points === 7, JSON.stringify(t2.json));
  const t3 = await call('POST', '/api/league/track', { action: 'not_a_real_action' }, champTok);
  check('an unweighted action scores 0, not a free point', t3.json.points === 0, JSON.stringify(t3.json));
  const t4 = await call('POST', '/api/league/track', { action: 'chapter', n: 9999 }, champTok);
  check('an oversized n is rejected, not silently clamped', t4.status === 400, t4.status);
  const t5 = await call('POST', '/api/league/track', { action: 'chapter', n: 500 }, champTok);
  check('n at the 500 cap scores the full weight', t5.json.points === 12 * 500, t5.json.points);

  await call('POST', '/api/league/track', { action: 'chapter', n: 1 }, tok(second));
  await call('POST', '/api/league/track', { action: 'hour', n: 1 }, tok(third));

  const b3 = (await call('GET', '/api/league/board', undefined, champTok)).json;
  const row = b3.entries.find(e => String(e.userId) === String(champ.id));
  check('board row resolves the real reader, not "Reader"', row && row.handle === 'ada_champ' && row.name === 'Ada Champion', JSON.stringify(row && { handle: row.handle, name: row.name }));
  check('board row carries the avatar and the action breakdown', !!row.avatar && row.parts.chapter === 2 && row.parts.speedread === 1, JSON.stringify(row && row.parts));
  check('board ranks by points and reports me', b3.entries[0].userId === champ.id && b3.me.rank === 1, JSON.stringify(b3.me));
  check('board reports hours left in the week', typeof b3.endsIn === 'number' && b3.endsIn > 0, b3.endsIn);

  const meRow = (await call('GET', '/api/league/me', undefined, champTok)).json;
  check('/league/me returns rank, points and gapToNext', meRow.rank === 1 && meRow.points === 12 * 503 + 7 && meRow.gapToNext === 0, JSON.stringify(meRow));
  check('/league/me starts with no badges', Array.isArray(meRow.badges) && meRow.badges.length === 0, JSON.stringify(meRow.badges));

  const otherMe = (await call('GET', '/api/league/me', undefined, nobodyTok)).json;
  check('a reader with no activity is rank 0 with 0 points', otherMe.rank === 0 && otherMe.points === 0, JSON.stringify({ rank: otherMe.rank, points: otherMe.points }));

  /* ═══ 3. WEEKLY vs ALL-TIME ═══ */
  const prevSeason = surfaces.seasonId(new Date(Date.now() - 7 * DAY));
  const thisSeason = surfaces.seasonId();
  await LeagueActivity.create({ userId: champ.id, season: prevSeason, action: 'chapter', n: 10, points: 500 });
  const weekly = (await call('GET', '/api/league/board?scope=weekly&season=' + thisSeason, undefined, champTok)).json;
  const alltime = (await call('GET', '/api/league/board?scope=alltime', undefined, champTok)).json;
  const wPts = weekly.entries.find(e => e.userId === champ.id).points;
  const aPts = alltime.entries.find(e => e.userId === champ.id).points;
  check('weekly scope only counts the requested season', wPts === 12 * 503 + 7, wPts);
  check('alltime scope sums every season', aPts === wPts + 500, aPts);
  check('alltime is labelled as such', alltime.scope === 'alltime', alltime.scope);

  /* ═══ 4. BADGES ARE EARNED, NOT CLAIMED ═══ */
  // Last week's real points: champion 500, second 12, third 5.
  await LeagueActivity.create([
    { userId: second.id, season: prevSeason, action: 'chapter', n: 1, points: 12 },
    { userId: third.id, season: prevSeason, action: 'hour', n: 1, points: 5 },
  ]);
  const settled = await surfaces.awardLeagueBadges({ season: prevSeason });
  check('settling the week awards the top three', settled.awarded === 3, JSON.stringify(settled));
  const badges = await LeagueBadge.find({ season: prevSeason }).sort({ place: 1 }).lean();
  check('places follow the real points order', badges.map(b => b.place).join(',') === '1,2,3', badges.map(b => b.place).join(','));
  check('the champion is the reader with the most points', badges[0].userId === champ.id, badges[0].userId);
  check('badge label/icon/colour come from the saved prizes',
    badges[0].label === 'Crown of the Week' && badges[0].icon === 'fa-crown' && badges[0].color === '#f59e0b',
    JSON.stringify({ label: badges[0].label, icon: badges[0].icon, color: badges[0].color }));

  const again = await surfaces.awardLeagueBadges({ season: prevSeason });
  check('re-settling the same week awards nothing new', again.awarded === 0, JSON.stringify(again));
  check('re-settling does not duplicate badge rows', (await LeagueBadge.countDocuments({ season: prevSeason })) === 3);

  // A later prize edit must not rewrite a badge somebody already earned.
  await call('PUT', '/api/marketing/league/config', {
    prizes: [{ place: 1, badge: 'Renamed Later', icon: 'fa-star', color: '#000000' }],
  }, mktTok);
  await surfaces.awardLeagueBadges({ season: prevSeason });
  const stillChamp = await LeagueBadge.findOne({ userId: champ.id, season: prevSeason }).lean();
  check('an earned badge keeps the prize it was won under', stillChamp.label === 'Crown of the Week', stillChamp.label);

  const meBadges = (await call('GET', '/api/league/me', undefined, champTok)).json;
  check('/league/me returns the earned badge', meBadges.badges.length === 1 && meBadges.badges[0].place === 1, JSON.stringify(meBadges.badges));
  check('badge label names the week it was won', meBadges.badges[0].label === 'Crown of the Week · ' + prevSeason, meBadges.badges[0].label);
  check('badge carries season, icon and colour for the card', meBadges.badges[0].season === prevSeason && meBadges.badges[0].icon === 'fa-crown' && meBadges.badges[0].color === '#f59e0b', JSON.stringify(meBadges.badges[0]));
  const nobodyBadges = (await call('GET', '/api/league/me', undefined, nobodyTok)).json;
  check('a reader who never placed gets no badges', nobodyBadges.badges.length === 0, JSON.stringify(nobodyBadges.badges));

  // The scheduler is the production trigger; it must be safe to call blind.
  const rollover = await scheduler.leagueRollover();
  check('scheduler rollover runs and is idempotent', !!rollover && rollover.awarded === 0, JSON.stringify(rollover));

  /* ═══ 5. DISABLED LEAGUE + GATES + VALIDATION ═══ */
  await call('PUT', '/api/marketing/league/config', { enabled: false }, mktTok);
  const off = await call('POST', '/api/league/track', { action: 'chapter' }, champTok);
  check('a disabled league scores nothing', off.json.points === 0 && off.json.enabled === false, JSON.stringify(off.json));
  const offBoard = (await call('GET', '/api/league/board')).json;
  check('the board tells readers the league is off', offBoard.enabled === false, offBoard.enabled);
  await call('PUT', '/api/marketing/league/config', { enabled: true }, mktTok);

  check('track requires a session', (await call('POST', '/api/league/track', { action: 'chapter' })).status === 401);
  check('/league/me requires a session', (await call('GET', '/api/league/me')).status === 401);
  check('a reader cannot edit the league config', (await call('PUT', '/api/marketing/league/config', { enabled: false }, champTok)).status === 403);
  check('a bad season string is rejected', (await call('GET', '/api/league/board?season=not-a-week')).status === 400);
  check('a bad scope is rejected', (await call('GET', '/api/league/board?scope=forever')).status === 400);
  check('an unknown track field is rejected', (await call('POST', '/api/league/track', { action: 'chapter', hack: 1 }, champTok)).status === 400);

  const summary = results.filter(r => r.pass).length + '/' + results.length;
  console.log('\n' + summary + ' checks passed');
  await require('mongoose').disconnect();
  await mongod.stop();
  process.exit(results.every(r => r.pass) ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
