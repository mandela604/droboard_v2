'use strict';
/**
 * services/book-flag.service.js — the flag/unflag path the senior-editor console uses.
 *
 * A flag does two things at once: the book's own status parks at `flagged` and an
 * open Report row mirrors it into the shared review queues. Unflagging settles
 * that row again. Keeping both halves in one place is the point — a console that
 * flagged without the Report row would hide the book from review while taking it
 * out of circulation.
 *
 * Scope: only the senior editor assigned to the book's author may flag or unflag
 * it (assertFlagRole + senior.assertOwned). The chief editor has no flag path at
 * all — a chief reads the outcome at GET /api/chief/books/flagged and decides the
 * Report row.
 */
const { Book } = require('../models/content.model');
const { Report } = require('../models/editorial.model');
const senior = require('./senior.service');

function err(msg, status) { const e = new Error(msg); e.status = status || 400; throw e; }

// The chief reads the flagged queue and decides the Report row; parking a book is
// not their act. The senior router also admits chief/admin, and senior.assertOwned
// is deliberately unscoped for them, so deleting the chief routes is not enough —
// the ban has to live here.
function assertFlagRole(user) {
  const roles = (user && user.roles) || [];
  if (roles.includes('chief_editor') || roles.includes('admin')) err('chief_does_not_flag', 403);
  if (!roles.includes('senior_editor')) err('not_allowed', 403);
}

// Flag reasons are free text from the console; map them onto Report's enum so
// the chief Story Reports queue can filter without keyword matching.
function reportTypeFor(reason) {
  const r = String(reason || '').toLowerCase();
  if (r.includes('plagiar') || r.includes('copyright')) return 'plagiarism';
  if (r.includes('spam') || r.includes('scam')) return 'spam';
  if (r.includes('violence') || r.includes('hate') || r.includes('abuse')) return 'abuse';
  if (r.includes('adult') || r.includes('nsfw') || r.includes('misleading')) return 'content';
  return 'other';
}

async function loadBook(id) {
  const b = await Book.findOne({ id: String(id) });
  if (!b) err('not_found', 404);
  return b;
}

// `user` is the console session (owns the audit trail and the queue filter);
// `actor` is the account whose password was just re-verified for this click.
async function flagBook(id, body, opts) {
  const reason = String((body && body.reason) || '').trim().slice(0, 200);
  if (!reason) err('reason_required', 400);
  assertFlagRole(opts.user);
  const b = await loadBook(id);
  await senior.assertOwned(opts.user, b.authorId);
  if (b.status === 'flagged') err('already_flagged', 409);
  b.flagPrevStatus = b.status;
  b.status = 'flagged';
  b.flagReason = reason;
  b.flagNote = String((body && body.note) || '').slice(0, 2000);
  b.flaggedBy = opts.actor.id;
  b.flaggedAt = new Date();
  await b.save();

  const report = await Report.create({
    storyId: b.id,
    title: b.title,
    desc: b.flagNote ? b.flagReason + ' — ' + b.flagNote : b.flagReason,
    type: reportTypeFor(reason),
    severity: 'medium',
    seId: String(opts.user.id),
    reporterId: String(opts.actor.id),
    reporterLabel: 'Book flag',
    status: 'pending',
  });

  try {
    const { emit } = require('./notification-emitter');
    await emit({ recipientId: b.authorId, type: 'moderation', title: 'Book flagged', desc: 'Your book "' + b.title + '" was flagged for review.' });
  } catch (e) { /* the flag stands even if the notification does not send */ }

  return { id: b.id, status: b.status, flagReason: b.flagReason, reportId: report.id };
}

async function unflagBook(id, opts) {
  assertFlagRole(opts.user);
  const b = await loadBook(id);
  await senior.assertOwned(opts.user, b.authorId);
  if (b.status !== 'flagged') err('not_flagged', 409);
  b.status = b.flagPrevStatus && b.flagPrevStatus !== 'flagged' ? b.flagPrevStatus : 'published';
  b.flagReason = '';
  b.flagNote = '';
  b.flaggedBy = null;
  b.flaggedAt = null;
  b.flagPrevStatus = null;
  await b.save();

  await Report.updateMany(
    { storyId: b.id, status: 'pending' },
    { $set: { status: 'resolved', resolutionNote: 'Book unflagged by editor', resolvedBy: String(opts.user.id) } }
  );
  return { id: b.id, status: b.status };
}

module.exports = { flagBook, unflagBook, reportTypeFor };
