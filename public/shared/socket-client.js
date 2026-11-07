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
      await loadScript('https://cdn.socket.io/4.7.2/socket.io.min.js');
    } catch (e) {
      console.warn('[Droboard] Socket.IO CDN failed:', e);
      return;
    }

    var io = global.io;
    if (!io) return;

    // The server verifies a JWT on the handshake; a socket without it is
    // rejected before it connects, so every realtime feature is dead.
    var token = null;
    try { token = localStorage.getItem('droboard_session'); } catch (e) {}
    if (!token) return;

    var socket = io('/', { auth: { token: token } });
    socket.on('connect', function() {
      global.DroboardSocketStatus = 'connected';
    });
    socket.on('disconnect', function() {
      global.DroboardSocketStatus = 'disconnected';
    });

    // Live notification updates: the server owns the row, the bell owns
    // the count. Every listener repaints from one authoritative fetch.
    socket.on('notify', function(n) {
      try { global.dispatchEvent(new CustomEvent('dro:notification', { detail: n })); } catch (e) {}
    });

    // Cross-device ring repaint. Server says "this viewer just watched
    // author <handle>'s status on another tab/device"; refresh the live
    // state for that one author so any ring still on this page flips grey.
    socket.on('status:viewed', function (p) {
      var S = global.StatusStore;
      if (!S || !p) return;
      var handle = p.handle || p.authorKey || '';
      if (!handle) return;
      var key = S.key ? S.key(handle) : String(handle).toLowerCase();
      if (key) { try { delete S._liveAsked[key]; } catch (e) {} }
      Promise.resolve(S.syncLive([handle])).then(function () {
        try { S.applyAll(); } catch (e) {}
      });
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
