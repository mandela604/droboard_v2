const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:4000${path}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
}

(async () => {
  const bookId = '000001a1-e486-773a-93b4-358a51fba1c2'; // Nine Lives, Twice
  
  // Get book with chapters
  let res = await get(`/api/books/${bookId}?include=chapters`);
  console.log('Book:', res.body.title);
  console.log('Chapters:', res.body.chapters.length);
  
  for (let ch of res.body.chapters) {
    console.log(`\n  ${ch.key}: ${ch.title}`);
    let chapRes = await get(`/api/books/${bookId}/chapters/${ch.key}`);
    if (chapRes.body.debate) {
      console.log(`    ✅ HAS DEBATE: ${chapRes.body.debate.id}`);
      console.log(`       Motion: "${chapRes.body.debate.motion}"`);
    } else {
      console.log(`    ❌ No debate`);
    }
  }
})();
