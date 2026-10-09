'use strict';
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const env = require('../config/env');
const { signAccess } = require('../middleware/auth');
const { User, RefreshFamily } = require('../models/user.model');
const referrals = require('./referrals.service');

function newId(prefix) {
  return prefix + '-' + crypto.randomBytes(9).toString('hex');
}
function hashToken(t) {
  return crypto.createHash('sha256').update(String(t)).digest('hex');
}
function signRefresh(familyId) {
  return jwt.sign({ fid: familyId }, env.jwtRefreshSecret, { expiresIn: '30d' });
}
// MFA secret encryption (AES-256-GCM, key from env)
function encSecret(plain) {
  const key = crypto.createHash('sha256').update(env.mfaSecretKey).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex') + ':' + c.getAuthTag().toString('hex');
}
function decSecret(blob) {
  const key = crypto.createHash('sha256').update(env.mfaSecretKey).digest();
  const [iv, enc, tag] = String(blob).split(':');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(enc, 'hex')), d.final()]).toString('utf8');
}
function hashCode(c) {
  return crypto.createHash('sha256').update(String(c)).digest('hex');
}

async function issueFamily(userId, { ip, ua, mfaAt }) {
  const familyId = newId('fam_');
  const token = signRefresh(familyId);
  await RefreshFamily.create({
    familyId, userId, currentHash: hashToken(token),
    mfaAt: mfaAt || null, ip: ip || '', ua: ua || '',
    expiresAt: new Date(Date.now() + 30 * 86400000),
  });
  return token;
}
function tokensFor(user, mfaAt) {
  return { access: signAccess({ id: user.id || user._id, roles: user.roles, _mfaAt: mfaAt || null }), mfaAt: mfaAt || null };
}
function adminNeedsMfaSetup(user) {
  const roles = user.roles || [];
  const privileged = roles.some(r => ['admin', 'finance', 'chief_editor', 'marketing'].includes(r));
  return privileged && !user.mfaEnabled;
}

async function register({ fullName, name, username, email, password, referralCode, country }) {
  const displayName = fullName || name;
  if (!displayName) { const e = new Error('invalid_input'); e.status = 400; throw e; }
  const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] }).lean();
  if (exists) { const e = new Error('taken'); e.status = 409; throw e; }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  // first account on the system automatically becomes the first admin
  const existingCount = await User.countDocuments();
  const roles = existingCount === 0 ? ['admin', 'reader'] : ['reader'];
  const user = await User.create({
    fullName: displayName, username: username.toLowerCase(), email: email.toLowerCase(),
    passwordHash, authProvider: 'local', roles,
    country: country || '',
    referralCode: await referrals.mintUserCode(username),
  });
  // Referral is best-effort: invalid/self codes never fail signup.
  let referral = { inviterId: null };
  try { referral = await referrals.applyReferral(user, referralCode); } catch (e) { /* log in caller */ }
  // Token is generated + hashed here so register() never returns an undefined binding.
  const verifyToken = crypto.randomBytes(24).toString('hex');
  user.emailVerifyTokenHash = hashToken(verifyToken);
  await user.save();
  // Verification email via template (admin-defined only — no fallback).
  // Token is returned ONLY in log (dev) mode — never alongside real delivery.
  let emailed = false;
  let emailError = null;
  try {
    const mail = require('./mail.service');
    const appUrl = (mail.cfg().appUrl || '').replace(/\/$/, '');
    const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '') || 'http://127.0.0.1:4000';
    await mail.sendTemplate('verify-email', user.email, {
      name: user.fullName || user.username, appUrl,
      link: backendUrl + '/api/auth/verify-email?token=' + verifyToken,
    });
    emailed = true;
  } catch (e) { emailed = false; emailError = (e && e.message) || 'email_failed'; }
  const out = { id: user._id, username: user.username, email: user.email, referral, emailed, emailError };
  if (require('./mail.service').cfg().provider === 'log') out.verifyToken = verifyToken;
  return out;
}

async function registerWithVerify(input) {
  const created = await register(input); // register already generated + hashed the token
  const { verifyToken, ...user } = created;
  return { user, verifyToken };
}

