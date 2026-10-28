'use strict';
/* Temporary: does the demo data we ship carry any page/slot id the new
   backend registry would 400 on? Those are the saves that would break the
   moment the console is wired live. */
const fs = require('fs');
const path = require('path');
const reg = require('../src/config/adSurfaces');

const pub = path.join(__dirname, '..', '..', 'public');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.js$/.test(e.name)) files.push(p);
  }
})(pub);

const pageSet = new Set(reg.PAGE_IDS);
const slotSet = new Set(reg.SLOT_IDS);
const bad = [];

for (const f of files) {
  const rel = path.relative(pub, f).replace(/\\/g, '/');
  if (rel.includes('marketing/shared/ad-setup-data.js')) continue;
  const src = fs.readFileSync(f, 'utf8');
  // pages: ['x','y'] / slots: ['a:b'] literals anywhere in data files
  const rep = /pages:\s*\[([^\]]*)\]/g; let m;
  while ((m = rep.exec(src))) {
    m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      .forEach(p => { if (!pageSet.has(p)) bad.push(rel + '  page  ' + p); });
  }
  const res2 = /slots:\s*\[([^\]]*)\]/g;
  while ((m = res2.exec(src))) {
    m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      .forEach(s => { if (!slotSet.has(s)) bad.push(rel + '  slot  ' + s); });
  }
  // AdService.getAds({ page: 'x', slot: 'y' })
  const req3 = /page:\s*['"]([^'"]+)['"]/g;
  while ((m = req3.exec(src))) {
    const p = m[1];
    if (pageSet.has(p)) continue;
    if (/^(home|full-reader|scroll-reader|story|profile|discover|feed|comments|library|store|search|status|blog|debate|discussion|followers|notifications|leaderboard|genre-stories|genre|collection|droboard-page|premium|reader|rewarded)$/.test(p)) continue;
    if (/^[A-Z]/.test(p)) continue; // display labels
    bad.push(rel + '  request-page?  ' + p);
  }
}

const uniq = [...new Set(bad)];
console.log(uniq.length ? uniq.join('\n') : 'no stale ids in public/ data files');
console.log('checked ' + files.length + ' files');
