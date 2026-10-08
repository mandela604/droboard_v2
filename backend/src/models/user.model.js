/**
 * models/user.model.js — identity, auth, sessions, audit.
 * IDs: custom prefixed strings (usr_…) as _id. Never expose internals.
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  emailVerified: { type: Boolean, default: false },
  emailVerifiedAt: { type: Date, default: null },
  emailVerifyTokenHash: { type: String, default: null, select: false },
  resetTokenHash: { type: String, default: null, select: false },
  resetExpiresAt: { type: Date, default: null },
  phone: { type: String, default: null, sparse: true },
  phoneVerified: { type: Boolean, default: false },
  phoneOtpHash: { type: String, default: null, select: false },
  phoneOtpExpiresAt: { type: Date, default: null },
  phoneOtpAttempts: { type: Number, default: 0 },
  pendingEmail: { type: String, default: null, lowercase: true, trim: true },
  pendingEmailTokenHash: { type: String, default: null, select: false },
  pendingEmailExpiresAt: { type: Date, default: null },
  passwordHash: { type: String, default: null, select: false }, // null = OAuth-only
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  providerId: { type: String, default: null },
  avatar: { type: String, default: '' },
  cover: { type: String, default: '' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  about: { type: mongoose.Schema.Types.Mixed, default: null },
  genres: { type: [String], default: [] },
  country: { type: String, default: '' },
  locale: { type: String, default: 'en' },
  // MFA (TOTP + backup codes, enforced per role)
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String, default: null, select: false }, // encrypted at rest
  mfaBackupCodes: { type: [String], default: [], select: false }, // hashed, single-use
  mfaEnrolledAt: { type: Date, default: null },
  // roles[] drives MFA enforcement + RBAC; primaryRole for display
  roles: { type: [String], default: ['reader'], index: true }, // reader|writer|senior_editor|chief_editor|finance|admin
  primaryRole: { type: String, default: 'reader' },
  status: { type: String, enum: ['active', 'suspended', 'banned', 'pending_verification'], default: 'active', index: true },
  suspendedReason: { type: String, default: '' },
  // login protection
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: '' },
  // referrals
  referralCode: { type: String, unique: true, sparse: true, index: true },
  referredByUserId: { type: String, ref: 'User', default: null },
  settings: {
    theme: { type: String, default: 'dark' },
    notifications: { type: Boolean, default: true },
    privacy: { type: String, default: 'public' },
  },
  termsVersion: { type: String, default: '' },
  // super-admin console extras (admin-curated, additive)
  adminNotes: { type: String, default: '' },
  authorGenre: { type: String, default: '' }, // admin-curated primary genre for writers
  deletedAt: { type: Date, default: null }, // soft delete
}, { timestamps: true });

userSchema.index({ status: 1 });

// Refresh-token families (rotation + reuse detection)
const refreshFamilySchema = new mongoose.Schema({
  familyId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, ref: 'User', required: true, index: true },
  currentHash: { type: String, required: true },
  prevHash: { type: String, default: null },
  reused: { type: Boolean, default: false }, // reuse detected → family burned
  mfaAt: { type: Date, default: null }, // last step-up, for requireFreshMfa
  ip: { type: String, default: '' },
  ua: { type: String, default: '' },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

// Admin audit log (every admin action; fire-and-forget from middleware)
const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, ref: 'User', required: true, index: true },
  action: { type: String, required: true, index: true }, // e.g. withdrawal.approved
  entity: { type: String, default: '' },
  entityId: { type: String, default: '', index: true },
  diff: { type: mongoose.Schema.Types.Mixed, default: null },
  ip: { type: String, default: '' },
  ua: { type: String, default: '' },
  at: { type: Date, default: Date.now, index: true },
}, { timestamps: false });
auditLogSchema.index({ at: -1 });

module.exports = {
  User: mongoose.model('User', userSchema),
  RefreshFamily: mongoose.model('RefreshFamily', refreshFamilySchema),
  AuditLog: mongoose.model('AuditLog', auditLogSchema),
};
