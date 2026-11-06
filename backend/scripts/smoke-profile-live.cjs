'use strict'
// Live profile-page contract: boots the REAL Express app against an in-memory
// MongoDB and asserts GET /api/users/:handle returns every field the profile
// page renders (header, stats, books/library/collections/following tabs, feed,
// story ring) — then drives the write endpoints the page's buttons call.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4197';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 200) : ''}`);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('droboard_profile');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { Post, Follow, Status, Collection, ReadingProgress, LibraryItem } = require('../src/models/social.model');
  const argon2 = require('argon2');
  const jwt = require('jsonwebtoken');

  async function call(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(base + path, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  const stamp = Date.now();
  const handle = 'prof_writer_' + String(stamp).slice(-6);
  const hash = await argon2.hash('Sup3rSecret!', { type: argon2.argon2id });

  const owner = await User.create({
    id: 'u-owner-' + stamp,
    fullName: 'Profile Writer', username: handle, email: handle + '@t.co',
    passwordHash: hash, authProvider: 'local',
    roles: ['writer'], primaryRole: 'writer', status: 'active',
    emailVerified: true, avatar: 'https://i.pravatar.cc/150?img=12',
    cover: 'https://picsum.photos/seed/cover/900/300',
    bio: 'Writing revenge drama.', location: 'Lagos, Nigeria',
    genres: ['revenge', 'drama'],
    about: { favoriteGenres: ['revenge', 'drama'], extra: [{ icon: 'fa-fire', label: 'Fastest', value: 'daily' }] },
    followerCount: 7, followingCount: 3, postCount: 2, commentCount: 4,
  });
  const token = jwt.sign({ sub: owner.id, roles: ['writer'] }, process.env.JWT_ACCESS_SECRET);

  // the fields the Books tab consumes
  await Book.create({
    id: 'b-1-' + stamp, title: 'Crown of Ashes', authorId: owner.id, genre: 'revenge',
    cover: 'https://picsum.photos/seed/b1/200/280', reads: 1200, likes: 88,
    rating: 4.6, chapterCount: 12, status: 'ongoing',
  });
  await Book.create({
    id: 'b-2-' + stamp, title: 'Silent Vows', authorId: owner.id, genre: 'drama',
    cover: 'https://picsum.photos/seed/b2/200/280', reads: 340, likes: 20,
    rating: 4.1, chapterCount: 5, status: 'completed',
  });
  // feed posts (card-ready)
  await Post.create({ id: 'p-1-' + stamp, authorId: owner.id, type: 'post', text: 'Chapter 12 is live.', likesCount: 30, commentsCount: 4, status: 'published', pinned: true });
  await Post.create({ id: 'p-2-' + stamp, authorId: owner.id, type: 'quote', quote: 'a quote', caption: 'a quote', status: 'published' });
  // live story for the avatar ring
  await Status.create({ id: 's-1-' + stamp, userId: String(owner.id), bg: 'linear-gradient(135deg,#ff0050,#7c5cfc)', quote: 'New chapter today', viewedBy: ['someone-else'], likedBy: [], likes: 2, expiresAt: new Date(Date.now() + 86400000) });
  // a followed account for the Following tab
  const other = await User.create({ id: 'u-other-' + stamp, fullName: 'Other Reader', username: 'prof_other_' + String(stamp).slice(-6), email: 'other' + stamp + '@t.co', passwordHash: hash, roles: ['reader'], primaryRole: 'reader', status: 'active', avatar: 'https://i.pravatar.cc/100?img=5', bio: 'Just here for the twists.' });
  await Follow.create({ followerId: owner.id, followingId: other.id });
  await Follow.create({ followerId: other.id, followingId: owner.id });
  await Collection.create({ id: 'c-1-' + stamp, ownerId: owner.id, title: 'Midnight Reads', privacy: 'public', stories: ['b-1-' + stamp], storiesCount: 1 });
  await LibraryItem.create({ userId: String(owner.id), storyId: 'b-2-' + stamp, list: 'saved', status: 'saved' });
  await ReadingProgress.create({ userId: String(owner.id), storyId: 'b-1-' + stamp, chapterKey: '1', secondsSpent: 5400, wordsRead: 3000, lastReadAt: new Date(), finished: false });

  /* ── 1. the read contract: GET /api/users/:handle ── */
  let r = await call('GET', '/api/users/' + handle, undefined, token);
  check('GET /api/users/:handle -> 200', r.status === 200, `status=${r.status}`);
  const p = r.json || {};

  // header
  check('header: name', p.name === 'Profile Writer', `name=${p.name}`);
  check('header: handle + username', p.handle === handle && p.username === handle, `handle=${p.handle}`);
  check('header: avatar + cover urls', !!p.avatar && !!p.cover, `avatar=${String(p.avatar).slice(0, 24)}`);
  check('header: bio', p.bio === 'Writing revenge drama.', `bio=${p.bio}`);
  check('header: verified -> badge', p.verified === true, `verified=${p.verified}`);
  check('header: isWriter -> role tag + Books tab', p.isWriter === true, `isWriter=${p.isWriter}`);
  check('header: genres -> pills', Array.isArray(p.genres) && p.genres.length === 2, JSON.stringify(p.genres));

  // stats row
  const s = p.stats || {};
  check('stats: followers/following', s.followers === 7 && s.following === 3, JSON.stringify({ f: s.followers, g: s.following }));
  check('stats: books count matches array', s.books === 2 && Array.isArray(p.books) && p.books.length === 2, JSON.stringify({ statBooks: s.books, arr: p.books && p.books.length }));
  check('stats: reads summed from books', s.reads === 1540, `reads=${s.reads}`);
  check('stats: likes summed from books', s.likes === 108, `likes=${s.likes}`);
  check('stats: saved from library', typeof s.saved === 'number', `saved=${s.saved}`);
  check('stats: readingHours from ReadingProgress', s.readingHours > 0, `hours=${s.readingHours}`);
  check('stats: streak from reading days', typeof s.streak === 'number', `streak=${s.streak}`);

  // books tab card shape
  const b0 = (p.books || [])[0] || {};
  check('books[]: id/title/cat/cover', !!b0.id && !!b0.title && 'cat' in b0 && !!b0.cover, JSON.stringify(b0));
  check('books[]: reads/likes/chapters/status', 'reads' in b0 && 'likes' in b0 && 'chapters' in b0 && !!b0.status, JSON.stringify({ reads: b0.reads, ch: b0.chapters, st: b0.status }));

  // other tabs
  check('library[] present', Array.isArray(p.library), `type=${typeof p.library}`);
  check('collections[] present', Array.isArray(p.collections) && p.collections.length === 1, JSON.stringify(p.collections && p.collections.map(c => c.name || c.title)));
  const fr = (p.following || [])[0] || {};
  check('following[]: name/av/meta/following', !!fr.name && 'av' in fr && !!fr.meta && fr.following === true, JSON.stringify(fr));
  const c0 = (p.posts || [])[0] || {};
  check('posts[] card-ready: poster header + mine', (p.posts || []).length === 2
    && !!c0.name && !!c0.handle && !!c0.avatar && 'verified' in c0 && c0.fullName === 'Profile Writer' && c0.mine === true,
    JSON.stringify({ name: c0.name, handle: c0.handle, full: c0.fullName, av: !!c0.avatar, verified: c0.verified, mine: c0.mine }));
  check('posts[] card-ready: reaction + ballot state present', 'reactions' in c0 && 'userRx' in c0 && 'liked' in c0 && 'saved' in c0, JSON.stringify({ rx: c0.reactions, userRx: c0.userRx }));
  check('posts[]: pinned first', (p.posts || [])[0] && p.posts[0].id === 'p-1-' + stamp, JSON.stringify((p.posts || []).map(x => x.id)));
  check('statuses[] drive the story ring', Array.isArray(p.statuses) && p.statuses.length === 1 && !!p.statuses[0].bg && !!p.statuses[0].time, JSON.stringify(p.statuses && p.statuses[0]));
  check('about: favoriteGenres + extra', !!p.about && Array.isArray(p.about.favoriteGenres) && Array.isArray(p.about.extra), JSON.stringify(p.about));
  check('about: location + joinedLabel', p.location === 'Lagos, Nigeria' && /^Joined /.test(p.joinedLabel || ''), JSON.stringify({ l: p.location, j: p.joinedLabel }));
  check('achievements[] present', Array.isArray(p.achievements), `type=${typeof p.achievements}`);
  check('isOwner true for the signed-in viewer', p.isOwner === true, `isOwner=${p.isOwner}`);

  r = await call('GET', '/api/users/' + handle + '/followers?page=1&limit=10');
  const fRows = (r.json && (r.json.items || r.json.users || r.json.followers)) || [];
  check('GET /users/:handle/followers -> 200 + row shape', r.status === 200 && fRows.length >= 1 && !!fRows[0].name, `status=${r.status} rows=${JSON.stringify(fRows).slice(0, 160)}`);
  r = await call('GET', '/api/users/' + handle + '/following?page=1&limit=10');
  check('GET /users/:handle/following -> 200 + rows', r.status === 200 && (r.json && (r.json.items || r.json.users || r.json.followers || r.json.following) || []).length >= 1, `status=${r.status}`);

  /* ── 2. the write contracts behind the page's buttons ── */
  r = await call('POST', '/api/users/' + other.username + '/follow', undefined, token);
  check('follow button -> POST /users/:handle/follow 2xx', r.status < 300, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('DELETE', '/api/users/' + other.username + '/follow', undefined, token);
  check('unfollow button -> DELETE /users/:handle/follow 2xx', r.status < 300, `status=${r.status}`);

  r = await call('PATCH', '/api/users/me', { bio: 'Updated bio.', location: 'Abuja, Nigeria' }, token);
  check('edit profile -> PATCH /users/me 2xx', r.status === 200, `status=${r.status}`);
  r = await call('GET', '/api/users/' + handle, undefined, token);
  check('edited bio persists to the profile read', r.json && r.json.bio === 'Updated bio.', `bio=${r.json && r.json.bio}`);

  // Genre row: 4 slots max, drawn from the CE's live catalogue (onboarding
  // taste endpoints are gone — this is the only writer).
  const { Genre } = require('../src/models/content.model');
  await Genre.create([
    { name: 'revenge', slug: 'revenge', categoryId: 'cat-prof-1', status: 'active' },
    { name: 'drama', slug: 'drama', categoryId: 'cat-prof-1', status: 'active' },
    { name: 'fantasy', slug: 'fantasy', categoryId: 'cat-prof-1', status: 'active' },
    { name: 'mafia', slug: 'mafia', categoryId: 'cat-prof-1', status: 'active' },
    { name: 'horror', slug: 'horror', categoryId: 'cat-prof-1', status: 'active' },
    { name: 'retired', slug: 'retired', categoryId: 'cat-prof-1', status: 'inactive' },
  ]);
  r = await call('PATCH', '/api/users/me', { genres: ['revenge', 'drama', 'fantasy'] }, token);
  check('genre row save -> PATCH /users/me 2xx', r.status === 200 && (r.json.genres || []).length === 3, `status=${r.status} genres=${JSON.stringify(r.json && r.json.genres)}`);
  r = await call('PATCH', '/api/users/me', { genres: ['revenge', 'drama', 'fantasy', 'mafia', 'horror'] }, token);
  check('5th genre refused (4 slots)', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/users/me', { genres: ['not-a-ce-genre'] }, token);
  check('genre outside the CE catalogue refused', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/users/me', { genres: ['retired'] }, token);
  check('genre the CE switched off refused', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/users/me', { genres: ['revenge', 'revenge', 'drama'] }, token);
  check('duplicate picks collapse', r.status === 200 && (r.json.genres || []).length === 2, JSON.stringify(r.json && r.json.genres));
  r = await call('GET', '/api/users/me/tastes', undefined, token);
  check('onboarding taste endpoint is gone', r.status === 404, `status=${r.status}`);
  r = await call('GET', '/api/users/' + handle, undefined, token);
  check('rejected writes leave the row untouched', r.status === 200 && JSON.stringify(r.json.genres) === JSON.stringify(['revenge', 'drama']), JSON.stringify(r.json && r.json.genres));

  r = await call('POST', '/api/posts', { type: 'post', text: 'Hello from the profile composer.' }, token);
  const newPost = r.json && (r.json.post || r.json);
  check('new post -> POST /api/posts 2xx', r.status < 300 && newPost && newPost.id, `status=${r.status}`);
  const pid = newPost && newPost.id;

  r = await call('PATCH', '/api/posts/' + pid, { pinned: true }, token);
  check('pin -> PATCH /api/posts/:id {pinned} 2xx', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/posts/' + pid + '/react', { rid: 'love' }, token);
  check('react -> POST /api/posts/:id/react 2xx', r.status < 300, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/posts/' + pid + '/save', {}, token);
  check('save -> POST /api/posts/:id/save 2xx', r.status < 300, `status=${r.status}`);
  r = await call('PATCH', '/api/posts/' + pid, { text: 'Edited text.' }, token);
  check('edit -> PATCH /api/posts/:id 2xx', r.status === 200, `status=${r.status}`);
  r = await call('DELETE', '/api/posts/' + pid, undefined, token);
  check('delete -> DELETE /api/posts/:id 2xx', r.status < 300, `status=${r.status}`);

  r = await call('GET', '/api/notifications/unread-count', undefined, token);
  check('notif badge -> GET /notifications/unread-count 200', r.status === 200 && typeof (r.json && r.json.count) === 'number', `status=${r.status} ${JSON.stringify(r.json)}`);

  // collections CRUD (already live in profile-data.js)
  r = await call('POST', '/api/collections', { name: 'Test List', privacy: 'Public', stories: ['b-1-' + stamp] }, token);
  const cid = r.json && (r.json.id || (r.json.collection && r.json.collection.id));
  check('create collection -> POST /api/collections 2xx', r.status < 300 && !!cid, `status=${r.status}`);
  r = await call('PATCH', '/api/collections/' + cid, { name: 'Renamed List' }, token);
  check('rename -> PATCH /api/collections/:id 2xx', r.status === 200, `status=${r.status}`);
  r = await call('GET', '/api/collections?owner=me', undefined, token);
  check('my list -> GET /api/collections?owner=me 200', r.status === 200, `status=${r.status}`);
  r = await call('GET', '/api/collections?owner=' + handle);
  check('someone else list -> GET /api/collections?owner=<handle> 200', r.status === 200, `status=${r.status}`);
  r = await call('GET', '/api/collections/eligible-stories', undefined, token);
  check('story picker -> GET /api/collections/eligible-stories 200', r.status === 200 && !!(r.json && r.json.items), `status=${r.status}`);
  r = await call('DELETE', '/api/collections/' + cid, undefined, token);
  check('delete collection -> DELETE /api/collections/:id 2xx', r.status < 300, `status=${r.status}`);

  /* ── 3. the visitor view: privacy + isFollowing without a session ── */
  const anon = await call('GET', '/api/users/' + handle);
  check('visitor can read a public profile -> 200', anon.status === 200, `status=${anon.status}`);
  check('visitor sees isOwner=false', anon.json && anon.json.isOwner === false, `isOwner=${anon.json && anon.json.isOwner}`);
  check('visitor gets no owner-only status views field', anon.json && anon.json.statuses && 'views' in anon.json.statuses[0] === false, JSON.stringify(anon.json && anon.json.statuses && anon.json.statuses[0]));

  await User.updateOne({ _id: owner._id }, { $set: { 'settings.privacy': 'private' } });
  const priv = await call('GET', '/api/users/' + handle);
  check('private profile -> visitor gets isPrivate + empty feed', priv.status === 200 && priv.json && priv.json.isPrivate === true
    && (priv.json.posts || []).length === 0 && (priv.json.library || []).length === 0, `status=${priv.status} isPrivate=${priv.json && priv.json.isPrivate} posts=${(priv.json && priv.json.posts || []).length}`);
  const privOwner = await call('GET', '/api/users/' + handle, undefined, token);
  check('private profile -> owner still sees own content', privOwner.status === 200 && privOwner.json && privOwner.json.isOwner === true
    && (privOwner.json.posts || []).length >= 2, `isOwner=${privOwner.json && privOwner.json.isOwner} posts=${(privOwner.json && privOwner.json.posts || []).length}`);
  await User.updateOne({ _id: owner._id }, { $set: { 'settings.privacy': 'public' } });

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} live profile-page assertions passed =====`);
  for (const f of results.filter(x => !x.pass)) console.log(`  FAIL ${f.name}`);
  await mongod.stop();
  process.exit(passed === results.length ? 0 : 1);
}
main().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });
