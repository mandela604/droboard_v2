'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');
const { LedgerEntry } = require('../models/money.model');

function newId(prefix) {
  return prefix + '-' + crypto.randomBytes(9).toString('hex');
}

// Post a balanced double-entry move inside a transaction.
// legs: [{debit, credit, amount, coins}]. All-or-nothing. Duplicate
// idempotencyKey returns the original journal instead of double-posting.
async function post({ legs, authorId, saleId, kind, memo, idempotencyKey, configVersion, session }) {
  if (!idempotencyKey) { const e = new Error('idem_required'); e.status = 400; throw e; }
  const own = !session;
  if (own) session = await mongoose.startSession();
  try {
    if (own) session.startTransaction();
    const journalId = newId('jnl');
    for (const leg of legs) {
      await LedgerEntry.create([{
        entryId: newId('le'), journalId,
        debitAcct: leg.debit, creditAcct: leg.credit,
        amount: leg.amount, coins: leg.coins || 0,
        authorId: authorId || null, saleId: saleId || null,
        kind: kind || '', memo: memo || '',
        idempotencyKey: idempotencyKey + ':' + leg.debit + '>' + leg.credit,
        configVersion: configVersion || null,
      }], { session });
    }
    if (own) await session.commitTransaction();
    return { journalId };
  } catch (e) {
    if (own) { try { await session.abortTransaction(); } catch (_) {} }
    if (e.code === 11000) return { journalId: null, duplicate: true };
    throw e;
  } finally {
    if (own) session.endSession();
  }
}

// Sum helper for pool/wallet derivation (audits, not hot paths).
async function sumAccount(acct) {
  const [debits, credits] = await Promise.all([
    LedgerEntry.aggregate([
      { $match: { debitAcct: acct } },
      { $group: { _id: null, t: { $sum: '$amount' } } },
    ]),
    LedgerEntry.aggregate([
      { $match: { creditAcct: acct } },
      { $group: { _id: null, t: { $sum: '$amount' } } },
    ]),
  ]);
  return (debits[0] ? debits[0].t : 0) - (credits[0] ? credits[0].t : 0);
}

module.exports = { post, sumAccount, newId };
