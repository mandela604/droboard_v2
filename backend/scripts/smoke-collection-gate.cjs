'use strict'
/* STORY ACCESS RULE — live proof of the collection reading gate.
   boots the REAL app against in-memory Mongo and asserts, over HTTP, what a
   reader must satisfy before a book can enter a collection, and what the
   refusal tells the UI.
   Rule under test: backend/src/services/collections.service.js
     mode 'read', minChapters 15 — own books always pass; a short needs its
     own chapter count, not 15; quick-save is NOT gated. */
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4201';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);

const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 220) : ''}`);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000, launchTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('droboard_gate');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) { /* booting */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Book, Chapter } = require('../src/models/content.model');
  const { ReadingProgress } = require('../src/models/social.model');
  const argon2 = require('argon2');
  const jwt = require('jsonwebtoken');
  const cols = require('../src/services/collections.service');

  check('the rule is in read mode (a requirement exists at all)',
    cols.STORY_ACCESS_RULE.mode === 'read' && cols.STORY_ACCESS_RULE.minChapters === 15,
    JSON.stringify(cols.STORY_ACCESS_RULE));

  async function call(method, urlPath, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(base + urlPath, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  const stamp = Date.now();
  const hash = await argon2.hash('Sup3rSecret!', { type: argon2.argon2id });
  const sign = (u) => jwt.sign({ sub: u.id, roles: u.roles }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

  const mkUser = (n, roles) => User.create({
    id: 'u-' + n + '-' + stamp, fullName: n, username: n + stamp, email: n + stamp + '@t.co',
    passwordHash: hash, authProvider: 'local', roles: [roles], primaryRole: roles, status: 'active',
    emailVerified: true, avatar: 'https://i.pravatar.cc/150?img=12',
  });
  const reader = await mkUser('gate_reader', 'reader');
  const author = await mkUser('gate_author', 'writer');
  const readerToken = sign(reader);
  const authorToken = sign(author);

  // A long book (20 chapters -> the 15 rule bites) and a short one (5 chapters
  // -> the requirement must cap at 5, never 15).
  async function mkBook(ownerId, title, nCh) {
    const b = await Book.create({
      id: 'bk-' + title.replace(/\W+/g, '') + '-' + stamp, title, authorId: String(ownerId),
      author: 'Gate Author', cover: 'https://i.postimg.cc/N9jY0w4m/5.jpg',
      status: 'published', visibility: 'public', chapterCount: nCh,
    });
    for (let i = 1; i <= nCh; i++) {
      await Chapter.create({
        id: `ch-${title.replace(/\W+/g, '')}-${i}-${stamp}`, bookId: String(b.id), n: i,
        title: 'Ch ' + i, content: '<p>' + 'x'.repeat(120) + '</p>', status: 'published',
      });
    }
    return b;
  }
  const long = await mkBook(author.id, 'Long Serial', 20);
  const short = await mkBook(author.id, 'Short Story', 5);
  const own = await mkBook(reader.id, 'My Own Book', 30);

  /* A credited read = a chapter row with finished:true, or secondsSpent>=120.
     An open-only row (0s, unfinished) must NOT count. */
  /* {userId,storyId,chapterId} is uniquely indexed, so each credited chapter is
     upserted at its real number: from=1,count=14 then from=15,count=1 writes
     15 distinct chapters instead of colliding on chapter 1. */
  async function readChapters(book, count, opts) {
    const from = (opts && opts.from) || 1;
    for (let i = from; i < from + count; i++) {
      await ReadingProgress.updateOne(
        { userId: String(reader.id), storyId: String(book.id),
          chapterId: `ch-${book.title.replace(/\W+/g, '')}-${i}-${stamp}` },
        { $set: { finished: !!(opts && opts.finished), secondsSpent: (opts && opts.seconds) || 0,
                  pct: 100, lastReadAt: new Date() } },
        { upsert: true });
    }
  }

  /* ── 1. nothing read: refused, and the refusal carries the numbers ── */
  let r = await call('POST', '/api/collections', { name: 'Premature', stories: [String(long.id)] }, readerToken);
  check('adding an unread book to a collection -> 403', r.status === 403, 'status=' + r.status);
  check('refusal names the rule', r.json && r.json.error === 'insufficient_reading', JSON.stringify(r.json));
  check('refusal tells the UI required=15 and chaptersRead=0',
    r.json && r.json.required === 15 && r.json.chaptersRead === 0,
    'required=' + (r.json && r.json.required) + ' chaptersRead=' + (r.json && r.json.chaptersRead));

  /* ── 2. opening chapters without reading them does not qualify ── */
  await readChapters(long, 10, { finished: false, seconds: 0 });
  r = await call('POST', '/api/collections', { name: 'Still Not Enough', stories: [String(long.id)] }, readerToken);
  check('10 opened-but-unread chapters still refused (and counts them as 0)',
    r.status === 403 && r.json.chaptersRead === 0, 'status=' + r.status + ' read=' + (r.json && r.json.chaptersRead));

  /* ── 3. below the bar ── */
  await ReadingProgress.deleteMany({ userId: String(reader.id) });
  await readChapters(long, 14, { finished: true });
  r = await call('POST', '/api/collections', { name: 'One Short', stories: [String(long.id)] }, readerToken);
  check('14 chapters read -> still refused, chaptersRead=14',
    r.status === 403 && r.json.chaptersRead === 14, 'status=' + r.status + ' read=' + (r.json && r.json.chaptersRead));

  /* ── 4. at the bar ── */
  await readChapters(long, 1, { from: 15, seconds: 120 }); // 15th chapter qualifies on time alone
  r = await call('POST', '/api/collections', { name: 'Earned It', stories: [String(long.id)] }, readerToken);
  check('15 chapters read -> allowed', r.status === 201 || r.status === 200,
    'status=' + r.status + ' id=' + (r.json && r.json.id));
  check('created collection reports the story and its cover',
    r.json && r.json.count === 1 && Array.isArray(r.json.covers) && r.json.covers.length === 1,
    'count=' + (r.json && r.json.count) + ' covers=' + JSON.stringify(r.json && r.json.covers));

  /* ── 5. a short caps the requirement at its own length ── */
  r = await call('POST', '/api/collections', { name: 'Short Try', stories: [String(short.id)] }, readerToken);
  check('5-chapter short with 0 read -> refused asking for 5, not 15',
    r.status === 403 && r.json.required === 5,
    'required=' + (r.json && r.json.required) + ' read=' + (r.json && r.json.chaptersRead));
  await readChapters(short, 5, { finished: true });
  r = await call('POST', '/api/collections', { name: 'Short Earned', stories: [String(short.id)] }, readerToken);
  check('reading all 5 chapters of the short -> allowed', r.status === 200 || r.status === 201, 'status=' + r.status);

  /* ── 6. your own book never needs reading ── */
  r = await call('POST', '/api/collections', { name: 'My Shelf', stories: [String(own.id)] }, readerToken);
  check('own book passes with zero chapters read', r.status === 200 || r.status === 201, 'status=' + r.status);

  /* ── 7. the save-sheet paths obey the same single rule ── */
  const fresh = await mkBook(author.id, 'Never Touched', 20);
  r = await call('POST', '/api/saves/collections', { name: 'From Sheet', storyId: String(fresh.id) }, readerToken);
  check('save-sheet create with an unread story -> 403 + numbers',
    r.status === 403 && r.json.required === 15 && r.json.chaptersRead === 0,
    'status=' + r.status + ' body=' + JSON.stringify(r.json));
  const made = await call('POST', '/api/collections', { name: 'Toggle Target', stories: [String(long.id)] }, readerToken);
  const collId = made.json && made.json.id;
  r = await call('POST', '/api/saves/collections/' + collId + '/toggle', { storyId: String(fresh.id), value: true }, readerToken);
  check('adding an unread story to an EXISTING collection -> 403',
    r.status === 403, 'status=' + r.status + ' body=' + JSON.stringify(r.json));
  r = await call('POST', '/api/posts', {}, readerToken); // unrelated call, keeps limiter warm
  for (const key of ['library', 'fav', 'later']) {
    const q = await call('POST', '/api/saves/quick', { storyId: String(fresh.id), key, value: true }, readerToken);
    check('quick-save "' + key + '" stays UNGATED on an unread book', q.status === 200,
      'status=' + q.status + ' body=' + JSON.stringify(q.json).slice(0, 90));
  }

  /* ── 8. the picker must not offer what the server will refuse ── */
  const ghost = await mkBook(author.id, 'Never Seen', 20);
  r = await call('GET', '/api/collections/eligible-stories', undefined, readerToken);
  const items = (r.json && (r.json.items || r.json)) || [];
  const byId = {};
  items.forEach(s => { byId[String(s.id)] = s; });
  check('eligible-stories lists the read book as eligible',
    byId[String(long.id)] && byId[String(long.id)].eligible === true && byId[String(long.id)].chaptersRead === 15,
    JSON.stringify(byId[String(long.id)]));
  check('a saved-but-unread book is offered with eligible:false + the real counts',
    byId[String(fresh.id)] && byId[String(fresh.id)].eligible === false
      && byId[String(fresh.id)].chaptersRead === 0 && byId[String(fresh.id)].required === 15,
    JSON.stringify(byId[String(fresh.id)]));
  check('a book never read and never saved is not offered at all',
    !byId[String(ghost.id)], JSON.stringify(byId[String(ghost.id)]));
  check('eligible-stories marks an own book eligible regardless of reading',
    byId[String(own.id)] && byId[String(own.id)].eligible !== false, JSON.stringify(byId[String(own.id)]));

  const passed = results.filter(x => x.pass).length;
  console.log('\n===== ' + passed + '/' + results.length + ' collection-gate assertions passed =====');
  try { fs.writeFileSync(path.join(__dirname, 'smoke-collection-gate.results.txt'), results.map(x => (x.pass ? 'PASS' : 'FAIL') + '  ' + x.name).join('\n') + '\n'); } catch (e) { /* reporting only */ }
  await mongod.stop();
  process.exit(passed === results.length ? 0 : 1);
}
main().catch(async (e) => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
