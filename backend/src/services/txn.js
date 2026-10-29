'use strict';
const mongoose = require('mongoose');
/**
 * txn.js — money writes want all-or-nothing, but MongoDB only grants
 * transactions on a replica set / sharded cluster. A plain standalone mongod
 * (local dev, single-node box) throws
 * "Transaction numbers are only allowed on a replica set member or mongos",
 * which would take every paid flow down with it.
 *
 * run(fn) therefore probes the deployment once and either gives fn a real
 * session or runs it with none, so the same code works on both. Callers must
 * treat the no-session case as sequential: keep the guard that makes a second
 * attempt harmless (a unique index or an atomic claim) in front of the writes.
 */
let support; // undefined = not probed yet, true/false = decided

async function supported() {
  if (support !== undefined) return support;
  if (mongoose.connection.readyState !== 1) return false;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    support = !!(hello && (hello.setName || hello.msg === 'isdbgrid'));
  } catch (e) {
    support = false;
  }
  return support;
}

async function run(fn) {
  if (!(await supported())) return fn(null);
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const out = await fn(session);
    await session.commitTransaction();
    return out;
  } catch (e) {
    try { await session.abortTransaction(); } catch (_) {}
    throw e;
  } finally {
    session.endSession();
  }
}

// { upsert: true } vs { upsert: true, session } — no session key at all when
// there is no session, so the driver never sees a null one.
function withSession(session, opts) {
  const o = Object.assign({}, opts || {});
  if (session) o.session = session;
  return o;
}

module.exports = { run, supported, withSession };
