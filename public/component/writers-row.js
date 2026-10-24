/* writers-row.js — one status-aware "Top Writers" row for every page.
   Identities come from DroboardPeople (or a `people` array); rings and
   viewed state come from DroboardStatus.decorateWriters(). */
(function () {
  'use strict';
  if (window.DroboardWritersRow) return;

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _injectStyles() {
    if (document.getElementById('dwr-styles')) return;
    var el = document.createElement('style');
    el.id = 'dwr-styles';
    el.textContent = `
      .dwr-row{--dwr-bd:#ebebed;--dwr-tx:#1a1a1a;--dwr-inner:#fff;--dwr-viewed:#c7c7cc;
        --dwr-none:#e5e5ea;--dwr-acc:#ff0050;--dwr-acc2:#ff4d7a;--dwr-acc3:#ff7a9a;
        padding:14px 0 8px;border-bottom:1px solid var(--dwr-bd);margin-bottom:4px;font-family:inherit}
      .dwr-row.dwr-card{padding:14px 0;border:1px solid var(--dwr-bd);border-radius:14px;
        background:var(--dwr-bg,#fff);margin:0}
      .dwr-head{font-size:12.5px;font-weight:800;margin-bottom:10px;color:var(--dwr-tx)}
      .dwr-scroll{display:flex;gap:16px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
      .dwr-scroll::-webkit-scrollbar{display:none}
      .dwr-writer{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;width:64px;text-align:center}
      .dwr-ring{width:58px;height:58px;border-radius:50%;padding:3px;display:flex;align-items:center;justify-content:center;cursor:pointer}
      .dwr-ring.ring-has,.dwr-ring.ring-live{background:conic-gradient(var(--dwr-acc),var(--dwr-acc2),var(--dwr-acc3),var(--dwr-acc))}
      .dwr-ring.ring-viewed{background:var(--dwr-viewed)}
      .dwr-ring.ring-none{background:var(--dwr-none)}
      .dwr-ring-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--dwr-inner);display:flex;align-items:center;justify-content:center}
      .dwr-avatar{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
      .dwr-name{display:block;font-size:10.5px;font-weight:600;color:var(--dwr-tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}
      [data-theme="dark"] .dwr-row{--dwr-bd:rgba(255,255,255,.08);--dwr-tx:#f0f0f5;--dwr-inner:#0b0b10;
        --dwr-viewed:#3a3a44;--dwr-none:#1a1a24;--dwr-bg:#14141c}
    `;
    document.head.appendChild(el);
  }

  function render(opts) {
    opts = opts || {};
    _injectStyles();

    var people = opts.people;
    if (!people && window.DroboardPeople && typeof window.DroboardPeople.writersFor === 'function') {
      people = window.DroboardPeople.writersFor(opts.key || 'all', opts.limit || 10);
    }
    people = people || [];
    if (!people.length) return '';

    var list = (window.DroboardStatus && typeof window.DroboardStatus.decorateWriters === 'function')
      ? window.DroboardStatus.decorateWriters(people)
      : people;

    var title = opts.title || 'Top Writers';
    var card = opts.variant === 'card' ? ' dwr-card' : '';

    return '<div class="dwr-row' + card + '">' +
      '<div class="dwr-head">' + _esc(title) + '</div>' +
      '<div class="dwr-scroll">' +
      list.map(function (w) {
        var hasStatus = w.statuses && w.statuses.length;
        return '<div class="dwr-writer">' +
          '<div class="dwr-ring ' + (hasStatus ? (w.ring || 'ring-has') : 'ring-none') + '"' +
            (hasStatus ? ' data-writer-status="' + _esc(w.id) + '" data-status-ring="' + _esc(w.id) + '" data-writer-handle="' + _esc(w.handle) + '"' : '') + '>' +
            '<div class="dwr-ring-inner"><img class="dwr-avatar" src="' + _esc(w.avatar) + '" loading="lazy" alt=""/></div>' +
          '</div>' +
          '<a class="dwr-name" href="profile.html?u=' + _esc(w.handle) + '">' + _esc(w.name) + '</a>' +
        '</div>';
      }).join('') +
      '</div></div>';
  }

  window.DroboardWritersRow = { render: render };
})();
