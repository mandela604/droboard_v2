'use strict';
/* scripts/audit-shapes-live.cjs
   Live contract audit for the three staff consoles. Boots the REAL Express app
   on an in-memory Mongo, seeds production-shaped rows, then enumerates every
   GET route mounted under /api/senior-editor, /api/chief and /api/super-admin,
   calls it with the right role token, and records the JSON key shape it
   actually returns.

   Output: scripts/audit-shapes.json  (machine-diffable: route -> shape)
           scripts/audit-shapes.txt   (human-readable, one line per route)

   This file is the ground-truth half of the frontend-wiring audit; the
   frontend's expected fields are diffed against it separately. */
process.env.NODE_ENV = 'test';
process.env.PORT = '4250';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 4250;
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitReady() {
  for (let i = 0; i < 240; i++) {
    try { const res = await fetch(BASE + '/health'); if (res.ok) return; } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('api never came up on ' + BASE);
}

/* ── route enumeration ──
   server.js builds the app inside main() and never exports it, so the routers
   are required directly and walked with the same mount prefixes server.js uses.
   That keeps the audit honest: these are the live modules, at the live paths. */
const MOUNTS = [
  { prefix: '/api/senior-editor', modules: ['senior.routes'] },
  {
    prefix: '/api/chief',
    modules: ['chief-reports.routes', 'chief-overview.routes', 'chief-moderation.routes',
      'chief-growth.routes', 'chief-content.routes', 'chief-contracts.routes',
      'chief-editors.routes', 'chief-earnings.routes'],
  },
  { prefix: '/api/super-admin', modules: ['admin.routes'] },
];

function collect(stack, prefix, out) {
  for (const layer of stack || []) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
      for (const m of methods) out.push({ method: m.toUpperCase(), path: prefix + layer.route.path });
    } else if (layer.handle && layer.handle.stack) {
      collect(layer.handle.stack, prefix + (layer.mountpath || ''), out);
    }
  }
  return out;
}

