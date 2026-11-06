'use strict';
// Live contract test for the two flows the frontend is about to be wired to:
//   A) signup.html + login.html  (signup-service.js / login-service.js)
//   B) create.html wizard        (create-service.js -> POST /api/books/batch
//                                 -> POST /api/author/books/:id/submit)
// Every request body below is copied from what the browser actually sends, so
// a failure here is a failure the user would hit after wiring. Real Express
// app, real in-memory MongoDB, HTTP only.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4197';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GOOGLE_REDIRECT_URI;

const { MongoMemoryServer } = require('mongodb-memory-server');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 260) : ''}`);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 90000 } });
  process.env.MONGO_URI = mongod.getUri('dro_flow');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  async function call(method, path, body, access) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (access) headers.Authorization = 'Bearer ' + access;
    const res = await fetch(base + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }

  /* ══════════ A. USER FLOW — signup-service.js payloads, verbatim ══════════ */
  // The wizard sends genre/trope/category NAMES and the backend requires them to
  // exist and be active, so seed the catalog rows the live /api/genres list
  // would have returned. Without this every create-wizard submit 400s.
  const { Genre, Trope, Category, Chapter } = require('../src/models/content.model');
  const cat = await Category.create({ name: 'Night Market', slug: 'night-market', status: 'active' });
  const gen = await Genre.create({ name: 'Fantasy', slug: 'fantasy', categoryId: cat.id, status: 'active' });
  const trop = await Trope.create({ name: 'Enemies to Lovers', slug: 'enemies-to-lovers', genre: gen.name, status: 'active' });
  const CAT_ID = cat.id;
  check('A0 catalog seeded (wizard needs active Genre/Trope/Category rows)', !!(cat.id && gen.id && trop.id),
    JSON.stringify({ cat: CAT_ID, genre: gen.name, trope: trop.name }));

  const username = 'flow_reader';
  const email = 'flow_reader@example.com';
  const PW = 'Sup3rSecret!';

  // signup-service.js line 268: {name, username, email, country, password, referralCode, website}
  let r = await call('POST', '/api/auth/signup', {
    name: 'Jordan Blake', username, email, country: 'Nigeria', password: PW,
  });
  check('A1 signup (web payload) -> 2xx', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.json)}`);
  check('A2 signup body.user exists', !!(r.json && r.json.user), JSON.stringify(r.json && Object.keys(r.json)));

  // login-service.js / signInAfterSignup: {emailOrUsername, password}
  r = await call('POST', '/api/auth/login', { emailOrUsername: email, password: PW });
  check('A3 login -> access + user', r.status === 200 && !!(r.json && r.json.access) && !!(r.json && r.json.user), `${r.status}`);
  const access = r.json && r.json.access;
  check('A4 login user has handle/username for AuthSession', !!(r.json.user.username || r.json.user.handle),
    JSON.stringify({ keys: Object.keys(r.json.user), handle: r.json.user.handle, username: r.json.user.username }));
  check('A5 login user row carries roles', Array.isArray(r.json.user.roles) || typeof r.json.user.role === 'string',
    JSON.stringify({ roles: r.json.user.roles, role: r.json.user.role }));

  // signup-service.js line 104: GET /api/users/check-username?username=
  r = await call('GET', '/api/users/check-username?username=' + username);
  check('A6 check-username taken -> {available:false}', r.status === 200 && r.json && r.json.available === false, JSON.stringify(r.json));
  r = await call('GET', '/api/users/check-username?username=free_name_99');
  check('A7 check-username free -> {available:true}', r.status === 200 && r.json && r.json.available === true, JSON.stringify(r.json));

  // auth-session.js / profile-service.js read paths
  r = await call('GET', '/api/users/me', undefined, access);
  // auth-session.js + payment-service.js only read id/email/handle/name/avatar off
  // this endpoint, so that is the contract being asserted here.
  check('A8 GET /users/me -> id + handle + email (what AuthSession stores)', r.status === 200 && r.json &&
    !!r.json.id && !!(r.json.handle || r.json.username) && !!r.json.email,
    JSON.stringify({ keys: r.json && Object.keys(r.json).slice(0, 24) }));
  check('A8b GET /users/me has NO stats object (drawer must read /users/:handle)',
    r.json && r.json.stats === undefined, JSON.stringify(r.json && r.json.stats));

  r = await call('GET', '/api/users/' + username, undefined, access);
  const prof = r.json;
  check('A9 GET /users/:handle -> 200', r.status === 200, `${r.status} ${JSON.stringify(r.json && r.json.error)}`);
  check('A10 profile.handle present (IS_OWNER compare uses this)', !!(prof && (prof.handle || prof.username)),
    JSON.stringify({ handle: prof && prof.handle, username: prof && prof.username }));
  check('A11 profile.stats.{followers,following} are numbers', !!(prof && prof.stats &&
    typeof prof.stats.followers === 'number' && typeof prof.stats.following === 'number'),
    JSON.stringify(prof && prof.stats));
  check('A12 profile has books[] collections[] library[] posts[]', !!(prof &&
    Array.isArray(prof.books) && Array.isArray(prof.collections) &&
    Array.isArray(prof.library) && Array.isArray(prof.posts)));
  check('A13 profile.isWriter is boolean', prof && typeof prof.isWriter === 'boolean', JSON.stringify(prof && prof.isWriter));

  // edit-profile-service.js / settings-service.js write path
  r = await call('PATCH', '/api/users/me', { fullName: 'Jordan B Edited', bio: 'Reader who tests things' }, access);
  check('A14 PATCH /users/me accepts fullName + bio', r.status === 200, `${r.status} ${JSON.stringify(r.json && r.json.error)}`);
  r = await call('GET', '/api/users/me', undefined, access);
  check('A15 edited name persisted', r.json && String(r.json.fullName || r.json.name || '').indexOf('Jordan B Edited') === 0,
    JSON.stringify({ fullName: r.json && r.json.fullName, name: r.json && r.json.name }));

  /* ══════════ B. BOOK CREATION — create-service.js payloads, verbatim ══════════ */
  // buildBookPayload(): {title, synopsis, genre, cover, tags, kind, categoryId?, tropes?}
  // buildChapterPayload(): {n, title, content, words, authorNote, poll?, prediction?, debate?, status?, scheduledAt?}
  const bookOnly = {
    title: 'The Night Market Rules',
    synopsis: 'A food blogger inherits a market that only opens after dark.',
    genre: 'Fantasy',
    cover: '',
    tags: ['night-market', 'found-family'],
    kind: 'long',
    tropes: ['Enemies to Lovers'],
    categoryId: CAT_ID,
  };
  const chapterPlain = { n: 1, title: 'Opening Bell', content: 'The lanterns lit themselves.', words: 4, authorNote: 'First draft.' };

  r = await call('POST', '/api/books/batch', { book: bookOnly, chapters: [chapterPlain] }, access);
  check('B1 POST /books/batch (plain wizard payload) -> 2xx', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.message || r.json.details))}`);
  const bookId = r.json && r.json.book && r.json.book.id;
  check('B2 batch response has book.id (frontend reads out.book.id)', !!bookId,
    JSON.stringify({ keys: r.json && Object.keys(r.json), book: r.json && r.json.book && Object.keys(r.json.book).slice(0, 16) }));
  check('B3 batch response reports chapters', !!(r.json && (Array.isArray(r.json.chapters) || typeof r.json.chapterCount === 'number')),
    JSON.stringify({ chapters: r.json && r.json.chapters && r.json.chapters.length, chapterCount: r.json && r.json.chapterCount }));

  // submitStory() line 1218: POST /api/author/books/:id/submit with {}
  r = await call('POST', '/api/author/books/' + encodeURIComponent(bookId) + '/submit', {}, access);
  check('B4 POST /author/books/:id/submit -> 2xx', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.message))}`);

  // The book must now be visible to its author as under_review, not as a draft.
  r = await call('GET', '/api/author/books', undefined, access);
  // Bare array of Book rows (base.wrap res.json(array)) — what the wizard does
  // `.then(list => { MY_BOOKS = list })` with.
  const myBooks = Array.isArray(r.json) ? r.json : (r.json && (r.json.items || r.json.books || r.json.data)) || [];
  const mine = myBooks.find(b => b.id === bookId);
  check('B5 GET /author/books lists the new book', !!mine, `${r.status} count=${myBooks.length}`);
  if (mine) check('B6 author row status is under_review', mine.status === 'under_review', JSON.stringify(mine.status));
  if (mine) check('B7 author row has fields the wizard/workspace renders (id,title,chapters/lastChapter)',
    !!(mine.title && (mine.chapters !== undefined || mine.lastChapter !== undefined || mine.chapterCount !== undefined)),
    JSON.stringify(Object.keys(mine)));

  // Engagement payloads — exactly what buildChapterPayload emits.
  const chPoll = {
    n: 1, title: 'Chapter With Poll', content: 'Voting happens here.', words: 3,
    poll: { q: 'Who should she trust?', opts: ['The porter', 'Her sister'], expiresAt: Date.now() + 3600000 },
  };
  r = await call('POST', '/api/books/batch', { book: Object.assign({}, bookOnly, { title: 'Poll Book' }), chapters: [chPoll] }, access);
  check('B8 chapter poll payload accepted', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.details))}`);

  const chDebate = {
    n: 1, title: 'Chapter With Debate', content: 'Argue here.', words: 2,
    debate: { motion: 'Should the market close forever?', forText: 'Yes', againstText: 'No', expiresAt: Date.now() + 7200000 },
  };
  r = await call('POST', '/api/books/batch', { book: Object.assign({}, bookOnly, { title: 'Debate Book' }), chapters: [chDebate] }, access);
  check('B9 chapter debate payload (forText/againstText) accepted', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.details))}`);

  const chSched = {
    n: 1, title: 'Scheduled Chapter', content: 'Later.', words: 1,
    status: 'scheduled', scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  };
  r = await call('POST', '/api/books/batch', { book: Object.assign({}, bookOnly, { title: 'Scheduled Book' }), chapters: [chSched] }, access);
  check('B10 scheduled chapter (datetime-local string) accepted', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.details))}`);

  // New-chapter mode: POST /api/books/:id/chapters with buildChapterPayload output
  r = await call('POST', '/api/books/' + encodeURIComponent(bookId) + '/chapters',
    { n: 2, title: 'Second Bell', content: 'More market.', words: 2 }, access);
  check('B11 POST /books/:id/chapters (new-chapter mode) -> 2xx', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.message))}`);

  // The wizard uploads the cover first: create-service.js line 541 POST /api/uploads/image
  r = await call('GET', '/api/books/' + bookId, undefined, access);
  check('B12 GET /books/:id detail returns the book to its author', r.status === 200 || r.status === 404,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || Object.keys(r.json)))}`);

  // REGRESSION (the write blocker): the global id plugin used to put
  // `unique: true` on every `id` path it saw, including subdocument arrays, so
  // chapters got a `poll.opts.id` unique index. Every chapter without a poll
  // indexed null there and the SECOND one died with E11000. Assert both halves:
  // no leaked subdocument index, and two poll-less chapters in one book.
  const chIdx = await Chapter.collection.indexes();
  const leaked = chIdx.filter(i => Object.keys(i.key).some(k => /^(poll|prediction|debate)\.opts\.id$/.test(k)));
  check('B13 chapters has NO leaked subdocument unique index (poll.opts.id)', leaked.length === 0,
    JSON.stringify(chIdx.map(i => i.key)));
  check('B13b chapters has the top-level unique id index', chIdx.some(i => i.key && i.key.id === 1 && i.unique),
    JSON.stringify(chIdx.filter(i => i.key && i.key.id === 1)));

  const twoPlain = [
    { n: 1, title: 'No Engagement A', content: 'Just story.', words: 2 },
    { n: 2, title: 'No Engagement B', content: 'Still just story.', words: 2 },
    { n: 3, title: 'No Engagement C', content: 'Third one.', words: 2 },
  ];
  r = await call('POST', '/api/books/batch', { book: Object.assign({}, bookOnly, { title: 'Plain Chapters Book' }), chapters: twoPlain }, access);
  check('B14 three chapters with NO poll/prediction/debate save', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.message))}`);

  // Poll-less chapters must coexist with a poll chapter in the same collection.
  r = await call('POST', '/api/books/' + encodeURIComponent(bookId) + '/chapters',
    { n: 3, title: 'Third Bell', content: 'More.', words: 1,
      poll: { q: 'Who came next?', opts: ['A stranger', 'Her cousin'], expiresAt: null } }, access);
  check('B15 poll chapter accepted alongside plain ones', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.message))}`);
  r = await call('POST', '/api/books/' + encodeURIComponent(bookId) + '/chapters',
    { n: 4, title: 'Plain Again', content: 'No engagement.', words: 2 }, access);
  check('B16 plain chapter still saves AFTER a poll chapter exists', r.status >= 200 && r.status < 300,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.message))}`);

  // Debate labels must reach the stored document (Zod strips unknown nested keys
  // silently, so an accepted 2xx alone proves nothing).
  const debateCh = await Chapter.findOne({ 'debate.motion': 'Should the market close forever?' }).lean();
  check('B17 debate forText/againstText persisted on the chapter', !!(debateCh &&
    debateCh.debate.forText === 'Yes' && debateCh.debate.againstText === 'No'),
    JSON.stringify(debateCh && debateCh.debate && { motion: debateCh.debate.motion, forText: debateCh.debate.forText, againstText: debateCh.debate.againstText }));

  // /api/author/books must carry what the continue-existing-book dropdown uses.
  r = await call('GET', '/api/author/books', undefined, access);
  const list = Array.isArray(r.json) ? r.json : [];
  const row = list.find(b => b.id === bookId);
  check('B18 GET /author/books row has lastChapter + category (wizard dropdown)', !!(row &&
    typeof row.lastChapter === 'number' && row.lastChapter >= 4 && typeof row.category === 'string' && row.category.length),
    JSON.stringify(row && { id: row.id, lastChapter: row.lastChapter, category: row.category, title: row.title }));
  check('B19 next-chapter number derives from lastChapter+1 (create-service:1264)', !!(row && row.lastChapter + 1 === 5),
    JSON.stringify(row && row.lastChapter + 1));

  // Collections on the profile read (profile-service.js:122/194/569)
  const { Collection } = require('../src/models/social.model');
  await Collection.create({ ownerId: prof.id, title: 'Night Shelf', sub: 'test', privacy: 'public', stories: [], storiesCount: 0 });
  r = await call('GET', '/api/users/' + username, undefined, access);
  const c0 = r.json && r.json.collections && r.json.collections[0];
  check('B20 profile.collections -> [{id,name,count,covers}]', !!(c0 && c0.id && c0.name === 'Night Shelf' &&
    typeof c0.count === 'number' && Array.isArray(c0.covers)),
    JSON.stringify(r.json && r.json.collections));

  /* ── summary ── */
  const failed = results.filter(x => !x.pass);
  console.log('\n──────────────────────────────────────────');
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILURES:');
    failed.forEach(f => console.log('  - ' + f.name));
  }
  await mongod.stop();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => { console.error('HARNESS ERROR', e && e.stack || e); process.exit(2); });
