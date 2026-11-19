'use strict';
/* services/decision-mail.service.js — outcome emails for editorial decisions.
 *
 * Sent from the configured MAIL_FROM (noreply) with NO Reply-To. Replies are
 * handled in the app's chat, which is already scoped per editor: an SE only
 * sees conversations with authors assigned to them. A shared reply inbox
 * would expose one editor's author dealings to every other editor; an
 * individual editor's personal email would expose their private address and
 * break when they leave. The email points authors to in-app chat instead.
 *
 * Fire-and-forget: a mail outage must never fail an approve/reject decision.
 */
const { User } = require('../models/user.model');
const mail = require('./mail.service');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SUBJECTS = {
  'book-approved': 'Your book is live on Droboard',
  'book-rejected': 'Update on your book submission',
  'verification-approved': 'Your identity is verified on Droboard',
  'verification-rejected': 'Your Droboard verification needs attention',
  'contract-approved': 'Your Droboard contract offer is ready',
  'contract-rejected': 'Update on your contract application',
};

async function sendDecisionEmail(opts) {
  const o = opts || {};
  if (!o.userId) return null;
  const user = await User.findOne({ id: String(o.userId) })
    .select('email fullName username').lean();
  if (!user || !user.email) return null;

  const key = String(o.kind || '');
  const approved = o.decision === 'approved';
  const cfg = mail.cfg();
  const base = cfg.appUrl || '';
  const link = o.link ? (base + (o.link.charAt(0) === '/' ? o.link : '/' + o.link)) : '';
  const subject = o.subject || SUBJECTS[key] || 'Update from Droboard';
  const name = String(user.fullName || user.username || 'Writer').trim();
  const headline = esc(o.title || subject);
  const message = esc(o.message || '');
  const reason = o.reason ? '<div style="margin:16px 0;padding:12px 14px;background:#fff5f7;'
    + 'border-left:3px solid #ff2d55;border-radius:8px;color:#3a3a3f;font-size:14px;line-height:1.6">'
    + '<b>Editor’s note</b><br>' + esc(String(o.reason).slice(0, 2000)) + '</div>' : '';
  const cta = link ? '<p style="margin:22px 0"><a href="' + esc(link) + '" '
    + 'style="background:#ff2d55;color:#fff;text-decoration:none;padding:11px 20px;'
    + 'border-radius:10px;font-weight:700;display:inline-block">'
    + esc(o.linkLabel || 'View in Droboard') + '</a></p>' : '';

  const html = '<div style="font-family:Inter,Arial,sans-serif;color:#1a1a1a;max-width:600px">'
    + '<p style="font-size:15px">Hi ' + esc(name) + ',</p>'
    + '<h2 style="font-size:19px;margin:18px 0 8px">' + headline + '</h2>'
    + (message ? '<p style="font-size:14px;line-height:1.7;color:#3a3a3f">' + message + '</p>' : '')
    + reason + cta
    + '<p style="font-size:12px;color:#8e8e93;line-height:1.6;margin-top:26px">'
    + 'This is an automatic email — please don’t reply to it. '
    + 'To talk to your editor, <a href="' + esc(base + '/Pages/chat.html')
    + '" style="color:#ff2d55">message them inside Droboard</a>. '
    + 'Never share passwords or personal documents by email.</p>'
    + '</div>';

  // No replyTo: replies happen in the ownership-scoped in-app chat.
  return mail.sendMail({ to: user.email, subject, html });
}

/* Never let a mail problem block a decision. */
function send(opts) {
  try {
    return Promise.resolve(sendDecisionEmail(opts)).catch(function (e) {
      console.warn('[decision-mail] skipped:', e && e.message);
      return null;
    });
  } catch (e) {
    console.warn('[decision-mail] skipped:', e && e.message);
    return Promise.resolve(null);
  }
}

module.exports = { sendDecisionEmail, send, SUBJECTS };
