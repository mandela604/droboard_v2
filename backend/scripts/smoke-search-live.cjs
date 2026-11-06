'use strict';
// Live search-overlay contract. Boots the REAL Express app against in-memory
// MongoDB and asserts that GET /api/search/index returns every field the
// overlay component renders, for both views it paints:
//   default view (no query typed): trending / categories / featured /
//     writers / boards
//   results view (query typed):    poolStories / poolWriters / poolBoards /
//     poolDebates
// A section the API omits keeps its demo data on the page, so "live mode"
// silently half-painted before this test existed. Also drives the real
// frontend loader (services/search-service.js with USE_API flipped true)
// against the live server, and /api/search/trending, which the overlay
// fetches on its own.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4321';
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

// Every key the overlay reads off a card, and the keys it reads off the
// payload itself. public/component/search-overlay.js → DEFAULT_DATA.
const OVERLAY_SECTIONS = ['trending', 'categories', 'featured', 'writers', 'boards', 'debates',
  'poolStories', 'poolWriters', 'poolBoards', 'poolDebates'];
const CARD_FIELDS = {
  trending: ['q', 'meta', 'fire'],
  categories: ['label', 'count', 'bg'],
  featured: ['img', 'cat', 'title', 'author', 'av', 'views', 'badge'],
  writers: ['name', 'handle', 'genre', 'av', 'followers', 'verified', 'following'],
  boards: ['id', 'type', 'name', 'description', 'icon', 'keywords'],
  debates: ['id', 'type', 'name', 'avatar', 'time', 'question', 'motion', 'prompt',
    'forText', 'againstText', 'forV', 'agV', 'userVote', 'likes', 'comments', 'keywords'],
  poolStories: ['type', 'id', 'img', 'cat', 'title', 'author', 'av', 'views', 'likes', 'badge', 'hook', 'keywords'],
  poolWriters: ['type', 'name', 'handle', 'genre', 'av', 'followers', 'verified', 'following', 'keywords'],
  poolBoards: ['type', 'id', 'name', 'description', 'icon', 'keywords'],
  poolDebates: ['type', 'id', 'name', 'avatar', 'question', 'motion', 'forText', 'againstText',
    'forV', 'agV', 'likes', 'comments', 'keywords'],
};

// A field the backend forgot is undefined — never a rendered string. Numbers
// the overlay prints as text must already be compact. userVote is the one
// field where null is the real answer ("this reader has not voted yet").
const NULL_OK = { debates: ['userVote'], poolDebates: ['userVote'] };
function missingFields(card, keys, sec) {
  const okNull = NULL_OK[sec] || [];
  return keys.filter(k => card[k] === undefined || (card[k] === null && okNull.indexOf(k) === -1));
}

function shapeErrors(payload) {
  const errs = [];
  OVERLAY_SECTIONS.forEach(sec => {
    const list = payload[sec];
    if (!Array.isArray(list)) { errs.push(sec + ' is ' + typeof list + ', expected array'); return; }
    list.forEach((card, i) => {
      const miss = missingFields(card, CARD_FIELDS[sec], sec);
      if (miss.length) errs.push(sec + '[' + i + '] missing ' + miss.join(','));
      const views = card.views;
      if (views !== undefined && typeof views !== 'string') errs.push(sec + '[' + i + '].views is not text: ' + views);
      if (Array.isArray(card.keywords) && !card.keywords.length && sec.indexOf('pool') === 0) {
        errs.push(sec + '[' + i + '] has no keywords to match');
      }
    });
  });
  return errs;
}

async function startMongo() {
  // `instance.launchTimeout` is the option this build honours — `startupTimeout`
  // is read by nobody, so a cold mongod on a slow disk used to die at the
  // library's 10s default and the run looked broken before it began.
  return MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
}