async function verifyEmail(token) {
  const user = await User.findOne({ emailVerifyTokenHash: hashToken(String(token || '')) });
  if (!user) { const e = new Error('bad_token'); e.status = 400; throw e; }
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerifyTokenHash = null;
  await user.save();
  return { ok: true };
}

async function forgotPassword(email) {
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  // always OK (no account enumeration)
  if (!user) return { ok: true };
  const raw = crypto.randomBytes(24).toString('hex');
  user.resetTokenHash = hashToken(raw);
  user.resetExpiresAt = new Date(Date.now() + 60 * 60000);
  await user.save();
  let emailed = false;
  let emailError = null;
  try {
    const mail = require('./mail.service');
    const appUrl = (mail.cfg().appUrl || '').replace(/\/$/, '') || 'http://127.0.0.1:5501';
    await mail.sendTemplate('reset-password', user.email, {
      name: user.fullName || user.username, appUrl,
      link: appUrl + '/Pages/reset-password.html?token=' + raw,
    });
    emailed = true;
  } catch (e) { emailed = false; emailError = (e && e.message) || 'email_failed'; }
  const out = { ok: true, emailed, emailError };
  if (require('./mail.service').cfg().provider === 'log') out.resetToken = raw;
  return out;
}

async function resetPassword(token, password) {
  const user = await User.findOne({
    resetTokenHash: hashToken(String(token || '')),
    resetExpiresAt: { $gt: new Date() },
  }).select('+passwordHash');
  if (!user) { const e = new Error('bad_token'); e.status = 400; throw e; }
  user.passwordHash = await argon2.hash(String(password), { type: argon2.argon2id });
  user.resetTokenHash = null;
  user.resetExpiresAt = null;
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  await user.save();
  await RefreshFamily.deleteMany({ userId: user.id }); // kill all sessions
  return { ok: true };
}

async function login({ emailOrUsername, password, ip }) {
  const q = String(emailOrUsername || '').toLowerCase();
  const user = await User.findOne({ $or: [{ email: q }, { username: q }] }).select('+passwordHash');
  if (user && user.lockedUntil && user.lockedUntil > new Date()) {
    const e = new Error('locked'); e.status = 423; throw e;
  }
  const ok = user && user.passwordHash ? await argon2.verify(user.passwordHash, String(password || '')).catch(() => false) : false;
  if (!ok) {
    if (user) {
      user.failedLoginCount = (user.failedLoginCount || 0) + 1;
      if (user.failedLoginCount >= 5) { user.lockedUntil = new Date(Date.now() + 15 * 60000); user.failedLoginCount = 0; }
      await user.save();
    }
    const e = new Error('invalid'); e.status = 401; throw e;
  }
  user.failedLoginCount = 0;
  user.lastLoginAt = new Date();
  user.lastLoginIp = ip || '';
  await user.save();
  // Banned/suspended accounts authenticate fine but get no session.
  if (user.status === 'banned') { const e = new Error('banned'); e.status = 403; throw e; }
  if (user.status === 'suspended') { const e = new Error('suspended'); e.status = 403; throw e; }
  const needsMfa = user.mfaEnabled;
  if (needsMfa) {
    // short-lived single-purpose ticket; full tokens only after TOTP
    const ticket = jwt.sign({ sub: user.id, purpose: 'mfa' }, env.jwtRefreshSecret, { expiresIn: env.mfaTicketTtl });
    return { mfaRequired: true, ticket };
  }
  const refresh = await issueFamily(user.id, { ip });
  const out = Object.assign({ mfaRequired: false, refresh }, tokensFor(user, null));
  out.mfaSetupRequired = adminNeedsMfaSetup(user);
  return out;
}

