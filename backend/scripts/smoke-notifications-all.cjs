'use strict';
// End-to-end coverage of the notification call sites added for the "notify me
// about everything" work. Boots the real app on in-memory Mongo, drives the
// real services and asserts a row lands in the ACTUAL recipient's inbox.
process.env.NODE_ENV = 'test';
process.env.PORT = '4198';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const PORT = 4198;
const OUT = path.join(__dirname, 'smoke-notifications-all.results.txt');
const results = [];
const lines = [];
function say(s) { lines.push(s); console.log(s); }
function check(name, pass, detail) {
  results.push({ name, pass });
  say(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ::  ' + String(detail).slice(0, 200) : ''}`);
}
function finish() {
  const passed = results.filter(x => x.pass).length;
  say(`\n===== ${passed}/${results.length} notification coverage assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => say('  FAIL ' + f.name));
  try { fs.writeFileSync(OUT, lines.join('\n') + '\n'); } catch (e) {}
  process.exit(passed === results.length ? 0 : 1);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_notif_all');
  require('../src/server');
  for (let i = 0; i < 160; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Book, Chapter } = require('../src/models/content.model');
  const { Post, Comment, Discussion, Status, Notification, DebateArg, Reaction } = require('../src/models/social.model');
  const { LeagueActivity } = require('../src/models/marketing.model');
  const { EditorAssignment } = require('../src/models/chief.model');
  const posts = require('../src/services/posts.service');
  const comments = require('../src/services/comments.service');
  const engagement = require('../src/services/engagement.service');
  const ratings = require('../src/services/ratings.service');
  const discussions = require('../src/services/discussions.service');
  const debateArgs = require('../src/services/debate-args.service');
  const statuses = require('../src/services/statuses.service');
  const marketing = require('../src/services/marketing-surfaces.service');
  const referrals = require('../src/services/referrals.service');
  const notifications = require('../src/services/notifications.service');

  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  let n = 0;
  const mk = async (label, roles) => User.create({
    fullName: label, email: `${label}${++n}@t.co`, username: label + Date.now() + n,
    passwordHash: DUMMY, status: 'active', roles: roles || ['reader'],
  });
  const author = await mk('author', ['writer']);
  const reader = await mk('reader');
  const other = await mk('other');
  const editor = await mk('editor', ['senior_editor']);
  const aid = String(author.id), rid = String(reader.id), oid = String(other.id);
  const has = async (who, type, key) => {
    const q = { recipientId: String(who.id), type };
    if (key) q.key = key;
    return !!(await Notification.findOne(q).lean());
  };

  // 1. Post reaction → author
  const post = await Post.create({ authorId: aid, type: 'post', text: 'A post' });
  await posts.reactToPost({ post, userId: rid, rid: 'love' });
  check('post reaction notifies author', await has(author, 'like', 'like:' + rid + ':' + post.id));

  // 2. Post like (plain) → author
  const post2 = await Post.create({ authorId: aid, type: 'post', text: 'Another' });
  await posts.toggleLike({ post: post2, userId: rid });
  check('post like notifies author', await has(author, 'like', 'like:' + rid + ':' + post2.id));

  // 3. Post share → author
  await posts.sharePost({ post: post2, channel: 'whatsapp', userId: rid });
  check('post share notifies author', await has(author, 'share', 'share:' + post2.id + ':whatsapp'));

  // 4. Comment on post → author; reply → parent author
  const c1 = await comments.createComment({ authorId: rid, data: { scope: 'post', postId: post.id, text: 'Nice one' } });
  check('comment on post notifies author', await has(author, 'comment', 'comment:' + rid + ':' + c1.id));
  const c2 = await comments.createComment({ authorId: oid, data: { scope: 'post', postId: post.id, parentId: c1.id, text: 'Agreed' } });
  check('reply notifies parent comment author', await has(reader, 'reply', 'reply:' + oid + ':' + c2.id));

  // 5. Comment on a debate post → author (the "commented on your debate" case)
  const debate = await Post.create({ authorId: aid, type: 'debate', debateData: { motion: 'Is this good?', votes: [] } });
  const dc = await comments.createComment({ authorId: rid, data: { scope: 'post', postId: debate.id, text: 'Yes' } });
  check('comment on debate notifies author', await has(author, 'comment', 'comment:' + rid + ':' + dc.id));

  // 6. Discussion thread comment + reaction → thread author
  const { Category, Genre, CategoryMembership } = require('../src/models/content.model');
  const cat = await Category.create({ name: 'Board', slug: 'board-' + Date.now() });
  const gen = await Genre.create({ name: 'Genre', slug: 'genre-' + Date.now(), categoryId: String(cat.id) });
  await CategoryMembership.create({ userId: rid, categoryId: String(cat.id) });
  await CategoryMembership.create({ userId: oid, categoryId: String(cat.id) });
  const thread = await Discussion.create({ genreId: gen.id, authorId: aid, title: 'A debate thread', body: '' });
  const discC = await comments.createComment({ authorId: rid, user: { id: rid, roles: [] }, data: { scope: 'discussion', discussionId: thread.id, text: 'My take' } });
  check('comment on discussion notifies thread author', await has(author, 'comment', 'comment:' + rid + ':' + discC.id));
  await discussions.reactToDiscussion({ id: thread.id, userId: rid, rid: 'love' });
  check('reaction on discussion notifies thread author', await has(author, 'like', 'discussion-react:' + rid + ':' + thread.id));

  // 7. Debate argument → post author; argument vote → argument author
  await Post.updateOne({ id: debate.id }, { $set: { 'debateData.votes': [{ user: rid, side: 'for' }] } });
  const freshDebate = await Post.findOne({ id: debate.id }).lean();
  const arg = await debateArgs.createArg({ postId: debate.id, userId: rid, text: 'For, because reasons', side: 'for' });
  check('debate argument notifies debate author', await has(author, 'debate_reply', 'debate-reply:' + rid + ':' + arg.id));
  await debateArgs.voteArg({ id: arg.id, userId: oid, vote: 'up' });
  check('argument upvote notifies argument author', await has(reader, 'arg_vote', 'arg-vote:' + oid + ':' + arg.id));

  // 8. Story + chapter reactions and story share → book author
  const book = await Book.create({ title: 'A Story', authorId: aid, status: 'published', reactions: {}, sharesByChannel: {} });
  const ch = await Chapter.create({ bookId: book.id, n: 1, title: 'One', status: 'live', reactions: {} });
  await engagement.reactStory({ bookId: book.id, userId: rid, rid: 'love' });
  check('story reaction notifies author', await has(author, 'like', 'story-react:' + rid + ':' + book.id));
  await engagement.reactChapter({ bookId: book.id, key: String(ch.n), userId: oid, rid: 'love' });
  check('chapter reaction notifies author', await has(author, 'like', 'chapter-react:' + oid + ':' + ch.id));
  await engagement.shareStory({ bookId: book.id, userId: rid, channel: 'twitter' });
  check('story share notifies author', await has(author, 'share', 'story-share:' + book.id + ':twitter'));

  // 9. Rating a book → author
  const { ReadingProgress } = require('../src/models/social.model');
  for (let i = 2; i <= 3; i++) {
    const extraCh = await Chapter.create({ bookId: book.id, n: i, title: 'Ch ' + i, status: 'live', reactions: {} });
    await ReadingProgress.create({ userId: rid, storyId: book.id, chapterId: extraCh.id, pct: 100, finished: true });
  }
  await ReadingProgress.create({ userId: rid, storyId: book.id, chapterId: ch.id, pct: 100, finished: true });
  await ratings.submitRating(book.id, rid, { stars: 5, text: 'Loved it' });
  check('book rating notifies author', await has(author, 'rating', 'rating:' + rid + ':' + book.id));

  // 10. Status like + expiry digest → owner
  const status = await Status.create({ userId: aid, bg: 'linear-gradient(135deg,#000,#111)', expiresAt: new Date(Date.now() - 3 * 60000), viewerRecords: [{ user: rid, at: new Date() }], viewedBy: [rid], likes: 2 });
  await statuses.toggleLike({ status, userId: rid });
  check('status like notifies owner', await has(author, 'like', 'status-like:' + rid + ':' + status.id));
  await statuses.expireStatusSummaries();
  const digest = await Notification.findOne({ recipientId: aid, type: 'status_expired', key: 'status-expired:' + status.id }).lean();
  check('expired status sends a views + reactions digest', !!digest && Array.isArray(digest.payload.metrics) && digest.payload.metrics.length === 2, JSON.stringify(digest && digest.payload.metrics));
  const before = await Notification.countDocuments({ recipientId: aid, type: 'status_expired' });
  await statuses.expireStatusSummaries();
  check('expiry digest is idempotent', (await Notification.countDocuments({ recipientId: aid, type: 'status_expired' })) === before);

  // 11. Editor invite signup → inviter
  editor.editorInviteCode = 'SE-TEST123';
  await editor.save();
  const invitee = await mk('invitee');
  await referrals.applyEditorInvite(invitee, 'SE-TEST123');
  check('editor invite signup notifies inviter', await has(editor, 'referral_joined', 'referral:' + String(invitee.id)));
  check('editor invite assigns the new author', !!(await EditorAssignment.findOne({ editorId: String(editor.id), authorIds: String(invitee.id) }).lean()));

  // 12. League rollover → every ranked reader gets their position
  const season = marketing.seasonId(new Date(Date.now() - 8 * 864e5));
  await LeagueActivity.create({ userId: rid, season, action: 'chapter', n: 5, points: 50 });
  await marketing.awardLeagueBadges({ season });
  check('league rollover notifies final position', await has(reader, 'league_finish', 'league-finish:' + rid + ':' + season));

  // 14. Editorial decisions → the author hears every outcome
  const senior = require('../src/services/senior.service');
  const seniorCtrl = require('../src/controllers/senior.controller');
  const flag = require('../src/services/book-flag.service');
  const { AuthorVerification, BookEdit } = require('../src/models/application.model');
  const fakeRes = () => ({ json() { return this; }, status() { return this; } });
  const staff = { id: editor.id, roles: ['chief_editor'] };
  const call = (fn, params, body) => fn({ user: staff, valid: { params, body: body || {}, query: {} } }, fakeRes());

  const verif = await AuthorVerification.create({ userId: aid, name: author.fullName, email: author.email, status: 'pending' });
  await call(seniorCtrl.verificationApprove, { id: verif.id });
  check('verification approval notifies the writer', await has(author, 'verification', 'verification:' + verif.id + ':approved'));

  const reviewBook = await Book.create({ title: 'Review Me', authorId: aid, status: 'under_review', wordCount: 6000 });
  await call(seniorCtrl.reviewDecide, { id: reviewBook.id }, { action: 'rejected', feedback: 'Rewrite the opening.' });
  check('book rejection notifies the author with feedback', await has(author, 'review_result', 'review:' + reviewBook.id + ':rejected'));

  const bookEdit = await BookEdit.create({ bookId: book.id, authorId: aid, proposed: { synopsis: 'New blurb' }, status: 'pending' });
  await senior.rejectBookEdit(bookEdit.id, String(editor.id), 'Not this time', null);
  check('book edit rejection notifies the author', await has(author, 'book_change_result'));

  await EditorAssignment.updateOne({ editorId: String(editor.id) }, { $addToSet: { authorIds: aid } });
  const flagged = await Book.create({ title: 'Flagged Book', authorId: aid, status: 'flagged', flagPrevStatus: 'published' });
  await flag.unflagBook(flagged.id, { user: { id: editor.id, roles: ['senior_editor'] } });
  check('unflagging a book notifies the author', await has(author, 'book_unflagged'));

  // 15. Editor message → author
  const { Conversation, Message } = require('../src/models/social.model');
  const conv = await Conversation.create({ participants: [String(editor.id), aid] });
  await call(seniorCtrl.messageSend, { id: conv.id }, { text: 'Hello writer' });
  check('editor message notifies the author', await has(author, 'direct_message', 'dm:' + String(conv.id)));

  // 16. Channel settings are honored server-side
  const muted = await mk('muted');
  await notifications.saveSettings({ userId: muted.id, body: { all: true, mutedTypes: ['like'], activity: { inapp: false } } });
  const p3 = await Post.create({ authorId: String(muted.id), type: 'post', text: 'Muted' });
  await posts.reactToPost({ post: p3, userId: rid, rid: 'love' });
  check('muted/category-off channels suppress a row', !(await has(muted, 'like')));

  // 14. Catalog parity: every server type has a label and the client mirrors it
  const { TYPES, LINK_LABELS } = require('../src/services/notification-types');
  const missing = Object.keys(TYPES).filter(t => !LINK_LABELS[t]);
  check('every server type has a default link label', missing.length === 0, missing.join(','));
  const store = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'services', 'notification-store.js'), 'utf8');
  const notMirrored = Object.keys(TYPES).filter(t => !new RegExp('\\b' + t + ':').test(store));
  check('client store mirrors every server type', notMirrored.length === 0, notMirrored.join(','));

  finish();
}
main().catch(e => { say('FATAL ' + (e && e.stack || e)); try { fs.writeFileSync(OUT, lines.join('\n') + '\n'); } catch (x) {} process.exit(1); });