async function main() {
  const mongod = await startMongo();
  process.env.MONGO_URI = mongod.getUri('droboard_search');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const origin = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(origin + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Book, Category, BookDailyStat } = require('../src/models/content.model');
  const { Post, Follow } = require('../src/models/social.model');
  const { SearchLog } = require('../src/models/platform.model');
  const jwt = require('jsonwebtoken');

  async function call(qs, token) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(origin + '/api/search/index' + qs, { headers });
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json: json && json.data !== undefined ? json.data : json };
  }

  const stamp = Date.now();
  const DAY = 86400000;
  const tok = (u, roles) => jwt.sign({ sub: u.id, roles: roles || ['reader'] }, process.env.JWT_ACCESS_SECRET);

  /* ═══ THE CATALOGUE THE OVERLAY BROWSES ═══ */
  const fantasy = await Category.create({
    id: 'cat-search-fantasy-' + stamp, name: 'Fantasy', slug: 'fantasy-' + stamp,
    icon: '🐺', bg: 'https://i.example.com/wolf3.jpg', color: '#8b5cf6',
    desc: 'Dragons, courts and bargains.', tagline: 'Where imagination becomes legend.',
    booksCount: 4000, membersCount: 320, status: 'active',
  });
  const romance = await Category.create({
    id: 'cat-search-romance-' + stamp, name: 'Romance', slug: 'romance-' + stamp,
    icon: 'fa-heart', bg: 'https://i.example.com/wife3.jpg',
    desc: 'Slow burn.', tagline: 'He was supposed to be the villain.',
    booksCount: 900, membersCount: 1200, status: 'active',
  });
  const draftOnly = await Category.create({
    id: 'cat-search-retired-' + stamp, name: 'Retired Shelf', slug: 'retired-' + stamp,
    icon: '🗄️', booksCount: 9999, membersCount: 9999, status: 'inactive',
  });

  const ada = await User.create({
    id: 'usr_sw_ada_' + stamp, username: 'ada_writes', fullName: 'Ada Writes',
    email: 'ada_' + stamp + '@t.co', passwordHash: 'x', roles: ['writer'], primaryRole: 'writer',
    status: 'active', avatar: 'https://i.example.com/ada.jpg', bio: 'Writes the moon ones.',
    followerCount: 12400,
  });
  const zara = await User.create({
    id: 'usr_sw_zara_' + stamp, username: 'zara_m', fullName: 'Zara M',
    email: 'zara_' + stamp + '@t.co', passwordHash: 'x', roles: ['writer'], primaryRole: 'writer',
    status: 'active', avatar: 'https://i.example.com/zara.jpg', bio: 'Revenge arcs, no victims.',
    followerCount: 24000,
  });
  const quiet = await User.create({
    id: 'usr_sw_quiet_' + stamp, username: 'quiet_writer', fullName: 'Quiet Writer',
    email: 'quiet_' + stamp + '@t.co', passwordHash: 'x', roles: ['writer'], primaryRole: 'writer',
    status: 'active', avatar: 'https://i.example.com/quiet.jpg', followerCount: 3,
  });
  const viewer = await User.create({
    id: 'usr_sv_' + stamp, username: 'search_viewer', fullName: 'Search Viewer',
    email: 'viewer_' + stamp + '@t.co', passwordHash: 'x', roles: ['reader'], primaryRole: 'reader',
    status: 'active', avatar: 'https://i.example.com/viewer.jpg', followerCount: 0,
  });
  const viewerToken = tok(viewer);

  const wolf = await Book.create({
    id: 'bk_wolf_' + stamp, title: 'WOLFSBANE', authorId: ada.id, genre: 'Werewolf',
    categoryId: fantasy.id, status: 'published', reads: 171000, likes: 24300, rating: 4.6,
    chapterCount: 32, cover: 'https://i.example.com/wolf.jpg', createdAt: new Date(Date.now() - 90 * DAY),
    synopsis: 'A mute luna hears her mate.', vipLocked: true, contractStatus: 'contracted',
  });
  const bride = await Book.create({
    id: 'bk_bride_' + stamp, title: 'The Runaway Bride', authorId: zara.id, genre: 'Romance',
    categoryId: romance.id, status: 'ongoing', reads: 312000, likes: 45000,
    chapterCount: 12, cover: 'https://i.example.com/bride.jpg', createdAt: new Date(Date.now() - 2 * DAY),
    synopsis: 'She left at the altar in her socked feet.',
  });
  await Book.create({
    id: 'bk_draft_' + stamp, title: 'WOLFSBANE DRAFT', authorId: ada.id, genre: 'Werewolf',
    categoryId: fantasy.id, status: 'draft', reads: 999999, chapterCount: 1,
    cover: 'https://i.example.com/draft.jpg', synopsis: 'Must never reach a search pool.',
  });
  // Last-7-day reads are what makes a shelf entry "hot". Only WOLFSBANE has
  // this week's traffic, so the fresh-but-quiet bride entry must read "new".
  await BookDailyStat.create({ bookId: wolf.id, day: new Date().toISOString().slice(0, 10), reads: 9000 });

  await Post.create({
    authorId: zara.id, type: 'debate', text: 'Should the runaway bride have gone back?',
    likesCount: 40, commentsCount: 12,
    debateData: { motion: 'Should the runaway bride have gone back?', prompt: 'Say it plainly.',
      forText: 'Yes, run', againstText: 'No, stay', forV: 61, agV: 39 },
  });
  await Follow.create({ followerId: viewer.id, followingId: ada.id });

  const logSearchRow = (q, n, ageDays) => {
    const docs = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.now() - (ageDays || 1) * DAY);
      docs.push(SearchLog.create({ userId: '', q, type: '', results: 1, createdAt: d }));
    }
    return Promise.all(docs);
  };
  await Promise.all([logSearchRow('betrayal stories', 5), logSearchRow('the runaway bride in her socked feet', 3),
    logSearchRow('old query', 9, 30)]);

  /* ═══ 1. DEFAULT VIEW — NO QUERY TYPED ═══ */
  const bare = await call('');
  check('GET /api/search/index with no query still returns the browse sections',
    bare.status === 200 && OVERLAY_SECTIONS.every(k => Array.isArray(bare.json[k])),
    JSON.stringify({ status: bare.status, keys: Object.keys(bare.json || {}) }));
  check('an empty query no longer paints an empty overlay',
    bare.json.trending.length > 0 && bare.json.categories.length > 0 &&
    bare.json.featured.length > 0 && bare.json.writers.length > 0,
    JSON.stringify({ t: bare.json.trending.length, c: bare.json.categories.length, f: bare.json.featured.length, w: bare.json.writers.length }));

  check('trending comes from 7d SearchLog, hottest first, top 3 fire',
    bare.json.trending[0] && bare.json.trending[0].q === 'betrayal stories' &&
    bare.json.trending[0].meta === '5 searches this week' && bare.json.trending[0].fire === true,
    JSON.stringify(bare.json.trending));
  check('a query last searched 30 days ago is not trending',
    !bare.json.trending.some(t => t.q === 'old query'), JSON.stringify(bare.json.trending.map(t => t.q)));

  check('categories are the active CE boards, busiest shelf first',
    bare.json.categories.length === 2 && bare.json.categories[0].label === '🐺 Fantasy' &&
    bare.json.categories[0].count === '4k stories' && bare.json.categories[0].bg === 'https://i.example.com/wolf3.jpg',
    JSON.stringify(bare.json.categories));
  check('an inactive category never reaches the tile grid',
    !bare.json.categories.some(c => String(c.label).includes('Retired')), JSON.stringify(bare.json.categories.map(c => c.label)));

  check('featured ranks published books by reads and keeps drafts out',
    bare.json.featured.map(f => f.title).join(',') === 'The Runaway Bride,WOLFSBANE',
    JSON.stringify(bare.json.featured.map(f => [f.title, f.views])));
  check('featured numbers arrive as display text, not raw counts',
    bare.json.featured.every(f => typeof f.views === 'string' && !/^\d{4,}$/.test(f.views)),
    JSON.stringify(bare.json.featured.map(f => f.views)));
  check('featured badge marks the 7-day leader hot and a 2-day-old entry new',
    bare.json.featured.some(f => f.title === 'WOLFSBANE' && f.badge === 'hot') &&
    bare.json.featured.some(f => f.title === 'The Runaway Bride' && f.badge === 'new'),
    JSON.stringify(bare.json.featured.map(f => [f.title, f.badge])));
  check('featured carries the real author handle and avatar',
    bare.json.featured.every(f => /^[a-z0-9_]+$/.test(f.author) && /^https/.test(f.av)),
    JSON.stringify(bare.json.featured.map(f => [f.author, f.av])));

  check('writers rank by followers, every card complete',
    bare.json.writers.map(w => w.handle).join(',') === '@zara_m,@ada_writes,@quiet_writer',
    JSON.stringify(bare.json.writers.map(w => [w.handle, w.followers])));
  check('a writer tile names the genre they actually publish in',
    bare.json.writers.filter(w => w.handle === '@ada_writes')[0].genre === 'Werewolf',
    JSON.stringify(bare.json.writers.map(w => [w.handle, w.genre])));
  check('followers arrive compacted the way the card prints them',
    bare.json.writers[0].followers === '24k', JSON.stringify(bare.json.writers.map(w => w.followers)));
  check('the verified badge follows signed work, not the writer role token',
    bare.json.writers.filter(w => w.handle === '@ada_writes')[0].verified === true &&
    bare.json.writers.filter(w => w.handle === '@zara_m')[0].verified === false,
    JSON.stringify(bare.json.writers.map(w => [w.handle, w.verified])));

  check('boards are the real CE categories, so discover.html?board=<id> opens one',
    bare.json.boards.length === 2 && bare.json.boards.every(b => b.type === 'board' && b.id && !/^top-/.test(b.id)),
    JSON.stringify(bare.json.boards.map(b => [b.id, b.name])));

  /* ═══ 2. RESULTS VIEW — QUERY TYPED ═══ */
  const hits = await call('?q=wolf');
  check('q matches published stories by title/genre/synopsis and excludes drafts',
    hits.json.poolStories.length === 1 && hits.json.poolStories[0].title === 'WOLFSBANE',
    JSON.stringify(hits.json.poolStories.map(s => s.title)));
  check('a story card carries the view/like counts the overlay prints',
    hits.json.poolStories[0].views === '171k' && hits.json.poolStories[0].likes === '24.3k',
    JSON.stringify([hits.json.poolStories[0].views, hits.json.poolStories[0].likes]));
  check('a story card names the author without inventing an @ (the card prefixes it)',
    hits.json.poolStories[0].author === 'ada_writes' && hits.json.poolStories[0].av === 'https://i.example.com/ada.jpg',
    JSON.stringify([hits.json.poolStories[0].author, hits.json.poolStories[0].av]));
  check('a story card carries the synopsis hook the flyer prefill prints',
    hits.json.poolStories[0].hook === 'A mute luna hears her mate.',
    JSON.stringify(hits.json.poolStories[0].hook));

  const byHandle = await call('?q=ada');
  check('q matches writers by handle',
    byHandle.json.poolWriters.some(w => w.handle === '@ada_writes'),
    JSON.stringify(byHandle.json.poolWriters.map(w => w.handle)));
  const byBio = await call('?q=revenge');
  check('q matches writers by bio',
    byBio.json.poolWriters.some(w => w.handle === '@zara_m'),
    JSON.stringify(byBio.json.poolWriters.map(w => [w.handle, w.genre])));

  const byBoard = await call('?q=fantasy');
  check('q matches boards by name and the card icon is a font-awesome class',
    byBoard.json.poolBoards.some(b => b.name === 'Fantasy') &&
    byBoard.json.poolBoards.every(b => /^fa-/.test(b.icon)),
    JSON.stringify(byBoard.json.poolBoards.map(b => [b.name, b.icon])));

  const byDebate = await call('?q=bride');
  check('q matches debate posts and the card gets the real poster',
    byDebate.json.poolDebates.length === 1 && byDebate.json.poolDebates[0].name === 'zara_m' &&
    /^https/.test(byDebate.json.poolDebates[0].avatar) &&
    byDebate.json.poolDebates[0].forV === 61 && byDebate.json.poolDebates[0].againstText === 'No, stay',
    JSON.stringify(byDebate.json.poolDebates.map(d => [d.name, d.forV, d.agV, d.againstText])));

  const runaway = await call('?q=runaway');
  check('a plain-word query still resolves through the regex guard',
    runaway.status === 200 && runaway.json.poolStories.some(s => s.title === 'The Runaway Bride'),
    JSON.stringify(runaway.json.poolStories.map(s => s.title)));
  const meta = await call('?q=wolf%2A%2B%5B');
  check('a metacharacter query returns zero hits instead of a 500',
    meta.status === 200 && meta.json.poolStories.length === 0, JSON.stringify({ s: meta.status, n: (meta.json.poolStories || []).length }));

  const storiesOnly = await call('?q=wolf&type=stories');
  check('type=stories narrows the pools without emptying the browse sections',
    storiesOnly.json.poolStories.length === 1 && storiesOnly.json.poolWriters.length === 0 &&
    storiesOnly.json.poolBoards.length === 0 && storiesOnly.json.poolDebates.length === 0 &&
    storiesOnly.json.featured.length > 0,
    JSON.stringify({ s: storiesOnly.json.poolStories.length, w: storiesOnly.json.poolWriters.length }));

  /* ═══ 3. VIEWER STATE ═══ */
  const mine = await call('?q=ada', viewerToken);
  check('following reflects the viewer\'s real Follow rows',
    mine.json.poolWriters.filter(w => w.handle === '@ada_writes')[0].following === true &&
    mine.json.poolWriters.filter(w => w.handle === '@quiet_writer').length === 0,
    JSON.stringify(mine.json.poolWriters.map(w => [w.handle, w.following])));
  const anon = await call('?q=ada');
  check('an anonymous caller gets following:false rather than a guess',
    anon.json.poolWriters.every(w => w.following === false), JSON.stringify(anon.json.poolWriters.map(w => w.following)));

  /* ═══ 4. WHOLE-PAYLOAD SHAPE vs THE COMPONENT ═══ */
  const full = await call('?q=a');
  const errs = shapeErrors(full.json);
  check('every card the overlay reads has every field it renders',
    errs.length === 0, errs.slice(0, 6).join(' | '));
  const bareErrs = shapeErrors(bare.json);
  check('the no-query payload is shape-complete too (the default view is live now)',
    bareErrs.length === 0, bareErrs.slice(0, 6).join(' | '));

  /* ═══ 5. THE REAL FRONTEND LOADER AGAINST THE LIVE SERVER ═══ */
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'services', 'search-service.js'), 'utf8');
  check('search-service.js exposes a live gate to flip', /const USE_API = (true|false);/.test(src));
  // The loader calls the global fetch, so the shim has to close over the real
  // one — reassigning global.fetch to a wrapper of itself recurses forever.
  const netFetch = fetch;
  const apiFetch = (u, o) => netFetch(origin + '/api' + String(u).replace(/^\/api/, ''), o);
  global.window = global;
  const loader = new Function('window', 'fetch', src.replace('const USE_API = false;', 'const USE_API = true;'));
  loader(global.window, apiFetch);
  const clientData = await window.SearchIndex.build();
  const clientErrs = shapeErrors(clientData);
  check('SearchIndex.build() in live mode returns the overlay\'s full payload',
    OVERLAY_SECTIONS.every(k => Array.isArray(clientData[k])) && clientErrs.length === 0,
    clientErrs.slice(0, 6).join(' | ') || JSON.stringify(Object.keys(clientData)));
  check('the live payload replaces every demo browse section with real rows',
    clientData.writers.length > 0 && clientData.categories.length > 0 &&
    clientData.featured.length > 0 && clientData.trending.length > 0 && clientData.boards.length > 0,
    JSON.stringify({ w: clientData.writers.length, c: clientData.categories.length, f: clientData.featured.length, t: clientData.trending.length, b: clientData.boards.length }));
  check('no demo writer survives in the live writers list',
    clientData.writers.map(w => w.handle).join(',') === '@zara_m,@ada_writes,@quiet_writer',
    JSON.stringify(clientData.writers.map(w => w.handle)));

  /* ═══ 6. THE OVERLAY\'S OWN TRENDING FETCH ═══ */
  const tr = await netFetch(origin + '/api/search/trending?limit=8').then(r => r.json());
  const trBody = tr && tr.data !== undefined ? tr.data : tr;
  check('GET /api/search/trending returns the {q,meta,fire} rows the overlay swaps in',
    Array.isArray(trBody.items) && trBody.items.length > 0 &&
    ['q', 'meta', 'fire'].every(k => trBody.items[0][k] !== undefined),
    JSON.stringify(trBody.items));

  /* ═══ 7. THE SECOND CONSUMER: flyer-preview search ═══ */
  // /api/search/index has two readers — the overlay and the author flyer
  // picker. Both must map the same poolStories/poolWriters rows (one card, one
  // mapper), and the picker must still paint its local demo pool when the API
  // is down. Loaded with a stub DOM; only the search path runs.
  const flyerSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'component', 'flyer-preview.js'), 'utf8');
  const stubEl = { style: {}, setAttribute() {}, appendChild() {}, remove() {}, click() {}, classList: { add() {}, remove() {} } };
  global.document = {
    getElementById: () => null, createElement: () => Object.assign({ textContent: '', innerHTML: '' }, stubEl),
    head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {},
    querySelectorAll: () => [], querySelector: () => null,
  };
  global.DROBOARD_API_BASE = origin + '/api';
  global.DemoData = {
    STORIES: [{ id: 'demo_flyer_1', title: 'WOLFSBANE (demo copy)', cover: 'https://demo.example.com/cover.jpg',
      genre: 'Werewolf', author: 'Ada Writes', authorAv: 'https://demo.example.com/ada.jpg', hook: 'Demo hook line.' }],
  };
  new Function('window', 'document', 'fetch', flyerSrc)(global.window, global.document, netFetch);
  check('flyer-preview.js loads with a backend and exposes its search API',
    !!global.FlyerPreview && typeof global.FlyerPreview.searchStories === 'function',
    JSON.stringify(Object.keys(global.FlyerPreview || {})));

  const flyerStories = await global.FlyerPreview.searchStories('wolf');
  const liveRow = flyerStories.filter(s => s.id === wolf.id)[0];
  check('the flyer picker reads the live poolStories rows, mapped to its own fields',
    !!liveRow && liveRow.cover === 'https://i.example.com/wolf.jpg' && liveRow.genre === 'Werewolf' &&
    liveRow.author === 'ada_writes' && liveRow.authorPhoto === 'https://i.example.com/ada.jpg' &&
    liveRow.hook === 'A mute luna hears her mate.',
    JSON.stringify(flyerStories.map(s => [s.id, s.title, s.cover, s.hook])));
  check('a live story hit carries a real id, so the flyer CTA links the actual reader',
    !!liveRow && String(liveRow.id).indexOf('bk_wolf_') === 0, JSON.stringify(liveRow && liveRow.id));
  check('the flyer picker keeps its demo pool alongside live hits',
    flyerStories.some(s => s.id === 'demo_flyer_1'),
    JSON.stringify(flyerStories.map(s => s.id)));

  const flyerAuthors = await global.FlyerPreview.searchAuthors('zara');
  const liveAuthor = flyerAuthors.filter(a => a.handle === '@zara_m')[0];
  check('the author picker reads the live poolWriters rows (name/handle/photo)',
    !!liveAuthor && liveAuthor.name === 'Zara M' && liveAuthor.photo === 'https://i.example.com/zara.jpg',
    JSON.stringify(flyerAuthors.map(a => [a.name, a.handle, a.photo])));
  const bothAda = await global.FlyerPreview.searchAuthors('ada');
  check('an author present in both pools is listed once, demo row first',
    bothAda.filter(a => a.name.toLowerCase() === 'ada writes').length === 1 &&
    bothAda[0].photo === 'https://demo.example.com/ada.jpg',
    JSON.stringify(bothAda.map(a => [a.name, a.photo])));

  // Offline: the page is a Netlify demo until the API answers, so nothing may
  // throw and the demo row must still paint.
  global.DROBOARD_API_BASE = origin + '-down';
  const offline = await global.FlyerPreview.searchStories('wolf');
  check('with no backend the story picker still paints the demo pool',
    offline.length === 1 && offline[0].id === 'demo_flyer_1' && offline[0].cover === 'https://demo.example.com/cover.jpg',
    JSON.stringify(offline.map(s => [s.id, s.title])));
  const offlineAuthors = await global.FlyerPreview.searchAuthors('ada');
  check('with no backend the author picker still paints the demo pool',
    offlineAuthors.some(a => a.name === 'Ada Writes'), JSON.stringify(offlineAuthors.map(a => a.name)));
  global.DROBOARD_API_BASE = origin + '/api';

  const passed = results.filter(r => r.pass).length;
  console.log(`\n${passed}/${results.length} search live assertions passed`);
  await mongod.stop();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { console.error('Fatal:', e && e.stack || e); process.exit(1); });
