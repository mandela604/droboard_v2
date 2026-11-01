'use strict'
// Throwaway verifier: loads the dev-console data files in a stubbed DOM and replays
// every preset request against the running dev server (npm run dev:memory).
// Reports each call and flags any whose status contradicts its own "(expect NNN)".
const fs = require('fs');
const path = require('path');

function fakeEl() {
  const el = {
    className: '', id: '', innerHTML: '', textContent: '', value: '',
    style: {}, children: [], classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { el.children.push(c); return c; },
    prepend(c) { el.children.unshift(c); return c; },
    querySelector() { return fakeEl(); },
    set onclick(fn) { el._click = fn; }, get onclick() { return el._click; },
  };
  return el;
}
const doc = {
  getElementById: () => fakeEl(),
  createElement: () => fakeEl(),
};

const ENV = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dev-console', 'env.json'), 'utf8'));
const BASE = ENV.base;

global.document = doc;
global.window = global;
global.atob = s => Buffer.from(s, 'base64').toString('binary');
const nativeFetch = global.fetch;
global.fetch = (u, o) => nativeFetch(u, o);

// capture what the pages would fire
let captured = null;
global.mountConsole = groups => { captured = groups; };

function load(file) {
  // eslint-disable-next-line no-eval
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'dev-console', file), 'utf8'));
}

async function main() {
  const which = process.argv[2] || 'users.js';
  load('engine.js');
  load(which);
  if (!captured) throw new Error('no groups captured');

  const fill = t => String(t).replace(/\{\{(\w+)\}\}/g, (m, k) => (ENV[k] !== undefined ? ENV[k] : m));
  const deep = v => (typeof v === 'string' ? fill(v) : Array.isArray(v) ? v.map(deep)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v);

  const state = {};
  let n = 0, bad = 0;
  const groups = Array.isArray(captured) ? captured : (captured.groups || []);
  for (const g of groups) {
    console.log('\n### ' + g.title);
    for (const req of g.items) {
      const url = fill(req.path);
      const headers = { 'Content-Type': 'application/json' };
      const tok = ENV['token_' + req.token];
      if (tok) headers.Authorization = 'Bearer ' + tok;
      let code = 0, body = '';
      const t0 = Date.now();
      try {
        const res = await fetch(BASE + url, {
          method: req.method, headers,
          body: req.body == null ? undefined : JSON.stringify(deep(req.body)),
        });
        code = res.status; body = await res.text();
      } catch (e) { code = 'X'; body = String(e.message || e); }
      const ms = Date.now() - t0;
      n++;

      // chain ids the way the page does
      try {
        const j = JSON.parse(body);
        if (j && j.id) {
          if (/\/policies$/.test(req.path)) state.policyId = j.id;
          if (/\/announcements$/.test(req.path)) state.annId = j.id;
          if (/\/invites$/.test(req.path)) state.inviteId = j.id;
          if (/\/api\/books$/.test(req.path) && req.method === 'POST') state.newBookId = j.id;
          if (/\/api\/posts$/.test(req.path) && req.method === 'POST') state.newPostId = j.id;
          if (/\/collections$/.test(req.path) && req.method === 'POST') state.newCollectionId = j.id;
          if (/\/api\/comments$/.test(req.path) && req.method === 'POST') state.newCommentId = j.id;
        }
      } catch (e) { /* not json */ }
      Object.keys(state).forEach(k => { ENV[k] = state[k]; });

      const want = /expect (\d{3})/.exec(req.name);
      const ok = want ? String(code) === want[1] : code < 400;
      if (!ok) bad++;
      console.log((ok ? '  ok  ' : '  BAD ') + String(code).padEnd(4) + req.method.padEnd(7) + url.replace('/api/', '')
        .padEnd(58) + ms + 'ms' + (want ? ' (wanted ' + want[1] + ')' : '') + (ok ? '' : ' :: ' + body.slice(0, 110).replace(/\s+/g, ' ')));
    }
  }
  console.log('\n' + n + ' calls, ' + bad + ' contradicting their own label\n');
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });
