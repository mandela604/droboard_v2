// backend/src/services/notification-emitter.js
'use strict';

const { notify } = require('./notifications.service');
const { User } = require('../models/user.model');

/**
 * Emit a notification for a user.
 *
 * This is the fire-and-forget entry point for server-side flows (editors,
 * admins, services). `notify()` already applies the recipient's channel
 * matrix, so a row a user muted or switched off is dropped here too — one
 * gate, not two. `actorId` resolves the actor's name/avatar so a title can
 * use the same {@handle|Name} token the client store writes.
 *
 * @param {{ recipientId: string, actorId?: string, type: string, title: string, desc?: string, link?: string, key?: string }} options
 */
async function emit(options) {
  const { recipientId, actorId, type, title, desc, link, key, ...rest } = options || {};
  if (!recipientId || !type) return { skipped: true, reason: 'bad_input' };

  // Check if user disabled notifications entirely (master switch).
  const user = await User.findOne({ id: String(recipientId) }).select('settings.notifications').lean();
  if (!user || (user.settings && typeof user.settings.notifications === 'boolean' && user.settings.notifications === false)) {
    return { skipped: true, reason: 'user_disabled' };
  }

  let out;
  if (actorId) {
    out = await notify({
      recipientId: String(recipientId), actorId: String(actorId), type,
      title, desc: desc || '', link: link || '', key, ...rest,
    });
  } else {
    out = await notify({
      recipientId: String(recipientId), type,
      title, desc: desc || '', link: link || '', key, ...rest,
    });
  }

  return { ok: true, id: out && out.id, skipped: out && out.skipped, reason: out && out.reason };
}

// Platform broadcast: send same notification to multiple recipients (Admin console)
async function broadcast(recipientIds, options) {
  const { actorId, type, title, desc, link } = options || {};
  const ids = Array.isArray(recipientIds) ? recipientIds : [];
  const results = [];
  for (const id of ids) {
    try {
      const r = await emit({ recipientId: id, actorId, type, title, desc, link });
      results.push({ recipientId: id, ok: !!(r && r.ok), skipped: !!(r && r.skipped), error: null });
    } catch (e) {
      results.push({ recipientId: id, ok: false, error: e.message });
    }
  }
  return { total: ids.length, succeeded: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}

module.exports = { emit, broadcast };