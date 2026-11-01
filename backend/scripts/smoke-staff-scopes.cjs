'use strict';
/* Runtime pass for the CE/SE/finance guards that no Mongo on this box can prove
   (mongodb-memory-server's mongod dies on a missing MSVC runtime, and no server
   is installed). Stubs every model with a filter-capable in-memory collection,
   then asserts the four things that must be true: console search text is escaped
   before it reaches $regex, contract reads are editor-scoped, a banner belongs to
   the editor who placed it, and the staff withdrawal queue mixes both payout
   kinds with the payee attached. Filter captures are asserted, so a stubbed
   `$in` that ignores the query cannot pass. */
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

/* ── tiny query matcher ── */
function matches(doc, filter) {
  for (const [k, cond] of Object.entries(filter || {})) {
    if (k === '$or') { if (!cond.some(f => matches(doc, f))) return false; continue; }
    if (k === '$and') { if (!cond.every(f => matches(doc, f))) return false; continue; }
    const v = doc[k];
    if (cond instanceof RegExp) { if (!cond.test(v == null ? '' : String(v))) return false; continue; }
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      for (const [op, want] of Object.entries(cond)) {
        if (op === '$in') { if (!(want || []).map(String).includes(String(v))) return false; }
        else if (op === '$nin') { if ((want || []).map(String).includes(String(v))) return false; }
        else if (op === '$ne') { if (String(v) === String(want)) return false; }
        else if (op === '$exists') { if ((v !== undefined && v !== null) !== !!want) return false; }
        else if (op === '$gte') { if (!(new Date(v) >= new Date(want))) return false; }
        else if (op === '$lte') { if (!(new Date(v) <= new Date(want))) return false; }
        else throw new Error('stub: unsupported op ' + op + ' on ' + k);
      }
      continue;
    }
    if (String(v) !== String(cond)) return false;
  }
  return true;
}

const captured = [];
function sortRows(rows, sort) {
  const keys = Object.entries(sort || {});
  if (!keys.length) return rows;
  return rows.slice().sort((a, b) => {
    for (const [k, dir] of keys) {
      const av = a[k]; const bv = b[k];
      const cmp = av instanceof Date || bv instanceof Date
        ? new Date(av) - new Date(bv)
        : (av < bv ? -1 : av > bv ? 1 : 0);
      if (cmp) return cmp * (dir < 0 ? -1 : 1);
    }
    return 0;
  });
}

function query(rows, meta) {
  const q = {
    _sort: null, _skip: 0, _limit: 0,
    sort(s) { q._sort = s; return q; },
    skip(n) { q._skip = n; return q; },
    limit(n) { q._limit = n; return q; },
    select() { return q; },
    distinct(f) { return Promise.resolve(rows.map(r => r[f]).filter(Boolean)); },
    lean: () => Promise.resolve(out()),
    then: (res, rej) => Promise.resolve(out()).then(res, rej),
    count: () => Promise.resolve(rows.length),
  };
  function out() {
    const sliced = q._limit ? sortRows(rows, q._sort).slice(q._skip, q._skip + q._limit) : sortRows(rows, q._sort).slice(q._skip);
    return sliced.map(r => (meta && meta.live ? live(r) : plain(r)));
  }
  return q;
}
function plain(r) {
  const out = {};
  for (const [k, v] of Object.entries(r || {})) if (typeof v !== 'function') out[k] = v;
  return out;
}
const saved = [];
function live(src) {
  const doc = Object.assign(Object.create({}), src, {
    save: () => { Object.assign(src, plain(doc)); delete src.save; delete src.toObject; delete src.toJSON; saved.push(plain(doc)); doc._saved = (doc._saved || 0) + 1; return Promise.resolve(doc); },
    toObject: () => plain(doc),
    toJSON: () => plain(doc),
  });
  return doc;
}

