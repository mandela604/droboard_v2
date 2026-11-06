'use strict';
// Diagnostic: prove WHERE the chapters unique index comes from, and dump the
// exact response keys the frontend would consume for /users/:handle and
// /author/books. Not a pass/fail suite — evidence for the wiring decision.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4198';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_diag');
  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  const mongoose = require('mongoose');
  const { Chapter } = require('../src/models/content.model');

  console.log('\n===== CHAPTER INDEXES (built by the running app) =====');
  const idx = await Chapter.collection.indexes();
  idx.forEach(i => {
    const uniq = i.unique ? 'UNIQUE' : 'plain';
    console.log(`  ${uniq}  ${JSON.stringify(i.key)}`);
  });
  const bad = idx.filter(i => i.unique && /\./.test(Object.keys(i.key)[0]) && !/^(bookId|n)$/.test(Object.keys(i.key)[0]));
  console.log(`\n  -> unique indexes on NESTED subdoc paths: ${bad.length}`);
  bad.forEach(i => console.log('     ' + JSON.stringify(i.key)));

  // Show which schemas the global ids plugin touched.
  console.log('\n===== does the ids plugin add `id` to SUBDOCUMENTS? =====');
  const pollOpts = Chapter.schema.path('poll');
  console.log('  Chapter.poll.opts schema:', pollOpts && pollOpts.schema ? Object.keys(pollOpts.schema.paths).join(',') : 'n/a');

  // Reproduce the collision in one line of evidence.
  console.log('\n===== two chapters, neither with a poll =====');
  const { Book } = require('../src/models/content.model');
  const b = await Book.create({ id: 'diag_book', title: 'Diag', authorId: 'diag_author', kind: 'long' });
  let first = 'ok', second = 'ok';
  try { await Chapter.create({ id: 'diag_c1', bookId: b.id, n: 1, title: 'One', content: 'x' }); } catch (e) { first = e.code === 11000 ? 'E11000' : e.message; }
  try { await Chapter.create({ id: 'diag_c2', bookId: b.id, n: 2, title: 'Two', content: 'x' }); } catch (e) { second = e.code === 11000 ? 'E11000' : e.message; }
  console.log(`  chapter 1 (no poll): ${first}`);
  console.log(`  chapter 2 (no poll): ${second}`);

  // The flow test failed AFTER a poll chapter was written. Do exactly that:
  // write one chapter carrying a poll, then re-list indexes and write a plain one.
  console.log('\n===== write ONE chapter WITH a poll, then a plain one =====');
  const withPoll = { q: 'Pick one', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }] };
  let p1 = 'ok';
  try { await Chapter.create({ id: 'diag_c3', bookId: b.id, n: 3, title: 'Poll', content: 'x', poll: withPoll }); }
  catch (e) { p1 = e.code === 11000 ? 'E11000' : e.message; }
  console.log(`  chapter 3 (with poll): ${p1}`);
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log('  indexes after the poll write:');
  (await Chapter.collection.indexes()).forEach(i =>
    console.log(`    ${i.unique ? 'UNIQUE' : 'plain'}  ${JSON.stringify(i.key)}`));
  let third = 'ok';
  try { await Chapter.create({ id: 'diag_c4', bookId: b.id, n: 4, title: 'Four', content: 'x' }); }
  catch (e) { third = e.code === 11000 ? 'E11000 dup on ' + JSON.stringify(e.keyPattern) : e.message; }
  console.log(`  chapter 4 (plain, AFTER a poll chapter): ${third}   <-- wizard dies here`);
  console.log('  subdoc paths on poll.opts: ' +
    (Chapter.schema.path('poll.opts') && Chapter.schema.path('poll.opts').schema
      ? Object.keys(Chapter.schema.path('poll.opts').schema.paths).join(',') : 'n/a'));

  // Frontend-consumption shapes.
  console.log('\n===== /api/users/:handle keys (profile-service.js + drawer) =====');
  const PW = 'Sup3rSecret!';
  let r = await fetch(base + '/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Diag Reader', username: 'diag_reader', email: 'diag_r@example.com', password: PW }),
  }).then(x => x.json());
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: 'diag_r@example.com', password: PW }),
  }).then(x => x.json());
  const acc = login.access;
  const prof = await fetch(base + '/api/users/diag_reader', { headers: { Authorization: 'Bearer ' + acc } }).then(x => x.json());
  console.log('  keys: ' + Object.keys(prof).join(','));
  ['books', 'collections', 'library', 'posts', 'statuses', 'stats', 'achievements', 'readingStats'].forEach(k => {
    const v = prof[k];
    console.log(`  ${k}: ${v === undefined ? 'MISSING' : (Array.isArray(v) ? 'array(' + v.length + ')' : typeof v)}`);
  });

  console.log('\n===== /api/author/books keys (author bookshelf) =====');
  const ab = await fetch(base + '/api/author/books', { headers: { Authorization: 'Bearer ' + acc } }).then(x => x.json());
  console.log('  top-level keys: ' + Object.keys(ab).join(','));
  console.log('  raw: ' + JSON.stringify(ab).slice(0, 300));

  await mongod.stop();
  process.exit(0);
}
main().catch(e => { console.error('DIAG ERROR', e && e.stack || e); process.exit(2); });
