'use strict';
// Live comment/reply/reaction test against production server.
// Tests: post comment, reply to comment, react to comment, verify persistence.

const BASE = 'https://droboard-v2.onrender.com';
const ADMIN_EMAIL = 'qa.admin@droboard.test';
const PW = 'AdminLive1234!';

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const init = { method, headers };
  if (body !== undefined && body !== null) init.body = JSON.stringify(body);
  const res = await fetch(BASE + path, init);
  let json = null; try { json = await res.json(); } catch (e) { json = null; }
  return { status: res.status, json, ok: res.ok };
}
function log(s, m) { console.log(`[${s}] ${m}`); }

async function main() {
  // Wait for server
  for (let i = 0; i < 30; i++) {
    try { const r = await call('GET', '/health'); if (r.ok) break; } catch (e) {}
    log('wait', `Server not ready (${i+1}/30)`); await new Promise(r => setTimeout(r, 2000));
  }

  // Login
  let r = await call('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: PW });
  log('login', `status=${r.status}`);
  if (r.status !== 200) { console.error('Login failed:', JSON.stringify(r.json)); process.exit(1); }
  const token = r.json.access || r.json.token;
  log('ok', 'Logged in as admin');

  // Get the book we published
  r = await call('GET', '/api/books/?limit=10', null, token);
  const books = r.json?.items || [];
  const book = books.find(b => b.title && b.title.includes('Whispering Shadows'));
  if (!book) { console.error('Book not found'); process.exit(1); }
  log('book', `Found: ${book.title} (id: ${book.id}, status: ${book.status})`);

  // Get discussions for this book's genre
  r = await call('GET', '/api/discussions?genre=qa-romance-2179331&limit=10', null, token);
  log('discussions', `status=${r.status}`);
  const discs = r.json?.items || [];
  log('info', `Found ${discs.length} discussions`);

  if (discs.length === 0) {
    // Create a discussion
    r = await call('POST', '/api/discussions', {
      genre: 'qa-romance-2179331',
      title: 'Live comment test ' + Date.now(),
      body: 'Testing comment system on live server.',
      tag: 'discussion'
    }, token);
    log('create-discussion', `status=${r.status}`);
    if (r.status !== 201) { console.error('Failed:', JSON.stringify(r.json)); process.exit(1); }
    const disc = r.json;
    log('ok', `Discussion created: ${disc.id}`);

    // Test comment on the new discussion
    await testComment(disc.id, token);
  } else {
    const disc = discs[0];
    log('info', `Using existing discussion: ${disc.id} (${disc.title})`);
    await testComment(disc.id, token);
  }

  // Also test comment on the book (story scope)
  await testStoryComment(book.id, token);
}

async function testComment(discId, token) {
  log('test', '═══ COMMENT TESTS ═══');

  // 1. Post a comment
  const commentText = 'Live test comment ' + Date.now();
  let r = await call('POST', '/api/comments', {
    scope: 'discussion',
    discussionId: discId,
    text: commentText
  }, token);
  log('post-comment', `status=${r.status}`);
  if (r.status !== 201) { console.error('  FAILED:', JSON.stringify(r.json)); return; }
  const comment = r.json;
  const commentId = comment.id || comment._id;
  log('ok', `Comment posted: ${commentId}`);

  // 2. Verify comment persists (fetch it back)
  r = await call('GET', `/api/comments?scope=discussion&discussionId=${discId}&limit=50`, null, token);
  const comments = r.json?.items || [];
  const found = comments.find(c => (c.id || c._id) === commentId);
  if (found) {
    log('ok', `PASS: Comment persists in database (text: "${found.text?.slice(0, 50)}")`);
  } else {
    log('fail', `FAIL: Comment not found after refetch! Total comments: ${comments.length}`);
  }

  // 3. Reply to the comment
  r = await call('POST', '/api/comments', {
    scope: 'discussion',
    discussionId: discId,
    parentId: commentId,
    text: 'Live test reply ' + Date.now()
  }, token);
  log('post-reply', `status=${r.status}`);
  if (r.status === 201) {
    const reply = r.json;
    log('ok', `Reply posted: ${reply.id || reply._id}`);

    // Verify reply persists
    r = await call('GET', `/api/comments?scope=discussion&discussionId=${discId}&limit=50`, null, token);
    const allComments = r.json?.items || [];
    const parent = allComments.find(c => (c.id || c._id) === commentId);
    if (parent && parent.replies && parent.replies.length > 0) {
      log('ok', 'PASS: Reply persists in database');
    } else {
      // Replies might be fetched separately
      r = await call('GET', `/api/comments/${commentId}/replies`, null, token);
      const replies = r.json?.items || r.json || [];
      if (replies.length > 0) {
        log('ok', 'PASS: Reply persists (via replies endpoint)');
      } else {
        log('fail', 'FAIL: Reply not found after refetch');
      }
    }
  } else {
    log('fail', `Reply failed: ${JSON.stringify(r.json)}`);
  }

  // 4. React to the comment
  const rid = 'love';
  r = await call('POST', `/api/comments/${commentId}/react`, { rid }, token);
  log('react', `status=${r.status}`);
  if (r.status === 200) {
    log('ok', `PASS: Reaction added (${JSON.stringify(r.json).slice(0, 100)})`);

    // Verify reaction persisted
    r = await call('GET', `/api/comments?scope=discussion&discussionId=${discId}&limit=50`, null, token);
    const allComments = r.json?.items || [];
    const found2 = allComments.find(c => (c.id || c._id) === commentId);
    if (found2 && found2.rx) {
      const loveCount = found2.rx.love || found2.rx['love'] || 0;
      const userRx = found2.rx.userRx || found2.userRx;
      log('info', `Reaction state: love=${loveCount}, userRx=${userRx}`);
      if (loveCount > 0 || userRx === 'love') {
        log('ok', 'PASS: Reaction persists in database');
      } else {
        log('fail', 'FAIL: Reaction not found after refetch');
      }
    }
  } else {
    log('fail', `React failed: ${JSON.stringify(r.json)}`);
  }

  // 5. Remove reaction (toggle off)
  r = await call('DELETE', `/api/comments/${commentId}/react`, null, token);
  log('unreact', `status=${r.status}`);
  if (r.status === 200) {
    log('ok', 'PASS: Reaction removed');
  }

  // 6. Check comment count on discussion
  r = await call('GET', `/api/discussions/${discId}`, null, token);
  if (r.json) {
    log('info', `Discussion commentsCount: ${r.json.commentsCount || r.json.comments || 'N/A'}`);
  }

  log('test', '═══ DONE ═══');
}

async function testStoryComment(bookId, token) {
  log('test', '═══ STORY COMMENT TEST ═══');

  const text = 'Story comment test ' + Date.now();
  let r = await call('POST', '/api/comments', {
    scope: 'story',
    storyId: bookId,
    text: text
  }, token);
  log('post-story-comment', `status=${r.status}`);
  if (r.status !== 201) { console.error('  FAILED:', JSON.stringify(r.json)); return; }
  const commentId = r.json.id || r.json._id;
  log('ok', `Story comment posted: ${commentId}`);

  // Verify persistence
  r = await call('GET', `/api/comments?scope=story&storyId=${bookId}&limit=50`, null, token);
  const comments = r.json?.items || [];
  const found = comments.find(c => (c.id || c._id) === commentId);
  if (found) {
    log('ok', 'PASS: Story comment persists in database');
  } else {
    log('fail', `FAIL: Story comment not found! Total: ${comments.length}`);
  }

  // React to story comment
  r = await call('POST', `/api/comments/${commentId}/react`, { rid: 'love' }, token);
  log('react-story-comment', `status=${r.status}`);
  if (r.status === 200) {
    log('ok', 'PASS: Story comment reaction works');
  }

  log('test', '═══ DONE ═══');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });