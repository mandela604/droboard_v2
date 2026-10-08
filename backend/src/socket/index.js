'use strict';
// Socket.io skeleton: JWT on handshake, rooms per user + conversation.
// Events (notify/message/typing/wallet/contract) attach in later slices.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

let io = null;

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
    socket.join('user:' + socket.userId);
    socket.on('join', (room) => {
      // only conversation rooms the user belongs to (checked on use)
      if (typeof room === 'string' && room.startsWith('conv:')) socket.join(room + ':' + socket.userId);
    });
    socket.on('disconnect', () => {});
  });

  return io;
}

function getIo() { return io; }
function emitToUser(userId, event, payload) {
  if (io) io.to('user:' + userId).emit(event, payload);
}

module.exports = { init, getIo, emitToUser };