async function verifyMfa({ ticket, code, ip }) {
  let p;
  try { p = jwt.verify(ticket, env.jwtRefreshSecret); } catch (e) { const err = new Error('bad_ticket'); err.status = 401; throw err; }
  if (!p || p.purpose !== 'mfa') { const e = new Error('bad_ticket'); e.status = 401; throw e; }
  const user = await User.findOne({ id: p.sub }).select('+mfaSecret +mfaBackupCodes');
  if (!user || !user.mfaEnabled || !user.mfaSecret) { const e = new Error('no_mfa'); e.status = 400; throw e; }
  const secret = decSecret(user.mfaSecret);
  const okTotp = authenticator.check(String(code).replace(/\s/g, ''), secret);
  let usedBackup = false;
  if (!okTotp) {
    const h = hashCode(String(code).replace(/\s/g, '').toUpperCase());
    const idx = (user.mfaBackupCodes || []).indexOf(h);
    if (idx === -1) { const e = new Error('bad_code'); e.status = 401; throw e; }
    user.mfaBackupCodes.splice(idx, 1); // single-use
    usedBackup = true;
  }
  const mfaAt = new Date().toISOString();
  await user.save();
  const refresh = await issueFamily(user.id, { ip, mfaAt });
  return Object.assign({ refresh, usedBackup }, tokensFor(user, mfaAt));
}

async function refresh({ token, ip }) {
  let p;
  try { p = jwt.verify(token, env.jwtRefreshSecret); } catch (e) { const err = new Error('bad_token'); err.status = 401; throw err; }
  const fam = await RefreshFamily.findOne({ familyId: p.fid });
  if (!fam || fam.expiresAt < new Date()) { const e = new Error('bad_token'); e.status = 401; throw e; }
  const h = hashToken(token);
  if (fam.reused || (h !== fam.currentHash && h !== fam.prevHash)) {
    // unknown token on a live family → possible theft: burn family
    fam.reused = true; await fam.save();
    await RefreshFamily.deleteMany({ familyId: fam.familyId });
    const e = new Error('reuse_detected'); e.status = 401; throw e;
  }
  if (h === fam.prevHash) {
    // benign retry (client got rotated token twice): re-issue without rotating
    const user = await User.findOne({ id: fam.userId });
    return Object.assign({ refresh: token }, tokensFor(user, fam.mfaAt));
  }
  // rotate
  const next = signRefresh(fam.familyId);
  fam.prevHash = fam.currentHash;
  fam.currentHash = hashToken(next);
  await fam.save();
  const user = await User.findOne({ id: fam.userId });
  return Object.assign({ refresh: next }, tokensFor(user, fam.mfaAt));
}

async function logout({ token }) {
  try {
    const p = jwt.verify(token, env.jwtRefreshSecret);
    await RefreshFamily.deleteMany({ familyId: p.fid });
  } catch (e) { /* already dead */ }
  return { ok: true };
}

async function enrollMfa(userId) {
  const user = await User.findOne({ id: userId }).select('+mfaSecret +mfaBackupCodes');
  if (!user) { const e = new Error('no_user'); e.status = 404; throw e; }
  const secret = authenticator.generateSecret();
  user.mfaSecret = encSecret(secret);
  user.mfaBackupCodes = [];
  await user.save();
  const otpauth = authenticator.keyuri(user.email, 'Droboard', secret);
  return { otpauth, secret }; // show QR once; confirm with a code below
}

async function confirmMfa(userId, code) {
  const user = await User.findOne({ id: userId }).select('+mfaSecret +mfaBackupCodes');
  const secret = decSecret(user.mfaSecret);
  if (!authenticator.check(String(code).replace(/\s/g, ''), secret)) { const e = new Error('bad_code'); e.status = 401; throw e; }
  const codes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
  user.mfaBackupCodes = codes.map(hashCode);
  user.mfaEnabled = true;
  user.mfaEnrolledAt = new Date();
  await user.save();
  return { backupCodes: codes }; // show ONCE
}

// ── Google OAuth (web authorization-code + app/GIS idToken) ──────────────
// Web:  GET /google/url -> Google consent -> ?code= -> POST /google/callback {code}
// App:  Google SDK / GIS on device -> POST /google/callback {idToken}
// Both converge on verifyGoogleIdentity() -> find-or-create -> normal session.
function googleConfigured() {
  return !!(env.googleClientId && env.googleRedirectUri);
}

function googleAudiences() {
  return [env.googleClientId, env.googleAndroidClientId, env.googleIosClientId].filter(Boolean);
}

