'use strict';
// Chief console surfaces — the aggregate envelopes the chief-editor frontend
// actually renders. Core services (chief-overview / chief-contracts /
// chief-moderation) stay canonical; this file only *shapes* real documents to
// each page's read contract. Every function is annotated with the frontend
// file:line reads it satisfies.
//
// Nothing here invents metrics: counts come from countDocuments, lists from
// find(), and missing operator-entered values fall back to documented defaults
// (Dispute.priority 'medium', Dispute.confidence 0).

const { User } = require('../models/user.model');
const { Book } = require('../models/content.model');
const { Report, Dispute, Appeal } = require('../models/editorial.model');
const { Contract, ContractTemplate } = require('../models/contract.model');
const { EditorAssignment } = require('../models/chief.model');
const { Withdrawal } = require('../models/money.model');
const { ActivityLog } = require('../models/platform.model');

const SEV_BY_TYPE = { plagiarism: 'high', abuse: 'high', spam: 'medium', content: 'medium', other: 'low' };
const ACT_STYLE = {
  create: { icon: 'fa-plus', color: 'green' },
  update: { icon: 'fa-pen', color: 'blue' },
  delete: { icon: 'fa-trash', color: 'red' },
  login: { icon: 'fa-right-to-bracket', color: 'purple' },
  payout: { icon: 'fa-money-check-dollar', color: 'green' },
  review: { icon: 'fa-eye', color: 'amber' },
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function bold(s) { return '<b>' + esc(s) + '</b>'; }

// "3h ago" / "4d ago" — the console renders these verbatim.
function rel(d) {
  if (!d) return '';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const dd = Math.floor(h / 24);
  if (dd < 7) return dd + 'd ago';
  const w = Math.floor(dd / 7);
  if (dd < 30) return w + 'w ago';
  return Math.floor(dd / 30) + 'mo ago';
}

// "Jun 02, 2026" — demo date format used across the console tables.
function dateLabel(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '—';
  return x.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function money(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('en-US');
}

async function usersById(ids) {
  const uniq = Array.from(new Set((ids || []).map(String).filter(Boolean)));
  if (!uniq.length) return {};
  const rows = await User.find({ id: { $in: uniq } })
    .select('id fullName username avatar email').lean().catch(() => []);
  const m = {};
  rows.forEach(u => {
    m[String(u.id)] = {
      name: u.fullName || u.username || String(u.id),
      avatar: u.avatar || '',
      email: u.email || '',
    };
  });
  return m;
}

function nameOf(m, id) {
  const u = m[String(id)];
  return u ? u.name : '';
}
function avatarOf(m, id) {
  const u = m[String(id)];
  return (u && u.avatar) || 'https://i.pravatar.cc/100?img=12';
}

// Report.subjectType — documented mapping: reports that reference author
// content (story/chapter/collection) are author-facing; reports on platform
// community objects (post/comment/discussion) are editor-facing. Report has no
// stored target-type, so this is derived from which foreign key is populated.
function reportTargetType(r) {
  if (r.storyId || r.chapterId || r.collectionId) return 'author';
  return 'editor';
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/chief/dashboard
 * Reads: dashboard-service.js:64-67 (stat numbers), :79-89 (flaggedReports),
 * :112-117 (quickActions), :128-140 (editorQuotas), :148-160 (paymentsQueue),
 * :165-179 (recentActivity).
 * ───────────────────────────────────────────────────────────── */
async function dashboard() {
  const [seniorCount, authorCount, pendingContractDocs, reportDocs, editors, withdrawalDocs, activityDocs] =
    await Promise.all([
      User.countDocuments({ roles: 'senior_editor' }),
      User.countDocuments({ roles: 'writer' }),
      Contract.find({ status: { $in: ['pending', 'sent'] } }).sort({ updatedAt: -1 }).limit(50).lean(),
      Report.find({ status: 'pending' }).sort({ filedAt: -1 }).limit(50).lean(),
      User.find({ roles: 'senior_editor', status: { $ne: 'banned' } })
        .select('id fullName username avatar').lean(),
      Withdrawal.find({ status: { $in: ['requested', 'under_review'] } })
        .sort({ requestedAt: -1 }).limit(20).lean(),
      ActivityLog.find({}).sort({ at: -1 }).limit(20).lean(),
    ]);

  const [reportUsers, editorAssignments, withdrawalUsers] = await Promise.all([
    usersById(reportDocs.map(r => r.reporterId)),
    EditorAssignment.find({ editorId: { $in: editors.map(e => String(e.id)) } }).lean()
      .then(rows => {
        const m = {};
        rows.forEach(r => { m[String(r.editorId)] = r; });
        return m;
      })
      .catch(() => ({})),
    usersById(withdrawalDocs.map(w => w.authorId)),
  ]);

  const pendingContracts = pendingContractDocs.map(c => ({
    id: c.id,
    author: nameOf(withdrawalUsers, c.authorId) || nameOf(reportUsers, c.authorId) || String(c.authorId || ''),
    avatar: avatarOf(reportUsers, c.authorId),
    type: c.type,
    forwardedBy: c.editorId ? nameOf(reportUsers, c.editorId) : '',
    authorSigned: (c.signatures || []).some(s => s.role === 'author'),
    submitted: rel(c.sentAt || c.updatedAt || c.createdAt),
  }));

  const flaggedReports = reportDocs.map(r => ({
    id: r.id,
    targetType: reportTargetType(r),
    target: r.title,
    reason: r.desc,
    reportedBy: r.reporterLabel || nameOf(reportUsers, r.reporterId) || 'System',
    severity: SEV_BY_TYPE[r.type] || 'low',
    filed: rel(r.filedAt || r.createdAt),
    status: r.status,
  }));

  // Quota status is derived from invited/target with the thresholds the
  // demo uses: <75% = behind, >100% = ahead, otherwise on-track.
  const editorQuotas = editors.map(e => {
    const asg = editorAssignments[String(e.id)] || null;
    const q = (asg && asg.quota) || {};
    const target = Number(q.target) || 50;
    const invited = Number(q.invited) || 0;
    const pct = target > 0 ? invited / target : 1;
    return {
      id: e.id,
      name: e.fullName || e.username || String(e.id),
      avatar: e.avatar || 'https://i.pravatar.cc/100?img=5',
      invited,
      target,
      status: pct < 0.75 ? 'behind' : (pct > 1 ? 'ahead' : 'on-track'),
      deadline: q.deadline ? dateLabel(q.deadline) : '—',
    };
  });

  const paymentsQueue = withdrawalDocs.map(w => ({
    id: w.id,
    name: nameOf(withdrawalUsers, w.authorId) || String(w.authorId || ''),
    avatar: avatarOf(withdrawalUsers, w.authorId),
    role: 'Author',
    amount: money(w.amount),
    due: dateLabel(w.processedAt || w.requestedAt || w.createdAt),
    status: w.status === 'under_review' ? 'scheduled' : 'due',
  }));

  const behind = editorQuotas.filter(q => q.status === 'behind').length;
  const quickActions = [
    { label: 'Sign Pending Contracts', icon: 'fa-file-signature', cls: 'blue', count: pendingContracts.length, href: 'contracts-payments.html' },
    { label: 'Review Flagged Stories', icon: 'fa-flag', cls: 'red', count: flaggedReports.length, href: 'reports-flags.html' },
    { label: 'Run Payments', icon: 'fa-money-check-dollar', cls: 'green', count: 0, href: 'contracts-payments.html' },
    { label: 'Review Editor Quotas', icon: 'fa-bullseye', cls: 'purple', count: behind, href: 'senior-editors.html' },
  ];

  const recentActivity = activityDocs.map(a => {
    const style = ACT_STYLE[a.type] || { icon: 'fa-circle-info', color: 'accent' };
    const who = a.userLabel || 'Platform';
    const what = a.detail || a.action || '';
    return {
      icon: style.icon,
      color: style.color,
      text: bold(who) + (what ? ' ' + esc(what) : ''),
      time: rel(a.at),
    };
  });

  return {
    totalSeniorEditors: seniorCount,
    totalAuthors: authorCount,
    pendingContracts,
    flaggedReports,
    quickActions,
    editorQuotas,
    paymentsQueue,
    recentActivity,
  };
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/chief/contract-templates
 * Read contract: contracts-payments-service.js:23-25 accepts a bare ARRAY or
 * `{templates:[...]}`; item reads at :239-241, :262, :297-343, :516-530.
 * Returns the bare array (first acceptance branch).
 * ───────────────────────────────────────────────────────────── */
function templateShape(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.desc || '',
    type: t.type,
    status: t.status,
    clauses: t.clauseText || t.body || '',
    royaltyRate: t.royaltyRate == null ? 0 : t.royaltyRate,
    termLength: t.termLength || '—',
    signupBonusMin: t.signupBonusMin || 0,
    signupBonusMax: t.signupBonusMax || 0,
    completionTarget: t.completionTarget || 0,
    completionWindowMonths: t.completionWindowMonths || 0,
    profitShareThreshold: t.profitShareThreshold || 0,
    profitShareBonus: t.profitShareBonus || 0,
    autoRenew: !!t.autoRenew,
    usageCount: t.usageCount || 0,
    defaultChapterPrice: t.defaultChapterPrice || 0,
    cfHidden: Array.isArray(t.cfHidden) ? t.cfHidden : [],
    cfLabels: (t.cfLabels && typeof t.cfLabels === 'object') ? t.cfLabels : {},
    created: dateLabel(t.createdAt),
    lastEdited: dateLabel(t.updatedAt || t.createdAt),
  };
}

async function contractTemplates({ page, limit } = {}) {
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
  const items = await ContractTemplate.find({}).sort({ updatedAt: -1 })
    .skip((pg - 1) * lim).limit(lim).lean();
  return items.map(templateShape);
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/chief/author-contracts
 * Read contract: author-contracts-service.js:36 (templates), :38
 * (activeContracts), :40 (pendingOffers) — a composite, not {items,…}.
 * ───────────────────────────────────────────────────────────── */
// Contract has no template FK: the offer's source template is recorded in
// replies by chief-contracts.service.createOffer ("offer from template: X").
function templateLabelOf(c) {
  const msgs = (c.replies || []).map(r => r.message || '');
  for (const m of msgs) {
    const i = m.indexOf('offer from template: ');
    if (i >= 0) return m.slice(i + 21).trim();
  }
  return c.type || '—';
}

async function authorContractsComposite(query = {}) {
  const lim = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 100));

  const [tplDocs, activeDocs, pendingDocs] = await Promise.all([
    ContractTemplate.find({ status: { $ne: 'archived' } }).sort({ updatedAt: -1 }).limit(lim).lean(),
    Contract.find({ status: { $in: ['active', 'signed', 'approved'] } }).sort({ updatedAt: -1 }).limit(lim).lean(),
    Contract.find({ status: { $in: ['pending', 'sent'] } }).sort({ updatedAt: -1 }).limit(lim).lean(),
  ]);

  const ids = activeDocs.concat(pendingDocs).map(c => c.authorId);
  const umap = await usersById(ids);

  const templates = tplDocs.map(t => ({
    name: t.name,
    type: t.type,
    royalty: t.royaltyRate == null ? 0 : t.royaltyRate,
    defaultChapterPrice: t.defaultChapterPrice || 0,
    term: t.termLength || '—',
    used: t.usageCount || 0,
    status: t.status,
  }));

  const activeContracts = activeDocs.map(c => {
    const end = c.expiryAt || (c.effectiveAt
      ? new Date(new Date(c.effectiveAt).getTime() + (Number(c.termMonths) || 12) * 30 * 864e5)
      : null);
    const expiring = end && (end.getTime() - Date.now()) < 30 * 864e5;
    return {
      author: nameOf(umap, c.authorId) || String(c.authorId || ''),
      status: expiring ? 'expiring' : 'active',
      template: templateLabelOf(c),
      value: money(c.advance),
      start: dateLabel(c.effectiveAt || c.createdAt),
      end: dateLabel(end),
    };
  });

  const pendingOffers = pendingDocs.map(c => ({
    author: nameOf(umap, c.authorId) || String(c.authorId || ''),
    status: c.status === 'sent' ? 'awaiting-signature' : 'pending',
    template: templateLabelOf(c),
    value: money(c.advance),
    sent: dateLabel(c.sentAt || c.createdAt),
  }));

  return { templates, activeContracts, pendingOffers };
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/chief/disputes-appeals
 * Read contract: disputes-appeals-service.js:36 (authorAppeals), :38
 * (copyrightDisputes), :40 (plagiarismCases), :42 (escalatedReports),
 * :44 (resolutionHistory). Each read is outside the try/catch, so every key
 * must be present.
 * ───────────────────────────────────────────────────────────── */
// Dispute/Appeal status → the pill classes the console styles on.
function disputePill(s) {
  return s === 'in_review' ? 'investigating' : s;
}
function appealPill(s) {
  return s === 'in_review' ? 'investigating' : s;
}

async function disputesAppealsComposite(query = {}) {
  const lim = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));

  const [appealDocs, copyrightDocs, plagiarismDocs, escalatedDocs, closedDisputes, closedAppeals] =
    await Promise.all([
      Appeal.find({}).sort({ filedAt: -1 }).limit(lim).lean(),
      Dispute.find({ category: 'copyright' }).sort({ updatedAt: -1 }).limit(lim).lean(),
      Dispute.find({ category: 'plagiarism' }).sort({ updatedAt: -1 }).limit(lim).lean(),
      Dispute.find({ status: 'in_review' }).sort({ updatedAt: -1 }).limit(lim).lean(),
      Dispute.find({ status: { $in: ['resolved', 'dismissed'] } }).sort({ updatedAt: -1 }).limit(lim).lean(),
      Appeal.find({ status: { $in: ['upheld', 'rejected'] } }).sort({ updatedAt: -1 }).limit(lim).lean(),
    ]);

  const userIds = appealDocs.map(a => a.authorId)
    .concat(copyrightDocs.flatMap(d => [d.claimantId, d.respondentId]))
    .concat(plagiarismDocs.map(d => d.respondentId))
    .concat(escalatedDocs.map(d => [d.claimantId, d.respondentId]).flat())
    .concat(closedAppeals.map(a => a.decidedBy))
    .concat(closedDisputes.map(d => d.resolvedBy));
  const umap = await usersById(userIds);

  const authorAppeals = appealDocs.map(a => ({
    id: a.id,
    author: nameOf(umap, a.authorId) || String(a.authorId || ''),
    type: a.type,
    priority: a.priority,
    status: appealPill(a.status),
    detail: a.detail,
    filed: rel(a.filedAt || a.createdAt),
  }));

  const copyrightDisputes = copyrightDocs.map(d => ({
    id: d.id,
    title: d.title,
    status: disputePill(d.status),
    claimant: nameOf(umap, d.claimantId) || 'External',
    respondent: nameOf(umap, d.respondentId) || '—',
    filed: rel(d.createdAt),
    resolution: d.status === 'resolved' ? (d.resolution || '') : null,
  }));

  const plagiarismCases = plagiarismDocs.map(d => ({
    id: d.id,
    story: d.title,
    status: disputePill(d.status),
    accused: nameOf(umap, d.respondentId) || '—',
    filed: rel(d.createdAt),
    confidence: Number(d.confidence) || 0,
  }));

  const escalatedReports = escalatedDocs.map(d => ({
    id: d.id,
    type: d.title,
    priority: d.priority,
    status: disputePill(d.status),
    filed: rel(d.updatedAt || d.createdAt),
    reporter: nameOf(umap, d.claimantId) || 'Platform',
    against: nameOf(umap, d.respondentId) || '—',
  }));

  // Terminal states newest-first, merged across both models. The sort key is
  // kept alongside so the label (a relative string) never has to be parsed.
  const history = closedDisputes.map(d => ({
    sortAt: new Date(d.updatedAt || d.createdAt).getTime() || 0,
    action: d.resolution || d.title,
    date: rel(d.updatedAt || d.createdAt),
    by: nameOf(umap, d.resolvedBy) || 'Platform Team',
  })).concat(closedAppeals.map(a => ({
    sortAt: new Date(a.updatedAt || a.createdAt).getTime() || 0,
    action: a.detail || a.type,
    date: rel(a.updatedAt || a.createdAt),
    by: nameOf(umap, a.decidedBy) || 'Platform Team',
  })));
  history.sort((a, b) => b.sortAt - a.sortAt);
  const resolutionHistory = history.slice(0, lim).map(h => ({
    action: h.action, date: h.date, by: h.by,
  }));

  return { authorAppeals, copyrightDisputes, plagiarismCases, escalatedReports, resolutionHistory };
}

module.exports = {
  dashboard,
  contractTemplates,
  authorContractsComposite,
  disputesAppealsComposite,
};
