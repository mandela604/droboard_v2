'use strict'
// Runs every smoke harness and writes an openable HTML report, so the test run
// is something you can look at instead of a terminal stream.
//
//   npm run report          -> backend/test-report/index.html
//
// Live suites need the Microsoft VC++ 2015-2022 x64 runtime (mongod.exe); if it
// is missing the row is reported as ERROR, not as a pass.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SUITES = [
  { name: 'Ad surfaces', cmd: 'scripts/smoke-ad-surfaces.cjs', live: false },
  { name: 'Audience catalog', cmd: 'scripts/smoke-audience-catalog.cjs', live: false },
  { name: 'Staff scopes (stubbed models)', cmd: 'scripts/smoke-staff-scopes.cjs', live: false },
  { name: 'Ad registry check', cmd: 'scripts/check-ad-registry.cjs', live: false },
  { name: 'Chief console — REAL HTTP + Mongo writes', cmd: 'scripts/smoke-chief-crud.cjs', live: true },
  { name: 'Staff/SE console — REAL HTTP + Mongo writes', cmd: 'scripts/smoke-staff-live.cjs', live: true },
];

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'test-report');
fs.mkdirSync(outDir, { recursive: true });

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rows = [];
let totalPass = 0, totalFail = 0;

for (const suite of SUITES) {
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [suite.cmd], { cwd: root, encoding: 'utf8', timeout: 420000, stdio: 'pipe' });
  } catch (e) {
    out = String((e.stdout || '') + (e.stderr || '') + (e.message || ''));
    code = typeof e.status === 'number' ? e.status : 1;
  }
  const lines = out.split(/\r?\n/);
  const passed = lines.filter(l => l.startsWith('PASS '));
  const failed = lines.filter(l => l.startsWith('FAIL '));
  const fatal = lines.filter(l => /^FATAL|Error:|exited with/i.test(l));
  totalPass += passed.length; totalFail += failed.length + (code === 0 ? 0 : 1);

  rows.push(`<section class="${failed.length || code ? 'bad' : 'good'}">
  <h2>${esc(suite.name)} ${suite.live ? '<span class="tag live">live http</span>' : '<span class="tag">in-process</span>'}</h2>
  <p class="sum">${passed.length} passed · ${failed.length} failed · exit ${code}${fatal.length ? ' · ' + esc(fatal[0]).slice(0, 160) : ''}</p>
  <details${failed.length ? ' open' : ''}>
    <summary>${failed.length ? esc(failed[0]).slice(0, 160) : 'all assertions green — expand to read them'}</summary>
    <ul>${lines.filter(l => /^(PASS|FAIL) /.test(l)).map(l => `<li class="${l.startsWith('FAIL') ? 'f' : ''}">${esc(l)}</li>`).join('')}</ul>
  </details>
</section>`);
}

fs.writeFileSync(path.join(outDir, 'index.html'), `<!doctype html>
<meta charset="utf-8"><title>Droboard backend test report</title>
<style>
 body{font:14px/1.5 system-ui,Segoe UI,sans-serif;margin:24px auto;max-width:1080px;color:#15181d}
 h1{font-size:20px;margin:0 0 4px} .top{color:#5a6270;margin-bottom:20px}
 section{border:1px solid #e2e6ec;border-left:4px solid #2eb872;border-radius:8px;padding:12px 16px;margin:12px 0;background:#fff}
 section.bad{border-left-color:#e0483d}
 h2{font-size:15px;margin:0} .sum{color:#5a6270;margin:4px 0 8px}
 .tag{font-size:11px;color:#5a6270;border:1px solid #dfe4ea;border-radius:20px;padding:1px 8px;vertical-align:1px}
 .tag.live{color:#0b6b3a;background:#e9f8f0;border-color:#b9e6cd}
 ul{margin:8px 0;padding-left:18px} li{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:#2b3240;word-break:break-word}
 li.f{color:#b3271d;background:#fdf2f1;border-radius:4px;padding:2px 6px;list-style-position:inside}
 summary{cursor:pointer;color:#5a6270;font-size:13px}
</style>
<h1>Droboard backend — ${totalFail ? totalFail + ' failing of ' + (totalPass + totalFail) : 'all ' + totalPass + ' assertions passing'}</h1>
<p class="top">Live suites boot the real Express app against an ephemeral in-memory MongoDB and assert every write by reading the document back. Your hosted database is never contacted. Generated ${esc(new Date().toISOString())}.</p>
${rows.join('\n')}
`);

console.log(`report: ${path.join(outDir, 'index.html')}`);
console.log(`${totalPass} passed, ${totalFail} failed`);
process.exit(totalFail ? 1 : 0);
