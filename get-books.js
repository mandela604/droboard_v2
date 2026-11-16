const http = require('http');

http.get('http://127.0.0.1:4001/api/books', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const body = JSON.parse(data);
      if (body.items) {
        const nineLives = body.items.find(b => b.title.includes('Nine Lives'));
        if (nineLives) {
          console.log('Nine Lives book ID:', nineLives.id);
          console.log('Chapters:', nineLives.chapterCount);
        }
      }
    } catch (e) {
      console.error('Error:', e.message);
      console.log('Response:', data.substring(0, 200));
    }
    process.exit(0);
  });
}).on('error', e => {
  console.error('Request error:', e.message);
  process.exit(1);
});
