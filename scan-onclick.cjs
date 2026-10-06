const fs = require('fs');
['public/marketing/dashboard.html', 'public/marketing/campaigns.html', 'public/marketing/marketing-analytics.html'].forEach(function (f) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/<script>[\s\S]*?<\/script>/g, '');
  const m = [];
  const re = /onclick="([^"]+)"/g;
  let x;
  while ((x = re.exec(s)) !== null) m.push(x[1]);
  console.log('=== ' + f + ' html-onclicks:' + m.length);
  m.slice(0, 12).forEach(function (v) { console.log('  ' + v.slice(0, 90)); });
});
