'use strict';
/* DISCUSSION PAGE — live contract.
   Boots the REAL Express app against in-memory MongoDB and asserts, over HTTP,
   that the discussion endpoints return EXACTLY the fields discussion-service.js
   paints on the OP card and the board list — the literal property names it
   reads (name / avatar / time / comments / tag / tagClass / badge / badgeClass /
   hot / controversy / media / story / pinned / liked), not what the service
   finds convenient to expose.

   Also covers the four routes no other suite touched: PATCH /:id, DELETE /:id,
   the ?sort= and ?tag= list filters and pagination, plus the comments half of
   the page (scope='discussion' write -> commentsCount -> card). */
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4217';
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
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 200) : ''}`);
}

const keysOf = (o) => Object.keys(o || {}).sort().join(',');
// The OP header + pills + media + book-rec block, field for field.
const OP_FIELDS = ['id', 'title', 'body', 'name', 'avatar', 'handle', 'time', 'comments',
  'likes', 'liked', 'tag', 'tagClass', 'hot', 'controversy', 'badge', 'badgeClass',
  'media', 'story', 'pinned'];

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000, startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('droboard_discussion');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const origin = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(origin + '/health'); if (p.ok) break; } catch (e) { /* booting */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Category, Genre, CategoryMembership } = require('../src/models/content.model');
  const { Discussion, Comment } = require('../src/models/social.model');
  const jwt = require('jsonwebtoken');
  const svc = require('../src/services/discussions.service');

  async function call(method, urlPath, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(origin + urlPath, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  const stamp = Date.now();
  const HOUR = 3600000;
  const tok = (u, roles) => jwt.sign({ sub: u.id, roles: roles || ['reader'] }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
  const mk = (n, roles, extra) => User.create(Object.assign({
    id: 'usr_' + n + '_' + stamp, username: 'dsc_' + n, fullName: n.replace(/_/g, ' '),
    email: 'dsc_' + n + stamp + '@t.co', passwordHash: 'x', roles: [roles], primaryRole: roles,
    status: 'active', avatar: 'https://i.pravatar.cc/150?img=32',
  }, extra || {}));

  /* The board is the CE Category; a thread hangs under one child Genre. */
  const board = await Category.create({
    id: 'cat-dsc-' + stamp, name: 'Dark Romance', slug: 'dark-romance',
    desc: 'Morally grey leads.', status: 'active', booksCount: 0, membersCount: 0,
  });
  const genre = await Genre.create({
    id: 'gen-dsc-' + stamp, name: 'Dark Romance', slug: 'dark-romance-genre',
    categoryId: board.id, desc: 'High stakes.', status: 'active', booksCount: 0,
  });
  const otherGenre = await Genre.create({
    id: 'gen-other-' + stamp, name: 'Gothic', slug: 'gothic',
    categoryId: board.id, desc: 'Crumbling houses.', status: 'active', booksCount: 0,
  });

  const op = await mk('op_writer', 'writer', { emailVerified: true });
  const member = await mk('member_reader', 'reader');
  const stranger = await mk('stranger_reader', 'reader');
  const admin = await mk('chief_admin', 'admin');
  const opTok = tok(op, ['writer']), memberTok = tok(member), strangerTok = tok(stranger), adminTok = tok(admin, ['admin']);
  await CategoryMembership.create({ userId: String(member.id), categoryId: board.id });
  await CategoryMembership.create({ userId: String(op.id), categoryId: board.id });

  const COVER = 'https://i.postimg.cc/N9jY0w4m/5.jpg';
  const MEDIA = 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg';
  const mkThread = (o) => Discussion.create(Object.assign({
    genreId: genre.id, authorId: op.id, title: 'Untitled', body: 'Body text.',
    tag: 'discussion', likes: 0, likedBy: [], commentsCount: 0,
  }, o));

  /* Four threads that between them exercise every field the page paints, plus
     deliberately different createdAt so the sort assertions mean something. */
  const rules = await mkThread({
    id: 'th-rules-' + stamp, title: 'Board house rules', body: 'No spoilers, be kind.',
    pinned: true, score: 5, createdAt: new Date(Date.now() - 1 * HOUR),
  });
  const rich = await mkThread({
    id: 'th-rich-' + stamp, title: 'Best bakery rivals trope?',
    body: 'Rank the slow-burn ones.', tag: 'controversial', media: MEDIA,
    trope: 'Enemies to Lovers', story: { id: 'bk-x', title: 'Twelve Nights of Ash', writer: 'Ada Writer', cover: COVER, cat: 'Dark Romance' },
    likes: 300, likedBy: [String(member.id)], commentsCount: 51, hot: true, score: 90,
    badge: 'Top', badgeClass: 'author', controversy: 86,
    createdAt: new Date(Date.now() - 2 * HOUR),
  });
  const mid = await mkThread({
    id: 'th-mid-' + stamp, title: 'That chapter 18 twist', body: 'Did you see it coming?',
    tag: 'theory', likes: 90, commentsCount: 9, controversy: 12, score: 40,
    createdAt: new Date(Date.now() - 3 * HOUR),
  });
  const qn = await mkThread({
    id: 'th-q-' + stamp, genreId: otherGenre.id, title: 'Who writes better villains?',
    body: 'Argue it out.', tag: 'question', likes: 4, commentsCount: 2,
    createdAt: new Date(Date.now() - 4 * HOUR),
  });

  /* ═══ 1. THE BOARD LIST (genre-hub thread row) ═══ */
  let r = await call('GET', '/api/discussions?genre=' + genre.slug, undefined, memberTok);
  let items = (r.json && r.json.items) || [];
  check('1 GET /api/discussions?genre= -> 200 with items at the envelope root',
    r.status === 200 && Array.isArray(items) && typeof r.json.total === 'number'
      && typeof r.json.page === 'number' && typeof r.json.limit === 'number' && typeof r.json.hasMore === 'boolean',
    `${r.status} n=${items.length} keys=${keysOf(r.json)}`);

  const byId = {}; items.forEach(x => { byId[x.id] = x; });
  const richCard = byId[rich.id] || {};
  check('2 the card is the FLAT OP card the page paints (name/avatar/time/comments, no nested author)',
    OP_FIELDS.every(k => k in richCard) && richCard.author === undefined,
    'missing=' + OP_FIELDS.filter(k => !(k in richCard)).join('|') + ' keys=' + keysOf(richCard));
  check('3 real author resolved: name, http avatar, @handle and verified flag',
    richCard.name === 'op writer' && /^https?:\/\//.test(richCard.avatar || '')
      && richCard.handle === 'dsc_op_writer' && richCard.verified === true,
    JSON.stringify({ name: richCard.name, avatar: (richCard.avatar || '').slice(0, 24), handle: richCard.handle, verified: richCard.verified }));
  check('4 time is a relative string and comments maps the stored commentsCount',
    typeof richCard.time === 'string' && /\d/.test(richCard.time) && richCard.comments === 51,
    'time=' + richCard.time + ' comments=' + richCard.comments);
  check('5 tag is the Title-case pill label, tagClass the lowercase CSS key',
    richCard.tag === 'Controversial' && richCard.tagClass === 'controversial',
    JSON.stringify({ tag: richCard.tag, tagClass: richCard.tagClass }));
  check('6 hot / controversy / badge / badgeClass come from the stored columns',
    richCard.hot === true && richCard.controversy === 86 && richCard.badge === 'Top' && richCard.badgeClass === 'author',
    JSON.stringify({ hot: richCard.hot, controversy: richCard.controversy, badge: richCard.badge, badgeClass: richCard.badgeClass }));
  check('7 the OP media image and the linked-story block survive on the page card',
    richCard.media === MEDIA && richCard.story && richCard.story.cover === COVER
      && richCard.story.title === 'Twelve Nights of Ash' && richCard.story.writer === 'Ada Writer',
    JSON.stringify({ media: (richCard.media || '').slice(0, 20), story: richCard.story }));
  check('8 trope is carried (composer field the OP shows)',
    richCard.trope === 'Enemies to Lovers', 'trope=' + richCard.trope);
  check('9 the pinned house-rules thread is flagged for the sticky card',
    byId[rules.id] && byId[rules.id].pinned === true && richCard.pinned === false,
    'rules.pinned=' + (byId[rules.id] || {}).pinned);
  check('10 _genreName gives the "· Dark Romance" line on the OP header',
    typeof richCard._genreName === 'string' && richCard._genreName === 'Dark Romance' && richCard._genreId === genre.id,
    JSON.stringify({ _genreId: richCard._genreId, _genreName: richCard._genreName }));
  check('11 liked is per-viewer (member liked it, stranger did not)',
    richCard.liked === true, 'member.liked=' + richCard.liked);
  r = await call('GET', '/api/discussions?genre=' + genre.slug, undefined, strangerTok);
  const strangerRich = ((r.json || {}).items || []).find(x => x.id === rich.id) || {};
  check('12 the same card reads liked:false for a viewer who never liked it',
    strangerRich.liked === false && strangerRich.likes === 300,
    JSON.stringify({ liked: strangerRich.liked, likes: strangerRich.likes }));

  /* the hub resolves a CATEGORY slug too — threads across every child genre */
  r = await call('GET', '/api/discussions?genre=' + board.slug, undefined, memberTok);
  items = (r.json && r.json.items) || [];
  check('13 a board (category) slug lists threads from all child genres',
    r.status === 200 && items.length === 4 && new Set(items.map(x => x._genreName)).size === 2,
    `n=${items.length} genres=${[...new Set(items.map(x => x._genreName))].join(',')}`);

  /* ═══ 2. SORT / TAG / PAGINATION — none of this was tested before ═══ */
  r = await call('GET', '/api/discussions?genre=' + board.slug + '&sort=top', undefined, memberTok);
  items = (r.json || {}).items || [];
  check('14 sort=top orders by likes', items[0] && items[0].id === rich.id && items[1] && items[1].id === mid.id,
    items.map(x => x.title + ':' + x.likes).join(' | '));
  r = await call('GET', '/api/discussions?genre=' + board.slug + '&sort=hot', undefined, memberTok);
  items = (r.json || {}).items || [];
  check('15 sort=hot puts the hot thread first', items[0] && items[0].id === rich.id && items[0].hot === true,
    items.map(x => x.title + ':hot=' + x.hot).join(' | '));
  r = await call('GET', '/api/discussions?genre=' + board.slug, undefined, memberTok);
  items = (r.json || {}).items || [];
  check('16 default sort is newest first', items[0] && items[0].id === rules.id && items[3] && items[3].id === qn.id,
    items.map(x => x.title).join(' | '));
  r = await call('GET', '/api/discussions?genre=' + board.slug + '&tag=question', undefined, memberTok);
  items = (r.json || {}).items || [];
  check('17 ?tag= filters to that tag only', r.status === 200 && items.length === 1 && items[0].id === qn.id,
    `n=${items.length} tags=${items.map(x => x.tagClass).join(',')}`);
  r = await call('GET', '/api/discussions?genre=' + board.slug + '&limit=2&page=1', undefined, memberTok);
  const p1 = (r.json || {}).items || [];
  r = await call('GET', '/api/discussions?genre=' + board.slug + '&limit=2&page=2', undefined, memberTok);
  const p2 = (r.json || {}).items || [];
  check('18 pagination pages without overlap and reports total/hasMore',
    p1.length === 2 && p2.length === 2 && r.json.total === 4 && r.json.hasMore === false
      && !p1.some(a => p2.some(b => b.id === a.id)),
    `p1=${p1.length} p2=${p2.length} total=${r.json.total} hasMore=${r.json.hasMore}`);
  r = await call('GET', '/api/discussions?genre=' + board.slug + '&limit=2&page=1&sort=nope');
  check('19 an unknown sort is rejected by the strict validator, not ignored', r.status === 400, 'status=' + r.status);
  r = await call('GET', '/api/discussions?genre=no-such-board');
  check('20 an unknown board answers genre_not_found 404', r.status === 404 && r.json.error === 'genre_not_found',
    `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/discussions');
  check('21 the genre param is required (no unscoped thread dump)', r.status === 400, 'status=' + r.status);

  /* ═══ 3. THE THREAD PAGE ═══ */
  r = await call('GET', '/api/discussions/' + rich.id, undefined, memberTok);
  check('22 GET /api/discussions/:id -> the same flat OP card', r.status === 200
    && OP_FIELDS.every(k => k in (r.json || {})) && r.json.id === rich.id && r.json.author === undefined,
    `${r.status} missing=${OP_FIELDS.filter(k => !((r.json || {})[k] !== undefined && k in r.json)).join('|')}`);
  check('23 the thread page carries the story rec, media and genre label',
    r.json && r.json.story && r.json.story.cover === COVER && r.json.media === MEDIA && r.json._genreName === 'Dark Romance',
    JSON.stringify({ media: !!(r.json || {}).media, story: !!(r.json || {}).story, g: (r.json || {})._genreName }));
  r = await call('GET', '/api/discussions/th-does-not-exist');
  check('24 an unknown thread answers 404 so the page shows its not-found state',
    r.status === 404 && r.json && r.json.error === 'not_found', `${r.status} ${JSON.stringify(r.json)}`);

  /* ═══ 4. OPENING A THREAD (board-gated write) ═══ */
  r = await call('POST', '/api/discussions', { genre: genre.slug, title: 'New thread', body: 'Go on', tag: 'question' }, strangerTok);
  check('25 a non-member cannot open a thread -> join_board_first',
    r.status === 403 && r.json.error === 'join_board_first', `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { genre: genre.slug, title: 'New thread', body: 'Go on', tag: 'question' }, memberTok);
  check('26 a member opens a thread -> 201 with the flat card',
    r.status === 201 && OP_FIELDS.every(k => k in (r.json || {})) && typeof r.json.comments === 'number' && r.json.pinned === false,
    `${r.status} missing=${OP_FIELDS.filter(k => !(k in (r.json || {}))).join('|')} keys=${keysOf(r.json)}`);
  const made = r.json || {};
  check('27 the write returns the author name and a relative time, not a bare id',
    made.name === 'member reader' && typeof made.time === 'string'
      && (made.time === 'Just now' || /^\d/.test(made.time)) && made._genreName === 'Dark Romance',
    JSON.stringify({ name: made.name, time: made.time, g: made._genreName }));
  check('28 the new thread surfaces on the board list',
    ((await call('GET', '/api/discussions?genre=' + genre.slug, undefined, memberTok)).json || {}).items
      .some(x => x.id === made.id), 'id=' + made.id);
  r = await call('POST', '/api/discussions', { genre: genre.slug, title: 'Bad tag', tag: 'spam' }, memberTok);
  check('29 an unknown tag is refused with bad_tag', r.status === 400 && r.json.error === 'bad_tag',
    `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { genre: genre.slug, title: 'XSS media', media: 'javascript:alert(1)' }, memberTok);
  check('30 media is validated, so no script url reaches <img src>',
    r.status === 400, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { title: 'no genre' }, memberTok);
  check('31 a thread needs a board (genre) and a title', r.status === 400, 'status=' + r.status);

  /* ═══ 5. PATCH /:id — never covered by any suite before ═══ */
  r = await call('PATCH', '/api/discussions/' + rich.id, { title: 'Edited by a stranger' }, strangerTok);
  check('32 PATCH by someone else -> 403 forbidden', r.status === 403 && r.json.error === 'forbidden',
    `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('PATCH', '/api/discussions/' + rich.id,
    { title: 'Best bakery rivals trope? (edited)', tag: 'theory', story: null, media: '' }, opTok);
  check('33 the author edits title / tag / and clears the media + story',
    r.status === 200 && r.json.title === 'Best bakery rivals trope? (edited)'
      && r.json.tagClass === 'theory' && r.json.media === '' && r.json.story === null,
    `${r.status} ${JSON.stringify({ t: (r.json || {}).title, tag: (r.json || {}).tagClass, media: (r.json || {}).media, story: (r.json || {}).story })}`);
  r = await call('GET', '/api/discussions/' + rich.id);
  check('34 the edit persisted on a fresh read (no cache, no second write)',
    r.json && r.json.title === 'Best bakery rivals trope? (edited)' && r.json.tag === 'Theory',
    JSON.stringify({ title: (r.json || {}).title, tag: (r.json || {}).tag }));
  r = await call('PATCH', '/api/discussions/' + rich.id, { tag: 'nonsense' }, opTok);
  check('35 PATCH validates the tag too', r.status === 400 && r.json.error === 'bad_tag', `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('PATCH', '/api/discussions/' + rich.id, { body: 'Admin tidy-up.' }, adminTok);
  check('36 an admin can edit someone else\'s thread', r.status === 200 && r.json.body === 'Admin tidy-up.',
    `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);

  /* like/unlike is its own write, gated by the board */
  r = await call('POST', '/api/discussions/' + made.id + '/like', undefined, strangerTok);
  check('37 a non-member cannot like a board thread', r.status === 403, 'status=' + r.status);
  r = await call('POST', '/api/discussions/' + made.id + '/like', undefined, memberTok);
  check('38 like -> {liked:true} and the counter moves', r.status === 200 && r.json.liked === true && r.json.likes === 1,
    JSON.stringify(r.json));
  r = await call('POST', '/api/discussions/' + made.id + '/like', undefined, memberTok);
  check('39 liking again un-likes (no double count)', r.status === 200 && r.json.liked === false && r.json.likes === 0,
    JSON.stringify(r.json));
  r = await call('GET', '/api/discussions?genre=' + genre.slug, undefined, memberTok);
  const cardAfterLike = ((r.json || {}).items || []).find(x => x.id === made.id) || {};
  check('40 the list card reflects the stored like state', cardAfterLike.likes === 0 && cardAfterLike.liked === false,
    JSON.stringify({ likes: cardAfterLike.likes, liked: cardAfterLike.liked }));

  /* ═══ 6. THE COMMENTS HALF OF THE PAGE ═══ */
  r = await call('POST', '/api/comments',
    { scope: 'discussion', discussionId: made.id, text: 'Agreed, the bakery scene.' }, memberTok);
  check('41 replying inside a thread -> 201', r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 90)}`);
  const topComment = (r.json && (r.json.id || (r.json.comment && r.json.comment.id))) || null;
  r = await call('POST', '/api/comments',
    { scope: 'discussion', discussionId: made.id, parentId: topComment, text: 'Not my board.' }, strangerTok);
  check('42 replying inside a board thread needs board membership too',
    r.status === 403 && r.json.error === 'join_board_first', `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/comments',
    { scope: 'discussion', discussionId: made.id, parentId: topComment, text: '@member reader right.' }, memberTok);
  check('42b a member\'s reply to a comment is accepted', r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 90)}`);
  r = await call('GET', '/api/comments?scope=discussion&discussionId=' + made.id, undefined, memberTok);
  const cmt = ((r.json || {}).items || [])[0] || {};
  check('43 the comment list returns the shape the shared comment section renders',
    r.status === 200 && Array.isArray(r.json.items) && typeof cmt.name === 'string'
      && /^https?:\/\//.test(cmt.avatar || '') && typeof cmt.text === 'string' && Array.isArray(cmt.replies),
    `${r.status} keys=${keysOf(cmt)} replies=${(cmt.replies || []).length}`);
  check('44 the nested reply comes back under its parent', cmt.replies && cmt.replies.length === 1
    && typeof cmt.replies[0].text === 'string', 'n=' + ((cmt.replies || []).length));
  r = await call('GET', '/api/discussions/' + made.id, undefined, memberTok);
  check('45 the OP comment count tracks the real thread (2, not the stored 0)',
    r.json && r.json.comments === 2 && r.json.commentsCount === 2,
    JSON.stringify({ comments: (r.json || {}).comments, commentsCount: (r.json || {}).commentsCount }));

  /* ═══ 7. DELETE ═══ */
  r = await call('DELETE', '/api/discussions/' + mid.id, undefined, strangerTok);
  check('46 a stranger cannot delete a thread -> 403', r.status === 403 && r.json.error === 'forbidden',
    `${r.status} ${JSON.stringify(r.json)}`);
  await Comment.create({ scope: 'discussion', discussionId: mid.id, authorId: member.id, text: 'Doomed thread comment.' });
  r = await call('DELETE', '/api/discussions/' + mid.id, undefined, opTok);
  check('47 the author deletes a thread -> ok:true', r.status === 200 && r.json.ok === true,
    `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/discussions/' + mid.id);
  check('48 the deleted thread is gone from the reader side', r.status === 404, 'status=' + r.status);
  check('49 deleting the thread deleted its comments (no orphan rows)',
    (await Comment.countDocuments({ scope: 'discussion', discussionId: mid.id })) === 0,
    'left=' + (await Comment.countDocuments({ scope: 'discussion', discussionId: mid.id })));
  check('50 and it dropped off the board list',
    !(((await call('GET', '/api/discussions?genre=' + genre.slug, undefined, memberTok)).json || {}).items || [])
      .some(x => x.id === mid.id), 'mid=' + mid.id);

  /* ═══ 8. THE FEED ROW MUST NOT DRIFT ═══ */
  r = await call('GET', '/api/discussions/feed?limit=12', undefined, memberTok);
  const fcard = ((r.json || {}).items || []).find(x => x.id === rich.id) || {};
  check('51 the feed row stays the stripped card: no media / trope / story',
    !('media' in fcard) && !('trope' in fcard) && !('story' in fcard), 'keys=' + keysOf(fcard));
  check('52 the feed row keeps _genreId + _genreName + the flat author fields',
    fcard._genreId === genre.id && fcard._genreName === 'Dark Romance'
      && typeof fcard.name === 'string' && typeof fcard.time === 'string' && typeof fcard.comments === 'number',
    JSON.stringify({ g: fcard._genreName, name: fcard.name, time: fcard.time, comments: fcard.comments }));
  const pageCard = (await call('GET', '/api/discussions/' + rich.id, undefined, memberTok)).json || {};
  const shared = ['id', 'title', 'body', 'tag', 'tagClass', 'score', 'hot', 'badge', 'badgeClass',
    'controversy', 'pinned', 'likes', 'comments', 'name', 'avatar', 'handle', 'verified', 'time'];
  check('53 one mapper serves both readers: every shared field agrees exactly',
    shared.every(k => fcard[k] === pageCard[k]) && svc.toFlatCard.toString().indexOf('toCard(') > -1,
    'differ=' + shared.filter(k => fcard[k] !== pageCard[k]).join('|'));

  const passed = results.filter(x => x.pass).length;
  console.log('\n===== ' + passed + '/' + results.length + ' discussion-page assertions passed =====');
  try {
    fs.writeFileSync(path.join(__dirname, 'smoke-discussion-live.results.txt'),
      results.map(x => (x.pass ? 'PASS' : 'FAIL') + '  ' + x.name).join('\n') + '\n');
  } catch (e) { /* reporting only */ }
  await mongod.stop();
  process.exit(passed === results.length ? 0 : 1);
}
main().catch(e => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
