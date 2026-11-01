'use strict';
// Shared engine for the dev-only request consoles (index.html = staff surfaces,
// users.html = reader/author surfaces). It fires real HTTP calls at this same
// origin and prints each response the moment it lands. Nothing is mocked — every
// row is an actual round trip through routers, guards, zod validators and Mongo.
//
// Loaded as a classic script because helmet's CSP is `script-src 'self'`.

function mountConsole(GROUPS) {
  let ENV = {};
  const state = { runStamp: Date.now() };
  const log = document.getElementById('log');
  const countEl = document.getElementById('count');
  const statusEl = document.getElementById('status');

  function fill(tpl) {
    return String(tpl).replace(/\{\{(\w+)\}\}/g, function (m, k) {
      return state[k] !== undefined ? state[k] : (ENV[k] !== undefined ? ENV[k] : m);
    });
  }

  // Bodies carry {{password}} / {{authorId}} too, so templating the URL alone made
  // every write send the literal placeholder string.
  function fillDeep(v) {
    if (typeof v === 'string') return fill(v);
    if (Array.isArray(v)) return v.map(fillDeep);
    if (v && typeof v === 'object') {
      const o = {};
      Object.keys(v).forEach(k => { o[k] = fillDeep(v[k]); });
      return o;
    }
    return v;
  }

  function pill(code) {
    const cls = code >= 500 ? 'err' : code >= 400 ? 'deny' : 'ok';
    return '<span class="code ' + cls + '">' + code + '</span>';
  }

  function push(entry) {
    const li = document.createElement('li');
    li.className = 'entry pending';
    li.id = entry.id;
    li.innerHTML =
      '<div class="line">' + pill('…') +
      '<span class="verb">' + entry.method + '</span>' +
      '<span class="path"></span></div>' +
      (entry.note ? '<div class="note">' + entry.note + '</div>' : '') +
      '<pre class="body"></pre>';
    li.querySelector('.path').textContent = fill(entry.path);
    li.querySelector('.body').textContent = 'waiting for response…';
    log.prepend(li);
    countEl.textContent = '(' + log.children.length + ')';
    return li;
  }

  async function send(req, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const t0 = performance.now();
    try {
      const res = await fetch(fill(req.path), {
        method: req.method, headers,
        body: req.body === undefined || req.body === null ? undefined : JSON.stringify(fillDeep(req.body)),
      });
      const raw = await res.text();
      let text;
      try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch (e) { text = raw || '(empty body)'; }
      return { code: res.status, text: text, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { code: 'X', text: String(e && e.message || e), ms: Math.round(performance.now() - t0) };
    }
  }

  let seq = 0;
  async function fire(req) {
    const li = push({ ...req, id: 'r' + (++seq) });
    let token = ENV['token_' + req.token];
    let out = await send(req, token);

    // Tokens are minted per server boot, so a page left open across a restart is
    // the common cause of a wall of 401s. Pick up the new ones and retry once.
    if (out.code === 401 && req.token) {
      const fresh = await readEnv(true);
      const retry = fresh && fresh['token_' + req.token];
      if (retry && retry !== token) {
        token = retry;
        out = await send(req, token);
        out.text = '(retried with a fresh token from /dev/env.json)\n' + out.text;
      }
    }

    li.classList.remove('pending');
    li.querySelector('.line').innerHTML =
      pill(out.code) + '<span class="verb">' + req.method + '</span><span class="path"></span><span class="ms">' + out.ms + 'ms</span>';
    li.querySelector('.path').textContent = fill(req.path);
    li.querySelector('.body').textContent = out.text;

    // chain ids so later rows can reference the row that was just created
    try {
      const j = JSON.parse(out.text.replace(/^[^\{[][\s\S]*?\n(?=[\{\[])/, ''));
      if (j && j.id) {
        if (req.method === 'POST' && /\/policies(\?|$)/.test(req.path)) state.policyId = j.id;
        if (req.method === 'POST' && /\/announcements(\?|$)/.test(req.path)) state.annId = j.id;
        if (req.method === 'POST' && /\/invites(\?|$)/.test(req.path)) state.inviteId = j.id;
        if (req.method === 'POST' && /\/api\/books(\?|$)/.test(req.path)) state.newBookId = j.id;
        if (req.method === 'POST' && /\/api\/posts(\?|$)/.test(req.path)) state.newPostId = j.id;
        if (req.method === 'POST' && /\/collections(\?|$)/.test(req.path)) state.newCollectionId = j.id;
        if (req.method === 'POST' && /\/api\/comments(\?|$)/.test(req.path)) state.newCommentId = j.id;
        if (req.method === 'POST' && /\/conversations(\?|$)/.test(req.path)) state.conversationId = j.id;
      }
    } catch (e) { /* not json, ignore */ }
    return out;
  }

  function renderGroups() {
    const root = document.getElementById('groups');
    GROUPS.forEach(g => {
      const box = document.createElement('div');
      box.className = 'group';
      box.innerHTML = '<div class="group-title"></div>';
      box.querySelector('.group-title').textContent = g.title;
      g.items.forEach(req => {
        const b = document.createElement('button');
        b.className = 'req';
        b.innerHTML = '<span class="m ' + req.method.toLowerCase() + '">' + req.method + '</span><span class="n"></span>';
        b.querySelector('.n').textContent = req.name;
        b.onclick = () => fire(req);
        box.appendChild(b);
      });
      const all = document.createElement('button');
      all.className = 'group-run';
      all.textContent = 'run this group';
      all.onclick = async () => { for (const req of g.items) await fire(req); };
      box.appendChild(all);
      root.appendChild(box);
    });
  }

  async function readEnv(force) {
    const res = await fetch('/dev/env.json' + (force ? '?r=' + Date.now() : ''));
    if (!res.ok) throw new Error('env.json ' + res.status);
    ENV = await res.json();
    return ENV;
  }

  document.getElementById('runall').onclick = async () => {
    for (const g of GROUPS) for (const req of g.items) await fire(req);
  };
  document.getElementById('clear').onclick = () => { log.innerHTML = ''; countEl.textContent = ''; };
  document.getElementById('c-send').onclick = () => {
    let body = null;
    const raw = document.getElementById('c-body').value.trim();
    if (raw) { try { body = JSON.parse(raw); } catch (e) { body = raw; } }
    fire({
      name: 'custom', token: document.getElementById('c-token').value,
      method: document.getElementById('c-method').value,
      path: document.getElementById('c-path').value, body,
    });
  };

  (async function boot() {
    renderGroups();
    try {
      await readEnv(false);
      statusEl.className = 'status live';
      statusEl.textContent = 'live on ' + location.origin + ' · ' + Object.keys(ENV).length +
        ' seeded values · tokens valid until ' + (function () {
          try { return new Date(JSON.parse(atob(ENV.token_chief.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000).toLocaleTimeString(); }
          catch (e) { return 'unknown'; }
        })();
    } catch (e) {
      statusEl.className = 'status dead';
      statusEl.textContent = 'cannot read /dev/env.json — start it with: npm run dev:memory';
    }
  })();
}
