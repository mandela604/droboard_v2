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

  // read-mode proof: flip rule at runtime, seed 15 chapters of progress, flip back
  const colsSvc = require('./src/services/collections.service');
  const { ReadingProgress } = require('./src/models/social.model');
  colsSvc.STORY_ACCESS_RULE.mode = 'read';
  r = await call('POST', '/api/collections', otoken, { name: 'Unread shelf', stories: [String(bookId)] });
  check('read-mode blocks unread 403', r.status === 403, 'got ' + r.status);
  const seedRows = [];
  for (let i = 1; i <= 15; i++) seedRows.push({ userId: String(other.id), storyId: String(bookId), chapterId: 'ch' + i, secondsSpent: 200, finished: i <= 14 });
  await ReadingProgress.insertMany(seedRows);
  r = await call('POST', '/api/collections', otoken, { name: 'Read shelf', stories: [String(bookId)] });
  check('read-mode passes after 15 chapters', r.status === 201 && r.json.count === 1, 'got ' + r.status);
  const readShelfId = r.json && r.json.id;
  r = await call('GET', '/api/collections/eligible-stories', otoken);
  check('eligible flags read book', r.status === 200 && r.json.rule.mode === 'read' && (r.json.items || []).some(s => String(s.id) === String(bookId) && s.eligible === true && s.chaptersRead >= 15), JSON.stringify(r.json).slice(0, 200));
  await ReadingProgress.deleteMany({ userId: String(other.id), storyId: String(bookId) });
  if (readShelfId) await call('DELETE', '/api/collections/' + String(readShelfId), otoken);
  colsSvc.STORY_ACCESS_RULE.mode = 'any';

  // eligible-stories picker source (any-mode: everything eligible)
  r = await call('GET', '/api/collections/eligible-stories', wtoken);
  check('eligible-stories rule+items', r.status === 200 && r.json.rule && r.json.rule.mode === 'any' && Array.isArray(r.json.items) && r.json.items.some(s => String(s.id) === String(bookId) && s.eligible === true && s.mine === true), JSON.stringify(r.json).slice(0, 200));

  // report filing (collection)
  r = await call('POST', '/api/reports', otoken, { target: 'collection', targetId: String(privId), reason: 'spam', details: 'smoke test' });
  check('report file 201', r.status === 201 && !!r.json.id, 'got ' + r.status);

  // super-admin collections moderation
  r = await call('GET', '/api/super-admin/collections?reported=1', atoken);
  check('admin collections reported filter', r.status === 200 && Array.isArray(r.json.items) && r.json.items.some(c => String(c.id) === String(privId) && c.reports && c.reports.total >= 1), JSON.stringify(r.json).slice(0, 200));
  r = await call('DELETE', '/api/super-admin/collections/' + String(privId), atoken);
  check('admin collection delete', r.status === 200, 'got ' + r.status);
  r = await call('GET', '/api/collections/' + String(privId), wtoken);
  check('deleted collection gone', r.status === 404, 'got ' + r.status);

  // reading pipeline: chapters + progress + finish + read-state
  const { Chapter } = require('./src/models/content.model');
  await Chapter.insertMany([
    { bookId: String(bookId), n: 1, title: 'Ch 1', content: '<p>one</p>', words: 100, status: 'published' },
    { bookId: String(bookId), n: 2, title: 'Ch 2', content: '<p>two</p>', words: 100, status: 'published' },
  ]);
  r = await call('POST', '/api/stories/' + String(bookId) + '/chapters/1/progress', otoken, { secondsSpent: 120, pct: 50 });
  check('progress heartbeat 200', r.status === 200, 'got ' + r.status);
  r = await call('POST', '/api/stories/' + String(bookId) + '/chapters/2/progress', otoken, { secondsSpent: 200, pct: 100, finished: true, wordsRead: 100 });
  check('progress finish last chapter 200', r.status === 200, 'got ' + r.status);
  const { LibraryItem } = require('./src/models/social.model');
  const fin = await LibraryItem.findOne({ userId: String(other.id), storyId: String(bookId), list: 'history' }).lean();
  check('book marked finished', !!fin && fin.status === 'finished', JSON.stringify(fin));
  r = await call('GET', '/api/stories/' + String(bookId) + '/read-state', otoken);
  check('read-state progress+continue', r.status === 200 && r.json.progress && r.json.progress['2'] && r.json.progress['2'].finished === true && r.json.lastChapterId === '2', JSON.stringify(r.json).slice(0, 200));

  // live search page contract
  r = await call('GET', '/api/search/index?q=Lib%20Book', null);
  check('search finds book with id', r.status === 200 && Array.isArray(r.json.books) && r.json.books.some(b => String(b.id) === String(bookId)), JSON.stringify(r.json).slice(0, 160));
  r = await call('GET', '/api/search/index?q=engwriter&type=users', null);
  check('search finds writer', r.status === 200 && Array.isArray(r.json.users) && r.json.users.some(u => u.username === 'engwriter'), JSON.stringify(r.json).slice(0, 160));
  r = await call('GET', '/api/search/index', null);
  check('search empty q shape', r.status === 200 && Array.isArray(r.json.books) && Array.isArray(r.json.collections), 'got ' + r.status);

  // event-backed segments: ad click + shares + catalog + estimate
  r = await call('POST', '/api/ads/track', otoken, { id: 'ad-smoke-1', event: 'click' });
  check('ad click tracked', r.status === 200, 'got ' + r.status);
  const { ShareEvent } = require('./src/models/social.model');
  await ShareEvent.insertMany([0, 1, 2].map(i => ({ userId: String(other.id), targetType: 'story', targetId: 'bk-seed-' + i, channel: 'copy' })));
  r = await call('GET', '/api/marketing/audience-catalog', atoken);
  const segs = (r.json && r.json.segments) || [];
  const reachOf = (id) => { const s = segs.find(x => x.id === id); return s ? s.reach : -1; };
  check('catalog live', r.status === 200 && segs.length === 17 && Array.isArray(r.json.genres), 'got ' + r.status);
  check('catalog ad-responders>=1', reachOf('ad-responders') >= 1, 'got ' + reachOf('ad-responders'));
  check('catalog sharers>=1', reachOf('sharers') >= 1, 'got ' + reachOf('sharers'));
  check('catalog finishers>=1', reachOf('finishers') >= 1, 'got ' + reachOf('finishers'));
  r = await call('POST', '/api/marketing/audience-estimate', atoken, { segments: ['sharers', 'ad-responders'] });
  check('estimate math', r.status === 200 && typeof r.json.reach === 'number' && r.json.sets === 2, JSON.stringify(r.json));

  // tropes catalog (CE taxonomy) + book tagging
  r = await call('POST', '/api/chief/tropes', atoken, { name: 'Enemies to Lovers', genre: 'Romance' });
  check('trope create 201', r.status === 201 && !!r.json.id, 'got ' + r.status);
  r = await call('GET', '/api/tropes?genre=Romance', null);
  check('tropes public list', r.status === 200 && Array.isArray(r.json.items) && r.json.items.some(t => t.name === 'Enemies to Lovers'), JSON.stringify(r.json).slice(0, 160));
  r = await call('PATCH', '/api/books/' + String(bookId), wtoken, { tropes: ['Enemies to Lovers'] });
  check('book tag tropes', r.status === 200, 'got ' + r.status);
  r = await call('PATCH', '/api/books/' + String(bookId), wtoken, { tropes: ['Nope Not Real'] });
  check('book bad trope 400', r.status === 400, 'got ' + r.status);

  // entitlements (no sub) + reading profile
  r = await call('GET', '/api/wallet/entitlements', otoken);
  check('entitlements none', r.status === 200 && r.json.plan === null && r.json.adsFree === false, JSON.stringify(r.json));
  r = await call('GET', '/api/users/me/reading-profile', otoken);
  check('reading profile', r.status === 200 && r.json.hours30d > 0 && r.json.streakDays >= 1 && r.json.finishes >= 1, JSON.stringify(r.json).slice(0, 200));

  // Merge Pass: everywhere-free except discover
  const { Subscription } = require('./src/models/money.model');
  await Subscription.create({ userId: String(other.id), planCode: 'sub-merge', status: 'active' });
  r = await call('GET', '/api/wallet/entitlements', otoken);
  check('merge entitlements', r.status === 200 && r.json.plan === 'sub-merge' && r.json.adsFree === true && r.json.adsFreeEverywhere === true, JSON.stringify(r.json));
  await Subscription.deleteMany({ userId: String(other.id) });

  // slot registry: kill comments page, pools go empty, re-enable
  r = await call('GET', '/api/ads/placements', null);
  check('placements map', r.status === 200 && r.json && typeof r.json === 'object', 'got ' + r.status);
  r = await call('PATCH', '/api/marketing/ads/placement', atoken, { page: 'comments', enabled: false, slots: { 'comments:every-nth': false } });
  check('placement toggle off', r.status === 200 && r.json.enabled === false && r.json.slots && r.json.slots['comments:every-nth'] === false, JSON.stringify(r.json));
  r = await call('GET', '/api/ads?placement=comments', null);
  check('disabled pools empty', r.status === 200 && r.json.pools && Object.values(r.json.pools).every(a => (a || []).length === 0), JSON.stringify(r.json).slice(0, 160));
  r = await call('PATCH', '/api/marketing/ads/placement', atoken, { page: 'comments', enabled: true });
  check('placement re-enable', r.status === 200 && r.json.enabled !== false, JSON.stringify(r.json));

  // slot programming: targeted, pinned, killed per slot
  const { AdInventory } = require('./src/models/platform.model');
  const adTop = await AdInventory.create({ format: 'banner', brand: 'TopOnly', title: 'Top Ad', slots: ['fullReader:top'], active: true });
  const adAny = await AdInventory.create({ format: 'banner', brand: 'Anywhere', title: 'Any Ad', active: true });
  r = await call('GET', '/api/ads?placement=fullReader&slot=fullReader:top', null);
  check('top slot gets targeted+open ads', r.status === 200 && (r.json.pools.banner || []).length === 2, JSON.stringify(r.json.pools && r.json.pools.banner));
  r = await call('GET', '/api/ads?placement=fullReader&slot=fullReader:per-300-words', null);
  check('inline slot skips top-only ad', r.status === 200 && (r.json.pools.banner || []).length === 1 && String(r.json.pools.banner[0].id) === String(adAny.id), JSON.stringify(r.json.pools && r.json.pools.banner));
  r = await call('PATCH', '/api/marketing/ads/placement', atoken, { page: 'fullReader', slots: { 'fullReader:per-300-words': false } });
  check('slot kill stored', r.status === 200, 'got ' + r.status);
  r = await call('GET', '/api/ads?placement=fullReader&slot=fullReader:per-300-words', null);
  check('killed slot pools empty', r.status === 200 && Object.values(r.json.pools || {}).every(a => (a || []).length === 0), 'got ' + r.status);
  r = await call('PATCH', '/api/marketing/ads/placement', atoken, { page: 'fullReader', slots: { 'fullReader:per-300-words': true, 'fullReader:top': { adIds: [String(adAny.id)] } } });
  check('slot pin stored', r.status === 200, 'got ' + r.status);
  r = await call('GET', '/api/ads?placement=fullReader&slot=fullReader:top', null);
  check('pinned ad serves first', r.status === 200 && String((r.json.pools.banner || [])[0].id) === String(adAny.id), JSON.stringify(r.json.pools && r.json.pools.banner));
  await AdInventory.deleteMany({ brand: { $in: ['TopOnly', 'Anywhere'] } });
  await call('PATCH', '/api/marketing/ads/placement', atoken, { page: 'fullReader', enabled: true, slots: { 'fullReader:per-300-words': true } });

  // bulk placements incl. words-per-slot (ad-manager console call)
  r = await call('PUT', '/api/marketing/ads/placements', atoken, { fullReader: { wordsPerSlot: 450, slots: { 'fullReader:bottom': false } }, feed: { interval: 5 } });
  check('bulk placements save', r.status === 200 && r.json.fullReader && r.json.fullReader.wordsPerSlot === 450, JSON.stringify(r.json).slice(0, 200));
  r = await call('GET', '/api/ads/placements', null);
  check('placements map has words+slots', r.status === 200 && r.json.fullReader && r.json.fullReader.wordsPerSlot === 450 && r.json.fullReader.slots && r.json.fullReader.slots['fullReader:bottom'] === false, JSON.stringify(r.json.fullReader));
  await call('PUT', '/api/marketing/ads/placements', atoken, { fullReader: { wordsPerSlot: 300, slots: { 'fullReader:bottom': true } } });

  // ad inventory CRUD (console persistence)
  r = await call('POST', '/api/marketing/ads', atoken, { format: 'banner', brand: 'SmokeCo', title: 'Smoke Ad', pages: ['feed'], slots: ['feed:in-feed'], active: true });
  check('ad create 201', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const smokeAdId = r.json && r.json.id;
  r = await call('GET', '/api/marketing/ads/inventory', atoken);
  check('inventory lists ad', r.status === 200 && r.json.pools && (r.json.pools.banner || []).some(a => String(a.id) === String(smokeAdId)), 'got ' + r.status);
  r = await call('GET', '/api/ads?placement=feed&slot=feed:in-feed', null);
  check('ad serves on its slot', r.status === 200 && (r.json.pools.banner || []).some(a => String(a.id) === String(smokeAdId)), 'got ' + r.status);
  r = await call('PUT', '/api/marketing/ads/' + String(smokeAdId), atoken, { active: false });
  check('ad toggle off', r.status === 200 && r.json.active === false, JSON.stringify(r.json));
  r = await call('GET', '/api/ads?placement=feed&slot=feed:in-feed', null);
  check('toggled-off ad stops serving', r.status === 200 && !(r.json.pools.banner || []).some(a => String(a.id) === String(smokeAdId)), 'got ' + r.status);
  r = await call('DELETE', '/api/marketing/ads/' + String(smokeAdId), atoken);
  check('ad delete', r.status === 200, 'got ' + r.status);

  // store settings admin (packs / rewards / bundles)
  r = await call('POST', '/api/finance/store/coin-packs', atoken, { code: 'pack-smoke', coins: 500, bonusPct: 5, basePriceNGN: 7000 });
  check('pack create 201', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const packId = r.json && r.json.id;
  r = await call('GET', '/api/finance/store/coin-packs', atoken);
  check('packs list', r.status === 200 && Array.isArray(r.json) && r.json.some(p => String(p.id) === String(packId)), 'got ' + r.status);
  r = await call('POST', '/api/finance/store/coin-packs', atoken, { id: String(packId), code: 'pack-smoke', coins: 600, basePriceNGN: 8000 });
  check('pack update', r.status === 200 && r.json.coins === 600, JSON.stringify(r.json));
  r = await call('POST', '/api/finance/store/ad-rewards', atoken, { code: 'rw-smoke', action: 'Smoke', type: 'share', coins: 5, cooldown: '1 hr' });
  check('reward create 201', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const rewardId = r.json && r.json.id;
  r = await call('POST', '/api/finance/store/bundles', atoken, { code: 'b-smoke', name: 'Smoke Bundle', coins: 100, basePriceNGN: 1000 });
  check('bundle create 201', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const bundleId = r.json && r.json.id;
  r = await call('POST', '/api/finance/store/coin-packs', atoken, { code: 'pack-smoke', coins: 1, basePriceNGN: 1 });
  check('pack dupe code 409', r.status === 409, 'got ' + r.status);
  r = await call('DELETE', '/api/finance/store/coin-packs/' + String(packId), atoken);
  check('pack delete', r.status === 200, 'got ' + r.status);
  r = await call('DELETE', '/api/finance/store/ad-rewards/' + String(rewardId), atoken);
  check('reward delete', r.status === 200, 'got ' + r.status);
  r = await call('DELETE', '/api/finance/store/bundles/' + String(bundleId), atoken);
  check('bundle delete', r.status === 200, 'got ' + r.status);

  const failed = results.filter(x => !x.pass);
  console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' passed ====');
  if (failed.length) console.log('FAILED: ' + failed.map(f => f.name).join(', '));
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('SMOKE FATAL', e); process.exit(2); });
