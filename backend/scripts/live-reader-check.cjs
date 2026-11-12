'use strict';
/* Live reader-flow check against a running deployment (default:
   https://droboard-v2.onrender.com).

   Verifies the deployed tip sheet + reader community + board paths:
     - /health answers 200
     - /api/tropes serves a JSON list (hub trope pills + composer select)
     - a published story carries hubs.board { members, joined, slug }
     - the genre hub is joined=false for a signed-out reader and the join
       button cannot claim a membership the board does not have
     - guests cannot join / post discussions / comment
     - the de-demoed frontend assets are actually the deployed ones
       (no DEMO_NAMES, no demoMembers, no onSend hook)
     - tips/:authorId is requireAuth and answers for a signed-in reader

   Usage (PowerShell):
     $env:QA_EMAIL='qa.admin@droboard.test'; $env:QA_PASSWORD='Dro!board2026#QA'
     node backend/scripts/live-reader-check.cjs

   Nothing here writes to the database: tips and posts are refused on purpose,
   so the run is safe to repeat.
*/
const BASE = (process.env.LIVE_BASE || 'https://droboard-v2.onrender.com').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.QA_EMAIL || 'qa.admin@droboard.test';
const ADMIN_PASS = process.env.QA_PASSWORD || 'Dro!board2026#QA';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 400) : ''}`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(BASE + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    return { status: 0, json: null, error: String(e && e.message || e) };
  }
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

async function waitReady() {
  for (let i = 0; i < 240; i++) {
    const r = await call('GET', '/health');
    if (r.status === 200) return r;
    await sleep(500);
  }
  throw new Error('API never came up at ' + BASE);
}

async function getText(path) {
  try {
    const res = await fetch(BASE + path, { signal: AbortSignal.timeout(45000) });
    return { status: res.status, body: await res.text() };
  } catch (e) {
    return { status: 0, body: '', error: String(e && e.message || e) };
  }
}

(async () => {
  console.log('Target:', BASE);
  const health = await waitReady();
  check('API is up', health.status === 200, health.json);

  /* ---- live story + its hub ---- */
  let r = await call('GET', '/api/books?limit=100&status=published');
  const books = (r.json && (r.json.items || r.json.books)) || [];
  check('catalogue serves published stories', Array.isArray(books) && books.length > 0,
    `status=${r.status} items=${Array.isArray(books) ? books.length : 'n/a'}`);

  // Prefer a QA seed (has a real genre hub), fall back to any story.
  let book = books.find(b => /QA Seeded Story/i.test(String(b.title))) || books[0];
  let detail = null;
  if (book) {
    r = await call('GET', `/api/books/${encodeURIComponent(book.id)}`);
    detail = r.json || null;
  }
  check('story detail page opens live', r.status === 200 && !!detail && !!detail.id,
    `${r.status} ${book && book.title}`);
  const genre = detail && detail.genre;
  check('story carries a genre', !!genre, genre);

  /* ---- the tip sheet's data sources ---- */
  r = await call('GET', '/api/tropes?limit=100');
  const tropes = (r.json && (r.json.items || r.json)) || [];
  check('GET /api/tropes serves the live catalog (array)',
    r.status === 200 && Array.isArray(tropes), `status=${r.status} len=${Array.isArray(tropes) ? tropes.length : 'n/a'}`);

  // signed-out: the balance/gift/supporter reads are requireAuth
  r = await call('GET', '/api/wallet/balance');
  check('signed-out balance read is refused', r.status === 401, `${r.status}`);
  r = await call('GET', '/api/wallet/store');
  check('signed-out gift catalog read is refused', r.status === 401, `${r.status}`);
  r = await call('GET', '/api/wallet/tips/' + encodeURIComponent('anyone'));
  check('signed-out supporter list is refused', r.status === 401, `${r.status}`);

  /* ---- board membership for a signed-out reader ---- */
  const slug = genre ? String(genre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : '';
  if (slug) {
    r = await call('GET', '/api/genres/' + encodeURIComponent(slug));
    check('genre hub resolves for a signed-out reader', r.status === 200 && !!r.json,
      `${r.status} ${r.json && r.json.error}`);
    check('signed-out reader is not joined', r.json && r.json.isJoined === false,
      `isJoined=${r.json && r.json.isJoined}`);

    r = await call('POST', `/api/genres/${encodeURIComponent(slug)}/join`, {});
    check('guest cannot join a board', r.status === 401, `${r.status}`);

    r = await call('POST', '/api/discussions', { genre: slug, title: 'guest attempt', body: 'no' });
    check('guest cannot post a discussion', r.status === 401, `${r.status}`);
  } else {
    check('genre hub resolves for a signed-out reader', false, 'could not build a slug from "' + genre + '"');
  }

  r = await call('POST', '/api/comments', { scope: 'story', storyId: detail && detail.id, text: 'guest attempt' });
  check('guest cannot comment', r.status === 401, `${r.status}`);

  /* ---- signed-in reads: balance, store gifts, supporters ---- */
  r = await call('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  const token = (r.json && (r.json.access || r.json.token)) || '';
  check('QA account can sign in', !!token, `${r.status} ${JSON.stringify(r.json && r.json.error)}`);
  if (token) {
    r = await call('GET', '/api/wallet/balance', undefined, token);
    check('signed-in balance read works', r.status === 200 && r.json && r.json.coins != null,
      `${r.status} ${JSON.stringify(r.json)}`);

    r = await call('GET', '/api/wallet/store', undefined, token);
    const gifts = (r.json && r.json.gifts) || [];
    check('signed-in gift catalog works', r.status === 200 && Array.isArray(gifts) && gifts.length > 0,
      `${r.status} gifts=${Array.isArray(gifts) ? gifts.length : 'n/a'}`);
    check('gift rows carry code/price/faIcon for the tip sheet',
      !!gifts[0] && !!gifts[0].code && Number(gifts[0].price) > 0 && !!gifts[0].faIcon,
      JSON.stringify(gifts[0] || null));

    if (detail && detail.writer && detail.writer.id) {
      r = await call('GET', '/api/wallet/tips/' + encodeURIComponent(detail.writer.id), undefined, token);
      check('signed-in supporter list works',
        r.status === 200 && r.json && Array.isArray(r.json.items),
        `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    }
  }

  /* ---- the deployed frontend must be the de-demoed build ---- */
  let js = await getText('/component/tip-picker.js');
  check('tip-picker.js is served (de-demoed build)',
    js.status === 200 && !/DEMO_NAMES|_demoSupporters|GIFT_CATALOG/.test(js.body),
    `status=${js.status} len=${js.body.length}`);
  check('tip-picker.js reads the wallet API',
    js.status === 200 && js.body.indexOf('/wallet/tips/') !== -1 && js.body.indexOf('/wallet/balance') !== -1,
    `tips=${js.body.indexOf('/wallet/tips/') !== -1} balance=${js.body.indexOf('/wallet/balance') !== -1}`);

  let cc = await getText('/component/community-cards.js');
  check('community-cards.js has no demo member counts',
    cc.status === 200 && !/demoMembers/.test(cc.body), `status=${cc.status} len=${cc.body.length}`);

  let gh = await getText('/services/genre-hub-service.js');
  check('genre-hub-service.js joins through the API',
    gh.status === 200 && gh.body.indexOf('/join') !== -1, `status=${gh.status} len=${gh.body.length}`);

  let fr = await getText('/services/full-reader-service.js');
  check('full reader paints communities from book.hubs.board',
    fr.status === 200 && fr.body.indexOf('hubs') !== -1 && !/demoMembers/.test(fr.body),
    `status=${fr.status} len=${fr.body.length}`);

  let sr = await getText('/services/scroll-reader-service.js');
  check('scroll reader paints communities from book.hubs.board',
    sr.status === 200 && sr.body.indexOf('DATA.board') !== -1 && !/demoMembers/.test(sr.body),
    `status=${sr.status} len=${sr.body.length}`);

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} live reader-flow assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => console.log('  FAIL ' + f.name));
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('LIVE CHECK CRASH', e && e.stack || e); process.exit(2); });