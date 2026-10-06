const fs = require('fs');

const jobs = [
  {
    html: 'public/marketing/dashboard.html',
    service: 'public/marketing/shared/dashboard-page-service.js',
    exportName: 'MarketingDashboard',
    header: 'dashboard-page-service.js — Overview dashboard page logic (pure call-and-render).',
    tailRe: /\ninit\(\);\s*$/,
    tailExport: '\nwindow.MarketingDashboard={init:init};\n'
  },
  {
    html: 'public/marketing/campaigns.html',
    service: 'public/marketing/shared/campaigns-page-service.js',
    exportName: 'CampaignsPage',
    header: 'campaigns-page-service.js — Campaigns page logic (pure call-and-render).',
    tailRe: /\ninit\(\);\s*$/,
    tailExport: '\nwindow.CampaignsPage={init:init};\n'
  },
  {
    html: 'public/marketing/marketing-analytics.html',
    service: 'public/marketing/shared/marketing-analytics-page-service.js',
    exportName: 'MarketingAnalytics',
    header: 'marketing-analytics-page-service.js — Marketing Analytics page logic (pure call-and-render).',
    tailRe: /\nrender\(30\);\s*$/,
    tailExport: '\nwindow.MarketingAnalytics={init:function(){ render(30); },render:render};\n'
  }
];

jobs.forEach(function (j) {
  let s = fs.readFileSync(j.html, 'utf8');
  const m = s.match(/<script>\s*([\s\S]*?)<\/script>/);
  if (!m) { console.log('NO_BLOCK ' + j.html); process.exit(1); }
  let body = m[1];
  if (!j.tailRe.test(body)) { console.log('NO_TAIL ' + j.html); process.exit(1); }
  body = body.replace(j.tailRe, j.tailExport);
  const out = '/**\n * ' + j.header + '\n'
    + ' * Extracted verbatim from ' + j.html.split('/').pop() + ' inline script.\n'
    + ' * Page now calls ' + j.exportName + '.init().\n'
    + ' * Backend-ready: implement fetch endpoints in shared/marketing-data.js and swap reads; no HTML change.\n'
    + ' */\n(function(){\n' + body + '})();\n';
  fs.writeFileSync(j.service, out);
  // Replace inline block in HTML with loader + init call
  const replacement = '<script src="shared/' + j.service.split('/').pop() + '"></script>\n<script>' + j.exportName + '.init();</script>';
  s = s.replace(/<script>\s*[\s\S]*?<\/script>/, replacement);
  fs.writeFileSync(j.html, s);
  console.log('OK ' + j.html + ' -> ' + j.service);
});
