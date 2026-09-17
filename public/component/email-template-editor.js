/**
 * email-template-editor.js — Droboard Email Template Editor
 * Plain text inputs on left, styled preview on right. No HTML visible.
 */
(function () {
  'use strict';

  var CSS = ''
    + '.ete-backdrop{position:fixed;inset:0;background:rgba(10,6,25,.6);z-index:2000;opacity:0;pointer-events:none;transition:opacity .25s}'
    + '.ete-backdrop.open{opacity:1;pointer-events:auto}'
    + '.ete-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);z-index:2010;background:var(--card);border-radius:16px;width:calc(100% - 40px);max-width:880px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.35);opacity:0;transition:.25s}'
    + '.ete-backdrop.open .ete-modal{transform:translate(-50%,-50%) scale(1);opacity:1}'
    + '.ete-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border);flex-shrink:0}'
    + '.ete-head h3{font-size:15px;font-weight:800}'
    + '.ete-head-actions{display:flex;gap:8px}'
    + '.ete-head-actions button{padding:7px 14px;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text)}'
    + '.ete-head-actions button:hover{border-color:var(--accent);color:var(--accent)}'
    + '.ete-head-actions .ete-save{background:var(--accent);border-color:transparent;color:#fff}'
    + '.ete-head-actions .ete-save:hover{filter:brightness(1.06);color:#fff}'
    + '.ete-body{display:grid;grid-template-columns:1fr 1fr;gap:0;flex:1;min-height:0;overflow:hidden}'
    + '.ete-editor{padding:22px;overflow-y:auto;border-right:1px solid var(--border)}'
    + '.ete-preview{padding:20px;overflow-y:auto;background:#f4f4fb}'
    + '.ete-tabs{display:flex;gap:2px;padding:0 22px;background:var(--hover);border-bottom:1px solid var(--border);flex-shrink:0}'
    + '.ete-tab{padding:10px 16px;font-size:11.5px;font-weight:700;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;transition:.15s}'
    + '.ete-tab:hover{color:var(--text)}'
    + '.ete-tab.active{color:var(--accent);border-bottom-color:var(--accent)}'
    + '.ete-tab-panel{display:none}'
    + '.ete-tab-panel.active{display:block}'
    + '.ete-section{margin-bottom:14px}'
    + '.ete-section label{display:block;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}'
    + '.ete-section input,.ete-section textarea{width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;padding:9px 12px;font-size:12.5px;color:var(--text);font-family:inherit;outline:none;transition:.12s}'
    + '.ete-section input:focus,.ete-section textarea:focus{border-color:var(--accent)}'
    + '.ete-section textarea{min-height:70px;resize:vertical;line-height:1.6}'
    + '.ete-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
    + '.ete-color{display:flex;align-items:center;gap:8px}'
    + '.ete-color input[type=color]{width:36px;height:32px;padding:2px;border-radius:6px;cursor:pointer;border:1px solid var(--input-border)}'
    + '.ete-color span{font-size:11px;color:var(--text-muted)}'
    + '.ep-frame{background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}'
    + '.ep-hdr{padding:36px 28px;text-align:center}'
    + '.ep-hdr h2{color:#fff;font-size:22px;font-weight:800;margin:0;text-shadow:0 1px 4px rgba(0,0,0,.15)}'
    + '.ep-hdr p{color:rgba(255,255,255,.85);font-size:13px;margin:6px 0 0;font-weight:500}'
    + '.ep-content{padding:28px;font-family:Inter,system-ui,sans-serif;color:#1a1730;font-size:13.5px;line-height:1.75}'
    + '.ep-content h3{font-size:16px;font-weight:800;margin:0 0 10px}'
    + '.ep-content p{margin:0 0 12px}'
    + '.ep-content ul{margin:0 0 14px;padding-left:18px}'
    + '.ep-content li{margin-bottom:4px}'
    + '.ep-content .ep-btn{display:inline-block;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;margin:14px 0 4px}'
    + '.ep-foot{padding:20px 28px;background:#f9f9fc;text-align:center;border-top:1px solid var(--border)}'
    + '.ep-foot p{font-size:11.5px;color:#71708a;margin:0 0 6px;line-height:1.6}'
    + '.ep-foot a{color:var(--accent);text-decoration:none;font-weight:600}'
    + '@media(max-width:700px){.ete-body{grid-template-columns:1fr}.ete-editor{border-right:none;border-bottom:1px solid var(--border)}}';

  var styleEl = null;
  function ensureCSS() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
  }

  var backdrop = null, modal = null;
  function ensureDOM() {
    if (backdrop) return;
    backdrop = document.createElement('div');
    backdrop.className = 'ete-backdrop';
    modal = document.createElement('div');
    modal.className = 'ete-modal';
    modal.innerHTML = ''
      + '<div class="ete-head">'
      +   '<h3 id="eteTitle">Edit Email Template</h3>'
      +   '<div class="ete-head-actions">'
      +     '<button onclick="DroboardEmailEditor.close()">Cancel</button>'
      +     '<button class="ete-save" onclick="DroboardEmailEditor.save()">Save Template</button>'
      +   '</div>'
      + '</div>'
      + '<div class="ete-tabs">'
      +   '<div class="ete-tab active" data-tab="content">Content</div>'
      +   '<div class="ete-tab" data-tab="settings">Settings</div>'
      + '</div>'
      + '<div class="ete-body">'
      +   '<div class="ete-editor">'
      +     '<div class="ete-tab-panel active" data-panel="content">'
      +       '<div class="ete-section"><label>Greeting</label><input id="eteGreeting" placeholder="e.g. Hi Tobi,"/></div>'
      +       '<div class="ete-section"><label>Body Text</label><textarea id="eteBody" rows="5" placeholder="Main email body. Use new lines for paragraphs."></textarea></div>'
      +       '<div class="ete-section"><label>Bullet Points</label><textarea id="eteBullets" rows="3" placeholder="One item per line (optional)"></textarea></div>'
      +       '<div class="ete-row">'
      +         '<div class="ete-section"><label>Button Text</label><input id="eteBtnText" placeholder="e.g. Get Started"/></div>'
      +         '<div class="ete-section"><label>Button Color</label><div class="ete-color"><input type="color" id="eteBtnColor" value="#ff0050"/><span id="eteBtnColorHex">#ff0050</span></div></div>'
      +       '</div>'
      +       '<div class="ete-section"><label>Button Link</label><input id="eteBtnLink" placeholder="https://droboard.app/dashboard"/></div>'
      +       '<div class="ete-section"><label>Footer Note</label><textarea id="eteFooterNote" rows="2" placeholder="e.g. Questions? Contact support@droboard.app"></textarea></div>'
      +       '<div class="ete-section"><label>Unsubscribe Text</label><input id="eteUnsub" value="Unsubscribe | Manage Preferences"/></div>'
      +     '</div>'
      +     '<div class="ete-tab-panel" data-panel="settings">'
      +       '<div class="ete-section"><label>Template Name</label><input id="eteName" placeholder="e.g. Welcome Email"/></div>'
      +       '<div class="ete-section"><label>Subject Line</label><input id="eteSubject" placeholder="Email subject"/></div>'
      +       '<div class="ete-section"><label>Preview Text</label><input id="etePreheader" placeholder="Short preview shown in inbox"/></div>'
      +       '<div class="ete-row">'
      +         '<div class="ete-section"><label>From Name</label><input id="eteFromName" placeholder="Droboard Team"/></div>'
      +         '<div class="ete-section"><label>From Email</label><input id="eteFromEmail" placeholder="welcome@droboard.app"/></div>'
      +       '</div>'
      +       '<div class="ete-section"><label>Header Color</label><div class="ete-color"><input type="color" id="eteHeaderColor" value="#ff0050"/><span id="eteHeaderColorHex">#ff0050</span></div></div>'
      +       '<div class="ete-section"><label>Header Title</label><input id="eteHeaderTitle" placeholder="e.g. Welcome to Droboard!"/></div>'
      +       '<div class="ete-section"><label>Header Subtitle</label><input id="eteHeaderSub" placeholder="e.g. Your journey starts here"/></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="ete-preview">'
      +     '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px">Live Preview</div>'
      +     '<div class="ep-frame" id="epFrame">'
      +       '<div class="ep-hdr" id="epHdr"><h2 id="epHdrTitle">—</h2><p id="epHdrSub"></p></div>'
      +       '<div class="ep-content" id="epContent"></div>'
      +       '<div class="ep-foot" id="epFoot"></div>'
      +     '</div>'
      +   '</div>'
      + '</div>';
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) DroboardEmailEditor.close(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') DroboardEmailEditor.close(); });

    modal.querySelectorAll('.ete-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        modal.querySelectorAll('.ete-tab').forEach(function(t) { t.classList.remove('active'); });
        modal.querySelectorAll('.ete-tab-panel').forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        modal.querySelector('[data-panel="' + tab.dataset.tab + '"]').classList.add('active');
      });
    });

    var fields = ['eteSubject','etePreheader','eteName','eteFromName','eteFromEmail','eteHeaderTitle','eteHeaderSub','eteHeaderColor','eteGreeting','eteBody','eteBullets','eteBtnText','eteBtnColor','eteBtnLink','eteFooterNote','eteUnsub'];
    fields.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });

    document.getElementById('eteHeaderColor').addEventListener('input', function() {
      document.getElementById('eteHeaderColorHex').textContent = this.value;
    });
    document.getElementById('eteBtnColor').addEventListener('input', function() {
      document.getElementById('eteBtnColorHex').textContent = this.value;
    });
  }

  var currentId = null, onSaveCb = null;

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function darken(hex, amt) {
    hex = hex.replace('#', '');
    var r = Math.max(0, parseInt(hex.substring(0, 2), 16) - amt);
    var g = Math.max(0, parseInt(hex.substring(2, 4), 16) - amt);
    var b = Math.max(0, parseInt(hex.substring(4, 6), 16) - amt);
    return '#' + [r, g, b].map(function(c) { return c.toString(16).padStart(2, '0'); }).join('');
  }

  function updatePreview() {
    var hColor = document.getElementById('eteHeaderColor').value;
    var hTitle = document.getElementById('eteHeaderTitle').value;
    var hSub = document.getElementById('eteHeaderSub').value;
    var greeting = document.getElementById('eteGreeting').value;
    var body = document.getElementById('eteBody').value;
    var bullets = document.getElementById('eteBullets').value;
    var btnText = document.getElementById('eteBtnText').value;
    var btnColor = document.getElementById('eteBtnColor').value;
    var btnLink = document.getElementById('eteBtnLink').value;
    var footerNote = document.getElementById('eteFooterNote').value;
    var unsub = document.getElementById('eteUnsub').value;

    document.getElementById('epHdr').style.background = 'linear-gradient(135deg, ' + hColor + ', ' + darken(hColor, 30) + ')';
    document.getElementById('epHdrTitle').textContent = hTitle || '—';
    document.getElementById('epHdrSub').textContent = hSub || '';

    var html = '';
    if (greeting) html += '<h3>' + esc(greeting) + '</h3>';
    if (body) {
      var paras = body.split('\n').filter(function(p) { return p.trim(); });
      html += paras.map(function(p) { return '<p>' + esc(p) + '</p>'; }).join('');
    }
    if (bullets) {
      var items = bullets.split('\n').filter(function(b) { return b.trim(); });
      if (items.length) html += '<ul>' + items.map(function(b) { return '<li>' + esc(b.trim()) + '</li>'; }).join('') + '</ul>';
    }
    if (btnText) html += '<a class="ep-btn" href="' + esc(btnLink || '#') + '" style="background:' + btnColor + ';color:#fff">' + esc(btnText) + '</a>';
    document.getElementById('epContent').innerHTML = html || '<p style="color:#9694ac;font-style:italic">Start typing to see preview...</p>';

    var fHtml = '';
    if (footerNote) fHtml += '<p>' + esc(footerNote) + '</p>';
    if (unsub) fHtml += '<p style="margin-top:8px;font-size:10.5px;color:#9694ac">' + esc(unsub) + '</p>';
    document.getElementById('epFoot').innerHTML = fHtml;
  }

  function open(opts) {
    ensureCSS();
    ensureDOM();
    currentId = opts.templateId;
    onSaveCb = opts.onSave || null;
    document.getElementById('eteTitle').textContent = opts.templateName || 'Edit Template';

    var d = opts.data || {};
    document.getElementById('eteName').value = d.name || '';
    document.getElementById('eteSubject').value = d.subject || '';
    document.getElementById('etePreheader').value = d.preheader || '';
    document.getElementById('eteFromName').value = d.fromName || '';
    document.getElementById('eteFromEmail').value = d.fromEmail || '';
    document.getElementById('eteHeaderColor').value = d.headerColor || '#ff0050';
    document.getElementById('eteHeaderColorHex').textContent = d.headerColor || '#ff0050';
    document.getElementById('eteHeaderTitle').value = d.headerTitle || '';
    document.getElementById('eteHeaderSub').value = d.headerSub || '';
    document.getElementById('eteGreeting').value = d.greeting || '';
    document.getElementById('eteBody').value = d.body || '';
    document.getElementById('eteBullets').value = d.bullets || '';
    document.getElementById('eteBtnText').value = d.btnText || '';
    document.getElementById('eteBtnColor').value = d.btnColor || '#ff0050';
    document.getElementById('eteBtnColorHex').textContent = d.btnColor || '#ff0050';
    document.getElementById('eteBtnLink').value = d.btnLink || '';
    document.getElementById('eteFooterNote').value = d.footerNote || '';
    document.getElementById('eteUnsub').value = d.unsub || 'Unsubscribe | Manage Preferences';

    if (opts.startTab === 'settings') {
      modal.querySelectorAll('.ete-tab').forEach(function(t) { t.classList.remove('active'); });
      modal.querySelectorAll('.ete-tab-panel').forEach(function(p) { p.classList.remove('active'); });
      modal.querySelector('.ete-tab[data-tab="settings"]').classList.add('active');
      modal.querySelector('[data-panel="settings"]').classList.add('active');
    } else {
      modal.querySelectorAll('.ete-tab').forEach(function(t) { t.classList.remove('active'); });
      modal.querySelectorAll('.ete-tab-panel').forEach(function(p) { p.classList.remove('active'); });
      modal.querySelector('.ete-tab[data-tab="content"]').classList.add('active');
      modal.querySelector('[data-panel="content"]').classList.add('active');
    }

    updatePreview();
    backdrop.classList.add('open');
  }

  function openWithPreset(id) {
    if (typeof DroboardEmailTemplates !== 'undefined') {
      DroboardEmailTemplates.getById(id).then(function(t) {
        if (t) open({ templateId: id, templateName: t.name, data: t, onSave: DroboardEmailTemplates.save.bind(DroboardEmailTemplates) });
      });
    }
  }

  function close() {
    if (backdrop) backdrop.classList.remove('open');
    currentId = null;
    if (typeof renderEmailTemplatesList === 'function') renderEmailTemplatesList();
  }

  function save() {
    var data = {
      id: currentId || 'tpl_' + Date.now(),
      name: document.getElementById('eteName').value,
      subject: document.getElementById('eteSubject').value,
      preheader: document.getElementById('etePreheader').value,
      fromName: document.getElementById('eteFromName').value,
      fromEmail: document.getElementById('eteFromEmail').value,
      headerColor: document.getElementById('eteHeaderColor').value,
      headerTitle: document.getElementById('eteHeaderTitle').value,
      headerSub: document.getElementById('eteHeaderSub').value,
      greeting: document.getElementById('eteGreeting').value,
      body: document.getElementById('eteBody').value,
      bullets: document.getElementById('eteBullets').value,
      btnText: document.getElementById('eteBtnText').value,
      btnColor: document.getElementById('eteBtnColor').value,
      btnLink: document.getElementById('eteBtnLink').value,
      footerNote: document.getElementById('eteFooterNote').value,
      unsub: document.getElementById('eteUnsub').value,
    };
    try { if (onSaveCb) onSaveCb(currentId, data); } catch(e) { console.error(e); }
    close();
  }

  function createNew() {
    currentId = null;
    ensureCSS();
    ensureDOM();
    document.getElementById('eteTitle').textContent = 'New Template';
    document.getElementById('eteName').value = '';
    document.getElementById('eteSubject').value = '';
    document.getElementById('etePreheader').value = '';
    document.getElementById('eteFromName').value = 'Droboard Team';
    document.getElementById('eteFromEmail').value = 'noreply@droboard.app';
    document.getElementById('eteHeaderColor').value = '#ff0050';
    document.getElementById('eteHeaderColorHex').textContent = '#ff0050';
    document.getElementById('eteHeaderTitle').value = '';
    document.getElementById('eteHeaderSub').value = '';
    document.getElementById('eteGreeting').value = '';
    document.getElementById('eteBody').value = '';
    document.getElementById('eteBullets').value = '';
    document.getElementById('eteBtnText').value = '';
    document.getElementById('eteBtnColor').value = '#ff0050';
    document.getElementById('eteBtnColorHex').textContent = '#ff0050';
    document.getElementById('eteBtnLink').value = '';
    document.getElementById('eteFooterNote').value = '';
    document.getElementById('eteUnsub').value = 'Unsubscribe | Manage Preferences';
    modal.querySelectorAll('.ete-tab').forEach(function(t) { t.classList.remove('active'); });
    modal.querySelectorAll('.ete-tab-panel').forEach(function(p) { p.classList.remove('active'); });
    modal.querySelector('.ete-tab[data-tab="content"]').classList.add('active');
    modal.querySelector('[data-panel="content"]').classList.add('active');
    updatePreview();
    backdrop.classList.add('open');
  }

  window.DroboardEmailEditor = { open: open, openWithPreset: openWithPreset, close: close, save: save, createNew: createNew };
})();