function getGoogleAuthUrl({ mode, referralCode, redirectUri, state } = {}) {
  if (!env.googleClientId) {
    const e = new Error('google_not_configured');
    e.status = 501;
    e.hint = 'Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI';
    throw e;
  }
  const cb = redirectUri || env.googleRedirectUri;
  const allowed = [env.googleRedirectUri, env.appUrl].filter(Boolean);
  if (allowed.length && !allowed.some(a => String(cb).startsWith(a))) {
    const e = new Error('bad_redirect_uri'); e.status = 400; throw e;
  }
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: cb,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state: state || Buffer.from(JSON.stringify({ mode: mode || 'login', ref: referralCode || null, n: crypto.randomBytes(8).toString('hex') })).toString('base64url'),
  });
  return { authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(), state: params.get('state') };
}

// Exchange authorization code for Google tokens (server-side, secret never leaves backend).
async function exchangeGoogleCode({ code, redirectUri, codeVerifier }) {
  if (!env.googleClientId || !env.googleClientSecret) {
    const e = new Error('google_not_configured'); e.status = 501; throw e;
  }
  const body = new URLSearchParams({
    code: String(code),
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: redirectUri || env.googleRedirectUri,
    grant_type: 'authorization_code',
  });
  if (codeVerifier) { body.set('code_verifier', String(codeVerifier)); body.set('grant_type', 'authorization_code'); }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
  });
  if (!res.ok) { const e = new Error('google_exchange_failed'); e.status = 502; throw e; }
  const tok = await res.json();
  if (!tok.id_token && !tok.access_token) { const e = new Error('google_exchange_failed'); e.status = 502; throw e; }
  return tok;
}

async function googleUserFromAccessToken(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) { const e = new Error('google_userinfo_failed'); e.status = 502; throw e; }
  return res.json();
}

// Verify a Google ID token (GIS / native SDK path). Checks signature via
// Google tokeninfo, audience (web + android + ios client IDs), expiry, issuer.
async function verifyGoogleIdToken(idToken) {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(idToken)));
  if (!res.ok) { const e = new Error('bad_google_token'); e.status = 401; throw e; }
  const info = await res.json();
  const auds = googleAudiences();
  if (auds.length && !auds.includes(info.aud)) { const e = new Error('bad_google_audience'); e.status = 401; throw e; }
  if (info.exp && Number(info.exp) * 1000 < Date.now()) { const e = new Error('google_token_expired'); e.status = 401; throw e; }
  if (info.iss !== 'https://accounts.google.com' && info.iss !== 'accounts.google.com') {
    const e = new Error('bad_google_issuer'); e.status = 401; throw e;
  }
  return info; // { sub, email, email_verified, name, picture, ... }
}

function uniqueUsernameFromEmail(email, name) {
  const base = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '').slice(0, 16) || 'user';
  return { base, fallback: String(name || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 16) || 'user' };
}

async function findOrCreateGoogleUser(googleInfo, { referralCode } = {}) {
  const sub = String(googleInfo.sub || googleInfo.id || '');
  const email = String(googleInfo.email || '').toLowerCase();
  if (!sub || !email) { const e = new Error('google_no_email'); e.status = 422; throw e; }
  const verified = String(googleInfo.email_verified ?? googleInfo.verified_email ?? 'true') === 'true';
  // 1) existing link by provider, 2) existing account by email (link it)
  let user = await User.findOne({ authProvider: 'google', providerId: sub });
  let isNew = false;
  if (!user) user = await User.findOne({ email }).select('+passwordHash');
  if (user) {
    if (!user.providerId) { user.providerId = sub; }
    if (user.authProvider === 'local') { user.authProvider = 'google'; } // keep password for fallback
    if (verified && !user.emailVerified) { user.emailVerified = true; user.emailVerifiedAt = new Date(); }
    if (googleInfo.picture && !user.avatar) user.avatar = String(googleInfo.picture).slice(0, 500);
    if (!user.referralCode) user.referralCode = await referrals.mintUserCode(user.username);
    await user.save();
  } else {
    const { base } = uniqueUsernameFromEmail(email, googleInfo.name);
    let username = base;
    for (let i = 0; i < 5; i++) {
      const clash = await User.exists({ $or: [{ username }, { email }] });
      if (!clash) break;
      username = (base + '_' + randomSuffix(4)).toLowerCase();
    }
    const existingCount = await User.countDocuments();
    user = await User.create({
      fullName: String(googleInfo.name || email.split('@')[0]).slice(0, 80),
      username: username.toLowerCase(), email,
      passwordHash: null, authProvider: 'google', providerId: sub,
      avatar: String(googleInfo.picture || '').slice(0, 500),
      roles: existingCount === 0 ? ['admin', 'reader'] : ['reader'],
      emailVerified: verified, emailVerifiedAt: verified ? new Date() : null,
      referralCode: await referrals.mintUserCode(username),
    });
    isNew = true;
    try { await referrals.applyReferral(user, referralCode); } catch (e) { /* best-effort */ }
  }
  return { user, isNew };
}

