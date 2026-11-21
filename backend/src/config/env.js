'use strict';
require('dotenv').config();

function required(name, fallback) {
  const v = process.env[name] !== undefined ? process.env[name] : fallback;
  if (v === undefined || v === '') throw new Error('Missing env: ' + name);
  return v;
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: required('MONGO_URI'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  mfaTicketTtl: process.env.MFA_TICKET_TTL || '5m',
  mfaStepUpMinutes: parseInt(process.env.MFA_STEPUP_MINUTES || '5', 10),
  // MFA is optional per deployment. Without MFA_SECRET_KEY the API still boots;
  // every MFA write returns 503 mfa_not_configured instead of encrypting with
  // an empty key, and the status read reports mfaConfigured:false so the UI can
  // hide the toggle rather than offering a dead switch.
  mfaSecretKey: process.env.MFA_SECRET_KEY || '',
  mfaConfigured: !!process.env.MFA_SECRET_KEY,
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  isProd: process.env.NODE_ENV === 'production',
  // Reader view crediting. ONE tunable knob + ONE helper so the rule can be
  // changed later without touching the tracking write path.
  readerViewCreditWindowMs: Math.max(1000, parseInt(process.env.READER_VIEW_CREDIT_WINDOW_MS, 10) || 60000),
  backendUrl: (process.env.BACKEND_URL || '').replace(/\/$/, ''),
  appUrl: (process.env.APP_URL || '').replace(/\/$/, ''),
  mailProvider: process.env.MAIL_PROVIDER || 'log',
  mailFrom: process.env.MAIL_FROM || 'Droboard <noreply@droboard.com>',
  // Google OAuth (web authorization-code flow + app/ GIS idToken verify).
  // Placeholder-safe: routes return 501 with setup hint until configured.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: (process.env.GOOGLE_REDIRECT_URI || '').replace(/\/$/, ''),
  googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
  googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
  // Referral policy: inviter-only, staged (stage1 on signup, stage2 on read goal).
  // Payments: Google Play (app) + Paystack/Flutterwave (web). Any channel
  // without credentials fails closed (503) — never silent-credits.
  playPackageName: process.env.PLAY_PACKAGE_NAME || '',
  playServiceAccountJson: process.env.PLAY_SERVICE_ACCOUNT_JSON || '',
  paystackSecret: process.env.PAYSTACK_SECRET || '',
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  flwSecretKey: process.env.FLW_SECRET_KEY || '',
  flwPublicKey: process.env.FLW_PUBLIC_KEY || '',
  flwWebhookHash: process.env.FLW_WEBHOOK_HASH || '',
  referralStage1Coins: parseInt(process.env.REFERRAL_STAGE1_COINS || '3', 10),
  referralStage2Coins: parseInt(process.env.REFERRAL_STAGE2_COINS || '2', 10),
  referralReadSeconds: parseInt(process.env.REFERRAL_READ_SECONDS || '1800', 10), // 30 min
  referralWindowDays: parseInt(process.env.REFERRAL_WINDOW_DAYS || '7', 10),
  // Cloudinary image storage (replaces Cloudflare Images).
  // Set these three env vars in Render: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  // Bootstrap: comma-separated account emails promoted to the admin role at
  // boot. Lets a fresh production database reach the Super Admin console
  // without hand-editing Mongo. Safe to keep set; only listed emails match.
  // Author earnings posting: 'unlock' (default) credits the author wallet the
  // moment a chapter is unlocked. Set '24h', '3d', '7d' (or a number of hours)
  // to hold the earning as pending until it matures. The dashboard only counts
  // completed transactions, so delayed earnings appear once released.
  authorEarningsPostDelay: (function () {
    const raw = String(process.env.AUTHOR_EARNINGS_POST_DELAY || 'unlock').trim().toLowerCase();
    const map = { unlock: 0, '0': 0, immediate: 0, '24h': 24, '1d': 24, '3d': 72, '7d': 168, '14d': 336, '30d': 720 };
    if (map[raw] != null) return Math.max(0, map[raw]);
    const n = parseInt(raw, 10); // raw hours as a number
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })(),
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
};
