'use strict';
// One place that knows how a user reference is stored: the uuidv7 `id`, plus a
// legacy 24-hex `_id`. A uuidv7 handed to an `_id` filter throws a CastError, so
// only 24-hex values may touch that branch.

const HEX24 = /^[0-9a-fA-F]{24}$/;

function userRefFilter(ids) {
  const uniq = Array.from(new Set((ids || []).map(String).filter(Boolean)));
  const or = [{ id: { $in: uniq } }];
  const hex = uniq.filter(v => HEX24.test(v));
  if (hex.length) or.push({ _id: { $in: hex } });
  return { $or: or };
}

module.exports = { userRefFilter, HEX24 };