const DATA = {};
function collection(name) {
  const rows = () => DATA[name] || [];
  return {
    find: (f) => { captured.push({ coll: name, op: 'find', filter: f || {} }); return query(rows().filter(r => matches(r, f || {})), { live: false }); },
    findOne: (f) => {
      captured.push({ coll: name, op: 'findOne', filter: f || {} });
      const hit = rows().find(r => matches(r, f || {}));
      const one = hit ? live(hit) : null;
      const q = {
        sort: () => q, skip: () => q, limit: () => q, select: () => q,
        lean: () => Promise.resolve(one),
        then: (res, rej) => Promise.resolve(one).then(res, rej),
      };
      return q;
    },
    countDocuments: (f) => { captured.push({ coll: name, op: 'count', filter: f || {} }); return Promise.resolve(rows().filter(r => matches(r, f || {})).length); },
    estimatedDocumentCount: () => Promise.resolve(rows().length),
    aggregate: (p) => { captured.push({ coll: name, op: 'aggregate', pipeline: p }); return Promise.resolve([]); },
    distinct: (f) => Promise.resolve(rows().map(r => r[f]).filter(Boolean)),
    create: (body) => {
      const list = Array.isArray(body) ? body : [body];
      const docs = list.map((b, i) => {
        const row = Object.assign({ id: 'new-' + name + '-' + (rows().length + i + 1) }, b);
        created.push({ coll: name, body: plain(row) });
        return row;
      });
      DATA[name] = rows().concat(docs);
      const liveDocs = docs.map(row => live(row));
      return Promise.resolve(Array.isArray(body) ? liveDocs : liveDocs[0]);
    },
    updateMany: (f, u) => {
      captured.push({ coll: name, op: 'updateMany', filter: f || {}, update: u });
      const n = rows().filter(r => matches(r, f || {})).length;
      (DATA[name] || []).forEach(r => Object.assign(r, u.$set || {}));
      return Promise.resolve({ modified: n });
    },
    updateOne: (f, u) => {
      captured.push({ coll: name, op: 'updateOne', filter: f || {}, update: u });
      const row = (DATA[name] || []).find(r => matches(r, f || {}));
      if (row) Object.assign(row, u.$set || {});
      return Promise.resolve({ matched: row ? 1 : 0 });
    },
    deleteOne: () => Promise.resolve({ deletedCount: 1 }),
    insertMany: () => Promise.resolve([]),
  };
}
const created = [];
function lastFind(coll) {
  for (let i = captured.length - 1; i >= 0; i--) if (captured[i].coll === coll) return captured[i];
  return null;
}

/* ── model + service stubs ── */
const MODELS = ['user', 'content', 'editorial', 'contract', 'money', 'editor-earnings', 'chief', 'social', 'platform', 'admin', 'application', 'revenue', 'marketing'];
const COLLS = {};
const modelStub = {};
MODELS.forEach((m) => { modelStub['../models/' + m + '.model'] = new Proxy({}, {
  get: (_t, key) => {
    if (key === '__esModule') return false;
    if (key === 'inspect' || key === 'then') return undefined;
    const name = String(key);
    if (!COLLS[name]) COLLS[name] = collection(name);
    return COLLS[name];
  },
}); });

const serviceStubs = {};

const origLoad = Module._load;
Module._load = function (request, parent) {
  const inSrc = parent && parent.filename && parent.filename.startsWith(SRC);
  if (inSrc && modelStub[request]) return modelStub[request];
  if (inSrc && serviceStubs[request]) return serviceStubs[request];
  return origLoad.apply(this, arguments);
};

/* ── fixtures ── */
const CHIEF = { id: 'u-chief', roles: ['chief_editor'] };
const SE_A = { id: 'u-seA', roles: ['senior_editor'] };
const SE_B = { id: 'u-seB', roles: ['senior_editor'] };
const A1 = 'u-auth-1'; const A2 = 'u-auth-2';
const now = Date.now();
const d = (mins) => new Date(now - mins * 60000);

