'use strict';
/* Full-DB smoke for engagement slices: comments edit/react, post react/share,
 * statuses CRUD, library writes, saves bridge. Needs live Mongo:
 *   MONGO_URI=mongodb+srv://... node smoke.engage.cjs
 * Uses MONGO_URI env or falls back to localhost (fails fast without DB). */
const results = [];
function check(name, cond, extra) {
  results.push({ name, pass: !!cond, extra });
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : ''));
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI first');
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh';
  process.env.MFA_SECRET_KEY = process.env.MFA_SECRET_KEY || 'test-mfa';
  process.env.PORT = process.env.PORT || '4561';
  require('./src/server.js');
  await new Promise(r => setTimeout(r, 2500));
  const BASE = 'http://localhost:' + process.env.PORT;

  const { User } = require('./src/models/user.model');
  const { signAccess } = require('./src/middleware/auth');
  const admin = await User.create({ fullName: 'Eng Admin', username: 'engadmin', email: 'eng@x.io', roles: ['admin'], primaryRole: 'admin', status: 'active' });
  const writer = await User.create({ fullName: 'Eng Writer', username: 'engwriter', email: 'engw@x.io', roles: ['writer'], primaryRole: 'writer', status: 'active' });
  const other = await User.create({ fullName: 'Eng Other', username: 'engother', email: 'engo@x.io', roles: ['reader'], primaryRole: 'reader', status: 'active' });
  const atoken = signAccess({ id: String(admin.id), roles: ['admin'] });
  const wtoken = signAccess({ id: String(writer.id), roles: ['writer'] });
  const otoken = signAccess({ id: String(other.id), roles: ['reader'] });

  async function call(method, path, token, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* empty */ }
    return { status: res.status, json };
  }

  // seed: a post + book + comment via API
  let r = await call('POST', '/api/posts', wtoken, { type: 'post', text: 'hello engage' });
  check('post create', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const postId = r.json.id;
  r = await call('POST', '/api/comments', wtoken, { scope: 'post', postId, text: 'nice post' });
  check('comment create', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const cmtId = r.json.id;

  // comment edit: owner ok, stranger 403
  r = await call('PATCH', '/api/comments/' + cmtId, wtoken, { text: 'edited teks' });
  check('comment edit owner', r.status === 200 && r.json.text === 'edited teks', 'got ' + r.status);
  r = await call('PATCH', '/api/comments/' + cmtId, otoken, { text: 'hijack' });
  check('comment edit stranger 403', r.status === 403, 'got ' + r.status);

  // post reactions: set -> change -> state -> unreact
  r = await call('POST', '/api/posts/' + postId + '/react', wtoken, { rid: 'love' });
  check('post react love', r.status === 200 && r.json.userRx === 'love' && r.json.counts.love === 1, JSON.stringify(r.json));
  r = await call('POST', '/api/posts/' + postId + '/react', otoken, { rid: 'love' });
  check('post react second user', r.status === 200 && r.json.counts.love === 2, JSON.stringify(r.json));
  r = await call('POST', '/api/posts/' + postId + '/react', wtoken, { rid: 'crying' });
  check('post react change moves count', r.status === 200 && r.json.userRx === 'crying' && (r.json.counts.love || 0) === 1 && r.json.counts.crying === 1, JSON.stringify(r.json));
  r = await call('GET', '/api/posts/' + postId + '/reactions', wtoken);
  check('post reactions state', r.status === 200 && r.json.userRx === 'crying', JSON.stringify(r.json));
  r = await call('DELETE', '/api/posts/' + postId + '/react', wtoken);
  check('post unreact', r.status === 200 && r.json.userRx === null && (r.json.counts.crying || 0) === 0, JSON.stringify(r.json));

  // comment reactions
  r = await call('POST', '/api/comments/' + cmtId + '/react', otoken, { rid: 'like' });
  check('comment react', r.status === 200 && r.json.userRx === 'like' && r.json.counts.like === 1, JSON.stringify(r.json));
  r = await call('DELETE', '/api/comments/' + cmtId + '/react', otoken);
  check('comment unreact', r.status === 200 && r.json.userRx === null, JSON.stringify(r.json));

  // share counts
  r = await call('POST', '/api/posts/' + postId + '/share', wtoken, { channel: 'whatsapp' });
  check('share whatsapp x1', r.status === 200 && r.json.sharesCount === 1 && r.json.byChannel.whatsapp === 1, JSON.stringify(r.json));
  r = await call('POST', '/api/posts/' + postId + '/share', otoken, { channel: 'whatsapp' });
  check('share whatsapp x2', r.status === 200 && r.json.sharesCount === 2, JSON.stringify(r.json));

  // statuses: create -> home lists -> view -> like -> delete (owner)
  r = await call('POST', '/api/statuses', wtoken, { bg: 'linear-gradient(#f00,#00f)', quote: 'morning', caption: 'day 1' });
  check('status create 201', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const stId = r.json.id;
  r = await call('GET', '/api/statuses/home', otoken);
  check('status home lists (stranger sees, not following=self?)', r.status === 200 && Array.isArray(r.json.items), 'got ' + r.status + ' n=' + (r.json.items || []).length);
  r = await call('GET', '/api/statuses/home', wtoken);
  check('status home owner sees own', r.status === 200 && (r.json.items || []).some(s => String(s.id) === String(stId)), 'got ' + r.status);
  r = await call('POST', '/api/statuses/' + stId + '/view', otoken);
  check('status view marks viewed', r.status === 200 && r.json.viewed === true, JSON.stringify(r.json).slice(0, 120));
  r = await call('POST', '/api/statuses/' + stId + '/like', otoken);
  check('status like', r.status === 200 && r.json.liked === true && r.json.likes === 1, JSON.stringify(r.json));
  r = await call('DELETE', '/api/statuses/' + stId, otoken);
  check('status delete stranger 403', r.status === 403, 'got ' + r.status);
  r = await call('DELETE', '/api/statuses/' + stId, wtoken);
  check('status delete owner', r.status === 200, 'got ' + r.status);

  // library writes need a book
  const { Book } = require('./src/models/content.model');
  const book = await Book.create({ title: 'Lib Book', authorId: String(writer.id), genre: 'Romance', status: 'published' });
  const bookId = book.id;
  r = await call('POST', '/api/library/items', wtoken, { storyId: String(bookId), list: 'library' });
  check('library add', r.status === 201, 'got ' + r.status);
  r = await call('POST', '/api/saves/quick', wtoken, { storyId: String(bookId), key: 'fav', value: true });
  check('quick fav on', r.status === 200 && r.json.state.fav === true && r.json.state.library === true, JSON.stringify(r.json));
  r = await call('GET', '/api/saves/state?storyId=' + bookId, wtoken);
  check('save state', r.status === 200 && r.json.state.library === true && Array.isArray(r.json.collections), JSON.stringify(r.json).slice(0, 160));
  r = await call('POST', '/api/saves/collections', wtoken, { name: 'Beach reads', icon: 'fa-umbrella' });
  check('collection create', r.status === 201 && !!r.json.collection.id, 'got ' + r.status);
  const collId = r.json.collection.id;
  r = await call('POST', '/api/saves/collections/' + collId + '/toggle', wtoken, { storyId: String(bookId), value: true });
  check('collection toggle on', r.status === 200 && r.json.saved === true && r.json.count === 1, JSON.stringify(r.json));
  r = await call('GET', '/api/saves/state?storyId=' + bookId, wtoken);
  check('save state shows collection saved', r.status === 200 && r.json.collections.some(c => c.saved === true), 'got ' + r.status);
  r = await call('PATCH', '/api/library/items/' + bookId + '/move', wtoken, { from: 'library', to: 'later' });
  check('library move', r.status === 200 && r.json.list === 'later', JSON.stringify(r.json).slice(0, 120));
  r = await call('DELETE', '/api/library/items/' + bookId, wtoken);
  check('library remove all lists', r.status === 200 && r.json.removed >= 2, JSON.stringify(r.json));
  r = await call('POST', '/api/saves/collections/' + collId + '/toggle', otoken, { storyId: String(bookId), value: true });
  check('collection toggle stranger 403', r.status === 403, 'got ' + r.status);

  // ── collections slice: profile-shape CRUD, privacy, follow/share ──
  r = await call('POST', '/api/collections', wtoken, { name: 'Secret Stash', privacy: 'Private', stories: [String(bookId)] });
  check('collections create private w/ story', r.status === 201 && r.json.privacy === 'Private' && r.json.count === 1 && (r.json.storyIds || []).includes(String(bookId)), JSON.stringify(r.json).slice(0, 200));
  const privId = r.json && r.json.id;
  r = await call('POST', '/api/collections', wtoken, { name: 'Follower Finds', privacy: 'Followers' });
  check('collections create followers', r.status === 201 && r.json.privacy === 'Followers', 'got ' + r.status);
  const folId = r.json && r.json.id;
  r = await call('POST', '/api/collections', wtoken, { name: 'Open Shelf', privacy: 'Public', stories: [String(bookId)] });
  check('collections create public', r.status === 201 && r.json.privacy === 'Public', 'got ' + r.status);
  const pubId = r.json && r.json.id;
  r = await call('GET', '/api/collections/' + privId, otoken);
  check('private hidden from stranger 404', r.status === 404, 'got ' + r.status);
  r = await call('GET', '/api/collections/' + privId, wtoken);
  check('private visible to owner', r.status === 200 && r.json.isOwner === true && Array.isArray(r.json.storyList), 'got ' + r.status);
  r = await call('GET', '/api/collections/' + folId, otoken);
  check('followers-only 403 for stranger', r.status === 403, 'got ' + r.status);
  r = await call('GET', '/api/collections', otoken);
  check('discover lists public only', r.status === 200 && Array.isArray(r.json) && r.json.some(c => String(c.id) === String(pubId)) && !r.json.some(c => String(c.id) === String(privId)) && !r.json.some(c => String(c.id) === String(folId)), 'got ' + r.status);
  r = await call('GET', '/api/collections/' + pubId + '/stories', otoken);
  check('public stories cards', r.status === 200 && Array.isArray(r.json) && r.json[0] && r.json[0].title === 'Lib Book' && typeof r.json[0].author === 'string', JSON.stringify(r.json).slice(0, 160));
  r = await call('POST', '/api/collections/' + pubId + '/follow', otoken);
  check('collection follow', r.status === 200 && r.json.following === true && r.json.followers === 1, JSON.stringify(r.json));
  r = await call('GET', '/api/collections/' + pubId, otoken);
  check('detail shows following', r.status === 200 && r.json.following === true && r.json.followers === 1, 'got ' + r.status);
  r = await call('POST', '/api/collections/' + pubId + '/share', otoken, { channel: 'whatsapp' });
  check('collection share', r.status === 200 && r.json.sharesCount === 1, JSON.stringify(r.json));
  r = await call('DELETE', '/api/collections/' + pubId + '/follow', otoken);
  check('collection unfollow', r.status === 200 && r.json.following === false && r.json.followers === 0, JSON.stringify(r.json));
  r = await call('POST', '/api/collections/' + pubId + '/follow', wtoken);
  check('follow own 400', r.status === 400, 'got ' + r.status);
  r = await call('PATCH', '/api/collections/' + pubId, wtoken, { name: 'Open Shelf v2', privacy: 'Followers', stories: [] });
  check('collection patch name+privacy+stories', r.status === 200 && r.json.name === 'Open Shelf v2' && r.json.privacy === 'Followers' && r.json.count === 0, JSON.stringify(r.json));
  r = await call('DELETE', '/api/collections/' + pubId, otoken);
  check('delete stranger 403', r.status === 403, 'got ' + r.status);
  r = await call('DELETE', '/api/collections/' + pubId, wtoken);
  check('delete owner', r.status === 200, 'got ' + r.status);
  r = await call('POST', '/api/saves/collections', wtoken, { name: 'Born in sheet', icon: '📖', storyId: String(bookId) });
  check('saves create with story', r.status === 201 && r.json.collection.saved === true && r.json.collection.count === 1, JSON.stringify(r.json));

  const failed = results.filter(x => !x.pass);
  console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' passed ====');
  if (failed.length) console.log('FAILED: ' + failed.map(f => f.name).join(', '));
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('SMOKE FATAL', e); process.exit(2); });
