const fs = require('fs');
const f = 'public/marketing/templates.html';
const s = fs.readFileSync(f, 'utf8');
const m = s.match(/<script>\n\(function\(\)\{\n'use strict';([\s\S]*?)render\(\);\n\}\)\(\);\n<\/script>/);
if (!m) { console.log('NO_MATCH'); process.exit(1); }
const body = m[1];
const tail = "document.getElementById('tmplQ').addEventListener";
const idx = body.indexOf(tail);
if (idx < 0) { console.log('NO_TAIL'); process.exit(1); }
const decls = body.slice(0, idx);
const tailBlock = body.slice(idx).replace(/render\(\);\n?$/, '');
const out = '/**\n'
  + ' * templates-page-service.js — Flyer Templates page logic (pure call-and-render).\n'
  + ' * Extracted verbatim from templates.html inline script. Page now calls TemplatesService.init().\n'
  + ' * Backend-ready: implement fetch/store endpoints and swap the store reads/writes; no HTML change.\n'
  + ' */\n'
  + '(function(){\n\'use strict\';\n'
  + 'if(window.TemplatesService&&window.TemplatesService.__ready)return;\n'
  + '/* Data self-load: page HTML no longer includes shared/flyer-templates-data.js.\n'
  + '   Service pulls it during parse; delete these 3 lines at go-live. */\n'
  + 'if(typeof window.FlyerTemplates===\'undefined\'&&typeof document!==\'undefined\'&&document.readyState===\'loading\'){\n'
  + '  document.write(\'<script src="shared/flyer-templates-data.js"><\\/script>\');\n'
  + '}\n'
  + decls
  + 'function init(){\n' + tailBlock + 'render();\n}\n'
  + 'window.TemplatesService={init:init,__ready:true};\n'
  + '})();\n';
fs.writeFileSync('public/marketing/shared/templates-page-service.js', out);
console.log('WROTE service, body-lines: ' + body.split('\n').length);