function allScopedRoutes() {
  const out = [];
  for (const m of MOUNTS) {
    for (const mod of m.modules) {
      const router = require('../src/routes/' + mod);
      collect(router.stack, m.prefix, out);
    }
  }
  // The same path can appear on two chief routers (they share a prefix); dedupe.
  const seen = new Set();
  return out.filter((r) => {
    const k = r.method + ' ' + r.path;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ── shape extraction ──
   Records `a.b[].c : type` for every key the response actually carries.
   Arrays are sampled from element 0 (the render loop reads element 0). */
const MAX_DEPTH = 5;
function shapeOf(val, path, out, depth) {
  depth = depth || 0;
  if (val === null || val === undefined) { out[path || '(root)'] = 'null'; return out; }
  if (Array.isArray(val)) {
    out[path || '(root)'] = 'array[' + val.length + ']';
    if (val.length && depth < MAX_DEPTH) shapeOf(val[0], (path ? path + '[]' : '[]'), out, depth + 1);
    return out;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (!path) out['(root)'] = 'object{' + keys.length + '}';
    for (const k of keys) {
      const np = path ? path + '.' + k : k;
      shapeOf(val[k], np, out, depth + 1);
    }
    if (path && !keys.length) out[path] = 'object{}';
    return out;
  }
  out[path || '(root)'] = typeof val;
  return out;
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_shape_audit');
  console.log('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  await waitReady();

  const { User, AuditLog } = require('../src/models/user.model');
  const { Book, Chapter } = require('../src/models/content.model');
  const { Contract } = require('../src/models/contract.model');
  const { Report } = require('../src/models/editorial.model');
  const { AdminRole } = require('../src/models/admin.model');
  const { signAccess } = require('../src/middleware/auth');

  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const mk = (n, e, roles, extra) => User.create(Object.assign({
    fullName: n, email: e, username: e.split('@')[0], passwordHash: DUMMY,
    status: 'active', primaryRole: roles[0], roles,
  }, extra || {}));

  const admin = await mk('Tobenna Achebe', 'tobi@droboard.com', ['admin'], { platformRoles: ['superadmin'] });
  const chief = await mk('Ada Nwosu', 'ada@droboard.com', ['chief_editor']);
  const se = await mk('Zainab Bello', 'zainab@droboard.com', ['senior_editor']);
  const se2 = await mk('Peter Obi', 'peter@droboard.com', ['senior_editor']);
  const writer = await mk('Ifeanyi Story', 'ifeanyi@droboard.com', ['writer'], { emailVerified: true });
  const reader = await mk('Chioma Reader', 'chioma@droboard.com', ['reader'], { emailVerified: true });

  const book = await Book.create({
    title: 'The runaway bride', authorId: String(writer.id), status: 'published',
    genre: 'Twist Fiction', reads: 900, cover: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
  });
  const book2 = await Book.create({
    title: 'My stepmother stole my fund', authorId: String(writer.id), status: 'under_review',
    genre: 'Revenge Drama', reads: 300, cover: 'https://i.postimg.cc/ftRZbhKx/3.jpg',
  });
  const chapter = await Chapter.create({
    bookId: String(book.id), title: 'Ch 1', content: 'x'.repeat(1200), n: 1,
    words: 300, status: 'published', price: 20,
  });

  let contractId = '', reportId = '';
  try {
    const c = await Contract.create({
      authorId: String(writer.id), bookId: String(book.id), status: 'pending',
      type: 'Publishing', templateId: 'tpl_standard', editorId: String(se.id),
    });
    contractId = String(c.id);
  } catch (e) { console.log('contract seed skipped:', e.message); }
  try {
    const rp = await Report.create({
      storyId: String(book.id), title: 'Suspicious reupload', desc: 'Reader flagged identical text',
      type: 'plagiarism', severity: 'high', status: 'pending',
      seId: String(se.id), reporterId: String(reader.id), reporterLabel: 'chioma_reader',
    });
    reportId = String(rp.id);
  } catch (e) { console.log('report seed skipped:', e.message); }
  try {
    await AdminRole.create({
      name: 'Platform Ops', slug: 'admin', memberIds: [String(admin.id)],
      perms: { approve_contracts: true, view_financials: true, ban_users: true, manage_roles: true },
    });
  } catch (e) { console.log('role seed skipped:', e.message); }

  /* The SE pod is EditorAssignment-driven (senior.service.scopeAuthorIds), so
     without it every /api/senior-editor list returns an empty array and a field
     diff is impossible. Seed the assignment plus the workflow rows the SE pages
     render, using production field shapes. */
  const { EditorAssignment, Policy } = require('../src/models/chief.model');
  const { Announcement: EditorialAnnouncement } = require('../src/models/editorial.model');
  const app = require('../src/models/application.model');
  try {
    await EditorAssignment.create({ editorId: String(se.id), authorIds: [String(writer.id)] });
  } catch (e) { console.log('assignment seed skipped:', e.message); }
  // Separate blocks: an enum typo here previously aborted the whole chain and
  // left the later lists empty, which reads as a backend gap but isn't one.
  try {
    await app.ChapterEdit.create({
      bookId: String(book.id), chapterId: String(chapter.id), authorId: String(writer.id),
      proposed: { title: 'Ch 1 (edited)', content: 'y'.repeat(900) }, status: 'pending',
    });
  } catch (e) { console.log('chapterEdit seed skipped:', e.message); }
  try {
    await app.BookEdit.create({
      bookId: String(book.id), authorId: String(writer.id),
      proposed: { title: 'The runaway bride (retitled)' }, status: 'pending',
    });
  } catch (e) { console.log('bookEdit seed skipped:', e.message); }
  try {
    await app.CompletionApplication.create({
      bookId: String(book.id), authorId: String(writer.id), chapters: 40, status: 'pending',
    });
  } catch (e) { console.log('completion seed skipped:', e.message); }
  try {
    // 'applied' is the enum default the contract-applications query filters on.
    await app.ContractApplication.create({
      bookId: String(book.id), authorId: String(writer.id), status: 'applied',
      contractId, verificationId: '',
    });
  } catch (e) { console.log('contractApplication seed skipped:', e.message); }
  try {
    await app.VipApplication.create({
      bookId: String(book.id), authorId: String(writer.id), scope: 'book_lock',
      reason: 'Reader requested early access', status: 'pending',
    });
  } catch (e) { console.log('vip seed skipped:', e.message); }
  try {
    await app.AuthorVerification.create({
      name: 'Ifeanyi Story', email: 'ifeanyi@droboard.com', userId: String(writer.id),
      docType: 'Government_ID', docUrl: 'https://i.postimg.cc/ftRZbhKx/3.jpg',
      status: 'pending',
      kyc: {
        type: 'self', dob: '1996-04-02', age: 30, nin: '10234567891',
        idPhotos: {
          front: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
          back: 'https://i.postimg.cc/ftRZbhKx/3.jpg',
        },
      },
    });
  } catch (e) { console.log('verification seed skipped:', e.message); }
  // Contract templates feed both the chief console editor and the SE offer
  // dropdown; without them both lists dump empty and the row shape is unverifiable.
  try {
    const { ContractTemplate } = require('../src/models/contract.model');
    await ContractTemplate.create({
      name: 'Standard Publishing', type: 'Publishing', status: 'active',
      desc: 'Default deal', clauseText: 'Royalty 70%, term 12 months.',
      royaltyRate: 70, termLength: '12 months', defaultChapterPrice: 20, currency: 'USD',
    });
  } catch (e) { console.log('template seed skipped:', e.message); }
  try {
    await EditorialAnnouncement.create({
      title: 'Q4 review SLA', content: 'Turnaround drops to 48h', audience: 'authors',
      status: 'published', type: 'update',
    });
    await Policy.create({ title: 'Chapter pricing policy', body: 'Max 40 coins', status: 'active', author: String(chief.id) });
  } catch (e) { console.log('announcement/policy seed skipped:', e.message); }
  try {
    await AuditLog.create({
      actorId: String(se.id), actorRole: 'senior_editor', action: 'admin.reports.resolve',
      entity: 'Report', entityId: reportId, ip: '10.0.0.4', ua: 'audit-harness', at: new Date(),
    });
  } catch (e) { console.log('audit seed skipped:', e.message); }

  /* A missing entity is a 404, which tells us nothing about the shape; each
     path-param name is steered at a real seeded id so the handler reaches its
     mapping code and returns the body the console would render. */
  const idFor = {
    id: [String(book.id), String(se.id), String(chief.id), String(admin.id), String(contractId), String(reportId)],
    bookId: [String(book.id)], authorId: [String(writer.id)], editorId: [String(se.id)],
    seniorEditorId: [String(se.id)], contractId: [contractId].filter(Boolean),
    chapterId: [String(chapter.id)], userId: [String(reader.id), String(writer.id)],
    reportId: [reportId].filter(Boolean), writerId: [String(writer.id)],
  };

  const routes = allScopedRoutes();
  // Optional argv scope filter: `node audit-shapes-live.cjs senior` re-runs one
  // console only, which matters because the limiter paces this walk to minutes.
  const scopeArg = String(process.argv[2] || '');
  const scopeMap = { senior: '/api/senior-editor', chief: '/api/chief', admin: '/api/super-admin' };
  const scopePrefix = scopeMap[scopeArg] || null;
  const getRoutes = routes
    .filter((r) => r.method === 'GET')
    .filter((r) => !scopePrefix || r.path.startsWith(scopePrefix))
    .sort((a, b) => a.path.localeCompare(b.path));

  console.log('enumerated GET routes in scope: ' + getRoutes.length);

  async function callAs(user, urlPath) {
    // generalLimiter is 120 req/min per IP; this harness walks every route, so
    // stay under it rather than reading 429s back as "no data".
    for (let attempt = 0; attempt < 6; attempt++) {
      await sleep(540);
      const res = await fetch(BASE + urlPath, { headers: { Authorization: 'Bearer ' + signAccess(user) } });
      if (res.status !== 429) {
        let json = null; try { json = await res.json(); } catch (e) { json = { __nonJson: true }; }
        return { status: res.status, json };
      }
      await sleep(12000);
    }
    return { status: 429, json: { __rateLimited: true } };
  }

  // A route under a role's prefix is called with that role's token.
  function tokenFor(path) {
    if (path.startsWith('/api/senior-editor')) return se;
    if (path.startsWith('/api/chief')) return chief;
    return admin;
  }

  const out = {};
  const lines = [];
  let ok = 0, bad = 0;
  for (const r of getRoutes) {
    // Try each candidate id until one returns 200, so a single-param route with
    // an ambiguous id (user vs book) still yields its real shape.
    let best = null;
    const paramNames = [...r.path.matchAll(/:(\w+)/g)].map((m) => m[1]);
    const combos = paramNames.length ? candidates(paramNames, idFor) : [''];
    for (const c of combos) {
      const filled = r.path.replace(/:(\w+)/g, (_, k) => c[k] || '');
      if (/:/.test(filled)) { best = best || { status: 0, json: { __unresolvedParam: filled } }; continue; }
      const res = await callAs(tokenFor(r.path), filled);
      if (!best || res.status === 200) best = { ...res, url: filled };
      if (res.status === 200) break;
    }
    if (!best) best = { status: 0, json: { __noCandidate: paramNames.join(',') } };
    const body = best.json && best.json.data !== undefined ? best.json.data : best.json;
    const shape = shapeOf(body, '', {}, 0);
    out[r.method + ' ' + r.path] = { status: best.status, url: best.url || r.path, shape };
    const keys = Object.keys(shape).slice(0, 40).map((k) => k + ':' + shape[k]);
    lines.push(`${best.status}  ${r.method} ${r.path}\n      ${keys.join('  ')}`);
    if (best.status === 200) ok++; else bad++;
    console.log(`${best.status}  ${r.path}`);
  }

  function candidates(paramNames, idFor) {
    const lists = paramNames.map((n) => (idFor[n] && idFor[n].length ? idFor[n] : ['']));
    let acc = [{}];
    paramNames.forEach((n, i) => {
      acc = acc.flatMap((prev) => lists[i].map((v) => Object.assign({}, prev, { [n]: v })));
    });
    return acc.slice(0, 12);
  }

  const suffix = scopePrefix ? '-' + scopeArg : '';
  fs.writeFileSync('scripts/audit-shapes' + suffix + '.json', JSON.stringify(out, null, 2));
  fs.writeFileSync('scripts/audit-shapes' + suffix + '.txt',
    `LIVE BACKEND SHAPE DUMP — ${new Date().toISOString()}\n` +
    `${ok} routes returned 200, ${bad} did not.\n\n` + lines.join('\n') + '\n');
  console.log(`\nwrote scripts/audit-shapes${suffix}.json — ${ok} ok / ${bad} non-200`);
  await mongod.stop();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
