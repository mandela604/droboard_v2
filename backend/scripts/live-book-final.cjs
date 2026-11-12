'use strict';
const BASE = 'https://droboard-v2.onrender.com';
const ADMIN_EMAIL = 'qa.admin@droboard.test';
const PW = 'AdminLive1234!';
const BOOK_ID = '000001a1-d094-7085-8d45-96316297a499';

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const init = { method, headers };
  if (body !== undefined && body !== null) init.body = JSON.stringify(body);
  const res = await fetch(BASE + path, init);
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  return { status: res.status, json, ok: res.ok };
}
function log(s, m) { console.log(`[${s}] ${m}`); }

const CHAPTER_8 = `The morning light filtered through the windows of the mapmaker's shop, casting long golden beams across the wooden floor. Mara Voss sat at the workbench, her pen moving steadily across the parchment, copying the ancient map with painstaking care. Every line, every symbol, every faded word had to be perfect. This was not just a map — it was a record of the Veilkeepers' legacy, a guide for those who would come after her.

She paused to dip her pen in the ink, her mind wandering to the trials she had faced, the sacrifices she had made, the responsibility she now carried. The city of Eldoria slept peacefully around her, unaware of the darkness that lurked just beyond the veil, unaware of the guardian who watched over them.

Mara smiled. Let them sleep. Let them dream. Let them live their lives in peace. That was what she was here for.

She returned to her work, the pen scratching softly against the parchment, the morning light growing brighter, the city waking up around her. She was the Veilkeeper. And she would hold the line.`;

async function main() {
  let r = await call('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: PW });
  if (r.status !== 200) { console.error('Login failed:', JSON.stringify(r.json)); process.exit(1); }
  const token = r.json.access || r.json.token;
  log('login', 'OK');

  const words = CHAPTER_8.split(/\s+/).filter(w => w.length > 0).length;
  r = await call('POST', `/api/books/${BOOK_ID}/chapters`, {
    n: 8, title: 'The Keeper\'s Dawn', content: CHAPTER_8, words: words, status: 'draft',
  }, token);
  log('chapter-8', `status=${r.status} words=${words}`);

  // Check word count
  r = await call('GET', '/api/books/?limit=10', null, token);
  if (r.json && r.json.items) {
    const found = r.json.items.find(b => (b.id || b._id) === BOOK_ID);
    if (found) log('info', `Book words: ${found.wordCount}, status: ${found.status}`);
  }

  // Submit for review
  r = await call('PATCH', `/api/books/${BOOK_ID}`, { status: 'under_review' }, token);
  log('submit', `status=${r.status}`);

  // Approve
  r = await call('PUT', `/api/senior-editor/review-queue/${BOOK_ID}`, { action: 'approved' }, token);
  log('approve', `status=${r.status} body=${JSON.stringify(r.json)}`);

  // Final check
  r = await call('GET', '/api/books/?limit=10', null, token);
  if (r.json && r.json.items) {
    const found = r.json.items.find(b => (b.id || b._id) === BOOK_ID);
    if (found) {
      log('final', `Book status: ${found.status}, words: ${found.wordCount}`);
      if (['published', 'ongoing', 'completed'].includes(found.status)) {
        log('ok', 'BOOK IS LIVE!');
      }
    }
  }
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });