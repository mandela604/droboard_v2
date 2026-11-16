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
  // List all books
  let res = await get('/api/books');
  console.log('Books:', JSON.stringify(res.body, null, 2));
  
  if (res.body && res.body.length > 0) {
    let bookId = res.body[0].id;
    console.log('\nFetching book:', bookId);
    let bookRes = await get(`/api/books/${bookId}`);
    console.log('Book:', JSON.stringify(bookRes.body, null, 2));
    
    if (bookRes.body && bookRes.body.chapters && bookRes.body.chapters.length > 0) {
      let chapterKey = bookRes.body.chapters[0].key;
      console.log('\nFetching chapter:', chapterKey);
      let chapRes = await get(`/api/books/${bookId}/chapters/${chapterKey}`);
      console.log('Chapter:', JSON.stringify(chapRes.body, null, 2));
    }
  }
})();
