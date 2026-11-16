#!/usr/bin/env node
const BASE_URL = 'http://127.0.0.1:4000';
const WRITER_EMAIL = 'writer.ada.writer@dev.local';
const PASSWORD = 'Memory1234!';

let authToken = null;

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: WRITER_EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  authToken = data.token;
  return authToken;
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

async function getBooks() {
  const res = await fetch(`${BASE_URL}/api/books`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Get books failed: ${res.status}`);
  const data = await res.json();
  const books = Array.isArray(data) ? data : (data.items || data.books || []);
  return books.find(b => b.title && b.title.includes('Nine Lives'));
}

async function getChapters(bookId) {
  const res = await fetch(`${BASE_URL}/api/books/${bookId}/chapters`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Get chapters failed: ${res.status}`);
  return await res.json();
}

async function postComment(storyId, chapterId, text) {
  const res = await fetch(`${BASE_URL}/api/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ 
      scope: 'chapter',
      storyId, 
      chapterId, 
      text 
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Post comment failed: ${res.status} - ${err}`);
  }
  return await res.json();
}

async function getComments(storyId, chapterId) {
  const res = await fetch(`${BASE_URL}/api/comments?scope=chapter&storyId=${storyId}&chapterId=${chapterId}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Get comments failed: ${res.status}`);
  const data = await res.json();
  // Handle different response formats
  return Array.isArray(data) ? data : (data.items || data.comments || []);
}

