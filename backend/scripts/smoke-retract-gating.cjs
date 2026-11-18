'use strict';
// Vote retract is a staff correction: readers get 403; admin/mod/chief/senior pass.
process.env.NODE_ENV = 'test';
process.env.PORT = '4214';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BASE = 'http://127.0.0.1:4214';
const out = [];
function check(name, pass, detail) {
  out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + JSON.stringify(detail).slice(0, 200) : ''}`);
  console.log(out[out.length - 1]);
}
const delay = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 120000, startupTimeout: 120000 } });
  process.env.MONGO_URI = mongod.getUri('dro_retract_gating');
  require('../src/server');
  for (let i = 0; i < 160; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {} await delay(250); }

  const { User } = require('../src/models/user.model');
  const { Book, Chapter, EngagementVote } = require('../src/models/content.model');
  const { Post } = require('../src/models/social.model');
  const { signAccess } = require('../src/middleware/auth');
  const mk = async (n, roles) => User.create({ fullName: n, email: n + '@t.co', username: n + Date.now(), passwordHash: 'x', roles, status: 'active' });
  const reader = await mk('reader', ['reader']);
  const admin = await mk('admin', ['admin']);
  const mod = await mk('mod', ['moderator']);
  const H = u => ({ Authorization: 'Bearer ' + signAccess({ id: u.id, roles: u.roles }), 'Content-Type': 'application/json' });
  const uniq = Date.now();

  const post = await Post.create({
    authorId: String(reader.id), type: 'poll', title: 'Retract post',
    text: 'test', poll: { q: 'Q', opts: [{ t: 'A', v: 1 }, { t: 'B', v: 0 }], votes: [{ user: String(reader.id), opt: 0 }] },
    debateData: { motion: 'M', forV: 1, agV: 0, votes: [{ user: String(reader.id), side: 'for' }] },
  });
  const book = await Book.create({
    title: 'Retract Book ' + uniq, slug: 'retract-' + uniq, authorId: String(reader.id), status: 'ongoing',
    polls: [{ id: 'bpoll', q: 'Q', opts: [{ t: 'A', v: 1 }, { t: 'B', v: 0 }] }],
  });
  const ch = await Chapter.create({
    bookId: String(book.id), n: 1, title: 'One', status: 'live',
    poll: { id: 'cpoll', q: 'Q', opts: [{ t: 'A', v: 1 }, { t: 'B', v: 0 }] },
  });

  await EngagementVote.create({ chapterId: String(ch.id), userId: String(reader.id), kind: 'poll', optionIdx: 0 });
  await EngagementVote.create({ bookId: String(book.id), chapterId: '', itemId: 'bpoll', userId: String(reader.id), kind: 'poll', optionIdx: 0 });
  // Staff retract their OWN vote (the service uses the caller's id), so seed theirs too.
  await EngagementVote.create({ chapterId: String(ch.id), userId: String(admin.id), kind: 'poll', optionIdx: 0 });
  await EngagementVote.create({ bookId: String(book.id), chapterId: '', itemId: 'bpoll', userId: String(mod.id), kind: 'poll', optionIdx: 0 });

  const del = (u, url) => fetch(BASE + url, { method: 'DELETE', headers: H(u) });
  check('post poll retract: reader 403', (await del(reader, `/api/posts/${post.id}/poll/vote`)).status === 403);
  check('post poll retract: admin 200', (await del(admin, `/api/posts/${post.id}/poll/vote`)).status === 200);
  check('post debate retract: reader 403', (await del(reader, `/api/posts/${post.id}/debate/vote`)).status === 403);
  check('post debate retract: moderator 200', (await del(mod, `/api/posts/${post.id}/debate/vote`)).status === 200);
  check('chapter retract: reader 403', (await del(reader, `/api/stories/${book.id}/chapters/${ch.id}/poll`)).status === 403);
  check('chapter retract: admin 200', (await del(admin, `/api/stories/${book.id}/chapters/${ch.id}/poll`)).status === 200);
  check('book retract: reader 403', (await del(reader, `/api/stories/${book.id}/engagement/poll/bpoll`)).status === 403);
  check('book retract: moderator 200', (await del(mod, `/api/stories/${book.id}/engagement/poll/bpoll`)).status === 200);

  fs.writeFileSync(__dirname + '/smoke-retract-gating.results.txt', out.join('\n') + '\n');
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
main().catch(e => { console.error(e); fs.writeFileSync(__dirname + '/smoke-retract-gating.results.txt', 'FATAL ' + (e.stack || e)); process.exit(1); });
