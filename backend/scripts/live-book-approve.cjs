'use strict';
// Add more chapters to the existing book and approve it.
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

const EXTRA_CHAPTERS = [
  {
    title: 'The Keeper\'s Oath',
    content: `Mara Voss stood at the edge of the city, looking out at the mist-shrouded landscape beyond Eldoria's walls. The dawn light was just beginning to break through the clouds, casting long shadows across the rolling hills and distant forests. She had been standing here for hours, unable to sleep, unable to rest, her mind still reeling from everything that had happened in the tower.

The stone was gone, dissolved into light, its purpose fulfilled. But she could still feel it — a warm presence at the edge of her consciousness, a constant reminder of the duty she had taken up. She was the Veilkeeper now. The guardian of the threshold. The one who would hold the line against the darkness, for as long as it took, for as long as she was needed.

It was a terrifying thought. She was just a mapmaker's apprentice. She had no training, no experience, no idea what she was doing. She had never fought a shadow, never held a boundary, never faced the kind of darkness that lurked on the other side of the veil. And yet, here she was, standing at the edge of the city, ready to take on a responsibility that had been passed down through generations of keepers who had come before her.

She thought about her grandmother, who had told her the stories of the Veilkeepers. Had her grandmother known? Had she suspected that her granddaughter would one day take up the mantle? Or had she simply been telling fairy tales to entertain a curious child?

Mara would never know. Her grandmother was gone, and with her, any answers she might have had. But the stories remained — the stories of the Veilkeepers, of the shadow realm, of the eternal struggle between light and darkness. And Mara was now a part of those stories, a character in a tale that had been unfolding for centuries.

She took a deep breath and turned back toward the city. There was work to do. The veil was renewed, but it would not hold forever. She would need to find a way to strengthen it, to reinforce the boundary, to ensure that the shadows could never break through again.

She would need to learn. She would need to study the old texts, to search the archives, to find the knowledge that the keepers before her had accumulated over the centuries. She would need to train, to hone her abilities, to become the guardian that Eldoria needed.

And she would need to do it all alone. The gift that had brought her to the tower — the ability to hear the shadows — was gone, sacrificed to renew the veil. She could no longer hear the whispers, could no longer communicate with the Veilkeepers. She was alone in her duty, with no voice to guide her, no whisper to warn her of danger.

But she was not afraid. She had faced the shadows in the first trial. She had sealed the tear in the second. She had passed the trials of empathy and resolve. And she had made the ultimate sacrifice, giving up the gift that had defined her, to save her city.

She was the Veilkeeper. And she would hold the line.

Mara walked back into the city, her steps steady and sure. The streets were beginning to fill with people — merchants opening their shops, children running to school, workers heading to their jobs. None of them knew what had happened in the night. None of them knew how close they had come to destruction.

And that was the way it had to be. The Veilkeeper's duty was to protect, not to be seen. To guard, not to be thanked. To hold the line, so that others could live their lives in peace, unaware of the darkness that lurked just beyond the veil.

Mara smiled. She could do this. She would do this. For her city, for her home, for the people she loved. She would be the Veilkeeper, and she would hold the line.

The end.`
  }
];

async function main() {
  // Login
  let r = await call('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: PW });
  if (r.status !== 200) { console.error('Login failed:', JSON.stringify(r.json)); process.exit(1); }
  const token = r.json.access || r.json.token;
  log('login', 'OK');

  // Check book status via detail endpoint (works for staff)
  r = await call('GET', `/api/books/${BOOK_ID}/detail`, null, token);
  log('book-detail', `status=${r.status}`);
  if (r.json) {
    log('info', `Book status: ${r.json.status}, words: ${r.json.wordCount || r.json.words}`);
  }

  // Also try listing books to find it
  r = await call('GET', '/api/books/?limit=10', null, token);
  log('books-list', `status=${r.status}`);
  if (r.json && r.json.items) {
    const found = r.json.items.find(b => (b.id || b._id) === BOOK_ID);
    if (found) {
      log('info', `Found in list: id=${found.id}, _id=${found._id}, status=${found.status}, words=${found.wordCount}`);
      // Use the actual id from the list
      const actualId = found.id || found._id;
      log('info', `Using actual ID: ${actualId}`);

      // Try approval with the actual ID
      r = await call('PUT', `/api/senior-editor/review-queue/${actualId}`, { action: 'approved' }, token);
      log('approve', `status=${r.status} body=${JSON.stringify(r.json)}`);
    }
  }

  // Add extra chapters
  for (let i = 0; i < EXTRA_CHAPTERS.length; i++) {
    const ch = EXTRA_CHAPTERS[i];
    const words = ch.content.split(/\s+/).filter(w => w.length > 0).length;
    r = await call('POST', `/api/books/${BOOK_ID}/chapters`, {
      n: 6 + i,
      title: ch.title,
      content: ch.content,
      words: words,
      status: 'draft',
    }, token);
    log(`chapter-${6 + i}`, `status=${r.status} words=${words}`);
  }

  // Check word count now
  r = await call('GET', `/api/books/${BOOK_ID}`, null, token);
  if (r.json) {
    log('info', `Book status: ${r.json.status}, words: ${r.json.wordCount}`);
  }

  // Submit for review (if not already)
  r = await call('PATCH', `/api/books/${BOOK_ID}`, { status: 'under_review' }, token);
  log('submit', `status=${r.status}`);

  // Approve
  r = await call('PUT', `/api/senior/review-queue/${BOOK_ID}`, { action: 'approved' }, token);
  log('approve', `status=${r.status} body=${JSON.stringify(r.json)}`);

  if (r.status !== 200) {
    // Try checking review queue
    r = await call('GET', '/api/senior-editor/review-queue', null, token);
    log('queue', `status=${r.status}`);
    if (r.json) {
      const items = r.json.items || r.json;
      log('queue', `items: ${JSON.stringify(items).slice(0, 500)}`);
    }
  }

  // Final check
  r = await call('GET', `/api/books/${BOOK_ID}`, null, token);
  if (r.json) {
    log('final', `Book status: ${r.json.status}, words: ${r.json.wordCount}`);
    if (r.json.status === 'published' || r.json.status === 'ongoing' || r.json.status === 'completed') {
      log('ok', 'BOOK IS LIVE!');
    }
  }
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });