/* ═══════════════════════════════════════════════════════════════
   POST COMPOSER — Genre Hub Discussion Composer
   Bottom-sheet modal for creating discussion threads.
   Self-contained CSS + HTML. Open via PostComposer.open(opts).
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__postComposer) return;
  window.__postComposer = true;

  const TAGS = [
    { label: 'Discussion', cls: 'discussion', color: '#7c3aed', bg: 'rgba(167,139,250,.12)' },
    { label: 'Recommendation', cls: 'recommendation', color: '#ff0050', bg: 'rgba(255,0,80,.08)' },
    { label: 'Theory', cls: 'theory', color: '#0284c7', bg: 'rgba(56,189,248,.12)' },
    { label: 'Question', cls: 'question', color: '#0d9668', bg: 'rgba(52,211,153,.12)' },
    { label: 'Controversial', cls: 'controversial', color: '#c2410c', bg: 'rgba(251,146,60,.14)' },
  ];

  const CSS = `
    .pc-overlay{
      position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);
      opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s ease;
    }
    .pc-overlay.open{opacity:1;visibility:visible}
    .pc-sheet{
      position:fixed;left:0;right:0;bottom:0;z-index:9001;
      max-width:480px;margin:0 auto;
      background:var(--pc-l1,#fff);border-radius:20px 20px 0 0;
      transform:translateY(100%);transition:transform .32s cubic-bezier(.32,.72,.24,1.02);
      display:flex;flex-direction:column;
      height:auto;max-height:88dvh;
      box-shadow:0 -8px 40px rgba(0,0,0,.18);
      overscroll-behavior:contain;
    }
    .pc-overlay.open .pc-sheet{transform:translateY(0)}

    .pc-handle{display:flex;justify-content:center;padding:10px 0 2px;flex-shrink:0}
    .pc-handle-bar{width:36px;height:4px;border-radius:2px;background:var(--pc-bd,rgba(0,0,0,.1))}

    .pc-header{
      display:flex;align-items:center;justify-content:space-between;
      padding:8px 16px 12px;border-bottom:1px solid var(--pc-bd,rgba(0,0,0,.08));
      flex-shrink:0;
    }
    .pc-cancel{
      font-size:13px;font-weight:600;color:var(--pc-muted,#8e8e93);
      background:none;border:none;cursor:pointer;padding:6px 2px;font-family:inherit;
    }
    .pc-title{font-size:15px;font-weight:800;color:var(--pc-tx,#1a1a1a)}
    .pc-post-btn{
      font-size:13px;font-weight:800;color:#fff;background:var(--pc-acc,#ff2d55);
      border:none;border-radius:20px;padding:7px 18px;cursor:pointer;
      font-family:inherit;opacity:.4;pointer-events:none;transition:.18s;
    }
    .pc-post-btn.ready{opacity:1;pointer-events:auto}
    .pc-post-btn.ready:active{transform:scale(.95)}

    .pc-body{flex:1;overflow-y:auto;padding:16px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
    .pc-body::-webkit-scrollbar{display:none}

    .pc-field{margin-bottom:16px}
    .pc-label{font-size:10px;font-weight:800;color:var(--pc-muted,#8e8e93);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
    .pc-input{
      width:100%;background:var(--pc-l2,#f1f1f1);border:1.5px solid var(--pc-bd,rgba(0,0,0,.08));
      border-radius:12px;padding:12px 14px;color:var(--pc-tx,#1a1a1a);font-size:14px;font-weight:600;
      font-family:inherit;outline:none;transition:border-color .18s;
    }
    .pc-input:focus{border-color:var(--pc-acc,#ff2d55)}
    .pc-input::placeholder{color:var(--pc-faint,#8e8e93);font-weight:500}

    .pc-textarea{
      width:100%;background:var(--pc-l2,#f1f1f1);border:1.5px solid var(--pc-bd,rgba(0,0,0,.08));
      border-radius:12px;padding:12px 14px;color:var(--pc-tx,#1a1a1a);font-size:13px;font-weight:500;
      font-family:inherit;outline:none;resize:none;min-height:100px;line-height:1.55;
      transition:border-color .18s;
    }
    .pc-textarea:focus{border-color:var(--pc-acc,#ff2d55)}
    .pc-textarea::placeholder{color:var(--pc-faint,#8e8e93)}

    .pc-tags{display:flex;flex-wrap:wrap;gap:7px}
    .pc-tag{
      padding:7px 14px;border-radius:20px;font-size:11.5px;font-weight:700;
      border:1.5px solid var(--pc-bd,rgba(0,0,0,.08));background:var(--pc-l2,#f1f1f1);
      color:var(--pc-muted,#8e8e93);cursor:pointer;transition:.16s;user-select:none;
    }
    .pc-tag:active{transform:scale(.95)}
    .pc-tag.sel{border-color:var(--pc-acc,#ff2d55);color:var(--pc-acc,#ff2d55);background:rgba(255,45,85,.08)}

    .pc-char-count{font-size:9px;color:var(--pc-faint,#8e8e93);text-align:right;margin-top:4px;font-weight:600}
    .pc-char-count.warn{color:#f59e0b}

    .pc-img-section{display:flex;gap:8px;align-items:center}
    .pc-img-input{flex:1}
    .pc-img-preview{
      width:56px;height:56px;border-radius:10px;overflow:hidden;flex-shrink:0;
      border:1.5px solid var(--pc-bd,rgba(0,0,0,.08));background:var(--pc-l2,#f1f1f1);display:none;
    }
    .pc-img-preview img{width:100%;height:100%;object-fit:cover;display:block}
    .pc-img-preview.show{display:block}
    .pc-img-clear{
      width:28px;height:28px;border-radius:50%;background:rgba(248,113,113,.1);
      border:1px solid rgba(248,113,113,.2);color:#f87171;display:none;align-items:center;
      justify-content:center;font-size:10px;cursor:pointer;flex-shrink:0;
    }
    .pc-img-preview.show ~ .pc-img-clear{display:flex}

    @media(max-width:480px){
      .pc-sheet{max-width:100%}
    }
  `;

  let _overlay = null;
  let _sheet = null;
  let _titleInp, _bodyInp, _tagBtns, _imgInp, _imgPreview, _imgClear, _postBtn;
  let _selectedTag = null;
  let _onPost = null;
  let _genreName = '';
  let _openTs = 0;

  function _injectStyles() {
    if (document.getElementById('pc-style')) return;
    const s = document.createElement('style');
    s.id = 'pc-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function _buildDOM() {
    if (_overlay) return;
    _injectStyles();

    _overlay = document.createElement('div');
    _overlay.className = 'pc-overlay';

    const sheet = document.createElement('div');
    sheet.className = 'pc-sheet';
    _sheet = sheet;

    /* ── CRITICAL: stop all events from reaching the overlay ── */
    sheet.addEventListener('click', function (e) { e.stopPropagation(); });
    sheet.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });

    /* ── Overlay close: only mousedown/click on the backdrop itself ── */
    _overlay.addEventListener('mousedown', function (e) {
      if (e.target === _overlay) _close();
    });

    sheet.innerHTML = `
      <div class="pc-handle"><div class="pc-handle-bar"></div></div>
      <div class="pc-header">
        <button type="button" class="pc-cancel" id="pcCancel">Cancel</button>
        <div class="pc-title">New Discussion</div>
        <button type="button" class="pc-post-btn" id="pcPostBtn">Post</button>
      </div>
      <div class="pc-body">
        <div class="pc-field">
          <div class="pc-label">Title</div>
          <input class="pc-input" id="pcTitle" maxlength="120" placeholder="What's on your mind?"/>
          <div class="pc-char-count" id="pcTitleCount">0 / 120</div>
        </div>
        <div class="pc-field">
          <div class="pc-label">Body</div>
          <textarea class="pc-textarea" id="pcBody" placeholder="Share your thoughts, theories, or questions…" rows="4"></textarea>
          <div class="pc-char-count" id="pcBodyCount">0 / 300 words</div>
        </div>
        <div class="pc-field">
          <div class="pc-label">Tag</div>
          <div class="pc-tags" id="pcTags"></div>
        </div>
        <div class="pc-field">
          <div class="pc-label">Image <span style="text-transform:none;letter-spacing:0;font-weight:600">(optional)</span></div>
          <div class="pc-img-section">
            <input class="pc-input pc-img-input" id="pcImgUrl" placeholder="Paste an image URL…"/>
            <div class="pc-img-preview" id="pcImgPreview"><img id="pcImgPrevImg" src="" alt=""/></div>
            <div class="pc-img-clear" id="pcImgClear"><i class="fas fa-times"></i></div>
          </div>
        </div>
        <div class="pc-field">
          <div class="pc-label">Story link <span style="text-transform:none;letter-spacing:0;font-weight:600">(optional)</span></div>
          <input class="pc-input" id="pcStoryLink" placeholder="e.g. The Priory of the Orange Tree"/>
        </div>
      </div>
    `;

    _overlay.appendChild(sheet);
    document.body.appendChild(_overlay);

    _titleInp = document.getElementById('pcTitle');
    _bodyInp = document.getElementById('pcBody');
    _imgInp = document.getElementById('pcImgUrl');
    _imgPreview = document.getElementById('pcImgPreview');
    _imgClear = document.getElementById('pcImgClear');
    _postBtn = document.getElementById('pcPostBtn');

    /* ── tag chips ── */
    var tagsEl = document.getElementById('pcTags');
    tagsEl.innerHTML = TAGS.map(function (t) {
      return '<button type="button" class="pc-tag" data-pc-tag="' + t.cls + '">' + t.label + '</button>';
    }).join('');
    _tagBtns = tagsEl.querySelectorAll('.pc-tag');
    _tagBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var was = btn.classList.contains('sel');
        _tagBtns.forEach(function (b) { b.classList.remove('sel'); });
        if (!was) { btn.classList.add('sel'); _selectedTag = btn.dataset.pcTag; }
        else { _selectedTag = null; }
        _updatePostBtn();
      });
    });

    /* ── title count ── */
    _titleInp.addEventListener('input', function () {
      var len = _titleInp.value.length;
      var cnt = document.getElementById('pcTitleCount');
      cnt.textContent = len + ' / 120';
      cnt.classList.toggle('warn', len > 100);
      _updatePostBtn();
    });

    /* ── body: word count + auto-grow ── */
    _bodyInp.addEventListener('input', function () {
      var text = _bodyInp.value.trim();
      var words = text ? text.split(/\s+/).length : 0;
      var cnt = document.getElementById('pcBodyCount');
      cnt.textContent = words + ' / 300 words';
      cnt.classList.toggle('warn', words > 270);
      /* auto-grow: set height to scrollHeight then cap at 280px */
      _bodyInp.style.height = 'auto';
      _bodyInp.style.height = Math.min(_bodyInp.scrollHeight, 280) + 'px';
      _updatePostBtn();
    });

    /* ── image preview ── */
    _imgInp.addEventListener('input', function () {
      var url = _imgInp.value.trim();
      if (url) {
        document.getElementById('pcImgPrevImg').src = url;
        _imgPreview.classList.add('show');
      } else {
        _imgPreview.classList.remove('show');
      }
    });
    _imgClear.addEventListener('click', function (e) {
      e.stopPropagation();
      _imgInp.value = '';
      _imgPreview.classList.remove('show');
    });

    /* ── cancel / post ── */
    document.getElementById('pcCancel').addEventListener('click', function (e) {
      e.stopPropagation();
      _close();
    });
    _postBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      _submit();
    });
  }

  function _updatePostBtn() {
    var hasTitle = _titleInp.value.trim().length > 2;
    var hasBody = _bodyInp.value.trim().split(/\s+/).filter(Boolean).length >= 3;
    _postBtn.classList.toggle('ready', hasTitle && hasBody);
  }

  function _close() {
    if (_overlay) _overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function _submit() {
    if (!_postBtn.classList.contains('ready')) return;
    var title = _titleInp.value.trim();
    var body = _bodyInp.value.trim();
    var tagObj = TAGS.find(function (t) { return t.cls === _selectedTag; }) || TAGS[0];
    var imgUrl = _imgInp.value.trim();
    var storyTitle = document.getElementById('pcStoryLink').value.trim();

    var post = {
      id: 'user_' + Date.now(),
      name: 'You',
      avatar: 'https://i.pravatar.cc/100?img=32',
      time: 'just now',
      title: title,
      body: body,
      tag: tagObj.label,
      tagClass: tagObj.cls,
      likes: 0,
      comments: 0,
      liked: false,
    };
    if (imgUrl) post.media = imgUrl;
    if (storyTitle) post.story = { title: storyTitle, writer: '', cover: '' };

    if (typeof _onPost === 'function') _onPost(post);
    _close();
    _reset();
  }

  function _reset() {
    _titleInp.value = '';
    _bodyInp.value = '';
    _bodyInp.style.height = 'auto';
    _imgInp.value = '';
    _imgPreview.classList.remove('show');
    document.getElementById('pcStoryLink').value = '';
    _tagBtns.forEach(function (b) { b.classList.remove('sel'); });
    _selectedTag = null;
    document.getElementById('pcTitleCount').textContent = '0 / 120';
    document.getElementById('pcBodyCount').textContent = '0 / 300 words';
    _updatePostBtn();
  }

  /* ── Public API ── */
  function open(opts) {
    _buildDOM();
    _onPost = (opts && opts.onPost) || null;
    _genreName = (opts && opts.genreName) || '';
    if (_genreName) {
      _titleInp.placeholder = 'Start a ' + _genreName + ' discussion…';
    }
    _reset();
    _openTs = Date.now();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { _overlay.classList.add('open'); });
    setTimeout(function () { _titleInp.focus(); }, 350);
  }

  window.PostComposer = { open: open };
})();