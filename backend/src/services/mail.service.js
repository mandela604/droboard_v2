'use strict';
// services/mail.service.js — config-driven outbound email for every type.
// Providers (MAIL_PROVIDER): log | resend | smtp
//   log    — dev default: prints to console, resolves {queued:true}.
//   resend — HTTPS API, zero extra deps: needs RESEND_API_KEY.
//   smtp   — needs the `nodemailer` package (NOT in package.json):
//            npm i nodemailer, then set SMTP_HOST/PORT/USER/PASS.
// Templates: EmailTemplate docs keyed by `key` (welcome|contract|payout|flag...)
// with {{var}} interpolation. Falls back to explicit subject/html.
const { EmailTemplate } = require('../models/platform.model');

function cfg() {
  return {
    provider: (process.env.MAIL_PROVIDER || 'log').toLowerCase(),
    from: process.env.MAIL_FROM || 'Droboard <noreply@droboard.com>',
    appUrl: (process.env.APP_URL || '').replace(/\/$/, ''),
    resendKey: process.env.RESEND_API_KEY || '',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  };
}

function renderVars(text, vars) {
  return String(text == null ? '' : text).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), vars || {});
    return v == null ? '' : String(v);
  });
}

// Templates live ONLY in the admin email-templates module (EmailTemplate
// docs keyed by `key`, {{var}} interpolation). There are NO built-in bodies:
// a templateKey with no matching doc fails closed with missing_template,
// so every email readers receive comes from what admin defined. New email
// types = create a template doc. Zero code changes, ever.

async function loadTemplate(key) {
  if (!key) return null;
  try {
    const t = await EmailTemplate.findOne({ key }).lean();
    return t || null;
  } catch (e) { return null; }
}

async function deliver({ to, subject, html, text, from }) {
  const c = cfg();
  const payload = {
    from: from || c.from, to: Array.isArray(to) ? to : [to],
    subject, html, text: text || String(html || '').replace(/<[^>]+>/g, ' '),
  };
  if (c.provider === 'log') {
    console.log('[mail:log]', JSON.stringify({ to: payload.to, subject }));
    return { queued: true, provider: 'log' };
  }
  if (c.provider === 'resend') {
    if (!c.resendKey) throw Object.assign(new Error('missing_resend_key'), { status: 500 });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw Object.assign(new Error('resend_failed'), { status: 502 });
    const body = await res.json().catch(() => ({}));
    return { queued: true, provider: 'resend', id: body.id || null };
  }
  if (c.provider === 'smtp') {
    let nodemailer;
    try { nodemailer = require('nodemailer'); }
    catch (e) { throw Object.assign(new Error('smtp_needs_nodemailer'), { status: 500 }); }
    if (!c.smtp.host) throw Object.assign(new Error('missing_smtp_host'), { status: 500 });
    const tx = nodemailer.createTransport({
      host: c.smtp.host, port: c.smtp.port, secure: c.smtp.secure,
      auth: c.smtp.user ? { user: c.smtp.user, pass: c.smtp.pass } : undefined,
    });
    const info = await tx.sendMail(payload);
    return { queued: true, provider: 'smtp', id: info.messageId || null };
  }
  throw Object.assign(new Error('unknown_mail_provider'), { status: 500 });
}

// Any-type sender: explicit content, or a stored template + vars.
// templateKey with no matching doc fails closed (missing_template:<key>).
async function sendMail({ to, subject, html, text, templateKey, vars, from }) {
  if (!to) throw Object.assign(new Error('missing_recipient'), { status: 400 });
  let tpl = null;
  if (templateKey) tpl = await loadTemplate(templateKey);
  if (templateKey && !tpl) throw Object.assign(new Error('missing_template:' + templateKey), { status: 500 });
  const finalSubject = subject || (tpl ? renderVars(tpl.subject, vars) : '');
  const finalHtml = html || (tpl ? renderVars(tpl.body, vars) : '');
  if (!finalSubject || !finalHtml) throw Object.assign(new Error('missing_content'), { status: 400 });
  const out = await deliver({ to, subject: finalSubject, html: finalHtml, text, ...(from ? { from } : {}) });
  return out;
}

async function sendTemplate(templateKey, to, vars) {
  return sendMail({ to, templateKey, vars });
}

module.exports = { sendMail, sendTemplate, renderVars, cfg };
