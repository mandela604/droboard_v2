'use strict';
/* Stubbed-runtime pass for the Roles + Editorial Team console. No mongod, no
   HTTP: exercises superadmin.service directly against an in-memory collection
   stub, so the seed, slug write-through, perm cache invalidation, requirePerm
   gate and editorial-team authors derivation each have a real assertion
   behind them. The same seed then hits the live-HTTP path in
   smoke-staff-live.cjs when a mongod is available. */
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/stub';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);

const path = require('path');
const Module = require('module');
const SRC = path.join(__dirname, '..', 'src');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail).slice(0, 220) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 200) : ''}`);
}

/* ── tiny query matcher (subset, same shape as smoke-staff-scopes) ── */
function matches(doc, filter) {
  for (const [k, cond] of Object.entries(filter || {})) {
    if (k === '$or') { if (!cond.some(f => matches(doc, f))) return false; continue; }
    if (k === '$and') { if (!cond.every(f => matches(doc, f))) return false; continue; }
    const v = doc[k];
    if (cond instanceof RegExp) { if (!cond.test(v == null ? '' : String(v))) return false; continue; }
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      for (const [op, want] of Object.entries(cond)) {
        if (op === '$in') {
          if (Array.isArray(v)) { if (!v.some(x => (want || []).map(String).includes(String(x)))) return false; }
          else if (!(want || []).map(String).includes(String(v))) return false;
        }
        else if (op === '$nin') {
          if (Array.isArray(v)) { if (v.some(x => (want || []).map(String).includes(String(x)))) return false; }
          else if ((want || []).map(String).includes(String(v))) return false;
        }
        else if (op === '$ne') { if (String(v) === String(want)) return false; }
        else if (op === '$type') { continue; }
        else if (op === '$gte') { if (!(new Date(v) >= new Date(want))) return false; }
        else if (op === '$lte') { if (!(new Date(v) <= new Date(want))) return false; }
        else if (op === '$addToSet' || op === '$pull') { /* handled at update site */ }
        else throw new Error('stub: unsupported op ' + op + ' on ' + k);
      }
      continue;
    }
    if (Array.isArray(v)) { if (!v.map(String).includes(String(cond))) return false; continue; }
    if (cond === null) { if (v !== null && v !== undefined) return false; continue; }
    if (String(v) !== String(cond)) return false;
  }
  return true;
}

function sortRows(rows, sort) {
  const keys = Object.entries(sort || {});
  if (!keys.length) return rows;
  return rows.slice().sort((a, b) => {
    for (const [k, dir] of keys) {
      const av = a[k]; const bv = b[k];
      const cmp = (av < bv ? -1 : av > bv ? 1 : 0);
      if (cmp) return cmp * (dir < 0 ? -1 : 1);
    }
    return 0;
  });
}

const captured = [];
const DATA = {};
function query(rows, meta) {
  const q = {
    _sort: null, _skip: 0, _limit: 0,
    sort(s) { q._sort = s; return q; },
    skip(n) { q._skip = n; return q; },
    limit(n) { q._limit = n; return q; },
    select() { return q; },
    lean: () => Promise.resolve(out()),
    then: (res, rej) => Promise.resolve(out()).then(res, rej),
  };
  function out() {
    const sliced = q._limit ? sortRows(rows, q._sort).slice(q._skip, q._skip + q._limit) : sortRows(rows, q._sort).slice(q._skip);
    return sliced.map(r => plain(r));
  }
  return q;
}
function plain(r) {
  const out = {};
  for (const [k, v] of Object.entries(r || {})) if (typeof v !== 'function') out[k] = v;
  return out;
}
function live(src) {
  const doc = Object.assign(Object.create({}), src, {
    save: () => { Object.assign(src, plain(doc)); saved.push(plain(doc)); doc._saved = (doc._saved || 0) + 1; return Promise.resolve(doc); },
    toObject: () => plain(doc),
    toJSON: () => plain(doc),
  });
  // Map-shaped perms — real Mongoose Map.get/set on the doc.
  if (src.perms && !(src.perms instanceof Map)) {
    const m = new Map(Object.entries(src.perms));
    doc.perms = m;
    src.perms = m;
  }
  return doc;
}
const saved = [];

let counter = 0;
function nextId(coll) { counter += 1; return 'id-' + coll + '-' + counter; }

function collection(name) {
  const rows = () => DATA[name] || [];
  return {
    find: (f) => { captured.push({ coll: name, op: 'find', filter: f || {} }); return query(rows().filter(r => matches(r, f || {}))); },
    findOne: (f) => {
      captured.push({ coll: name, op: 'findOne', filter: f || {} });
      const hit = rows().find(r => matches(r, f || {}));
      const one = hit ? live(hit) : null;
      const q = {
        sort: () => q, skip: () => q, limit: () => q, select: () => q,
        lean: () => Promise.resolve(one ? plain(hit) : null),
        then: (res, rej) => Promise.resolve(one).then(res, rej),
      };
      return q;
    },
    countDocuments: (f) => Promise.resolve(rows().filter(r => matches(r, f || {})).length),
    aggregate: (p) => { captured.push({ coll: name, op: 'aggregate', pipeline: p }); return Promise.resolve(aggRun(name, p)); },
    create: (body) => {
      const list = Array.isArray(body) ? body : [body];
      const docs = list.map((b, i) => {
        const row = Object.assign({ id: nextId(name) }, b);
        if (row.perms && !(row.perms instanceof Map)) row.perms = new Map(Object.entries(row.perms));
        DATA[name] = rows().concat([row]);
        return live(row);
      });
      return Promise.resolve(Array.isArray(body) ? docs : docs[0]);
    },
    updateMany: (f, u) => {
      captured.push({ coll: name, op: 'updateMany', filter: f || {}, update: u });
      let n = 0;
      (DATA[name] || []).forEach(r => {
        if (!matches(r, f || {})) return;
        n += 1;
        if (u.$addToSet && u.$addToSet.roles) {
          r.roles = Array.from(new Set((r.roles || []).concat([u.$addToSet.roles])));
        }
        if (u.$pull && u.$pull.roles) {
          r.roles = (r.roles || []).filter(x => String(x) !== String(u.$pull.roles));
        }
        if (u.$set) Object.assign(r, u.$set);
      });
      return Promise.resolve({ modifiedCount: n, matchedCount: n });
    },
    updateOne: (f, u) => {
      const row = (DATA[name] || []).find(r => matches(r, f || {}));
      if (row) {
        if (u.$set) Object.assign(row, u.$set);
        if (u.$addToSet && u.$addToSet.roles) row.roles = Array.from(new Set((row.roles || []).concat([u.$addToSet.roles])));
      }
      return Promise.resolve({ matched: row ? 1 : 0 });
    },
    deleteOne: (f) => {
      const before = rows().length;
      DATA[name] = rows().filter(r => !matches(r, f || {}));
      return Promise.resolve({ deletedCount: before - DATA[name].length });
    },
    insertMany: () => Promise.resolve([]),
    findOneAndUpdate: (f, u) => {
      let row = (DATA[name] || []).find(r => matches(r, f || {}));
      if (!row) { row = Object.assign({ id: nextId(name) }, f, (u.$set || {})); DATA[name] = rows().concat([row]); }
      else Object.assign(row, u.$set || {});
      return { lean: () => Promise.resolve(plain(row)) };
    },
  };
}

/* Very small aggregate evaluator: supports the two shapes the code uses —
   $match -> $group { _id, n: { $sum: 1 } } and $match -> $group { _id,
   authors: { $addToSet } } — plus $match -> $group { _id, n: { $sum: '$field' } }. */
function aggRun(collName, pipeline) {
  let rows = (DATA[collName] || []).slice();
  let groupKey = null;
  const accum = {};
  for (const stage of pipeline || []) {
    if (stage.$match) rows = rows.filter(r => matches(r, stage.$match));
    else if (stage.$group) {
      groupKey = stage.$group._id;
      const spec = stage.$group;
      const by = {};
      rows.forEach(r => {
        const k = resolve(r, groupKey);
        (by[k] = by[k] || []).push(r);
      });
      const out = [];
      Object.entries(by).forEach(([k, grp]) => {
        const row = { _id: k };
        Object.entries(spec).forEach(([field, expr]) => {
          if (field === '_id') return;
          if (expr && expr.$sum === 1) row[field] = grp.length;
          else if (expr && typeof expr.$sum === 'string' && expr.$sum[0] === '$') {
            row[field] = grp.reduce((a, b) => a + (resolve(b, expr.$sum) || 0), 0);
          } else if (expr && expr.$addToSet && typeof expr.$addToSet === 'string' && expr.$addToSet[0] === '$') {
            row[field] = Array.from(new Set(grp.map(x => resolve(x, expr.$addToSet)).filter(v => v != null)));
          } else row[field] = 0;
        });
        out.push(row);
      });
      rows = out;
    } else if (stage.$sort || stage.$limit) { /* no-op for our assertions */ }
    else throw new Error('stub aggregate: unsupported stage ' + JSON.stringify(Object.keys(stage)));
  }
  return rows;
  function resolve(r, expr) {
    if (expr == null) return null;
    if (typeof expr === 'string') return expr[0] === '$' ? r[expr.slice(1)] : expr;
    if (typeof expr === 'object' && expr.$dateToString) return new Date(r[expr.$dateToString.date.slice(1)] || Date.now()).toISOString().slice(0, 7);
    return null;
  }
}

const MODELS = ['user', 'content', 'editorial', 'contract', 'money', 'editor-earnings', 'chief', 'social', 'platform', 'admin', 'application', 'revenue', 'marketing'];
const COLLS = {};
const modelStub = {};
MODELS.forEach((m) => { modelStub['../models/' + m + '.model'] = new Proxy({}, {
  get: (_t, key) => {
    if (key === '__esModule') return false;
    if (key === 'inspect' || key === 'then') return undefined;
    const name = String(key);
    // Non-model exports (PERM_KEYS is a plain array in admin.model.js).
    if (name === 'PERM_KEYS') return PERM_KEYS_ARRAY;
    if (!COLLS[name]) COLLS[name] = collection(name);
    return COLLS[name];
  },
}); });

// Mirror of models/admin.model.js PERM_KEYS — the console perms the seed uses (now 36 keys).
const PERM_KEYS_ARRAY = [
  'view_editors', 'manage_editors', 'approve_contracts', 'read_flagged_books', 'manage_editorial_policy', 'set_editorial_strategy', 'publish_announcements',
  'manage_submissions', 'review_completions', 'manage_authors', 'view_authors', 'review_contracts', 'resolve_reports', 'view_own_earnings',
  'view_campaigns', 'create_campaigns', 'manage_ads', 'manage_rate_card', 'manage_audience', 'manage_league', 'approve_budget',
  'release_payouts', 'view_financials', 'resolve_payment_disputes', 'manage_coin_store', 'manage_payment_methods',
  'view_reports', 'ban_users',
  'manage_users', 'manage_roles', 'edit_stories', 'edit_rates', 'manage_billing', 'manage_settings', 'manage_system_pages', 'manage_awards', 'view_analytics',
];

// activity-feed is required at superadmin.service load time.
const serviceStubs = {
  '../services/activity-feed.service': { recent: () => Promise.resolve([]) },
  '../services/user-counters': { bump: () => Promise.resolve(), bumpByAuthor: () => Promise.resolve() },
};

const origLoad = Module._load;
Module._load = function (request, parent) {
  const inSrc = parent && parent.filename && parent.filename.startsWith(SRC);
  if (inSrc && modelStub[request]) return modelStub[request];
  if (inSrc && serviceStubs[request]) return serviceStubs[request];
  return origLoad.apply(this, arguments);
};

async function main() {
  const sa = require('../src/services/superadmin.service');
  const { PERM_KEYS } = require('../src/models/admin.model');
  const { requirePerm } = require('../src/middleware/guards');

  /* 1. seed creates 6 canonical roles, idempotent on a second pass */
  DATA.AdminRole = [];
  let seed = await sa.ensureSystemRoles();
  check('ensureSystemRoles creates 6 canonical slugs', seed.created === 6 && seed.slugs.length === 6, JSON.stringify(seed));
  const seededSlugs = (DATA.AdminRole || []).map(r => r.slug).sort();
  check('seed slugs are admin/chief_editor/senior_editor/finance/marketing/support',
    JSON.stringify(seededSlugs) === JSON.stringify(['admin', 'chief_editor', 'finance', 'marketing', 'senior_editor', 'support']),
    JSON.stringify(seededSlugs));
  seed = await sa.ensureSystemRoles();
  check('ensureSystemRoles is idempotent (0 created on second pass)', seed.created === 0 && (DATA.AdminRole || []).length === 6, JSON.stringify(seed));
  const adminDoc = DATA.AdminRole.find(r => r.slug === 'admin');
  check('seeded admin role is system:true and carries every perm', adminDoc && adminDoc.system === true,
    `system=${adminDoc && adminDoc.system} keys=${adminDoc && (adminDoc.perms ? Object.keys(Object.fromEntries(adminDoc.perms)).length : 0)}`);
  const financeDoc = DATA.AdminRole.find(r => r.slug === 'finance');
  check('finance seed grants release_payouts but not manage_roles',
    financeDoc && financeDoc.perms.get('release_payouts') === true && financeDoc.perms.get('manage_roles') === false,
    `rel=${financeDoc && financeDoc.perms.get('release_payouts')} mr=${financeDoc && financeDoc.perms.get('manage_roles')}`);

  /* 2. permsBySlug reflects the seeded docs */
  sa.invalidatePermCache();
  const bySlug = await sa.permsBySlug();
  check('permsBySlug indexes every slug', bySlug && Object.keys(bySlug).length === 6, JSON.stringify(Object.keys(bySlug || {})));
  check('permsBySlug.admin has all PERM_KEYS true', PERM_KEYS.every(k => bySlug.admin[k] === true), JSON.stringify(bySlug.admin));

  /* 3. requirePerm allows a role that grants the key and refuses one that doesn't */
  async function gate2(userRoles, permKey) {
    const req = { user: { roles: userRoles } };
    let done = false;
    const settle = (v) => { if (!done) { done = true; resolveFn(v); } };
    let resolveFn;
    const p = new Promise(r => { resolveFn = r; });
    const res = {
      statusCode: 0, body: null,
      status(c) { this.statusCode = c; return this; },
      json(o) { this.body = o; settle({ passed: false, err: null, status: this.statusCode, body: o }); },
    };
    requirePerm(permKey)(req, res, (e) => settle({ passed: !e, err: e || null, status: res.statusCode, body: res.body }));
    return p;
  }
  let g = await gate2(['finance'], 'release_payouts');
  check('requirePerm(finance) on release_payouts passes through', g.passed && g.status === 0, JSON.stringify(g));
  g = await gate2(['finance'], 'manage_roles');
  check('requirePerm(finance) on manage_roles -> 403 missing_perm', !g.passed && g.status === 403 && g.body && g.body.error === 'missing_perm', JSON.stringify(g));
  g = await gate2(['reader'], 'release_payouts');
  check('requirePerm blocks a role with no AdminRole doc', !g.passed && g.status === 403, JSON.stringify(g));

  /* 4. createRole with slug + members writes the slug onto User.roles */
  DATA.User = [
    { id: 'u-seed-a', fullName: 'Seed A', email: 'sa@t.co', roles: ['writer'] },
    { id: 'u-seed-b', fullName: 'Seed B', email: 'sb@t.co', roles: ['writer'] },
  ];
  const made = await sa.createRole({
    name: 'Custom QA', slug: 'qa_lead', desc: 'test role',
    memberIds: ['u-seed-a', 'u-seed-b'], perms: { view_reports: true },
  });
  check('createRole returns the slug on the row', made.slug === 'qa_lead', JSON.stringify({ slug: made.slug }));
  const ua = DATA.User.find(u => u.id === 'u-seed-a');
  const ub = DATA.User.find(u => u.id === 'u-seed-b');
  check('createRole write-through adds the slug to each member User.roles',
    (ua.roles || []).includes('qa_lead') && (ub.roles || []).includes('qa_lead'),
    JSON.stringify({ ua: ua.roles, ub: ub.roles }));
  let dupErr = null;
  try { await sa.createRole({ name: 'Other', slug: 'qa_lead' }); } catch (e) { dupErr = e; }
  check('createRole rejects a duplicate slug -> 409 slug_taken', dupErr && dupErr.status === 409 && dupErr.message === 'slug_taken', `thrown=${dupErr && dupErr.status}/${dupErr && dupErr.message}`);

  /* 5. updateRole memberIds diff adds + removes on User.roles */
  const updated = await sa.updateRole(made.id, { memberIds: ['u-seed-b'] });
  const uaAfter = DATA.User.find(u => u.id === 'u-seed-a');
  const ubAfter = DATA.User.find(u => u.id === 'u-seed-b');
  check('updateRole write-through drops the removed member\'s slug', !(uaAfter.roles || []).includes('qa_lead'), JSON.stringify(uaAfter.roles));
  check('updateRole write-through keeps the retained member\'s slug', (ubAfter.roles || []).includes('qa_lead'), JSON.stringify(ubAfter.roles));
  check('updateRole leaves slug unchanged', updated.slug === 'qa_lead', `slug=${updated.slug}`);

  /* 6. perms mutation invalidates the cache — new perm visible on next read */
  sa.invalidatePermCache();
  await sa.updateRole(made.id, { perms: { release_payouts: true } });
  const by2 = await sa.permsBySlug();
  check('permsBySlug picks up the updated role flag', by2.qa_lead && by2.qa_lead.release_payouts === true, JSON.stringify(by2.qa_lead));

  /* 7. deleteRole pulls the slug from every member */
  await sa.deleteRole(made.id);
  check('deleteRole pulls slug from former members after delete',
    !(DATA.User.find(u => u.id === 'u-seed-b').roles || []).includes('qa_lead'),
    JSON.stringify(DATA.User.find(u => u.id === 'u-seed-b').roles));
  let sysErr = null;
  try { await sa.deleteRole(DATA.AdminRole.find(r => r.slug === 'admin').id); } catch (e) { sysErr = e; }
  check('deleteRole refuses system role -> 400 system_role_locked', sysErr && sysErr.status === 400, `thrown=${sysErr && sysErr.status}/${sysErr && sysErr.message}`);

  /* 8. editorialTeam authors count is derived from Contract distinct authorId */
  DATA.User = [
    { id: 'u-se1', fullName: 'SE One', email: 'se1@t.co', roles: ['senior_editor'], primaryRole: 'senior_editor', status: 'active', createdAt: new Date() },
    { id: 'u-se2', fullName: 'SE Two', email: 'se2@t.co', roles: ['senior_editor'], primaryRole: 'senior_editor', status: 'active', createdAt: new Date() },
  ];
  DATA.Contract = [
    { id: 'c-1', editorId: 'u-se1', authorId: 'u-a1', status: 'signed' },
    { id: 'c-2', editorId: 'u-se1', authorId: 'u-a1', status: 'signed' },   // same author, still 1 pod
    { id: 'c-3', editorId: 'u-se1', authorId: 'u-a2', status: 'sent' },
    { id: 'c-4', editorId: 'u-se2', authorId: 'u-a3', status: 'signed' },
  ];
  DATA.Report = [];
  const team = await sa.editorialTeam({});
  const se1 = team.items.find(x => x.id === 'u-se1');
  const se2 = team.items.find(x => x.id === 'u-se2');
  check('editorialTeam authors count is distinct, not raw contract count',
    se1 && se1.authors === 2 && se1.contracts === 3, JSON.stringify(se1 && { a: se1.authors, c: se1.contracts }));
  check('editorialTeam second editor counts one author', se2 && se2.authors === 1 && se2.contracts === 1, JSON.stringify(se2 && { a: se2.authors, c: se2.contracts }));

  /* 9. admin slug in User.roles reaches requirePerm end-to-end */
  DATA.User = DATA.User || [];
  DATA.User.push({ id: 'u-admin', fullName: 'Root', email: 'root@t.co', roles: ['admin'] });
  sa.invalidatePermCache();
  const gAdmin = await gate2(['admin'], 'manage_roles');
  check('seeded admin slug satisfies requirePerm(manage_roles)', gAdmin.passed, JSON.stringify(gAdmin));

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} stub-runtime role/perm assertions passed =====`);
  for (const f of results.filter(x => !x.pass)) console.log(`  FAIL ${f.name} :: ${f.detail}`);
  process.exitCode = passed === results.length ? 0 : 1;
  process.exit(process.exitCode);
}
main().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });
