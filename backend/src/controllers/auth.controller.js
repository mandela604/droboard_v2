'use strict';
const auth = require('../services/auth.service');
const base = require('./base.controller');

async function register(req, res) {
  // Frontend compat: signup.html sends {name, country}; API docs use {fullName}.
  const b = req.valid.body || {};
  const fullName = b.fullName || b.name;
  const { username, email, password, referralCode, country } = b;
  return base.wrap(res, async () => {
    const out = await auth.registerWithVerify({ fullName, username, email, password, referralCode, country });
    return { user: out.user, verifyToken: out.verifyToken };
  });
}

async function verifyEmail(req, res) {
  // Browser click from the email (Accept: text/html) lands on login with a
  // status flag; API clients keep the JSON contract.
  const wantsHtml = String((req.headers && req.headers.accept) || '').includes('text/html');
  try {
    await auth.verifyEmail(req.valid.query.token || req.valid.body.token);
    if (wantsHtml) {
      const appUrl = ((process.env.APP_URL || '').replace(/\/$/, '')) || 'http://127.0.0.1:5501';
      return res.redirect(302, appUrl + '/Pages/login.html?verified=1');
    }
    return base.wrap(res, async () => ({ ok: true }));
  } catch (e) {
    if (wantsHtml) {
      const appUrl = ((process.env.APP_URL || '').replace(/\/$/, '')) || 'http://127.0.0.1:5501';
      return res.redirect(302, appUrl + '/Pages/login.html?verified=0');
    }
    return base.wrap(res, async () => { throw e; });
  }
}

async function forgotPassword(req, res) {
  return base.wrap(res, async () => auth.forgotPassword(req.valid.body.email));
}

async function resetPassword(req, res) {
  return base.wrap(res, async () => auth.resetPassword(req.valid.body.token, req.valid.body.password));
}

async function login(req, res) {
  // Frontend compat: login.html sends {email}; API uses {emailOrUsername}.
  const b = req.valid.body || {};
  const emailOrUsername = b.emailOrUsername || b.email;
  const { password } = b;
  return base.wrap(res, async () => {
    const out = await auth.login({ emailOrUsername, password, ip: req.ip });
    if (!out.mfaRequired) { base.setRefreshCookie(res, out.refresh); base.setAccessCookie(res, out.access); }
    return out.mfaRequired ? { mfaRequired: true, ticket: out.ticket } : { access: out.access, mfaSetupRequired: !!out.mfaSetupRequired };
  });
}

async function mfaVerify(req, res) {
  const { ticket, code } = req.valid.body;
  return base.wrap(res, async () => {
    const out = await auth.verifyMfa({ ticket, code, ip: req.ip });
    base.setRefreshCookie(res, out.refresh);
    base.setAccessCookie(res, out.access);
    return { access: out.access, usedBackup: out.usedBackup };
  });
}

async function refresh(req, res) {
  const token = (req.cookies && req.cookies.dro_refresh) || req.body.refresh;
  if (!token) return res.status(401).json({ error: 'no_token' });
  return base.wrap(res, async () => {
    const out = await auth.refresh({ token, ip: req.ip });
    if (out.refresh) base.setRefreshCookie(res, out.refresh);
    base.setAccessCookie(res, out.access);
    return { access: out.access };
  });
}

async function logout(req, res) {
  const token = (req.cookies && req.cookies.dro_refresh) || req.body.refresh;
  return base.wrap(res, async () => {
    await auth.logout({ token });
    base.clearRefreshCookie(res);
    base.clearAccessCookie(res);
    return { ok: true };
  });
}

async function mfaEnroll(req, res) {
  return base.wrap(res, async () => auth.enrollMfa(req.user.id));
}

async function mfaConfirm(req, res) {
  return base.wrap(res, async () => auth.confirmMfa(req.user.id, req.valid.body.code));
}

async function resendVerification(req, res) {
  const b = req.valid.body || {};
  return base.wrap(res, async () => auth.resendVerification({ userId: req.user && req.user.id, email: b.email }));
}

async function requestPhoneOtp(req, res) {
  return base.wrap(res, async () => auth.requestPhoneOtp(req.user.id, req.valid.body));
}

async function verifyPhoneOtp(req, res) {
  return base.wrap(res, async () => auth.verifyPhoneOtp(req.user.id, req.valid.body));
}

async function mfaDisable(req, res) {
  return base.wrap(res, async () => auth.disableMfa(req.user.id, req.valid.body || {}));
}

async function mfaStatus(req, res) {
  return base.wrap(res, async () => auth.mfaStatus(req.user.id));
}

async function mfaBackupRegen(req, res) {
  return base.wrap(res, async () => auth.regenerateBackupCodes(req.user.id));
}

async function listSessions(req, res) {
  return base.wrap(res, async () => auth.listSessions(req.user.id));
}

async function revokeSession(req, res) {
  return base.wrap(res, async () => auth.revokeSession(req.user.id, req.valid.params.familyId));
}

async function googleUrl(req, res) {
  return base.wrap(res, async () => auth.getGoogleAuthUrl({
    mode: (req.valid.query && req.valid.query.mode) || 'login',
    referralCode: (req.valid.query && req.valid.query.referralCode) || null,
    redirectUri: (req.valid.query && req.valid.query.redirectUri) || undefined,
  }));
}

async function googleCallback(req, res) {
  const b = req.valid.body || {};
  return base.wrap(res, async () => {
    const { user, isNew, session } = await auth.googleCallback({
      code: b.code, idToken: b.idToken, redirectUri: b.redirectUri,
      codeVerifier: b.codeVerifier, referralCode: b.referralCode,
      ip: req.ip, ua: req.headers['user-agent'] || '',
    });
    if (session.mfaRequired) return { mfaRequired: true, ticket: session.ticket, isNew };
    base.setRefreshCookie(res, session.refresh);
    base.setAccessCookie(res, session.access);
    // Frontend compat: legacy clients read token/user at top level.
    return {
      access: session.access, refresh: session.refresh, token: session.access,
      isNew, mfaSetupRequired: !!session.mfaSetupRequired,
      user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, avatar: user.avatar },
    };
  });
}

module.exports = { register, verifyEmail, forgotPassword, resetPassword, login, mfaVerify, refresh, logout, mfaEnroll, mfaConfirm, resendVerification, requestPhoneOtp, verifyPhoneOtp, mfaDisable, mfaStatus, mfaBackupRegen, listSessions, revokeSession, googleUrl, googleCallback };
