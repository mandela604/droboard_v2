'use strict';
/* Live in-memory Mongo test for the whole reader FEED page.
   Boots the real app, seeds production-shaped docs, then HTTP-asserts every
   surface feed.html/feed-service.js pulls at boot:
     GET  /api/feed/home               → statuses (ring row) + posts (cards)
     GET  /api/notifications/unread-count → { count }            (badge)
     GET  /api/ads?placement=feed      → { placement, pools }    (sponsored + promo)
     GET  /api/discussions/feed        → { items } flat hub cards (Trending in hubs)
   Shapes are checked against what the frontend renderers consume, not just
   200s: post cards need name/avatar/time/likes/comments + poll.voted /
   debateData.userVote for the viewer; hub cards need name/avatar/time/comments
   + _genreId/_genreName. */
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4210';
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
const STATUS_BG = 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=500&h=900&fit=crop';

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 90000 } });
  process.env.MONGO_URI = mongod.getUri('dro_feed_live');
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
  const { Book, Genre } = require('../src/models/content.model');
  const { Post, Discussion, Status, Notification, Follow } = require('../src/models/social.model');
  const { AdInventory } = require('../src/models/platform.model');

  // ── Seed: a signed-in reader (viewer) + two authors with real ids ──
  let r = await call('POST', '/api/auth/signup', { name: 'Reader One', username: 'readerone', email: 'ro@test.co', password: 'SecurePass123!' });
  check('Seed signup reader -> 2xx', r.status >= 200 && r.status < 300, `${r.status}`);
  r = await call('POST', '/api/auth/login', { emailOrUsername: 'readerone', password: 'SecurePass123!' });
  const viewer = r.json.user; const viewerToken = r.json.access;
  check('Seed login reader -> token', r.status === 200 && !!viewerToken, `${r.status}`);

  const author1 = await User.create({ name: 'Ada Writes', username: 'adawrites', email: 'ada@test.co', password: 'SecurePass123!', roles: ['writer'], avatar: AV1, fullName: 'Ada Writes' });
  const author2 = await User.create({ name: 'Mia Clark', username: 'miaclark', email: 'mia@test.co', password: 'SecurePass123!', roles: ['writer'], avatar: AV2, fullName: 'Mia Clark' });
  const A1 = String(author1.id), A2 = String(author2.id), V = String(viewer.id);

  // ── Genres (feedThreads joins names for the "· Genre" bit) ──
  // Seed with the REAL minted Genre.id, exactly as discussions.createThread
  // stores genreId (it resolves slug-or-id then persists g.id). The feedThreads
  // join is by Genre.id, so genreId must be that id, not the slug.
  const gFantasy = await Genre.create({ name: 'Fantasy', slug: 'fantasy', categoryId: 'cat_fantasy' });
  const gRomance = await Genre.create({ name: 'Romance', slug: 'romance', categoryId: 'cat_romance' });
  const GF = String(gFantasy.id), GR = String(gRomance.id);

  // ── A published book (home trending / chapter-drop ref) ──
  const book = await Book.create({ title: 'His Sweet Revenge', authorId: A1, status: 'published', synopsis: 'A tale of betrayal.', cover: COVER, reads: 4200, rating: 4.6, ratingCount: 30, genre: 'Romance', chapterCount: 21 });

  // ── Posts the reader feed renders as cards (each type exercised) ──
  await Post.create({ authorId: A1, type: 'post', text: 'Writing at 2am hits different.', image: STATUS_BG, likesCount: 612, commentsCount: 89, rank: '#1 This Week' });
  // Repost: the resharing card embeds the source post it quotes (gap B).
  await Post.create({
    authorId: A2, type: 'repost', note: 'Luna never disappoints.', likesCount: 98, commentsCount: 27,
    original: { name: 'Luna Grey', avatar: 'https://i.pravatar.cc/100?img=5', time: '2h ago', text: 'Chapter 21 is live.', cover: COVER, title: 'His Sweet Revenge' },
  });
  await Post.create({
    authorId: A1, type: 'poll', title: 'Team pick', likesCount: 44, commentsCount: 19,
    poll: { q: 'Team Alex or Team Jaxon?', opts: [{ t: 'Team Alex', v: 118 }, { t: 'Team Jaxon', v: 85 }], total: 203, votes: [{ user: V, opt: 0 }] },
  });
  await Post.create({
    authorId: A2, type: 'debate', likesCount: 30, commentsCount: 12,
    debateData: { motion: 'Should the ending have changed?', question: 'Should the ending have changed?', prompt: 'Argue it', forText: 'Yes', againstText: 'No', forV: 9, agV: 4, votes: [{ user: V, side: 'for' }] },
  });
  await Post.create({ authorId: A2, type: 'review', likesCount: 56, commentsCount: 14, storyRef: { id: book.id, title: book.title, cover: COVER, author: 'adawrites' }, score: 4, reviewText: 'Pacing dragged mid, chapter 18 redeemed it.' });
  await Post.create({ authorId: A1, type: 'chapter-drop', likesCount: 1240, commentsCount: 287, text: 'Chapter 5 just dropped.', chapterRef: { title: book.title, cover: COVER, ch: 'S2 · Chapter 5' } });
  // Remaining composer types — one seed each so "everything" is asserted live,
  // not just schema-supported. (recommendation's createPost reading-guard is
  // bypassed here because these are Post.create, matching the other seeds.)
  await Post.create({ authorId: A2, type: 'ama', likesCount: 842, commentsCount: 134, amaData: { isLive: true, viewers: 847, title: 'Ask Ada Anything', meta: 'Writing process · Season 3' } });
  await Post.create({ authorId: A1, type: 'quote', likesCount: 3200, commentsCount: 412, quote: '"She walked out like she had planned it for years."', caption: '— Chapter 3, Season 2' });
  await Post.create({ authorId: A2, type: 'recommendation', likesCount: 203, commentsCount: 38, note: 'Drop what you are doing and read this.', storyRef: { id: book.id, title: book.title, cover: COVER, writer: 'adawrites', cat: 'Elegy' } });
  await Post.create({ authorId: A1, type: 'shoutout', likesCount: 55, commentsCount: 8, shoutout: { userId: String(A2), id: String(A2), name: 'Ben Scribe', handle: '@benscribe', tagline: 'Slow-burn specialist', role: 'Writer', chaptersRead: 120, streak: 7 } });

  // ── A live status so the ring row has a real entry ──
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  await Status.create({ userId: A1, bg: STATUS_BG, quote: 'Chapter 21 is live tonight.', caption: 'His Sweet Revenge · New chapter', likes: 412, expiresAt: soon });

  // ── Discussion threads across BOTH genres (Trending in hubs source) ──
  await Discussion.create({ genreId: GF, authorId: A1, title: 'Best magic system?', body: 'Rank the ones you have read.', tag: 'discussion', likes: 300, commentsCount: 51, score: 90, hot: true, media: STATUS_BG });
  await Discussion.create({ genreId: GR, authorId: A2, title: 'Slow burn or fast burn?', body: 'Settle this.', tag: 'question', likes: 210, commentsCount: 40, score: 70, trope: 'Enemies to lovers', story: { id: book.id, title: book.title, writer: 'adawrites', cover: COVER, cat: 'Romance' } });
  await Discussion.create({ genreId: GR, authorId: A1, title: 'That chapter 18 twist', body: 'Did you see it coming?', tag: 'controversial', likes: 88, commentsCount: 9, score: 40, badge: 'Top', badgeClass: '', controversy: 86 });

  // ── An ad served to the feed page (sponsored slot + promo pool) ──
  await AdInventory.create({ format: 'native', brand: 'BookBub', heading: 'Read more', text: 'Sponsored in-feed', image: COVER, cta: 'Open', pages: ['feed'], active: true });
  await AdInventory.create({ format: 'promo', title: 'Winter Reads', image: COVER, cta: 'Browse', pages: ['feed'], active: true });

  // ── A notification so the badge has a real count ──
  await Notification.create({ recipientId: V, type: 'like', title: 'Ada liked your comment', unread: true });
  await Notification.create({ recipientId: V, type: 'follow', title: 'Mia started following you', unread: true });

  // ── Status roster (top strip) seeding ──
  // A reader who posts a status: belongs in the FEED row (scope=any), must be
  // absent from the HOMEPAGE row (scope=authors — writers only). Given the most
  // recent status so it would otherwise sit first in an unfiltered row.
  const reader2 = await User.create({ name: 'Sam Reads', username: 'samreader', email: 'sam@test.co', password: 'SecurePass123!', roles: ['reader'], fullName: 'Sam Reads', avatar: AV2 });
  const RD = String(reader2.id);
  // A2 posts early; 22 filler writers post in between; then RD posts last.
  await Status.create({ userId: A2, bg: STATUS_BG, quote: 'Writer on the move.', expiresAt: new Date(Date.now() + 2 * 3600 * 1000) });
  // The viewer follows A2 — follow-first must lift A2 to the front of the row
  // even though A2's status is older than every filler created after it.
  await Follow.create({ followerId: V, followingId: A2 });
  for (let i = 0; i < 22; i++) {
    const w = await User.create({ name: 'Filler ' + i, username: 'filler' + i, email: 'filler' + i + '@test.co', password: 'SecurePass123!', roles: ['writer'], fullName: 'Filler ' + i });
    await Status.create({ userId: String(w.id), bg: STATUS_BG, quote: 'Slide ' + i, expiresAt: new Date(Date.now() + (10 + i) * 60 * 1000) });
  }
  // RD gets the freshest status so it is guaranteed to sit in the capped row.
  await Status.create({ userId: RD, bg: STATUS_BG, quote: 'Reader pick.', expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
  // A1 also refreshes its status to the freshest, so it stays in the capped row
  // for the follow-first viewer assertion below.
  await Status.create({ userId: A1, bg: STATUS_BG, quote: 'Refreshed.', expiresAt: new Date(Date.now() + 40 * 60 * 1000) });

  // ══════════════════════════════════════════════════════════════
  // 1) /api/feed/home  — anonymous (shapes) and viewer (my-state flags)
  // ══════════════════════════════════════════════════════════════
  r = await call('GET', '/api/feed/home');
  const home = r.json || {};
  check('H1 GET /feed/home -> 200 with statuses[] + posts[]',
    r.status === 200 && Array.isArray(home.statuses) && Array.isArray(home.posts),
    `${r.status} statuses=${(home.statuses || []).length} posts=${(home.posts || []).length}`);
  check('H2 home carries trending/topRated/heroStories arrays',
    Array.isArray(home.trending) && Array.isArray(home.topRated) && Array.isArray(home.heroStories),
    `trending=${(home.trending || []).length}`);

  const st = (home.statuses || []).find(s => String(s.id) === A1);
  check('H3 status row has id/name/avatar/ring + statuses[] slides',
    !!st && typeof st.name === 'string' && !!st.avatar && /^ring-/.test(st.ring || '') && Array.isArray(st.statuses) && st.statuses.length >= 1,
    st ? `ring=${st.ring} slides=${st.statuses.length}` : 'no status row');
  const slide = st && st.statuses[0];
  check('H4 status slide carries bg/quote/caption/time',
    !!slide && !!slide.bg && typeof slide.quote === 'string' && typeof slide.caption === 'string' && typeof slide.time === 'string',
    slide ? JSON.stringify(Object.keys(slide)) : 'n/a');

  const pollPost = (home.posts || []).find(p => p.type === 'poll');
  const debatePost = (home.posts || []).find(p => p.type === 'debate');
  const reviewPost = (home.posts || []).find(p => p.type === 'review');
  const chapterPost = (home.posts || []).find(p => p.type === 'chapter-drop');
  check('H5 post card base fields present (name/avatar/time/likes/comments)',
    pollPost && typeof pollPost.name === 'string' && !!pollPost.avatar && typeof pollPost.time === 'string' && typeof pollPost.likes === 'number' && typeof pollPost.comments === 'number',
    pollPost ? `${pollPost.name}/${pollPost.time}` : 'no poll post');
  check('H6 all four feed types present (poll/debate/review/chapter-drop)',
    !!pollPost && !!debatePost && !!reviewPost && !!chapterPost,
    `poll=${!!pollPost} debate=${!!debatePost} review=${!!reviewPost} ch=${!!chapterPost}`);
  check('H7 poll post exposes q + opts[{t,v}] + voted(-1 anonymous)',
    pollPost && pollPost.poll && typeof pollPost.poll.q === 'string' && Array.isArray(pollPost.poll.opts) && pollPost.poll.opts[0].t !== undefined && pollPost.poll.voted === -1,
    pollPost ? `opts=${pollPost.poll.opts.length} voted=${pollPost.poll && pollPost.poll.voted}` : 'n/a');
  check('H8 debate post exposes motion/forText/againstText + forV/agV + userVote null (anon)',
    debatePost && debatePost.debateData && debatePost.debateData.motion && debatePost.debateData.forText === 'Yes' && debatePost.debateData.againstText === 'No' && debatePost.debateData.userVote === null,
    debatePost ? JSON.stringify({ m: debatePost.debateData.motion, ft: debatePost.debateData.forText, uv: debatePost.debateData.userVote }) : 'n/a');

  // viewer variant — my-state flags now populate thanks to optionalAuth
  r = await call('GET', '/api/feed/home', undefined, viewerToken);
  const vhome = r.json || {};
  const vPoll = (vhome.posts || []).find(p => p.type === 'poll');
  const vDebate = (vhome.posts || []).find(p => p.type === 'debate');
  check('H9 viewer poll.voted = chosen option index (my-state persists)',
    r.status === 200 && vPoll && vPoll.poll && vPoll.poll.voted === 0,
    vPoll ? `voted=${vPoll.poll && vPoll.poll.voted}` : 'n/a');
  check('H10 viewer debateData.userVote = "for" (my-state persists)',
    vDebate && vDebate.debateData && vDebate.debateData.userVote === 'for',
    vDebate ? `userVote=${vDebate.debateData && vDebate.debateData.userVote}` : 'n/a');
  check('H11 home.notifCount = unread rows for viewer',
    vhome.notifCount === 2, `notifCount=${vhome.notifCount}`);

  // ══════════════════════════════════════════════════════════════
  // 1b) POST /:id/save — the feed bookmark must survive a reload
  // ══════════════════════════════════════════════════════════════
  r = await call('POST', '/api/posts', { type: 'post', text: 'save me, reload me' }, viewerToken);
  const savePost = (r.json && (r.json.post || r.json)) || {};
  check('S1 POST /posts (reader owns a post) -> 2xx + id',
    r.status >= 200 && r.status < 300 && !!savePost.id, `${r.status} id=${savePost.id}`);

  r = await call('GET', '/api/feed/home', undefined, viewerToken);
  const beforeSave = (r.json.posts || []).find(p => String(p.id) === String(savePost.id)) || {};
  check('S2 post starts unsaved for the viewer', beforeSave.saved === false, `saved=${beforeSave.saved}`);

  r = await call('POST', `/api/posts/${encodeURIComponent(savePost.id)}/save`, {}, viewerToken);
  check('S3 POST /posts/:id/save -> {saved:true}',
    r.status === 200 && r.json && r.json.saved === true, `${r.status} ${JSON.stringify(r.json)}`);

  // Reload = the exact request the page makes on refresh.
  r = await call('GET', '/api/feed/home', undefined, viewerToken);
  const afterSave = (r.json.posts || []).find(p => String(p.id) === String(savePost.id)) || {};
  check('S4 SAVED STATE SURVIVES A RELOAD (feed card)', afterSave.saved === true, `saved=${afterSave.saved}`);

  r = await call('GET', '/api/posts/saved?limit=20', undefined, viewerToken);
  const savedIds = ((r.json && (r.json.items || r.json.posts || r.json)) || []).map(p => String(p.id));
  check('S5 GET /posts/saved lists the saved post', r.status === 200 && savedIds.includes(String(savePost.id)),
    `${r.status} ids=${savedIds.slice(0, 4).join(',')}`);

  r = await call('GET', '/api/feed/home');
  const anonSave = (r.json.posts || []).find(p => String(p.id) === String(savePost.id)) || {};
  check('S6 anonymous viewer sees the post unsaved', anonSave.saved === false, `saved=${anonSave.saved}`);

  r = await call('POST', `/api/posts/${encodeURIComponent(savePost.id)}/save`, {}, viewerToken);
  check('S7 second toggle -> {saved:false}', r.status === 200 && r.json && r.json.saved === false,
    `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/posts/saved?limit=20', undefined, viewerToken);
  const savedIds2 = ((r.json && (r.json.items || r.json.posts || r.json)) || []).map(p => String(p.id));
  check('S8 unsaved post drops out of the library', !savedIds2.includes(String(savePost.id)),
    `ids=${savedIds2.slice(0, 4).join(',')}`);

  r = await call('POST', `/api/posts/${encodeURIComponent(savePost.id)}/save`, {});
  check('S9 save without auth -> 401', r.status === 401, `${r.status}`);

  // ══════════════════════════════════════════════════════════════
  // 2) /api/notifications/unread-count  — badge (auth)
  // ══════════════════════════════════════════════════════════════
  r = await call('GET', '/api/notifications/unread-count', undefined, viewerToken);
  check('N1 GET /notifications/unread-count -> {count:2}',
    r.status === 200 && r.json && r.json.count === 2, `${r.status} ${JSON.stringify(r.json)}`);
  // Guests get zeros, not a 401 — the badge is rendered on every page.
  r = await call('GET', '/api/notifications/unread-count');
  check('N2 unread-count without auth -> {count:0} (guest badge, no 401)',
    r.status === 200 && r.json && r.json.count === 0, `${r.status} ${JSON.stringify(r.json)}`);

  // ══════════════════════════════════════════════════════════════
  // 3) /api/ads?placement=feed  — sponsored + promo pools
  // ══════════════════════════════════════════════════════════════
  r = await call('GET', '/api/ads?placement=feed');
  const ads = r.json || {};
  check('AD1 GET /ads?placement=feed -> {placement, pools}',
    r.status === 200 && ads.pools && typeof ads.pools === 'object',
    `${r.status} ${JSON.stringify(Object.keys(ads))}`);
  const native = (ads.pools.native || []);
  check('AD2 feed native pool includes our ad with creative fields',
    native.some(a => a.brand === 'BookBub' && a.heading && a.image),
    `native=${native.length}`);
  check('AD3 feed promo pool present (slider)',
    Array.isArray(ads.pools.promo) && ads.pools.promo.length >= 1,
    `promo=${(ads.pools.promo || []).length}`);

  // ══════════════════════════════════════════════════════════════
  // 4) /api/discussions/feed  — the cross-genre "Trending in hubs" row
  // ══════════════════════════════════════════════════════════════
  r = await call('GET', '/api/discussions/feed?limit=12');
  const df = r.json || {};
  check('D1 GET /discussions/feed -> 200 {items[]}',
    r.status === 200 && Array.isArray(df.items),
    `${r.status} items=${(df.items || []).length}`);
  const top = (df.items || [])[0];
  check('D2 hub card flat shape + REAL author resolved (not the "User" placeholder)',
    !!top && typeof top.name === 'string' && top.name !== 'User' && /^https?:\/\//.test(top.avatar || '') && typeof top.time === 'string' && typeof top.comments === 'number' && typeof top.likes === 'number' && top.author === undefined,
    top ? JSON.stringify({ name: top.name, avatar: (top.avatar || '').slice(0, 30), comments: top.comments }) : 'no items');
  check('D3 hub card carries _genreId + _genreName resolved',
    !!top && typeof top._genreId === 'string' && typeof top._genreName === 'string' && ['Fantasy', 'Romance'].includes(top._genreName),
    top ? `${top._genreId}/${top._genreName}` : 'n/a');
  check('D4 hub card matches the demo row: title/body + Title-case tag + tagClass, and NO media/trope/story',
    !!top && typeof top.title === 'string' && typeof top.body === 'string'
      && /^[A-Z]/.test(top.tag || '') && typeof top.tagClass === 'string' && top.tagClass === top.tag.toLowerCase()
      && !('media' in top) && !('trope' in top) && !('story' in top),
    top ? JSON.stringify({ tag: top.tag, tagClass: top.tagClass, hasMedia: 'media' in top, hasStory: 'story' in top }) : 'n/a');
  check('D5 comments maps commentsCount (thread count, not 0 for seeded 51/40/9)',
    (df.items || []).every(x => typeof x.comments === 'number') && (df.items || []).some(x => x.comments === 51),
    `counts=${(df.items || []).map(x => x.comments).join(',')}`);
  check('D6 hot-first ordering (score/likes) puts the hot Fantasy thread first',
    !!top && top.title === 'Best magic system?' && top.hot === true,
    top ? `${top.title} hot=${top.hot}` : 'n/a');
  check('D7 cross-genre: both Fantasy and Romance threads returned',
    new Set((df.items || []).map(x => x._genreName)).size === 2,
    `genres=${[...new Set((df.items || []).map(x => x._genreName))].join(',')}`);
  check('D8 story/media stripped from the row even though the romance thread stores a story',
    (df.items || []).every(x => !('story' in x) && !('media' in x)),
    'keys=' + JSON.stringify(Object.keys((df.items || [])[1] || {})));
  // Gap C: badge + controversy now have real Discussion columns and survive the
  // write -> read -> card round-trip (feed card shows the Top pill + flag).
  const flagged = (df.items || []).find(x => x.title === 'That chapter 18 twist');
  check('D9 hub card carries badge/badgeClass/controversy from the stored columns',
    !!flagged && flagged.badge === 'Top' && typeof flagged.controversy === 'number' && flagged.controversy === 86,
    flagged ? JSON.stringify({ badge: flagged.badge, controversy: flagged.controversy }) : 'no flagged thread');

  // Gap A + B: rank pill and repost original embed now round-trip through the
  // post card (posts.service.toCard spreads the doc, so the columns surface).
  const rankPost = ((home.posts) || []).find(p => p.type === 'post' && p.rank);
  check('H12 post card exposes rank (the "#1 This Week" pill)',
    !!rankPost && rankPost.rank === '#1 This Week',
    rankPost ? `rank=${rankPost.rank}` : 'no ranked post');
  const repost = ((home.posts) || []).find(p => p.type === 'repost');
  check('H13 repost card exposes original {name,avatar,time,text,cover,title}',
    !!repost && !!repost.original && repost.original.name === 'Luna Grey'
      && /^https?:\/\//.test(repost.original.avatar || '') && typeof repost.original.time === 'string' && !!repost.original.title,
    repost && repost.original ? JSON.stringify({ name: repost.original.name, title: repost.original.title, time: repost.original.time }) : 'no repost');
  // Remaining composer types surfaced through posts.service.toCard (spreads the
  // doc), so each field the card reads is proven to survive the live round-trip.
  const ama = (home.posts || []).find(p => p.type === 'ama');
  check('H14 ama card exposes amaData {isLive,viewers,title,meta}',
    !!ama && !!ama.amaData && ama.amaData.isLive === true && typeof ama.amaData.viewers === 'number' && !!ama.amaData.title,
    ama && ama.amaData ? JSON.stringify(ama.amaData) : 'no ama post');
  const quote = (home.posts || []).find(p => p.type === 'quote');
  check('H15 quote card exposes quote + caption',
    !!quote && typeof quote.quote === 'string' && quote.quote.length > 0 && typeof quote.caption === 'string' && quote.caption.length > 0,
    quote ? JSON.stringify({ quote: quote.quote.slice(0, 18), caption: quote.caption.slice(0, 18) }) : 'no quote post');
  const rec = (home.posts || []).find(p => p.type === 'recommendation');
  check('H16 recommendation card exposes note + storyRef (writer preserved)',
    !!rec && typeof rec.note === 'string' && rec.note.length > 0 && !!rec.storyRef && !!rec.storyRef.title && !!rec.storyRef.cover,
    rec && rec.storyRef ? JSON.stringify({ note: (rec.note || '').slice(0, 16), title: rec.storyRef.title, writer: rec.storyRef.writer }) : 'no recommendation post');
  const shout = (home.posts || []).find(p => p.type === 'shoutout');
  check('H17 shoutout card exposes shoutout {name,handle,tagline,role}',
    !!shout && !!shout.shoutout && shout.shoutout.name === 'Ben Scribe' && !!shout.shoutout.handle && !!shout.shoutout.tagline,
    shout && shout.shoutout ? JSON.stringify({ name: shout.shoutout.name, handle: shout.shoutout.handle, tagline: shout.shoutout.tagline }) : 'no shoutout post');

  // ══════════════════════════════════════════════════════════════
  // 5) Status roster — feed.html (scope=any) vs index.html (scope=authors)
  //    Feed = writers AND readers, capped at 20.
  //    Homepage = writers only, capped at 20 (a reader's status must not leak).
  //    Follow-first: a viewer who follows an author sees that author at the
  //    very top even when their status is older than every other row.
  // ══════════════════════════════════════════════════════════════
  // 24 live-status authors (A1, A2, RD, 22 fillers) seeded above.
  check('RS1 feed row (scope=any) caps at 20 authors',
    Array.isArray(home.statuses) && home.statuses.length === 20,
    `got=${(home.statuses || []).length}`);
  // RD posted the freshest reader status: must appear in feed, must NOT in authors.
  const rdInFeed = (home.statuses || []).some(s => String(s.id) === RD);
  check('RS2 feed row includes a reader-author (writers AND readers eligible)',
    rdInFeed, `RD=${rdInFeed}`);
  r = await call('GET', '/api/feed/home?scope=authors');
  const authors = r.json || {};
  const rdInAuthors = (authors.statuses || []).some(s => String(s.id) === RD);
  check('RS3 homepage row (scope=authors) caps at 20', Array.isArray(authors.statuses) && authors.statuses.length === 20,
    `got=${(authors.statuses || []).length}`);
  check('RS4 homepage row excludes the reader author', r.status === 200 && !rdInAuthors,
    `RD leaked=${rdInAuthors}`);
  // Every homepage row entry is a writer (A1/A2/filler), never samreader.
  const allHandlesAreWriters = (authors.statuses || []).every(s => s.name !== 'samreader');
  check('RS5 homepage row all writers (handle=adawrites/miaclark/fillerN only)', allHandlesAreWriters,
    (authors.statuses || []).map(s => s.name).slice(0, 5).join(','));
  // A2 (followed by the viewer) is seeded with an OLD status but the 22
  // fillers + RD post more recent. Follow-first must still lift A2 to top.
  check('RS6 viewer row puts followed author at position 0 (follow beats recency)',
    Array.isArray(vhome.statuses) && String((vhome.statuses[0] || {}).id) === A2,
    vhome.statuses ? `first=${(vhome.statuses[0] || {}).id} (want ${A2})` : 'no row');

  const failed = out.filter(x => !x.pass);
  console.log('\n' + (out.length - failed.length) + '/' + out.length + ' feed-page assertions passed');
  failed.forEach(f => console.log('  - ' + f.name));
  await mongod.stop();
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error('HARNESS ERROR', (e && e.stack) || e); process.exit(2); });
