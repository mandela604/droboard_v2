'use strict';
// Live comment-card + debate-arg contract. Boots the REAL Express app against
// in-memory MongoDB and asserts every field the reader comment-section card
// and the debate-args thread render:
//   GET/POST /api/comments                → comment card fields (statusRing,
//                                           statuses, liked, userRx, reactions,
//                                           team, mine) — NO up/down/myVote/side
//   GET/POST /api/posts/:id/debate/args   → side-gated argument thread
//   POST /api/debate/args/:id/vote        → up/down/myVote (debate only)
//   PATCH  /api/debate/args/:id           → author-only edit + side change
//   DELETE /api/debate/args/:id           → author/admin remove, replies cascade
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4332';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');
const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}
async function startMongo() {
  return MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
}

async function main() {
  const mongod = await startMongo();
  process.env.MONGO_URI = mongod.getUri('droboard_cdae');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  const origin = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 200; i++) {
    try { const p = await fetch(origin + '/health'); if (p.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Post, Comment, Status } = require('../src/models/social.model');
  const jwt = require('jsonwebtoken');

  const stamp = Date.now();
  const tok = (u, roles) => jwt.sign({ sub: u.id, roles: roles || ['reader'] }, process.env.JWT_ACCESS_SECRET);
  const hdrs = (u, roles) => Object.assign({ Authorization: 'Bearer ' + tok(u, roles) });
  const api = (path, opts = {}) => fetch(origin + path, Object.assign({ credentials: 'include' }, opts))
    .then(async r => ({ status: r.status, json: await r.json().catch(() => null) }));
  const asGet = (u, roles) => ({ headers: hdrs(u, roles) });
  const asPost = (u, body, roles) => ({
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, hdrs(u, roles)),
    body: JSON.stringify(body),
  });
  const asPatch = (u, body, roles) => ({
    method: 'PATCH',
    headers: Object.assign({ 'Content-Type': 'application/json' }, hdrs(u, roles)),
    body: JSON.stringify(body),
  });
  const asDel = (u, roles) => ({ method: 'DELETE', headers: hdrs(u, roles) });

  /* ═══ SEED ═══ */
  const author = await User.create({
    id: 'usr_cd_author_' + stamp, username: 'ada_writes', fullName: 'Ada Writes',
    email: 'ada+' + stamp + '@e.test', password: 'Aa1!' + stamp, roles: ['reader'],
    avatar: 'https://i.pravatar.cc/100?img=32', emailVerified: true, status: 'active',
  });
  const reader = await User.create({
    id: 'usr_cd_reader_' + stamp, username: 'rita_reads', fullName: 'Rita Reads',
    email: 'rita+' + stamp + '@e.test', password: 'Aa1!' + stamp, roles: ['reader'],
    avatar: '', emailVerified: false, status: 'active',
  });
  const admin = await User.create({
    id: 'usr_cd_admin_' + stamp, username: 'admin_user', fullName: 'Admin',
    email: 'adm+' + stamp + '@e.test', password: 'Aa1!' + stamp, roles: ['admin'],
    emailVerified: true, status: 'active',
  });
  const other = await User.create({
    id: 'usr_cd_other_' + stamp, username: 'other_dude', fullName: 'Other Dude',
    email: 'oth+' + stamp + '@e.test', password: 'Aa1!' + stamp, roles: ['reader'],
    emailVerified: false, status: 'active',
  });

  // Live status for the author — powers the ring + tap-through reel.
  await Status.create({
    userId: author.id, bg: 'https://i.example.com/live.jpg', quote: 'Ch.6 tonight',
    caption: 'Ada', expiresAt: new Date(Date.now() + 24 * 3600 * 1000), isLive: true,
  });

  const debatePost = await Post.create({
    authorId: author.id, type: 'debate', text: 'Villains?',
    debateData: {
      motion: 'Should villains get redemption?', question: 'Should villains get redemption?',
      prompt: 'Yes or no', forText: 'Yes', againstText: 'No',
      forV: 0, agV: 0, votes: [],
    },
  });

  /* ═══ 1. CREATE STORY COMMENT (author side) ═══ */
  const cRes = await api('/api/comments', asPost(author, {
    scope: 'story', storyId: 'bk_x_' + stamp, chapterId: 'ch_1', text: 'First read!', team: 'a',
  }));
  check('POST /api/comments returns 201', cRes.status === 201, cRes.status);
  const card = cRes.json || {};
  check('card flattens reader fields the comment-section.js DOM reads',
    ['id', 'name', 'handle', 'avatar', 'verified', 'wid', 'time', 'text', 'likes', 'liked',
      'reactions', 'team', 'statusRing', 'statuses', 'repliesCount', 'mine'].every(k => card[k] !== undefined),
    Object.keys(card));
  check('reader card is authored as the actor (mine=true)', card.mine === true, card.mine);
  check('reactions object exposes the 8 rids + userRx', (() => {
    const rx = card.reactions || {};
    return ['fire','cry','broken','shock','mindblown','emo','sus','clap','userRx'].every(k => rx[k] !== undefined);
  })(), card.reactions);
  check('statusRing is "has" while a live Status row exists', card.statusRing === 'has' && (card.statuses || []).length >= 1,
    { ring: card.statusRing, count: (card.statuses || []).length });
  check('time is a relative label, not ISO', typeof card.time === 'string' && card.time.indexOf('just now') >= 0, card.time);

  /* ═══ 2. LIST (anonymous) — liked/userRx default falsey, mine=false ═══ */
  const listAnon = await api('/api/comments?scope=story&storyId=' + encodeURIComponent('bk_x_' + stamp));
  const anonCard = listAnon.json.items[0];
  check('anonymous GET /api/comments returns list + total',
    listAnon.status === 200 && Array.isArray(listAnon.json.items) && listAnon.json.total >= 1,
    { status: listAnon.status, total: listAnon.json.total });
  check('anonymous sees liked=false, userRx=null, mine=false',
    anonCard.liked === false && anonCard.reactions.userRx === null && anonCard.mine === false,
    { liked: anonCard.liked, userRx: anonCard.reactions.userRx, mine: anonCard.mine });

  /* ═══ 3. READER LIKES + REACTS — viewer-scoped liked + userRx ═══ */
  const like = await api('/api/comments/' + card.id + '/like', asPost(reader, {}));
  check('POST /:id/like returns liked=true + count',
    like.status === 200 && like.json.liked === true && like.json.likes === 1, like.json);
  const rx = await api('/api/comments/' + card.id + '/react', asPost(reader, { rid: 'cry' }));
  check('POST /:id/react projects the rid + userRx',
    rx.status === 200 && rx.json.counts.cry === 1 && rx.json.userRx === 'cry', rx.json);
  const listReader = await api('/api/comments?scope=story&storyId=' + encodeURIComponent('bk_x_' + stamp), asGet(reader));
  const readerCard = listReader.json.items[0];
  check('reader-side list shows liked=true + reactions.userRx="cry"',
    readerCard.liked === true && readerCard.reactions.userRx === 'cry' && readerCard.reactions.cry === 1,
    { liked: readerCard.liked, userRx: readerCard.reactions.userRx });

  /* ═══ 4. COMMENTS HAVE NO VOTE AFFORDANCE (only debate args do) ═══ */
  // The reader/story/discussion comment card renders likes + reactions + team
  // only — no up/down/side/myVote — so the backend must not carry those fields.
  check('comment card exposes no side/up/down/myVote',
    !('side' in card) && !('up' in card) && !('down' in card) && !('myVote' in card),
    Object.keys(card));
  const goneVote = await api('/api/comments/' + card.id + '/vote', asPost(reader, { vote: 1 }));
  check('POST /api/comments/:id/vote is not routed (404)', goneVote.status === 404, goneVote.status);

  /* ═══ 5. REPLY + nested replies on GET list ═══ */
  const reply = await api('/api/comments', asPost(other, {
    scope: 'story', storyId: 'bk_x_' + stamp, chapterId: 'ch_1', parentId: card.id, text: 'Agreed',
  }));
  check('reply create returns 201 with parentId',
    reply.status === 201 && reply.json.parentId === card.id, reply.json && reply.json.parentId);
  const withReplies = await api('/api/comments?scope=story&storyId=' + encodeURIComponent('bk_x_' + stamp), asGet(author));
  const parentRow = withReplies.json.items.find(r => r.id === card.id);
  check('list nests replies[] under the parent card',
    parentRow && Array.isArray(parentRow.replies) && parentRow.replies.length === 1 && parentRow.replies[0].name === 'other_dude',
    parentRow && { count: (parentRow.replies || []).length, first: parentRow.replies && parentRow.replies[0] && parentRow.replies[0].name });

  /* ═══ 6. EDIT + DELETE (ownership) ═══ */
  const edit = await api('/api/comments/' + card.id, asPatch(reader, { text: 'not mine' }));
  check('non-author PATCH /api/comments/:id -> 403', edit.status === 403, edit.status);
  const own = await api('/api/comments/' + card.id, asPatch(author, { text: 'First read! (edited)' }));
  check('author PATCH returns edited=true + new text',
    own.status === 200 && own.json.edited === true && own.json.text === 'First read! (edited)', own.json && own.json.edited);
  const delByNon = await api('/api/comments/' + card.id, asDel(other));
  check('non-author DELETE -> 403', delByNon.status === 403, delByNon.status);

  /* ═══ 7. DEBATE ARGS: side gate + vote + reply ═══ */
  const argEarly = await api('/api/posts/' + debatePost.id + '/debate/args', asPost(reader, { text: 'I have no side', side: 'for' }));
  check('posting arg without voting on Post.debateData -> 403 pick_side_first',
    argEarly.status === 403, argEarly.status + ' ' + JSON.stringify(argEarly.json));
  await api('/api/posts/' + debatePost.id + '/debate/vote', asPost(reader, { side: 'for' }));
  const argA = await api('/api/posts/' + debatePost.id + '/debate/args', asPost(reader, { text: 'Redemption is core to fiction.', side: 'for' }));
  check('POST /api/posts/:id/debate/args -> 201 with side="for"',
    argA.status === 201 && argA.json && argA.json.side === 'for', argA.status + ' ' + JSON.stringify(argA.json).slice(0, 220));
  const argFields = ['id','name','avatar','verified','wid','side','text','time','up','down','myVote','statusRing','statuses','repliesCount','mine','postId'];
  check('arg card exposes every field debate-args.js renders',
    argFields.every(k => argA.json[k] !== undefined), Object.keys(argA.json));
  const argMismatch = await api('/api/posts/' + debatePost.id + '/debate/args', asPost(reader, { text: 'Wrong side', side: 'against' }));
  check('arg side != vote side -> 403 side_mismatch', argMismatch.status === 403, argMismatch.json);
  await api('/api/posts/' + debatePost.id + '/debate/vote', asPost(author, { side: 'against' }));
  const argB = await api('/api/posts/' + debatePost.id + '/debate/args', asPost(author, { text: 'Some lines stay crossed.', side: 'against' }));
  check('author picks against, then posts against arg',
    argB.status === 201 && argB.json.side === 'against', argB.json && argB.json.side);

  const listArgs = await api('/api/posts/' + debatePost.id + '/debate/args', asGet(reader));
  check('GET /debate/args returns both top-level args with myVote visible to voter',
    listArgs.status === 200 && listArgs.json.items.length === 2, listArgs.json && listArgs.json.total);
  const readerArg = listArgs.json.items.find(a => a.name === 'rita_reads');
  const otherArg = listArgs.json.items.find(a => a.name === 'ada_writes');
  check('per-viewer myVote defaults to null when reader has not voted on the arg',
    readerArg && readerArg.myVote === null && readerArg.up === 0 && readerArg.down === 0,
    readerArg && { myVote: readerArg.myVote, up: readerArg.up, down: readerArg.down });

  const av1 = await api('/api/debate/args/' + otherArg.id + '/vote', asPost(reader, { vote: 1 }));
  check('POST /api/debate/args/:id/vote up -> up=1, myVote=+1 for the voter',
    av1.status === 200 && av1.json.up === 1 && av1.json.myVote === 1, av1.json && { up: av1.json.up, myVote: av1.json.myVote });
  const av2 = await api('/api/debate/args/' + otherArg.id + '/vote', asPost(author, { vote: 1 }));
  check('second user up-vote stacks (up=2) without touching myVote of the first',
    av2.status === 200 && av2.json.up === 2, av2.json && { up: av2.json.up });
  const av3 = await api('/api/debate/args/' + otherArg.id + '/vote', asPost(reader, { vote: 'down' }));
  check('flip up->down decrements up, increments down, myVote=-1',
    av3.status === 200 && av3.json.up === 1 && av3.json.down === 1 && av3.json.myVote === -1,
    av3.json && { up: av3.json.up, down: av3.json.down, myVote: av3.json.myVote });
  const av4 = await api('/api/debate/args/' + otherArg.id + '/vote', asPost(reader, { vote: null }));
  check('retract via vote=null zeroes the voter contribution',
    av4.status === 200 && av4.json.up === 1 && av4.json.down === 0 && av4.json.myVote === null,
    av4.json && { up: av4.json.up, down: av4.json.down, myVote: av4.json.myVote });

  /* Reply inherits parent side */
  const argReply = await api('/api/posts/' + debatePost.id + '/debate/args', asPost(reader, {
    text: 'Exactly.', parentId: readerArg.id,
  }));
  check('arg reply inherits parent side and returns parentId',
    argReply.status === 201 && argReply.json.side === 'for' && argReply.json.parentId === readerArg.id,
    argReply.json && { side: argReply.json.side, parentId: argReply.json.parentId });
  const listWithReply = await api('/api/posts/' + debatePost.id + '/debate/args', asGet(reader));
  const parentArg = listWithReply.json.items.find(a => a.id === readerArg.id);
  check('arg list nests replies[] under the parent',
    parentArg && Array.isArray(parentArg.replies) && parentArg.replies.length === 1 && parentArg.replies[0].text === 'Exactly.',
    parentArg && { count: (parentArg.replies || []).length });

  /* Edit + delete authority */
  const editOther = await api('/api/debate/args/' + readerArg.id, asPatch(author, { text: 'hijack' }));
  check('non-author PATCH /api/debate/args/:id -> 403', editOther.status === 403, editOther.status);
  const ownEdit = await api('/api/debate/args/' + readerArg.id, asPatch(reader, { text: 'Redemption is core to fiction (edited).' }));
  check('author PATCH returns edited=true + new text',
    ownEdit.status === 200 && ownEdit.json.edited === true, ownEdit.json && ownEdit.json.edited);
  const delArgByNon = await api('/api/debate/args/' + readerArg.id, asDel(other));
  check('non-author DELETE /api/debate/args/:id -> 403', delArgByNon.status === 403, delArgByNon.status);
  const adminDel = await api('/api/debate/args/' + readerArg.id, asDel(admin, ['admin']));
  check('admin DELETE removes the arg + cascades the reply',
    adminDel.status === 200 && adminDel.json.ok === true && adminDel.json.removed === 2, adminDel.json);
  const afterDel = await api('/api/posts/' + debatePost.id + '/debate/args', asGet(reader));
  check('parent + reply gone; only the author arg remains',
    afterDel.status === 200 && afterDel.json.items.length === 1 && afterDel.json.items[0].id === otherArg.id,
    afterDel.json && afterDel.json.items.map(i => i.id));

  /* Filter by side + sort */
  const filtered = await api('/api/posts/' + debatePost.id + '/debate/args?side=against', asGet(reader));
  check('?side=against filters the thread to the opposing rows',
    filtered.status === 200 && filtered.json.items.every(a => a.side === 'against'),
    filtered.json && filtered.json.items.length);

  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + total + ' comment + debate-arg live assertions passed');
  process.exit(passed === total ? 0 : 1);
}

main().catch(e => { console.error('harness crashed:', e); process.exit(2); });
