'use strict';
// Live boards contract. A board IS the category the CE created — there is no
// separate Board entity — so this boots the REAL Express app against in-memory
// MongoDB and asserts that the reader-side board surfaces (boards overlay,
// genre hub, board stories, board members) get exactly the fields they render:
//   GET /api/categories            → every row with isJoined + ?joined=me
//   GET /api/categories/:slug      → blurb / stories / members / discussions
//   GET /api/genres/:slug          → same hub from a child genre slug
//   GET /api/.../stories           → status, chapters, writer handle
//   GET /api/.../members           → FollowList rows carrying the viewer's follow state
// plus the join/leave writes that move membersCount.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4213';
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
  process.env.MONGO_URI = mongod.getUri('droboard_boards');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const origin = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(origin + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Category, Genre, Book, Chapter, CategoryMembership } = require('../src/models/content.model');
  const { Discussion, Follow } = require('../src/models/social.model');
  const jwt = require('jsonwebtoken');

  async function call(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(origin + path, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  const stamp = Date.now();
  const HOUR = 3600000, DAY = 86400000;
  const tok = (u, roles) => jwt.sign({ sub: u.id, roles: roles || ['reader'] }, process.env.JWT_ACCESS_SECRET);

  /* ═══ 1. THE CE CATALOGUE A BOARD IS BUILT FROM ═══ */
  const cat = await Category.create({
    id: 'cat-boards-' + stamp, name: 'Fantasy', slug: 'fantasy',
    desc: 'Dragons, courts and bargains.', tagline: 'Where imagination becomes legend.',
    icon: 'fa-hat-wizard', color: '#8b5cf6', bg: 'linear-gradient(135deg,#1e1b4b,#0f172a)',
    booksCount: 0, membersCount: 0, status: 'active',
  });
  const other = await Category.create({
    id: 'cat-other-' + stamp, name: 'Romance', slug: 'romance',
    desc: 'Slow burn.', tagline: 'He was supposed to be the villain.',
    icon: 'fa-heart', booksCount: 0, membersCount: 0, status: 'active',
  });
  const retired = await Category.create({
    id: 'cat-retired-' + stamp, name: 'Retired Board', slug: 'retired-board',
    desc: '', status: 'inactive', booksCount: 0, membersCount: 0,
  });
  const werewolf = await Genre.create({
    id: 'gen-werewolf-' + stamp, name: 'Werewolf', slug: 'werewolf', categoryId: cat.id,
    desc: 'Moon-bound mates.', status: 'active', booksCount: 0, membersCount: 0,
  });
  const dragon = await Genre.create({
    id: 'gen-dragon-' + stamp, name: 'Dragon Rider', slug: 'dragon-rider', categoryId: cat.id,
    desc: 'Bonded at the hatchling.', status: 'active', booksCount: 0, membersCount: 0,
  });
  // Romance gets ONE child genre, so a composer that names only the board can
  // resolve it, while Fantasy (two children) must force an explicit pick.
  await Genre.create({
    id: 'gen-contract-' + stamp, name: 'Contract', slug: 'contract', categoryId: other.id,
    desc: 'Paper first, feelings later.', status: 'active', booksCount: 0, membersCount: 0,
  });

  const author = await User.create({
    id: 'usr_ba_' + stamp, username: 'boards_author', fullName: 'Boards Author',
    email: 'boards_author@t.co', passwordHash: 'x', roles: ['writer'], primaryRole: 'writer',
    status: 'active', avatar: 'https://i.pravatar.cc/150?img=5', bio: 'Writes the moon ones.',
  });
  const reader = await User.create({
    id: 'usr_br_' + stamp, username: 'boards_reader', fullName: 'Boards Reader',
    email: 'boards_reader@t.co', passwordHash: 'x', roles: ['reader'], primaryRole: 'reader',
    status: 'active', avatar: 'https://i.pravatar.cc/150?img=10', bio: 'Reads in bed.',
  });
  const lurker = await User.create({
    id: 'usr_bl_' + stamp, username: 'boards_lurker', fullName: 'Boards Lurker',
    email: 'boards_lurker@t.co', passwordHash: 'x', roles: ['reader'], primaryRole: 'reader',
    status: 'active', avatar: 'https://i.pravatar.cc/150?img=13',
  });
  const readerToken = tok(reader);

  // Books: one completed, one ongoing, one draft (drafts must never surface),
  // spread across the two child genres of the same parent board.
  await Book.create([
    { id: 'bk_b_1', title: 'WOLFSBANE', authorId: author.id, genre: 'Werewolf', categoryId: cat.id, status: 'completed', reads: 4000, likes: 200, rating: 4.6, chapterCount: 32, cover: 'https://picsum.photos/seed/b1/200/300', synopsis: 'A mute luna hears her mate.' },
    { id: 'bk_b_2', title: 'EMBER COURT', authorId: author.id, genre: 'Dragon Rider', categoryId: cat.id, status: 'ongoing', reads: 1200, likes: 60, rating: 4.2, chapterCount: 8, cover: 'https://picsum.photos/seed/b2/200/300', synopsis: 'She bonded the wrong hatchling.' },
    { id: 'bk_b_3', title: 'UNPUBLISHED', authorId: author.id, genre: 'Werewolf', categoryId: cat.id, status: 'draft', reads: 9999, chapterCount: 1, cover: 'https://picsum.photos/seed/b3/200/300', synopsis: 'Must not appear on a board.' },
    { id: 'bk_b_4', title: 'PAPER RINGS', authorId: author.id, genre: 'Romance', categoryId: other.id, status: 'published', reads: 500, chapterCount: 3, cover: 'https://picsum.photos/seed/b4/200/300', synopsis: 'A contract marriage, filed in triplicate.' },
  ]);

  /* ═══ 2. BOARDS EXPLORER LIST — joined / rest split in one call ═══ */
  let r = await call('GET', '/api/categories');
  check('GET /api/categories -> 200', r.status === 200, `status=${r.status}`);
  const listItems = r.json.items || [];
  check('boards list returns active categories only', listItems.every(x => x.name !== 'Retired Board') && listItems.some(x => x.name === 'Fantasy'), JSON.stringify(listItems.map(x => x.name)));
  const fantasyRow = listItems.find(x => x.slug === 'fantasy') || {};
  check('row carries the id the overlay links on (?genre=)', typeof fantasyRow.id === 'string' && fantasyRow.id.length > 0, fantasyRow.id);
  check('row is resolvable by that id alone', String(fantasyRow.id) === String(cat.id), fantasyRow.id);
  check('row carries name, icon and tagline the card renders', !!fantasyRow.name && !!fantasyRow.icon && !!fantasyRow.tagline, JSON.stringify({ name: fantasyRow.name, icon: fantasyRow.icon, tagline: fantasyRow.tagline }));
  check('every row carries isJoined=false before joining', listItems.every(x => x.isJoined === false), JSON.stringify(listItems.map(x => [x.slug, x.isJoined])));
  check('member count arrives pre-formatted for the card', typeof fantasyRow.members === 'string', JSON.stringify(fantasyRow.members));

  r = await call('GET', '/api/categories?joined=me', undefined, readerToken);
  check('GET /categories?joined=me anon -> empty for a fresh reader', (r.json.items || []).length === 0, JSON.stringify(r.json.items));

  r = await call('POST', '/api/categories/fantasy/join', undefined, readerToken);
  check('POST /api/categories/:slug/join -> 200 joined', r.status === 200 && r.json.joined === true, JSON.stringify(r.json));
  check('join bumps the live membersCount', r.json.membersCount === 1, `membersCount=${r.json.membersCount}`);

  r = await call('GET', '/api/categories?joined=me', undefined, readerToken);
  const joinedOnly = r.json.items || [];
  check('joined=me returns exactly the joined board', joinedOnly.length === 1 && joinedOnly[0].slug === 'fantasy', JSON.stringify(joinedOnly.map(x => x.slug)));
  check('joined=me rows are marked isJoined', joinedOnly.every(x => x.isJoined === true), JSON.stringify(joinedOnly.map(x => [x.slug, x.isJoined])));

  r = await call('GET', '/api/categories', undefined, readerToken);
  const withState = r.json.items || [];
  check('one call paints both overlay halves', withState.filter(x => x.isJoined).length === 1 && withState.filter(x => !x.isJoined).length === withState.length - 1, JSON.stringify(withState.map(x => [x.slug, x.isJoined])));

  r = await call('GET', '/api/categories?joined=me');
  check('joined=me without a session is empty, not an error', r.status === 200 && (r.json.items || []).length === 0, `status=${r.status}`);

  /* ═══ 3. HUB HEADER — the numbers printed on the board ═══ */
  await Discussion.create([
    { id: 'dsc_1', genreId: werewolf.id, authorId: reader.id, title: 'Best moon-bound mates?', body: 'Go', tag: 'discussion', likes: 4, commentsCount: 2, hot: false, score: 10 },
    { id: 'dsc_2', genreId: dragon.id, authorId: reader.id, title: 'Hatchling bonding rules', body: 'Go', tag: 'question', likes: 1, commentsCount: 0, hot: false, score: 3 },
  ]);
  r = await call('GET', '/api/categories/fantasy', undefined, readerToken);
  check('GET /api/categories/:slug -> 200', r.status === 200, `status=${r.status}`);
  const hub = r.json || {};
  check('hub returns the blurb the About panel prints', hub.blurb === 'Dragons, courts and bargains.', JSON.stringify(hub.blurb));
  check('hub stories counts live books only (drafts excluded)', String(hub.stories) === '2', JSON.stringify({ stories: hub.stories, storiesCount: hub.storiesCount }));
  check('hub members reflects the join', hub.members === '1' && hub.membersCount === 1, JSON.stringify({ members: hub.members, membersCount: hub.membersCount }));
  check('hub discussions counts threads across the child genres', hub.discussions === '2' && hub.discussionsCount === 2, JSON.stringify({ discussions: hub.discussions, discussionsCount: hub.discussionsCount }));
  check('hub marks this reader as joined', hub.isJoined === true, hub.isJoined);
  check('hub lists the CE child genres', (hub.genres || []).length === 2 && hub.genres.every(g => g.name && g.slug), JSON.stringify((hub.genres || []).map(g => g.slug)));
  check('hub hides the retired board', (await call('GET', '/api/categories/retired-board')).status === 404);
  check('hub 404s an invented board', (await call('GET', '/api/categories/no-such-board')).status === 404);

  r = await call('GET', '/api/categories/fantasy', undefined, tok(lurker));
  check('a non-member reads the same hub with isJoined=false', r.status === 200 && r.json.isJoined === false, `isJoined=${r.json && r.json.isJoined}`);

  /* the overlay links ?genre=<child slug> — that must land on the same board */
  r = await call('GET', '/api/genres/werewolf', undefined, readerToken);
  check('GET /api/genres/:childSlug -> 200 parent hub', r.status === 200 && r.json.slug === 'fantasy', `slug=${r.json && r.json.slug}`);
  check('child genre hub agrees with the category hub', r.json.discussions === hub.discussions && r.json.stories === hub.stories && r.json.members === hub.members, JSON.stringify({ stories: r.json.stories, members: r.json.members, discussions: r.json.discussions }));

  /* ═══ 4. STORIES TAB — shared book card fields ═══ */
  r = await call('GET', '/api/categories/fantasy/stories?sort=top');
  check('GET /api/categories/:slug/stories -> 200', r.status === 200, `status=${r.status}`);
  const stories = r.json.items || [];
  check('stories tab excludes drafts', stories.length === 2 && stories.every(s => ['completed', 'ongoing', 'published'].includes(s.status)), JSON.stringify(stories.map(s => [s.title, s.status])));
  const top = stories.find(s => s.title === 'WOLFSBANE') || {};
  check('story row carries the status the badge renders', top.status === 'completed', top.status);
  check('story row carries chapters under the card key', top.chapters === 32, `chapters=${top.chapters} chapterCount=${top.chapterCount}`);
  check('story row carries a writer username, not an id', top.writer === 'boards_author' && top.author === 'boards_author', JSON.stringify({ writer: top.writer, author: top.author }));
  check('story row keeps cover/title/reads the card needs', !!top.cover && !!top.title && top.reads === 4000, JSON.stringify({ cover: top.cover, reads: top.reads }));
  check('stories tab sorted by reads for sort=top', stories[0].title === 'WOLFSBANE', JSON.stringify(stories.map(s => s.title)));

  r = await call('GET', '/api/categories/fantasy/stories?sort=new');
  check('stories tab honours sort=new', r.status === 200 && (r.json.sort === 'new'), `sort=${r.json && r.json.sort}`);

  /* the "New chapter" badge: the front end used to roll dice for it — the row
     must carry the real date of the newest live chapter. */
  await Chapter.create([
    { bookId: 'bk_b_1', n: 31, title: 'The Hunt', status: 'live' },
    { bookId: 'bk_b_1', n: 32, title: 'Moonfall', status: 'live' },
    { bookId: 'bk_b_1', n: 33, title: 'Unleaked', status: 'draft' },
    { bookId: 'bk_b_2', n: 8, title: 'Ash Hatchling', status: 'live' },
  ]);
  // Mongoose owns createdAt on a timestamps schema (it strips it from updates),
  // so the ages the badge keys off are written through the raw collection.
  const age = async (bookId, n, hoursAgo) => {
    await Chapter.collection.updateOne({ bookId, n }, { $set: { createdAt: new Date(Date.now() - hoursAgo * HOUR) } });
  };
  await age('bk_b_1', 31, 72);
  await age('bk_b_1', 32, 6);
  await age('bk_b_1', 33, 0.05); // draft minutes ago: must not mark the book new
  await age('bk_b_2', 8, 960); // ~40 days
  r = await call('GET', '/api/categories/fantasy/stories?sort=top');
  const fresh = (r.json.items || []).find(s => s.title === 'WOLFSBANE') || {};
  const stale = (r.json.items || []).find(s => s.title === 'EMBER COURT') || {};
  check('story row reports the newest LIVE chapter date', typeof fresh.latestChapterAt === 'string' && !Number.isNaN(Date.parse(fresh.latestChapterAt)), fresh.latestChapterAt);
  // newest live chapter is 6h old; the minutes-old draft must not win.
  check('story row takes the latest live chapter, not a newer draft', Date.parse(fresh.latestChapterAt) > Date.now() - 12 * HOUR && Date.parse(fresh.latestChapterAt) < Date.now() - 4 * HOUR, `latest=${fresh.latestChapterAt}`);
  check('a quiet book reports its old chapter, so the badge can say not-new', Date.now() - Date.parse(stale.latestChapterAt) > 7 * DAY, `latest=${stale.latestChapterAt}`);
  r = await call('GET', '/api/categories/romance/stories');
  check('a board with no chapters yields null, not a fabricated date', ((r.json.items || [])[0] || {}).latestChapterAt === null, JSON.stringify((r.json.items || []).map(s => [s.title, s.latestChapterAt])));

  r = await call('GET', '/api/genres/dragon-rider/stories');
  check('child genre stories tab resolves to the parent board', r.status === 200 && (r.json.items || []).length === 2, `count=${r.json && (r.json.items || []).length}`);

  /* ═══ 5. MEMBERS TAB — shared FollowList rows ═══ */
  await Follow.create({ followerId: reader.id, followingId: author.id });
  await CategoryMembership.create({ userId: author.id, categoryId: cat.id });
  r = await call('GET', '/api/genres/fantasy/members', undefined, readerToken);
  check('GET /api/genres/:slug/members -> 200', r.status === 200, `status=${r.status}`);
  const members = r.json.items || [];
  check('members tab returns the joined people', members.length === 2, JSON.stringify(members.map(m => m.username)));
  const authorRow = members.find(m => m.username === 'boards_author') || {};
  const readerRow = members.find(m => m.username === 'boards_reader') || {};
  check('member row has the name/handle FollowList renders', authorRow.name === 'boards_author' && authorRow.handle === 'boards_author', JSON.stringify({ name: authorRow.name, handle: authorRow.handle }));
  check('member row has avatar under both keys author and renderer use', authorRow.av === 'https://i.pravatar.cc/150?img=5' && authorRow.avatar === authorRow.av, authorRow.av);
  check('member row has a meta line', typeof authorRow.meta === 'string' && authorRow.meta.length > 0, authorRow.meta);
  check('member row flags a writer', authorRow.isWriter === true && readerRow.isWriter === false, JSON.stringify({ author: authorRow.isWriter, reader: readerRow.isWriter }));
  check('member row carries the viewer follow state', authorRow.following === true && readerRow.following === false, JSON.stringify({ author: authorRow.following, reader: readerRow.following }));
  check('members page reports the total', r.json.total === 2, `total=${r.json.total}`);

  r = await call('GET', '/api/genres/fantasy/members');
  check('anon members rows default following=false', r.status === 200 && (r.json.items || []).every(m => m.following === false), JSON.stringify((r.json.items || []).map(m => m.following)));

  r = await call('GET', '/api/categories/fantasy/members', undefined, readerToken);
  check('GET /api/categories/:slug/members works for the board slug', r.status === 200 && (r.json.items || []).length === 2, `status=${r.status} n=${r.json && (r.json.items || []).length}`);

  /* ═══ 6. LEAVE — counts move back ═══ */
  r = await call('DELETE', '/api/categories/fantasy/join', undefined, readerToken);
  check('DELETE /api/categories/:slug/join -> joined false', r.status === 200 && r.json.joined === false && r.json.membersCount === 1, JSON.stringify(r.json));
  r = await call('GET', '/api/categories/fantasy', undefined, readerToken);
  check('leaving clears isJoined on the hub', r.json.isJoined === false, r.json && r.json.isJoined);
  r = await call('GET', '/api/categories?joined=me', undefined, readerToken);
  check('joined=me is empty again after leaving', (r.json.items || []).length === 0, JSON.stringify(r.json.items));

  r = await call('POST', '/api/genres/werewolf/join', undefined, tok(lurker));
  check('joining by child genre slug joins the parent board', r.status === 200 && r.json.membersCount === 2, JSON.stringify(r.json));

  /* ═══ 7. WRITES ARE BOARD ACTIONS — MEMBERS ONLY ═══ */
  const stranger = await User.create({
    id: 'usr_bs_' + stamp, username: 'boards_stranger', fullName: 'Boards Stranger',
    email: 'boards_stranger@t.co', passwordHash: 'x', roles: ['reader'], primaryRole: 'reader',
    status: 'active', avatar: 'https://i.pravatar.cc/150?img=17',
  });
  r = await call('GET', '/api/categories/fantasy', undefined, tok(stranger));
  check('a stranger reads the board as not joined', r.status === 200 && r.json.isJoined === false, `isJoined=${r.json && r.json.isJoined}`);
  const thread = { genre: 'werewolf', title: 'Best moon-bound mates?', body: 'Go on', tag: 'discussion' };
  const comment = { scope: 'discussion', discussionId: 'dsc_1', text: 'Agreed.' };

  r = await call('POST', '/api/discussions', thread, tok(stranger));
  check('non-member cannot open a thread in the board', r.status === 403 && String(JSON.stringify(r.json)).includes('join_board_first'), `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions/dsc_1/like', undefined, tok(stranger));
  check('non-member cannot like a board thread', r.status === 403, `status=${r.status}`);
  r = await call('POST', '/api/comments', comment, tok(stranger));
  check('non-member cannot reply inside a board thread', r.status === 403, `status=${r.status}`);
  r = await call('POST', '/api/discussions', thread);
  check('anonymous board write is 401, not 403', r.status === 401, `status=${r.status}`);

  // A writer is not board staff: no membership, no post.
  r = await call('GET', '/api/categories/romance', undefined, tok(author));
  check('the writer has not joined the other board', r.json.isJoined === false, r.json && r.json.isJoined);
  r = await call('POST', '/api/discussions', { genre: 'romance', title: 'Slow burn or nothing', tag: 'discussion' }, tok(author));
  check('a writer with no board membership cannot post there', r.status === 403, `status=${r.status} ${JSON.stringify(r.json)}`);

  // Reads stay open to everyone, member or not.
  r = await call('GET', '/api/discussions?genre=werewolf', undefined, tok(stranger));
  check('non-members still read the board feed', r.status === 200, `status=${r.status} n=${r.json && (r.json.items || []).length}`);

  // Joining unlocks every write.
  await call('POST', '/api/categories/fantasy/join', undefined, tok(stranger));
  r = await call('POST', '/api/discussions', thread, tok(stranger));
  check('member can open a thread in the board', r.status === 201, `status=${r.status} ${JSON.stringify(r.json)}`);
  const newId = r.json && r.json.id;
  r = await call('POST', '/api/discussions/dsc_1/like', undefined, tok(stranger));
  check('member can like a board thread', r.status === 200 && r.json.liked === true, JSON.stringify(r.json));
  r = await call('POST', '/api/comments', comment, tok(stranger));
  check('member can reply inside a board thread', r.status === 201, `status=${r.status}`);
  r = await call('GET', '/api/discussions/dsc_1', undefined, tok(stranger));
  check('the thread still lists after the gated writes', r.status === 200, `status=${r.status}`);
  r = await call('GET', '/api/discussions?genre=werewolf', undefined, tok(stranger));
  check('the new thread surfaces on the board feed', (r.json.items || []).some(x => String(x.id) === String(newId)), `n=${(r.json.items || []).length}`);

  // Crew is assigned to the BOARD (admin console / CE catalogue columns) and one
  // team covers every child genre in it. Genres carry no crew of their own.
  const boardAdmin = await User.create({
    id: 'usr_ba2_' + stamp, username: 'boards_admin', fullName: 'Boards Admin',
    email: 'boards_admin@t.co', passwordHash: 'x', roles: ['reader'], primaryRole: 'reader',
    status: 'active', avatar: 'https://i.pravatar.cc/150?img=14',
  });
  const boardMod = await User.create({
    id: 'usr_bm_' + stamp, username: 'boards_mod', fullName: 'Boards Mod',
    email: 'boards_mod@t.co', passwordHash: 'x', roles: ['reader'], primaryRole: 'reader',
    status: 'active', avatar: 'https://i.pravatar.cc/150?img=15',
  });
  await Category.updateOne({ id: other.id }, { adminIds: [boardAdmin.id] });
  await Category.updateOne({ id: cat.id }, { moderatorIds: [boardMod.id] });
  r = await call('GET', '/api/categories/fantasy');
  const hubMods = (r.json.moderators || []).map(m => m.username);
  check('the board lists its assigned moderator', hubMods.includes('boards_mod'), JSON.stringify(r.json.moderators));
  check('a moderator is not reported as a board admin', (r.json.admins || []).every(a => a.username !== 'boards_mod'), JSON.stringify(r.json.admins));
  r = await call('GET', '/api/genres/dragon-rider');
  check('the child genre carries no crew of its own', (r.json.moderators || []).map(m => m.username).includes('boards_mod'), JSON.stringify(r.json.moderators));
  r = await call('POST', '/api/discussions', { genre: 'contract', title: 'Sticky note', tag: 'question' }, tok(reader));
  check('a non-member cannot post in the other board', r.status === 403, `status=${r.status}`);
  r = await call('POST', '/api/discussions', { genre: 'romance', title: 'Sticky note', tag: 'question' }, tok(boardAdmin));
  check('the board admin posted without joining', r.status === 201, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { genre: 'dragon-rider', title: 'Hatchling house rules', tag: 'question' }, tok(boardMod));
  check('the board moderator posted without joining', r.status === 201, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { genre: 'werewolf', title: 'Same board, other corner', tag: 'question' }, tok(boardMod));
  check('one board crew runs every child genre in the board', r.status === 201, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { genre: 'romance', title: 'Not my board', tag: 'question' }, tok(boardMod));
  check('a moderator of another board cannot post here', r.status === 403, `status=${r.status}`);

  // Leaving locks the writes again.
  await call('DELETE', '/api/categories/fantasy/join', undefined, tok(stranger));
  r = await call('POST', '/api/discussions', { genre: 'werewolf', title: 'Back out again', tag: 'discussion' }, tok(stranger));
  check('leaving the board removes write rights', r.status === 403, `status=${r.status}`);

  /* a board slug names the parent — the child must be picked explicitly */
  await call('POST', '/api/categories/fantasy/join', undefined, tok(stranger));
  r = await call('POST', '/api/discussions', { genre: 'fantasy', title: 'Which child?', tag: 'discussion' }, tok(stranger));
  check('naming only a two-child board asks the client to pick a genre', r.status === 400 && String(JSON.stringify(r.json)).includes('pick_board_genre'), `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/discussions', { genre: 'fantasy', genreId: 'dragon-rider', title: 'Hatchling law', tag: 'theory' }, tok(stranger));
  check('board slug + chosen child creates the thread', r.status === 201 && String((r.json || {}).genreId || '').length > 0, `status=${r.status} genreId=${r.json && r.json.genreId}`);
  r = await call('POST', '/api/discussions', { genre: 'fantasy', genreId: 'contract', title: 'Wrong board', tag: 'theory' }, tok(stranger));
  check('a child from another board is refused', r.status === 400 && String(JSON.stringify(r.json)).includes('genre_not_in_board'), `status=${r.status} ${JSON.stringify(r.json)}`);
  void newId;

  /* ═══ BOARD HOUSE-RULES — chief CRUDs rules[] on the Category ═══ */
  const chief = await User.create({
    id: 'usr_bc_' + stamp, username: 'boards_chief', fullName: 'Boards Chief',
    email: 'boards_chief@t.co', passwordHash: 'x', roles: ['chief_editor'], primaryRole: 'chief_editor',
    status: 'active', avatar: 'https://i.pravatar.cc/150?img=33',
  });
  const chiefTok = tok(chief, ['chief_editor']);
  const rulesSlug = 'rules-board-' + stamp;
  r = await call('POST', '/api/chief/categories', {
    name: 'Rules Board ' + stamp, slug: rulesSlug, rules: ['  Be kind  ', '', 'No spoilers'],
  }, chiefTok);
  check('chief creates a board with rules (trimmed, blank dropped)',
    r.status === 201 && JSON.stringify(r.json.rules) === JSON.stringify(['Be kind', 'No spoilers']),
    `status=${r.status} ${JSON.stringify(r.json && r.json.rules)}`);
  const rulesBoardId = r.json && r.json.id;
  r = await call('PATCH', '/api/chief/categories/' + rulesBoardId, { rules: ['Respect the author', 'Tag your tropes'] }, chiefTok);
  check('chief PATCH replaces the board rules',
    r.status === 200 && JSON.stringify(r.json.rules) === JSON.stringify(['Respect the author', 'Tag your tropes']),
    `status=${r.status} ${JSON.stringify(r.json && r.json.rules)}`);
  r = await call('GET', '/api/categories/' + rulesSlug);
  check('the reader board card exposes rules[]',
    r.status === 200 && Array.isArray(r.json.rules) && r.json.rules.length === 2,
    `status=${r.status} ${JSON.stringify(r.json && r.json.rules)}`);
  r = await call('PATCH', '/api/chief/categories/' + rulesBoardId, { rules: Array.from({ length: 16 }, (_, i) => 'r' + i) }, chiefTok);
  check('more than 15 rules is rejected', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/chief/categories/' + rulesBoardId, { rules: ['sneaky'] }, readerToken);
  check('a reader cannot edit board rules', r.status === 403, `status=${r.status}`);

  const failed = results.filter(x => !x.pass);
  console.log('\n===== ' + (results.length - failed.length) + '/' + results.length + ' live boards assertions passed =====');
  failed.forEach(f => console.log('FAILED: ' + f.name));
  try { await mongod.stop(); } catch (e) { /* the box sometimes leaves mongod to the port reaper */ }
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
