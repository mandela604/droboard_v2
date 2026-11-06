'use strict'
// Live Droboard-page contract: boots the REAL Express app against an in-memory
// MongoDB and asserts that the two endpoints public/services/droboard-page-service.js
// calls in USE_API mode return every field the page renders.
//
//   fetchPosts()       -> GET /api/droboard-page/posts?limit=50   (compat alias)
//   fetchCollections() -> GET /api/collections
//   handleTip()        -> POST /api/wallet/tip
//
// The cards render through component/post-card.js, so the required shape is
// post-card's reads plus this page's own mapPost()/renderFeed() reads.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4199';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000, launchTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('droboard_droboard_page');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Post, Collection } = require('../src/models/social.model');
  const argon2 = require('argon2');
  const jwt = require('jsonwebtoken');

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
  const signAccess = (u) => jwt.sign({ sub: u.id, roles: u.roles }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

  // The official account, the shouted-out writer, and the tipping reader.
  const official = await User.create({
    id: 'u-droboard-' + stamp, fullName: 'Droboard', username: 'droboard' + String(stamp).slice(-4),
    email: 'droboard' + stamp + '@t.co', passwordHash: hash, authProvider: 'local',
    roles: ['reader'], primaryRole: 'reader', status: 'active', emailVerified: true,
    avatar: 'https://i.pravatar.cc/150?img=1', followersCount: 12400, postsCount: 0,
  });
  const featured = await User.create({
    id: 'u-shouted-' + stamp, fullName: 'Ada Writes', username: 'adawrites' + String(stamp).slice(-4),
    email: 'shout' + stamp + '@t.co', passwordHash: hash, authProvider: 'local',
    roles: ['writer'], primaryRole: 'writer', status: 'active', emailVerified: true,
    avatar: 'https://i.pravatar.cc/150?img=32', readsCount: 1280000, followersCount: 48200, booksCount: 3,
  });
  const reader = await User.create({
    id: 'u-tipper-' + stamp, fullName: 'Rae Read', username: 'raeread' + String(stamp).slice(-4),
    email: 'tipper' + stamp + '@t.co', passwordHash: hash, authProvider: 'local',
    roles: ['reader'], primaryRole: 'reader', status: 'active', emailVerified: true,
    avatar: 'https://i.pravatar.cc/150?img=47', coinBalance: 5000,
  });
  const readerToken = signAccess(reader);

  /* ── Seed one post of every type the page's tab strip offers ──────────
     DROBOARD_ALLOWED_TYPES = announcement, post, debate, shoutout,
     repost, forum-poll, ama  (+ the card also renders poll).
     Field shapes are copied from the card's own reads, not invented. */
  const COVER = 'https://i.postimg.cc/N9jY0w4m/5.jpg';
  const rows = [
    { type: 'announcement', title: 'Welcome to the official Droboard page', heading: 'Home base', text: 'New features and community debates.', image: COVER, pinned: true },
    { type: 'post', text: 'Betrayal stories are up 34% this week.', image: COVER },
    {
      type: 'debate', title: 'Debate of the Week', text: 'Fight me.',
      debateData: { motion: '"Writers should be allowed to tag spoilers."', prompt: 'Convince me.', forText: 'Tag it', againstText: 'Hide it', forV: 4120, agV: 2380 },
    },
    {
      type: 'shoutout', text: 'Massive congratulations to one of our most-read writers.',
      shoutout: { userId: featured.id, id: featured.id, name: featured.fullName, avatar: featured.avatar, handle: featured.username, tagline: 'Just crossed 1M reads', role: 'writer', stats: { reads: 1280000, followers: 48200, books: 3 } },
    },
    {
      type: 'repost', note: 'Droboard Picks: start here.',
      original: { name: featured.fullName, avatar: featured.avatar, time: '2d ago', text: 'Chapter 21 is live.', cover: COVER, title: 'Hollow Court' },
      storyRef: { id: 's1', cat: 'Elegy', title: 'The letter folded in his jacket pocket', cover: COVER, writer: featured.fullName },
    },
    {
      type: 'poll', text: 'Quick poll: what keeps you reading past midnight?',
      poll: { q: 'What keeps you reading past midnight?', opts: [{ t: 'A plot twist', v: 812 }, { t: 'A slow-burn romance', v: 540 }], total: 1352 },
    },
    {
      type: 'forum-poll', title: 'Forum poll: which board needs more writers?',
      poll: { q: 'Which board needs more writers?', opts: [{ t: 'Campus', v: 210 }, { t: 'Werewolf', v: 180 }], total: 390 },
    },
    {
      type: 'ama', title: 'Droboard Live: Ask the Team Anything', text: 'Friday 8pm WAT.',
      amaData: { isLive: true, viewers: 3200, title: 'Droboard Live: Ask the Team Anything', meta: 'Community features, moderation, and what is coming next' },
    },
  ];
  const created = [];
  for (const r of rows) {
    created.push(await Post.create(Object.assign({
      id: 'p-' + stamp + '-' + created.length, userId: official.id, authorId: official.id,
      type: r.type, title: r.title || '', text: r.text || '', status: 'published',
      likesCount: 100 + created.length, commentsCount: 10 + created.length,
      createdAt: new Date(Date.now() - created.length * 3600e3),
    }, r)));
  }
  await Post.updateMany({}, {}); // no-op; keeps the collection touched before reads

  /* ── 1. fetchPosts() — GET /api/droboard-page/posts?limit=50 ── */
  let r = await call('GET', '/api/droboard-page/posts?limit=50');
  check('GET /api/droboard-page/posts -> 200', r.status === 200, 'status=' + r.status);
  const d = r.json || {};
  // fetchPosts translates {items,total,page,limit} -> {posts,morePosts} at the boundary.
  check('answers the envelope root {items,total,page,limit} (no data wrapper)',
    Array.isArray(d.items) && typeof d.total === 'number' && d.page !== undefined && d.limit !== undefined,
    'keys=' + Object.keys(d).join(','));
  check('every seeded type is served',
    rows.every(x => d.items.some(p => p.type === x.type)),
    'missing=' + rows.filter(x => !d.items.some(p => p.type === x.type)).map(x => x.type).join(','));

  /* ── 2. the fields mapPost()/post-card.js actually read ── */
  const baseBad = d.items.filter(p => !p.id || !p.type || p.pinned === undefined
    || typeof p.likes !== 'number' || typeof p.comments !== 'number'
    || typeof p.liked !== 'boolean' || typeof p.saved !== 'boolean'
    || !p.name || !p.avatar || !p.time);
  check('every card has id/type/pinned/likes/comments/liked/saved/name/avatar/time',
    baseBad.length === 0, 'bad=' + baseBad.map(p => p.id || p.type).join(','));
  check('likes/comments are the numbers the card prints (not only *Count)',
    d.items.every(p => p.likes === p.likesCount && p.comments === p.commentsCount),
    d.items.slice(0, 2).map(p => `${p.type}:${p.likes}/${p.likesCount}`).join(' '));
  check('the author name is a profile-linkable handle (p.name -> profile.html?u=)',
    d.items.every(p => typeof p.name === 'string' && p.name.length > 0 && !/\s/.test(p.name)),
    'names=' + [...new Set(d.items.map(p => p.name))].join(','));

  const deb = d.items.find(p => p.type === 'debate');
  check('debate carries debateData{motion,forV,agV,userVote}',
    deb && deb.debateData && !!deb.debateData.motion && typeof deb.debateData.forV === 'number'
      && typeof deb.debateData.agV === 'number' && 'userVote' in deb.debateData,
    deb && JSON.stringify(deb.debateData));

  const pol = d.items.filter(p => p.poll && p.poll.opts && p.poll.opts.length);
  check('poll + forum-poll carry poll{q,opts[{t,v}],voted,total}',
    pol.length >= 2 && pol.every(p => !!p.poll.q && p.poll.opts.every(o => o.t !== undefined && typeof o.v === 'number')
      && 'voted' in p.poll && typeof p.poll.total === 'number'),
    pol.map(p => p.type + ':' + (p.poll.q || 'NO_Q')).join(','));

  const so = d.items.find(p => p.type === 'shoutout');
  // mapPost line 110 keys the whole shoutout branch (and writersFeatured at
  // line 804) off shoutout.id — without it the follow UI and stat line vanish.
  check('shoutout carries shoutout.id (drives follow UI + writersFeatured)',
    so && so.shoutout && !!so.shoutout.id, so && JSON.stringify(so.shoutout));
  check('shoutout carries name/avatar/tagline and a stats object',
    so && so.shoutout && !!so.shoutout.name && /^https?:/.test(so.shoutout.avatar || '')
      && !!so.shoutout.tagline && so.shoutout.stats && typeof so.shoutout.stats === 'object',
    so && JSON.stringify(so.shoutout.stats));

  const rep = d.items.find(p => p.type === 'repost');
  check('repost carries original{name,avatar,time,text,cover,title} for the quote card',
    rep && rep.original && rep.original.name && /^https?:/.test(rep.original.avatar)
      && rep.original.text && /^https?:/.test(rep.original.cover) && rep.original.title,
    rep && JSON.stringify(rep.original));
  // mapPost rewrites repost -> recommendation; that path reads storyRef.
  check('repost also carries storyRef{cat,title,cover,writer} (renders as a story pick)',
    rep && rep.storyRef && rep.storyRef.title && /^https?:/.test(rep.storyRef.cover) && rep.storyRef.writer,
    rep && JSON.stringify(rep.storyRef));

  const ama = d.items.find(p => p.type === 'ama');
  check('ama carries amaData{isLive,viewers,title,meta}',
    ama && ama.amaData && typeof ama.amaData.isLive === 'boolean' && typeof ama.amaData.viewers === 'number'
      && !!ama.amaData.title && !!ama.amaData.meta,
    ama && JSON.stringify(ama.amaData));

  const ann = d.items.find(p => p.type === 'announcement');
  check('announcement carries title/heading/image',
    ann && !!ann.title && !!ann.heading && /^https?:/.test(ann.image || ''),
    ann && JSON.stringify({ title: ann.title, heading: ann.heading, image: (ann.image || '').slice(0, 20) }));

  check('pinned post is served (the page pins the official announcement)',
    d.items.some(p => p.pinned === true));

  /* ── 3. fetchCollections() — GET /api/collections ──
     collections.service builds covers[] from the REAL books behind storyIds
     (covers = cards.slice(0,4).map(cover)), so the seed needs actual Book rows
     or the grid gets empty cover arrays. */
  const { Book } = require('../src/models/content.model');
  const bookIds = [];
  for (let i = 0; i < 3; i++) {
    const b = await Book.create({
      id: 'bk-' + stamp + '-' + i, title: 'Picked Story ' + (i + 1),
      authorId: featured.id, author: featured.fullName,
      cover: i === 0 ? COVER : 'https://i.postimg.cc/DJwFzKgd/4.jpg',
      status: 'published', visibility: 'public',
    });
    bookIds.push(String(b.id));
  }
  await Collection.create([{
    id: 'c-' + stamp, ownerId: official.id, title: "Editors' Picks 2026",
    sub: 'The best of the year.', cover: COVER, stories: bookIds, storiesCount: bookIds.length,
    privacy: 'public', followers: 44, createdAt: new Date(),
  }, {
    id: 'c2-' + stamp, ownerId: official.id, title: 'Debate-Worthy Endings',
    sub: '', cover: 'https://i.postimg.cc/DJwFzKgd/4.jpg', stories: bookIds.slice(0, 2), storiesCount: 2,
    privacy: 'public', followers: 12, createdAt: new Date(),
  }]);
  r = await call('GET', '/api/collections');
  check('GET /api/collections -> 200', r.status === 200, 'status=' + r.status);
  const cols = Array.isArray(r.json) ? r.json : (r.json && (r.json.items || r.json.data)) || [];
  check('collections answers a list the page can read (array or {items})',
    Array.isArray(cols) && cols.length >= 2, 'n=' + (cols && cols.length));
  const colBad = cols.filter(c => !c.id || !(c.name || c.title) || typeof c.count !== 'number' || !Array.isArray(c.covers));
  check('every collection has id/name/count/covers[] (the grid reads these)',
    colBad.length === 0, 'bad=' + JSON.stringify(colBad.map(c => c.id || c.name)));
  check('covers[] are real image URLs (no placeholder gaps)',
    cols.every(c => c.covers.length > 0 && c.covers.every(u => /^https?:\/\//.test(u))),
    JSON.stringify(cols.map(c => c.covers.length)));

  /* ── 4. handleTip() — POST /api/wallet/tip ──
     Coins live on the Wallet, not User.coinBalance, so fund the wallet or the
     tip honestly answers 402. */
  const { Wallet } = require('../src/models/money.model');
  await Wallet.create({ userId: String(reader.id), kind: 'reader', coinBalance: 5000, bonusCoins: 0, paidCoins: 5000 });
  r = await call('POST', '/api/wallet/tip', { authorId: featured.id, coins: 50 }, readerToken);
  check('POST /api/wallet/tip (reader) -> ok',
    r.status === 200 && r.json && (r.json.ok === true || r.json.balance !== undefined),
    'status=' + r.status + ' body=' + JSON.stringify(r.json).slice(0, 160));
  r = await call('POST', '/api/wallet/tip', { authorId: featured.id, coins: 50 });
  check('POST /api/wallet/tip without session -> 401', r.status === 401, 'status=' + r.status);

  /* ── 5. the writes the cards call ──
     onPollVote / onDebateVote / onSave in demo mutate the local object. The
     server already owns those counters (posts.routes vote + save toggles). */
  const pollId = d.items.find(p => p.type === 'poll').id;
  r = await call('POST', '/api/posts/' + pollId + '/poll/vote', { option: 0 }, readerToken);
  check('POST /api/posts/:id/poll/vote accepts a droboard poll',
    r.status === 200, 'status=' + r.status + ' body=' + JSON.stringify(r.json).slice(0, 140));
  const debateId = d.items.find(p => p.type === 'debate').id;
  r = await call('POST', '/api/posts/' + debateId + '/debate/vote', { side: 'for' }, readerToken);
  check('POST /api/posts/:id/debate/vote accepts a droboard debate',
    r.status === 200, 'status=' + r.status + ' body=' + JSON.stringify(r.json).slice(0, 140));
  r = await call('POST', '/api/posts/' + pollId + '/save', {}, readerToken);
  check('POST /api/posts/:id/save toggles save', r.status === 200, 'status=' + r.status);

  /* ── 6. composer + moderation writes (the page still uses localStorage) ──
     posts.routes POST accepts both composer payload dialects already, so this
     is a frontend wiring gap, not a missing endpoint. Recorded as an assertion
     so the go-live checklist cannot lose it. */
  r = await call('POST', '/api/posts', {
    type: 'debate', title: 'Debate of the Week',
    debateData: { motion: '"Revenge arcs beat reconciliation arcs."', forText: 'Revenge', againstText: 'Peace' },
  }, signAccess(official));
  check('POST /api/posts takes the droboard debate dialect (composer)',
    r.status === 200 || r.status === 201, 'status=' + r.status + ' body=' + JSON.stringify(r.json).slice(0, 140));
  const madeId = r.json && (r.json.id || (r.json.post && r.json.post.id));
  r = await call('PATCH', '/api/posts/' + madeId, { pinned: true }, signAccess(official));
  check('PATCH /api/posts/:id pins (the page pin action)', madeId && r.status === 200, 'status=' + r.status);

  r = await call('GET', '/api/droboard-page/posts?tab=all&page=2&limit=8');
  check('page=2 answers a second slice ("Load more" / morePosts)',
    r.status === 200 && Array.isArray(r.json.items), 'items=' + (r.json && r.json.items && r.json.items.length) + ' total=' + (r.json && r.json.total));
  console.log('\nNOTE  FE gap, not asserted here: droboard-page-service.js fetchPosts()'
    + ' live branch returns morePosts: [] always, so "Load more" stays dead even'
    + ' with USE_API flipped (page 2 is served and proven above).'
    + '\nNOTE  FE gap: createPost/pin/edit/delete + the managers list write to'
    + ' localStorage only; POST/PATCH /api/posts already accept the payloads.'
    + '\nNOTE  FE gap: mapPost() resolves shoutout name/avatar/stats through'
    + ' writerById(), which reads the demo DROBOARD_COMPOSER_USERS pool.');

  const passed = results.filter(x => x.pass).length;
  console.log('\n===== ' + passed + '/' + results.length + ' droboard-page assertions passed =====');
  const outPath = path.join(__dirname, 'smoke-droboard.results.txt');
  try { fs.writeFileSync(outPath, results.map(x => (x.pass ? 'PASS' : 'FAIL') + '  ' + x.name).join('\n') + '\n'); } catch (e) { /* reporting only */ }
  await mongod.stop();
  process.exit(passed === results.length ? 0 : 1);
}
main().catch(async (e) => {
  console.log('FATAL ' + (e && e.stack || e));
  process.exit(1);
});
