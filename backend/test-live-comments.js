#!/usr/bin/env node
/**
 * LIVE TEST SUITE - Comment System Fixes
 * Tests against production Render URL: https://droboard-v2.onrender.com
 * Shows visual pass/fail results
 */

const LIVE_URL = 'https://droboard-v2.onrender.com';

let testResults = [];
let passCount = 0;
let failCount = 0;

function test(name, result, details = '') {
  const status = result ? '✓ PASS' : '✗ FAIL';
  const color = result ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  
  console.log(`${color}${status}${reset} ${name}`);
  if (details) console.log(`     ${details}`);
  
  testResults.push({ name, result, details });
  if (result) passCount++;
  else failCount++;
}

async function testCommentScoping() {
  console.log('\n📋 TEST SUITE: Comment System Fixes\n');
  
  try {
    // Test 1: Reader page loads
    console.log('1️⃣  Testing scroll-reader with comments...');
    const readerRes = await fetch(`${LIVE_URL}/scroll-reader.html?story=test`, { 
      method: 'HEAD',
      redirect: 'follow'
    });
    test('Scroll reader page loads', readerRes.ok);
    
    // Test 2: Full reader page loads
    console.log('\n2️⃣  Testing full-reader with comments...');
    const fullReaderRes = await fetch(`${LIVE_URL}/full-reader.html?story=test`, { 
      method: 'HEAD',
      redirect: 'follow'
    });
    test('Full reader page loads', fullReaderRes.ok);

    // Test 3: Comments page loads
    console.log('\n3️⃣  Testing comments page...');
    const commentsPageRes = await fetch(`${LIVE_URL}/comments.html`, { 
      method: 'HEAD',
      redirect: 'follow'
    });
    test('Comments page loads', commentsPageRes.ok);

    // Test 4: Check if comment-section.js has z-index fix
    console.log('\n4️⃣  Testing reaction picker z-index fix...');
    const csRes = await fetch(`${LIVE_URL}/component/comment-section.js`);
    const csContent = await csRes.text();
    const hasZIndexFix = csContent.includes('z-index:1950');
    test('Reaction picker z-index is 1950', hasZIndexFix, 
      hasZIndexFix ? 'z-index:1950 found ✓' : 'z-index:1950 NOT found ✗');

    // Test 5: Check if comments-service uses UUID extraction
    console.log('\n5️⃣  Testing comments-service UUID extraction...');
    const commRes = await fetch(`${LIVE_URL}/services/comments-service.js`);
    const commContent = await commRes.text();
    const hasUUIDExtraction = commContent.includes('qs().get(\'ch\')') && 
                               !commContent.includes('parseInt(qs().get(\'ch\')');
    test('Comments service extracts UUID (not parseInt)', hasUUIDExtraction,
      hasUUIDExtraction ? 'UUID string extraction ✓' : 'Still using parseInt ✗');

    // Test 6: Check scroll-reader uses ch.liveId
    console.log('\n6️⃣  Testing scroll-reader chapter UUID usage...');
    const srRes = await fetch(`${LIVE_URL}/services/scroll-reader-service.js`);
    const srContent = await srRes.text();
    const hasLiveIdUsage = srContent.includes('ch.liveId');
    test('Scroll reader uses ch.liveId for comments', hasLiveIdUsage,
      hasLiveIdUsage ? 'Uses ch.liveId ✓' : 'Still using ch.n ✗');

    // Test 7: Check full-reader uses chapterId
    console.log('\n7️⃣  Testing full-reader chapter ID usage...');
    const frRes = await fetch(`${LIVE_URL}/services/full-reader-service.js`);
    const frContent = await frRes.text();
    const hasChapterIdUsage = frContent.includes('chapterId') && 
                              frContent.includes('ch.liveId');
    test('Full reader uses chapterId (from ch.liveId)', hasChapterIdUsage,
      hasChapterIdUsage ? 'Uses chapterId ✓' : 'Still using currentChNum ✗');

  } catch (err) {
    test('Live test connection', false, err.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`\x1b[32mPassed: ${passCount}\x1b[0m`);
  console.log(`\x1b[31mFailed: ${failCount}\x1b[0m`);
  console.log(`Success Rate: ${((passCount / testResults.length) * 100).toFixed(1)}%`);
  
  if (failCount === 0) {
    console.log('\n✅ ALL LIVE TESTS PASSED!\n');
  } else {
    console.log(`\n⚠️  ${failCount} test(s) failed - check details above\n`);
  }
  
  console.log('='.repeat(60));
}

testCommentScoping();