// Shared session issuer: Google logins reuse the SAME cookie/JWT/MFA pipeline
// as password login, so step-up + rotation + reuse-detection stay identical.
async function issueSessionFor(user, { ip, ua }) {
  const full = await User.findById(user._id);
  if (full.mfaEnabled) {
    const ticket = jwt.sign({ sub: full._id, purpose: 'mfa' }, env.jwtRefreshSecret, { expiresIn: env.mfaTicketTtl });
    return { mfaRequired: true, ticket };
  }
  full.lastLoginAt = new Date();
  full.lastLoginIp = ip || '';
  await full.save();
  const refresh = await issueFamily(full._id, { ip, ua });
  const out = Object.assign({ mfaRequired: false, refresh }, tokensFor(full, null));
  out.mfaSetupRequired = adminNeedsMfaSetup(full);
  return out;
}

async function googleCallback({ code, idToken, redirectUri, codeVerifier, referralCode, ip, ua }) {
  let info;
  if (idToken) {
    info = await verifyGoogleIdToken(idToken);
  } else if (code) {
    const tok = await exchangeGoogleCode({ code, redirectUri, codeVerifier });
    if (tok.id_token) {
      try { info = await verifyGoogleIdToken(tok.id_token); }
      catch (e) { info = await googleUserFromAccessToken(tok.access_token); info.sub = info.sub || info.id; }
    } else {
      info = await googleUserFromAccessToken(tok.access_token);
      info.sub = info.sub || info.id;
    }
  } else {
    const e = new Error('missing_code_or_token'); e.status = 400; throw e;
  }
  const { user, isNew } = await findOrCreateGoogleUser(info, { referralCode });
  const session = await issueSessionFor(user, { ip, ua });
  return { user, isNew, session };
}

// FIX 8a: resend email verification (authed user or email body).
async function resendVerification({ userId, email }) {
  let user = null;
  if (userId) user = await User.findOne({ id: userId });
  else if (email) user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) return { ok: true }; // no enumeration
  if (user.emailVerified) return { ok: true, alreadyVerified: true };
  const raw = crypto.randomBytes(24).toString('hex');
  user.emailVerifyTokenHash = hashToken(raw);
  await user.save();
  let emailed = false;
  let emailError = null;
  try {
    const mail = require('./mail.service');
    const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '') || 'http://127.0.0.1:4000';
    await mail.sendTemplate('verify-email', user.email, {
      name: user.fullName || user.username,
      appUrl: (mail.cfg().appUrl || '').replace(/\/$/, ''),
      link: backendUrl + '/api/auth/verify-email?token=' + raw,
    });
    emailed = true;
  } catch (e) { emailed = false; emailError = (e && e.message) || 'email_failed'; }
  const out = { ok: true, emailed, emailError };
  if (require('./mail.service').cfg().provider === 'log') out.verifyToken = raw;
  return out;
}

