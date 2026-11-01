'use strict'
// Live auth test: boots the REAL Express app against an in-memory MongoDB and
// drives the exact HTTP contract login.html / signup.html now use — register,
// login (+ wrong password, lockout, ban), /users/me, settings, notification
// channels, email change, password change, MFA enroll → login → verify, and
// logout/refresh revocation. No frontend mocks are involved.
process.env.NODE_ENV = 'test';
process.env.PORT = '4193';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GOOGLE_REDIRECT_URI;

const { MongoMemoryServer } = require('mongodb-memory-server');
const { authenticator } = require('otplib');
const PW = 'Sup3rSecret!';
const NEW_PW = 'EvenBetterSecret!';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 200) : ''}`);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('droboard_auth');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');
  await new Promise(r => setTimeout(r, 1200));

  const { User } = require('../src/models/user.model');
  const base = 'http://127.0.0.1:4193';

  async function call(method, path, body, token, extraHeaders) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {});
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(base + path, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    return { status: res.status, json, cookies };
  }
  function cookieValue(cookies, name) {
    const row = (cookies || []).find(c => c.startsWith(name + '='));
    return row ? row.split(';')[0] : '';
  }

  const stamp = Date.now();
  const email = `new.reader.${stamp}@example.com`;
  const username = `new_reader_${String(stamp).slice(-6)}`;

  /* ── 1. signup contract ── */
  let r = await call('POST', '/api/auth/signup', {
    name: 'New Reader', username, email, password: PW, country: 'Nigeria',
  });
  check('signup -> 2xx', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.json)}`);
  check('signup returns the user row', !!r.json && !!r.json.user && r.json.user.username === username, JSON.stringify(r.json && r.json.user));
  check('signup returns no session token', !r.json || (!r.json.token && !r.json.access));
  check('signup sets no access cookie', !cookieValue(r.cookies, 'dro_access'));
  const verifyToken = r.json && r.json.verifyToken;
  check('log mail provider exposes the verify token', typeof verifyToken === 'string' && verifyToken.length > 10);

  r = await call('POST', '/api/auth/signup', { name: 'Dup', username: username + 'x', email, password: PW });
  check('duplicate email -> 409 taken', r.status === 409 && r.json && r.json.error === 'taken', `status=${r.status} ${JSON.stringify(r.json)}`);

  r = await call('POST', '/api/auth/signup', { name: 'Short', username: 'short' + String(stamp).slice(-5), email: 'short' + stamp + '@example.com', password: '123456' });
  check('6-char password -> 400 invalid_input', r.status === 400 && r.json && r.json.error === 'invalid_input', `status=${r.status}`);
  check('6-char password did not create a user', !(await User.findOne({ email: 'short' + stamp + '@example.com' }).lean()));

  r = await call('POST', '/api/auth/signup', { name: 'Bot', username: 'bot_' + String(stamp).slice(-6), email: 'bot' + stamp + '@example.com', password: PW, website: 'https://spam.example' });
  check('honeypot website -> 400', r.status === 400, `status=${r.status}`);

  r = await call('POST', '/api/auth/signup', { name: 'Ref Reader', username: 'ref_' + String(stamp).slice(-6), email: 'ref' + stamp + '@example.com', password: PW, referralCode: 'NOPE0000' });
  check('invalid referral code does not fail signup', (r.status === 200 || r.status === 201) && r.json && r.json.user && r.json.user.referral && r.json.user.referral.invalid === true, `status=${r.status} ${JSON.stringify(r.json && r.json.user && r.json.user.referral)}`);

  /* ── 2. login contract ── */
  r = await call('POST', '/api/auth/login', { emailOrUsername: email, password: 'wrong-password' });
  check('wrong password -> 401 invalid', r.status === 401 && r.json && r.json.error === 'invalid', `status=${r.status}`);

  r = await call('POST', '/api/auth/login', { email, password: PW });
  check('login -> 200 with access + user', r.status === 200 && r.json && !!r.json.access && r.json.user.username === username, `status=${r.status} ${JSON.stringify(r.json && r.json.user)}`);
  check('login sets access + refresh cookies', !!cookieValue(r.cookies, 'dro_access') && !!cookieValue(r.cookies, 'dro_refresh'));
  let access = r.json && r.json.access;
  let refreshCookie = cookieValue(r.cookies, 'dro_refresh');
  check('login user carries roles for the header', Array.isArray(r.json.user.roles) && r.json.user.roles.includes('reader'), JSON.stringify(r.json.user.roles));

  /* ── 3. /users/me ── */
  r = await call('GET', '/api/users/me', undefined, access);
  check('/users/me -> 200 with the same account', r.status === 200 && r.json.email === email && r.json.username === username, `status=${r.status} ${JSON.stringify(r.json && r.json.email)}`);
  check('/users/me starts with no phone', r.json.phone === null, JSON.stringify(r.json.phone));

  r = await call('PATCH', '/api/users/me', { fullName: 'New Reader Edited', bio: 'Hello Droboard' }, access);
  check('PATCH /users/me updates name + bio', r.status === 200 && r.json.fullName === 'New Reader Edited' && r.json.bio === 'Hello Droboard', `status=${r.status} ${JSON.stringify(r.json && r.json.fullName)}`);

  r = await call('PATCH', '/api/users/me', { email: 'moved@example.com' }, access);
  check('PATCH /users/me refuses email (change needs /me/email/request)', r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);

  /* ── 4. settings + notification channels ── */
  r = await call('PATCH', '/api/users/me/settings', { privacy: 'private', readingActivity: false }, access);
  check('PATCH /me/settings -> 200 private', r.status === 200 && r.json.privacy === 'private' && r.json.readingActivity === false, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', '/api/users/me/settings', undefined, access);
  check('GET /me/settings persists privacy', r.status === 200 && r.json.privacy === 'private');

  r = await call('GET', '/api/users/' + username);
  check('public profile of a private account is limited', r.status === 200 && r.json.isPrivate === true, `status=${r.status} ${JSON.stringify(r.json && r.json.isPrivate)}`);

  const matrix = { email: true, push: false, inApp: true, sms: false };
  r = await call('PUT', '/api/notifications/settings', matrix, access);
  check('PUT /notifications/settings stores the matrix', r.status === 200 && r.json.ok === true, `status=${r.status}`);
  r = await call('GET', '/api/notifications/settings', undefined, access);
  check('GET /notifications/settings returns it', r.status === 200 && r.json.settings && r.json.settings.push === false, JSON.stringify(r.json));

  /* ── 5. email change (the wired replacement for PATCH email) ── */
  const newEmail = `moved.${stamp}@example.com`;
  r = await call('POST', '/api/users/me/email/request', { newEmail, password: PW }, access);
  check('email change request -> 200 token', r.status === 200 && typeof r.json.verifyToken === 'string', `status=${r.status} ${JSON.stringify(r.json && Object.keys(r.json))}`);
  const emailToken = r.json && r.json.verifyToken;
  r = await call('POST', '/api/users/me/email/confirm', { token: emailToken });
  check('email change confirm -> 200', r.status === 200 && r.json.email === newEmail, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/auth/login', { email: newEmail, password: PW });
  check('login with the new email -> 200', r.status === 200 && !!r.json.access, `status=${r.status}`);
  access = r.json && r.json.access;
  refreshCookie = cookieValue(r.cookies, 'dro_refresh');

  /* ── 6. password change ── */
  r = await call('POST', '/api/users/me/password', { oldPassword: 'nope', newPassword: NEW_PW }, access);
  check('password change with a wrong old password -> 401', r.status === 401, `status=${r.status}`);
  r = await call('POST', '/api/users/me/password', { oldPassword: PW, newPassword: NEW_PW }, access);
  check('password change -> 200', r.status === 200 && r.json.ok === true, `status=${r.status}`);
  r = await call('POST', '/api/auth/login', { email: newEmail, password: PW });
  check('old password is rejected', r.status === 401, `status=${r.status}`);
  r = await call('POST', '/api/users/me/password', { oldPassword: NEW_PW, newPassword: '1234567' }, access);
  check('7-char new password is rejected -> 400', r.status === 400, `status=${r.status}`);
  r = await call('POST', '/api/auth/login', { email: newEmail, password: NEW_PW });
  check('new password logs in', r.status === 200 && !!r.json.access, `status=${r.status}`);
  access = r.json && r.json.access;
  refreshCookie = cookieValue(r.cookies, 'dro_refresh');

  /* ── 7. MFA enroll → login challenge → verify ── */
  r = await call('POST', '/api/auth/mfa/enroll', {}, access);
  check('MFA enroll returns a secret', r.status === 200 && typeof r.json.secret === 'string' && !!r.json.otpauth, `status=${r.status}`);
  const secret = r.json && r.json.secret;
  r = await call('POST', '/api/auth/mfa/confirm', { code: authenticator.generate(secret) }, access);
  check('MFA confirm enables it + returns backup codes', r.status === 200 && Array.isArray(r.json.backupCodes) && r.json.backupCodes.length === 10, `status=${r.status}`);
  const backupCode = r.json.backupCodes[0];

  r = await call('POST', '/api/auth/login', { email: newEmail, password: NEW_PW });
  check('MFA-enabled login returns a challenge, not a session', r.status === 200 && r.json.mfaRequired === true && !!r.json.ticket && !r.json.access, `status=${r.status} ${JSON.stringify(r.json)}`);
  const ticket = r.json && r.json.ticket;
  r = await call('POST', '/api/auth/mfa/verify', { ticket, code: '000000' });
  check('wrong MFA code -> 401', r.status === 401, `status=${r.status}`);
  r = await call('POST', '/api/auth/mfa/verify', { ticket, code: authenticator.generate(secret) });
  check('correct TOTP -> 200 session', r.status === 200 && !!r.json.access && r.json.user.username === username, `status=${r.status}`);
  access = r.json && r.json.access;
  refreshCookie = cookieValue(r.cookies, 'dro_refresh');

  r = await call('DELETE', '/api/auth/mfa', { code: backupCode }, access);
  check('backup code disables MFA', r.status === 200 && r.json.mfaEnabled === false, `status=${r.status} ${JSON.stringify(r.json)}`);

  /* ── 8. logout revokes the refresh family ── */
  r = await call('POST', '/api/auth/refresh', {}, null, { Cookie: refreshCookie });
  check('refresh with a live cookie -> 200', r.status === 200 && !!r.json.access, `status=${r.status}`);
  r = await call('POST', '/api/auth/logout', {}, null, { Cookie: refreshCookie });
  check('logout -> 200', r.status === 200, `status=${r.status}`);
  r = await call('POST', '/api/auth/refresh', {}, null, { Cookie: refreshCookie });
  check('refresh after logout -> 401', r.status === 401, `status=${r.status}`);

  /* ── 9. lockout + banned ── */
  const lockEmail = `lock.${stamp}@example.com`;
  await call('POST', '/api/auth/signup', { name: 'Lock User', username: 'lock_' + String(stamp).slice(-6), email: lockEmail, password: PW });
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { email: lockEmail, password: 'bad-' + i });
  r = await call('POST', '/api/auth/login', { email: lockEmail, password: PW });
  check('5 failed attempts lock the account -> 423', r.status === 423 && r.json.error === 'locked', `status=${r.status} ${JSON.stringify(r.json)}`);

  const banEmail = `ban.${stamp}@example.com`;
  await call('POST', '/api/auth/signup', { name: 'Ban User', username: 'ban_' + String(stamp).slice(-6), email: banEmail, password: PW });
  await User.updateOne({ email: banEmail }, { $set: { status: 'banned' } });
  r = await call('POST', '/api/auth/login', { email: banEmail, password: PW });
  check('banned account -> 403 banned, no session', r.status === 403 && r.json.error === 'banned' && !r.json.access, `status=${r.status} ${JSON.stringify(r.json)}`);

  /* ── 10. Google is closed until configured ── */
  r = await call('GET', '/api/auth/google/url?mode=login');
  check('Google URL without config -> 501', r.status === 501 && r.json.error === 'google_not_configured', `status=${r.status} ${JSON.stringify(r.json)}`);

  const failed = results.filter(x => !x.pass).length;
  console.log(failed ? `\n${failed} FAILED of ${results.length}` : `\nALL ${results.length} PASS`);
  await new Promise(r => setTimeout(r, 100));
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
