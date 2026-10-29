'use strict';
const crypto = require('crypto');
const { LedgerEntry } = require('../models/money.model');
const txn = require('./txn');

function newId(prefix) {
  return prefix + '-' + crypto.randomBytes(9).toString('hex');
}

// Post a balanced double-entry move inside a transaction.
// legs: [{debit, credit, amount, coins}]. All-or-nothing. Duplicate
// idempotencyKey returns the original journal instead of double-posting.
// With no session in, txn.run supplies one — or runs the legs sequentially on
// a standalone mongod, which cannot start transactions.
async function post({ legs, authorId, saleId, kind, memo, idempotencyKey, configVersion, session }) {
  if (!idempotencyKey) { const e = new Error('idem_required'); e.status = 400; throw e; }
  const write = async s => {
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
      }], txn.withSession(s));
    }
    return { journalId };
  };
  try {
    return session ? await write(session) : await txn.run(write);
  } catch (e) {
    if (e.code === 11000) return { journalId: null, duplicate: true };
    throw e;
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
