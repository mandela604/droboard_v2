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
  mfaSecretKey: required('MFA_SECRET_KEY'),
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  isProd: process.env.NODE_ENV === 'production',
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
  referralStage1Coins: parseInt(process.env.REFERRAL_STAGE1_COINS || '3', 10),
  referralStage2Coins: parseInt(process.env.REFERRAL_STAGE2_COINS || '2', 10),
  referralReadSeconds: parseInt(process.env.REFERRAL_READ_SECONDS || '1800', 10), // 30 min
  referralWindowDays: parseInt(process.env.REFERRAL_WINDOW_DAYS || '7', 10),
};
