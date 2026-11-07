/**
 * component/engagement-creator.js — story-wide poll / prediction / debate creator
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained sheet, same pattern as save-modal.js / dots-menu.js: injects
 * its own CSS + DOM, exposes one global API. Replaces the old window.prompt
 * flow, which was never shippable.
 *
 *   <script src="../component/expiry-chips.js"></script>
 *   <script src="../component/engagement-creator.js"></script>
 *
 *   DroboardEngagementCreator.open({
 *     bookId: 'b1',
 *     bookTitle: 'Bound By Obsession',
 *     kind: 'poll', // optional: pre-select Poll | Prediction | Debate
 *     submit: (payload) => api.createStoryEngagement(bookId, payload), // returns Promise<item>
 *     onCreated: (item) => { books[i].engagements.push(item); render(); },
 *   });
 *
 * `submit` is the host's business: the component never guesses whether the
 * page is demo or live. Omit it and the sheet validates, then hands the
 * payload to onCreated with a local id so demo flows still close the loop.
 *
 * Field limits mirror backend/src/routes/author-engagement.routes.js:
 * question 300, motion 500, option/label 60, options 2-4.
 */
(function () {
  'use strict';
  if (window.__droboardEngagementCreator) return;
  window.__droboardEngagementCreator = true;

  const LIM = { question: 300, motion: 500, opt: 60, label: 60, optMin: 2, optMax: 4 };

  const TYPES = [
    { kind: 'poll', label: 'Poll', icon: 'fa-square-poll-horizontal', hint: 'Readers pick one option.' },
    { kind: 'prediction', label: 'Prediction', icon: 'fa-crystal-ball fa-wand-magic-sparkles', hint: 'Readers call what happens next.' },
    { kind: 'debate', label: 'Debate', icon: 'fa-scale-balanced', hint: 'Readers argue both sides of a motion.' },
  ];

  const CSS = `
    .dec-overlay{position:fixed;inset:0;z-index:1950;background:rgba(10,10,20,.45);display:flex;
      align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s ease}
    .dec-overlay.on{opacity:1;pointer-events:auto}
    .dec-sheet{width:100%;max-width:520px;background:var(--card,#fff);border-radius:18px 18px 0 0;
      max-height:92vh;display:flex;flex-direction:column;transform:translateY(100%);
      transition:transform .26s cubic-bezier(.4,0,.2,1);color:var(--text,#1a1a1a);
      font-family:'Inter',-apple-system,sans-serif;overflow:hidden}
    .dec-overlay.on .dec-sheet{transform:translateY(0)}
    @media(min-width:600px){.dec-overlay{align-items:center;padding:20px}
      .dec-sheet{border-radius:18px;transform:scale(.96);opacity:0;transition:transform .2s,opacity .2s}
      .dec-overlay.on .dec-sheet{transform:scale(1);opacity:1}}

    .dec-head{display:flex;align-items:flex-start;gap:10px;padding:16px 16px 12px;border-bottom:1px solid var(--border,#ebebed)}
    .dec-head-t{font-size:15.5px;font-weight:800;letter-spacing:-.01em}
    .dec-head-s{font-size:11.5px;color:var(--muted,#8e8e93);margin-top:3px;line-height:1.4}
    .dec-x{margin-left:auto;flex:none;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.05);
      color:inherit;font-size:13px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer}
    .dec-body{flex:1;overflow-y:auto;padding:14px 16px 4px}

    .dec-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px}
    .dec-tab{display:flex;flex-direction:column;align-items:center;gap:5px;padding:11px 6px;border-radius:12px;
      border:1.5px solid var(--border,#ebebed);background:var(--l1,#f7f7f8);cursor:pointer;
      font-family:inherit;font-size:11.5px;font-weight:700;color:var(--muted,#8e8e93);transition:.15s}
    .dec-tab i{font-size:14px}
    .dec-tab.on{border-color:var(--acc,#ff2d55);color:var(--acc,#ff2d55);background:rgba(255,45,85,.07)}
    .dec-hint{font-size:11.5px;color:var(--muted,#8e8e93);margin:0 0 12px;line-height:1.45}

    .dec-lbl{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:800;
      letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#8e8e93);margin-bottom:6px}
    .dec-count{font-weight:700;text-transform:none;letter-spacing:0;font-size:10.5px;color:var(--muted,#a8a8ad)}
    .dec-count.over{color:#dc2626}
    .dec-in,.dec-ta{width:100%;padding:11px 12px;border:1.5px solid var(--border,#e5e5e5);border-radius:11px;
      background:var(--l1,#f7f7f8);color:var(--text,#1a1a1a);font-family:inherit;font-size:13.5px;font-weight:500;
      outline:none;transition:border-color .15s;resize:vertical}
    .dec-ta{min-height:74px;line-height:1.5}
    .dec-in:focus,.dec-ta:focus{border-color:var(--acc,#ff2d55);background:var(--card,#fff)}
    .dec-in.err,.dec-ta.err{border-color:#dc2626}

    .dec-opts{margin:4px 0 2px}
    .dec-opt{display:flex;align-items:center;gap:8px;margin-bottom:8px}
    .dec-opt .dec-in{flex:1}
    .dec-opt-n{width:22px;flex:none;text-align:center;font-size:11px;font-weight:800;color:var(--muted,#a8a8ad)}
    .dec-opt-x{flex:none;width:28px;height:28px;border-radius:8px;border:none;background:rgba(0,0,0,.045);
      color:var(--muted,#8e8e93);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .dec-opt-x:disabled{opacity:.35;cursor:not-allowed}
    .dec-add{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;border:1.5px dashed var(--border,#dcdce0);
      background:none;color:var(--acc,#ff2d55);font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;margin-top:2px}
    .dec-add:disabled{opacity:.4;cursor:not-allowed}

    .dec-sides{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .dec-prev{display:flex;gap:8px;margin-top:10px}
    .dec-prev span{flex:1;padding:9px 10px;border-radius:10px;font-size:11.5px;font-weight:700;text-align:center}
    .dec-prev .for{background:var(--success-soft,#e9fbf0);color:var(--success,#22c55e)}
    .dec-prev .ag{background:var(--danger-soft,#fdeaea);color:var(--danger,#ef4444)}

    .dec-err{display:none;align-items:center;gap:7px;margin:12px 0 2px;padding:9px 11px;border-radius:10px;
      background:var(--danger-soft,#fdeaea);color:#b91c1c;font-size:12px;font-weight:600;line-height:1.4}
    .dec-err.on{display:flex}

    .dec-foot{display:flex;gap:9px;padding:12px 16px calc(14px + env(safe-area-inset-bottom,0px));
      border-top:1px solid var(--border,#ebebed);background:var(--card,#fff)}
    .dec-btn{flex:1;padding:12px;border-radius:11px;border:none;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}
    .dec-btn.ghost{background:rgba(0,0,0,.05);color:var(--text,#1a1a1a);flex:0 0 96px}
    .dec-btn.go{background:var(--acc,#ff2d55);color:#fff}
    .dec-btn:disabled{opacity:.55;cursor:not-allowed}
    .dec-btn.go i{margin-right:6px}

    [data-theme="dark"] .dec-sheet{background:#16171d;border-color:rgba(255,255,255,.08);color:#e6e6ea}
    [data-theme="dark"] .dec-head,[data-theme="dark"] .dec-foot{border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .dec-foot{background:#16171d}
    [data-theme="dark"] .dec-in,[data-theme="dark"] .dec-ta{background:#0e0f13;border-color:rgba(255,255,255,.12);color:#e6e6ea}
    [data-theme="dark"] .dec-tab{background:#0e0f13;border-color:rgba(255,255,255,.1);color:#9aa0ab}
    [data-theme="dark"] .dec-tab.on{border-color:#ff4d6d;color:#ff4d6d;background:rgba(255,45,85,.14)}
    [data-theme="dark"] .dec-x,[data-theme="dark"] .dec-opt-x{background:rgba(255,255,255,.08);color:#c0c0c8}
    [data-theme="dark"] .dec-btn.ghost{background:rgba(255,255,255,.08);color:#e6e6ea}
    [data-theme="dark"] .dec-err{background:rgba(239,68,68,.14);color:#fca5a5}
  `;

  let _el = null;
  let _ctx = null;
  let _state = null;

  function _style() {
    if (document.getElementById('dec-style')) return;
    const s = document.createElement('style');
    s.id = 'dec-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function _esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _toast(msg, bad) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    if (window.AuthorDrawer && typeof window.AuthorDrawer.toast === 'function') { window.AuthorDrawer.toast(msg); return; }
    let t = document.getElementById('dec-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'dec-toast';
      t.style.cssText = 'position:fixed;bottom:34px;left:50%;transform:translateX(-50%);background:rgba(26,26,46,.95);' +
        'color:#fff;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;z-index:2000;' +
        'opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;max-width:88vw;overflow:hidden;text-overflow:ellipsis';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = bad ? 'rgba(190,40,40,.96)' : 'rgba(26,26,46,.95)';
    t.style.opacity = '1';
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.style.opacity = '0'; }, 2600);
  }

  function _newState(bookTitle) {
    return {
      kind: 'poll',
      bookTitle: bookTitle || '',
      question: '',
      motion: '',
      opts: ['', ''],
      forText: '',
      againstText: '',
      busy: false,
      error: '',
    };
  }

  function _isDebate() { return _state.kind === 'debate'; }

  function _bodyHtml() {
    const s = _state;
    const tabs = TYPES.map(function (t) {
      return '<button type="button" class="dec-tab' + (t.kind === s.kind ? ' on' : '') + '" data-kind="' + t.kind + '">' +
        '<i class="fas ' + t.icon.split(' ')[0] + '"></i>' + t.label + '</button>';
    }).join('');
    const hint = (TYPES.filter(function (t) { return t.kind === s.kind; })[0] || {}).hint || '';

    let fields = '';
    if (_isDebate()) {
      const over = s.motion.length > LIM.motion;
      fields =
        '<div class="dec-lbl">The motion<span class="dec-count' + (over ? ' over' : '') + '">' +
          s.motion.length + '/' + LIM.motion + '</span></div>' +
        '<textarea class="dec-ta' + (over ? ' err' : '') + '" data-f="motion" ' +
          'placeholder="e.g. Should Ada walk away from the deal?">' + _esc(s.motion) + '</textarea>' +
        '<div class="dec-lbl" style="margin-top:14px">Sides</div>' +
        '<div class="dec-sides">' +
          '<input class="dec-in" data-f="forText" maxlength="' + LIM.label + '" placeholder="For" value="' + _esc(s.forText) + '"/>' +
          '<input class="dec-in" data-f="againstText" maxlength="' + LIM.label + '" placeholder="Against" value="' + _esc(s.againstText) + '"/>' +
        '</div>' +
        '<div class="dec-prev">' +
          '<span class="for">&#10003; ' + _esc(s.forText || 'For') + '</span>' +
          '<span class="ag">&#10007; ' + _esc(s.againstText || 'Against') + '</span>' +
        '</div>';
    } else {
      const over = s.question.length > LIM.question;
      const optHtml = s.opts.map(function (v, i) {
        return '<div class="dec-opt">' +
          '<span class="dec-opt-n">' + (i + 1) + '</span>' +
          '<input class="dec-in' + (v.length > LIM.opt ? ' err' : '') + '" data-opt="' + i + '" maxlength="' + LIM.opt + '" ' +
            'placeholder="' + (i === 0 ? 'Option 1' : 'Option ' + (i + 1)) + '" value="' + _esc(v) + '"/>' +
          '<button type="button" class="dec-opt-x" data-rm="' + i + '" ' +
            (s.opts.length <= LIM.optMin ? 'disabled' : '') + ' aria-label="Remove option">' +
            '<i class="fas fa-xmark"></i></button>' +
        '</div>';
      }).join('');
      fields =
        '<div class="dec-lbl">Question<span class="dec-count' + (over ? ' over' : '') + '">' +
          s.question.length + '/' + LIM.question + '</span></div>' +
        '<textarea class="dec-ta' + (over ? ' err' : '') + '" data-f="question" ' +
          'placeholder="Ask readers something worth answering.">' + _esc(s.question) + '</textarea>' +
        '<div class="dec-lbl" style="margin-top:14px">Options<span class="dec-count">' +
          s.opts.length + '/' + LIM.optMax + '</span></div>' +
        '<div class="dec-opts">' + optHtml + '</div>' +
        '<button type="button" class="dec-add" data-add="1"' + (s.opts.length >= LIM.optMax ? ' disabled' : '') + '>' +
          '<i class="fas fa-plus"></i> Add option</button>';
    }

    const expiry = window.DroboardExpiry
      ? window.DroboardExpiry.field(s.kind === 'prediction' ? 'pred' : s.kind, {})
      : '';

    const err = s.error
      ? '<div class="dec-err on"><i class="fas fa-circle-exclamation"></i><span>' + _esc(s.error) + '</span></div>'
      : '';

    return tabs +
      '<p class="dec-hint">' + _esc(hint) + ' It runs across the whole story, not one chapter.</p>' +
      fields + expiry + err;
  }

  function _render() {
    if (!_el) return;
    const scroll = _el.querySelector('.dec-body');
    const at = scroll ? scroll.scrollTop : 0;
    _el.querySelector('.dec-body').innerHTML = _bodyHtml();
    const foot = _el.querySelector('.dec-foot');
    foot.querySelector('.dec-btn.go').disabled = _state.busy;
    foot.querySelector('.dec-btn.go').innerHTML = _state.busy
      ? '<i class="fas fa-circle-notch fa-spin"></i>Creating'
      : '<i class="fas fa-plus"></i>Create ' + (_isDebate() ? 'debate' : _state.kind === 'prediction' ? 'prediction' : 'poll');
    if (scroll) scroll.scrollTop = at;
  }

  /* Focus is dropped by a full re-render, so only re-render on structural
     changes (tab switch, add/remove option) — never on keystrokes. */
  function _renderSoft() {
    if (!_el) return;
    const s = _state;
    const body = _el.querySelector('.dec-body');
    if (!body) return;
    if (_isDebate()) {
      const ta = body.querySelector('[data-f="motion"]');
      const cnt = body.querySelector('.dec-lbl .dec-count');
      if (ta) ta.classList.toggle('err', s.motion.length > LIM.motion);
      if (cnt) { cnt.textContent = s.motion.length + '/' + LIM.motion; cnt.classList.toggle('over', s.motion.length > LIM.motion); }
      const f = body.querySelector('.dec-prev .for'), a = body.querySelector('.dec-prev .ag');
      if (f) f.innerHTML = '&#10003; ' + _esc(s.forText || 'For');
      if (a) a.innerHTML = '&#10007; ' + _esc(s.againstText || 'Against');
      return;
    }
    const ta = body.querySelector('[data-f="question"]');
    const cnt = body.querySelector('.dec-lbl .dec-count');
    if (ta) ta.classList.toggle('err', s.question.length > LIM.question);
    if (cnt) { cnt.textContent = s.question.length + '/' + LIM.question; cnt.classList.toggle('over', s.question.length > LIM.question); }
  }

  function _validate() {
    const s = _state;
    if (_isDebate()) {
      const m = s.motion.trim();
      if (!m) return 'Write the motion readers will argue.';
      if (m.length > LIM.motion) return 'The motion is over ' + LIM.motion + ' characters.';
      return '';
    }
    const q = s.question.trim();
    if (!q) return 'Ask a question first.';
    if (q.length > LIM.question) return 'The question is over ' + LIM.question + ' characters.';
    const opts = s.opts.map(function (o) { return o.trim(); });
    const blank = opts.some(function (o) { return !o; });
    if (blank) return 'Every option needs text — or remove the empty one.';
    if (new Set(opts).size !== opts.length) return 'Options must be different from each other.';
    if (opts.some(function (o) { return o.length > LIM.opt; })) return 'An option is over ' + LIM.opt + ' characters.';
    return '';
  }

  function _payload() {
    const s = _state;
    const expiresAt = window.DroboardExpiry ? window.DroboardExpiry.expiresAt(s.kind, _el) : null;
    if (_isDebate()) {
      return {
        kind: 'debate',
        motion: s.motion.trim().slice(0, LIM.motion),
        forText: (s.forText || '').trim().slice(0, LIM.label) || 'For',
        againstText: (s.againstText || '').trim().slice(0, LIM.label) || 'Against',
        expiresAt: expiresAt == null ? null : expiresAt,
      };
    }
    return {
      kind: s.kind,
      question: s.question.trim().slice(0, LIM.question),
      opts: s.opts.map(function (o) { return { t: o.trim().slice(0, LIM.opt), v: 0 }; }),
      expiresAt: expiresAt == null ? null : expiresAt,
    };
  }

  function _localId() {
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  async function _submit() {
    if (_state.busy) return;
    const err = _validate();
    _state.error = err;
    if (err) { _render(); return; }
    const payload = _payload();
    _state.busy = true;
    _render();
    try {
      let item = payload;
      if (typeof _ctx.submit === 'function') {
        item = await _ctx.submit(payload);
      }
      // A host submit() that returns nothing still gets a usable row locally.
      const created = Object.assign({}, payload, item || {});
      if (!created.id) created.id = _localId();
      close();
      _toast(_labelFor(created.kind) + ' added to ' + (_ctx.bookTitle || 'this story') + '.');
      if (typeof _ctx.onCreated === 'function') _ctx.onCreated(created);
    } catch (e) {
      _state.busy = false;
      _state.error = (e && e.message && e.message !== 'Failed to fetch')
        ? e.message
        : 'Could not save. Check your connection and try again.';
      _render();
      const go = _el && _el.querySelector('.dec-btn.go');
      if (go) go.disabled = false;
    }
  }

  function _labelFor(kind) {
    return kind === 'debate' ? 'Debate' : kind === 'prediction' ? 'Prediction' : 'Poll';
  }

  function _ensureDom() {
    if (_el) return;
    _style();
    _el = document.createElement('div');
    _el.className = 'dec-overlay';
    _el.innerHTML =
      '<div class="dec-sheet" role="dialog" aria-modal="true" aria-label="Add engagement">' +
        '<div class="dec-head">' +
          '<div>' +
            '<div class="dec-head-t">Add engagement</div>' +
            '<div class="dec-head-s" data-sub></div>' +
          '</div>' +
          '<button type="button" class="dec-x" aria-label="Close"><i class="fas fa-xmark"></i></button>' +
        '</div>' +
        '<div class="dec-body"></div>' +
        '<div class="dec-foot">' +
          '<button type="button" class="dec-btn ghost" data-cancel>Cancel</button>' +
          '<button type="button" class="dec-btn go" data-go></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(_el);

    _el.addEventListener('click', function (e) {
      if (e.target === _el) { close(); return; }

      const tab = e.target.closest('.dec-tab');
      if (tab) { _state.kind = tab.getAttribute('data-kind'); _state.error = ''; _render(); return; }

      const add = e.target.closest('[data-add]');
      if (add) {
        if (_state.opts.length < LIM.optMax) { _state.opts.push(''); _state.error = ''; _render(); }
        return;
      }
      const rm = e.target.closest('[data-rm]');
      if (rm) {
        const i = parseInt(rm.getAttribute('data-rm'), 10);
        if (_state.opts.length > LIM.optMin) { _state.opts.splice(i, 1); _state.error = ''; _render(); }
        return;
      }
      if (e.target.closest('.dec-x') || e.target.closest('[data-cancel]')) { close(); return; }
      if (e.target.closest('[data-go]')) { _submit(); return; }
    });

    _el.addEventListener('input', function (e) {
      const f = e.target.getAttribute && e.target.getAttribute('data-f');
      if (f) { _state[f] = e.target.value; _state.error = ''; _renderSoft(); return; }
      const oi = e.target.getAttribute && e.target.getAttribute('data-opt');
      if (oi != null) { _state.opts[parseInt(oi, 10)] = e.target.value; _state.error = ''; }
    });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function open(opts) {
    const o = opts || {};
    if (!o.bookId) return;
    _ensureDom();
    _ctx = o;
    _state = _newState(o.bookTitle);
    // Picker handed us a kind (Poll / Prediction / Debate) — land on that tab.
    if (o.kind && TYPES.some(function (t) { return t.kind === o.kind; })) _state.kind = o.kind;
    _el.querySelector('[data-sub]').textContent =
      'Readers see this on every chapter of ' + (o.bookTitle || 'your story') + '.';
    _render();
    _el.classList.add('on');
    document.body.style.overflow = 'hidden';
    const first = _el.querySelector('.dec-ta');
    if (first) setTimeout(function () { first.focus(); }, 280);
  }

  function close() {
    if (!_el) return;
    _el.classList.remove('on');
    document.body.style.overflow = '';
    _state = null;
  }

  function isOpen() { return !!_el && _el.classList.contains('on'); }

  window.DroboardEngagementCreator = { open, close, isOpen, LIMITS: LIM, TYPES: TYPES };
})();