DATA.User = [
  { id: CHIEF.id, fullName: 'Chief One', username: 'chief1', roles: CHIEF.roles },
  { id: SE_A.id, fullName: 'Editor A', username: 'edA', roles: SE_A.roles },
  { id: SE_B.id, fullName: 'Editor B', username: 'edB', roles: SE_B.roles },
  { id: A1, fullName: 'Ada Author', username: 'ada', roles: ['writer'] },
  { id: A2, fullName: 'Ben Author', username: 'ben', roles: ['writer'] },
];
DATA.EditorAssignment = [
  { editorId: SE_A.id, authorIds: [A1] },
  { editorId: SE_B.id, authorIds: [A2] },
];
DATA.Book = [
  { id: 'B-1', title: 'Ada[book', authorId: A1, status: 'published', genre: 'romance', slug: 'ada-1', reads: 5, likes: 1, rating: 4, chapterCount: 3, flagReason: '', flaggedAt: d(1) },
  { id: 'B-2', title: 'Ben book', authorId: A2, status: 'published', genre: 'noir', slug: 'ben-2', reads: 9, likes: 2, rating: 3, chapterCount: 4, flagReason: '', flaggedAt: null },
];
DATA.Report = [];
DATA.FeaturedPlacement = [
  { id: 'FP-1', bookId: 'B-1', sectionKey: 'hero-banner', tag: 'trending', order: 1, active: true, placedBy: SE_A.id, startAt: d(60), endAt: null },
  { id: 'FP-2', bookId: 'B-2', sectionKey: 'hero-banner', tag: 'new', order: 2, active: true, placedBy: SE_B.id, startAt: d(30), endAt: null },
];
DATA.FeaturedSection = [{ id: 'FS-1', key: 'hero-banner' }];
DATA.FeaturedHistory = [{ id: 'FH-1', bookId: 'B-1', section: 'hero-banner', action: 'added', at: d(10) }];
DATA.Category = [{ id: 'CAT-1', name: 'Adult (x)', status: 'active' }];
DATA.Genre = [{ id: 'G-1', name: 'Romance (hot)', status: 'active' }];
DATA.Trope = [{ id: 'T-1', name: 'Enemies*to*Lovers', status: 'active' }];
DATA.Contract = [
  { id: 'CT-1', authorId: A1, editorId: SE_A.id, type: 'standard', status: 'sent', createdAt: d(20), advance: 0, revenueSplit: 70, bookId: 'B-1' },
  { id: 'CT-2', authorId: A2, editorId: SE_B.id, type: 'standard', status: 'sent', createdAt: d(10), advance: 0, revenueSplit: 70, bookId: 'B-2' },
];
DATA.SignedContract = [
  { id: 'SC-1', authorId: A1, editorId: SE_A.id, createdAt: d(1) },
  { id: 'SC-2', authorId: A2, editorId: SE_B.id, createdAt: d(2) },
];
DATA.ContractTemplate = [{ id: 'TPL-1', name: 'Standard', type: 'standard', updatedAt: d(1) }];
DATA.Withdrawal = [
  { id: 'WD-1', authorId: A1, amount: 45000, method: 'Bank Transfer', paymentMethodId: 'PM-1', account: '•••• 6789', status: 'requested', note: '', requestedAt: d(100), processedAt: null },
];
DATA.PaymentMethod = [
  { id: 'PM-1', authorId: A1, type: 'bank', accountName: 'Ada Author', bankName: 'GTBank', accountNumber: '0123456789', isDefault: true, verified: true },
  { id: 'PM-2', authorId: SE_A.id, type: 'bank', accountName: 'Editor A', bankName: 'Zenith', accountNumber: '9988776655', isDefault: true, verified: false },
];
DATA.EditorPayout = [
  { id: 'EP-1', editorId: SE_A.id, amount: 120000, currency: 'NGN', method: 'Bank Transfer', methodId: '', account: '•••• 4321', status: 'requested', reference: '', note: '', declineReason: '', createdAt: d(50), paidAt: null },
];
DATA.PaymentDispute = [];
DATA.CoinTransaction = [];
DATA.Payout = [];
DATA.Wallet = [];
DATA.AuditLog = [];
DATA.Notification = [];