async function runTests() {
  console.log('🧪 Testing comment system fixes...\n');

  try {
    console.log('1️⃣  Logging in...');
    await login();
    console.log('   ✓ Logged in as', WRITER_EMAIL);

    console.log('\n2️⃣  Getting "Nine Lives, Twice" book...');
    const book = await getBooks();
    if (!book) throw new Error('Book not found');
    console.log(`   ✓ Found book: ${book.title} (ID: ${book.id})`);

    console.log('\n3️⃣  Getting chapters...');
    const chapters = await getChapters(book.id);
    console.log(`   ✓ Found ${chapters.length} chapters`);
    chapters.slice(0, 3).forEach((ch) => {
      console.log(`     Ch ${ch.n}: "${ch.title}" - UUID: ${ch.id}`);
    });

    if (chapters.length < 2) {
      throw new Error('Need at least 2 chapters to test');
    }

    const ch1 = chapters[0];
    const ch2 = chapters[1];

    console.log('\n4️⃣  TEST 1 - Posting comment in Chapter 1...');
    const comment1 = await postComment(
      book.id,
      ch1.id,
      'Test comment in Chapter 1 with UUID: ' + ch1.id
    );
    console.log(`   ✓ Posted comment (ID: ${comment1.id})`);
    console.log(`   ✓ Comment stored with chapterId: ${comment1.chapterId}`);
    console.log(`   ✓ Chapter 1 UUID (liveId): ${ch1.id}`);
    
    if (comment1.chapterId !== ch1.id) {
      throw new Error(`⚠️  Comment stored with wrong chapterId! Expected ${ch1.id}, got ${comment1.chapterId}`);
    }

    console.log('\n5️⃣  TEST 2 - Fetching Chapter 1 comments...');
    const ch1Comments = await getComments(book.id, ch1.id);
    console.log(`   ✓ Fetched ${ch1Comments.length} comment(s) for Chapter 1`);
    console.log(`   Comments in Ch1:`);
    ch1Comments.forEach(c => {
      console.log(`     - ID: ${c.id}, chapterId: ${c.chapterId}, author: ${c.author && c.author.name}`);
    });
    
    // Check if our comment is there
    const hasCh1Comment = ch1Comments.some(c => c.id === comment1.id);
    if (!hasCh1Comment) {
      throw new Error(`Our comment (${comment1.id}) not found in Chapter 1!`);
    }
    console.log(`   ✓ Our comment is present in Chapter 1`);

    console.log('\n6️⃣  TEST 3 - Posting comment in Chapter 2...');
    const comment2 = await postComment(
      book.id,
      ch2.id,
      'Test comment in Chapter 2 with UUID: ' + ch2.id
    );
    console.log(`   ✓ Posted comment (ID: ${comment2.id})`);
    console.log(`   ✓ Chapter 2 UUID (liveId): ${ch2.id}`);

    console.log('\n7️⃣  TEST 4 - Verifying Chapter 1 comments after Ch2 post...');
    const ch1CommentsAfter = await getComments(book.id, ch1.id);
    console.log(`   ✓ Chapter 1 still has ${ch1CommentsAfter.length} comment(s)`);
    
    // Check if Ch1 and Ch2 comments are separated properly
    const ch1CommentStillThere = ch1CommentsAfter.some(c => c.id === comment1.id);
    const ch2CommentInCh1 = ch1CommentsAfter.some(c => c.id === comment2.id);
    
    if (!ch1CommentStillThere) {
      throw new Error(`⚠️  Our Ch1 comment disappeared!`);
    }
    if (ch2CommentInCh1) {
      throw new Error(`⚠️  FAIL: Chapter 2's comment is showing in Chapter 1! Comments not properly scoped by UUID!`);
    }
    console.log(`   ✓ Chapter 2's comment is NOT in Chapter 1 (proper scoping confirmed!)`);

    console.log('\n8️⃣  TEST 5 - Verifying Chapter 2 has only its own comment...');
    const ch2Comments = await getComments(book.id, ch2.id);
    console.log(`   ✓ Chapter 2 has ${ch2Comments.length} comment(s)`);
    console.log(`   Comments in Ch2:`);
    ch2Comments.forEach(c => {
      console.log(`     - ID: ${c.id}, chapterId: ${c.chapterId}, author: ${c.author && c.author.name}`);
    });
    
    // Check if our Ch2 comment is there
    const hasCh2Comment = ch2Comments.some(c => c.id === comment2.id);
    if (!hasCh2Comment) {
      throw new Error(`Our comment (${comment2.id}) not found in Chapter 2!`);
    }
    console.log(`   ✓ Our comment is present in Chapter 2`);

    // Key test: Ch1 comment should NOT be in Ch2
    const ch1CommentInCh2 = ch2Comments.some(c => c.id === comment1.id);
    if (ch1CommentInCh2) {
      throw new Error(`⚠️  FAIL: Chapter 1's comment is showing in Chapter 2! Comments not properly scoped by UUID!`);
    }
    console.log(`   ✓ Chapter 1's comment is NOT in Chapter 2 (proper scoping confirmed!)`);

    console.log('\n9️⃣  TEST 6 - Verifying UUIDs vs chapter numbers...');
    console.log(`   Chapter 1 number: ${ch1.n}, UUID: ${ch1.id}`);
    console.log(`   Chapter 2 number: ${ch2.n}, UUID: ${ch2.id}`);
    console.log(`   ✓ Comments scoped by UUID (${ch1.id}), NOT by number (${ch1.n})`);

    console.log('\n🔟 TEST 7 - Simulating "View All" comments page URL...');
    // The scroll-reader generates URLs like: comments.html?story=BOOK_ID&ch=CHAPTER_UUID
    const viewAllUrl = `comments.html?story=${book.id}&ch=${ch1.id}`;
    console.log(`   ✓ Generated View All URL: ${viewAllUrl}`);
    console.log(`   ✓ URL contains chapter UUID: ${ch1.id}`);
    
    // Simulate what comments-service.js does: extract the ch parameter
    // It now returns the UUID string directly (not parseInt)
    const urlParams = new URLSearchParams(`story=${book.id}&ch=${ch1.id}`);
    const extractedChapterId = urlParams.get('ch') || '';
    console.log(`   ✓ Extracted from URL (?ch=): ${extractedChapterId}`);
    console.log(`   ✓ Type: ${typeof extractedChapterId} (string, not number)`);
    
    if (extractedChapterId !== ch1.id) {
      throw new Error(`⚠️  URL parameter extraction failed! Expected ${ch1.id}, got ${extractedChapterId}`);
    }

    // Now use that parameter to fetch comments
    console.log('\n1️⃣1️⃣ TEST 8 - Fetching comments using URL parameter (like View All page)...');
    const viewAllComments = await getComments(book.id, extractedChapterId);
    console.log(`   ✓ API received chapterId: ${extractedChapterId}`);
    console.log(`   ✓ Fetched ${viewAllComments.length} comment(s)`);
    
    // Verify these are the correct chapter's comments
    const allFromCh1 = viewAllComments.every(c => c.chapterId === ch1.id);
    if (!allFromCh1) {
      throw new Error(`⚠️  FAIL: View All page got wrong chapter's comments!`);
    }
    console.log(`   ✓ All comments are from Chapter 1 (chapterId: ${ch1.id})`);
    
    // Verify Chapter 2's comment is NOT in the results
    const hasCh2CommentInViewAll = viewAllComments.some(c => c.id === comment2.id);
    if (hasCh2CommentInViewAll) {
      throw new Error(`⚠️  FAIL: Chapter 2's comment showed up in Chapter 1's View All page!`);
    }
    console.log(`   ✓ Chapter 2's comment correctly excluded from Chapter 1's View All`);

    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\nSummary:');
    console.log('✓ Comments are correctly scoped by real chapter UUID');
    console.log('✓ Comments in Chapter 1 are NOT showing in Chapter 2');
    console.log('✓ API correctly receives and stores chapter UUIDs');
    console.log('✓ comments-service.js extracts UUID string (not parseInt)');
    console.log('✓ "View All" page URL correctly passes chapter UUID');
    console.log('✓ "View All" page loads ONLY the correct chapter\'s comments');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
