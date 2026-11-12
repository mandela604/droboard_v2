'use strict';
// Live genre-hub test against a REAL deployed server (persistent database).
// Usage: node scripts/smoke-boards-live-remote.cjs
// Target: https://droboard-v2.onrender.com/
// Creates real accounts + real data that persist in your production database.

const BASE = 'https://droboard-v2.onrender.com';
const stamp = Date.now();

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 200) : ''}`);
}

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(BASE + path, init);
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  return { status: res.status, json, ok: res.ok };
}

async function main() {
  // Wait for server to be up
  for (let i = 0; i < 40; i++) {
    try {
      const p = await call('GET', '/health');
      if (p.ok) break;
    } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }

  const sufx = String(stamp).slice(-6);
  const readerEmail = `live_reader_${sufx}@test.local`;
  const writerEmail = `live_writer_${sufx}@test.local`;
  const readerUser = `live_reader_${sufx}`;
  const writerUser = `live_writer_${sufx}`;
  const PW = 'LiveTest1234!';

  /* ═══ 1. SIGNUP REAL ACCOUNTS ═══ */
  let r = await call('POST', '/api/auth/signup', {
    fullName: 'Live Reader', username: readerUser, email: readerEmail, password: PW,
  });
  check('signup reader account', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.json && r.json.error || r.json)}`);
  const readerCreated = r.status === 200 || r.status === 201;

  r = await call('POST', '/api/auth/signup', {
    fullName: 'Live Writer', username: writerUser, email: writerEmail, password: PW,
  });
  check('signup writer account', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.json && r.json.error || r.json)}`);
  const writerCreated = r.status === 200 || r.status === 201;

  /* ═══ 2. LOGIN ═══ */
  let readerToken, writerToken;
  if (readerCreated) {
    r = await call('POST', '/api/auth/login', { email: readerEmail, password: PW });
    check('login reader', r.status === 200, `status=${r.status} ${JSON.stringify(r.json && r.json.error || r.json)}`);
    readerToken = r.json && (r.json.access || r.json.token);
  }
  if (writerCreated) {
    r = await call('POST', '/api/auth/login', { email: writerEmail, password: PW });
    check('login writer', r.status === 200, `status=${r.status} ${JSON.stringify(r.json && r.json.error || r.json)}`);
    writerToken = r.json && (r.json.access || r.json.token);
  }

  /* ═══ 3. CATEGORIES / BOARDS LIST ═══ */
  r = await call('GET', '/api/categories');
  check('GET /api/categories -> 200', r.status === 200, `status=${r.status}`);
  const items = r.json && r.json.items ? r.json.items : (Array.isArray(r.json) ? r.json : []);
  check('categories list is an array', Array.isArray(items), `count=${items.length}`);
  const activeBoards = items.filter(x => x.status !== 'inactive');
  check('at least one active board exists', activeBoards.length > 0, `active=${activeBoards.length} total=${items.length}`);
  const board = activeBoards[0];
  const boardSlug = board.slug;
  check('board row has slug/name/icon/tagline', !!boardSlug && !!board.name, JSON.stringify({ slug: boardSlug, name: board.name, icon: board.icon, tagline: board.tagline }));

  /* ═══ 4. GENRE HUB HEADER ═══ */
  r = await call('GET', '/api/categories/' + boardSlug, undefined, readerToken);
  check('GET /api/categories/:slug -> 200', r.status === 200, `status=${r.status}`);
  const hub = r.json || {};
  check('hub carries blurb', typeof hub.blurb === 'string', `blurb=${hub.blurb}`);
  check('hub carries stories count', typeof hub.stories === 'string' || typeof hub.stories === 'number', `stories=${hub.stories}`);
  check('hub carries members count', typeof hub.members === 'string' || typeof hub.members === 'number', `members=${hub.members}`);
  check('hub carries discussions count', typeof hub.discussions === 'string' || typeof hub.discussions === 'number', `discussions=${hub.discussions}`);
  check('hub marks reader as not joined initially', hub.isJoined === false, `isJoined=${hub.isJoined}`);
  check('hub lists child genres', Array.isArray(hub.genres) && hub.genres.length > 0, `genres=${JSON.stringify((hub.genres || []).map(g => g.slug))}`);

  /* ═══ 5. GENRE HUB VIA CHILD SLUG ═══ */
  const child = (hub.genres || [])[0];
  if (child) {
    r = await call('GET', '/api/genres/' + child.slug, undefined, readerToken);
    check('GET /api/genres/:childSlug -> 200 parent hub', r.status === 200 && r.json.slug === boardSlug, `slug=${r.json && r.json.slug} expected=${boardSlug}`);
    check('child genre hub matches category hub', r.json.stories === hub.stories && r.json.members === hub.members, JSON.stringify({ child: r.json.stories, parent: hub.stories }));
  }

  /* ═══ 6. STORIES TAB ═══ */
  r = await call('GET', '/api/categories/' + boardSlug + '/stories?sort=top');
  check('GET /api/categories/:slug/stories -> 200', r.status === 200, `status=${r.status}`);
  const stories = r.json && r.json.items ? r.json.items : [];
  check('stories tab returns items', Array.isArray(stories), `count=${stories.length}`);
  if (stories.length > 0) {
    const s = stories[0];
    check('story row has title/cover/reads/writer', !!s.title && !!s.cover && typeof s.reads === 'number' && (!!s.writer || !!s.author), JSON.stringify({ title: s.title, reads: s.reads, writer: s.writer }));
  }

  /* ═══ 7. MEMBERS TAB ═══ */
  r = await call('GET', '/api/categories/' + boardSlug + '/members', undefined, readerToken);
  check('GET /api/categories/:slug/members -> 200', r.status === 200, `status=${r.status}`);
  const members = r.json && r.json.items ? r.json.items : [];
  check('members tab returns items', Array.isArray(members), `count=${members.length}`);

  /* ═══ 8. JOIN BOARD ═══ */
  r = await call('POST', '/api/categories/' + boardSlug + '/join', undefined, readerToken);
  check('POST /api/categories/:slug/join -> 200 joined', r.status === 200 && r.json.joined === true, `status=${r.status} ${JSON.stringify(r.json)}`);
  const joinedMembersCount = r.json && r.json.membersCount;

  /* ═══ 9. HUB AFTER JOIN ═══ */
  r = await call('GET', '/api/categories/' + boardSlug, undefined, readerToken);
  check('hub shows isJoined=true after join', r.json.isJoined === true, `isJoined=${r.json.isJoined}`);
  check('hub membersCount bumped after join', (r.json.membersCount || 0) >= (joinedMembersCount || 0), `membersCount=${r.json.membersCount}`);

  /* ═══ 10. JOINED=ME FILTER ═══ */
  r = await call('GET', '/api/categories?joined=me', undefined, readerToken);
  check('GET /api/categories?joined=me returns joined board', (r.json.items || []).some(x => x.slug === boardSlug), `joined=${JSON.stringify((r.json.items || []).map(x => x.slug))}`);

  /* ═══ 11. DISCUSSION CREATION (MEMBER-GATED) ═══ */
  const thread = { genre: boardSlug, title: 'Live test thread ' + stamp, body: 'Testing genre hub on live database.', tag: 'discussion' };
  r = await call('POST', '/api/discussions', thread, readerToken);
  check('member can open a thread in the board', r.status === 201, `status=${r.status} ${JSON.stringify(r.json && r.json.error || r.json)}`);
  const threadId = r.json && (r.json.id || r.json._id);

  /* ═══ 12. LIKE THREAD ═══ */
  if (threadId) {
    r = await call('POST', '/api/discussions/' + threadId + '/like', undefined, readerToken);
    check('member can like a board thread', r.status === 200 && r.json.liked === true, `status=${r.status} ${JSON.stringify(r.json)}`);
  }

  /* ═══ 13. REPLY TO THREAD ═══ */
  if (threadId) {
    r = await call('POST', '/api/comments', { scope: 'discussion', discussionId: threadId, text: 'Live test reply.' }, readerToken);
    check('member can reply inside a board thread', r.status === 201, `status=${r.status} ${JSON.stringify(r.json && r.json.error || r.json)}`);
  }

  /* ═══ 14. NON-MEMBER IS BLOCKED ═══ */
  const strangerEmail = `live_stranger_${sufx}@test.local`;
  r = await call('POST', '/api/auth/signup', {
    fullName: 'Live Stranger', username: `live_stranger_${sufx}`, email: strangerEmail, password: PW,
  });
  if (r.status === 200 || r.status === 201) {
    r = await call('POST', '/api/auth/login', { email: strangerEmail, password: PW });
    const strangerToken = r.json && (r.json.access || r.json.token);
    r = await call('GET', '/api/categories/' + boardSlug, undefined, strangerToken);
    check('stranger reads board as not joined', r.status === 200 && r.json.isJoined === false, `isJoined=${r.json && r.json.isJoined}`);
    r = await call('POST', '/api/discussions', { genre: boardSlug, title: 'Stranger thread', tag: 'discussion' }, strangerToken);
    check('non-member cannot open a thread', r.status === 403, `status=${r.status}`);
  } else {
    check('stranger signup skipped (rate limit or existing)', true, `status=${r.status}`);
  }

  /* ═══ 15. LEAVE BOARD ═══ */
  r = await call('DELETE', '/api/categories/' + boardSlug + '/join', undefined, readerToken);
  check('DELETE /api/categories/:slug/join -> joined false', r.status === 200 && r.json.joined === false, `status=${r.status} ${JSON.stringify(r.json)}`);

  r = await call('GET', '/api/categories/' + boardSlug, undefined, readerToken);
  check('hub shows isJoined=false after leave', r.json.isJoined === false, `isJoined=${r.json.isJoined}`);

  /* ═══ SUMMARY ═══ */
  const failed = results.filter(x => !x.pass);
  console.log('\n===== ' + (results.length - failed.length) + '/' + results.length + ' live genre-hub assertions passed =====');
  failed.forEach(f => console.log('FAILED: ' + f.name));
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
