'use strict';
/* Live in-memory Mongo test for the reader LIBRARY + FEED writes.
   Boots the real app, seeds production-shaped docs, then HTTP-asserts the
   endpoints the library page and feed card actions now call:
     POST   /api/posts/:id/save        → toggle saved
     GET    /api/posts/saved           → the reader's saved rows
     DELETE /api/posts/saved           → "Clear saved"
     DELETE /api/library/history       → "Clear history"
     POST   /api/posts/:id/hide        → "See less of this"
     DELETE /api/posts/:id/hide        → unhide
     GET    /api/users/:h/following    → following list
     POST   /api/users/:h/follow       → follow
     DELETE /api/users/:h/follow       → unfollow
     GET    /api/saves/state           → the save sheet's state read
     POST   /api/saves/quick           → quick save (library|save|later)
     GET    /api/categories            → the feed menu's boards
     GET    /api/collections?owner=me  → the feed menu's collections
*/
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4213';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
delete process.env.GOOGLE_CLIENT_ID;

const { MongoMemoryServer } = require('mongodb-memory-server');
const out = [];
function check(name, pass, detail) {
  out.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 260) : ''}`);
}

const AV1 = 'https://i.pravatar.cc/100?img=32';
const AV2 = 'https://i.pravatar.cc/100?img=9';
const COVER = 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg';

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 90000 } });
  process.env.MONGO_URI = mongod.getUri('dro_library_live');
  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) { /* not up */ }
    await new Promise(r => setTimeout(r, 250));
  }
  async function call(method, path, body, access) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (access) headers.Authorization = `Bearer ${access}`;
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  const { User } = require('../src/models/user.model');
  const { Book, Category } = require('../src/models/content.model');
  const { Post, LibraryItem, Collection } = require('../src/models/social.model');

  // ── Seed: one reader (viewer) + two writers ──
  let r = await call('POST', '/api/auth/signup', { name: 'Reader Two', username: 'readertwo', email: 'r2@test.co', password: 'SecurePass123!' });
  check('Seed signup reader -> 2xx', r.status >= 200 && r.status < 300, `${r.status}`);
  r = await call('POST', '/api/auth/login', { emailOrUsername: 'readertwo', password: 'SecurePass123!' });
  const viewer = r.json.user; const token = r.json.access;
  check('Seed login reader -> token', r.status === 200 && !!token, `${r.status}`);

  const a1 = await User.create({ name: 'Ada Writes', username: 'adawrites', email: 'ada2@test.co', password: 'SecurePass123!', roles: ['writer'], avatar: AV1, fullName: 'Ada Writes' });
  const a2 = await User.create({ name: 'Ben Scribe', username: 'benscribe', email: 'ben2@test.co', password: 'SecurePass123!', roles: ['writer'], avatar: AV2, fullName: 'Ben Scribe' });
  const A1 = String(a1.id), A2 = String(a2.id);

  const book = await Book.create({ title: 'Nine Lives, Twice', authorId: A1, status: 'published', synopsis: 'A tale of two lives.', cover: COVER, reads: 1200, rating: 4.4, ratingCount: 12, genre: 'Fantasy', chapterCount: 3 });

  const p1 = await Post.create({ authorId: A1, type: 'post', text: 'First light on the page.', likesCount: 10, commentsCount: 2 });
  const p2 = await Post.create({ authorId: A2, type: 'poll', text: 'Should it end here?', likesCount: 4, commentsCount: 1 });
  const P1 = String(p1.id), P2 = String(p2.id);

  await LibraryItem.create({ userId: String(viewer.id), storyId: String(book.id), list: 'history' });
  await LibraryItem.create({ userId: String(viewer.id), storyId: String(book.id), list: 'library' });

  // ── 1. Save toggle round-trips through the server ──
  r = await call('POST', `/api/posts/${P1}/save`, undefined, token);
  check('POST /posts/:id/save toggles saved on', r.status === 200 && r.json.saved === true, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/posts/saved', undefined, token);
  const savedIds = (r.json.items || []).map(p => String(p.id));
  check('GET /posts/saved lists the saved post', r.status === 200 && savedIds.includes(P1), `${r.status} ${JSON.stringify(savedIds)}`);
  check('saved card carries the fields the library card renders', r.status === 200 && !!r.json.items[0].name && !!r.json.items[0].avatar && !!r.json.items[0].time,
    JSON.stringify(r.json.items[0] && { name: r.json.items[0].name, avatar: r.json.items[0].avatar, time: r.json.items[0].time }));
  r = await call('POST', `/api/posts/${P1}/save`, undefined, token);
  check('POST /posts/:id/save toggles saved off', r.status === 200 && r.json.saved === false, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/posts/saved', undefined, token);
  check('unsaved post leaves /posts/saved', r.status === 200 && !(r.json.items || []).map(p => String(p.id)).includes(P1), `${r.status}`);

  // ── 2. "Clear saved" drops every saved row at once ──
  await Post.updateOne({ id: P1 }, { $addToSet: { savedBy: String(viewer.id) } });
  await Post.updateOne({ id: P2 }, { $addToSet: { savedBy: String(viewer.id) } });
  r = await call('GET', '/api/posts/saved', undefined, token);
  check('two saved rows before the clear', r.status === 200 && (r.json.items || []).length === 2, `${r.status} n=${(r.json.items || []).length}`);
  r = await call('DELETE', '/api/posts/saved', undefined, token);
  check('DELETE /posts/saved returns ok + count', r.status === 200 && r.json.ok === true && r.json.cleared === 2, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/posts/saved', undefined, token);
  check('no saved rows survive the clear', r.status === 200 && (r.json.items || []).length === 0, `${r.status} n=${(r.json.items || []).length}`);

  // ── 3. "Clear history" empties the history list ──
  r = await call('GET', '/api/library/history', undefined, token);
  check('history has a row before the clear', r.status === 200, `${r.status}`);
  r = await call('DELETE', '/api/library/history', undefined, token);
  check('DELETE /library/history returns ok + count', r.status === 200 && r.json.ok === true && r.json.cleared >= 1, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/library/history', undefined, token);
  check('history is empty after the clear', r.status === 200 && (r.json.items || r.json || []).length === 0, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await call('GET', '/api/library/items', undefined, token);
  const libRows = (r.json.items || r.json || []);
  check('the library list itself is untouched by the history clear', r.status === 200 && libRows.length >= 1, `${r.status} n=${libRows.length}`);

  // ── 4. "See less of this" hides the post from this reader only ──
  r = await call('POST', `/api/posts/${P1}/hide`, undefined, token);
  check('POST /posts/:id/hide marks the post hidden', r.status === 200 && r.json.hidden === true, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/posts?limit=50', undefined, token);
  const feedIds = (r.json.items || []).map(p => String(p.id));
  check('the hidden post is gone from the reader feed', r.status === 200 && !feedIds.includes(P1), `${r.status} ${JSON.stringify(feedIds)}`);
  r = await call('GET', '/api/posts?limit=50', undefined, a2.id);
  const otherIds = (r.json.items || []).map(p => String(p.id));
  check('the hidden post is still there for everyone else', r.status === 200 && otherIds.includes(P1), `${r.status} ${JSON.stringify(otherIds)}`);
  r = await call('DELETE', `/api/posts/${P1}/hide`, undefined, token);
  check('DELETE /posts/:id/hide unhides the post', r.status === 200 && r.json.hidden === false, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/posts?limit=50', undefined, token);
  check('the unhidden post is back in the reader feed', r.status === 200 && (r.json.items || []).map(p => String(p.id)).includes(P1), `${r.status}`);

  // ── 5. Follow / unfollow round-trip ──
  // The viewer follows adawrites, so it is the VIEWER's following list that
  // must grow — adawrites follows nobody, so that list stays empty throughout.
  r = await call('GET', '/api/users/readertwo/following', undefined, token);
  check('following list starts empty', r.status === 200 && (r.json.items || []).length === 0, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await call('POST', '/api/users/adawrites/follow', undefined, token);
  check('POST /users/:h/follow succeeds', r.status === 200 && r.json.ok === true, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await call('GET', '/api/users/readertwo/following', undefined, token);
  const fol = r.json.items || [];
  check('following list now carries the author', r.status === 200 && fol.some(u => String(u.name) === 'adawrites'), `${r.status} ${JSON.stringify(fol.map(u => u.name))}`);
  r = await call('DELETE', '/api/users/adawrites/follow', undefined, token);
  check('DELETE /users/:h/follow succeeds', r.status === 200 && r.json.ok === true, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await call('GET', '/api/users/readertwo/following', undefined, token);
  check('following list is empty again', r.status === 200 && (r.json.items || []).length === 0, `${r.status}`);

  // ── 6. The save sheet reads the same live state ──
  r = await call('GET', `/api/saves/state?storyId=${book.id}`, undefined, token);
  check('GET /saves/state returns ok + state + collections', r.status === 200 && r.json.ok === true && !!r.json.state && Array.isArray(r.json.collections), `${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  check('state exposes the library/save/later keys the sheet reads', r.json.state && 'library' in r.json.state && 'save' in r.json.state && 'later' in r.json.state, JSON.stringify(r.json.state));
  for (const key of ['library', 'save', 'later']) {
    r = await call('POST', '/api/saves/quick', { storyId: String(book.id), key, value: true }, token);
    check('quick-save "' + key + '" writes', r.status === 200 && r.json.ok === true, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }
  r = await call('GET', `/api/saves/state?storyId=${book.id}`, undefined, token);
  check('all three quick saves are on afterwards', r.json.state && r.json.state.library && r.json.state.save && r.json.state.later, JSON.stringify(r.json.state));
  r = await call('POST', '/api/saves/quick', { storyId: String(book.id), key: 'fav', value: true }, token);
  check('the retired "fav" key is rejected', r.status === 400, `${r.status}`);

  // ── 7. The feed menu reads real boards + collections ──
  const cat = await Category.create({ name: 'Fantasy', slug: 'fantasy', status: 'active', desc: 'Where imagination becomes legend.' });
  r = await call('GET', '/api/categories?limit=50', undefined, token);
  const cats = (r.json.items || []);
  check('GET /categories lists the board', r.status === 200 && cats.some(c => c.slug === 'fantasy'), `${r.status} ${JSON.stringify(cats.map(c => c.slug))}`);
  const board = cats.find(c => c.slug === 'fantasy');
  check('category card carries the fields the menu prints', board && !!board.name && board.isJoined === false && board.members !== undefined,
    JSON.stringify(board && { name: board.name, isJoined: board.isJoined, members: board.members, icon: board.icon }));
  r = await call('POST', `/api/categories/${cat.slug}/join`, undefined, token);
  check('joining the board succeeds', r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await call('GET', '/api/categories?limit=50', undefined, token);
  const joined = (r.json.items || []).find(c => c.slug === 'fantasy');
  check('the board now reports isJoined', joined && joined.isJoined === true, JSON.stringify(joined && { isJoined: joined.isJoined }));

  const coll = await Collection.create({ ownerId: String(viewer.id), title: 'Midnight Reads', stories: [String(book.id)], storiesCount: 1 });
  r = await call('GET', '/api/collections?owner=me&limit=50', undefined, token);
  const myCols = Array.isArray(r.json) ? r.json : (r.json.items || []);
  check('GET /collections?owner=me lists the reader\'s collection', r.status === 200 && myCols.some(c => String(c.id) === String(coll.id)), `${r.status} ${JSON.stringify(myCols.map(c => c.title))}`);
  check('collection card carries name/count/cover for the menu', myCols[0] && !!myCols[0].name && myCols[0].count === 1 && !!myCols[0].cover,
    JSON.stringify(myCols[0] && { name: myCols[0].name, count: myCols[0].count, cover: myCols[0].cover }));

  const failed = out.filter(o => !o.pass);
  console.log(`\n===== ${out.length - failed.length}/${out.length} library+feed assertions passed =====`);
  if (failed.length) { console.log('FAILED: ' + failed.map(f => f.name).join(' | ')); process.exitCode = 1; }
  await mongod.stop();
}
main().catch(e => { console.error(e); process.exit(1); });
