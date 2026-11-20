/**
 * contract-rules.service.js — the platform-wide "standard contract rules"
 * (rights, copyright, royalty, term, warranties, content standards,
 * payments, termination, disputes).
 *
 * Who sets them: the Chief Editor (Contracts & Payments → Standard Rules).
 * Who reads them: authors (GET /api/author/contract-rules) to render the
 * review-and-sign modal and write the signed PDF.
 *
 * Stored as one PlatformSetting row (`contract-rules`) holding
 * `{ rules: [strings] }`. Built-in defaults exist so the feature works before
 * any chief editor has saved anything.
 */
'use strict';
const { PlatformSetting } = require('../models/platform.model');

const KEY = 'contract-rules';

const DEFAULT_RULES = [
  'Scope. This agreement covers the book titled above and every chapter published under it on Droboard during the term.',
  'Rights granted. The author grants Droboard the right to publish, distribute, market and display the Book on the Droboard platform and its partner channels for the duration of the term.',
  'Copyright. The author keeps full copyright and ownership of the Book. This agreement does not transfer ownership.',
  'Royalty. The author receives the revenue share recorded in the contract terms above, paid on net revenue after platform and payment-processing fees.',
  'Term. The contract lasts the term stated above, from the effective date, unless it is ended earlier under these rules.',
  'Renewal. The contract does not renew automatically. Continuing beyond the expiry date requires a new signed agreement.',
  "Author warranties. The author confirms the Book is original, does not infringe anyone else's rights, and is not bound by another agreement that conflicts with this one.",
  "Content standards. The Book must follow Droboard's content and community policies. Droboard may unpublish material that breaks them without cancelling royalties already earned.",
  "Payments. Royalties are paid to the author's verified payout method on the platform payment schedule, subject to the minimum withdrawal threshold.",
  'Termination. Either party may end this agreement by written notice through the platform. On termination Droboard removes the Book from sale and pays royalties earned up to that date.',
  "Disputes. Both parties agree to use Droboard's dispute process first, then the platform's governing terms.",
  'Entire agreement. This contract, the terms above and the platform terms it references form the complete agreement between the author and Droboard.'
];

function normalizeRules(value) {
  const out = Array.isArray(value) ? value : [];
  return out.map(v => String(v || '').trim()).filter(Boolean).slice(0, 60);
}

async function getContractRules() {
  const doc = await PlatformSetting.findOne({ key: KEY }).lean().catch(() => null);
  const stored = normalizeRules((doc && doc.value && doc.value.rules));
  return { rules: stored.length ? stored : DEFAULT_RULES };
}

async function setContractRules(rules, userId) {
  const arr = normalizeRules(rules);
  const doc = await PlatformSetting.findOneAndUpdate(
    { key: KEY },
    { $set: { value: { rules: arr }, updatedBy: String(userId || '') } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean().catch(() => null);
  return { rules: arr };
}

module.exports = { DEFAULT_RULES, getContractRules, setContractRules, normalizeRules };
