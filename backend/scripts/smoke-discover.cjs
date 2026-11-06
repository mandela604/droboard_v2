'use strict'
// Quick smoke test for discover page backend
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4199';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_discover');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  const results = [];
  function check(name, pass, detail) {
    results.push({ name, pass });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 200) : ''}`);
  }

  async function call(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method, headers };
    if (body !== undefined && method !== 'GET') init.body = JSON.stringify(body);
    const res = await fetch(base + path, init);
    let json = null; try { json = await res.json(); } catch (e) {}
    return { status: res.status, json };
  }

  // Test discover endpoint
  let r = await call('GET', '/api/feed/discover');
  check('GET /api/feed/discover -> 200', r.status === 200, `status=${r.status}`);
  check('discover has heroes array', !!r.json && Array.isArray(r.json.heroes), typeof r.json.heroes);
  check('discover has continueReading array', !!r.json && Array.isArray(r.json.continueReading), typeof r.json.continueReading);
  check('discover has editorsPicks array', !!r.json && Array.isArray(r.json.editorsPicks), typeof r.json.editorsPicks);
  check('discover has recommended array', !!r.json && Array.isArray(r.json.recommended), typeof r.json.recommended);
  check('discover has trending array', !!r.json && Array.isArray(r.json.trending), typeof r.json.trending);

  // ── CHIEF-SOURCING: hero carousel AND editor picks come from the Chief's
  //    FeaturedPlacement sections, never the SE EditorPick collection. ──
  const { Book } = require('../src/models/content.model');
  const { FeaturedPlacement, EditorPick } = require('../src/models/editorial.model');
  const { User } = require('../src/models/user.model');
  const author = { id: 'usr_chief_src', username: 'chiefsrc', email: 'chiefsrc@test.com', fullName: 'Chief Src', passwordHash: 'hash', avatar: 'https://example.com/av-chief.jpg' };
  await User.create(author);
  await Book.create([
    { id: 'bk_hero_1', title: 'HERO ONE', authorId: author.id, status: 'published', genre: 'Romance', cover: 'https://example.com/h1.jpg', synopsis: 'A mafia heir must choose between the family seat and the woman he wronged.' },
    { id: 'bk_hero_2', title: 'HERO TWO', authorId: author.id, status: 'published', genre: 'Werewolf', cover: 'https://example.com/h2.jpg', synopsis: 'The pack rejected her at sixteen. At twenty-six she returns as their ruler.' },
    { id: 'bk_pick_1', title: 'CHIEF PICK', authorId: author.id, status: 'published', genre: 'Drama', cover: 'https://example.com/p1.jpg', synopsis: 'Three sisters, one house, and the letter that divides them.' },
    { id: 'bk_decoy', title: 'SE DECOY PICK', authorId: author.id, status: 'published', genre: 'Mystery', cover: 'https://example.com/d.jpg', synopsis: 'A detective chases a killer who signs every scene with her own name.' },
  ]);
  const soon = new Date(Date.now() - 3600e3);
  await FeaturedPlacement.create([
    { bookId: 'bk_hero_1', sectionKey: 'hero-banner', order: 1, active: true, startAt: soon, endAt: null },
    { bookId: 'bk_hero_2', sectionKey: 'hero-banner', order: 2, active: true, startAt: soon, endAt: null },
    { bookId: 'bk_pick_1', sectionKey: 'editors-picks', order: 1, active: true, startAt: soon, endAt: null },
  ]);
  // A not-yet-started hero must be excluded by the window filter.
  await FeaturedPlacement.create({ bookId: 'bk_decoy', sectionKey: 'hero-banner', order: 0, active: true, startAt: new Date(Date.now() + 7 * 86400e3), endAt: null });
  // The SE nominates a pick; the Chief reader surface must ignore it.
  await EditorPick.create({ bookId: 'bk_decoy', category: 'mystery', active: true, pickedBy: author.id });

  r = await call('GET', '/api/feed/discover');
  const d = r.json || {};
  const heroTitles = (d.heroes || []).map(h => String(h.title).toUpperCase());
  const pickTitles = (d.editorsPicks || []).map(p => String(p.title).toUpperCase());
  check('heroes sourced from Chief hero-banner placements', heroTitles.includes('HERO ONE') && heroTitles.includes('HERO TWO'), JSON.stringify(heroTitles));
  check('future-dated hero excluded by startAt window', !heroTitles.includes('SE DECOY PICK'), JSON.stringify(heroTitles));
  check('editorsPicks sourced from Chief editors-picks section', pickTitles.includes('CHIEF PICK'), JSON.stringify(pickTitles));
  check('editorsPicks ignore the SE EditorPick collection', !pickTitles.includes('SE DECOY PICK'), JSON.stringify(pickTitles));

  // The onboarding taste endpoints are gone: the discover filter is a query
  // param and the only writer of User.genres is the profile row itself.
  const testUser = { id: 'usr_test_taste', username: 'tastetest', email: 'taste@test.com', fullName: 'Taste Test', passwordHash: 'hash' };
  await User.create(testUser);

  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ sub: testUser.id, roles: ['reader'] }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

  r = await call('GET', '/api/users/me/tastes', undefined, token);
  check('POST/GET /users/me/tastes onboarding surface removed -> 404', r.status === 404, `status=${r.status}`);
  r = await call('GET', '/api/feed/profile/tastes', null, token);
  check('GET /api/feed/profile/tastes removed -> 404', r.status === 404, `status=${r.status}`);

  // Profile genre row: vocabulary is the Chief's live catalogue, max 4 slots.
  const { Genre } = require('../src/models/content.model');
  await Genre.create([
    { name: 'Werewolf', slug: 'werewolf', categoryId: 'cat-smoke-1', status: 'active' },
    { name: 'Romance', slug: 'romance', categoryId: 'cat-smoke-1', status: 'active' },
    { name: 'Fantasy', slug: 'fantasy', categoryId: 'cat-smoke-1', status: 'active' },
    { name: 'Drama', slug: 'drama', categoryId: 'cat-smoke-1', status: 'active' },
    { name: 'Mafia', slug: 'mafia', categoryId: 'cat-smoke-1', status: 'active' },
    { name: 'Retired', slug: 'retired', categoryId: 'cat-smoke-1', status: 'inactive' },
  ]);
  r = await call('PATCH', '/api/users/me', { genres: ['Werewolf', 'Romance', 'Fantasy', 'Drama'] }, token);
  check('profile row accepts 4 CE genres', r.status === 200 && (r.json.genres || []).length === 4, `status=${r.status} genres=${JSON.stringify(r.json && r.json.genres)}`);
  r = await call('PATCH', '/api/users/me', { genres: ['Werewolf', 'Romance', 'Fantasy', 'Drama', 'Mafia'] }, token);
  check('a 5th genre is refused (max 4 slots)', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/users/me', { genres: ['Ghosts'] }, token);
  check('invented genre refused against CE catalogue', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/users/me', { genres: ['Retired'] }, token);
  check('archived CE genre refused', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/users/me', { genres: [] }, token);
  check('slots can be cleared entirely', r.status === 200 && (r.json.genres || []).length === 0, `status=${r.status}`);
  r = await call('PATCH', '/api/users/me', { genres: ['Werewolf', 'Romance'] }, token);

  /* ═══ 1. DISCOVER ADS — the pool the inline strip + spotlight read ═══ */
  const ads = require('../src/services/ads.service');
  const { LibraryItem, Collection } = require('../src/models/social.model');
  await ads.createAd({ format: 'book', title: 'DISCOVER BOOK AD', img: 'https://example.com/dbook.jpg', genre: 'Romance', pages: ['discover'], active: true });
  await ads.createAd({ format: 'platform', title: 'DISCOVER PLATFORM AD', img: 'https://example.com/dplat.jpg', pages: ['discover'], active: true });
  await ads.createAd({ format: 'spotlight', title: 'DISCOVER SPOTLIGHT', img: 'https://example.com/spot.jpg', pages: ['discover'], active: true });
  await ads.createAd({ format: 'book', title: 'LIBRARY ONLY AD', img: 'https://example.com/libonly.jpg', pages: ['library'], active: true });
  await ads.createAd({ format: 'book', title: 'PAUSED AD', img: 'https://example.com/paused.jpg', pages: ['discover'], active: false });

  r = await call('GET', '/api/feed/discover/ads');
  const adz = r.json || {};
  const bookAdTitles = (adz.bookAds || []).map(a => String(a.title));
  const platAdTitles = (adz.platformAds || []).map(a => String(a.title));
  check('GET /api/feed/discover/ads -> 200', r.status === 200, `status=${r.status}`);
  check('discover/ads returns {platformAds, bookAds} contract', Array.isArray(adz.platformAds) && Array.isArray(adz.bookAds), JSON.stringify(Object.keys(adz)));
  check('bookAds pool serves the discover creative with its fields', bookAdTitles.includes('DISCOVER BOOK AD') && (adz.bookAds || []).some(a => a.img === 'https://example.com/dbook.jpg'), JSON.stringify(bookAdTitles));
  check('platformAds pool serves the discover creative', platAdTitles.includes('DISCOVER PLATFORM AD'), JSON.stringify(platAdTitles));
  check('discover/ads excludes other-page creatives', !bookAdTitles.includes('LIBRARY ONLY AD'), JSON.stringify(bookAdTitles));
  check('discover/ads excludes inactive creatives', !bookAdTitles.includes('PAUSED AD'), JSON.stringify(bookAdTitles));

  // strip slot + spotlight slot (AdService.getAds path, used by the popup)
  r = await call('GET', '/api/ads?placement=discover&slot=discover:strip');
  check('GET /api/ads?slot=discover:strip -> pools', r.status === 200 && !!(r.json || {}).pools, `status=${r.status}`);
  check('strip slot receives discover book ad', !!((r.json || {}).pools || {}).book && (r.json.pools.book || []).some(a => a.title === 'DISCOVER BOOK AD'), JSON.stringify(Object.keys((r.json || {}).pools || {})));
  r = await call('GET', '/api/ads?placement=discover&slot=discover:spotlight');
  const spool = ((r.json || {}).pools || {}).spotlight || [];
  check('spotlight pool resolves for the popup', spool.some(a => a.title === 'DISCOVER SPOTLIGHT'), JSON.stringify(spool.map(a => a.title)));
  // page kill switch: marketing turning discover off must empty the pool
  await require('../src/models/platform.model').AdPlacement.create({ page: 'discover', enabled: false });
  r = await call('GET', '/api/feed/discover/ads');
  check('discover page kill switch empties ads', r.status === 200 && ((r.json || {}).bookAds || []).length === 0 && ((r.json || {}).platformAds || []).length === 0, JSON.stringify(r.json));
  await require('../src/models/platform.model').AdPlacement.updateOne({ page: 'discover' }, { $set: { enabled: true } });

  /* ═══ 2. MORE STORIES — paginated LIST (items + hasMore) ═══ */
  const pageBooks = [];
  for (let i = 1; i <= 6; i++) {
    pageBooks.push({ id: 'bk_pg_' + i, title: 'PAGE BOOK ' + i, authorId: author.id, status: 'published', genre: 'Drama', reads: i * 100, cover: 'https://example.com/pg' + i + '.jpg', synopsis: 'Synopsis ' + i });
  }
  await Book.create(pageBooks);
  const p1 = await call('GET', '/api/feed/discover/stories?page=1&limit=2');
  const p2 = await call('GET', '/api/feed/discover/stories?page=2&limit=2');
  const p1items = ((p1.json || {}).items || []);
  const p2items = ((p2.json || {}).items || []);
  const p1ids = p1items.map(x => String(x.id));
  const p2ids = p2items.map(x => String(x.id));
  check('GET /discover/stories -> 200', p1.status === 200, `status=${p1.status}`);
  check('stories returns {items, hasMore} list contract', Array.isArray(p1items) && typeof (p1.json || {}).hasMore === 'boolean', JSON.stringify(Object.keys(p1.json || {})));
  check('stories pagination honours limit', p1ids.length === 2 && p2ids.length === 2, `${p1ids.length}/${p2ids.length}`);
  check('stories pages are disjoint slices', p1ids.every(id => !p2ids.includes(id)), JSON.stringify([p1ids, p2ids]));
  check('story items carry list-card fields (title/author/img/preview/chapters)', p1items.every(x => x.title && x.author && x.img && typeof x.preview === 'string' && typeof x.chapters === 'number'), JSON.stringify(p1items[0] || {}));
  check('story cards resolve the real author handle, name and avatar', p1items.every(x => x.author === '@chiefsrc' && x.authorName === 'Chief Src' && x.authorAv === 'https://example.com/av-chief.jpg'), JSON.stringify(p1items.map(x => ({ a: x.author, n: x.authorName, av: x.authorAv }))[0]));
  check('hasMore true while rows remain', (p1.json || {}).hasMore === true, JSON.stringify((p1.json || {}).hasMore));

  // Walk every page: a reader scrolling must see each story exactly once.
  const walkIds = [];
  let wHasMore = true, wPage = 1;
  while (wHasMore && wPage <= 25) {
    const rw = await call('GET', `/api/feed/discover/stories?page=${wPage}&limit=3`);
    const jw = rw.json || {};
    (jw.items || []).forEach(x => walkIds.push(String(x.id)));
    wHasMore = !!jw.hasMore;
    wPage++;
  }
  const totalPub = await Book.countDocuments({ status: { $in: ['ongoing', 'completed', 'published'] } });
  check('pagination walk yields no duplicate stories', new Set(walkIds).size === walkIds.length, `${walkIds.length} rows / ${new Set(walkIds).size} unique`);
  check('pagination walk covers every published story', walkIds.length === totalPub, `walked=${walkIds.length} published=${totalPub}`);
  check('pagination walk terminates (hasMore goes false)', wHasMore === false, `pages=${wPage - 1}`);

  /* ═══ 3. RECOMMENDATION TUNING — the discover filter ranks; the profile row does not ═══ */
  const wolf = { id: 'usr_wolf', username: 'wolfreader', email: 'wolf@test.com', fullName: 'Wolf Reader', passwordHash: 'hash', genres: ['Werewolf'] };
  await User.create(wolf);
  const wolfToken = jwt.sign({ sub: wolf.id, roles: ['reader'] }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
  await Book.create([
    { id: 'bk_reco_wer', title: 'WOLFSBANE', authorId: author.id, status: 'published', genre: 'Werewolf', reads: 9000, rating: 4.5, cover: 'https://example.com/wer.jpg', synopsis: 'A luna born mute hears her mate\'s thoughts for the first time.' },
    { id: 'bk_reco_rom', title: 'CEO WEDDING', authorId: author.id, status: 'published', genre: 'Romance', reads: 9000, rating: 4.5, cover: 'https://example.com/rom.jpg', synopsis: 'She agreed to a contract marriage. He agreed to fall in love.' },
  ]);
  // same reader, no filter on the request: the public row must not tilt the row
  const plain = await call('GET', '/api/feed/discover');
  const gPlain = (((plain.json || {}).recommended) || []).map(x => String(x.title).toUpperCase());
  r = await call('GET', '/api/feed/discover', undefined, wolfToken);
  const nRec = (((r.json || {}).recommended) || []).map(x => String(x.title).toUpperCase());
  check('GET /discover with viewer -> 200', r.status === 200, `status=${r.status}`);
  check('profile genre row does NOT rank recommendations (logged-in order == guest order)', gPlain.includes('WOLFSBANE') && gPlain.includes('CEO WEDDING') && nRec.join('|') === gPlain.join('|'), JSON.stringify({ member: nRec, guest: gPlain }));
  // filter on the request boosts the matching genre
  r = await call('GET', '/api/feed/discover?taste=Werewolf', undefined, wolfToken);
  const recTitles = (((r.json || {}).recommended) || []).map(x => String(x.title).toUpperCase());
  const wi = recTitles.indexOf('WOLFSBANE'), ri = recTitles.indexOf('CEO WEDDING');
  check('taste filter ranks matching genre above non-matching at equal popularity', r.status === 200 && wi !== -1 && ri !== -1 && wi < ri, JSON.stringify(recTitles));
  // guests tune the same way — the pick lives in the request, not on an account
  r = await call('GET', '/api/feed/discover?taste=Werewolf');
  const gRec = (((r.json || {}).recommended) || []).map(x => String(x.title).toUpperCase());
  check('guest taste filter tunes recommendations too', gRec.indexOf('WOLFSBANE') < gRec.indexOf('CEO WEDDING') && gRec.indexOf('WOLFSBANE') !== -1, JSON.stringify(gRec));
  // retired/invented filter values score nothing rather than erroring
  r = await call('GET', '/api/feed/discover?taste=Retired,Ghosts');
  check('unknown taste values are ignored, not an error', r.status === 200 && !!((r.json || {}).recommended), `status=${r.status}`);

  // author familiarity: a reader picks up more books by authors they already read
  const authorB = { id: 'usr_aff_author', username: 'affauthor', email: 'affauthor@test.com', fullName: 'Affinity Author', passwordHash: 'hash', avatar: 'https://example.com/av-affinity.jpg' };
  await User.create(authorB);
  await Book.create([
    { id: 'bk_aff_1', title: 'AFFINITY BOOK ONE', authorId: authorB.id, status: 'published', genre: 'Drama', reads: 3000, rating: 4.0, cover: 'https://example.com/a1.jpg', synopsis: 'First read by this reader.' },
    { id: 'bk_aff_2', title: 'AFFINITY BOOK TWO', authorId: authorB.id, status: 'published', genre: 'Drama', reads: 3000, rating: 4.0, cover: 'https://example.com/a2.jpg', synopsis: 'Same author, unread.' },
    { id: 'bk_plain', title: 'PLAIN BOOK', authorId: author.id, status: 'published', genre: 'Drama', reads: 3000, rating: 4.0, cover: 'https://example.com/plain.jpg', synopsis: 'Different author, equal popularity.' },
  ]);
  const aff = { id: 'usr_aff', username: 'affreader', email: 'aff@test.com', fullName: 'Aff Reader', passwordHash: 'hash' };
  await User.create(aff);
  await LibraryItem.create({ userId: aff.id, storyId: 'bk_aff_1', list: 'library', status: 'unread' });
  const affToken = jwt.sign({ sub: aff.id, roles: ['reader'] }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
  r = await call('GET', '/api/feed/discover', undefined, affToken);
  const aRec = (((r.json || {}).recommended) || []).map(x => String(x.title).toUpperCase());
  const ai = aRec.indexOf('AFFINITY BOOK TWO'), pi = aRec.indexOf('PLAIN BOOK');
  check('author-familiarity weight ranks same-author books higher', ai !== -1 && pi !== -1 && ai < pi, JSON.stringify(aRec));

  /* ═══ 4. CONTINUE READING — seeded in-progress library row ═══ */
  await LibraryItem.create({ userId: wolf.id, storyId: 'bk_hero_1', list: 'continue', status: 'progress', currentChN: 7, pct: 40 });
  r = await call('GET', '/api/feed/discover', undefined, wolfToken);
  const cont = ((r.json || {}).continueReading) || [];
  const contRow = cont.find(c => String(c.id) === 'bk_hero_1') || {};
  check('continueReading returns the seeded in-progress book', cont.some(c => String(c.id) === 'bk_hero_1'), JSON.stringify(cont.map(c => c.id)));
  check('continueReading carries chapter label + percent', contRow.ch === 'Ch. 7' && contRow.pct === 40, JSON.stringify({ ch: contRow.ch, pct: contRow.pct }));
  r = await call('GET', '/api/feed/discover', undefined, token);
  check('continueReading is empty for a reader with no progress', (((r.json || {}).continueReading) || []).length === 0, JSON.stringify((r.json || {}).continueReading));

  /* ═══ 5. COLLECTIONS — the row the page loads from /api/collections ═══ */
  await Collection.create({ ownerId: author.id, title: 'Stories That Wrecked Me', privacy: 'public', stories: ['bk_hero_1', 'bk_hero_2'], storiesCount: 2, followers: 5 });
  r = await call('GET', '/api/collections?limit=12&sort=popular');
  const cols = r.json;
  check('GET /api/collections?sort=popular -> 200 array', r.status === 200 && Array.isArray(cols), `status=${r.status} type=${Object.prototype.toString.call(cols)}`);
  const coll = (Array.isArray(cols) ? cols : []).find(c => c.name === 'Stories That Wrecked Me') || {};
  check('collection row has name/count/covers for renderCollRow', coll.name === 'Stories That Wrecked Me' && coll.count === 2 && Array.isArray(coll.covers) && coll.covers.length === 2, JSON.stringify({ name: coll.name, count: coll.count, covers: coll.covers }));

  /* ═══ 6. RANKED ROWS — trending order, romance filter, complete + new ═══ */
  r = await call('GET', '/api/feed/discover');
  const dd = r.json || {};
  const readsSeq = (dd.trending || []).map(x => Number(x.reads) || 0);
  check('trending ordered by reads desc', readsSeq.length > 1 && readsSeq.every((v, i) => i === 0 || readsSeq[i - 1] >= v), JSON.stringify(readsSeq.slice(0, 6)));
  check('topRomance contains only romance', (dd.topRomance || []).length > 0 && (dd.topRomance || []).every(x => /romance/i.test(x.genre || '')), JSON.stringify((dd.topRomance || []).map(x => x.genre)));
  check('newReleases keep preview + chapter (no double-shape)', (dd.newReleases || []).length > 0 && (dd.newReleases || []).every(x => x.title && x.img && /^Ch\.\s\d+$/.test(String(x.chapter))), JSON.stringify((dd.newReleases || [])[0] || {}));
  check('recentlyUpdated keeps preview text (no double-shape)', (dd.recentlyUpdated || []).length > 0 && (dd.recentlyUpdated || []).every(x => typeof x.preview === 'string' && x.preview.length > 0), JSON.stringify((dd.recentlyUpdated || [])[0] || {}));
  await Book.create({ id: 'bk_done_1', title: 'A COMPLETED STORY', authorId: author.id, status: 'completed', genre: 'Drama', reads: 500, cover: 'https://example.com/done.jpg' });
  r = await call('GET', '/api/feed/discover');
  const comp = ((r.json || {}).complete) || [];
  check('complete row populated from completed books', comp.some(c => String(c.id) === 'bk_done_1'), JSON.stringify(comp.map(c => c.id)));

  /* ═══ 7. TOP WRITERS — total reads across live books, followers as tiebreaker ═══ */
  const { Status } = require('../src/models/social.model');
  await User.create([
    { id: 'usr_tw_a', username: 'twalpha', email: 'twalpha@test.com', fullName: 'Tw Alpha', passwordHash: 'hash', avatar: 'https://example.com/av-twalpha.jpg', followerCount: 5 },
    // more followers than gamma but the same live reads: must win the tiebreak.
    { id: 'usr_tw_b', username: 'twbeta', email: 'twbeta@test.com', fullName: 'Tw Beta', passwordHash: 'hash', avatar: 'https://example.com/av-twbeta.jpg', followerCount: 500 },
    { id: 'usr_tw_c', username: 'twgamma', email: 'twgamma@test.com', fullName: 'Tw Gamma', passwordHash: 'hash', avatar: 'https://example.com/av-twgamma.jpg', followerCount: 9 },
    // soft-deleted, huge reads — must never reach a reader surface
    { id: 'usr_tw_d', username: 'twdeleted', email: 'twdeleted@test.com', fullName: 'Tw Deleted', passwordHash: 'hash', avatar: 'https://example.com/av-twdeleted.jpg', followerCount: 9999, deletedAt: new Date() },
  ]);
  await Book.create([
    { id: 'bk_tw_a1', title: 'TW ALPHA ONE', authorId: 'usr_tw_a', status: 'published', genre: 'Drama', reads: 9000, cover: 'https://example.com/twa1.jpg' },
    { id: 'bk_tw_b1', title: 'TW BETA ONE', authorId: 'usr_tw_b', status: 'ongoing', genre: 'Drama', reads: 2000, cover: 'https://example.com/twb1.jpg' },
    { id: 'bk_tw_b2', title: 'TW BETA TWO', authorId: 'usr_tw_b', status: 'completed', genre: 'Drama', reads: 1000, cover: 'https://example.com/twb2.jpg' },
    // an unpublished draft with enormous reads must not count toward the rank
    { id: 'bk_tw_b3', title: 'TW BETA DRAFT', authorId: 'usr_tw_b', status: 'draft', genre: 'Drama', reads: 999999, cover: 'https://example.com/twb3.jpg' },
    { id: 'bk_tw_c1', title: 'TW GAMMA ONE', authorId: 'usr_tw_c', status: 'published', genre: 'Drama', reads: 3000, cover: 'https://example.com/twc1.jpg' },
    { id: 'bk_tw_d1', title: 'TW DELETED ONE', authorId: 'usr_tw_d', status: 'published', genre: 'Drama', reads: 500000, cover: 'https://example.com/twd1.jpg' },
  ]);

  r = await call('GET', '/api/feed/discover');
  const tw = ((r.json || {}).topWriters) || [];
  const twHandles = tw.map(w => String(w.handle));
  const pos = (h) => twHandles.indexOf(h);
  const readsSeq2 = tw.map(w => Number(w.reads) || 0);
  check('discover payload carries a topWriters row', Array.isArray((r.json || {}).topWriters) && tw.length > 0, JSON.stringify(twHandles));
  check('topWriters ordered by total reads desc', readsSeq2.every((v, i) => i === 0 || readsSeq2[i - 1] >= v), JSON.stringify(readsSeq2));
  check('topWriters rank sums every live book (beta 2000+1000=3000)', pos('twbeta') !== -1 && tw[pos('twbeta')].reads === 3000 && tw[pos('twbeta')].books === 2, JSON.stringify(tw[pos('twbeta')] || {}));
  check('draft books excluded from the writer rank', pos('twbeta') !== -1 && tw[pos('twbeta')].books === 2, JSON.stringify(tw[pos('twbeta')] || {}));
  check('equal reads break by followerCount (beta before gamma)', pos('twbeta') !== -1 && pos('twgamma') !== -1 && pos('twbeta') < pos('twgamma'), JSON.stringify([pos('twbeta'), pos('twgamma')]));
  check('a writer above the tiebreak still outranks on reads (alpha first of the three)', pos('twalpha') < pos('twbeta'), JSON.stringify([pos('twalpha'), pos('twbeta')]));
  check('soft-deleted writer never appears', !twHandles.includes('twdeleted'), JSON.stringify(twHandles));
  check('topWriters carry real id/handle/name/avatar (nothing fabricated)', tw.every(w => w.id && w.handle && w.name && /^https:\/\/example\.com\/av-/.test(String(w.avatar))), JSON.stringify(tw.slice(0, 3)));

  /* ── rings: /api/statuses/writers resolves the SAME handles from live Status docs ── */
  const live = new Date(Date.now() + 6 * 3600e3);
  const dead = new Date(Date.now() - 3600e3);
  await Status.create([
    { userId: 'usr_tw_a', bg: 'https://example.com/sa1.jpg', quote: 'Alpha slide one', caption: 'one', expiresAt: live },
    { userId: 'usr_tw_a', bg: 'https://example.com/sa2.jpg', quote: 'Alpha slide two', caption: 'two', expiresAt: live },
    // expired: the 24h story is gone, so it must not produce a ring
    { userId: 'usr_tw_a', bg: 'https://example.com/sa3.jpg', quote: 'ALPHA EXPIRED', caption: 'old', expiresAt: dead },
    { userId: 'usr_tw_c', bg: 'https://example.com/sc1.jpg', quote: 'Gamma slide one', caption: 'g', expiresAt: live },
  ]);
  r = await call('GET', '/api/statuses/writers?handles=@TwAlpha,twbeta,twgamma,ghostwriter');
  const wr = (r.json || []);
  const byHandle = {};
  (Array.isArray(wr) ? wr : []).forEach(w => { byHandle[String(w.handle)] = w; });
  check('GET /api/statuses/writers -> 200 array', r.status === 200 && Array.isArray(wr), `status=${r.status} type=${Object.prototype.toString.call(wr)}`);
  check('handles normalized (@ prefix + case) and every handle answered', ['twalpha', 'twbeta', 'twgamma', 'ghostwriter'].every(h => byHandle[h]), JSON.stringify(Object.keys(byHandle)));
  check('ring slides come from real unexpired Status docs only', (byHandle.twalpha || {}).statuses && byHandle.twalpha.statuses.length === 2 && byHandle.twalpha.statuses.every(s => s.bg && s.id), JSON.stringify((byHandle.twalpha || {}).statuses || []));
  check('expired story does not render a slide', !JSON.stringify((byHandle.twalpha || {}).statuses || []).includes('ALPHA EXPIRED'), JSON.stringify(((byHandle.twalpha || {}).statuses || []).map(s => s.quote)));
  check('a ranked writer with no live story gets an empty list (no ring)', (byHandle.twbeta || {}).statuses && byHandle.twbeta.statuses.length === 0, JSON.stringify(byHandle.twbeta || {}));
  check('an unknown handle gets an empty list rather than an invented status', (byHandle.ghostwriter || {}).statuses && byHandle.ghostwriter.statuses.length === 0, JSON.stringify(byHandle.ghostwriter || {}));
  check('slide shape matches the story viewer (bg/quote/caption/time/ts/likes/viewed)', (byHandle.twgamma || {}).statuses && byHandle.twgamma.statuses[0] && ['id', 'bg', 'quote', 'caption', 'time', 'ts', 'likes', 'viewed'].every(k => k in byHandle.twgamma.statuses[0]), JSON.stringify(((byHandle.twgamma || {}).statuses || [])[0] || {}));
  r = await call('GET', '/api/statuses/writers');
  check('no handles -> empty array, not an error', r.status === 200 && Array.isArray(r.json) && r.json.length === 0, `status=${r.status} body=${JSON.stringify(r.json)}`);

  console.log('\n========================================');
  const passed = results.filter(r => r.pass).length;
  console.log(`${passed}/${results.length} passed`);
  if (passed === results.length) {
    console.log('✅ Discover backend is ready');
  } else {
    console.log('❌ Some tests failed');
  }
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
