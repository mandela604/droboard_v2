/**
 * launch-kit-service.js — author launch campaigns, backed by the real API.
 *
 * GET  /api/author/launch-kit        → campaigns for this author
 * POST /api/author/launch-kit        → create
 * PUT  /api/author/launch-kit/:id    → update
 * GET  /api/author/books             → story picker
 *
 * No placeholder campaigns and no invented analytics: the dashboard renders
 * what the campaign row actually contains, and failures show an error with a
 * retry instead of falling back to sample data.
 */
(function () {
  'use strict';
  if (window.AuthorLaunchKitService && window.AuthorLaunchKitService.init) return;
  var Svc = window.AuthorLaunchKitService || {};
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 12000 };

  var CAMPAIGNS = [];
  var CURRENT = null;
  var BOOKS = [];
  var STORY = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2400);
  }
  function fmtDate(v) {
    var d = new Date(v);
    if (!v || isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function copyText(text) {
    if (!text) { toast('Nothing to copy yet'); return; }
    navigator.clipboard.writeText(text).then(function () { toast('Copied!'); }).catch(function () {
      var t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.left = '-9999px';
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
      toast('Copied!');
    });
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
      var err = new Error(String(msg).replace(/_/g, ' '));
      err.status = res.status;
      throw err;
    }
    return body;
  }

  Svc.listCampaigns = async function () { return await call('/launch-kit'); };
  Svc.createCampaign = async function (data) { return await call('/launch-kit', { method: 'POST', body: data }); };
  Svc.updateCampaign = async function (id, data) { return await call('/launch-kit/' + encodeURIComponent(id), { method: 'PUT', body: data }); };
  Svc.listBooks = async function () { return await call('/books'); };

  function storyLink(book) {
    if (!book || !book.id) return '';
    return location.origin + '/Pages/bridge.html?id=' + encodeURIComponent(book.id);
  }
  function statusLabel(s) {
    if (s === 'active') return 'Active';
    if (s === 'scheduled') return 'Scheduled';
    return 'Draft';
  }
  function statusColor(s) {
    if (s === 'active') return 'var(--success)';
    if (s === 'scheduled') return 'var(--blue)';
    return 'var(--muted)';
  }
  function coverOf(c) {
    return (c && (c.imageWide || c.image)) || '../assets/droboard-icon.png';
  }

  function pageError(msg, retry) {
    var el = document.getElementById('pageContent');
    el.innerHTML = '<div class="form-card" style="text-align:center;color:var(--pink)">'
      + '<i class="fas fa-exclamation-triangle" style="font-size:22px;margin-bottom:8px"></i>'
      + '<div style="font-size:12px;font-weight:700">' + esc(msg || 'Something went wrong.') + '</div>'
      + '<button class="form-btn form-btn-primary" id="lkRetry" style="margin-top:12px">Retry</button></div>';
    var b = document.getElementById('lkRetry');
    if (b) b.addEventListener('click', function () { retry(); });
  }

  /* ── story picker ── */
  function renderStoryPreview() {
    var prev = document.getElementById('storyPreview');
    if (!prev) return;
    if (!STORY) { prev.style.display = 'none'; return; }
    prev.style.display = 'flex';
    var img = prev.querySelector('img');
    img.src = STORY.cover || '../assets/droboard-icon.png';
    img.onerror = function () { this.onerror = null; this.src = '../assets/droboard-icon.png'; };
    prev.querySelector('h4').textContent = STORY.title || '';
    prev.querySelector('p').textContent = [STORY.genre, STORY.category].filter(Boolean).join(' · ');
  }

  function pickStory(book) {
    if (!book) return;
    STORY = book;
    var dd = document.getElementById('storyDropdown');
    var input = document.getElementById('storySearch');
    if (dd) dd.style.display = 'none';
    if (input) input.value = '';
    renderStoryPreview();
    var dest = document.getElementById('edDest');
    if (dest && !dest.value.trim()) dest.value = storyLink(book);
  }

  function renderStoryDropdown(q) {
    var dd = document.getElementById('storyDropdown');
    if (!dd) return;
    q = String(q || '').trim().toLowerCase();
    if (!q) { dd.style.display = 'none'; return; }
    var hits = BOOKS.filter(function (b) {
      return String(b.title || '').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);
    if (!hits.length) {
      dd.innerHTML = '<div class="story-option"><div class="title">No matching stories</div></div>';
      dd.style.display = 'block';
      return;
    }
    dd.innerHTML = hits.map(function (b, i) {
      return '<div class="story-option" data-i="' + i + '"><img src="' + esc(b.cover || '../assets/droboard-icon.png') + '" alt=""/>'
        + '<div><div class="title">' + esc(b.title || 'Untitled') + '</div>'
        + '<div class="genre">' + esc([b.genre, b.category].filter(Boolean).join(' · ')) + '</div></div></div>';
    }).join('');
    dd.style.display = 'block';
    Array.prototype.forEach.call(dd.querySelectorAll('.story-option'), function (row) {
      row.addEventListener('click', function () {
        pickStory(hits[parseInt(this.getAttribute('data-i'), 10)]);
      });
    });
  }

  /* ── forms ── */
  function formHtml(k) {
    var editing = !!k;
    return '<div class="form-card">'
      + '<div style="font-size:14px;font-weight:700;margin-bottom:14px">' + (editing ? 'Edit Campaign' : 'Create Campaign') + '</div>'
      + '<div style="margin-bottom:12px"><label class="form-label">Your Story</label>'
      + '<div class="story-search-wrap"><input id="storySearch" class="form-input" placeholder="Search your books..." autocomplete="off"/>'
      + '<div class="story-dropdown" id="storyDropdown"></div></div></div>'
      + '<div id="storyPreview" class="story-preview" style="display:none"><img src="" alt=""/><div class="info"><h4></h4><p></p></div>'
      + '<button type="button" class="remove" id="clearStory"><i class="fas fa-xmark"></i></button></div>'
      + '<div style="margin-bottom:12px"><label class="form-label">Campaign Name</label>'
      + '<input id="edName" class="form-input" maxlength="120" placeholder="e.g. The Last Sunrise" value="' + esc(k ? k.campaignName : '') + '"/></div>'
      + '<div style="margin-bottom:12px"><label class="form-label">Description</label>'
      + '<textarea id="edDesc" class="form-input" maxlength="2000" placeholder="What is this campaign about?">' + esc(k ? k.desc : '') + '</textarea></div>'
      + '<div style="margin-bottom:12px"><label class="form-label">Destination URL</label>'
      + '<input id="edDest" class="form-input" placeholder="https://..." value="' + esc(k ? k.link : '') + '"/></div>'
      + '<div class="form-row" style="margin-bottom:12px"><div><label class="form-label">CTA Button</label>'
      + '<input id="edCta" class="form-input" maxlength="40" value="' + esc(k ? (k.cta || 'Read Now') : 'Read Now') + '"/></div>'
      + '<div><label class="form-label">Launch Date</label><input id="edDate" class="form-input" type="date" value="'
      + esc(k && k.launchDate ? String(k.launchDate).slice(0, 10) : '') + '"/></div></div>'
      + '<div id="formError" style="display:none;margin-bottom:10px;font-size:11.5px;font-weight:600;color:var(--pink)"></div>'
      + '<div style="display:flex;gap:8px"><button type="button" class="form-btn form-btn-outline" id="formCancel">Cancel</button>'
      + '<button type="button" class="form-btn form-btn-primary" id="formSave">' + (editing ? 'Save Changes' : 'Create Campaign') + '</button></div>'
      + '</div>';
  }

  function bindForm(k) {
    var search = document.getElementById('storySearch');
    if (search) search.addEventListener('input', function () { renderStoryDropdown(this.value); });
    var clear = document.getElementById('clearStory');
    if (clear) clear.addEventListener('click', function () { STORY = null; renderStoryPreview(); });
    var cancel = document.getElementById('formCancel');
    if (cancel) cancel.addEventListener('click', showDashboard);
    var save = document.getElementById('formSave');
    if (save) save.addEventListener('click', function () { saveCampaign(k); });
  }

  function showForm(k) {
    STORY = null;
    var el = document.getElementById('pageContent');
    el.innerHTML = formHtml(k);
    bindForm(k || null);
  }

  async function saveCampaign(k) {
    var name = (document.getElementById('edName') || {}).value || '';
    name = name.trim();
    var err = document.getElementById('formError');
    function fail(msg) {
      if (err) { err.textContent = msg; err.style.display = 'block'; }
      toast(msg);
    }
    if (!name) { fail('Campaign name is required'); return; }

    var desc = ((document.getElementById('edDesc') || {}).value || '').trim();
    var dest = ((document.getElementById('edDest') || {}).value || '').trim();
    var cta = ((document.getElementById('edCta') || {}).value || '').trim() || 'Read Now';
    var date = (document.getElementById('edDate') || {}).value || '';
    var image = (STORY && STORY.cover) || (k && k.image) || '';
    if (STORY) dest = dest || storyLink(STORY);

    var payload = {
      campaignName: name,
      campaignType: 'book',
      desc: desc,
      image: image,
      imageWide: image,
      link: dest,
      cta: cta,
      launchDate: date || null,
      status: date && new Date(date + 'T00:00:00').getTime() > Date.now() ? 'scheduled' : (k && k.status === 'active' ? 'active' : 'draft')
    };

    var btn = document.getElementById('formSave');
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    try {
      if (k && k.id) await Svc.updateCampaign(k.id, payload);
      else await Svc.createCampaign(payload);
      toast(k ? 'Campaign updated' : 'Campaign created');
      await showDashboard();
    } catch (e) {
      if (err) { err.textContent = 'Could not save: ' + (e.message || 'unknown error'); err.style.display = 'block'; }
      toast('Could not save: ' + (e.message || 'unknown error'));
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  /* ── dashboard ── */
  function shareText(c) {
    return [c.campaignName, c.desc].filter(Boolean).join(' — ');
  }

  function campaignHtml(c) {
    var link = c.link || '';
    var text = shareText(c);
    var html = '';

    html += '<div class="campaign-banner">';
    html += '<img src="' + esc(coverOf(c)) + '" alt="' + esc(c.campaignName || 'Campaign') + '" onerror="this.onerror=null;this.src=\'../assets/droboard-icon.png\'"/>';
    html += '<div class="campaign-banner-overlay">';
    html += '<div class="campaign-banner-title">' + esc(c.campaignName || 'Untitled campaign') + '</div>';
    if (c.desc) html += '<div class="campaign-banner-desc">' + esc(c.desc) + '</div>';
    html += '</div>';
    html += '<div class="campaign-banner-badge" style="background:' + statusColor(c.status) + '">' + statusLabel(c.status) + '</div>';
    html += '</div>';

    html += '<div class="link-card">';
    html += '<div class="link-label">Campaign Link</div>';
    if (link) {
      html += '<div class="link-row"><div class="link-url">' + esc(link) + '</div>'
        + '<button class="link-btn" id="copyLink">Copy</button></div>';
      html += '<div class="qr-row"><div class="qr-box" id="lkQr"><i class="fas fa-qrcode" style="font-size:22px;color:#1a1730"></i></div>'
        + '<div class="qr-info"><p>Scan to visit your campaign</p>'
        + '<div class="qr-btns"><button class="btn btn-outline" style="padding:6px 10px;font-size:9.5px;border-radius:6px" id="qrShare"><i class="fas fa-share"></i> Share</button></div></div></div>';
    } else {
      html += '<div style="font-size:11.5px;color:var(--muted);line-height:1.5">No destination URL yet. '
        + '<button type="button" id="editFromLink" style="color:var(--pink);font-weight:700">Add one</button> so the campaign has a share link.</div>';
    }
    html += '</div>';

    if (text || link) {
      html += '<div class="section"><div class="sec-title"><i class="fas fa-share-nodes"></i>Share Materials</div>';
      var body = esc(text || '') + (link ? '\n' + esc(link) : '');
      html += '<div class="share-card">';
      html += '<div class="share-card-platform"><i class="fab fa-whatsapp" style="color:#25d366"></i><div class="name">WhatsApp</div>'
        + '<button class="copy-btn" style="background:#25d366" id="copyWa"><i class="fas fa-copy"></i> Copy</button></div>';
      html += '<div class="share-card-body"><div class="share-card-text" style="white-space:pre-line">' + body + '</div></div>';
      html += '<div class="share-card-actions"><button class="btn btn-whatsapp" id="shareWa"><i class="fab fa-whatsapp"></i> Share</button>'
        + '<button class="btn btn-copy" id="copyWa2"><i class="fas fa-copy"></i> Copy</button></div></div>';

      html += '<div class="share-card">';
      html += '<div class="share-card-platform"><i class="fab fa-facebook" style="color:#1877f2"></i><div class="name">Facebook</div>'
        + '<button class="copy-btn" style="background:#1877f2" id="copyFb"><i class="fas fa-copy"></i> Copy</button></div>';
      html += '<div class="share-card-body"><div class="share-card-text" style="white-space:pre-line">' + body + '</div></div>';
      html += '<div class="share-card-actions"><button class="btn btn-facebook" id="shareFb"><i class="fab fa-facebook"></i> Share</button>'
        + '<button class="btn btn-copy" id="copyFb2"><i class="fas fa-copy"></i> Copy</button></div></div>';
      html += '</div>';
    }

    html += '<div class="section"><div class="sec-title"><i class="fas fa-circle-info"></i>Campaign Details</div><div class="link-card">';
    html += '<div class="promoter-item"><div class="promoter-info"><div class="promoter-name">Status</div>'
      + '<div class="promoter-stats">' + statusLabel(c.status) + '</div></div></div>';
    if (c.launchDate) {
      html += '<div class="promoter-item"><div class="promoter-info"><div class="promoter-name">Launch date</div>'
        + '<div class="promoter-stats">' + esc(fmtDate(c.launchDate)) + '</div></div></div>';
    }
    html += '<div class="promoter-item"><div class="promoter-info"><div class="promoter-name">CTA button</div>'
      + '<div class="promoter-stats">' + esc(c.cta || 'Not set') + '</div></div></div>';
    html += '<div class="promoter-item"><div class="promoter-info"><div class="promoter-name">Created</div>'
      + '<div class="promoter-stats">' + esc(fmtDate(c.createdAt)) + '</div></div></div>';
    html += '<div style="margin-top:12px;font-size:11px;color:var(--muted);line-height:1.5">Visitor and click tracking has not been recorded for this campaign yet.</div>';
    html += '</div></div>';

    return html;
  }

  function bindDashboard(c) {
    var link = c && c.link;
    var text = c ? shareText(c) : '';
    function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
    on('copyLink', function () { copyText(link); });
    on('qrShare', function () { shareCampaign(); });
    on('copyWa', function () { copyText(text + '\n' + link); });
    on('copyWa2', function () { copyText(text + '\n' + link); });
    on('shareWa', function () {
      window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + link), '_blank');
    });
    on('copyFb', function () { copyText(text + '\n' + link); });
    on('copyFb2', function () { copyText(text + '\n' + link); });
    on('shareFb', function () {
      window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link || location.href) + '&quote=' + encodeURIComponent(text), '_blank');
    });
    on('editFromLink', function () { showForm(c); });
    on('editCampaign', function () { showForm(c); });
    on('newCampaign', function () { showForm(null); });
    hydrateQR(link);
  }

  function hydrateQR(link) {
    var box = document.getElementById('lkQr');
    if (!box || !link) return;
    if (window.FlyerPreview && window.FlyerPreview.qr && window.FlyerPreview.qr.draw) {
      box.innerHTML = '<div class="lk-qr" data-lkqr="' + esc(link) + '" style="width:80px;height:80px"></div>';
      try { window.FlyerPreview.qr.draw(box); } catch (e) {}
    }
  }

  function shareCampaign() {
    if (!CURRENT) { toast('No campaign to share yet'); return; }
    if (!CURRENT.link) { toast('Add a destination URL first'); return; }
    if (navigator.share) {
      navigator.share({ title: CURRENT.campaignName, text: shareText(CURRENT), url: CURRENT.link }).catch(function () {});
    } else {
      copyText(CURRENT.link);
      toast('Campaign link copied!');
    }
  }

  async function showDashboard() {
    var el = document.getElementById('pageContent');
    el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading your campaign…</p></div>';
    try {
      var list = await Svc.listCampaigns();
      CAMPAIGNS = Array.isArray(list) ? list : [];
      if (!CAMPAIGNS.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-bullseye"></i><p>No Campaign Yet</p>'
          + '<small>Create your first campaign to get a share link for your book.</small>'
          + '<div style="margin-top:16px"><button class="form-btn form-btn-primary" id="newCampaign" style="width:auto;padding:10px 24px;display:inline-flex;align-items:center;gap:6px">'
          + '<i class="fas fa-plus"></i> Create Campaign</button></div></div>';
        document.getElementById('newCampaign').addEventListener('click', function () { showForm(null); });
        return;
      }
      CURRENT = CAMPAIGNS[0];
      var html = '<div class="tab-bar"><div class="tab-item active">Dashboard</div>'
        + '<div class="tab-item" id="editCampaign">Edit</div></div>';
      if (CAMPAIGNS.length > 1) {
        html += '<div class="section"><div class="sec-title"><i class="fas fa-layer-group"></i>Your campaigns</div><div class="link-card" id="campaignList">';
        CAMPAIGNS.forEach(function (c, i) {
          html += '<div class="promoter-item" data-i="' + i + '" style="cursor:pointer">'
            + '<div class="promoter-info"><div class="promoter-name">' + esc(c.campaignName || 'Untitled') + '</div>'
            + '<div class="promoter-stats">' + statusLabel(c.status) + (c.launchDate ? ' · ' + esc(fmtDate(c.launchDate)) : '') + '</div></div>'
            + (i === 0 ? '<i class="fas fa-check" style="color:var(--success);font-size:11px"></i>' : '')
            + '</div>';
        });
        html += '</div></div>';
      }
      html += campaignHtml(CURRENT);
      html += '<div style="margin-top:6px"><button class="form-btn form-btn-outline" id="newCampaign"><i class="fas fa-plus"></i> New Campaign</button></div>';
      el.innerHTML = html;
      bindDashboard(CURRENT);

      var listEl = document.getElementById('campaignList');
      if (listEl) {
        Array.prototype.forEach.call(listEl.querySelectorAll('[data-i]'), function (row) {
          row.addEventListener('click', function () {
            CURRENT = CAMPAIGNS[parseInt(row.getAttribute('data-i'), 10)];
            showDashboard();
          });
        });
      }
    } catch (e) {
      pageError(e.message || 'Could not load your campaigns.', showDashboard);
    }
  }

  function init() {
    Svc.listBooks().then(function (books) {
      BOOKS = Array.isArray(books) ? books : [];
    }).catch(function () { BOOKS = []; });
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('launch-kit.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    showDashboard();
  }

  Svc.init = init;
  Svc.showDashboard = showDashboard;

  window.AuthorLaunchKitService = Svc;
  window.copyText = copyText;
  window.shareCampaign = shareCampaign;
  window.pickStory = pickStory;
  window.clearStory = function () { STORY = null; renderStoryPreview(); };
})();
