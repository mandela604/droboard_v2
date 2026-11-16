#!/usr/bin/env node
/**
 * Full debate test: login → fetch chapter → create debate → test all endpoints
 */

const http = require('http');

let sessionCookie = '';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://127.0.0.1:4000');
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };

    if (sessionCookie) options.headers['Cookie'] = sessionCookie;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) sessionCookie = setCookie[0].split(';')[0];
        
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('\n🧪 DEBATE ENDPOINTS INTEGRATION TEST\n');

  try {
    // 1. LOGIN
    console.log('1️⃣  LOGIN as adawriter');
    let res = await request('POST', '/api/auth/login', {
      emailOrUsername: 'adawriter',
      password: 'Memory1234!'
    });
    if (res.status !== 200) throw new Error(`Login failed: ${res.status}`);
    console.log(`   ✅ Logged in\n`);

    // 2. GET CHAPTER (will work on any chapter)
    const bookId = '000001a1-e486-773a-93b4-358a51fba1c2'; // Nine Lives, Twice
    const chapters = ['chapter_1', 'chapter_2', 'chapter_3', 'chapter_4'];
    const chapterKey = chapters[0];
    
    console.log('2️⃣  GET CHAPTER');
    res = await request('GET', `/api/books/${bookId}/chapters/${chapterKey}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) throw new Error(`Chapter fetch failed: ${res.status}`);
    
    const chapter = res.body;
    console.log(`   ✅ Got chapter: "${chapter.title}"\n`);

    let debateId;
    if (chapter.debate) {
      debateId = chapter.debate.id;
      console.log(`   ✅ Chapter has debate: ${debateId}\n`);
    } else {
      // Create a debate via SE endpoint
      console.log('3️⃣  CREATE CHAPTER DEBATE (via senior editor)');
      res = await request('POST', `/api/senior-editor/books/${bookId}/chapters/${chapterKey}/debate`, {
        motion: 'Should the bakery have stayed open after closing time?',
        forText: 'Yes, the love matters',
        againstText: 'No, rules are rules'
      });
      console.log(`   Status: ${res.status}`);
      if (res.status !== 201 && res.status !== 200) {
        console.error('   ❌ Debate create failed:', res.body);
        throw new Error(`Debate creation failed: ${res.status}`);
      }
      debateId = res.body.id;
      console.log(`   ✅ Created debate: ${debateId}\n`);
    }

    // 4. FETCH DEBATE METADATA via /api/stories/:debateId
    console.log('4️⃣  FETCH DEBATE METADATA');
    console.log(`   URL: GET /api/stories/${debateId}?book=${bookId}&ch=${chapterKey}`);
    res = await request('GET', `/api/stories/${debateId}?book=${bookId}&ch=${chapterKey}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('   ❌ MISMATCH! Debate metadata endpoint returned', res.status);
      console.error('   Response:', res.body);
      throw new Error('Debate metadata endpoint failed');
    }
    console.log(`   ✅ PASS: Debate metadata endpoint works`);
    console.log(`      Motion: "${res.body.motion}"`);
    console.log(`      For: ${res.body.forV} votes, Against: ${res.body.agV} votes\n`);

    // 5. FETCH ARGUMENTS via /api/debates/:debateId/args
    console.log('5️⃣  FETCH DEBATE ARGUMENTS');
    console.log(`   URL: GET /api/debates/${debateId}/args?book=${bookId}&ch=${chapterKey}`);
    res = await request('GET', `/api/debates/${debateId}/args?book=${bookId}&ch=${chapterKey}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('   ❌ MISMATCH! Arguments endpoint returned', res.status);
      throw new Error('Arguments fetch failed');
    }
    const args = res.body.items || [];
    console.log(`   ✅ PASS: Arguments endpoint works (${args.length} args)\n`);

    // 6. CREATE ARGUMENT
    console.log('6️⃣  CREATE ARGUMENT');
    console.log(`   URL: POST /api/debates/${debateId}/args?book=${bookId}&ch=${chapterKey}`);
    res = await request('POST', `/api/debates/${debateId}/args?book=${bookId}&ch=${chapterKey}`, {
      text: 'Love always trumps routine. People need meaning more than schedules.',
      side: 'for'
    });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 201 && res.status !== 200) {
      console.error('   ❌ MISMATCH! Create argument returned', res.status);
      throw new Error('Argument create failed');
    }
    const argId = res.body.id;
    console.log(`   ✅ PASS: Create argument works (${argId})\n`);

    // 7. VOTE ON ARGUMENT
    console.log('7️⃣  VOTE ON ARGUMENT');
    console.log(`   URL: POST /api/debate/args/${argId}/vote`);
    res = await request('POST', `/api/debate/args/${argId}/vote`, { vote: 1 });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('   ❌ MISMATCH! Argument vote returned', res.status);
      throw new Error('Argument vote failed');
    }
    console.log(`   ✅ PASS: Argument vote works\n`);

    // 8. VOTE ON DEBATE SIDE (chapter-level)
    console.log('8️⃣  VOTE ON DEBATE SIDE');
    console.log(`   URL: POST /api/stories/${bookId}/chapters/${chapterKey}/debate/vote`);
    res = await request('POST', `/api/stories/${bookId}/chapters/${chapterKey}/debate/vote`, {
      side: 'for'
    });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('   ❌ MISMATCH! Debate side vote returned', res.status);
      throw new Error('Debate side vote failed');
    }
    console.log(`   ✅ PASS: Debate side vote works\n`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED - ALL ENDPOINTS MATCH!\n');
    console.log('Endpoints verified:');
    console.log('  ✅ GET  /api/stories/:debateId?book=:bookId&ch=:chapterId');
    console.log('  ✅ GET  /api/debates/:debateId/args?book=:bookId&ch=:chapterId');
    console.log('  ✅ POST /api/debates/:debateId/args?book=:bookId&ch=:chapterId');
    console.log('  ✅ POST /api/debate/args/:id/vote');
    console.log('  ✅ POST /api/stories/:bookId/chapters/:chapterId/debate/vote');
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nNote: This may fail if senior editor endpoint for creating debates');
    console.error('doesn\'t exist. The test is verifying the routing works.');
    process.exit(1);
  }
}

test();
