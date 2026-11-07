/* ═══════════════════════════════════════════════════════════════
   CHAT SERVICE
   1:1 messaging for public/Pages/chat.html.

   One render path. Live rows from /api/messages and the demo rows are
   normalised into the SAME shape before anything is painted, so there is
   exactly one place where a contact card or a bubble is built.

   Live-first: the API is tried first and the demo set only paints when the
   backend is unreachable (static hosting) or there is no session. The header
   then says DEMO, because a demo inbox must not look like a real one.

   Shapes (backend/src/services/messages.service.js):
     thread   { id, peer:{ id, handle, name, avatar, verified, role, online },
                preview, unread, updatedAt }
     message  { id, conversationId, text, image, edited, read, senderId,
                fromRole, isMine, sender:{...}, createdAt }
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const API_BASE = '/api';
  const MSG = API_BASE + '/messages';
  var LIVE = true;                       // flips false when /api is unreachable
  var PAGE = 50;                         // matches the backend default page size

  /* ── Theme ── */
  var THEME_KEY = 'droboardTheme';
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; } }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  setTheme(getTheme());

  /* ── Helpers ── */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function asDate(v) { var d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? new Date() : d; }
  function fmtTime(d) {
    d = asDate(d);
    var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  function fmtShort(d) {
    d = asDate(d);
    var diff = Date.now() - d.getTime();
    if (diff < 86400000) return fmtTime(d);
    if (diff < 604800000) { var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; return days[d.getDay()]; }
    return (d.getMonth() + 1) + '/' + d.getDate();
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* My own bubbles come from the real session — never from a fixture persona. */
  function me() {
    try {
      if (global.AuthSession && global.AuthSession.getSync) return global.AuthSession.getSync() || {};
    } catch (e) {}
    return {};
  }

  /* ── State ── */
  var THREADS = [];
  var activeThread = null;
  var pendingImage = null;      // upload-then-send: this is always a delivery URL
  var pendingImagePreview = null; // data URL, local preview only, never sent
  var longPressTimer = null;
  var ctxMsgId = null;

  function shapeThread(row) {
    return {
      id: String(row.id),
      peer: {
        id: String((row.peer || {}).id || ''), handle: (row.peer || {}).handle || '',
        name: (row.peer || {}).name || 'User', avatar: (row.peer || {}).avatar || '',
        verified: !!(row.peer || {}).verified, role: (row.peer || {}).role || 'Reader',
        online: !!(row.peer || {}).online,
      },
      preview: row.preview || '', unread: row.unread || 0, updatedAt: asDate(row.updatedAt),
      messages: [], loaded: false, loading: false,
    };
  }

  function shapeMessage(m) {
    return {
      id: String(m.id), text: m.text || '', image: m.image || '', edited: !!m.edited,
      read: !!m.read, isMine: !!m.isMine, fromRole: m.fromRole || 'user',
      sender: m.sender || null, createdAt: asDate(m.createdAt),
    };
  }

  /* ── Demo set — same field names as live, and honest: no bot replies ── */
  function demoThreads() {
    var now = Date.now(), MIN = 6e4, HR = 36e5, DAY = 864e5;
    function m(id, isMine, text, at, extra) {
      var o = { id: 'demo_' + id, text: text, image: '', edited: false, read: !isMine, isMine: isMine, fromRole: isMine ? 'author' : 'editor', sender: null, createdAt: new Date(at) };
      if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
      return o;
    }
    return [
      {
        id: 'demo_ed_morgan',
        peer: { id: 'demo_u_editor', handle: 'reina_morgan', name: 'Reina Morgan', avatar: 'https://i.pravatar.cc/100?img=47', verified: true, role: 'Senior Editor', online: true },
        preview: 'Love this! The direction is really coming together.', unread: 2, updatedAt: new Date(now - 20 * MIN), loaded: true,
        messages: [
          m(1, false, "Hi! I'm your assigned editor. Feel free to reach out anytime about your writing, contracts, or anything else.", now - 2 * DAY - 9 * HR),
          m(2, false, 'I reviewed your latest chapter — the pacing in the second half is really strong. Great work.', now - 2 * DAY - 8 * HR),
          m(3, true, "Thank you so much! I rewrote that part three times, so I'm glad it landed.", now - 2 * DAY - 7.5 * HR),
          m(4, false, 'It shows. Quick note — the cliffhanger at the end could be sharper. Want to brainstorm?', now - 2 * DAY - 7 * HR),
          m(5, true, 'Yes please! I was thinking maybe she finds the letter earlier?', now - DAY - 9 * HR),
          m(6, false, 'Love that. Or she overhears a conversation — adds more tension. Let me know what you think.', now - DAY - 8 * HR),
          m(7, false, 'Love this! The direction is really coming together.', now - 20 * MIN),
        ],
      },
      {
        id: 'demo_admin_chief',
        peer: { id: 'demo_u_chief', handle: 'jasmine_cole', name: 'Jasmine Cole', avatar: 'https://i.pravatar.cc/100?img=44', verified: true, role: 'Chief Editor', online: false },
        preview: 'Your quarterly review is due by Friday.', unread: 0, updatedAt: new Date(now - DAY), loaded: true,
        messages: [
          m(11, false, "Hi! I'm the Chief Editor. Just a heads-up — your quarterly review is due by Friday.", now - DAY),
          m(12, true, "Got it, I'll submit it on time. Thanks for the reminder!", now - DAY + 10 * MIN),
        ],
      },
      {
        id: 'demo_admin_super',
        peer: { id: 'demo_u_support', handle: 'droboard_support', name: 'Droboard Support', avatar: 'https://i.pravatar.cc/100?img=12', verified: true, role: 'Admin', online: true },
        preview: 'Your payout has been processed.', unread: 0, updatedAt: new Date(now - 3 * DAY), loaded: true,
        messages: [
          m(21, false, 'Hello! Your payout for last month has been processed. You should see it within 24 hours.', now - 3 * DAY),
          m(22, true, 'Great, thank you!', now - 3 * DAY + 5 * MIN),
        ],
      },
    ];
  }

  /* ═══════════════════════════════════
     TRANSPORT
     ═══════════════════════════════════ */
  async function req(method, path, body) {
    var res = await fetch(path, {
      method: method, credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    var json = null;
    try { json = await res.json(); } catch (e) {}
    if (!res.ok) {
      var e = new Error((json && json.error) || ('http_' + res.status));
      e.status = res.status; e.code = json && json.error;
      // A 404 that isn't even JSON is a host with no API behind it (static
      // hosting), not a backend failure — that is the demo fallback case.
      e.noBackend = !json && res.status === 404;
      throw e;
    }
    return json;
  }

  async function loadThreads() {
    if (LIVE) {
      try {
        var j = await req('GET', MSG + '/conversations');
        THREADS = (j.items || []).map(shapeThread);
        paintSource(); renderContacts(currentFilter());
        return;
      } catch (e) {
        // No session (401) or no backend reachable at all (network error, or a
        // non-API 404) -> demo inbox, labelled. A real API error stays an error.
        if (e.status && e.status !== 401 && !e.noBackend) {
          paintSource();
          renderEmpty('Could not load your messages. Pull to try again.');
          return;
        }
        LIVE = false;
      }
    }
    THREADS = demoThreads();
    paintSource(); renderContacts(currentFilter());
  }

  function paintSource() {
    // Labels the fake inbox wherever fake data is visible: the list and the open thread.
    document.querySelectorAll('.chat-source-tag').forEach(function (el) {
      el.textContent = LIVE ? '' : 'DEMO';
      el.style.display = LIVE ? 'none' : 'inline-block';
    });
  }

  /* ═══════════════════════════════════
     LAYER 1: CONTACTS
     ═══════════════════════════════════ */
  function currentFilter() {
    var i = document.getElementById('contactSearchInput');
    return i ? i.value : '';
  }

  function renderEmpty(msg) {
    var list = document.getElementById('contactList');
    if (list) list.innerHTML = '<div class="contact-empty"><i class="fas fa-comments"></i><p>' + esc(msg) + '</p></div>';
  }

  function renderContacts(filter) {
    var list = document.getElementById('contactList');
    if (!list) return;
    var q = (filter || '').toLowerCase();
    var items = THREADS;
    if (q) items = items.filter(function (t) {
      return t.peer.name.toLowerCase().indexOf(q) !== -1 || t.peer.role.toLowerCase().indexOf(q) !== -1 || t.peer.handle.toLowerCase().indexOf(q) !== -1;
    });
    if (!items.length) { renderEmpty(THREADS.length ? 'No conversations match.' : 'No conversations yet.'); return; }

    items.sort(function (a, b) { return b.updatedAt - a.updatedAt; });

    list.innerHTML = items.map(function (t) {
      var preview = t.preview || '';
      if (preview.length > 50) preview = preview.substring(0, 50) + '…';
      return '<div class="contact-item" data-cid="' + esc(t.id) + '">'
        + '<div class="contact-av-wrap">'
        +   (t.peer.avatar ? '<img class="contact-av" src="' + esc(t.peer.avatar) + '" alt=""/>' : '<div class="contact-av contact-av-initial">' + esc((t.peer.name || '?').charAt(0).toUpperCase()) + '</div>')
        +   '<div class="contact-online' + (t.peer.online ? '' : ' offline') + '"></div>'
        + '</div>'
        + '<div class="contact-body">'
        +   '<div class="contact-top">'
        +     '<span class="contact-name">' + esc(t.peer.name) + '</span>'
        +     '<span class="contact-time">' + esc(fmtShort(t.updatedAt)) + '</span>'
        +   '</div>'
        +   '<div class="contact-bottom">'
        +     '<span class="contact-role">' + esc(t.peer.role) + '</span>'
        +     '<span class="contact-preview"> · ' + esc(preview) + '</span>'
        +     (t.unread ? '<span class="contact-badge">' + t.unread + '</span>' : '')
        +   '</div>'
        + '</div>'
        + '</div>';
    }).join('');

    list.querySelectorAll('.contact-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var t = THREADS.find(function (x) { return x.id === el.getAttribute('data-cid'); });
        if (t) openThread(t);
      });
    });
  }

  /* ═══════════════════════════════════
     LAYER 2: OPEN / CLOSE
     ═══════════════════════════════════ */
  async function openThread(thread) {
    activeThread = thread;
    paintThreadHead(thread);

    document.getElementById('layer1').classList.add('pushed');
    document.getElementById('layer2').classList.add('open');

    if (!thread.loaded && !thread.loading) {
      thread.loading = true;
      document.getElementById('messagesWrap').innerHTML = '<div class="empty-chat"><i class="fas fa-circle-notch fa-spin"></i><p>Loading…</p></div>';
      try {
        var j = await req('GET', MSG + '/conversations/' + encodeURIComponent(thread.id) + '/messages?limit=' + PAGE);
        thread.messages = (j.items || []).map(shapeMessage).reverse(); // API is newest-first, the thread reads oldest-first
        thread.loaded = true;
      } catch (e) {
        thread.loaded = false;
        document.getElementById('messagesWrap').innerHTML = '<div class="empty-chat"><i class="fas fa-triangle-exclamation"></i><p>' + esc(e.message || 'Could not load this conversation.') + '</p></div>';
      }
      thread.loading = false;
    }
    renderMessages();

    if (thread.unread) {
      thread.unread = 0;
      renderContacts(currentFilter());
      if (LIVE) { try { await req('POST', MSG + '/conversations/' + encodeURIComponent(thread.id) + '/read'); } catch (e) {} }
    }
  }

  function paintThreadHead(thread) {
    var p = thread.peer;
    var av = document.getElementById('edAv');
    if (p.avatar) { av.src = p.avatar; av.style.display = 'block'; }
    else { av.removeAttribute('src'); av.style.display = 'none'; }
    // The check mark is a fact about the peer, so it only appears when the API says so.
    document.getElementById('edName').innerHTML = esc(p.name) + (p.verified ? ' <i class="fas fa-circle-check"></i>' : '');
    var dot = document.querySelector('#edStatus .dot');
    if (dot) dot.className = 'dot' + (p.online ? '' : ' offline');
    var txt = document.getElementById('edStatusText');
    if (txt) txt.textContent = p.online ? 'Online' : 'Offline';
  }

  function closeChat() {
    activeThread = null;
    document.getElementById('layer1').classList.remove('pushed');
    document.getElementById('layer2').classList.remove('open');
    renderContacts(currentFilter());
  }

  /* ═══════════════════════════════════
     LAYER 2: MESSAGES
     ═══════════════════════════════════ */
  function renderMessages() {
    var wrap = document.getElementById('messagesWrap');
    if (!wrap || !activeThread) return;
    var msgs = activeThread.messages;
    if (!msgs.length) {
      wrap.innerHTML = '<div class="empty-chat"><i class="fas fa-comments"></i><p>No messages yet. Say hello!</p></div>';
      return;
    }
    var html = '', lastDate = '';
    msgs.forEach(function (m) {
      var dateStr = asDate(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (dateStr !== lastDate) { html += '<div class="date-divider">' + esc(dateStr) + '</div>'; lastDate = dateStr; }
      var mine = !!m.isMine;
      var src = mine ? me().avatar : activeThread.peer.avatar;
      var who = mine ? me().name : activeThread.peer.name;
      var av = src
        ? '<img class="msg-av" src="' + esc(src) + '" alt=""/>'
        : '<div class="msg-av msg-av-initial">' + (who ? esc(String(who).charAt(0).toUpperCase()) : '<i class="fas fa-user"></i>') + '</div>';
      var bub = '';
      if (m.image) bub += '<img class="msg-img" src="' + esc(m.image) + '" alt=""/>';
      if (m.text) bub += '<span>' + esc(m.text) + '</span>';
      html += '<div class="msg-row ' + (mine ? 'out' : 'in') + '" data-mid="' + esc(m.id) + '">'
        + av
        + '<div class="msg-content"><div class="msg-bub">' + bub + '</div>'
        + '<span class="msg-time">' + esc(fmtTime(m.createdAt)) + '</span>'
        + (m.edited ? '<span class="msg-edited">edited</span>' : '')
        + '</div></div>';
    });
    wrap.innerHTML = html;
    bindLongPress();
    wrap.scrollTop = wrap.scrollHeight;
  }

  /* ── Long press: edit/delete own only ── */
  function bindLongPress() {
    var rows = document.querySelectorAll('#messagesWrap .msg-row');
    rows.forEach(function (row) {
      function start() { clearTimeout(longPressTimer); longPressTimer = setTimeout(function () { openCtx(row); }, 600); }
      function cancel() { clearTimeout(longPressTimer); }
      row.addEventListener('touchstart', start, { passive: true });
      row.addEventListener('touchend', cancel);
      row.addEventListener('touchmove', cancel);
      row.addEventListener('mousedown', start);
      row.addEventListener('mouseup', cancel);
      row.addEventListener('mouseleave', cancel);
    });
  }

  function findMsg(id) {
    if (!activeThread) return null;
    for (var i = 0; i < activeThread.messages.length; i++) if (activeThread.messages[i].id === id) return activeThread.messages[i];
    return null;
  }

  function openCtx(row) {
    var msg = findMsg(row.getAttribute('data-mid'));
    if (!msg) return;
    ctxMsgId = msg.id;
    var preview = (msg.image ? '[Image] ' : '') + (msg.text || '');
    if (preview.length > 80) preview = preview.substring(0, 80) + '…';
    document.getElementById('ctxPreview').textContent = preview;
    document.getElementById('ctxEdit').style.display = msg.isMine ? 'flex' : 'none';
    document.getElementById('ctxDelete').style.display = msg.isMine ? 'flex' : 'none';
    document.getElementById('ctxOverlay').classList.add('open');
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function closeCtx() {
    document.getElementById('ctxOverlay').classList.remove('open');
    ctxMsgId = null;
  }

  function startEdit(mid) {
    var msg = findMsg(mid);
    var row = document.querySelector('.msg-row[data-mid="' + mid + '"]');
    if (!msg || !msg.isMine || !row) return;
    row.classList.add('editing');
    var bub = row.querySelector('.msg-bub');
    bub.innerHTML = '<div class="edit-banner"><i class="fas fa-pen"></i> Editing message</div>'
      + '<textarea class="edit-input" rows="1">' + esc(msg.text) + '</textarea>';
    var ta = bub.querySelector('.edit-input');
    ta.focus();
    ta.style.height = ta.scrollHeight + 'px';
    var settled = false;
    function save() {
      if (settled) return;
      settled = true;
      var val = ta.value.trim();
      if (!val) { doDelete(mid); return; }
      if (val === msg.text) { renderMessages(); return; }
      msg.text = val; msg.edited = true;   // the server sets edited too; this keeps the paint instant
      if (LIVE) req('PATCH', MSG + '/' + encodeURIComponent(mid), { text: val }).catch(function (e) { toast(e.message || 'Could not edit'); loadThreads(); });
      renderMessages();
    }
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { settled = true; renderMessages(); }
    });
    ta.addEventListener('blur', function () { setTimeout(save, 100); });
  }

  function doDelete(mid) {
    var msg = findMsg(mid);
    if (!msg || !msg.isMine) return;
    activeThread.messages = activeThread.messages.filter(function (x) { return x.id !== mid; });
    if (LIVE) req('DELETE', MSG + '/' + encodeURIComponent(mid)).catch(function (e) { toast(e.message || 'Could not delete'); openThread(activeThread); });
    renderMessages();
  }

  /* ── Images: upload FIRST, then send the delivery URL ──
     The backend refuses any image that is not a Cloudflare Images URL, so a
     FileReader data URL can never be sent. The data URL stays local as the
     preview only. */
  async function uploadImage(file) {
    var fd = new FormData();
    fd.append('file', file);
    var res = await fetch(API_BASE + '/uploads/image', { method: 'POST', credentials: 'include', body: fd });
    var json = null; try { json = await res.json(); } catch (e) {}
    if (!res.ok) { var e = new Error(json && json.error === 'images_not_configured' ? 'Image hosting is not configured yet' : (json && json.error) || 'upload_failed'); e.status = res.status; throw e; }
    return json.url;
  }

  function bindAttach() {
    var attachBtn = document.getElementById('attachBtn'), fileInput = document.getElementById('fileInput');
    if (!attachBtn || !fileInput) return;
    attachBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', async function (e) {
      var file = e.target.files[0];
      this.value = '';
      if (!file) return;
      pendingImagePreview = null; pendingImage = null;
      document.getElementById('imgPreviewThumb').src = '';
      document.getElementById('imgPreviewBar').classList.add('show');
      document.getElementById('imgPreviewBar').classList.add('uploading');
      var sendBtn = document.getElementById('sendBtn');
      if (sendBtn) sendBtn.disabled = true;
      try {
        if (LIVE) pendingImage = await uploadImage(file);
        else pendingImage = 'demo://image/' + encodeURIComponent(file.name); // demo keeps it local; nothing is sent
        var reader = new FileReader();
        reader.onload = function (ev) {
          pendingImagePreview = ev.target.result;
          document.getElementById('imgPreviewThumb').src = pendingImagePreview;
          document.getElementById('imgPreviewBar').classList.remove('uploading');
          syncSendEnabled();
        };
        reader.readAsDataURL(file);
      } catch (err) {
        document.getElementById('imgPreviewBar').classList.remove('show');
        document.getElementById('imgPreviewBar').classList.remove('uploading');
        toast(err.status === 401 ? 'Sign in to send images' : (err.message === 'upload_failed' ? 'Upload failed, try again' : err.message));
        syncSendEnabled();
      }
    });
    document.getElementById('imgRemoveBtn').addEventListener('click', function () {
      pendingImage = null; pendingImagePreview = null;
      document.getElementById('imgPreviewBar').classList.remove('show');
      document.getElementById('imgPreviewBar').classList.remove('uploading');
      syncSendEnabled();
    });
  }

  /* ── Compose ── */
  function syncSendEnabled() {
    var input = document.getElementById('composeInput'), sendBtn = document.getElementById('sendBtn');
    if (!sendBtn) return;
    sendBtn.disabled = !((input && input.value.trim()) || pendingImage);
  }

  async function sendMessage() {
    var input = document.getElementById('composeInput'), sendBtn = document.getElementById('sendBtn');
    if (!activeThread) return;
    var text = (input && input.value || '').trim();
    if (!text && !pendingImage) return;
    if (!LIVE) {
      if (pendingImage && !pendingImagePreview) return;
      pushLocal({ text: text, image: pendingImagePreview || '', isMine: true });
      input.value = ''; input.style.height = 'auto';
      pendingImage = null; pendingImagePreview = null;
      document.getElementById('imgPreviewBar').classList.remove('show');
      syncSendEnabled();
      return;
    }
    if (sendBtn) sendBtn.disabled = true;
    var body = {};
    if (text) body.text = text;
    if (pendingImage) body.image = pendingImage;
    try {
      var row = await req('POST', MSG + '/conversations/' + encodeURIComponent(activeThread.id) + '/messages', body);
      pushLocal(shapeMessage(row));
      input.value = ''; input.style.height = 'auto';
      pendingImage = null; pendingImagePreview = null;
      document.getElementById('imgPreviewBar').classList.remove('show');
      activeThread.preview = row.text || '[Image]';
      activeThread.updatedAt = asDate(row.createdAt);
      renderContacts(currentFilter());
    } catch (e) {
      toast(e.status === 401 ? 'Sign in to send messages' : (e.message === 'image_must_be_uploaded' ? 'Upload the image first' : e.message || 'Message not sent'));
    }
    syncSendEnabled();
  }

  function pushLocal(msg) {
    if (!activeThread) return;
    var id = msg.id || ('local_' + Date.now() + '_' + Math.floor(Math.random() * 1e4));
    activeThread.messages.push({
      id: id, text: msg.text || '', image: msg.image || '', edited: !!msg.edited,
      read: true, isMine: msg.isMine !== false, fromRole: msg.fromRole || 'author',
      sender: msg.sender || null, createdAt: asDate(msg.createdAt || new Date()),
    });
    activeThread.preview = (msg.text || '[Image]').slice(0, 80);
    activeThread.updatedAt = new Date();
    renderMessages();
  }

  /* ── Realtime: the shared socket already carries message + presence ──
     theme-chrome injects socket-client AFTER this file runs, and the client
     itself waits for the CDN script plus the handshake, so the socket appears
     asynchronously. Poll for it instead of silently skipping realtime. */
  function bindSocket() {
    var socket = global.DroboardSocket;
    if (!socket || !socket.on) {
      var tries = 0;
      var timer = setInterval(function () {
        if (++tries > 100) { clearInterval(timer); return; }   // ~20s, then give up
        if (global.DroboardSocket) { clearInterval(timer); bindSocket(); }
      }, 200);
      return;
    }
    socket.on('message', function (row) {
      if (!row || !activeThread || String(row.conversationId) !== activeThread.id) return;
      if (findMsg(String(row.id))) return;                     // already painted optimistically
      pushLocal(shapeMessage(row));
      renderContacts(currentFilter());
      // It arrived while the thread is on screen, so it is read immediately.
      if (LIVE) req('POST', MSG + '/conversations/' + encodeURIComponent(activeThread.id) + '/read').catch(function () {});
    });
    socket.on('presence', function (p) {
      if (!p || !p.userId) return;
      var hit = false;
      THREADS.forEach(function (t) { if (t.peer.id === String(p.userId)) { t.peer.online = !!p.online; hit = true; } });
      if (!hit) return;
      if (activeThread && activeThread.peer.id === String(p.userId)) paintThreadHead(activeThread);
      renderContacts(currentFilter());
    });
  }

  /* ── URL param: open a specific thread ── */
  async function checkUrlParam() {
    var cid = new URLSearchParams(location.search).get('contact');
    if (!cid) return;
    var t = THREADS.find(function (x) { return x.id === cid || x.peer.handle === cid.replace(/^@/, '') || x.peer.name === cid; });
    if (t) openThread(t);
  }

  /* ── Boot ── */
  document.getElementById('backBtn').addEventListener('click', closeChat);
  document.getElementById('contactSearchInput').addEventListener('input', function () { renderContacts(this.value); });
  document.getElementById('ctxOverlay').addEventListener('click', function (e) { if (e.target === this) closeCtx(); });
  document.getElementById('ctxEdit').addEventListener('click', function (e) { e.stopPropagation(); var id = ctxMsgId; closeCtx(); if (id) startEdit(id); });
  document.getElementById('ctxDelete').addEventListener('click', function (e) { e.stopPropagation(); var id = ctxMsgId; closeCtx(); if (id) doDelete(id); });
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('composeInput').addEventListener('input', function () {
    syncSendEnabled();
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });
  document.getElementById('composeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  bindAttach();
  bindSocket();
  if (global.AuthSession && global.AuthSession.ensureAccount) {
    global.AuthSession.ensureAccount().then(function () { if (activeThread) renderMessages(); });
  }
  loadThreads().then(checkUrlParam);

  global.ChatPage = {
    reload: loadThreads, openThread: openThread, closeChat: closeChat,
    sendMessage: sendMessage, isLive: function () { return LIVE; },
  };
})(window);
