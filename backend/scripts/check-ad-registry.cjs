'use strict';
/* Temporary parity check: every ad-slot marker in public/ must exist in the
   backend surface registry, and vice versa. */
const fs = require('fs');
const path = require('path');
const reg = require('../src/config/adSurfaces');

const root = path.join(__dirname, '..', '..', 'public');
const found = new Map();

function record(slot, where) {
  if (!found.has(slot)) found.set(slot, []);
  if (!found.get(slot).includes(where)) found.get(slot).push(where);
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(html|js)$/.test(e.name)) continue;
    if (p.includes('android')) continue;
    const s = fs.readFileSync(p, 'utf8');
    const rel = path.relative(root, p).replace(/\\/g, '/');
    let m;
    const re1 = /data-ad-slot=["']([^"']+)["']/g;
    while ((m = re1.exec(s))) record(m[1], rel);
    const re2 = /DroboardAdSlot\.mount\(\s*['"]([^'"]+)['"]/g;
    while ((m = re2.exec(s))) record(m[1], rel + ' (mount)');
  }
}
walk(root);

const slotSet = new Set(reg.SLOT_IDS);
const missing = [...found.keys()].filter(s => !slotSet.has(s)).sort();
console.log('== markers with no backend registry entry ==');
missing.forEach(s => console.log('  ' + s + '   <- ' + found.get(s).join(', ')));
if (!missing.length) console.log('  (none)');

console.log('== registry slots with no marker (programmatic or stale) ==');
reg.SLOT_IDS.filter(s => !found.has(s)).forEach(s => console.log('  ' + s));

console.log('== backend PAGES vs PAGE_SLOTS keys ==');
const pages = new Set(reg.PAGE_IDS);
Object.keys(reg.PAGE_SLOTS).forEach(p => { if (!pages.has(p)) console.log('  slot page not in PAGES: ' + p); });
reg.PAGE_IDS.filter(p => !(p in reg.PAGE_SLOTS)).forEach(p => console.log('  PAGES entry with no PAGE_SLOTS: ' + p));

console.log('total markers: ' + found.size + ' | registry slots: ' + reg.SLOT_IDS.length);
