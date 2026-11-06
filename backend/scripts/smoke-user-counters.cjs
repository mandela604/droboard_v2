'use strict';
// Live counter test for the denormalized User activity counts (followerCount,
// followingCount, postCount, commentCount).
//
// It boots the real Express app on an in-memory MongoDB, drives real HTTP writes
// (follow, duplicate follow, unfollow, no-op unfollow, block, post, comment,
// reply, delete comment, delete post, account deactivation) and after each one
// asserts the stored counter. Every counter must agree with a direct count over
// the Follow/Post/Comment collections — that is the whole contract of
// denormalization, and it is what a stale cache breaks.
//
// The bug this locks out: follows, posts and comments were counted by
// aggregating three collections on every profile and console render, and any
// write that removed rows (block, post delete cascading its comments, a reply
// removed with its parent) had no counter to update at all.
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime (mongod.exe aborts
// 0xC0000135 without it). See scripts/smoke-superadmin-coins.cjs.
process.env.NODE_ENV = 'test';
process.env.PORT = '4194';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 4194;
const BASE = 'http://127.0.0.1:' + PORT;
const SA = '/api/super-admin';
const OUT = require('path').join(__dirname, 'smoke-user-counters.results.txt');

const results = [];
const logLines = [];
function say(s) { logLines.push(s); console.log(s); }
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
  say(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}
function finish() {
  const passed = results.filter(x => x.pass).length;
  say(`\n===== ${passed}/${results.length} live counter assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => say(`  FAIL ${f.name} :: ${f.detail}`));
  try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (e) { /* stdout already has it */ }
  // server.js holds the listen socket open: exit hard or the port squats.
  process.exit(passed === results.length ? 0 : 1);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_counters');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  // Boot is async (the role seed runs before listen), so a fixed sleep loses
  // the race on a cold box.
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Follow, Post, Comment } = require('../src/models/social.model');
  const { signAccess } = require('../src/middleware/auth');

  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const mk = async (name, extra) => User.create(Object.assign({
    fullName: name, email: `${name}@t.co`, username: name + Date.now() + Math.random(),
    passwordHash: DUMMY, status: 'active', roles: ['reader'],
  }, extra || {}));

  const alice = await mk('alice');
  const bob = await mk('bob');
  const carol = await mk('carol');
  const admin = await mk('admin', { roles: ['admin'] });
  // No passwordHash: deleteMe skips argon2 verification (which OOMs this box).
  const dave = await User.create({
    fullName: 'dave', email: 'dave@t.co', username: 'dave' + Date.now() + Math.random(),
    passwordHash: null, authProvider: 'google', status: 'active', roles: ['reader'],
  });

  const tok = (u) => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + signAccess(u) });
  async function call(u, method, path, body) {
    const init = { method, headers: tok(u) };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(BASE + path, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  /* The four counters, straight off the User row. */
  async function stored(u) {
    const row = await User.findOne({ id: String(u.id) })
      .select('followerCount followingCount postCount commentCount').lean();
    return { f: row.followerCount, g: row.followingCount, p: row.postCount, m: row.commentCount };
  }
  /* Ground truth: what the collections actually hold. The cache must match it. */
  async function truth(u) {
    const id = String(u.id);
    const [f, g, p, m] = await Promise.all([
      Follow.countDocuments({ followingId: id }),
      Follow.countDocuments({ followerId: id }),
      Post.countDocuments({ authorId: id }),
      Comment.countDocuments({ authorId: id }),
    ]);
    return { f, g, p, m };
  }
  const eq = (a, b) => a.f === b.f && a.g === b.g && a.p === b.p && a.m === b.m;

  async function agree(label, users) {
    const bad = [];
    for (const u of users) {
      const [s, t] = await Promise.all([stored(u), truth(u)]);
      if (!eq(s, t)) bad.push(`${u.fullName} stored=${JSON.stringify(s)} truth=${JSON.stringify(t)}`);
    }
    check(label, bad.length === 0, bad.length ? bad.join(' | ') : 'cache matches collections');
  }

  await agree('every counter starts at zero and matches an empty graph', [alice, bob, carol, dave]);

  /* ── 1. follow ── */
  let r = await call(alice, 'POST', `/api/users/${bob.username}/follow`);
  check('POST /users/:handle/follow -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  let s = await stored(bob);
  check('target gains one follower', s.f === 1, `bob.followerCount=${s.f}`);
  s = await stored(alice);
  check('follower gains one following', s.g === 1, `alice.followingCount=${s.g}`);

  // A second follow of the same person must not count twice. The unique index
  // is what normally rejects it — assert the edge row itself, because an
  // in-flight index build would let a second row in and inflate the counter.
  r = await call(alice, 'POST', `/api/users/${bob.username}/follow`);
  const dupEdges = await Follow.countDocuments({ followerId: String(alice.id), followingId: String(bob.id) });
  check('repeat follow is accepted', r.status === 200, `status=${r.status}`);
  check('repeat follow stored exactly one edge', dupEdges === 1, `edges=${dupEdges}`);
  s = await stored(bob);
  check('repeat follow left bob at one follower', s.f === 1, `bob.followerCount=${s.f}`);
  s = await stored(alice);
  check('repeat follow left alice at one following', s.g === 1, `alice.followingCount=${s.g}`);

  /* ── 2. a reverse edge, so unfollow cannot look symmetric ── */
  await call(bob, 'POST', `/api/users/${alice.username}/follow`);
  await agree('after bob follows alice both sides moved', [alice, bob]);

  /* ── 3. reads come from the counters ── */
  // The profile payload's top-level `following` is the Following-tab rows; the
  // numbers live under stats.
  r = await call(alice, 'GET', `/api/users/${bob.username}`);
  check('profile stats reports the stored counters',
    !!r.json && !!r.json.stats && r.json.stats.followers === 1 && r.json.stats.following === 1,
    JSON.stringify(r.json && r.json.stats));
  r = await call(alice, 'GET', `/api/users/${alice.username}/followers`);
  check('GET /users/:handle/followers total = followerCount',
    r.json && r.json.total === 1, `total=${r.json && r.json.total}`);
  r = await call(alice, 'GET', `/api/users/${alice.username}/following`);
  check('GET /users/:handle/following total = followingCount',
    r.json && r.json.total === 1, `total=${r.json && r.json.total}`);
  r = await call(alice, 'GET', '/api/users/me');
  check('GET /users/me reports the same two numbers',
    r.json && r.json.following === 1 && r.json.followers === 1,
    JSON.stringify(r.json && { following: r.json.following, followers: r.json.followers }));

  /* ── 4. post + comment + reply ── */
  r = await call(alice, 'POST', '/api/posts', { type: 'post', text: 'Counted post' });
  check('POST /api/posts -> 201', r.status === 201, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  const postId = r.json && r.json.id;
  s = await stored(alice);
  check('author gains a post', s.p === 1, `alice.postCount=${s.p}`);

  r = await call(bob, 'POST', '/api/comments', { scope: 'post', postId: String(postId), text: 'Counted comment' });
  check('POST /api/comments -> 201', r.status === 201, `status=${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  const commentId = r.json && r.json.id;
  s = await stored(bob);
  check('commenter gains a comment', s.m === 1, `bob.commentCount=${s.m}`);

  r = await call(bob, 'POST', '/api/comments', { scope: 'post', postId: String(postId), parentId: String(commentId), text: 'Counted reply' });
  const replyId = r.json && r.json.id;
  s = await stored(bob);
  check('a reply counts as a comment too', r.status === 201 && s.m === 2, `bob.commentCount=${s.m}`);
  await agree('posts and comments match their collections', [alice, bob]);

  /* ── 5. the console reads the same source ── */
  r = await call(admin, 'GET', `${SA}/users?q=alice&limit=10`);
  const aRow = ((r.json || {}).items || []).find(x => x.id === String(alice.id));
  check('console users row carries the counters',
    !!aRow && aRow.followers === 1 && aRow.following === 1 && aRow.posts === 1 && aRow.comments === 0,
    JSON.stringify(aRow && { f: aRow.followers, g: aRow.following, p: aRow.posts, m: aRow.comments }));
  check('console stats object exposes the same four',
    !!aRow && !!aRow.stats && aRow.stats.posts === 1 && aRow.stats.followers === 1,
    JSON.stringify(aRow && aRow.stats));
  r = await call(admin, 'GET', `${SA}/users/${bob.id}`);
  check('console user detail reports bob two comments',
    r.json && r.json.comments === 2, `comments=${r.json && r.json.comments}`);

  /* ── 6. delete a reply, then the post that carries the other comment ── */
  r = await call(bob, 'DELETE', `/api/comments/${replyId}`);
  check('DELETE /api/comments/:id -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  s = await stored(bob);
  check('deleted reply releases its count', s.m === 1, `bob.commentCount=${s.m}`);

  // Deleting a post takes its comments with it — every comment author must
  // release those counts even though only the post author asked for the delete.
  r = await call(alice, 'DELETE', `/api/posts/${postId}`);
  check('DELETE /api/posts/:id -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  s = await stored(alice);
  check('post author releases the post', s.p === 0, `alice.postCount=${s.p}`);
  s = await stored(bob);
  check('cascade deletes release the comment author too', s.m === 0, `bob.commentCount=${s.m}`);
  await agree('after the cascading delete everything still matches', [alice, bob, carol]);

  /* ── 7. unfollow, then an unfollow with nothing to remove ── */
  r = await call(alice, 'DELETE', `/api/users/${bob.username}/follow`);
  check('DELETE /users/:handle/follow -> 200', r.status === 200, `status=${r.status}`);
  await agree('unfollow released exactly one edge', [alice, bob]);

  r = await call(alice, 'DELETE', `/api/users/${bob.username}/follow`);
  check('repeat unfollow is accepted', r.status === 200, `status=${r.status}`);
  await agree('repeat unfollow did not underflow', [alice, bob]);
  s = await stored(alice);
  check('no counter went negative', s.g >= 0 && s.f >= 0 && s.p >= 0 && s.m >= 0, JSON.stringify(s));

  /* ── 8. blocking tears down both directions at once ── */
  await call(carol, 'POST', `/api/users/${bob.username}/follow`);
  await call(bob, 'POST', `/api/users/${carol.username}/follow`);
  await agree('carol and bob follow each other', [bob, carol]);
  r = await call(carol, 'POST', `/api/users/${bob.username}/block`);
  check('POST /users/:handle/block -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  await agree('block removed both edges and both counts', [bob, carol]);

  /* ── 9. deactivating an account severs every edge it touched ── */
  r = await call(dave, 'POST', `/api/users/${bob.username}/follow`);
  check('dave follows bob', r.status === 200, `status=${r.status}`);
  r = await call(dave, 'DELETE', '/api/users/me', {});
  check('DELETE /users/me -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  s = await stored(bob);
  // carol's edge went when she blocked bob and alice's went on unfollow, so
  // dave was bob's only remaining follower.
  check('bob loses the deactivated follower', s.f === 0, `bob.followerCount=${s.f}`);
  s = await stored(dave);
  check('the deactivated user reads zeros', s.f === 0 && s.g === 0, JSON.stringify(s));

  /* ── 10. final reconciliation across every actor ── */
  await agree('every counter matches its collection after all writes', [alice, bob, carol, dave, admin]);

  const edges = await Follow.countDocuments();
  const posts = await Post.countDocuments();
  const comments = await Comment.countDocuments();
  const sum = async (field) => (await User.aggregate([{ $group: { _id: null, n: { $sum: '$' + field } } }]))[0];
  const followerSum = await sum('followerCount');
  const followingSum = await sum('followingCount');
  const postSum = await sum('postCount');
  const commentSum = await sum('commentCount');
  check('followerCount sums to the edge count', followerSum && followerSum.n === edges,
    `sum=${followerSum && followerSum.n} edges=${edges}`);
  check('followingCount sums to the same edge count', followingSum && followingSum.n === edges,
    `sum=${followingSum && followingSum.n} edges=${edges}`);
  check('postCount sums to the surviving posts', postSum && postSum.n === posts,
    `sum=${postSum && postSum.n} posts=${posts}`);
  check('commentCount sums to the surviving comments', commentSum && commentSum.n === comments,
    `sum=${commentSum && commentSum.n} comments=${comments}`);

  finish();
}
main().catch(e => { say('FATAL ' + (e && e.stack || e)); try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (x) {} process.exit(1); });
