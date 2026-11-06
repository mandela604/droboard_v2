'use strict';
// 1:1 messaging live harness — the data behind public/Pages/chat.html.
//
// Boots the real Express app on an in-memory MongoDB and drives every route in
// backend/src/routes/messages.routes.js:
//   GET    /api/messages/conversations            (contact list + unread badge)
//   POST   /api/messages/conversations            (open-or-create a 1:1 thread)
//   GET    /api/messages/conversations/:id/messages  (history, paginated)
//   POST   /api/messages/conversations/:id/messages  (send text and/or image)
//   POST   /api/messages/conversations/:id/read   (clear unread)
//   PATCH  /api/messages/:id                      (edit own message)
//   DELETE /api/messages/:id                      (delete own message)
//
// chat.html renders three things only the backend can supply: the peer identity
// on every row (name/avatar/verified), an unread badge counted from the peer's
// unread messages only, and a preview kept in sync on send/edit/delete. All seven
// routes must reject a non-participant.
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime. See smoke-store.cjs.
process.env.NODE_ENV = 'test';
process.env.PORT = '4206';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 4206;
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = require('path').join(__dirname, 'smoke-messages.results.txt');

const results = [];
const logLines = [];
function say(s) { logLines.push(s); console.log(s); }
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
  say(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}
