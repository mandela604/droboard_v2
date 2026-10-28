/**
 * expiry-chips.js — one deadline picker for polls, debates & predictions
 * ─────────────────────────────────────────────────────────────────────
 * Mounted wherever an engagement object is created:
 *   · component/post-composer.js        (feed poll / debate)
 *   · component/droboard-post-composer.js (Droboard debate / forum poll)
 *   · services/create-service.js        (chapter poll / prediction / debate)
 *
 * The object it creates carries `expiresAt` (epoch ms) — plus `closed` and
 * `closedAt` once the sweep runs. Production closes these with a server
 * cron; `DroboardExpiry.sweep()` is the same rule on the client.
 */
(function () {
  'use strict';
  if (window.__droboardExpiry) return;
  window.__droboardExpiry = true;

  /* hours; 0 = never closes (debates stay argument threads by default) */
  const SETS = {
    poll:  [6, 24, 72, 168],
    pred:  [24, 72, 168, 336],
    debate: [0, 24, 72, 168],
  };
  const DEFAULTS = { poll: 24, pred: 72, debate: 0 };
  const LABEL = { 0: 'No end', 6: '6h', 24: '24h', 72: '3d', 168: '1 week', 336: '2 weeks', custom: 'Custom' };
  /* the one bump an author gets — past that the result never lands */
  const EXTEND_CAP_MS = 7 * 86400000;
  /* custom deadlines are capped at 90 days out — stale votes help no one */
  const CUSTOM_MAX_MS = 90 * 86400000;

  const CSS = `
    .drbe-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:2px 0 12px}
    .drbe-lbl{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--tx-muted,#6b7280);margin-right:2px}
    .drbe-chip{border:1.5px solid var(--border,#f1f1f1);background:var(--l1,#f8f9fa);color:var(--tx-muted,#6b7280);
      font-family:inherit;font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:16px;cursor:pointer;transition:.15s;white-space:nowrap}
    .drbe-chip.on{border-color:var(--acc,#ff0050);color:var(--acc,#ff0050);background:var(--acc-light,rgba(255,0,80,.08))}
    .drbe-chip:active{transform:scale(.96)}
    .drbe-note{font-size:10.5px;color:var(--tx-faint,#9aa0ab);flex-basis:100%;margin-top:-4px}
    .drbe-live{color:#158a48}.drbe-shut{color:var(--tx-faint,#9aa0ab)}
    .drbe-dt{display:none;flex-basis:100%;margin-top:2px;padding:7px 10px;border:1.5px solid var(--bd,#e5e5e5);border-radius:10px;
      background:var(--l2,#f8f9fa);color:var(--tx-high,#161616);font-family:inherit;font-size:12px;font-weight:600}
    .drbe-dt.show{display:block}
    [data-theme="dark"] .drbe-dt{background:#0e0f13;border-color:rgba(255,255,255,.12);color:#e0e0e0}
    [data-theme="dark"] .drbe-chip{background:#0e0f13;border-color:rgba(255,255,255,.08);color:#9aa0ab}
    [data-theme="dark"] .drbe-chip.on{border-color:var(--acc,#ff0050);color:#ff4d6d;background:rgba(255,0,80,.12)}
  `;
  function _style() {
    if (document.getElementById('drbe-style')) return;
    const s = document.createElement('style');
    s.id = 'drbe-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function _kind(type) { return type === 'prediction' ? 'pred' : (type === 'debate' ? 'debate' : 'poll'); }

  /**
   * field(kind, opts) → markup for the chip row.
   * opts.attrs  extra attributes, e.g. 'data-drbe-ch="12"'
   * opts.hours  preselected hours (editing an existing object)
   * opts.label  overrides the "Closes" caption
   */
  function field(type, opts) {
    _style();
    const kind = _kind(type);
    const set = SETS[kind];
    const o = opts || {};
    /* prefill: an exact stored deadline that no chip matches → Custom selected */
    let customTs = null;
    if (o.expiresAt) {
      const h = Math.round((+o.expiresAt - Date.now()) / 3600000);
      if (!set.some(function (x) { return x !== 0 && Math.abs(x - h) <= 1; })) customTs = +o.expiresAt;
    }
    const picked = customTs != null ? 'custom'
      : (o.hours != null ? o.hours : (o.expiresAt ? hoursFrom(o.expiresAt) : DEFAULTS[kind]));
    return '<div class="drbe-row" data-drbe-kind="' + kind + '" data-drbe-hours="' + picked + '"' +
      (customTs != null ? ' data-drbe-expires="' + customTs + '"' : '') + (o.attrs || '') + '>' +
      '<span class="drbe-lbl">' + (o.label || (kind === 'debate' ? 'Closes' : 'Open for')) + '</span>' +
      set.map(function (h) {
        return '<button type="button" class="drbe-chip' + (h === picked ? ' on' : '') + '" data-h="' + h + '">' + (LABEL[h] || h + 'h') + '</button>';
      }).join('') +
      '<button type="button" class="drbe-chip' + (picked === 'custom' ? ' on' : '') + '" data-h="custom">' + LABEL.custom + '</button>' +
      '<input type="datetime-local" class="drbe-dt' + (picked === 'custom' ? ' show' : '') + '" value="' + (customTs != null ? _toLocalInput(customTs) : '') + '"/>' +
      '<span class="drbe-note">' + noteFor(kind, picked, customTs) + '</span>' +
      '</div>';
  }
  function _toLocalInput(ts) {
    const d = new Date(ts);
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function noteFor(kind, h, customTs) {
    if (h === 'custom') {
      if (customTs == null) return 'Pick any date up to 3 months out.';
      return 'Closes ' + new Date(customTs).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + '.';
    }
    if (kind === 'debate') return h ? 'Arguments keep coming until it closes, then everyone gets the verdict.' : 'Stays open until you settle it — the verdict notification fires when you do.';
    if (h) return 'Votes lock at the deadline and results go out to everyone who took part.';
    return 'Runs until you close it.';
  }

  /* delegated: one listener serves every mount point */
  document.addEventListener('click', function (e) {
    const chip = e.target.closest('.drbe-chip');
    if (!chip) return;
    e.preventDefault();
    const row = chip.closest('.drbe-row'); if (!row) return;
    const isCustom = chip.getAttribute('data-h') === 'custom';
    row.querySelectorAll('.drbe-chip').forEach(function (c) { c.classList.toggle('on', c === chip); });
    const dt = row.querySelector('.drbe-dt');
    const hours = isCustom ? 'custom' : parseInt(chip.getAttribute('data-h'), 10);
    row.setAttribute('data-drbe-hours', hours);
    if (isCustom) {
      if (dt) {
        dt.classList.add('show');
        dt.min = _toLocalInput(Date.now() + 5 * 60000);
        dt.max = _toLocalInput(Date.now() + CUSTOM_MAX_MS);
        if (!dt.value) { dt.value = _toLocalInput(Date.now() + 24 * 3600000); dt.dispatchEvent(new Event('change', { bubbles: true })); return; }
      }
    } else {
      row.removeAttribute('data-drbe-expires');
      if (dt) { dt.classList.remove('show'); }
    }
    _fire(row, isCustom ? (dt && dt.value ? +new Date(dt.value) : null) : null);
  });
  document.addEventListener('change', function (e) {
    const dt = e.target.closest && e.target.closest('.drbe-dt');
    if (!dt) return;
    const row = dt.closest('.drbe-row'); if (!row) return;
    let ts = dt.value ? +new Date(dt.value) : null;
    if (ts != null) {
      const min = Date.now(), max = Date.now() + CUSTOM_MAX_MS;
      if (ts < min) ts = min + 3600000;
      if (ts > max) ts = max;
      dt.value = _toLocalInput(ts);
    }
    if (ts != null) row.setAttribute('data-drbe-expires', ts); else row.removeAttribute('data-drbe-expires');
    row.setAttribute('data-drbe-hours', 'custom');
    _fire(row, ts);
  });
  function _fire(row, customTs) {
    const hours = row.getAttribute('data-drbe-hours');
    const note = row.querySelector('.drbe-note');
    if (note) note.textContent = noteFor(row.getAttribute('data-drbe-kind'), hours, customTs);
    try {
      row.dispatchEvent(new CustomEvent('drbe:change', { bubbles: true,
        detail: { kind: row.getAttribute('data-drbe-kind'), hours: hours === 'custom' ? null : hours,
          expiresAt: customTs != null ? customTs : (hours === 'custom' ? null : undefined),
          custom: hours === 'custom', chId: row.getAttribute('data-drbe-ch') } }));
    } catch (err) {}
  }

  function hoursIn(root, kind) {
    const scope = root || document;
    const row = kind ? scope.querySelector('.drbe-row[data-drbe-kind="' + kind + '"]') : scope.querySelector('.drbe-row');
    if (!row) return null;
    const h = parseInt(row.getAttribute('data-drbe-hours'), 10);
    return isNaN(h) ? null : h;
  }
  /** expiresAt in ms, or null when the object never closes. */
  function expiresAt(type, root) {
    const scope = root || document;
    const kind = _kind(type);
    const row = kind ? scope.querySelector('.drbe-row[data-drbe-kind="' + kind + '"]') : scope.querySelector('.drbe-row');
    if (!row) return null;
    if (row.getAttribute('data-drbe-hours') === 'custom') {
      const ts = parseInt(row.getAttribute('data-drbe-expires'), 10);
      return isNaN(ts) ? null : ts;
    }
    const h = hoursIn(root, kind);
    if (h == null || h === 0) return null;
    return Date.now() + h * 3600000;
  }
  /** hours back out of a stored expiresAt, for prefilling an edit. */
  function hoursFrom(ts) {
    if (!ts) return 0;
    const h = Math.round((+ts - Date.now()) / 3600000);
    if (h <= 0) return 0;
    return h <= 6 ? 6 : h <= 24 ? 24 : h <= 72 ? 72 : h <= 168 ? 168 : 336;
  }

  /* ── display + state ─────────────────────────────────────── */
  function isClosed(obj) { return !!obj && (!!obj.closed || (!!obj.expiresAt && Date.now() > +obj.expiresAt)); }
  function text(obj) {
    _style();
    if (!obj) return '';
    if (isClosed(obj)) return '<span class="drbe-shut"><i class="fas fa-lock" style="font-size:9px"></i> Closed</span>';
    const ts = obj.expiresAt;
    /* no deadline ever set (or "No end") — say nothing rather than "Open" on
       every legacy card */
    if (!ts) return '';
    const ms = +ts - Date.now(), h = ms / 3600000;
    const label = h < 1 ? Math.max(1, Math.round(ms / 60000)) + 'm' : h <= 72 ? Math.round(h) + 'h' : Math.round(h / 24) + 'd';
    return '<span class="drbe-live"><i class="far fa-clock" style="font-size:9px"></i> Closes in ' + label + '</span>';
  }

  /* ── the sweep ─────────────────────────────────────────────
     Closes everything past its deadline and tells the owner what
     landed. Idempotent: a closed object is skipped, and the store
     dedupes on key, so re-running can never double-notify.
     hooks: { isMine: fn(post) -> bool, onChange: fn() }        */
  const NOTIF = {
    poll: 'poll_closed', debate: 'debate_verdict', pred: 'prediction_settled',
  };
  function sweep(posts, hooks) {
    const h = hooks || {};
    let closed = 0;
    (posts || []).forEach(function (p) {
      if (!p || !p.expiresAt || p.closed || Date.now() <= +p.expiresAt) return;
      p.closed = true;
      p.closedAt = +p.expiresAt;
      closed++;
      const kind = p.type === 'debate' ? 'debate' : (p.type === 'prediction' || p.type === 'pred' ? 'pred' : 'poll');
      if (h.isMine && !h.isMine(p)) return;
      notify(p, kind);
    });
    if (closed && h.onChange) { try { h.onChange(); } catch (e) {} }
    return closed;
  }
  function notify(p, kind) {
    if (!window.droNotify) return;
    const id = p.id || 'x';
    const head = String(p.title || p.text || (p.poll && (p.poll.q || p.poll.question)) ||
      (p.prediction && (p.prediction.q || p.prediction.question)) ||
      (p.debateData && (p.debateData.motion || p.debateData.question)) || 'Your post').slice(0, 60);
    if (kind === 'debate') {
      const d = p.debateData || {};
      const f = d.forV || 0, a = d.agV || 0, tot = f + a;
      const fp = tot ? Math.round(f / tot * 100) : 50;
      window.droNotify({ type: 'debate_verdict', key: 'dv:' + id, medal: 'rank',
        title: tot ? (fp >= 50 ? 'FOR won your debate' : 'AGAINST won your debate') : 'Your debate closed',
        desc: head + (tot ? ' — ' + fp + '% landed on the winning side.' : ' — nobody voted, so it closed with no verdict.'),
        metrics: [{ label: 'For', value: fp + '%' }, { label: 'Against', value: (100 - fp) + '%' }, { label: 'Votes', value: String(tot) }],
        link: { label: 'Open debate', href: 'debate.html?id=' + encodeURIComponent(id) } });
      return;
    }
    if (kind === 'pred') {
      const pr = p.prediction || {};
      const opts = pr.opts || [];
      const total = pr.total || opts.reduce(function (n, o) { return n + (o.v || 0); }, 0);
      const top = opts.slice().sort(function (x, y) { return (y.v || 0) - (x.v || 0); })[0];
      window.droNotify({ type: 'prediction_settled', key: 'pred:' + id, medal: 'rank',
        title: total ? 'Your prediction settled' : 'Your prediction closed',
        desc: head + (top ? ' — "' + (top.label || top.t || top.text || 'Option 1') + '" called it.' : ' — no picks came in.'),
        metrics: [{ label: 'Picks', value: String(total) }].concat(opts.slice(0, 2).map(function (o, i) {
          return { label: 'Pick ' + (i + 1), value: (o.v || 0) + '' };
        })),
        link: { label: 'Open prediction', href: 'debate.html?id=' + encodeURIComponent(id) } });
      return;
    }
    const pl = p.poll || {};
    const opts = pl.opts || [];
    const total = pl.total || opts.reduce(function (n, o) { return n + (o.v || 0); }, 0);
    const top = opts.slice().sort(function (x, y) { return (y.v || 0) - (x.v || 0); })[0];
    const tp = total && top ? Math.round((top.v || 0) / total * 100) : 0;
    window.droNotify({ type: 'poll_closed', key: 'poll:' + id,
      title: total ? 'Your poll closed with ' + total.toLocaleString() + ' votes' : 'Your poll closed',
      desc: head + (top ? ' — "' + (top.label || top.t || 'Option 1') + '" won at ' + tp + '%.' : ' — nobody voted.'),
      metrics: [{ label: 'Votes', value: String(total) }].concat(opts.slice(0, 3).map(function (o, i) {
        return { label: String(o.label || o.t || 'Option ' + (i + 1)).slice(0, 14), value: (total ? Math.round((o.v || 0) / total * 100) : 0) + '%' };
      })),
      link: { label: 'See results', href: 'feed.html?id=' + encodeURIComponent(id) } });
  }

  /** one bump, never past the cap — returns a new expiresAt or null if spent. */
  function extend(obj, hours) {
    if (!obj || !obj.expiresAt || obj.extended) return null;
    const next = +obj.expiresAt + hours * 3600000;
    if (next - Date.now() > EXTEND_CAP_MS) return null;
    obj.expiresAt = next;
    obj.extended = true;
    return next;
  }

  window.DroboardExpiry = {
    SETS, DEFAULTS, field, fieldHtml: field,
    hoursIn, expiresAt, hoursFrom, isClosed, text, sweep, extend, noteFor,
  };
})();
