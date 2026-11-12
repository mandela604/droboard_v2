'use strict';
/* Live E2E: writer creates a story through the same endpoints create.html
   calls, submits it, a Senior Editor approves it from the review queue, and the
   story must then be visible on the public book surfaces.
   The whole chain is provisioned through the real APIs:
     chief editor creates board + genre -> assigns writer to the SE pod ->
     writer registers, creates & submits -> SE approves -> public catalogue.
   Boots the real app + a real Mongo (in-memory here; same code path as prod). */
process.env.NODE_ENV = 'test';
const PORT = process.env.E2E_PORT || '4291';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
const BASE = 'http://127.0.0.1:' + PORT;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail).slice(0, 500) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 500) : ''}`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitReady() {
  for (let i = 0; i < 160; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) return; } catch (e) {}
    await sleep(250);
  }
  throw new Error('api never came up');
}

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

// A real manuscript: the publish gate is 5,000 words, so the test story must
// actually clear it rather than fake a word count.
function manuscript(targetWords) {
  const sentence = 'The rain kept falling on the old market road while she counted every promise he had broken. ';
  const perSentence = sentence.trim().split(/\s+/).length;
  const out = [];
  let words = 0;
  while (words < targetWords) { out.push(sentence); words += perSentence; }
  return { text: '<p>' + out.join('</p><p>') + '</p>', words };
}

(async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 120000 } });
  process.env.MONGO_URI = mongod.getUri('dro_create_e2e');
  require('../src/server');
  await waitReady();

  const { User } = require('../src/models/user.model');
  const { signAccess } = require('../src/middleware/auth');
  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  const stamp = Date.now();
  const writerEmail = `e2e.writer.${stamp}@droboard.test`;
  const writerPass = 'E2ePass!' + stamp;

  // Chief editor + senior editor exist as granted staff accounts (the console
  // grants these roles; here we create the same rows directly).
  const ce = await User.create({
    fullName: 'E2E Chief Editor', email: `e2e.ce.${stamp}@droboard.test`,
    username: `e2e_ce_${stamp}`, passwordHash: DUMMY, status: 'active',
    primaryRole: 'chief_editor', roles: ['chief_editor'],
  });
  const se = await User.create({
    fullName: 'E2E Senior Editor', email: `e2e.se.${stamp}@droboard.test`,
    username: `e2e_se_${stamp}`, passwordHash: DUMMY, status: 'active',
    primaryRole: 'senior_editor', roles: ['senior_editor'],
  });
  const ceToken = signAccess(ce);
  const seToken = signAccess(se);

  // 1) Register the writer through the public API exactly like signup does.
  let r = await call('POST', '/api/auth/register', {
    fullName: 'E2E Writer', name: 'E2E Writer', username: `e2e_writer_${stamp}`,
    email: writerEmail, password: writerPass, country: 'NG',
  });
  check('register writer account -> 2xx', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  const writerId = r.json && r.json.user && r.json.user.id;

  r = await call('POST', '/api/auth/login', { email: writerEmail, password: writerPass });
  const writerToken = (r.json && (r.json.access || r.json.token)) || '';
  check('login writer -> access token', r.status === 200 && !!writerToken, `${r.status} keys=${Object.keys(r.json || {})}`);

  // 2) Board + genre must exist before any story can be created (create.html
  //    loads /api/genres and rejects an unknown genre with bad_genre).
  r = await call('POST', '/api/chief/categories', { name: `E2E Board ${stamp}`, desc: 'Board created by the live E2E run.' }, ceToken);
  const categoryId = r.json && (r.json.id || r.json._id);
  check('chief editor creates a board (category)', r.status === 201 && !!categoryId, `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.id))}`);

  r = await call('POST', '/api/chief/genres', { name: `E2E Romance ${stamp}`, categoryId, desc: 'Genre created by the live E2E run.' }, ceToken);
  const genreName = r.json && r.json.name;
  check('chief editor creates a genre under the board', r.status === 201 && !!genreName, `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.name))}`);

  // 3) Chief assigns the writer to the senior editor's pod. Without this the
  //    SE's scoped review queue is empty and approve returns 404.
  r = await call('POST', `/api/chief/senior-editors/${encodeURIComponent(se.id)}/assignments/authors`, { authorId: writerId }, ceToken);
  check('chief assigns writer to the SE pod', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.json)}`);

  // 4) Create the story exactly as create.html does (book + chapters in one call).
  const bookTitle = `E2E Live Story ${stamp}`;
  const ms = manuscript(5200);
  r = await call('POST', '/api/books/batch', {
    book: {
      title: bookTitle,
      synopsis: 'A live end-to-end test story created by the console test run.',
      genre: genreName,
      categoryId,
      kind: 'short',
      tags: ['e2e', 'live'],
    },
    chapters: [{ n: 1, title: 'Chapter One', content: ms.text, words: ms.words }],
  }, writerToken);
  const bookId = r.json && (r.json.book && (r.json.book.id || r.json.book._id) || r.json.id || r.json.bookId);
  check('POST /api/books/batch (create.html path) -> book id', r.status >= 200 && r.status < 300 && !!bookId,
    `${r.status} ${JSON.stringify(r.json && (r.json.book || r.json)).slice(0, 240)}`);

  // 5) Submit for review.
  r = await call('POST', `/api/author/books/${encodeURIComponent(bookId)}/submit`, {}, writerToken);
  check('POST /api/author/books/:id/submit -> 2xx', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.json)}`);

  // 6) Senior editor review queue must contain it, with its real word count.
  r = await call('GET', '/api/senior/review-queue?limit=50', undefined, seToken);
  const queue = (r.json && (r.json.items || r.json.reviews || r.json)) || [];
  const row = Array.isArray(queue) ? queue.find(x => String(x.bookId || (x.book && x.book.id) || x.id) === String(bookId)) : null;
  check('SE review queue lists the submitted story', !!row, `status=${r.status} len=${Array.isArray(queue) ? queue.length : 'n/a'} bookId=${bookId}`);
  check('SE queue row carries the manuscript word count', !!row && Number(row.words) >= 5000, `words=${row && row.words}`);

  const reviewId = row && (row.id || row.reviewId || row.bookId || (row.book && row.book.id));
  r = await call('PUT', `/api/senior/review-queue/${encodeURIComponent(reviewId)}`, { action: 'approved' }, seToken);
  check('SE approves the story -> 2xx', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.json).slice(0, 240)}`);

  // 7) Public surfaces must now show it.
  r = await call('GET', '/api/books?limit=100');
  const pub = (r.json && (r.json.items || r.json.books || r.json)) || [];
  const found = Array.isArray(pub) && pub.some(b => String(b.id || b._id) === String(bookId));
  check('approved story appears in public GET /api/books', found, `status=${r.status} items=${Array.isArray(pub) ? pub.length : 'n/a'}`);
  const pubRow = Array.isArray(pub) ? pub.find(b => String(b.id || b._id) === String(bookId)) : null;
  check('public row is live/published', !!pubRow && ['live', 'published'].includes(pubRow.status), `status=${pubRow && pubRow.status}`);

  r = await call('GET', `/api/books/${encodeURIComponent(bookId)}`);
  const detail = r.json || {};
  check('public detail page opens the story', r.status === 200 && (String(detail.id || (detail.book && detail.book.id)) === String(bookId)),
    `${r.status} keys=${Object.keys(detail)}`);

  // 8) The SE book-management surface agrees.
  r = await call('GET', '/api/senior/books?status=published&limit=50', undefined, seToken);
  const managed = (r.json && (r.json.items || r.json)) || [];
  check('SE book-management shows the published story',
    Array.isArray(managed) && managed.some(b => String(b.id || b._id) === String(bookId)),
    `status=${r.status} items=${Array.isArray(managed) ? managed.length : 'n/a'}`);

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} create->approve->live E2E assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => console.log('  FAIL ' + f.name + ' :: ' + f.detail));
  console.log('\nTEST ACCOUNTS (cleanup):');
  console.log('  writer :', writerEmail);
  console.log('  chief  :', ce.email);
  console.log('  se     :', se.email);
  console.log('  book   :', bookId, bookTitle);

  const { default: mongoose } = require('mongoose');
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('E2E CRASH', e && e.stack || e); process.exit(2); });
