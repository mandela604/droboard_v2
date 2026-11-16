'use strict';
// Debate routing smoke: proves the book/chapter debate metadata endpoint is
// reached (and that ordinary story detail still works).
process.env.NODE_ENV = 'test';
process.env.PORT = '4199';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BASE = 'http://127.0.0.1:4199';
const out = [];
function check(name, ok, detail) { out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ::  ' + JSON.stringify(detail).slice(0, 220) : ''}`); console.log(out[out.length - 1]); }

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_debate_routing');
  require('../src/server');
  for (let i = 0; i < 160; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 250)); }
  const { User } = require('../src/models/user.model');
  const { Book, Chapter } = require('../src/models/content.model');
  const u = await User.create({ fullName: 'Writer', email: 'w@t.co', username: 'w' + Date.now(), passwordHash: 'x', roles: ['writer'], status: 'active' });
  const book = await Book.create({ title: 'A Book', authorId: String(u.id), status: 'published', debates: [{ id: 'bookdeb1', motion: 'Book motion?', forV: 3, agV: 1 }], sharesByChannel: {} });
  const ch = await Chapter.create({ bookId: book.id, n: 1, title: 'Ch1', status: 'live', debate: { id: 'chdeb1', motion: 'Chapter motion?', forV: 2, agV: 4 }, reactions: {} });

  const get = async (path) => { const r = await fetch(BASE + path, { credentials: 'include' }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j }; };

  let r = await get('/api/stories/chdeb1?book=' + book.id + '&ch=' + ch.id);
  check('chapter debate metadata', r.status === 200 && r.body && r.body.motion === 'Chapter motion?', r);
  r = await get('/api/stories/chdeb1?book=' + book.id + '&ch=1');
  check('chapter debate metadata accepts chapter number', r.status === 200 && r.body && r.body.motion === 'Chapter motion?', r);
  r = await get('/api/stories/bookdeb1?book=' + book.id);
  check('book debate metadata', r.status === 200 && r.body && r.body.motion === 'Book motion?', r);
  r = await get('/api/stories/' + book.id + '/engagement');
  check('story engagement exposes debate ids (book-only deep link)', r.status === 200 && r.body && r.body.engagement && Array.isArray(r.body.engagement.debates) && r.body.engagement.debates.length > 0, r);
  r = await get('/api/debates/chdeb1/args?book=' + book.id + '&ch=' + ch.id);
  check('chapter debate arguments', r.status === 200 && Array.isArray(r.body && r.body.items), r);
  r = await get('/api/stories/' + book.id);
  check('story detail still works', r.status === 200 && r.body && String(r.body.id) === String(book.id), r);

  fs.writeFileSync(__dirname + '/smoke-debate-routing.results.txt', out.join('\n') + '\n');
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
main().catch(e => { console.error(e); fs.writeFileSync(__dirname + '/smoke-debate-routing.results.txt', 'FATAL ' + (e.stack || e)); process.exit(1); });