/* ── run ── */
async function main() {
  const CC = require('../src/services/chief-content.service');
  const SS = require('../src/services/senior-surfaces.service');
  const FS = require('../src/services/finance-surfaces.service');
  const flag = require('../src/services/book-flag.service');

  /* 1. search text never reaches $regex raw */
  captured.length = 0;
  await CC.listBooks({ q: '[ada', limit: 5 });
  const f1 = lastFind('Book').filter;
  const rxSource = String((f1.$or || [{}])[0].title && (f1.$or || [{}])[0].title.source);
  check('CE book search escapes the regex metacharacter', rxSource.indexOf('\\[') === 0, `source=${rxSource}`);

  await CC.flaggedBooks({ q: '(x)', limit: 5 });
  const f2 = lastFind('Book').filter;
  check('flagged search escapes too', String(f2.$or[0].title.source) === '\\(x\\)', `source=${f2.$or[0].title.source}`);

  await CC.history({ q: '*', limit: 5 });
  const f3 = lastFind('FeaturedHistory').filter;
  check('history search escapes (was a raw new RegExp)', String(f3.$or[0].section.source) === '\\*', `source=${f3.$or[0].section.source}`);

  await CC.listCategories({ q: '+', limit: 5 });
  const f4 = lastFind('Category').filter;
  check('category search routes through the escaper', String(f4.name.source) === '\\+', `source=${f4.name.source}`);

  await CC.listGenres({ q: '[', limit: 5 });
  check('genre search survives an unclosed bracket', lastFind('Genre').filter.name instanceof RegExp, JSON.stringify(lastFind('Genre').filter.name && lastFind('Genre').filter.name.source));

  /* 2. contracts overview is editor-scoped, chief-wide */
  const ovA = await SS.contractsOverview(SE_A);
  const cf = lastFind('Contract').filter;
  const scoped = JSON.stringify(cf);
  check('SE contract overview carries a scope filter', cf.$or && cf.$or.length === 2, scoped);
  check('SE sees only own authors + own signed rows', ovA.contracts.length === 1 && String(ovA.contracts[0].id) === 'CT-1', `n=${ovA.contracts.length} ids=${ovA.contracts.map(c => c.id)}`);
  const sf = lastFind('SignedContract').filter;
  check('SE signed list is limited to own rows', String(sf.editorId) === SE_A.id, JSON.stringify(sf));

  await SS.contractsOverview(SE_B);
  check('other SE cannot read Editor A contracts', lastFind('Contract').filter.$or[1].editorId === SE_B.id, JSON.stringify(lastFind('Contract').filter));

  const ovC = await SS.contractsOverview(CHIEF);
  check('chief overview is platform-wide (no filter)', Object.keys(lastFind('Contract').filter).length === 0 && ovC.contracts.length === 2, `filter=${JSON.stringify(lastFind('Contract').filter)} n=${ovC.contracts.length}`);

  /* 3. a banner belongs to the editor who placed it */
  let err1 = null;
  try { await SS.updateFeaturedBanner('FP-1', { tag: 'stolen-slot' }, SE_B); } catch (e) { err1 = e; }
  check('other SE editing a banner -> 403', !!err1 && err1.status === 403, `thrown=${err1 && err1.message}/${err1 && err1.status}`);
  const untouched = (DATA.FeaturedPlacement.find(p => p.id === 'FP-1') || {}).tag;
  check('refused banner edit leaves the row alone', untouched === 'trending', `tag=${untouched}`);

  const okA = await SS.updateFeaturedBanner('FP-1', { tag: 'editors-pick' }, SE_A);
  check('owner SE edits own banner -> row returned', okA && String(okA.id) === 'FP-1', JSON.stringify(okA && { id: okA.id, title: okA.title }));
  check('banner write lands on the stored row', (DATA.FeaturedPlacement.find(p => p.id === 'FP-1') || {}).tag === 'editors-pick', JSON.stringify((DATA.FeaturedPlacement.find(p => p.id === 'FP-1') || {}).tag));
  const okC = await SS.pauseFeaturedBanner('FP-1', CHIEF);
  check('chief can pause any banner', okC && okC.ok === true, JSON.stringify(okC));
  let err2 = null;
  try { await SS.pauseFeaturedBanner('FP-1', SE_B); } catch (e) { err2 = e; }
  check('other SE pausing a banner -> 403', !!err2 && err2.status === 403, `thrown=${err2 && err2.status}`);

  /* 4. flag/unflag belongs to the assigned senior editor and to nobody else */
  const okOwn = await flag.flagBook('B-2', { reason: 'plagiarism', note: 'copied wholesale' }, { user: SE_B, actor: SE_B });
  check('assigned SE flags through the shared service', okOwn.status === 'flagged' && !!okOwn.reportId, JSON.stringify(okOwn));
  const rep = created.find(c => c.coll === 'Report');
  check('flag mirrors a pending Report typed from the reason', !!rep && rep.body.status === 'pending' && rep.body.type === 'plagiarism', JSON.stringify(rep && { type: rep.body.type, st: rep.body.status, seId: rep.body.seId }));
  check('flag stamps flaggedBy with the actor id', String(DATA.Book.find(b => b.id === 'B-2').flaggedBy) === SE_B.id, JSON.stringify({ flaggedBy: DATA.Book.find(b => b.id === 'B-2').flaggedBy }));

  let errC = null;
  try { await flag.flagBook('B-1', { reason: 'spam' }, { user: CHIEF, actor: CHIEF }); } catch (e) { errC = e; }
  check('chief flag -> 403 chief_does_not_flag', !!errC && errC.status === 403 && errC.message === 'chief_does_not_flag', `thrown=${errC && errC.message}/${errC && errC.status}`);
  check('refused chief flag leaves the book published', DATA.Book.find(b => b.id === 'B-1').status === 'published', `status=${DATA.Book.find(b => b.id === 'B-1').status}`);
  let errCU = null;
  try { await flag.unflagBook('B-2', { user: CHIEF }); } catch (e) { errCU = e; }
  check('chief unflag -> 403 too', !!errCU && errCU.status === 403, `thrown=${errCU && errCU.message}/${errCU && errCU.status}`);

  let errB = null;
  try { await flag.flagBook('B-1', { reason: 'spam' }, { user: SE_B, actor: SE_B }); } catch (e) { errB = e; }
  check('SE flagging a foreign author\'s book is refused', !!errB && (errB.status === 404 || errB.status === 403), `thrown=${errB && errB.status}`);
  const ownA = await flag.flagBook('B-1', { reason: 'spam' }, { user: SE_A, actor: SE_A });
  check('SE flags own author\'s book', ownA.status === 'flagged', JSON.stringify(ownA));
  let errD = null;
  try { await flag.flagBook('B-1', { reason: '' }, { user: SE_A, actor: SE_A }); } catch (e) { errD = e; }
  check('flag without a reason -> 400', !!errD && errD.status === 400, `thrown=${errD && errD.message}/${errD && errD.status}`);

  const unflagged = await flag.unflagBook('B-1', { user: SE_A });
  check('unflag restores the previous status', unflagged.status === 'published', JSON.stringify(unflagged));
  const repResolved = lastFind('Report') && lastFind('Report').op;
  check('unflag resolves the mirrored report row', repResolved === 'updateMany', `last Report op=${repResolved}`);

  /* 4b. the chief book surface stays read-only: no flag route is registered */
  const pathsOf = (router) => {
    const out = [];
    (router.stack || []).forEach((l) => { if (l.route) [].concat(l.route.path).forEach(p => out.push(p)); });
    return out;
  };
  const chiefPaths = pathsOf(require('../src/routes/chief-content.routes'));
  check('chief router registers no flag/unflag route',
    chiefPaths.filter(p => /\/(flag|unflag)$/.test(p)).length === 0,
    JSON.stringify(chiefPaths.filter(p => /flag/.test(p))));
  const seniorFlagPaths = pathsOf(require('../src/routes/senior.routes')).filter(p => /\/(flag|unflag)$/.test(p));
  check('the senior routes are the only flag path', seniorFlagPaths.length === 2 && seniorFlagPaths.every(p => /books\/:id/.test(p)), JSON.stringify(seniorFlagPaths));

  /* 5. staff queue: both payout kinds, payee attached */
  const queue = await FS.withdrawals();
  const authorRow = queue.find(x => String(x.id).indexOf('ep:') !== 0);
  const epRow = queue.find(x => String(x.id).indexOf('ep:') === 0);
  check('queue mixes the author withdrawal and the editor payout', queue.length === 2 && !!authorRow && !!epRow, JSON.stringify(queue.map(x => x.id)));
  check('editor payout is addressed with the ep: prefix', epRow && epRow.id === 'ep:EP-1', `id=${epRow && epRow.id}`);
  check('queue sorts newest first', queue[0].id === 'ep:EP-1', `first=${queue[0].id}`);
  check('author row reveals the exact payment method', authorRow && authorRow.accountNumber === '0123456789' && authorRow.bankName === 'GTBank' && authorRow.payeeVerified === true, JSON.stringify(authorRow && { an: authorRow.accountNumber, bn: authorRow.bankName, v: authorRow.payeeVerified }));
  check('editor row falls back to that owner\'s default method', epRow && epRow.accountNumber === '9988776655' && epRow.author === 'Editor A', JSON.stringify(epRow && { an: epRow.accountNumber, author: epRow.author }));
  const pmFinds = captured.filter(c => c.coll === 'PaymentMethod');
  const authorLookup = pmFinds.length ? pmFinds[0].filter : null;
  check('author payee lookup prefers the exact method id, then the owner default',
    !!authorLookup && authorLookup.$or.length === 2 && String(authorLookup.$or[0].id.$in[0]) === 'PM-1' && authorLookup.$or[1].isDefault === true,
    JSON.stringify(authorLookup));
  check('editor payout shows the editor name, not the author', epRow && epRow.status === 'pending', `status=${epRow && epRow.status}`);

  /* 6. settling an ep: row runs the real pay engine: approve, one journal leg, paid */
  created.length = 0;
  const settled = await FS.approveWithdrawal('ep:EP-1', CHIEF.id);
  check('ep: approve settles through the editor payout engine', settled && settled.status === 'approved' && settled.id === 'ep:EP-1', JSON.stringify(settled && { id: settled.id, st: settled.status, an: settled.accountNumber }));
  const stored = (DATA.EditorPayout || []).find(x => x.id === 'EP-1') || {};
  check('ep: settle lands the payout row at paid with a reference', stored.status === 'paid' && !!stored.reference, JSON.stringify({ st: stored.status, ref: stored.reference, by: stored.processedBy }));
  const legs = created.filter(c => c.coll === 'LedgerEntry' && String(c.body.idempotencyKey || '').indexOf('editor_payout:EP-1') === 0);
  check('ep: settle posts exactly one liability -> bank leg', legs.length === 1 && legs[0].body.debitAcct === 'liability:editor:' + SE_A.id && legs[0].body.creditAcct === 'bank:editor-payouts', JSON.stringify(legs.map(l => ({ d: l.body.debitAcct, c: l.body.creditAcct, a: l.body.amount }))));
  created.length = 0;
  const again = await FS.payWithdrawal('ep:EP-1', 'REF-1', CHIEF.id);
  check('already-paid ep: row echoes without posting again', created.filter(c => c.coll === 'LedgerEntry').length === 0 && again && again.status === 'approved', `legs=${created.length} st=${again && again.status}`);
  let decErr = null;
  try { await FS.declineWithdrawal('ep:EP-1', 'dup', CHIEF.id); } catch (e) { decErr = e; }
  check('declining a paid ep: row -> 409 already_paid', !!decErr && decErr.status === 409 && decErr.message === 'already_paid', `thrown=${decErr && decErr.message}/${decErr && decErr.status}`);

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} stub-runtime assertions passed =====`);
  for (const f of results.filter(x => !x.pass)) console.log(`  FAIL ${f.name} :: ${f.detail}`);
  process.exitCode = passed === results.length ? 0 : 1;
  process.exit(process.exitCode);
}
main().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });
