#!/usr/bin/env node
/**
 * Test all debate endpoints: login, fetch debate metadata, fetch arguments, vote, create argument
 * Run: node test-debate-endpoints.js
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:4000';
const USERNAME = 'adawriter';
const PASSWORD = 'Memory1234!';

let sessionCookie = '';
let bookId = '';
let chapterId = '';
let debateId = '';

// Nine Lives, Twice fixtures from dev seed
const NINE_LIVES_BOOK = '000001a1-e485-7972-969c-f16516016e0f';
const CHAPTER_WITH_DEBATE = '000001a1-e452-70be-a670-ac3d9ec5a446';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (sessionCookie) {
      options.headers['Cookie'] = sessionCookie;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Capture Set-Cookie header
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          sessionCookie = setCookie[0].split(';')[0];
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('🧪 Testing Debate Endpoints\n');

  try {
    // 1. LOGIN
    console.log('1️⃣  LOGIN as adawriter');
    let res = await request('POST', '/api/auth/login', {
      emailOrUsername: USERNAME,
      password: PASSWORD
    });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('❌ LOGIN FAILED', res.body);
      process.exit(1);
    }
    console.log(`   ✅ Logged in, session: ${sessionCookie.substring(0, 20)}...\n`);

    // 2. GET BOOK (Nine Lives, Twice)
    console.log('2️⃣  GET BOOK (Nine Lives, Twice)');
    bookId = NINE_LIVES_BOOK;
    res = await request('GET', `/api/books/${bookId}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('❌ BOOK FETCH FAILED', res.body);
      process.exit(1);
    }
    console.log(`   ✅ Got book: ${res.body.title}\n`);

    // 3. GET CHAPTER (with debate)
    console.log('3️⃣  GET CHAPTER (with debate)');
    chapterId = CHAPTER_WITH_DEBATE;
    res = await request('GET', `/api/books/${bookId}/chapters/${chapterId}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('❌ CHAPTER FETCH FAILED', res.body);
      process.exit(1);
    }
    const chapter = res.body;
    console.log(`   ✅ Got chapter: ${chapter.title}`);
    if (chapter.debate) {
      debateId = chapter.debate.id;
      console.log(`   ✅ Chapter has debate: ${debateId}\n`);
    } else {
      console.error('❌ Chapter has no debate');
      process.exit(1);
    }

    // 4. FETCH DEBATE METADATA (NEW ENDPOINT)
    console.log('4️⃣  FETCH DEBATE METADATA via /api/stories/:debateId');
    console.log(`   URL: GET /api/stories/${debateId}?book=${bookId}&ch=${chapterId}`);
    res = await request('GET', `/api/stories/${debateId}?book=${bookId}&ch=${chapterId}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('❌ DEBATE METADATA FETCH FAILED', res.body);
      process.exit(1);
    }
    const debate = res.body;
    console.log(`   ✅ Got debate metadata`);
    console.log(`      Motion: "${debate.motion}"`);
    console.log(`      For: ${debate.forV} votes, Against: ${debate.agV} votes\n`);

    // 5. FETCH DEBATE ARGUMENTS
    console.log('5️⃣  FETCH DEBATE ARGUMENTS');
    console.log(`   URL: GET /api/debates/${debateId}/args?book=${bookId}&ch=${chapterId}`);
    res = await request('GET', `/api/debates/${debateId}/args?book=${bookId}&ch=${chapterId}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('❌ ARGUMENTS FETCH FAILED', res.body);
      process.exit(1);
    }
    const args = res.body.items || [];
    console.log(`   ✅ Got ${args.length} arguments\n`);

    // 6. CREATE ARGUMENT
    console.log('6️⃣  CREATE ARGUMENT');
    console.log(`   URL: POST /api/debates/${debateId}/args?book=${bookId}&ch=${chapterId}`);
    res = await request('POST', `/api/debates/${debateId}/args?book=${bookId}&ch=${chapterId}`, {
      text: 'This is a test argument from automated test',
      side: 'for'
    });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 201 && res.status !== 200) {
      console.error('❌ ARGUMENT CREATE FAILED', res.body);
      process.exit(1);
    }
    const argId = res.body.id;
    console.log(`   ✅ Created argument: ${argId}\n`);

    // 7. VOTE ON ARGUMENT
    console.log('7️⃣  VOTE ON ARGUMENT');
    console.log(`   URL: POST /api/debate/args/${argId}/vote`);
    res = await request('POST', `/api/debate/args/${argId}/vote`, {
      vote: 1
    });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('❌ ARGUMENT VOTE FAILED', res.body);
      process.exit(1);
    }
    console.log(`   ✅ Voted on argument\n`);

    // 8. VOTE ON DEBATE SIDE
    console.log('8️⃣  VOTE ON DEBATE SIDE (chapter-level)');
    console.log(`   URL: POST /api/stories/${bookId}/chapters/${chapterId}/debate/vote`);
    res = await request('POST', `/api/stories/${bookId}/chapters/${chapterId}/debate/vote`, {
      side: 'for'
    });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('❌ DEBATE SIDE VOTE FAILED', res.body);
      process.exit(1);
    }
    console.log(`   ✅ Voted on debate side\n`);

    console.log('\n✅ ALL TESTS PASSED!\n');
    console.log('Summary:');
    console.log('  ✅ Debate metadata endpoint: /api/stories/:debateId?book=:bookId&ch=:chapterId');
    console.log('  ✅ Debate arguments endpoint: /api/debates/:debateId/args?book=:bookId&ch=:chapterId');
    console.log('  ✅ Create argument endpoint: /api/debates/:debateId/args?book=:bookId&ch=:chapterId');
    console.log('  ✅ Argument vote endpoint: /api/debate/args/:id/vote');
    console.log('  ✅ Debate side vote endpoint: /api/stories/:bookId/chapters/:chapterId/debate/vote');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    process.exit(1);
  }
}

test();