function finish() {
  const passed = results.filter(x => x.pass).length;
  say(`\n===== ${passed}/${results.length} message assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => say(`  FAIL ${f.name} :: ${f.detail}`));
  try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (e) {}
  process.exit(passed === results.length ? 0 : 1);
}

const DELIV = 'https://imagedelivery.net/acct123/imgid456/public';

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_messages');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  async function call(method, url, token, body) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { method, headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }
  const MSG = BASE + '/api/messages';

  const { User } = require('../src/models/user.model');
  const { Conversation, Message } = require('../src/models/social.model');
  const { signAccess } = require('../src/middleware/auth');
  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const n = Date.now();

  const alice = await User.create({ fullName: 'Ada Writes', email: `a${n}@t.co`, username: 'ada' + n, passwordHash: DUMMY, status: 'active', roles: ['writer'], emailVerified: true });
  const bob = await User.create({ fullName: 'Reina Morgan', email: `b${n}@t.co`, username: 'reina' + n, passwordHash: DUMMY, status: 'active', roles: ['senior_editor'] });
  const carol = await User.create({ fullName: 'Support Bot', email: `c${n}@t.co`, username: 'sup' + n, passwordHash: DUMMY, status: 'active', roles: ['admin'] });
  const stranger = await User.create({ fullName: 'Nobody Here', email: `d${n}@t.co`, username: 'nobody' + n, passwordHash: DUMMY, status: 'active', roles: ['reader'] });
  const tokA = signAccess(alice), tokB = signAccess(bob), tokC = signAccess(carol), tokS = signAccess(stranger);

  // Sends inside one test run can land in the same millisecond, which makes the
  // newest-first sort undefined. stamp() gives each message a distinct instant.
  const sentIds = [];
  async function stamp(convId) {
    for (let i = 0; i < sentIds.length; i++) {
      await Message.updateOne({ id: sentIds[i], conversationId: String(convId) }, { $set: { createdAt: new Date(1700000000000 + i * 1000) } });
    }
  }
  async function send(tok, cid, body) {
    const r = await call('POST', `${MSG}/conversations/${cid}/messages`, tok, body);
    if (r.json && r.json.id) sentIds.push(r.json.id);
    return r;
  }

  /* ── auth gate ── */
  const noAuth = await call('GET', MSG + '/conversations');
  check('GET /conversations requires auth', noAuth.status === 401, noAuth.status);

  /* ── empty list ── */
  const empty = await call('GET', MSG + '/conversations', tokA);
  check('empty conversation list is { items: [] }', empty.status === 200 && Array.isArray(empty.json.items) && empty.json.items.length === 0, JSON.stringify(empty.json).slice(0, 120));

  /* ── open-or-create ── */
  const opened = await call('POST', MSG + '/conversations', tokA, { userId: bob.id });
  const convId = opened.json && opened.json.id;
  check('POST /conversations creates a thread (201)', opened.status === 201 && !!convId, JSON.stringify(opened.json).slice(0, 200));
  check('thread row carries the peer identity', !!opened.json.peer && opened.json.peer.id === String(bob.id) && opened.json.peer.name === 'Reina Morgan', JSON.stringify(opened.json.peer));
  check('thread row starts empty (preview "", unread 0)', opened.json.preview === '' && opened.json.unread === 0, `preview=${opened.json.preview} unread=${opened.json.unread}`);
  check('thread row exposes no Mongo _id', !('_id' in opened.json) && !('_id' in (opened.json.peer || {})), JSON.stringify(opened.json).slice(0, 160));

  const again = await call('POST', MSG + '/conversations', tokA, { userId: bob.id });
  check('re-opening the same peer returns the same thread', again.json && again.json.id === convId, `${again.status} ${again.json && again.json.id} vs ${convId}`);
  const fromPeer = await call('POST', MSG + '/conversations', tokB, { userId: alice.id });
  check('the peer opening from their side finds the same thread', fromPeer.json && fromPeer.json.id === convId, `${fromPeer.status} ${fromPeer.json && fromPeer.json.id}`);
  check('each side sees the other as the peer', fromPeer.json && fromPeer.json.peer && fromPeer.json.peer.id === String(alice.id), JSON.stringify(fromPeer.json && fromPeer.json.peer));
  const selfPeer = await call('POST', MSG + '/conversations', tokA, { userId: alice.id });
  check('cannot open a thread with yourself', selfPeer.status === 400 && selfPeer.json.error === 'invalid_peer', `${selfPeer.status} ${JSON.stringify(selfPeer.json)}`);
  const ghostPeer = await call('POST', MSG + '/conversations', tokA, { userId: 'does-not-exist' });
  check('unknown peer 404s', ghostPeer.status === 404 && ghostPeer.json.error === 'peer_not_found', `${ghostPeer.status} ${JSON.stringify(ghostPeer.json)}`);

  /* ── send ── */
  const sent = await send(tokA, convId, { text: 'Hello there' });
  check('send text returns 201', sent.status === 201 && sent.json.text === 'Hello there', `${sent.status} ${JSON.stringify(sent.json).slice(0, 160)}`);
  check('message row marks isMine for the sender', sent.json.isMine === true && sent.json.senderId === String(alice.id), `isMine=${sent.json.isMine}`);
  check('writer sender maps to fromRole "author"', sent.json.fromRole === 'author', sent.json.fromRole);
  check('message row carries its own conversation id', String(sent.json.conversationId) === String(convId), sent.json.conversationId);

  const emptySend = await call('POST', `${MSG}/conversations/${convId}/messages`, tokA, {});
  check('empty message body is rejected', emptySend.status === 400, `${emptySend.status} ${JSON.stringify(emptySend.json)}`);
  const blankSend = await call('POST', `${MSG}/conversations/${convId}/messages`, tokA, { text: '   ' });
  check('whitespace-only message is rejected', blankSend.status === 400, `${blankSend.status} ${JSON.stringify(blankSend.json)}`);
  const badImg = await call('POST', `${MSG}/conversations/${convId}/messages`, tokA, { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' });
  check('inline data-URL image is rejected (upload only)', badImg.status === 400 && badImg.json.error === 'image_must_be_uploaded', `${badImg.status} ${JSON.stringify(badImg.json)}`);
  const goodImg = await send(tokA, convId, { image: DELIV });
  check('uploaded delivery-URL image is accepted', goodImg.status === 201 && goodImg.json.image === DELIV, `${goodImg.status} ${JSON.stringify(goodImg.json).slice(0, 160)}`);

  /* ── preview ── */
  let list = (await call('GET', MSG + '/conversations', tokA)).json;
  let row = list.items[0];
  check('list row is keyed by the thread with peer + updatedAt', String(row.id) === String(convId) && !!row.peer.id && !!row.updatedAt, JSON.stringify(row).slice(0, 220));
  check('image-only message previews as [Image]', row.preview === '[Image]', row.preview);
  check('peer has written nothing yet, so unread is 0', row.unread === 0, row.unread);

  /* ── peer reply drives the unread badge ── */
  const fromBob = await send(tokB, convId, { text: 'Hi Ada, noted' });
  check('the peer can post into the same thread', fromBob.status === 201, `${fromBob.status} ${JSON.stringify(fromBob.json).slice(0, 160)}`);
  check('editor role maps to fromRole "editor"', fromBob.json.fromRole === 'editor', fromBob.json.fromRole);
  list = (await call('GET', MSG + '/conversations', tokA)).json;
  check('unread badge counts the peer message', list.items[0].unread === 1, list.items[0].unread);
  const bobList = (await call('GET', MSG + '/conversations', tokB)).json;
  check("each side's badge counts only the other side's messages", bobList.items[0].unread === 2 && list.items[0].unread === 1, `bobSees=${bobList.items[0].unread} (2 from alice) aliceSees=${list.items[0].unread} (1 from bob)`);
  check('preview follows the newest message of either side', list.items[0].preview === 'Hi Ada, noted', list.items[0].preview);

  const readRes = await call('POST', `${MSG}/conversations/${convId}/read`, tokA);
  check('mark-read returns ok', readRes.status === 200 && readRes.json.ok === true, JSON.stringify(readRes.json));
  list = (await call('GET', MSG + '/conversations', tokA)).json;
  check('mark-read clears the badge', list.items[0].unread === 0, list.items[0].unread);
  const afterRead = (await call('GET', `${MSG}/conversations/${convId}/messages`, tokA)).json;
  const peerMsg = afterRead.items.find(m => m.senderId === String(bob.id));
  check('the peer row is not mine from my side of the thread', peerMsg && peerMsg.isMine === false, peerMsg && peerMsg.isMine);
  check('mark-read flips the peer message to read', peerMsg && peerMsg.read === true, JSON.stringify(peerMsg).slice(0, 160));
  const ownMsg = afterRead.items.find(m => m.senderId === String(alice.id));
  check('mark-read leaves my own rows untouched', ownMsg && ownMsg.read === false, JSON.stringify(ownMsg).slice(0, 160));

  /* ── history shape + ordering ── */
  await stamp(convId);
  const hist = await call('GET', `${MSG}/conversations/${convId}/messages`, tokA);
  check('history returns items + total + page + limit', Array.isArray(hist.json.items) && hist.json.total === 3 && hist.json.page === 1 && hist.json.limit === 50, JSON.stringify({ total: hist.json.total, page: hist.json.page, limit: hist.json.limit }));
  check('history is newest-first', hist.json.items.map(m => m.id).join(',') === sentIds.slice().reverse().join(','), `${hist.json.items.map(m => m.text)}. vs ${sentIds.slice().reverse()}`);
  check('history rows carry sender identity for avatars', hist.json.items.every(m => m.sender && 'id' in m.sender && 'avatar' in m.sender), JSON.stringify((hist.json.items[0] || {}).sender).slice(0, 160));
  check('history rows expose text/image/edited/read', hist.json.items.every(m => 'text' in m && 'image' in m && 'edited' in m && 'read' in m), Object.keys(hist.json.items[0] || {}).join(','));
  check('image message keeps its delivery URL in history', hist.json.items.some(m => m.image === DELIV), hist.json.items.map(m => m.image).join(','));

  for (let i = 1; i <= 4; i++) await send(tokA, convId, { text: 'p' + i });
  await stamp(convId);
  const p1 = await call('GET', `${MSG}/conversations/${convId}/messages?page=1&limit=2`, tokA);
  const p2 = await call('GET', `${MSG}/conversations/${convId}/messages?page=2&limit=2`, tokA);
  check('pagination windows are disjoint', p1.json.items.length === 2 && p2.json.items.length === 2 && p1.json.items[0].id !== p2.json.items[0].id, `${p1.json.items.map(m => m.text)} vs ${p2.json.items.map(m => m.text)}`);
  check('total counts every message, not the page', p1.json.total === 7 && p2.json.total === 7, `${p1.json.total}/${p2.json.total}`);
  check('page echoes the requested page', p2.json.page === 2 && p2.json.limit === 2, `page=${p2.json.page} limit=${p2.json.limit}`);
  check('page 2 is the older half of the thread', p1.json.items.map(m => m.text).join(',') === 'p4,p3' && p2.json.items.map(m => m.text).join(',') === 'p2,p1', `${p1.json.items.map(m => m.text)} / ${p2.json.items.map(m => m.text)}`);

  /* ── participant checks on every thread-scoped route ── */
  const outsiderGet = await call('GET', `${MSG}/conversations/${convId}/messages`, tokS);
  check('non-participant cannot read a thread', outsiderGet.status === 403 && outsiderGet.json.error === 'forbidden', `${outsiderGet.status} ${JSON.stringify(outsiderGet.json)}`);
  const outsiderSend = await call('POST', `${MSG}/conversations/${convId}/messages`, tokS, { text: 'intruder' });
  check('non-participant cannot post into a thread', outsiderSend.status === 403, `${outsiderSend.status} ${JSON.stringify(outsiderSend.json)}`);
  const outsiderRead = await call('POST', `${MSG}/conversations/${convId}/read`, tokS);
  check('non-participant cannot mark a thread read', outsiderRead.status === 403, `${outsiderRead.status}`);
  const outsiderThread = await call('GET', `${MSG}/conversations/${convId}/messages`, tokC);
  check('an admin who is not in the thread cannot read it', outsiderThread.status === 403, `${outsiderThread.status} ${JSON.stringify(outsiderThread.json)}`);
  const ghostThread = await call('GET', `${MSG}/conversations/${convId}zz/messages`, tokA);
  check('unknown thread 404s', ghostThread.status === 404 && ghostThread.json.error === 'not_found', `${ghostThread.status} ${JSON.stringify(ghostThread.json)}`);

  /* ── edit ── */
  const editTarget = hist.json.items.find(m => m.senderId === String(alice.id));
  const edited = await call('PATCH', `${MSG}/${editTarget.id}`, tokA, { text: 'Hello there (fixed)' });
  check('sender can edit own message', edited.status === 200 && edited.json.text === 'Hello there (fixed)', `${edited.status} ${JSON.stringify(edited.json).slice(0, 160)}`);
  check('edited message is flagged for the "edited" chip', edited.json.edited === true, edited.json.edited);
  const foreignEdit = await call('PATCH', `${MSG}/${peerMsg.id}`, tokA, { text: 'not yours' });
  check('cannot edit the peer message', foreignEdit.status === 403 && foreignEdit.json.error === 'forbidden', `${foreignEdit.status} ${JSON.stringify(foreignEdit.json)}`);
  const blankEdit = await call('PATCH', `${MSG}/${editTarget.id}`, tokA, { text: '' });
  check('edit requires text', blankEdit.status === 400, `${blankEdit.status} ${JSON.stringify(blankEdit.json)}`);

  // the contact list is the only place a preview shows, so it must track edits
  const newestBefore = (await call('GET', `${MSG}/conversations/${convId}/messages?limit=1`, tokA)).json.items[0];
  await call('PATCH', `${MSG}/${newestBefore.id}`, tokA, { text: 'p4 edited live' });
  list = (await call('GET', MSG + '/conversations', tokA)).json;
  check('editing the newest message syncs the preview', list.items[0].preview === 'p4 edited live', list.items[0].preview);

  /* ── delete ── */
  const foreignDel = await call('DELETE', `${MSG}/${peerMsg.id}`, tokA);
  check('cannot delete the peer message', foreignDel.status === 403 && foreignDel.json.error === 'forbidden', `${foreignDel.status} ${JSON.stringify(foreignDel.json)}`);
  const doomed = (await call('GET', `${MSG}/conversations/${convId}/messages?limit=1`, tokA)).json.items[0];
  const del = await call('DELETE', `${MSG}/${doomed.id}`, tokA);
  check('sender can delete own message', del.status === 200 && del.json.ok === true, `${del.status} ${JSON.stringify(del.json)}`);
  const afterDel = (await call('GET', `${MSG}/conversations/${convId}/messages`, tokA)).json;
  check('deleted message is gone from history', afterDel.total === 6 && !afterDel.items.some(m => m.id === doomed.id), `total=${afterDel.total}`);
  list = (await call('GET', MSG + '/conversations', tokA)).json;
  const expectedPreview = afterDel.items[0].image ? '[Image]' : afterDel.items[0].text;
  check('deleting the newest message rolls the preview back', list.items[0].preview === expectedPreview, `preview=${list.items[0].preview} expected=${expectedPreview}`);
  const gone = await call('PATCH', `${MSG}/${doomed.id}`, tokA, { text: 'resurrect' });
  check('a deleted message cannot be edited', gone.status === 404 && gone.json.error === 'not_found', `${gone.status} ${JSON.stringify(gone.json)}`);

  /* ── unread only counts the peer, never my own unread rows ── */
  await Message.updateMany({ conversationId: String(convId) }, { $set: { read: false } });
  list = (await call('GET', MSG + '/conversations', tokA)).json;
  const peerUnreadTotal = afterDel.items.filter(m => m.senderId === String(bob.id)).length;
  check('badge counts peer messages only, not my own', list.items[0].unread === peerUnreadTotal, `badge=${list.items[0].unread} peerRows=${peerUnreadTotal}`);

  /* ── a second thread, and the role label for an admin sender ── */
  const convC = (await call('POST', MSG + '/conversations', tokA, { userId: carol.id })).json;
  const fromCarol = await send(tokC, convC.id, { text: 'Your payout is done' });
  check('admin sender maps to fromRole "admin"', fromCarol.status === 201 && fromCarol.json.fromRole === 'admin', `${fromCarol.status} ${fromCarol.json && fromCarol.json.fromRole}`);
  list = (await call('GET', MSG + '/conversations', tokA)).json;
  const peers = list.items.map(i => i.peer.name).sort();
  check('list returns one row per peer thread', list.items.length === 2 && peers.join('|') === 'Reina Morgan|Support Bot', peers.join('|'));
  check('peer rows expose verified as a real boolean from the user record', list.items.every(i => typeof i.peer.verified === 'boolean'), JSON.stringify(list.items.map(i => ({ p: i.peer.name, v: i.peer.verified }))));
  const verifiedRow = await call('POST', MSG + '/conversations', tokB, { userId: alice.id });
  check('a verified peer reports verified true', verifiedRow.json.peer.id === String(alice.id) && verifiedRow.json.peer.verified === true, JSON.stringify(verifiedRow.json.peer));
  const unverifiedRow = await call('POST', MSG + '/conversations', tokC, { userId: bob.id });
  check('an unverified peer reports verified false', unverifiedRow.json.peer.id === String(bob.id) && unverifiedRow.json.peer.verified === false, JSON.stringify(unverifiedRow.json.peer));
  check('peer row carries the handle the composer needs', typeof verifiedRow.json.peer.handle === 'string' && verifiedRow.json.peer.handle.length > 0, JSON.stringify(verifiedRow.json.peer.handle));

  /* ── peer role: the contact list subtitle has no other source ── */
  const chief = await User.create({ fullName: 'Jasmine Cole', email: `e${n}@t.co`, username: 'chief' + n, passwordHash: DUMMY, status: 'active', roles: ['chief_editor'] });
  const readerPeer = await User.create({ fullName: 'Plain Reader', email: `f${n}@t.co`, username: 'plain' + n, passwordHash: DUMMY, status: 'active', roles: ['reader'] });
  const roleRows = {};
  for (const [label, peer] of [['Senior Editor', bob], ['Chief Editor', chief], ['Admin', carol], ['Reader', readerPeer]]) {
    const row = (await call('POST', MSG + '/conversations', tokA, { userId: peer.id })).json;
    roleRows[label] = row.peer && row.peer.role;
    check(`peer.role renders "${label}" from the stored role token`, row.peer && row.peer.role === label, JSON.stringify(row.peer));
  }
  const dual = await User.create({ fullName: 'Two Hats', email: `g${n}@t.co`, username: 'hats' + n, passwordHash: DUMMY, status: 'active', roles: ['writer', 'senior_editor'] });
  const dualRow = (await call('POST', MSG + '/conversations', tokA, { userId: dual.id })).json;
  check('the most privileged role wins the label', dualRow.peer.role === 'Senior Editor', dualRow.peer.role);
  const explicit = await User.create({ fullName: 'Named Hat', email: `h${n}@t.co`, username: 'hat' + n, passwordHash: DUMMY, status: 'active', roles: ['admin', 'writer'], primaryRole: 'writer' });
  const explicitRow = (await call('POST', MSG + '/conversations', tokA, { userId: explicit.id })).json;
  check('primaryRole overrides the rank list when it is set', explicitRow.peer.role === 'Writer', explicitRow.peer.role);

  /* ── presence: the green dot ── */
  const bobRow0 = (await call('GET', `${MSG}/conversations/${convId}/messages`, tokA)).json;
  check('message rows expose sender.role too', bobRow0.items.every(m => m.sender && typeof m.sender.role === 'string'), JSON.stringify((bobRow0.items.find(m => m.senderId === String(bob.id)) || {}).sender));
  let beforeOnline = (await call('GET', MSG + '/conversations', tokA)).json.items.find(i => i.peer.name === 'Reina Morgan');
  check('peer.online starts false with no live socket', beforeOnline && beforeOnline.peer.online === false, JSON.stringify(beforeOnline && beforeOnline.peer));

  const { io } = require('socket.io-client');
  // Alice is the observer: her socket stays open the whole time, so she can see
  // both halves of bob's presence. A drop can never be announced to the socket
  // that just closed.
  const watch = io(BASE, { auth: { token: tokA }, transports: ['websocket'], forceNew: true });
  const presenceEvents = [];
  watch.on('presence', (p) => presenceEvents.push(p));
  await new Promise((res, rej) => { watch.once('connect', res); watch.once('connect_error', rej); });

  const sock = io(BASE, { auth: { token: tokB }, transports: ['websocket'], forceNew: true });
  await new Promise((res, rej) => { sock.once('connect', res); sock.once('connect_error', rej); });
  await new Promise(r => setTimeout(r, 150));
  const seenOnline = (await call('GET', MSG + '/conversations', tokA)).json.items.find(i => i.peer.name === 'Reina Morgan');
  check('a live socket flips the peer to online for the other side', seenOnline && seenOnline.peer.online === true, JSON.stringify(seenOnline && seenOnline.peer));
  check('the server announces the flip to the watching side', presenceEvents.some(e => e.userId === String(bob.id) && e.online === true), JSON.stringify(presenceEvents));

  const sock2 = io(BASE, { auth: { token: tokB }, transports: ['websocket'], forceNew: true });
  await new Promise((res, rej) => { sock2.once('connect', res); sock2.once('connect_error', rej); });
  await new Promise(r => setTimeout(r, 120));
  sock.close();
  await new Promise(r => setTimeout(r, 150));
  const stillOnline = (await call('GET', MSG + '/conversations', tokA)).json.items.find(i => i.peer.name === 'Reina Morgan');
  check('one of two devices dropping off keeps the peer online', stillOnline && stillOnline.peer.online === true, JSON.stringify(stillOnline && stillOnline.peer));
  check('a second device disconnecting announces nothing', !presenceEvents.some(e => e.userId === String(bob.id) && e.online === false), JSON.stringify(presenceEvents));

  sock2.close();
  await new Promise(r => setTimeout(r, 200));
  const offlineAtLast = (await call('GET', MSG + '/conversations', tokA)).json.items.find(i => i.peer.name === 'Reina Morgan');
  check('the peer goes offline when their last device drops', offlineAtLast && offlineAtLast.peer.online === false, JSON.stringify(offlineAtLast && offlineAtLast.peer));
  check('the drop is announced too', presenceEvents.some(e => e.userId === String(bob.id) && e.online === false), JSON.stringify(presenceEvents));

  const selfRow = (await call('GET', MSG + '/conversations', tokB)).json.items.find(i => i.peer.name === 'Ada Writes');
  check('the observing user reads as online to the other side', selfRow && selfRow.peer.online === true, JSON.stringify(selfRow && selfRow.peer));
  watch.close();
  await new Promise(r => setTimeout(r, 150));

  /* ── nothing leaks a Mongo ObjectId ── */
  const sweep = [await call('GET', MSG + '/conversations', tokA), await call('GET', `${MSG}/conversations/${convId}/messages`, tokA)];
  const leaked = JSON.stringify(sweep.map(s => s.json)).includes('"_id"');
  check('no _id key leaks to the client', leaked === false, leaked);

  /* ── chat notifications: one coalesced row per conversation, blue bell ── */
  const NOTIF = BASE + '/api/notifications';
  const nOpened = await call('POST', MSG + '/conversations', tokA, { userId: String(carol.id) });
  const nconv = nOpened.json && nOpened.json.id;
  check('a fresh conversation opens for the notification tests', !!nconv, JSON.stringify(nOpened.json));

  const notifyEvents = [];
  const nsock = io(BASE, { auth: { token: tokC }, transports: ['websocket'], forceNew: true });
  nsock.on('notify', p => notifyEvents.push(p));
  await new Promise((res, rej) => { nsock.once('connect', res); nsock.once('connect_error', rej); });

  await send(tokA, nconv, { text: 'First note' });
  await send(tokA, nconv, { text: 'Second note' });
  await send(tokA, nconv, { text: 'Third note' });

  const dmOf = async (tok) => ((await call('GET', NOTIF, tok)).json.items || []).filter(i => i.type === 'direct_message');
  const dmRows = await dmOf(tokC);
  check('a DM notifies the recipient', dmRows.length === 1, JSON.stringify(dmRows.map(r => r.title)));
  check('three messages coalesce into one row, not three', dmRows.length === 1, dmRows.length);
  check('the coalesced row carries the climbing count', dmRows[0] && dmRows[0].count === 3, dmRows[0] && dmRows[0].count);
  check('the row is in the messages category', dmRows[0] && dmRows[0].cat === 'messages', dmRows[0] && dmRows[0].cat);
  check('the row icon is blue, not the default pink', dmRows[0] && dmRows[0].icon && dmRows[0].icon.color === '#2563eb', JSON.stringify(dmRows[0] && dmRows[0].icon));
  check('the row deep-links to that conversation', dmRows[0] && dmRows[0].link && dmRows[0].link.href === 'Pages/chat.html?contact=' + nconv, JSON.stringify(dmRows[0] && dmRows[0].link));
  check('the preview is the latest message', dmRows[0] && dmRows[0].desc === 'Third note', dmRows[0] && dmRows[0].desc);
  check('the sender is the actor on the row', dmRows[0] && dmRows[0].actorId === String(alice.id), dmRows[0] && dmRows[0].actorId);
  check('the sender gets no notification for their own message', (await dmOf(tokA)).every(r => r.actorId !== String(alice.id)), JSON.stringify(await dmOf(tokA)));
  check('the notify event reaches the recipient socket', notifyEvents.some(e => e.type === 'direct_message'), JSON.stringify(notifyEvents.map(e => e.type)));

  const uc1 = await call('GET', NOTIF + '/unread-count', tokC);
  check('unread-count splits chats out so the bell can go blue', uc1.json && uc1.json.chats === 1 && uc1.json.count >= 1, JSON.stringify(uc1.json));

  await call('POST', `${MSG}/conversations/${nconv}/read`, tokC);
  const uc2 = await call('GET', NOTIF + '/unread-count', tokC);
  check('opening the thread clears the chat notification', uc2.json && uc2.json.chats === 0, JSON.stringify(uc2.json));

  await send(tokA, nconv, { text: 'After you read it' });
  const dmAfter = await dmOf(tokC);
  check('a message after reading starts the count over', dmAfter.length === 1 && dmAfter[0].count === 1, JSON.stringify(dmAfter.map(r => ({ n: r.count, d: r.desc }))));

  await User.updateOne({ id: String(carol.id) }, { $set: { 'settings.notifications': false } });
  await send(tokA, nconv, { text: 'Muted send' });
  const dmMuted = await dmOf(tokC);
  check('a muted recipient gets no chat notification', !dmMuted.some(r => r.desc === 'Muted send'), JSON.stringify(dmMuted.map(r => r.desc)));

  nsock.close();

  finish();
}

main().catch(e => { say('CRASH ' + (e && e.stack || e)); finish(); });
