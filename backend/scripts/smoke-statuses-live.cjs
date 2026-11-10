'use strict';
/* Live in-memory Mongo test for the statuses create→read→view→like→delete chain.
   Proves the HTTP contract the live frontend consumes (no demo path anywhere):
     POST /api/statuses            gradient preset + storyRef → 201
     POST /api/statuses            pasted hotlink bg → 400 bg_must_be_uploaded
     POST /api/statuses            bad storyRef cover → 201, cover dropped only
     GET  /api/statuses/me         owner slide + views:0; guest → 401
     GET  /api/statuses/writers    UPPERCASE handle resolves (casing fix), storyRef rides
     POST /api/statuses/:id/view   owner preview uncounted; reader + guest counted once
     GET  /api/statuses/:id/viewers owner named+guests; non-owner → 403
     POST /api/statuses/:id/like   toggle on/off
     GET  /api/statuses/state      per-viewer has/total/unseen/ring
     DELETE /api/statuses/:id      me empty after */
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4211';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
delete process.env.GOOGLE_CLIENT_ID;

const { MongoMemoryServer } = require('mongodb-memory-server');
const out = [];
function check(name, pass, detail) {
  out.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 260) : ''}`);
}

const GRADIENT = 'linear-gradient(135deg,#4c0519,#1c0208)'; // composer preset #8
const CF_URL = 'https://imagedelivery.net/acctHash/status01/public';

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 90000 } });
  process.env.MONGO_URI = mongod.getUri('dro_statuses_live');
  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) { /* not up */ }
    await new Promise(r => setTimeout(r, 250));
  }
  async function call(method, path, body, access) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (access) headers.Authorization = `Bearer ${access}`;
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  // Owner posts with a MixedCase handle — the /writers lookup must still match.
  let r = await call('POST', '/api/auth/signup', { name: 'Ada Writes', username: 'AdaWrites', email: 'ada@test.co', password: 'SecurePass123!' });
  check('Seed signup owner -> 2xx', r.status >= 200 && r.status < 300, `${r.status}`);
  r = await call('POST', '/api/auth/login', { emailOrUsername: 'adawrites', password: 'SecurePass123!' });
  const ownerToken = r.json && r.json.access;
  check('Seed login owner -> token', r.status === 200 && !!ownerToken, `${r.status}`);
  r = await call('POST', '/api/auth/signup', { name: 'Reader One', username: 'readerone', email: 'ro@test.co', password: 'SecurePass123!' });
  r = await call('POST', '/api/auth/login', { emailOrUsername: 'readerone', password: 'SecurePass123!' });
  const readerToken = r.json && r.json.access;
  check('Seed login reader -> token', r.status === 200 && !!readerToken, `${r.status}`);

  // ── Create: gradient preset + storyRef ──
  r = await call('POST', '/api/statuses', {
    bg: GRADIENT, quote: 'Chapter 21 is live tonight.', caption: 'His Sweet Revenge · New chapter',
    storyRef: { id: 'st_42', title: 'His Sweet Revenge', author: 'AdaWrites', cover: CF_URL },
  }, ownerToken);
  const created = r.json || {};
  check('C1 POST gradient + storyRef -> 201 with id', r.status === 201 && !!created.id, `${r.status} ${JSON.stringify(r.json)}`);
  check('C2 storyRef persisted (id/title/author/cover)',
    created.storyRef && created.storyRef.id === 'st_42' && created.storyRef.title === 'His Sweet Revenge' && created.storyRef.cover === CF_URL,
    JSON.stringify(created.storyRef));
  check('C3 time label + 24h expiry present', created.time === 'Just now' && !!created.expiresAt, `${created.time} ${created.expiresAt}`);
  const SID = String(created.id || '');

  // ── Create guards ──
  r = await call('POST', '/api/statuses', { bg: 'https://example.com/hotlink.jpg' }, ownerToken);
  check('C4 pasted hotlink bg -> 400 bg_must_be_uploaded', r.status === 400 && r.json && r.json.error === 'bg_must_be_uploaded', `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/statuses', { quote: 'no bg' }, ownerToken);
  check('C5 missing bg/file -> 400 no_file', r.status === 400 && r.json && r.json.error === 'no_file', `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/statuses', {
    bg: GRADIENT, storyRef: { id: 'st_43', title: 'Bad cover book', cover: 'https://example.com/evil.jpg' },
  }, ownerToken);
  check('C6 untrusted storyRef cover -> 201, cover dropped, post kept',
    r.status === 201 && r.json && r.json.storyRef && r.json.storyRef.id === 'st_43' && r.json.storyRef.cover === '',
    `${r.status} ${JSON.stringify(r.json && r.json.storyRef)}`);
  const SID2 = String((r.json && r.json.id) || '');
  r = await call('POST', '/api/statuses', { bg: GRADIENT }); // anonymous
  check('C7 create without auth -> 401', r.status === 401, `${r.status}`);

  // ── My slides ──
  r = await call('GET', '/api/statuses/me', undefined, ownerToken);
  const mine = (r.json && r.json.statuses) || [];
  const mineS = mine.find(s => s.id === SID) || {};
  check('M1 GET /me returns the slide with storyRef + views 0',
    r.status === 200 && mine.length === 2 && mineS.bg === GRADIENT && mineS.views === 0 && mineS.storyRef && mineS.storyRef.id === 'st_42',
    `${r.status} n=${mine.length} ${JSON.stringify(mineS).slice(0, 200)}`);
  r = await call('GET', '/api/statuses/me');
  check('M2 GET /me guest -> 401', r.status === 401, `${r.status}`);

  // ── Writers batch (handle casing fix) ──
  r = await call('GET', '/api/statuses/writers?handles=ADAWRITES,ghostwriter');
  const wrows = Array.isArray(r.json) ? r.json : [];
  const wr = wrows.find(x => x.handle === 'adawrites') || {};
  const wslides = wr.statuses || [];
  check('W1 UPPERCASE handle resolves to the live slides', r.status === 200 && wslides.length === 2, `${r.status} n=${wslides.length}`);
  check('W2 writer slide carries storyRef for the Read chip',
    wslides.some(s => s.storyRef && s.storyRef.id === 'st_42'), JSON.stringify(wslides.map(s => s.storyRef && s.storyRef.id)));
  check('W3 unknown handle -> empty statuses, never invented',
    wrows.some(x => x.handle === 'ghostwriter' && Array.isArray(x.statuses) && x.statuses.length === 0), JSON.stringify(wrows.map(x => [x.handle, (x.statuses || []).length])));
  r = await call('GET', '/api/statuses/writers?handles=adawrites', undefined, readerToken);
  const rSlides = (Array.isArray(r.json) && r.json[0] && r.json[0].statuses) || [];
  check('W4 signed-in reader sees viewed:false before opening', r.status === 200 && rSlides.length === 2 && rSlides.every(s => s.viewed === false), `${r.status}`);

  // ── Views ──
  r = await call('POST', `/api/statuses/${SID}/view`, {}, ownerToken);
  check('V1 owner preview returns slide without counting', r.status === 200 && !!r.json && r.json.id === SID, `${r.status}`);
  r = await call('GET', '/api/statuses/me', undefined, ownerToken);
  const viewsAfterOwner = (((r.json || {}).statuses || []).find(s => s.id === SID) || {}).views;
  check('V2 owner preview leaves views at 0', viewsAfterOwner === 0, `views=${viewsAfterOwner}`);
  r = await call('POST', `/api/statuses/${SID}/view`, {}, readerToken);
  check('V3 reader view -> 200', r.status === 200, `${r.status}`);
  r = await call('POST', `/api/statuses/${SID}/view`, {}, readerToken); // repeat
  check('V4 repeat reader view -> 200 (deduped server-side)', r.status === 200, `${r.status}`);
  r = await call('POST', `/api/statuses/${SID}/view`, { anonId: 'anon-guest-1' });
  check('V5 guest view with anonId -> 200', r.status === 200, `${r.status}`);
  r = await call('POST', `/api/statuses/${SID}/view`, { anonId: 'anon-guest-1' });
  check('V6 repeat guest anonId -> 200 (deduped)', r.status === 200, `${r.status}`);

  // ── Seen-by (owner only) ──
  r = await call('GET', `/api/statuses/${SID}/viewers`, undefined, ownerToken);
  const vb = r.json || {};
  check('V7 owner viewers: 1 named reader + 1 guest, views 2',
    r.status === 200 && vb.views === 2 && (vb.named || []).length === 1 && vb.named[0].handle === 'readerone' && vb.guests === 1,
    `${r.status} ${JSON.stringify(vb).slice(0, 240)}`);
  check('V8 named viewer has a timestamp', !!(vb.named && vb.named[0] && vb.named[0].at), JSON.stringify(vb.named));
  r = await call('GET', `/api/statuses/${SID}/viewers`, undefined, readerToken);
  check('V9 non-owner viewers -> 403', r.status === 403, `${r.status}`);

  // ── Like toggle ──
  r = await call('POST', `/api/statuses/${SID}/like`, undefined, readerToken);
  check('L1 like -> liked:true likes:1', r.status === 200 && r.json && r.json.liked === true && r.json.likes === 1, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', `/api/statuses/${SID}/like`, undefined, readerToken);
  check('L2 unlike -> liked:false likes:0', r.status === 200 && r.json && r.json.liked === false && r.json.likes === 0, `${r.status} ${JSON.stringify(r.json)}`);

  // ── Cross-surface ring state ──
  r = await call('GET', '/api/statuses/state?handles=adawrites,ghostwriter', undefined, readerToken);
  const states = (r.json && r.json.states) || {};
  const stA = states.adawrites || {};
  check('S1 reader state: has, total 2, seen 1, unseen 1, ring-has',
    r.status === 200 && stA.has === true && stA.total === 2 && stA.seen === 1 && stA.unseen === 1 && stA.ring === 'ring-has',
    JSON.stringify(stA));
  check('S2 unknown handle state stays ring-none', states.ghostwriter && states.ghostwriter.ring === 'ring-none', JSON.stringify(states.ghostwriter));
  r = await call('GET', '/api/statuses/state?handles=adawrites');
  const anon = ((r.json && r.json.states) || {}).adawrites || {};
  check('S3 guest state: all unseen', r.status === 200 && anon.total === 2 && anon.unseen === 2 && anon.seen === 0, JSON.stringify(anon));

  // ── Delete ──
  r = await call('DELETE', `/api/statuses/${SID}`, undefined, readerToken);
  check('D1 non-owner delete -> 403', r.status === 403, `${r.status}`);
  r = await call('DELETE', `/api/statuses/${SID}`, undefined, ownerToken);
  check('D2 owner delete -> ok', r.status === 200 && r.json && r.json.ok === true, `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('DELETE', `/api/statuses/${SID2}`, undefined, ownerToken);
  check('D3 second slide deleted', r.status === 200, `${r.status}`);
  r = await call('GET', '/api/statuses/me', undefined, ownerToken);
  check('D4 /me empty after deletes', r.status === 200 && r.json && Array.isArray(r.json.statuses) && r.json.statuses.length === 0, `${r.status} n=${((r.json || {}).statuses || []).length}`);
  r = await call('GET', '/api/statuses/writers?handles=adawrites');
  const gone = (Array.isArray(r.json) && r.json[0] && r.json[0].statuses) || [];
  check('D5 writers batch empty after deletes (no ghost ring)', r.status === 200 && gone.length === 0, `${r.status} n=${gone.length}`);

  const failed = out.filter(x => !x.pass);
  console.log('\n' + (out.length - failed.length) + '/' + out.length + ' statuses live-chain assertions passed');
  failed.forEach(f => console.log('  - ' + f.name));
  await mongod.stop();
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error('HARNESS ERROR', (e && e.stack) || e); process.exit(2); });