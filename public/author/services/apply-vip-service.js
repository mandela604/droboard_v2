/**
 * apply-vip-service.js — VIP application wired to the real account.
 *
 * GET  /api/author/dashboard + /books → real stats and book picker
 * POST /api/author/vip                → { bookId, reason }
 *
 * Requirements are evaluated against the account's real numbers. The two
 * checks the backend has no data for ("active 6+ months", "no policy
 * violations") are shown as pending manual review, never as met.
 */
(function () {
  'use strict';
  if (window.ApplyVipService && window.ApplyVipService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 10000 };

  var STATS = null;
  var BOOKS = [];
  var selectedBook = null;

  var THRESHOLDS = { reads: 10000000, followers: 50000, books: 3 };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  function toast(m) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 3000);
  }

  async function call(path, opts) {
    opts = opts || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.TIMEOUT_MS);
    var init = Object.assign({ credentials: 'include', signal: controller.signal }, opts);
    if (init.body && typeof init.body !== 'string') {
      init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
      init.body = JSON.stringify(init.body);
    }
    var res;
    try { res = await fetch(CFG.API_BASE + path, init); }
    catch (e) { clearTimeout(timer); throw new Error(e && e.name === 'AbortError' ? 'Request timed out' : 'Network error'); }
    clearTimeout(timer);
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var msg = (body && (body.message || body.error)) || ('Request failed (' + res.status + ')');
      var err = new Error(String(msg).replace(/_/g, ' ')); err.status = res.status; throw err;
    }
    return body;
  }

  var api = window.ApplyVipService || {};
  api.getDashboard = async function () { return await call('/dashboard'); };
  api.listBooks = async function () { return await call('/books'); };
  api.submit = async function (d) { return await call('/vip', { method: 'POST', body: d }); };

  function validate() {
    document.getElementById('submitBtn').disabled = !(selectedBook && document.getElementById('statement').value.trim() && document.getElementById('termsCheck').checked);
  }

  function renderStats() {
    var s = (STATS && STATS.stats) || {};
    var published = BOOKS.filter(function (b) { return b.status === 'published' || b.status === 'completed'; }).length;
    document.getElementById('statReads').textContent = compact(s.reads || 0);
    document.getElementById('statFollowers').textContent = compact(s.followers || 0);
    document.getElementById('statBooks').textContent = String(Number(s.books) || 0);

    var reqs = [
      { label: '10M+ total reads', met: (Number(s.reads) || 0) >= THRESHOLDS.reads, actual: compact(s.reads || 0) + ' reads' },
      { label: '50K+ followers', met: (Number(s.followers) || 0) >= THRESHOLDS.followers, actual: compact(s.followers || 0) + ' followers' },
      { label: '3+ published books', met: published >= THRESHOLDS.books, actual: published + ' published' },
      { label: 'Active for 6+ months', met: null, actual: 'manual review' },
      { label: 'No policy violations', met: null, actual: 'manual review' }
    ];
    document.getElementById('requirements').innerHTML = reqs.map(function (r) {
      var cls = r.met === true ? 'met' : r.met === false ? 'unmet' : 'pending';
      var icon = r.met === true ? 'fa-check-circle' : r.met === false ? 'fa-circle-xmark' : 'fa-circle-info';
      return '<div class="req-item ' + cls + '"><i class="fas ' + icon + '"></i> ' + esc(r.label)
        + ' <span style="margin-left:auto;font-size:10.5px;color:var(--tx-faint)">' + esc(r.actual) + '</span></div>';
    }).join('');
  }

  function renderPicker() {
    var picker = document.getElementById('bookPicker');
    if (!BOOKS.length) {
      picker.innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:var(--tx-muted);font-size:12.5px">You need at least one book to apply.</div>';
      return;
    }
    picker.innerHTML = BOOKS.map(function (b) {
      var ch = Number(b.chapterCount) || 0;
      return '<div class="book-option" data-bid="' + esc(b.id) + '">'
        + '<img src="' + esc(b.cover || '../assets/droboard-icon.png') + '" alt="" onerror="this.onerror=null;this.src=\'../assets/droboard-icon.png\'"/>'
        + '<div class="book-option-info"><div class="book-option-title">' + esc(b.title || 'Untitled') + '</div>'
        + '<div class="book-option-meta">' + esc(b.genre || 'No genre') + ' · ' + ch + ' chapter' + (ch === 1 ? '' : 's') + '</div></div>'
        + '<div class="book-option-check"><i class="fas fa-check"></i></div></div>';
    }).join('');
    Array.prototype.forEach.call(picker.querySelectorAll('.book-option'), function (el) {
      el.addEventListener('click', function () {
        Array.prototype.forEach.call(picker.querySelectorAll('.book-option'), function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
        selectedBook = BOOKS.filter(function (b) { return String(b.id) === String(el.getAttribute('data-bid')); })[0] || null;
        validate();
      });
    });
  }

  function showLoadError(e) {
    var picker = document.getElementById('bookPicker');
    if (picker) {
      picker.innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:var(--tx-muted);font-size:12.5px">'
        + 'Could not load your application details. ' + esc((e && e.message) || 'Please try again.')
        + '<div><button type="button" id="retryVip" style="margin-top:10px;padding:7px 16px;border-radius:999px;border:1px solid var(--bd);background:var(--l2);color:var(--tx-body);font-weight:700;cursor:pointer">Retry</button></div></div>';
      var btn = document.getElementById('retryVip');
      if (btn) btn.addEventListener('click', loadAll);
    }
    var stats = document.getElementById('statsGrid');
    if (stats) stats.style.opacity = '.4';
  }

  async function loadAll() {
    var picker = document.getElementById('bookPicker');
    if (picker) picker.innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:var(--tx-muted);font-size:12.5px">Loading…</div>';
    try {
      var results = await Promise.all([api.getDashboard(), api.listBooks()]);
      STATS = results[0] || { stats: {} };
      BOOKS = Array.isArray(results[1]) ? results[1] : [];
      var stats = document.getElementById('statsGrid');
      if (stats) stats.style.opacity = '1';
      renderStats();
      renderPicker();
    } catch (e) {
      showLoadError(e);
    }
  }

  async function submit() {
    if (!selectedBook) { toast('Select a book first'); return; }
    var statement = document.getElementById('statement').value.trim();
    if (!statement) { toast('Tell us why you deserve VIP status'); return; }
    var btn = document.getElementById('submitBtn');
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying…';
    try {
      await api.submit({ bookId: selectedBook.id, reason: statement, statement: statement });
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').classList.add('show');
    } catch (e) {
      toast('Could not apply: ' + (e.message || 'unknown error'));
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  function init() {
    if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-vip.html'); window.AuthorDrawer.bind(); }
    document.getElementById('statement').addEventListener('input', validate);
    document.getElementById('termsCheck').addEventListener('change', validate);
    document.getElementById('submitBtn').addEventListener('click', submit);
    document.getElementById('doneBtn').addEventListener('click', function () { window.location.href = 'author-center.html'; });
    document.getElementById('backBtn').addEventListener('click', function () { if (window.history.length > 1) window.history.back(); else window.location.href = 'author-center.html'; });
    loadAll();
  }

  api.init = init;
  window.ApplyVipService = api;
})();
