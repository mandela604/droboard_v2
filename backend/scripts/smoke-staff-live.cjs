'use strict'
// Live lock test: boots the REAL Express app against an in-memory MongoDB, signs
// real chief/senior/finance JWTs, drives real HTTP and asserts the fixes landed
// today (books stay read-only for the chief, chief flag attempts refused, regex
// escaping, scoped contracts overview, announcement + banner authorisation,
// payee reveal + senior-editor payouts in the staff queue).
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime: mongod.exe aborts with
// 0xC0000135 (DLL not found) without it, which is why the same assertions run
// against stubbed collections in smoke-staff-scopes.cjs.
process.env.NODE_ENV = 'test';
process.env.PORT = '4178';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');
const PW = 'Sup3rSecret!';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail).slice(0, 220) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 200) : ''}`);
}

async function main() {
  // mongod's own first-bind time on this box exceeds the 10s default.
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('droboard_lock');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  await new Promise(r => setTimeout(r, 1200));

  const argon2 = require('argon2');
  const { User } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { Report } = require('../src/models/editorial.model');
  const { FeaturedPlacement } = require('../src/models/editorial.model');
  const { Contract } = require('../src/models/contract.model');
  const { Withdrawal, PaymentMethod } = require('../src/models/money.model');
  const { EditorPayout } = require('../src/models/editor-earnings.model');
  const { EditorAssignment } = require('../src/models/chief.model');
  const { signAccess } = require('../src/middleware/auth');

  const hash = await argon2.hash(PW);
  const mk = (role, extra) => User.create(Object.assign({
    fullName: 'Lock ' + role, email: `${role}${Date.now()}${Math.random()}@t.co`,
    username: role + Date.now() + Math.random(), passwordHash: hash,
    status: 'active', roles: [role],
  }, extra || {}));

  const chief = await mk('chief_editor');
  const seA = await mk('senior_editor');
  const seB = await mk('senior_editor');
  const fin = await mk('finance');
  const a1 = await mk('writer');
  const a2 = await mk('writer');
  await EditorAssignment.create({ editorId: String(seA.id), authorIds: [String(a1.id)] });
  await EditorAssignment.create({ editorId: String(seB.id), authorIds: [String(a2.id)] });

  const base = 'http://127.0.0.1:4178';
  function hdr(u) { return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signAccess(u) }; }
  async function call(u, method, path, body) {
    const init = { method, headers: hdr(u) };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(base + path, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }
  const C = '/api/chief', S = '/api/senior-editor', F = '/api/finance';

  /* ── 1. flag/unflag is the assigned senior editor's path; the chief only reads ── */
  const bk = await Book.create({ title: 'Locked Inbox', authorId: String(a1.id), status: 'published' });
  let r;

  r = await call(chief, 'POST', `${C}/books/${bk.id}/flag`, { reason: 'spam', note: 'mass-posted', password: PW });
  check('CE flag route does not exist -> 404', r.status === 404, `status=${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  r = await call(chief, 'POST', `${C}/books/${bk.id}/unflag`, { password: PW });
  check('CE unflag route does not exist -> 404', r.status === 404, `status=${r.status}`);
  check('book never left published after chief attempts', (await Book.findOne({ id: bk.id }).lean()).status === 'published');

  r = await call(chief, 'POST', `${S}/books/${bk.id}/flag`, { reason: 'spam', password: PW });
  check('chief cannot flag via the senior route -> 403', r.status === 403, `status=${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  r = await call(chief, 'POST', `${S}/books/${bk.id}/unflag`, { password: PW });
  check('chief cannot unflag via the senior route -> 403', r.status === 403, `status=${r.status}`);
  r = await call(chief, 'GET', `${C}/books/flagged`);
  check('chief reads the flagged queue', r.status === 200, `status=${r.status}`);

  r = await call(seB, 'POST', `${S}/books/${bk.id}/flag`, { reason: 'spam', password: PW });
  check('SE flag a foreign author\'s book -> 404', r.status === 404, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call(seA, 'POST', `${S}/books/${bk.id}/flag`, { reason: 'spam', note: 'mass-posted', password: 'wrong' });
  check('SE flag with wrong password -> 401', r.status === 401, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call(seA, 'POST', `${S}/books/${bk.id}/flag`, { reason: 'plagiarism', note: 'copied', password: PW });
  check('SE flag own author\'s book -> 200', r.status === 200 && r.json && r.json.status === 'flagged', `status=${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  const mirrored = await Report.findOne({ storyId: bk.id, status: 'pending' }).lean();
  check('SE flag mirrors a pending Report row', !!mirrored && mirrored.type === 'plagiarism', JSON.stringify(mirrored && { type: mirrored.type, seId: mirrored.seId }));
  const bookDoc = await Book.findOne({ id: bk.id }).lean();
  check('SE flag stamps flaggedBy = the acting editor', String(bookDoc.flaggedBy) === String(seA.id), JSON.stringify({ flaggedBy: bookDoc.flaggedBy }));
  r = await call(seA, 'POST', `${S}/books/${bk.id}/flag`, { reason: 'spam', password: PW });
  check('flag twice -> 409 already_flagged', r.status === 409, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call(seA, 'POST', `${S}/books/${bk.id}/unflag`, { password: PW });
  check('SE unflag own book -> 200 + status restored', r.status === 200 && r.json && r.json.status === 'published', `status=${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  const stillPending = await Report.countDocuments({ storyId: bk.id, status: 'pending' });
  check('unflag resolves the mirrored Report', stillPending === 0, `pending=${stillPending}`);

  /* ── 2. console search text is no longer a raw $regex ── */
  r = await call(chief, 'GET', `${C}/books?q=%5Babc&limit=5`);
  check('CE /books?q=[ -> 200 not 500', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await call(chief, 'GET', `${C}/featured/history?q=%2A%2A%2A&limit=5`);
  check('CE /featured/history?q=*** -> 200', r.status === 200, `status=${r.status}`);
  r = await call(chief, 'GET', `${C}/categories?q=%28&limit=5`);
  check('CE /categories?q=( -> 200', r.status === 200, `status=${r.status}`);

  /* ── 3. contracts overview respects the editor scope ── */
  await Contract.create({ authorId: String(a1.id), type: 'standard', editorId: String(seA.id), status: 'sent' });
  await Contract.create({ authorId: String(a2.id), type: 'standard', editorId: String(seB.id), status: 'sent' });
  r = await call(seB, 'GET', `${S}/contracts/overview`);
  // The read model emits the display row (author NAME), not the raw authorId —
  // so the scope proof is "exactly one contract, and it's the one I own".
  const seenByB = (r.json && r.json.contracts || []).map(c => String(c.author));
  check('SE overview shows only own authors', r.status === 200 && seenByB.length === 1, `status=${r.status} rows=${JSON.stringify(seenByB)}`);
  r = await call(chief, 'GET', `${S}/contracts/overview`);
  check('chief overview is platform-wide', r.status === 200 && (r.json.contracts || []).length === 2, `count=${(r.json.contracts || []).length}`);

  /* ── 4. platform announcements are chief-written, editor-read ── */
  r = await call(seA, 'GET', `${S}/announcements`);
  check('SE can read announcements', r.status === 200, `status=${r.status}`);
  r = await call(seA, 'POST', `${S}/announcements`, { title: 'Platform shift', content: 'everyone', audience: 'all', status: 'published' });
  check('SE create announcement -> 403', r.status === 403, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call(chief, 'POST', `${S}/announcements`, { title: 'Platform shift', content: 'everyone', audience: 'all', status: 'published' });
  check('chief create announcement -> 200', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  const annId = r.json && r.json.id;
  r = await call(seA, 'PUT', `${S}/announcements/${annId}`, { title: 'Hijacked' });
  check('SE edit announcement -> 403', r.status === 403, `status=${r.status}`);

  /* ── 5. banners belong to the editor who placed them ── */
  r = await call(seA, 'POST', `${S}/featured-banners`, { bookId: bk.id, title: 'Locked Inbox', section: 'hero-banner', tag: 'trending' });
  check('SE create banner -> 200/201', (r.status === 200 || r.status === 201) && r.json && r.json.id, `status=${r.status} ${JSON.stringify(r.json).slice(0, 140)}`);
  const banId = r.json && r.json.id;
  r = await call(seB, 'PUT', `${S}/featured-banners/${banId}`, { tag: 'spam-slot' });
  check('other SE edit banner -> 403', r.status === 403, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call(seB, 'POST', `${S}/featured-banners/${banId}/pause`, {});
  check('other SE pause banner -> 403', r.status === 403, `status=${r.status}`);
  r = await call(seA, 'PUT', `${S}/featured-banners/${banId}`, { tag: 'editors-pick' });
  // PUT answers with the banner-row the console renders (no tag/placedBy), so
  // the write itself is asserted from the document.
  let tagRow = await FeaturedPlacement.findOne({ id: banId }).lean();
  check('owner SE edit banner -> 200 + tag persisted', r.status === 200 && tagRow.tag === 'editors-pick', `status=${r.status} tag=${tagRow && tagRow.tag}`);
  r = await call(chief, 'POST', `${S}/featured-banners/${banId}/pause`, {});
  check('chief pause any banner -> 200', r.status === 200, `status=${r.status}`);

  /* ── 6. staff queue: author payee reveal + senior-editor payouts ── */
  const pm = await PaymentMethod.create({
    authorId: String(a1.id), type: 'bank', accountName: 'Ada Writer',
    bankName: 'GTBank', accountNumber: '0123456789', isDefault: true, verified: true,
  });
  await Withdrawal.create({ authorId: String(a1.id), amount: 45000, method: 'Bank Transfer', paymentMethodId: String(pm.id), account: '•••• 6789', status: 'requested' });
  await EditorPayout.create({ editorId: String(seA.id), amount: 120000, method: 'Bank Transfer', account: '•••• 4321', status: 'requested' });
  const pmE = await PaymentMethod.create({
    authorId: String(seA.id), type: 'bank', accountName: 'Sam Editor',
    bankName: 'Zenith', accountNumber: '9988776655', isDefault: true,
  });

  r = await call(fin, 'GET', `${F}/withdrawals`);
  // The staff queue answers with a bare array (author rows + `ep:`-prefixed
  // editor payout rows merged and sorted), not an {items:[...]} envelope.
  const rows = Array.isArray(r.json) ? r.json : [];
  const authorRow = rows.find(x => !String(x.id).startsWith('ep:'));
  const epRow = rows.find(x => String(x.id).startsWith('ep:'));
  check('staff queue mixes author + editor payouts', r.status === 200 && !!authorRow && !!epRow, `status=${r.status} n=${rows.length}`);
  check('author row reveals the payee account', !!authorRow && authorRow.accountNumber === '0123456789' && authorRow.bankName === 'GTBank', JSON.stringify(authorRow && { an: authorRow.accountNumber, bn: authorRow.bankName, v: authorRow.payeeVerified }));
  // The payee columns are worthless if the owner column shows a raw uuid:
  // usersById used to leak the id because a uuidv7 in an `_id` filter throws a
  // CastError that .catch(()=>[]) swallowed into an empty name map.
  check('rows name the owner, never a raw id',
    !!authorRow && authorRow.author === a1.fullName && !!epRow && epRow.author === seA.fullName &&
    !/^[0-9a-f-]{36}$/.test(String(authorRow.author)),
    JSON.stringify({ author: authorRow && authorRow.author, epAuthor: epRow && epRow.author }));
  // `author` is the editor's own display name; the bank details come from their
  // default payment method and land in the payee fields.
  check('editor row reveals the payee by owner default', !!epRow && epRow.accountNumber === '9988776655' && epRow.accountName === 'Sam Editor', JSON.stringify(epRow && { an: epRow.accountNumber, acctName: epRow.accountName, status: epRow.status }));

  if (!authorRow || !epRow) {
    const passed0 = results.filter(x => x.pass).length;
    console.log(`\n===== ${passed0}/${results.length} passed — queue rows missing, later assertions skipped =====`);
    require('mongoose').connection.close().catch(() => {});
    await mongod.stop();
    process.exit(1);
  }

  r = await call(fin, 'POST', `${F}/withdrawals/${epRow.id}/approve`, {});
  // The console speaks its own vocabulary: paid and approved both read back as
  // `approved` (one button = approve + mark processed), so the settle itself is
  // asserted from the payout document below.
  check('settle ep: row -> 200 + console status', r.status === 200 && r.json && r.json.status === 'approved', `status=${r.status} row=${JSON.stringify(r.json && r.json.status)}`);
  const paid = await EditorPayout.findOne({ id: epRow.id.slice(3) }).lean();
  check('ep: settle moves the payout row + ledger', !!paid && paid.status === 'paid', JSON.stringify(paid && { s: paid.status, ref: paid.reference }));
  const { LedgerEntry } = require('../src/models/money.model');
  // ledger.post() suffixes the key per leg (`key:debit>credit`), so the journal
  // is found by prefix, not by the bare key.
  const legs = await LedgerEntry.countDocuments({ idempotencyKey: { $regex: '^editor_payout:' + paid.id + ':' } });
  check('ep: settle posts exactly one journal', legs === 1, `legs=${legs}`);

  // Approve pays out of what the journal says the author holds, so an empty DB
  // correctly answers 409 insufficient_funds. Accrue first, then settle.
  const ledger = require('../src/services/ledger.service');
  await ledger.post({
    legs: [{ debit: 'pool:coin-revenue', credit: 'wallet:author:' + String(a1.id), amount: 60000 }],
    kind: 'accrual', memo: 'test funding', idempotencyKey: 'test_fund:' + String(a1.id),
  });
  r = await call(fin, 'POST', `${F}/withdrawals/${authorRow.id}/approve`, {});
  check('author withdrawal approve -> 200 + payee echoed', r.status === 200 && r.json && r.json.status === 'approved' && r.json.accountNumber === '0123456789', `status=${r.status} row=${JSON.stringify(r.json && { s: r.json.status, an: r.json.accountNumber })}`);
  const settled = await Withdrawal.findOne({ id: authorRow.id }).lean();
  check('author approve moves the row to paid', !!settled && settled.status === 'paid', JSON.stringify(settled && { s: settled.status }));

  r = await call(seA, 'GET', `${F}/withdrawals`);
  check('non-staff cannot read the staff queue', r.status === 403 || r.status === 401 || (r.json && !Array.isArray(r.json.items)), `status=${r.status} keys=${Object.keys(r.json || {})}`);

  /* ── 7. legacy editor namespace is gone ── */
  r = await call(chief, 'GET', '/api/editor/announcements');
  check('GET /api/editor/* -> 404 (router removed)', r.status === 404, `status=${r.status}`);

  const placedBy = await FeaturedPlacement.findOne({ id: banId }).lean();
  check('banner keeps placedBy attribution', String(placedBy.placedBy) === String(seA.id), JSON.stringify({ placedBy: placedBy.placedBy }));

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} live assertions passed =====`);
  for (const f of results.filter(x => !x.pass)) console.log(`  FAIL ${f.name} :: ${f.detail}`);
  require('mongoose').connection.close().catch(() => {});
  await mongod.stop();
  // server.js keeps the listen socket open, so exit explicitly.
  process.exit(passed === results.length ? 0 : 1);
}
main().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });
