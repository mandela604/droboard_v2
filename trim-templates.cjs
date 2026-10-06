const fs = require('fs');
const f = 'public/marketing/templates.html';
let s = fs.readFileSync(f, 'utf8');
const marker = 'MarketingSidebar.attach';
const headEnd = '</script></body></html>';
const idx = s.indexOf(marker);
if (idx < 0) { console.log('CUT_NOT_FOUND'); process.exit(1); }
// Find start of the orphan line (beginning of its line)
const lineStart = s.lastIndexOf('\n', idx) + 1;
// Find the old closing tail after the orphan body
const tailMarker = '})();\n</script></body></html>';
const tailIdx = s.indexOf(tailMarker, idx);
if (tailIdx < 0) { console.log('TAIL_NOT_FOUND'); process.exit(1); }
s = s.slice(0, lineStart) + s.slice(tailIdx + tailMarker.length);
if (!s.endsWith('\n')) s += '\n';
fs.writeFileSync(f, s);
console.log('TRIMMED ok');
