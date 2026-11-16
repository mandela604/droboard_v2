'use strict';
// Reproduces "apply for contract → asked to verify identity" and checks that
// the application appears in the author contract list AND the verification
// request carries every field the senior verification table needs.
process.env.NODE_ENV = 'test';
process.env.PORT = '4205';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BASE = 'http://127.0.0.1:4205';
const out = [];
function check(name, pass, detail) {
  out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ::  ' + JSON.stringify(detail).slice(0, 260) : ''}`);
  console.log(out[out.length - 1]);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_verif_page');
  require('../src/server');
  for (let i = 0; i < 160; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 250)); }

  // No Cloudinary in a smoke run: keep the real service call, stub only the
  // bytes-to-URL step so idPhotos are realistic delivery URLs.
  const media = require('../src/services/media.service');
  media.uploadImageBuffer = async () => 'https://res.cloudinary.com/demo/image/upload/front.jpg';

  const { User } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { EditorAssignment } = require('../src/models/chief.model');
  const { signAccess } = require('../src/middleware/auth');
  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const mk = async (label, roles) => User.create({
    fullName: label, email: label + '@t.co', username: label + Date.now(),
    passwordHash: DUMMY, roles, status: 'active',
  });
  const editor = await mk('Editor', ['senior_editor']);
  const writer = await mk('Author', ['writer']);
  const book = await Book.create({ title: 'Contract Book', authorId: String(writer.id), status: 'draft' });
  await EditorAssignment.create({ editorId: String(editor.id), authorIds: [String(writer.id)] });
  const wt = signAccess({ id: writer.id, roles: ['writer'] });
  const et = signAccess({ id: editor.id, roles: ['senior_editor'] });
  const hdr = (t) => ({ Authorization: 'Bearer ' + t });

  const fd = new FormData();
  fd.append('data', JSON.stringify({
    bookId: String(book.id),
    kyc: { type: 'self', dob: '1996-05-14', nin: '12345678901' },
  }));
  fd.append('idFront', new Blob(['front'], { type: 'image/jpeg' }), 'front.jpg');
  fd.append('idBack', new Blob(['back'], { type: 'image/jpeg' }), 'back.jpg');
  let r = await fetch(BASE + '/api/author/contracts', { method: 'POST', headers: hdr(wt), body: fd });
  let j = await r.json().catch(() => ({}));
  check('apply with KYC returns 201', r.status === 201, { status: r.status, body: j });

  r = await fetch(BASE + '/api/author/contracts', { headers: hdr(wt) });
  j = await r.json();
  const row = (Array.isArray(j) ? j : (j.books || j.items || [])).find(x => String(x.id || x.bookId) === String(book.id));
  check('author contract page shows the pending application', !!row && (row.status === 'applied' || row.contractStatus === 'applied'), row);
  check('author contract page shows identity pending (not approved)', !!row && row.verificationStatus === 'pending', row && row.verificationStatus);

  r = await fetch(BASE + '/api/senior-editor/author-verification/requests', { headers: hdr(et) });
  j = await r.json();
  const v = (Array.isArray(j) ? j : (j.items || []))[0];
  check('verification request reaches the senior editor', !!v, { count: (Array.isArray(j) ? j : []).length });
  check('row has the author name + email (not blank)', !!v && v.author && v.author !== '—' && v.email && v.email === writer.email, v && { author: v.author, email: v.email });
  check('row has a real document label + submitted date', !!v && v.document && v.document !== 'No documents' && v.submitted && v.submitted !== '—', v && { document: v.document, submitted: v.submitted });
  check('row has reviewer + status', !!v && !!v.reviewer && !!v.status, v && { reviewer: v.reviewer, status: v.status });
  check('row carries kyc + id photos for the detail panel', !!v && !!v.kyc && !!v.kyc.idPhotos && !!v.kyc.idPhotos.front && !!v.kyc.idPhotos.back, v && v.kyc);

  r = await fetch(BASE + '/api/senior-editor/contract-applications', { headers: hdr(et) });
  j = await r.json().catch(() => []);
  const apps = Array.isArray(j) ? j : (j.items || []);
  check('the contract application also exists for the editor', apps.some(a => String(a.bookId) === String(book.id)), apps.map(a => a.bookId));

  fs.writeFileSync(__dirname + '/smoke-verification-page.results.txt', out.join('\n') + '\n');
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
main().catch(e => { console.error(e); fs.writeFileSync(__dirname + '/smoke-verification-page.results.txt', 'FATAL ' + (e.stack || e)); process.exit(1); });
