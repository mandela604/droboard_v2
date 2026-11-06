'use strict';
// Socket.io skeleton: JWT on handshake, rooms per user + conversation.
// Events (notify/message/typing/wallet/contract) attach in later slices.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

let io = null;
// userId -> how many live sockets that user holds. A phone plus a laptop is one
// online person, so presence counts connections, not sockets.
const connections = new Map();

function isOnline(userId) {
  return connections.has(String(userId));
}

function onlineIds() {
  return [...connections.keys()];
}

function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('unauthorized'));
      const p = jwt.verify(token, env.jwtAccessSecret);
      socket.userId = p.sub;
      socket.roles = p.roles || [];
      return next();
    } catch (e) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid = String(socket.userId);
    const wasOnline = connections.has(uid);
    connections.set(uid, (connections.get(uid) || 0) + 1);
    // Everyone else watching this user flips them green once, not per device.
    if (!wasOnline) io.emit('presence', { userId: uid, online: true });
    socket.join('user:' + uid);
    socket.on('join', (room) => {
      // only conversation rooms the user belongs to (checked on use)
      if (typeof room === 'string' && room.startsWith('conv:')) socket.join(room + ':' + uid);
    });
    socket.on('disconnect', () => {
      const left = (connections.get(uid) || 1) - 1;
      if (left > 0) connections.set(uid, left);
      else connections.delete(uid);
      if (left <= 0) io.emit('presence', { userId: uid, online: false });
    });
  });

  return io;
}

function getIo() { return io; }
function emitToUser(userId, event, payload) {
  if (io) io.to('user:' + userId).emit(event, payload);
}

module.exports = { init, getIo, emitToUser, isOnline, onlineIds };
