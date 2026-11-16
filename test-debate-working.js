#!/usr/bin/env node
/**
 * Full debate test with real chapter ID from seed
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

    // 2. GET CHAPTER (with embedded debate)
    const bookId = '000001a1-e486-773a-93b4-358a51fba1c2'; // Nine Lives, Twice
    const chapterKey = '6afb03b0808fe23f684ddfa3'; // Chapter 1 with debate in seed
    
    console.log('2️⃣  GET CHAPTER (from seed with debate)');
    res = await request('GET', `/api/books/${bookId}/chapters/${chapterKey}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) throw new Error(`Chapter fetch failed: ${res.status}`);
    
    const chapter = res.body;
    console.log(`   ✅ Got chapter: "${chapter.title}"`);
    
    if (!chapter.debate) {
      throw new Error('Chapter has no debate');
    }
    const debateId = chapter.debate.id;
    console.log(`   ✅ Chapter has debate: ${debateId}`);
    console.log(`      Motion: "${chapter.debate.motion}"\n`);

    // 4. FETCH DEBATE METADATA via /api/stories/:debateId
    console.log('4️⃣  FETCH DEBATE METADATA (CRITICAL TEST)');
    console.log(`   URL: GET /api/stories/${debateId}?book=${bookId}&ch=${chapterKey}`);
    res = await request('GET', `/api/stories/${debateId}?book=${bookId}&ch=${chapterKey}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      console.error('\n   ❌ MISMATCH DETECTED!');
      console.error(`   Expected: 200 OK`);
      console.error(`   Got:      ${res.status} ${res.body?.error || ''}`);
      throw new Error('Debate metadata endpoint returned non-200');
    }
    console.log(`   ✅ PASS: Endpoint works correctly`);
    console.log(`      Motion: "${res.body.motion}"`);
    console.log(`      For: ${res.body.forV} votes, Against: ${res.body.agV} votes`);
    console.log(`      User's vote: ${res.body.userVote || '(none)'}\n`);

    // 5. FETCH ARGUMENTS via /api/debates/:debateId/args
    console.log('5️⃣  FETCH ARGUMENTS');
    console.log(`   URL: GET /api/debates/${debateId}/args?book=${bookId}&ch=${chapterKey}`);
    res = await request('GET', `/api/debates/${debateId}/args?book=${bookId}&ch=${chapterKey}`);
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      throw new Error(`Arguments fetch failed: ${res.status}`);
    }
    const args = res.body.items || [];
    console.log(`   ✅ PASS: Arguments endpoint works (${args.length} arguments)\n`);

    // 6. CREATE ARGUMENT
    console.log('6️⃣  CREATE ARGUMENT');
    console.log(`   URL: POST /api/debates/${debateId}/args?book=${bookId}&ch=${chapterKey}`);
    res = await request('POST', `/api/debates/${debateId}/args?book=${bookId}&ch=${chapterKey}`, {
      text: 'Honesty is the foundation of any real relationship. Without it, everything crumbles.',
      side: 'for'
    });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Argument create failed: ${res.status}`);
    }
    const argId = res.body.id;
    console.log(`   ✅ PASS: Create argument works`);
    console.log(`      ID: ${argId}\n`);

    // 7. VOTE ON ARGUMENT
    console.log('7️⃣  VOTE ON ARGUMENT (thumbs up)');
    console.log(`   URL: POST /api/debate/args/${argId}/vote`);
    res = await request('POST', `/api/debate/args/${argId}/vote`, { vote: 1 });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      throw new Error(`Argument vote failed: ${res.status}`);
    }
    console.log(`   ✅ PASS: Argument vote works\n`);

    // 8. VOTE ON DEBATE SIDE (chapter-level)
    console.log('8️⃣  VOTE ON DEBATE SIDE (pick \'for\')');
    console.log(`   URL: POST /api/stories/${bookId}/chapters/${chapterKey}/debate/vote`);
    res = await request('POST', `/api/stories/${bookId}/chapters/${chapterKey}/debate/vote`, {
      side: 'for'
    });
    console.log(`   Status: ${res.status}`);
    if (res.status !== 200) {
      throw new Error(`Debate side vote failed: ${res.status}`);
    }
    console.log(`   ✅ PASS: Debate side vote works\n`);

    // 9. VERIFY: Fetch debate metadata again to see updated vote count
    console.log('9️⃣  VERIFY: Re-fetch debate metadata');
    res = await request('GET', `/api/stories/${debateId}?book=${bookId}&ch=${chapterKey}`);
    if (res.status === 200 && res.body.userVote === 'for') {
      console.log(`   ✅ VERIFIED: User vote persisted (userVote: "for")\n`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED - ENDPOINTS ARE CORRECTLY MATCHED!\n');
    console.log('Verified endpoints:');
    console.log('  ✅ GET  /api/stories/:debateId?book=:bookId&ch=:chapterId');
    console.log('  ✅ GET  /api/debates/:debateId/args?book=:bookId&ch=:chapterId');
    console.log('  ✅ POST /api/debates/:debateId/args?book=:bookId&ch=:chapterId');
    console.log('  ✅ POST /api/debate/args/:id/vote');
    console.log('  ✅ POST /api/stories/:bookId/chapters/:chapterId/debate/vote');
    console.log('='.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nDebug info: Check server logs above for full error details');
    process.exit(1);
  }
}

test();
