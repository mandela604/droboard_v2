// backend/src/services/notification-emitter.js
'use strict';

const { notify } = require('./notifications.service');
const { User } = require('../models/user.model');

/**
 * Emit a notification for a user.
 * @param {{ recipientId: string, actorId?: string, type: string, title: string, desc?: string, link?: string, key?: string }} options
 */
async function emit(options) {
  const { recipientId, actorId, type, title, desc, link, key } = options;

  // Check if user disabled notifications entirely
  const user = await User.findOne({ id: recipientId }).select('settings.notifications').lean();
  if (!user || (user.settings && typeof user.settings.notifications === 'boolean' && user.settings.notifications === false)) {
    return { skipped: true, reason: 'user_disabled' };
  }

  // Create notification row
  const n = await notify({ recipientId, actorId, type, title, desc: desc || '', link: link || '' });

  // Broadcast over WebSocket if available
  try {
    const { broadcastToUser } = require('../socket');
    if (broadcastToUser && typeof broadcastToUser === 'function') {
      broadcastToUser(String(recipientId), 'notify', n);
    }
  } catch (e) {
    // WS may be offline; row still saved in DB
  }

  return { ok: true, id: n.id };
}

module.exports = { emit };
