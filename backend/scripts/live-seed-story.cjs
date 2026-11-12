'use strict';
/* Seeds a REAL, persistent story chain on a running deployment (default:
   https://droboard-v2.onrender.com) so the story can be seen in the product:

     admin  -> board + genre
     writer -> 5,200-word story, submitted for review
     SE     -> approves it from the review queue
     public -> story appears in the catalogue

   Everything is created through the public API and stays in Mongo.
   Requires an admin account. On Render, set ADMIN_EMAILS to ADMIN_EMAIL and
   redeploy first; that account becomes admin at boot.

   Usage (PowerShell):
     $env:ADMIN_EMAIL='qa.admin@droboard.test'
     $env:ADMIN_PASSWORD='Dro!board2026#QA'
     node scripts/live-seed-story.cjs

   LOCAL=1 boots the same app against an in-memory Mongo (smoke check only).
*/
const BASE = process.env.LOCAL === '1'
  ? 'http://127.0.0.1:' + (process.env.PORT || '4297')
  : (process.env.LIVE_BASE || 'https://droboard-v2.onrender.com').replace(/\/$/, '');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'qa.admin@droboard.test';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Dro!board2026#QA';
const SHARED_PASS = process.env.SEED_PASSWORD || 'Dro!board2026#QA';
const STAMP = Date.now().toString().slice(-7);
const WRITER_EMAIL = process.env.WRITER_EMAIL || `qa.writer.${STAMP}@droboard.test`;
const SE_EMAIL = process.env.SE_EMAIL || `qa.se.${STAMP}@droboard.test`;
const WRITER_USER = `qa_w_${STAMP}`;   // <= 24 chars
const SE_USER = `qa_se_${STAMP}`;
const ADMIN_USER = `qa_admin_${STAMP}`;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 300) : ''}`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

async function waitReady() {
  for (let i = 0; i < 240; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) return; } catch (e) {}
    await sleep(500);
  }
  throw new Error('API never came up at ' + BASE);
}

async function registerOrLogin({ fullName, username, email, password }) {
  const reg = await call('POST', '/api/auth/register', { fullName, name: fullName, username, email, password, country: 'NG' });
  if (reg.status >= 400 && reg.status !== 409) {
    throw new Error(`register ${email} -> ${reg.status} ${JSON.stringify(reg.json)}`);
  }
  const login = await call('POST', '/api/auth/login', { email, password });
  const token = login.json && (login.json.access || login.json.token);
  if (!token) throw new Error(`login ${email} -> ${login.status} ${JSON.stringify(login.json)}`);
  const user = login.json.user || {};
  return { token, id: user.id, roles: user.roles || [], created: reg.status < 400 };
}

function manuscript(targetWords) {
  const sentence = 'The rain kept falling on the old market road while she counted every promise he had broken. ';
  const per = sentence.trim().split(/\s+/).length;
  const parts = [];
  let words = 0;
  while (words < targetWords) { parts.push(sentence); words += per; }
  return { text: '<p>' + parts.join('</p><p>') + '</p>', words };
}

(async () => {
  if (process.env.LOCAL === '1') {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
    process.env.MFA_SECRET_KEY = 'c'.repeat(48);
    process.env.PORT = process.env.PORT || '4297';
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 120000, startupTimeout: 120000 } });
    process.env.MONGO_URI = mongod.getUri('dro_live_seed');
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    require('../src/server');
    await waitReady();
    global.__mongod = mongod;
  }

  console.log('Target:', BASE);
  await waitReady();

  /* 1. Admin */
  const admin = await registerOrLogin({
    fullName: 'QA Admin', username: ADMIN_USER, email: ADMIN_EMAIL, password: ADMIN_PASS,
  });
  check('admin account usable', !!admin.token, admin.id);
  const rolesRes = await call('GET', '/api/super-admin/users?limit=1', undefined, admin.token);
  check('account has Super Admin access', rolesRes.status === 200,
    `${rolesRes.status} ${JSON.stringify(rolesRes.json && rolesRes.json.error)}`);
  if (rolesRes.status !== 200) {
    console.error('\nADMIN_EMAILS is not active for ' + ADMIN_EMAIL + '. Set it in Render → Environment and redeploy.');
    process.exit(3);
  }

  /* 2. Board + genre (create.html needs an active genre) */
  const boardName = `QA Board ${STAMP}`;
  const genreName = `QA Romance ${STAMP}`;
  let r = await call('POST', '/api/chief/categories', { name: boardName, desc: 'Board seeded by the live QA run.' }, admin.token);
  const categoryId = r.json && (r.json.id || r.json._id);
  check('board created', r.status === 201 && !!categoryId, `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.id))}`);

  r = await call('POST', '/api/chief/genres', { name: genreName, categoryId, desc: 'Genre seeded by the live QA run.' }, admin.token);
  check('genre created', r.status === 201 && !!r.json.name, `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.name))}`);

  /* 3. Writer + Senior Editor accounts */
  const writer = await registerOrLogin({
    fullName: 'QA Writer', username: WRITER_USER, email: WRITER_EMAIL, password: SHARED_PASS,
  });
  check('writer account created and logged in', !!writer.token && !!writer.id, writer.id);

  const seAccount = await registerOrLogin({
    fullName: 'QA Senior Editor', username: SE_USER, email: SE_EMAIL, password: SHARED_PASS,
  });
  check('senior-editor account created', !!seAccount.token && !!seAccount.id, seAccount.id);

  r = await call('PATCH', `/api/super-admin/users/${encodeURIComponent(seAccount.id)}`,
    { roles: ['reader', 'senior_editor'] }, admin.token);
  check('SE role granted from the console API', r.status === 200 && (r.json.roles || []).indexOf('Senior Editor') !== -1,
    `${r.status} roles=${JSON.stringify(r.json && r.json.roles)}`);

  /* 4. Chief assigns the writer to the SE pod (scoped review queue) */
  r = await call('POST', `/api/chief/senior-editors/${encodeURIComponent(seAccount.id)}/assignments/authors`,
    { authorId: writer.id }, admin.token);
  check('writer assigned to the SE pod', r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.json && r.json.error)}`);

  /* 5. Writer creates + submits the story (exact create.html path) */
  const bookTitle = `QA Seeded Story ${STAMP}`;
  const ms = manuscript(5200);
  r = await call('POST', '/api/books/batch', {
    book: {
      title: bookTitle,
      synopsis: 'A story seeded through the live QA run: writer creates it, a Senior Editor approves it, readers see it.',
      genre: genreName,
      categoryId,
      kind: 'short',
      tags: ['qa', 'seeded'],
    },
    chapters: [{ n: 1, title: 'Chapter One', content: ms.text, words: ms.words }],
  }, writer.token);
  const bookId = r.json && (r.json.book && (r.json.book.id || r.json.book._id) || r.json.id);
  check('story created through /api/books/batch', r.status === 201 && !!bookId, `${r.status} ${JSON.stringify(r.json && r.json.error)}`);

  r = await call('POST', `/api/author/books/${encodeURIComponent(bookId)}/submit`, {}, writer.token);
  check('story submitted for review', r.status === 200 && r.json.status === 'under_review', `${r.status} status=${r.json && r.json.status}`);

  /* 6. Senior Editor approves it from the queue */
  const se = await registerOrLogin({
    fullName: 'QA Senior Editor', username: SE_USER, email: SE_EMAIL, password: SHARED_PASS,
  });
  r = await call('GET', '/api/senior-editor/review-queue?limit=50', undefined, se.token);
  const queue = (r.json && (r.json.items || [])) || [];
  const row = queue.find(x => String(x.bookId || x.id) === String(bookId));
  check('SE review queue lists the story', !!row, `status=${r.status} items=${queue.length}`);

  r = await call('PUT', `/api/senior-editor/review-queue/${encodeURIComponent(bookId)}`, { action: 'approved' }, se.token);
  check('SE approved the story', r.status === 200, `${r.status} ${JSON.stringify(r.json && r.json.error)}`);

  /* 7. It must be live on the platform now */
  r = await call('GET', '/api/books?limit=100');
  const pub = (r.json && (r.json.items || [])) || [];
  const pubRow = pub.find(b => String(b.id || b._id) === String(bookId));
  check('story is on the public catalogue', !!pubRow, `items=${pub.length}`);
  check('public status is published', !!pubRow && ['published', 'live'].includes(pubRow.status), pubRow && pubRow.status);

  r = await call('GET', `/api/books/${encodeURIComponent(bookId)}`);
  check('public story page opens', r.status === 200, r.status);
  if (r.json) {
    check('public page shows the genre', r.json.genre === genreName, r.json.genre);
  }

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} live seed assertions passed =====`);

  console.log('\nSAVE THIS — accounts and content now in the database:');
  console.log('  Admin  :', ADMIN_EMAIL, '/', ADMIN_PASS);
  console.log('  Writer :', WRITER_EMAIL, '/', SHARED_PASS);
  console.log('  SE     :', SE_EMAIL, '/', SHARED_PASS);
  console.log('  Story  :', bookId, '-', bookTitle);
  console.log('  Board  :', categoryId, '-', boardName);
  console.log('  Genre  :', genreName);
  console.log('  Open   :', BASE + '/Pages/index.html  then search "' + bookTitle + '"');

  if (global.__mongod) {
    const { default: mongoose } = require('mongoose');
    await mongoose.disconnect();
    await global.__mongod.stop();
  }
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('SEED CRASH', e && e.stack || e); process.exit(2); });
