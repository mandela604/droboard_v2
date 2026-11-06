'use strict';
/* services/activity-feed.service.js — the one source for every console
   "Recent activity" panel (super-admin dashboard, chief, finance, marketing).
 *
 * middleware/http.js audit() is what actually records staff actions, and it
 * writes AuditLog. ActivityLog has no writer anywhere in the backend, so the
 * feeds that read it rendered an empty panel forever.
 */
const { AuditLog, User } = require('../models/user.model');

// Audit action is dot-namespaced: "<area>.<entity>.<verb>" (admin.users.update).
const VERB = {
  create: 'created', add: 'added', update: 'updated', save: 'saved', patch: 'updated',
  delete: 'deleted', remove: 'removed', approve: 'approved', reject: 'rejected',
  pay: 'paid', paid: 'paid', settle: 'settled', release: 'released', send: 'sent',
  publish: 'published', sync: 'synced', import: 'imported', move: 'moved',
  place: 'placed', cancel: 'cancelled', verify: 'verified', activate: 'activated',
  deactivate: 'deactivated', suspend: 'suspended', ban: 'banned', unban: 'unbanned',
};
// One visual language for all four consoles.
const STYLE = [
  [/(delete|remove|ban|block|suspend|deactivate)/, 'fa-trash-can', 'red'],
  [/(approve|accept|release|pay|paid|settle|verify|activate)/, 'fa-circle-check', 'green'],
  [/(reject|cancel|dispute|appeal|flag|report|suspend)/, 'fa-triangle-exclamation', 'amber'],
  [/(tip|gift|coin|purchase|fund|budget|revenue|earning)/, 'fa-coins', 'purple'],
  [/(create|add|import|publish)/, 'fa-plus', 'blue'],
];
const FALLBACK = { ico: 'fa-pen', cls: 'blue' };

function styleOf(action) {
  for (const [rx, ico, cls] of STYLE) if (rx.test(action)) return { ico, cls };
  return FALLBACK;
}
function typeOf(action) {
  if (/delete|remove|ban|block/.test(action)) return 'delete';
  if (/approve|accept|release|pay|settle/.test(action)) return 'approve';
  if (/reject|cancel|dispute|appeal/.test(action)) return 'reject';
  if (/create|add|import|publish/.test(action)) return 'create';
  return 'update';
}
function humanize(action) {
  const parts = String(action || '').split('.').filter(Boolean);
  if (!parts.length) return 'Activity recorded';
  const verb = VERB[parts[parts.length - 1]] || parts[parts.length - 1].replace(/_/g, ' ');
  const noun = parts.length > 1 ? parts[parts.length - 2].replace(/_/g, ' ') : 'record';
  return `${noun.charAt(0).toUpperCase() + noun.slice(1)} ${verb}`;
}

/* Rows carry both the raw audit fields and the display fields the consoles
   already read (type/userLabel/detail/at), so a feed change lands everywhere. */
async function recent(opts) {
  const lim = Math.min(100, Math.max(1, parseInt((opts && opts.limit) || 20, 10) || 20));
  const filter = (opts && opts.actorRole) ? { actorRole: opts.actorRole } : {};
  const rows = await AuditLog.find(filter).sort({ at: -1 }).limit(lim).lean();
  const names = await actorNames(rows);
  return rows.map(a => {
    const action = String(a.action || '');
    const style = styleOf(action);
    const actor = names(String(a.actorId)) || 'Platform';
    return {
      id: String(a._id),
      action,
      type: typeOf(action),
      entity: a.entity || '',
      entityId: a.entityId || '',
      actorRole: a.actorRole || '',
      userLabel: actor,
      detail: humanize(action),
      text: `${actor} — ${humanize(action)}`,
      ico: style.ico,
      cls: style.cls,
      at: a.at,
    };
  });
}

async function actorNames(rows) {
  const ids = [...new Set((rows || []).map(r => String(r.actorId)).filter(id => id && id !== 'anonymous'))];
  if (!ids.length) return () => null;
  const HEX24 = /^[0-9a-fA-F]{24}$/;
  const or = [{ id: { $in: ids } }];
  const hex = ids.filter(v => HEX24.test(v));
  if (hex.length) or.push({ _id: { $in: hex } });
  const users = await User.find({ $or: or }).select('id fullName username').lean();
  const by = {};
  users.forEach(u => {
    const name = u.fullName || (u.username ? '@' + u.username : '');
    by[String(u.id)] = name;
    if (u._id != null) by[String(u._id)] = name;
  });
  return key => by[String(key)] || null;
}

async function feed(opts) {
  const items = await recent(opts);
  const total = await AuditLog.countDocuments((opts && opts.actorRole) ? { actorRole: opts.actorRole } : {});
  return { items, total, limit: items.length };
}

module.exports = { recent, feed, humanize };
