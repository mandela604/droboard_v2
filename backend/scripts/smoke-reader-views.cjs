'use strict';
// Reader persistence smoke: chapter comments must round-trip in the SAME scope
// the reader fetches, and progress opens must credit real book/chapter views.
process.env.NODE_ENV = 'test';
process.env.PORT = '4207';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BASE = 'http://127.0.0.1:4207';
const out = [];
function check(name, pass, detail) {
  out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ::  ' + JSON.stringify(detail).slice(0, 220) : ''}`);
  console.log(out[out.length - 1]);
}
async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_reader_views');
  require('../src/server');
  for (let i = 0; i < 160; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 250)); }

  const { User } = require('../src/models/user.model');
  const { Book, Chapter } = require('../src/models/content.model');
  const { signAccess } = require('../src/middleware/auth');
  const user = await User.create({
    fullName: 'Reader', email: 'reader@t.co', username: 'reader' + Date.now(),
    passwordHash: 'x', roles: ['reader'], status: 'active',
  });
  const book = await Book.create({
    title: 'Views Book', authorId: String(user.id), status: 'published',
    reads: 0, sharesByChannel: {}, reactions: {},
  });
  const c1 = await Chapter.create({ bookId: book.id, n: 1, title: 'One', status: 'live', content: '<p>one</p>', words: 10, reactions: {} });
  const c2 = await Chapter.create({ bookId: book.id, n: 2, title: 'Two', status: 'live', content: '<p>two</p>', words: 10, reactions: {} });
  const tok = signAccess({ id: user.id, roles: ['reader'] });
  const hdr = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };

  const progress = async (key) => {
    const r = await fetch(BASE + '/api/stories/' + book.id + '/chapters/' + key + '/progress', {
      method: 'POST', headers: hdr, body: JSON.stringify({ secondsSpent: 200, pct: 50 }),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const reads = async () => (await (await fetch(BASE + '/api/books/' + book.id)).json()).reads;
  const views = async (key) => {
    const list = await (await fetch(BASE + '/api/books/' + book.id + '/chapters')).json();
    const rows = Array.isArray(list) ? list : (list.items || []);
    return (rows.find(c => String(c.id) === String(key)) || {}).views;
  };

  check('progress POST accepted', (await progress(c1.id)).status === 200);
  check('first chapter open credits a book read', (await reads()) === 1, await reads());
  check('first chapter open credits chapter views', (await views(c1.id)) === 1, await views(c1.id));
  await progress(c1.id);
  check('reopening the same chapter does not double-count', (await reads()) === 1, await reads());
  await progress(c2.id);
  check('opening a second chapter credits another read', (await reads()) === 2, await reads());

  const post = async (body) => fetch(BASE + '/api/comments', {
    method: 'POST', headers: hdr, body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  let r = await post({ scope: 'chapter', storyId: String(book.id), chapterId: String(c1.id), text: 'Persisted chapter comment' });
  check('chapter-scoped comment saved', r.status === 201, r);
  const list = async (scope) => {
    const q = '/api/comments?scope=' + scope + '&storyId=' + book.id + '&chapterId=' + c1.id;
    const j = await (await fetch(BASE + q)).json();
    return j.items || [];
  };
  check('comment appears in the chapter thread', (await list('chapter')).some(c => c.text === 'Persisted chapter comment'), await list('chapter'));
  // The old scroll-reader bug: story scope + chapterId is a different thread.
  r = await post({ storyId: String(book.id), chapterId: String(c1.id), text: 'Wrong scope comment' });
  check('story-scoped write is NOT the chapter thread', !(await list('chapter')).some(c => c.text === 'Wrong scope comment'));

  fs.writeFileSync(__dirname + '/smoke-reader-views.results.txt', out.join('\n') + '\n');
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
main().catch(e => { console.error(e); fs.writeFileSync(__dirname + '/smoke-reader-views.results.txt', 'FATAL ' + (e.stack || e)); process.exit(1); });
