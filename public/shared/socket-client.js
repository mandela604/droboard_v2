// public/shared/socket-client.js
(function(global) {
  'use strict';
  if (global.DroboardSocketClientLoaded) return;
  global.DroboardSocketClientLoaded = true;

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function init() {
    try {
      await loadScript('https://cdn.socket.io.com/4.7.2/socket.io.min.js');
    } catch (e) {
      console.warn('[Droboard] Socket.IO CDN failed:', e);
      return;
    }

    var io = global.io;
    if (!io) return;

    var socket = io('/');
    socket.on('connect', function() {
      global.DroboardSocketStatus = 'connected';
    });
    socket.on('disconnect', function() {
      global.DroboardSocketStatus = 'disconnected';
    });

    // Live notification updates
    socket.on('notify', function(n) {
      if (!global.DroboardNotifStore) return;
      global.DroboardNotifStore.push(n);
      if (typeof global.BadgeCountIncrement === 'function') {
        global.BadgeCountIncrement(1);
      }
    });

    // Optional: live chat rooms
    global.DroboardChat = {
      subscribe: function(roomId) {
        socket.emit('chat:join', roomId);
      },
      offRoom: function(roomId, cb) {
        socket.off('chat:message:' + roomId, cb);
      }
    };

    global.DroboardSocket = socket;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