// FIX 8b: phone OTP (dev returns code; wire SMS provider here later).
async function requestPhoneOtp(userId, { phone }) {
  const user = await User.findOne({ id: userId }).select('+phoneOtpHash');
  if (!user) { const e = new Error('no_user'); e.status = 404; throw e; }
  const digits = String(phone || user.phone || '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) { const e = new Error('bad_phone'); e.status = 400; throw e; }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  user.phone = '+' + digits;
  user.phoneVerified = false;
  user.phoneOtpHash = hashToken(code);
  user.phoneOtpExpiresAt = new Date(Date.now() + 10 * 60000);
  user.phoneOtpAttempts = 0;
  await user.save();
  return { ok: true, otp: code };
}

async function verifyPhoneOtp(userId, { code }) {
  const user = await User.findOne({ id: userId }).select('+phoneOtpHash');
  if (!user || !user.phoneOtpHash) { const e = new Error('no_otp'); e.status = 400; throw e; }
  if (user.phoneOtpExpiresAt && user.phoneOtpExpiresAt < new Date()) {
    const e = new Error('otp_expired'); e.status = 400; throw e;
  }
  if ((user.phoneOtpAttempts || 0) >= 5) { const e = new Error('too_many_attempts'); e.status = 429; throw e; }
  if (hashToken(String(code || '').trim()) !== user.phoneOtpHash) {
    user.phoneOtpAttempts = (user.phoneOtpAttempts || 0) + 1;
    await user.save();
    const e = new Error('bad_code'); e.status = 401; throw e;
  }
  user.phoneVerified = true;
  user.phoneOtpHash = null;
  user.phoneOtpExpiresAt = null;
  user.phoneOtpAttempts = 0;
  await user.save();
  return { ok: true, phoneVerified: true, phone: user.phone };
}

// FIX 8c: disable MFA (password or TOTP checked) + regenerate backup codes + status.
async function disableMfa(userId, { password, code }) {
  const user = await User.findOne({ id: userId }).select('+passwordHash +mfaSecret +mfaBackupCodes');
  if (!user) { const e = new Error('no_user'); e.status = 404; throw e; }
  if (!user.mfaEnabled) return { ok: true, mfaEnabled: false };
  let ok = false;
  if (code && user.mfaSecret) {
    try {
      const secret = decSecret(user.mfaSecret);
      ok = authenticator.check(String(code).replace(/\s/g, ''), secret);
      if (!ok) {
        const h = hashCode(String(code).replace(/\s/g, '').toUpperCase());
        ok = (user.mfaBackupCodes || []).includes(h);
      }
    } catch (e) { ok = false; }
  }
  if (!ok && password && user.passwordHash) {
    ok = await argon2.verify(user.passwordHash, String(password)).catch(() => false);
  }
  if (!ok) { const e = new Error('verification_required'); e.status = 401; throw e; }
  user.mfaEnabled = false;
  user.mfaSecret = null;
  user.mfaBackupCodes = [];
  user.mfaEnrolledAt = null;
  await user.save();
  return { ok: true, mfaEnabled: false };
}

async function mfaStatus(userId) {
  const user = await User.findOne({ id: userId }).select('mfaEnabled mfaEnrolledAt').lean();
  if (!user) { const e = new Error('no_user'); e.status = 404; throw e; }
  return { mfaEnabled: !!user.mfaEnabled, mfaEnrolledAt: user.mfaEnrolledAt || null };
}

async function regenerateBackupCodes(userId) {
  const user = await User.findOne({ id: userId }).select('+mfaBackupCodes');
  if (!user) { const e = new Error('no_user'); e.status = 404; throw e; }
  if (!user.mfaEnabled) { const e = new Error('mfa_not_enabled'); e.status = 400; throw e; }
  const codes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
  user.mfaBackupCodes = codes.map(hashCode);
  await user.save();
  return { backupCodes: codes };
}

// FIX 8d: sessions list + revoke one / revoke others.
async function listSessions(userId) {
  const rows = await RefreshFamily.find({ userId }).sort({ createdAt: -1 }).lean();
  return {
    items: rows.map(r => ({
      familyId: r.familyId, ip: r.ip, ua: r.ua,
      expiresAt: r.expiresAt, createdAt: r.createdAt, mfaAt: r.mfaAt || null,
    })),
  };
}

async function revokeSession(userId, familyId) {
  await RefreshFamily.deleteOne({ userId, familyId });
  return { ok: true };
}

async function revokeOtherSessions(userId, currentFamilyId) {
  const filter = { userId };
  if (currentFamilyId) filter.familyId = { $ne: currentFamilyId };
  await RefreshFamily.deleteMany(filter);
  return { ok: true };
}

module.exports = { register, registerWithVerify, verifyEmail, forgotPassword, resetPassword, login, verifyMfa, refresh, logout, enrollMfa, confirmMfa, resendVerification, requestPhoneOtp, verifyPhoneOtp, disableMfa, mfaStatus, regenerateBackupCodes, listSessions, revokeSession, revokeOtherSessions, googleConfigured, getGoogleAuthUrl, googleCallback };
