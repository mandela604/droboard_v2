/**
 * debate-args.js — Droboard Debate Argument Component
 * ────────────────────────────────────────────────────
 * Purpose-built for debate.html. Similar to comment-section.js but
 * tailored for debate arguments with side-gating.
 *
 *   const da = DroboardDebateArgs.attach('#argsMount', {
 *     sides: { for: 'For', against: 'Against' },
 *     currentUser: { name:'You', avatar:'https://...', verified:false },
 *     requireSide: true,            // must pick a side before posting
  *     userSide: null,               // 'for' | 'against' | null
  *     args: [...],                  // initial arguments
  *     debateId: null,               // pass the debate id to persist posted
  *                                    // args per debate (localStorage) so counts
  *                                    // stay true across pages
  *     ads: true,                    // show ad slot after 2nd argument
 *     onPost: (arg) => {},
 *     onReply: (parentId, reply) => {},
 *     onVote: (arg, myVote) => {},  // myVote: 1 (up) | -1 (down) | null
 *     onSidePick: (side) => {},     // fired when user picks from picker
 *   });
 *
  *   da.setArgs(list);  da.addArg(text);  da.getArgs();  da.destroy();
  *
  *   Shared seeds + cross-page counts (feeds show live totals):
  *   DroboardDebateArgs.seedArgs()      // fresh copy of the seed arguments
  *   DroboardDebateArgs.countFor(id)    // recursive total incl. user posts
 *
 * Arg shape:
 *   { id, name, avatar, verified, side:'for'|'against', statusRing,
 *     statuses, time, text, up, down, myVote, replies:[...] }
 */
(function () {
  'use strict';
  if (window.__droboardDebateArgs) return;
  window.__droboardDebateArgs = true;

  const CSS = `
    .da-wrap{font-family:'DM Sans',system-ui,sans-serif}
    .da-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
    .da-title{font-size:14px;font-weight:800;color:var(--tx-high,#161616)}
    .da-filter{display:flex;gap:5px}
    .da-filter-btn{font-size:10px;font-weight:700;padding:5px 10px;border-radius:10px;background:var(--l2,#f1f1f1);border:1px solid var(--bd,rgba(0,0,0,.1));color:var(--tx-muted,#666);cursor:pointer;transition:.15s}
    .da-filter-btn.on{background:rgba(255,0,80,.08);border-color:rgba(255,0,80,.25);color:#ff0050}

    /* Side picker */
    .da-side-picker{display:flex;gap:6px;margin-bottom:10px}
    .da-side-chip{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;border-radius:10px;font-size:11.5px;font-weight:700;cursor:pointer;border:1.5px solid var(--bd,rgba(0,0,0,.1));background:var(--l2,#f1f1f1);color:var(--tx-muted,#666);transition:.18s}
    .da-side-chip:active{transform:scale(.97)}
    .da-side-chip.on.for{border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08);color:#0d9668}
    .da-side-chip.on.against{border-color:rgba(248,113,113,.4);background:rgba(248,113,113,.08);color:#dc2626}
    .da-side-hint{font-size:10px;color:var(--tx-muted,#888);margin-bottom:8px;text-align:center}

    /* Argument card */
    .da-list{display:flex;flex-direction:column;gap:8px;padding-bottom:8px}
    .da-item{background:#f7f7f8;border:1px solid var(--bd,rgba(0,0,0,.1));border-radius:10px;overflow:visible}
    .da-item.is-reply{background:var(--l2,#f1f1f1);border-color:var(--bd2,rgba(0,0,0,.05));margin-left:22px}
    .da-item.is-reply .da-inner{padding-left:10px;border-left:2px solid rgba(255,0,80,.1);margin-left:0}
    .da-inner{display:flex;gap:9px;padding:10px 10px 8px}

    /* Avatar with ring + verified badge */
    .da-av-wrap{position:relative;width:32px;height:32px;flex-shrink:0;cursor:pointer}
    .da-av-wrap.has-status{cursor:pointer}
    .da-av-ring{width:32px;height:32px;border-radius:50%;padding:2px}
    .da-av-ring.ring-has{background:conic-gradient(#ff0050,#ff4d7a,#ff7a9a,#ff0050)}
    .da-av-ring.ring-viewed{background:rgba(102,102,102,.75)}
    .da-av-ring.ring-none{background:transparent}
    .da-av-ring-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--l2,#f1f1f1)}
    .da-av-ring-inner img{width:100%;height:100%;object-fit:cover;border-radius:50%}
    .da-av-initial{width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff}
    .da-av-badge{position:absolute;bottom:-1px;right:-1px;width:13px;height:13px;border-radius:50%;background:#38bdf8;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--l1,#fff)}
    .da-av-badge i{font-size:5px;color:#fff}
    .da-av-badge.writer{background:#ff0050}

    /* Body */
    .da-body{flex:1;min-width:0}
    .da-chead{display:flex;align-items:center;gap:5px;margin-bottom:3px;min-width:0;overflow:hidden}
    .da-name{font-size:12px;font-weight:800;color:var(--tx-high,#161616);cursor:pointer;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex-shrink:1}
    .da-name:hover{text-decoration:underline}
    .da-side-tag{font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;flex-shrink:0}
    .da-side-tag.for{background:rgba(52,211,153,.1);color:#0d9668}
    .da-side-tag.against{background:rgba(248,113,113,.1);color:#dc2626}
    .da-time{font-size:10px;color:var(--tx-muted,#888);margin-left:auto;flex-shrink:0;white-space:nowrap}
    .da-dots{font-size:13px;color:var(--tx-muted,#888);cursor:pointer;padding:2px 4px;border-radius:6px;flex-shrink:0;background:none;border:none;font-family:inherit;line-height:1;display:flex;align-items:center}
    .da-dots:active{background:rgba(0,0,0,.06)}
    .da-text{font-size:15px;color:var(--tx-body,#3a3a3a);line-height:1.55;word-break:break-word}
    .da-mention{color:#ff0050;font-weight:700}

    /* Actions */
    .da-actions{display:flex;align-items:center;gap:0;margin-top:5px}
    .da-action-btn{font-size:11px;color:var(--tx-muted,#888);cursor:pointer;display:flex;align-items:center;gap:3px;font-weight:600;padding:3px 7px;border-radius:7px;transition:.15s;user-select:none;background:none;border:none;font-family:inherit}
    .da-action-btn:active{background:rgba(255,0,80,.08)}
    .da-action-btn.liked{color:#ff0050}
    .da-action-btn i{font-size:11px}
    .da-vote-btn{font-size:11px;color:var(--tx-muted,#888);cursor:pointer;display:flex;align-items:center;gap:3px;font-weight:700;padding:3px 7px;border-radius:7px;transition:.15s;user-select:none;background:none;border:none;font-family:inherit}
    .da-vote-btn:active{background:rgba(255,0,80,.08)}
    .da-vote-btn.up.on{color:#22c55e}
    .da-vote-btn.down.on{color:#ef4444}
    .da-vote-btn i{font-size:11px}
    .da-vote-btn span{font-size:11px}

    /* Reply area */
    .da-reply-area{display:none;padding:6px 0 0 14px;border-left:2px solid rgba(255,0,80,.1);margin-left:18px;margin-top:3px}
    .da-reply-area.open{display:flex;gap:7px;align-items:center}
    .da-reply-inp{flex:1;background:var(--l2,#f1f1f1);border:1.5px solid var(--bd,rgba(0,0,0,.1));border-radius:18px;padding:6px 11px;color:var(--tx-high,#161616);font-family:inherit;font-size:11px;outline:none;transition:border-color .2s}
    .da-reply-inp:focus{border-color:rgba(255,0,80,.35)}
    .da-reply-send{background:#ff0050;border:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:#fff;flex-shrink:0}
    .da-reply-send:disabled{background:var(--l2,#f1f1f1);cursor:default}
    .da-reply-av-sm{width:24px;height:24px;border-radius:50%;background:#ff0050;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex-shrink:0}
    .da-reply-av-sm img{width:100%;height:100%;object-fit:cover;border-radius:50%}

    /* View all replies */
    .da-view-replies{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#ff0050;cursor:pointer;padding:8px 0 10px 16px;margin-left:18px;user-select:none;background:none;border:none;font-family:inherit}
    .da-view-replies:active{opacity:.7}
    .da-view-replies i{font-size:10px}

    /* Thread overlay — replies page: same 8px card gap as main .da-list,
       constrained to the .phone column (max 420px, centered) */
    .da-thread-ov{position:fixed;inset:0;z-index:1850;background:rgba(0,0,0,.45);display:none;flex-direction:column;align-items:center;font-family:'DM Sans',system-ui,sans-serif}
    .da-thread-ov.open{display:flex}
    .da-thread-hdr{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 12px;border-bottom:1px solid var(--bd,rgba(0,0,0,.1));flex-shrink:0;background:var(--l1,#fff);width:100%;max-width:420px;margin:0 auto}
    .da-thread-back{width:32px;height:32px;border-radius:50%;background:var(--l2,#f1f1f1);border:1px solid var(--bd,rgba(0,0,0,.1));color:var(--tx-high,#161616);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:13px}
    .da-thread-title{font-size:13px;font-weight:800;color:var(--tx-high,#161616)}
    .da-thread-count{font-size:11px;color:var(--tx-muted,#888)}
    .da-thread-body{flex:1;min-height:0;overflow-y:auto;padding:6px 14px 14px;width:100%;max-width:420px;margin:0 auto;background:var(--l1,#fff);display:flex;flex-direction:column;gap:8px;box-shadow:0 0 50px rgba(0,0,0,.35)}
    .da-thread-composer{flex-shrink:0;padding:8px 14px calc(env(safe-area-inset-bottom,0px) + 12px);border-top:1px solid var(--bd,rgba(0,0,0,.08));background:var(--l1,#fff);display:flex;gap:8px;align-items:center;width:100%;max-width:420px;margin:0 auto}
    .da-thread-input{flex:1;background:var(--l2,#f1f1f1);border:1.5px solid var(--bd,rgba(0,0,0,.1));border-radius:20px;padding:9px 14px;font-size:12px;font-family:inherit;color:var(--tx-high,#161616);outline:none}
    .da-thread-send{background:#ff0050;border:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:#fff;flex-shrink:0}

    /* Ad slot */
    .da-ad-slot{margin:8px 0;padding:10px;border-radius:10px;background:var(--l2,#f1f1f1);border:1px solid var(--bd,rgba(0,0,0,.08))}

    /* Composer */
    .da-composer{display:flex;gap:8px;align-items:center;padding:10px 0;border-top:1px solid var(--bd,rgba(0,0,0,.08));background:var(--l1,#fff);position:sticky;bottom:0;z-index:50}
    .da-composer-input{flex:1;background:var(--l2,#f1f1f1);border:1.5px solid var(--bd,rgba(0,0,0,.1));border-radius:20px;padding:9px 14px;font-size:12.5px;font-family:inherit;color:var(--tx-high,#161616);outline:none;resize:none;max-height:80px}
    .da-composer-input:focus{border-color:rgba(255,0,80,.35)}
    .da-composer-input:disabled{opacity:.5;cursor:not-allowed}
    .da-composer-send{background:#ff0050;border:none;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;color:#fff;flex-shrink:0;transition:.15s}
    .da-composer-send:active{transform:scale(.92)}
    .da-composer-send:disabled{opacity:.35;pointer-events:none}

    /* Gate prompt */
    .da-gate{text-align:center;padding:14px;border-radius:10px;background:var(--l2,#f1f1f1);border:1.5px dashed var(--bd,rgba(0,0,0,.1));cursor:pointer;margin-bottom:10px;transition:.15s}
    .da-gate:active{transform:scale(.98)}
    .da-gate i{font-size:16px;color:#ff0050;margin-bottom:4px;display:block}
    .da-gate-t{font-size:12.5px;font-weight:700;color:var(--tx-high,#161616)}
    .da-gate-s{font-size:11px;color:var(--tx-muted,#888);margin-top:2px}

    .da-empty{text-align:center;padding:28px 14px;color:var(--tx-muted,#888);font-size:12.5px}
    .da-empty i{font-size:24px;margin-bottom:6px;display:block;color:var(--tx-muted,#ccc)}

    /* Dark theme */
    [data-theme="dark"] .da-item{background:#0e0f13;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .da-item.is-reply{background:#13141a;border-color:rgba(255,255,255,.05)}
    [data-theme="dark"] .da-name{color:#e0e0e0}
    [data-theme="dark"] .da-text{color:#c0c0c0}
    [data-theme="dark"] .da-thread-ov{background:#08090c}
    [data-theme="dark"] .da-thread-hdr,[data-theme="dark"] .da-thread-body,[data-theme="dark"] .da-thread-composer{background:#08090c;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .da-av-badge{border-color:#0e0f13}
    [data-theme="dark"] .da-filter-btn,[data-theme="dark"] .da-side-chip{background:#0e0f13;border-color:rgba(255,255,255,.08);color:#aaa}
    [data-theme="dark"] .da-composer-input,[data-theme="dark"] .da-reply-inp,[data-theme="dark"] .da-thread-input{background:#0e0f13;border-color:rgba(255,255,255,.08);color:#e0e0e0}
    [data-theme="dark"] .da-gate{background:#0e0f13;border-color:rgba(255,255,255,.1)}
    [data-theme="dark"] .da-ad-slot{background:#0e0f13;border-color:rgba(255,255,255,.06)}
    [data-theme="dark"] .da-composer{background:#08090c;border-color:rgba(255,255,255,.08)}
  `;

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function mentions(s) { return esc(s).replace(/@([\w_]+)/g, '<span class="da-mention">@$1</span>'); }
  function fmtN(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

  let _stylesDone = false;
  function injectStyles() {
    if (_stylesDone) return; _stylesDone = true;
    const el = document.createElement('style');
    el.id = 'da-styles'; el.textContent = CSS;
    document.head.appendChild(el);
  }

  function attach(root, opts) {
    injectStyles();
    opts = opts || {};
    const rootEl = typeof root === 'string' ? document.querySelector(root) : root;
    if (!rootEl) return null;

    const O = {
      sides: opts.sides || { for: 'For', against: 'Against' },
      currentUser: opts.currentUser || { name: 'You', avatar: null, verified: false },
      debateId: opts.debateId || null,
      requireSide: opts.requireSide !== false,
      userSide: opts.userSide || null,
      ads: opts.ads !== false,
      onPost: opts.onPost || null,
      onReply: opts.onReply || null,
      onVote: opts.onVote || null,
      onSidePick: opts.onSidePick || null,
      onProfileClick: opts.onProfileClick || null,
    };

    let _args = (O.debateId && loadStoredTree(O.debateId)) || (opts.args || []).slice();
    let _filter = 'all';
    let _replyTo = null;
    let _threadId = null;

    /* ── helpers ── */
    function countReplies(a) {
      let n = (a.replies || []).length;
      (a.replies || []).forEach(function (r) { n += countReplies(r); });
      return n;
    }
    function flattenReplies(list, depth) {
      let out = [];
      (list || []).forEach(function (r) {
        out.push({ arg: r, depth: depth });
        out = out.concat(flattenReplies(r.replies, depth + 1));
      });
      return out;
    }
    function findArg(id) {
      function search(list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) return list[i];
          var found = search(list[i].replies || []);
          if (found) return found;
        }
        return null;
      }
      return search(_args);
    }
    /* Viewer list: thread order (top arg → its replies → next top arg),
       deduped by author, rotated to start at the tapped author — same
       cross-person browsing as comment threads and feed rows. */
    function viewerAuthorsFor() {
      var out = [];
      var seen = {};
      function pushA(a) {
        if (!a || !a.statuses || !a.statuses.length || !a.name) return;
        var key = String(a.name) + '|' + String(a.avatar || '');
        if (seen[key]) return;
        seen[key] = true;
        out.push({
          id: 'da_' + a.id, name: a.name, avatar: a.avatar,
          ring: a.statusRing === 'has' ? 'ring-has' : a.statusRing === 'viewed' ? 'ring-viewed' : 'ring-none',
          likes: 0, threads: 0, statuses: a.statuses,
        });
      }
      (function walk(list) {
        (list || []).forEach(function (a) { pushA(a); walk(a.replies || []); });
      })(_args);
      return out;
    }
    function openAuthorsFor(argId) {
      if (typeof window.openStatusViewer !== 'function') return;
      var list = viewerAuthorsFor().slice(0, 50);
      if (!list.length) return;
      var vid = 'da_' + argId;
      var at = -1, i;
      for (i = 0; i < list.length; i++) { if (list[i].id === vid) { at = i; break; } }
      // Deduped author: this arg's id was collapsed into the first card
      // with the same name+avatar — match by author identity instead.
      if (at < 0) {
        var tapped = findArg(argId);
        if (tapped) {
          var key = String(tapped.name) + '|' + String(tapped.avatar || '');
          for (i = 0; i < list.length; i++) {
            if (String(list[i].name) + '|' + String(list[i].avatar || '') === key) { at = i; vid = list[i].id; break; }
          }
        }
      }
      if (at > 0) list.push.apply(list, list.splice(0, at));
      window.openStatusViewer(list, vid);
    }

    /* ── avatar HTML ── */
    function avHTML(a) {
      var hasSt = a.statuses && a.statuses.length;
      var ringCls = !hasSt ? 'ring-none' : a.statusRing === 'has' ? 'ring-has' : a.statusRing === 'viewed' ? 'ring-viewed' : 'ring-none';
      var inner = a.avatar
        ? '<img src="' + esc(a.avatar) + '" alt="" loading="lazy"/>'
        : '<div class="da-av-initial" style="background:' + (a.avatarBg || '#ff0050') + '">' + esc((a.name || '?').charAt(0).toUpperCase()) + '</div>';
      var badge = a.verified
        ? '<div class="da-av-badge' + (a.verified === 'writer' ? ' writer' : '') + '"><i class="fas fa-check"></i></div>'
        : '';
      return '<div class="da-av-wrap' + (hasSt ? ' has-status' : '') + '" data-av-id="' + esc(a.id) + '">' +
        '<div class="da-av-ring ' + ringCls + '"><div class="da-av-ring-inner">' + inner + '</div></div>' + badge +
      '</div>';
    }

    /* ── small avatar chip shown beside the reply input (same as story comments) ── */
    function myAvSm() {
      var u = O.currentUser || {};
      return '<div class="da-reply-av-sm">' + (u.avatar
        ? '<img src="' + esc(u.avatar) + '" alt=""/>'
        : esc((u.name || 'Y').charAt(0).toUpperCase())) + '</div>';
    }

    /* ── arg card HTML ── */
    function argHTML(a, isReply, skipInline) {
      var sideCls = a.side === 'for' ? 'for' : 'against';
      var sideLabel = a.side === 'for' ? '\u2705 ' + O.sides.for : '\u274C ' + O.sides.against;
      var totalR = countReplies(a);
      var h = '<div class="da-item' + (isReply ? ' is-reply' : '') + '" data-arg-id="' + esc(a.id) + '">' +
        '<div class="da-inner">' +
          avHTML(a) +
          '<div class="da-body">' +
            '<div class="da-chead">' +
              '<a class="da-name" data-profile="' + esc(a.name) + '" href="profile.html?u=' + encodeURIComponent(a.name || '') + '">' + esc(a.name) + '</a>' +
              '<span class="da-side-tag ' + sideCls + '">' + sideLabel + '</span>' +
              '<span class="da-time">' + esc(a.time) + '</span>' +
              '<button class="da-dots" data-dots="' + esc(a.id) + '" aria-label="More options"><i class="fas fa-ellipsis-vertical"></i></button>' +
            '</div>' +
            '<div class="da-text">' + mentions(a.text) + '</div>' +
            '<div class="da-actions">' +
              '<button class="da-vote-btn up' + (a.myVote === 1 ? ' on' : '') + '" data-vote-up="' + esc(a.id) + '"><i class="' + (a.myVote === 1 ? 'fas' : 'far') + ' fa-thumbs-up"></i> <span>' + fmtN(a.up) + '</span></button>' +
              '<button class="da-vote-btn down' + (a.myVote === -1 ? ' on' : '') + '" data-vote-down="' + esc(a.id) + '"><i class="' + (a.myVote === -1 ? 'fas' : 'far') + ' fa-thumbs-down"></i> <span>' + fmtN(a.down) + '</span></button>' +
              '<button class="da-action-btn" data-reply="' + esc(a.id) + '"><i class="far fa-comment"></i> Reply</button>' +
              (totalR > 0 ? '<span class="da-action-btn" style="pointer-events:none;color:var(--tx-muted,#aaa)"><i class="fas fa-comments"></i> ' + fmtN(totalR) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="da-reply-area" id="ra-' + esc(a.id) + '">' +
          myAvSm() +
          '<input class="da-reply-inp" placeholder="Replying to @' + esc(a.name) + '…" data-reply-input="' + esc(a.id) + '"/>' +
          '<button class="da-reply-send" data-reply-send="' + esc(a.id) + '" disabled><i class="fas fa-paper-plane"></i></button>' +
        '</div>' +
      '</div>';

      // inline replies (max 2) — skipped in the thread view (it lists them all)
      if (!isReply && !skipInline) {
        var flat = flattenReplies(a.replies, 1);
        if (flat.length > 0) {
          var inline = flat.slice(0, 2);
          inline.forEach(function (f) { h += argHTML(f.arg, true); });
          if (flat.length > 2) {
            h += '<button class="da-view-replies" data-thread="' + esc(a.id) + '"><i class="fas fa-comments"></i> View all ' + flat.length + ' replies</button>';
          }
        }
      }
      return h;
    }

    /* ── render main list ── */
    function render() {
      if (O.debateId) persistTree(O.debateId, _args);
      var list = _args;
      if (_filter !== 'all') list = list.filter(function (a) { return a.side === _filter; });

      var h = '';
      // side picker (top)
      if (O.requireSide) {
        h += '<div class="da-side-picker">' +
          '<button class="da-side-chip for' + (O.userSide === 'for' ? ' on' : '') + '" data-pick-side="for">\u2705 ' + esc(O.sides.for) + '</button>' +
          '<button class="da-side-chip against' + (O.userSide === 'against' ? ' on' : '') + '" data-pick-side="against">\u274C ' + esc(O.sides.against) + '</button>' +
        '</div>';
        if (!O.userSide) h += '<div class="da-side-hint">Pick a side to post your argument</div>';
      }

      // filter
      h += '<div class="da-hdr">' +
        '<div class="da-title">Arguments</div>' +
        '<div class="da-filter">' +
          '<button class="da-filter-btn' + (_filter === 'all' ? ' on' : '') + '" data-filter="all">All</button>' +
          '<button class="da-filter-btn' + (_filter === 'for' ? ' on' : '') + '" data-filter="for">' + esc(O.sides.for) + '</button>' +
          '<button class="da-filter-btn' + (_filter === 'against' ? ' on' : '') + '" data-filter="against">' + esc(O.sides.against) + '</button>' +
        '</div>' +
      '</div>';

      // gate prompt
      if (O.requireSide && !O.userSide) {
        h += '<div class="da-gate" data-open-gate><i class="fas fa-hand-pointer"></i><div class="da-gate-t">Pick a side to join the debate</div><div class="da-gate-s">You must choose a side before posting</div></div>';
      }

      // args
      h += '<div class="da-list">';
      if (O.ads) {
        h += '<div class="da-ad-slot" id="daAdSlot" data-ad-slot="debate:inline" style="display:none"><div class="da-ad-slot-lbl">Sponsored</div></div>';
      }
      if (!list.length) {
        h += '<div class="da-empty"><i class="fas fa-comments"></i>No arguments yet. Be the first!</div>';
      } else {
        list.forEach(function (a, i) {
          h += argHTML(a, false);
        });
      }
      h += '</div>';

      // composer
      h += '<div class="da-composer">' +
        '<textarea class="da-composer-input" id="daComposerInput" rows="1" placeholder="' + (O.userSide ? 'Post your argument\u2026' : 'Pick a side first\u2026') + '"' + (O.userSide ? '' : ' disabled') + '></textarea>' +
        '<button class="da-composer-send" id="daComposerSend"' + (O.userSide ? '' : ' disabled') + '><i class="fas fa-paper-plane"></i></button>' +
      '</div>';

      rootEl.innerHTML = h;
      bindEvents();
      mountAd();
    }

    /* ── ad slot — owned by DroboardAdSlot (unified view-track + ctx) ── */
    function mountAd() {
      var el = rootEl.querySelector('#daAdSlot');
      if (!el) return;
      if (!O.ads) { el.style.display = 'none'; return; }
      if (window.DroboardAdSlot) {
        DroboardAdSlot.mount(el, { slot: 'debate:inline', postId: O.debateId || '' }).then(function (filled) {
          el.style.display = filled ? '' : 'none';
        }).catch(function () { el.style.display = 'none'; });
        return;
      }
      if (el) el.style.display = 'none';
    }

    /* ── thread view ── */
    function openThread(id) {
      _threadId = id;
      var root = findArg(id);
      if (!root) return;
      var flat = flattenReplies(root.replies, 1);

      // root arg only — no inline replies (they're all listed below)
      var rootH = argHTML(root, false, true);

      // flat reply cards
      var repliesH = flat.map(function (f) {
        return '<div class="da-item is-reply" data-arg-id="' + esc(f.arg.id) + '">' +
          '<div class="da-inner">' + avHTML(f.arg) +
            '<div class="da-body">' +
              '<div class="da-chead">' +
                '<a class="da-name" data-profile="' + esc(f.arg.name) + '" href="profile.html?u=' + encodeURIComponent(f.arg.name || '') + '">' + esc(f.arg.name) + '</a>' +
                '<span class="da-side-tag ' + (f.arg.side === 'for' ? 'for' : 'against') + '">' + (f.arg.side === 'for' ? '\u2705 ' + esc(O.sides.for) : '\u274C ' + esc(O.sides.against)) + '</span>' +
                '<span class="da-time">' + esc(f.arg.time) + '</span>' +
                '<button class="da-dots" data-dots="' + esc(f.arg.id) + '" aria-label="More options"><i class="fas fa-ellipsis-vertical"></i></button>' +
              '</div>' +
              '<div class="da-text">' + mentions(f.arg.text) + '</div>' +
              '<div class="da-actions">' +
                '<button class="da-vote-btn up' + (f.arg.myVote === 1 ? ' on' : '') + '" data-vote-up="' + esc(f.arg.id) + '"><i class="' + (f.arg.myVote === 1 ? 'fas' : 'far') + ' fa-thumbs-up"></i> <span>' + fmtN(f.arg.up) + '</span></button>' +
                '<button class="da-vote-btn down' + (f.arg.myVote === -1 ? ' on' : '') + '" data-vote-down="' + esc(f.arg.id) + '"><i class="' + (f.arg.myVote === -1 ? 'fas' : 'far') + ' fa-thumbs-down"></i> <span>' + fmtN(f.arg.down) + '</span></button>' +
                '<button class="da-action-btn" data-reply="' + esc(f.arg.id) + '"><i class="far fa-comment"></i> Reply</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="da-reply-area" id="ra-' + esc(f.arg.id) + '">' +
            myAvSm() +
            '<input class="da-reply-inp" placeholder="Replying to @' + esc(f.arg.name) + '…" data-reply-input="' + esc(f.arg.id) + '"/>' +
            '<button class="da-reply-send" data-reply-send="' + esc(f.arg.id) + '" disabled><i class="fas fa-paper-plane"></i></button>' +
          '</div>' +
        '</div>';
      }).join('');

      var ov = document.createElement('div');
      ov.className = 'da-thread-ov open';
      ov.id = 'daThreadOv';
      ov.innerHTML =
        '<div class="da-thread-hdr">' +
          '<button class="da-thread-back" id="daThreadBack"><i class="fas fa-arrow-left"></i></button>' +
          '<div><div class="da-thread-title">Replies</div><div class="da-thread-count">' + flat.length + ' replies</div></div>' +
        '</div>' +
        '<div class="da-thread-body">' +
          (O.ads ? '<div class="da-ad-slot" id="daThreadAdSlot" data-ad-slot="debate:thread-top" style="display:none;margin:0 0 4px"><div class="da-ad-slot-lbl" style="font-size:9px;font-weight:800;color:var(--tx-muted,#888);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Sponsored</div></div>' : '') +
          rootH + repliesH +
        '</div>' +
        '<div class="da-thread-composer">' +
          '<input class="da-thread-input" id="daThreadInput" placeholder="Write a reply\u2026"/>' +
          '<button class="da-thread-send" id="daThreadSend"><i class="fas fa-paper-plane"></i></button>' +
        '</div>';
      document.body.appendChild(ov);
      document.body.style.overflow = 'hidden';

      // thread-top ad — owned by DroboardAdSlot
      var thAd = ov.querySelector('#daThreadAdSlot');
      if (thAd) {
        if (window.DroboardAdSlot) {
          DroboardAdSlot.mount(thAd, { slot: 'debate:thread-top', postId: O.debateId || '' }).then(function (filled) {
            thAd.style.display = filled ? '' : 'none';
          }).catch(function () { thAd.style.display = 'none'; });
        } else {
          thAd.style.display = 'none';
        }
      }

      // wire events inside the thread overlay
      ov.querySelectorAll('[data-av-id]').forEach(function (av) {
        av.addEventListener('click', function () {
          var a = findArg(av.getAttribute('data-av-id'));
          if (a && a.statuses && a.statuses.length) openAuthorsFor(a.id);
        });
      });
      ov.querySelectorAll('[data-vote-up]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var a = findArg(btn.getAttribute('data-vote-up'));
          if (!a) return;
          if (a.myVote === 1) { a.up--; a.myVote = null; } else { if (a.myVote === -1) a.down--; a.up++; a.myVote = 1; }
          if (O.onVote) O.onVote(a, a.myVote);
          ov.querySelectorAll('[data-vote-up="' + a.id + '"]').forEach(function (b) {
            b.classList.toggle('on', a.myVote === 1);
            b.querySelector('i').className = (a.myVote === 1 ? 'fas' : 'far') + ' fa-thumbs-up';
            b.querySelector('span').textContent = fmtN(a.up);
          });
          ov.querySelectorAll('[data-vote-down="' + a.id + '"]').forEach(function (b) {
            b.classList.toggle('on', a.myVote === -1);
            b.querySelector('i').className = (a.myVote === -1 ? 'fas' : 'far') + ' fa-thumbs-down';
            b.querySelector('span').textContent = fmtN(a.down);
          });
        });
      });
      ov.querySelectorAll('[data-vote-down]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var a = findArg(btn.getAttribute('data-vote-down'));
          if (!a) return;
          if (a.myVote === -1) { a.down--; a.myVote = null; } else { if (a.myVote === 1) a.up--; a.down++; a.myVote = -1; }
          if (O.onVote) O.onVote(a, a.myVote);
          ov.querySelectorAll('[data-vote-up="' + a.id + '"]').forEach(function (b) {
            b.classList.toggle('on', a.myVote === 1);
            b.querySelector('i').className = (a.myVote === 1 ? 'fas' : 'far') + ' fa-thumbs-up';
            b.querySelector('span').textContent = fmtN(a.up);
          });
          ov.querySelectorAll('[data-vote-down="' + a.id + '"]').forEach(function (b) {
            b.classList.toggle('on', a.myVote === -1);
            b.querySelector('i').className = (a.myVote === -1 ? 'fas' : 'far') + ' fa-thumbs-down';
            b.querySelector('span').textContent = fmtN(a.down);
          });
        });
      });
      ov.querySelectorAll('[data-reply]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var rid = btn.getAttribute('data-reply');
          var target = ov.querySelector('[data-reply-input="' + rid + '"]');
          if (!target) return;
          var parent = target.closest('.da-reply-area');
          var wasOpen = parent && parent.classList.contains('open');
          ov.querySelectorAll('.da-reply-area').forEach(function (ra) { ra.classList.remove('open'); });
          if (!wasOpen && parent) {
            parent.classList.add('open');
            target.focus();
          }
        });
      });
      ov.querySelectorAll('[data-reply-input]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var send = ov.querySelector('[data-reply-send="' + inp.getAttribute('data-reply-input') + '"]');
          if (send) send.disabled = !inp.value.trim();
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            var rid = inp.getAttribute('data-reply-input');
            var text = inp.value.trim();
            if (!text) return;
            var parent = findArg(rid);
            if (!parent) return;
            var full = text.charAt(0) === '@' ? text : '@' + parent.name + ' ' + text;
            var reply = makeReply(full, parent.side);
            parent.replies = parent.replies || [];
            parent.replies.push(reply);
            if (O.onReply) O.onReply(parent.id, reply);
            inp.value = '';
            toast('Reply posted!');
            closeThread(); openThread(id);
          }
        });
      });
      ov.querySelectorAll('[data-reply-send]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var rid = btn.getAttribute('data-reply-send');
          var inp = ov.querySelector('[data-reply-input="' + rid + '"]');
          var text = inp ? inp.value.trim() : '';
          if (!text) return;
          var parent = findArg(rid);
          if (!parent) return;
          var full = text.charAt(0) === '@' ? text : '@' + parent.name + ' ' + text;
          var reply = makeReply(full, parent.side);
          parent.replies = parent.replies || [];
          parent.replies.push(reply);
          if (O.onReply) O.onReply(parent.id, reply);
          toast('Reply posted!');
          closeThread(); openThread(id);
        });
      });

      ov.querySelector('#daThreadBack').addEventListener('click', closeThread);
      // dots menu (same wiring as the main list)
      ov.querySelectorAll('[data-dots]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var a = findArg(btn.getAttribute('data-dots'));
          if (!a) return;
          if (window.DroboardDotsMenu) {
            DroboardDotsMenu.open({ id: a.id, name: a.name, noMute: true }, btn);
          }
        });
      });
      // profile links (same wiring as the main list)
      ov.querySelectorAll('[data-profile]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          if (O.onProfileClick) { e.preventDefault(); O.onProfileClick(a.getAttribute('data-profile')); }
        });
      });
      ov.querySelector('#daThreadSend').addEventListener('click', function () {
        var inp = ov.querySelector('#daThreadInput');
        var text = inp.value.trim();
        if (!text) return;
        var reply = makeReply(text, root.side);
        root.replies = root.replies || [];
        root.replies.push(reply);
        if (O.onReply) O.onReply(root.id, reply);
        inp.value = '';
        toast('Reply posted!');
        closeThread();
        render();
        openThread(id);
      });
    }
    function closeThread() {
      var ov = document.getElementById('daThreadOv');
      if (ov) ov.remove();
      document.body.style.overflow = '';
      _threadId = null;
    }

    function makeReply(text, side) {
      return {
        id: 'r' + Date.now() + Math.random().toString(36).slice(2, 6),
        name: O.currentUser.name || 'You',
        avatar: O.currentUser.avatar,
        verified: O.currentUser.verified,
        side: side || O.userSide || 'for',
        statusRing: 'none',
        time: 'Just now',
        text: text,
        up: 0, down: 0, myVote: null,
        replies: [],
      };
    }

    /* ── events ── */
    function bindEvents() {
      // filter
      rootEl.querySelectorAll('[data-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _filter = btn.getAttribute('data-filter');
          render();
        });
      });
      // side pick
      rootEl.querySelectorAll('[data-pick-side]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var side = btn.getAttribute('data-pick-side');
          O.userSide = side;
          if (O.onSidePick) O.onSidePick(side);
          render();
        });
      });
      // gate
      var gate = rootEl.querySelector('[data-open-gate]');
      if (gate) gate.addEventListener('click', function () {
        var picker = rootEl.querySelector('.da-side-picker');
        if (picker) picker.scrollIntoView({ behavior: 'smooth' });
      });
      // vote up/down — update in-place, no full re-render (avoids ad slot flash)
      function refreshVoteBtns(a) {
        rootEl.querySelectorAll('[data-vote-up="' + a.id + '"]').forEach(function (btn) {
          btn.classList.toggle('on', a.myVote === 1);
          btn.querySelector('i').className = (a.myVote === 1 ? 'fas' : 'far') + ' fa-thumbs-up';
          btn.querySelector('span').textContent = fmtN(a.up);
        });
        rootEl.querySelectorAll('[data-vote-down="' + a.id + '"]').forEach(function (btn) {
          btn.classList.toggle('on', a.myVote === -1);
          btn.querySelector('i').className = (a.myVote === -1 ? 'fas' : 'far') + ' fa-thumbs-down';
          btn.querySelector('span').textContent = fmtN(a.down);
        });
      }
      rootEl.querySelectorAll('[data-vote-up]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var a = findArg(btn.getAttribute('data-vote-up'));
          if (!a) return;
          if (a.myVote === 1) { a.up--; a.myVote = null; }
          else { if (a.myVote === -1) a.down--; a.up++; a.myVote = 1; }
          if (O.onVote) O.onVote(a, a.myVote);
          refreshVoteBtns(a);
        });
      });
      rootEl.querySelectorAll('[data-vote-down]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var a = findArg(btn.getAttribute('data-vote-down'));
          if (!a) return;
          if (a.myVote === -1) { a.down--; a.myVote = null; }
          else { if (a.myVote === 1) a.up--; a.down++; a.myVote = -1; }
          if (O.onVote) O.onVote(a, a.myVote);
          refreshVoteBtns(a);
        });
      });
      // avatar → status viewer
      rootEl.querySelectorAll('[data-av-id]').forEach(function (av) {
        av.addEventListener('click', function () {
          var a = findArg(av.getAttribute('data-av-id'));
          if (a && a.statuses && a.statuses.length) openAuthorsFor(a.id);
        });
      });
      // reply toggle
      rootEl.querySelectorAll('[data-reply]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (O.requireSide && !O.userSide) { toast('\u{1F4CC} Pick a side first!'); return; }
          var id = btn.getAttribute('data-reply');
          var target = rootEl.querySelector('[data-reply-input="' + id + '"]');
          if (!target) return;
          var parent = target.closest('.da-reply-area');
          var wasOpen = parent && parent.classList.contains('open');
          rootEl.querySelectorAll('.da-reply-area').forEach(function (ra) { ra.classList.remove('open'); });
          if (!wasOpen && parent) {
            parent.classList.add('open');
            target.focus();
          }
        });
      });
      // reply input enable/disable send
      rootEl.querySelectorAll('[data-reply-input]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var id = inp.getAttribute('data-reply-input');
          var send = rootEl.querySelector('[data-reply-send="' + id + '"]');
          if (send) send.disabled = !inp.value.trim();
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            var id = inp.getAttribute('data-reply-input');
            doReply(id, inp.value.trim());
            inp.value = '';
          }
        });
      });
      // reply send
      rootEl.querySelectorAll('[data-reply-send]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-reply-send');
          var inp = rootEl.querySelector('[data-reply-input="' + id + '"]');
          doReply(id, inp ? inp.value.trim() : '');
          if (inp) inp.value = '';
        });
      });
      // thread
      rootEl.querySelectorAll('[data-thread]').forEach(function (btn) {
        btn.addEventListener('click', function () { openThread(btn.getAttribute('data-thread')); });
      });
      // profile links
      rootEl.querySelectorAll('[data-profile]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          if (O.onProfileClick) { e.preventDefault(); O.onProfileClick(a.getAttribute('data-profile')); }
        });
      });
      // dots menu
      rootEl.querySelectorAll('[data-dots]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var a = findArg(btn.getAttribute('data-dots'));
          if (!a) return;
          if (window.DroboardDotsMenu) {
            DroboardDotsMenu.open({ id: a.id, name: a.name, noMute: true }, btn);
          }
        });
      });
      // composer
      var ci = rootEl.querySelector('#daComposerInput');
      var cs = rootEl.querySelector('#daComposerSend');
      if (ci && cs) {
        ci.addEventListener('input', function () { cs.disabled = !ci.value.trim() || !O.userSide; });
        ci.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doPost(); }
        });
        cs.addEventListener('click', doPost);
      }
    }

    function doReply(parentId, text) {
      if (!text) return;
      if (O.requireSide && !O.userSide) { toast('\u{1F4CC} Pick a side first!'); return; }
      var parent = findArg(parentId);
      if (!parent) return;
      var full = text.charAt(0) === '@' ? text : '@' + parent.name + ' ' + text;
      var reply = makeReply(full, parent.side);
      parent.replies = parent.replies || [];
      parent.replies.push(reply);
      if (O.onReply) O.onReply(parentId, reply);
      render();
      toast('Reply posted!');
    }

    function doPost() {
      var ci = rootEl.querySelector('#daComposerInput');
      var text = ci ? ci.value.trim() : '';
      if (!text) return;
      if (O.requireSide && !O.userSide) { toast('\u{1F4CC} Pick a side first!'); return; }
      var arg = {
        id: 'a' + Date.now(),
        name: O.currentUser.name || 'You',
        avatar: O.currentUser.avatar,
        verified: O.currentUser.verified,
        side: O.userSide,
        statusRing: 'none',
        time: 'Just now',
        text: text,
        up: 0, down: 0, myVote: null,
        replies: [],
      };
      _args.push(arg);
      if (O.onPost) O.onPost(arg);
      if (ci) ci.value = '';
      render();
      toast('Argument posted!');
    }

    function toast(m) {
      if (typeof window.toast === 'function') { window.toast(m); return; }
      var t = document.getElementById('daToast');
      if (!t) {
        t = document.createElement('div'); t.id = 'daToast';
        t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(10px);background:#1a1a2e;color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;z-index:2000;opacity:0;transition:.2s;pointer-events:none;font-family:DM Sans,sans-serif';
        document.body.appendChild(t);
      }
      t.textContent = m; t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
      clearTimeout(t._t); t._t = setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; }, 2200);
    }

    /* ── public API ── */
    var api = {
      setArgs: function (list) { _args = (list || []).slice(); render(); },
      addArg: function (text) {
        if (!text) return;
        var arg = { id: 'a' + Date.now(), name: O.currentUser.name || 'You', avatar: O.currentUser.avatar, side: O.userSide || 'for', time: 'Just now', text: text, up: 0, down: 0, myVote: null, replies: [] };
        _args.push(arg); render(); return arg;
      },
      getArgs: function () { return _args; },
      setUserSide: function (side) { O.userSide = side; render(); },
      getUserSide: function () { return O.userSide; },
      destroy: function () { rootEl.innerHTML = ''; },
    };

    // status-viewer sync — same pattern as people-to-follow.js:
    // chain onto window.onStatusViewerChange, update the ring class directly.
    // An author can appear on several cards (top arg + inline replies), and
    // the viewer dedupes by name+avatar — so update ALL of that author's
    // cards, not just the one whose id happened to be sent back.
    var prevStatusHandler = window.onStatusViewerChange;
    window.onStatusViewerChange = function (wid, ring) {
      if (typeof prevStatusHandler === 'function') { try { prevStatusHandler(wid, ring); } catch (e) {} }
      if (!wid || wid.indexOf('da_') !== 0) return;
      var a = findArg(wid.slice(3));
      if (!a) return;
      var newRing = ring === 'ring-viewed' ? 'viewed' : ring === 'ring-has' ? 'has' : 'none';
      var key = String(a.name) + '|' + String(a.avatar || '');
      (function walk(list) {
        (list || []).forEach(function (x) {
          if (String(x.name) + '|' + String(x.avatar || '') === key) {
            x.statusRing = newRing;
            [rootEl, document.getElementById('daThreadOv')].forEach(function (scopeEl) {
              if (!scopeEl) return;
              scopeEl.querySelectorAll('[data-av-id="' + x.id + '"] .da-av-ring').forEach(function (ringEl) {
                ringEl.className = 'da-av-ring ring-' + newRing;
              });
            });
          }
          walk(x.replies || []);
        });
      })(_args);
    };

    render();
    return api;
  }

  /* ── Shared seed arguments (single source of truth — debate.html
     and every feed card count from these) ── */
  var SEED_V = 1;
  function defaultArgs() {
    return [
      { id: 'a1', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', verified: 'writer', side: 'for', statusRing: 'has', time: '2h', text: 'Every character deserves growth. Redemption arcs are what make stories unforgettable.', up: 48, down: 6, myVote: null,
        statuses: [{ bg: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=500&h=900&fit=crop', quote: '"Writing at 2am has a different energy."', caption: 'Ada_Writes · Live now', time: '20m ago' }],
        replies: [
        { id: 'r1', name: 'Sarah_Odum', avatar: 'https://i.pravatar.cc/100?img=48', verified: true, side: 'for', statusRing: 'has', time: '1h', text: 'Exactly! The journey from darkness to light is what hooks us.', up: 12, down: 1, myVote: null,
          statuses: [{ bg: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg', quote: '"Team Alex or Team Jaxon?"', caption: 'Poll live now', time: '5h ago' }],
          replies: [] },
        { id: 'r2', name: 'Kenji_Tanaka', avatar: 'https://i.pravatar.cc/100?img=60', side: 'for', statusRing: 'none', time: '45m', text: 'Agreed. Without redemption, stories feel hollow.', up: 5, down: 0, myVote: null, replies: [] },
      ]},
      { id: 'a2', name: 'Marcus_Thorn', avatar: 'https://i.pravatar.cc/100?img=15', verified: false, side: 'against', statusRing: 'viewed', time: '1d', text: 'Some actions cross a line. Forcing redemption cheapens the consequences.', up: 62, down: 9, myVote: null,         replies: [
        { id: 'r3', name: 'Luna_Reyes', avatar: 'https://i.pravatar.cc/100?img=25', side: 'against', statusRing: 'has', time: '22h', text: 'Right? If the villain just says sorry, what was the point of the suffering?', up: 18, down: 2, myVote: null,
          statuses: [{ bg: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', quote: '"This story ruined my whole week (in the best way)."', caption: 'Recommending a read', time: '2h ago' }],
          replies: [] },
        { id: 'r5', name: 'Priya_Sharma', avatar: 'https://i.pravatar.cc/100?img=44', verified: true, side: 'against', statusRing: 'viewed', time: '20h', text: 'Consequences are what make choices matter in a story.', up: 9, down: 1, myVote: null, replies: [] },
        { id: 'r6', name: 'Finn_Calloway', avatar: 'https://i.pravatar.cc/100?img=68', side: 'against', statusRing: 'none', time: '18h', text: 'If everyone gets redeemed, nobody is truly dangerous.', up: 14, down: 3, myVote: null, replies: [] },
        { id: 'r7', name: 'Mei_Lin', avatar: 'https://i.pravatar.cc/100?img=31', side: 'against', statusRing: 'has', time: '15h', text: 'The tension dies when you know the villain will be forgiven.', up: 11, down: 2, myVote: null,
          statuses: [{ bg: 'https://i.postimg.cc/N9jY0w4m/5.jpg', quote: '"Some letters are never meant to be sent."', caption: 'Elegy series', time: '6h ago' }],
          replies: [] },
      ]},
      { id: 'a3', name: 'Sarah_Odum', avatar: 'https://i.pravatar.cc/100?img=48', verified: true, side: 'for', statusRing: 'has', time: '3d', text: 'If we don\'t believe people can change, what\'s the point of any story at all?', up: 31, down: 4, myVote: null, replies: [] },
      { id: 'a4', name: 'Luna_Reyes', avatar: 'https://i.pravatar.cc/100?img=25', verified: false, side: 'against', statusRing: 'has', time: '2d', text: 'Villains who get forgiven without real sacrifice aren\'t redeemed — they\'re just excused.', up: 44, down: 7, myVote: null,
        statuses: [{ bg: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', quote: '"This story ruined my whole week (in the best way)."', caption: 'Recommending a read', time: '2h ago' }],
        replies: [] },
      { id: 'a5', name: 'Kenji_Tanaka', avatar: 'https://i.pravatar.cc/100?img=60', verified: false, side: 'for', statusRing: 'none', time: '5d', text: 'The best villains are the ones who mirror the hero. Their redemption is the hero\'s reflection.', up: 27, down: 3, myVote: null, replies: [] },
      { id: 'a6', name: 'Priya_Sharma', avatar: 'https://i.pravatar.cc/100?img=44', verified: true, side: 'for', statusRing: 'viewed', time: '4d', text: 'Redemption doesn\'t mean forgetting. It means choosing to be better despite what you\'ve done.', up: 19, down: 5, myVote: null, replies: [] },
      { id: 'a7', name: 'Diego_Vargas', avatar: 'https://i.pravatar.cc/100?img=53', verified: false, side: 'against', statusRing: 'none', time: '6h', text: 'We hold heroes to impossible standards but villains get a free pass? Nah.', up: 55, down: 8, myVote: null, replies: [] },
      { id: 'a8', name: 'Zara_Okafor', avatar: 'https://i.pravatar.cc/100?img=36', verified: true, side: 'against', statusRing: 'has', time: '1w', text: 'Forgiveness is for the victims to give, not for writers to force on them.', up: 71, down: 11, myVote: null,
        statuses: [
          { bg: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=500&h=900&fit=crop', quote: '"Chapter 21 is finally live — the truth comes out tonight."', caption: 'His Sweet Revenge · New chapter', time: '2h ago' },
          { bg: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', quote: '"I did not expect this ending. Neither will you."', caption: 'Behind the scenes', time: '1h ago' },
        ],
        replies: [
        { id: 'r4', name: 'Diego_Vargas', avatar: 'https://i.pravatar.cc/100?img=53', side: 'against', statusRing: 'none', time: '6d', text: 'This. The victim\'s journey matters more than the villain\'s arc.', up: 22, down: 3, myVote: null, replies: [] },
      ]},
      { id: 'a9', name: 'Finn_Calloway', avatar: 'https://i.pravatar.cc/100?img=68', verified: false, side: 'for', statusRing: 'none', time: '8d', text: 'Some of the greatest characters in fiction started as villains. Imagine robbing readers of that journey.', up: 36, down: 5, myVote: null, replies: [] },
      { id: 'a10', name: 'Mei_Lin', avatar: 'https://i.pravatar.cc/100?img=31', verified: false, side: 'against', statusRing: 'has', time: '3h', text: 'A villain crying at the end doesn\'t erase a hundred chapters of cruelty.', up: 49, down: 6, myVote: null,
        statuses: [{ bg: 'https://i.postimg.cc/N9jY0w4m/5.jpg', quote: '"Some letters are never meant to be sent."', caption: 'Elegy series', time: '6h ago' }],
        replies: [] },
      { id: 'a11', name: 'Omar_Hassan', avatar: 'https://i.pravatar.cc/100?img=57', verified: false, side: 'for', statusRing: 'viewed', time: '9d', text: 'Redemption arcs teach empathy. That\'s literally the point of literature.', up: 22, down: 4, myVote: null, replies: [] },
      { id: 'a12', name: 'Chloe_Bennett', avatar: 'https://i.pravatar.cc/100?img=45', verified: true, side: 'against', statusRing: 'none', time: '5d', text: 'If the villain is truly irredeemable, giving them a soft ending is bad writing.', up: 38, down: 7, myVote: null, replies: [] },
    ];
  }

  /* ── Per-debate persistence (user-posted args survive page changes, so
     feed counts stay true) + cross-page recursive totals ── */
  function storeKey(id) { return 'dro_debate_args_' + id; }
  function loadStoredTree(id) {
    if (!id) return null;
    try {
      var raw = localStorage.getItem(storeKey(id));
      if (!raw) return null;
      var j = JSON.parse(raw);
      if (!j || j.v !== SEED_V || !Array.isArray(j.args)) return null;
      return j.args;
    } catch (e) { return null; }
  }
  function persistTree(id, args) {
    if (!id) return;
    try { localStorage.setItem(storeKey(id), JSON.stringify({ v: SEED_V, args: args || [] })); } catch (e) {}
  }
  function countTree(list) {
    var n = 0;
    (list || []).forEach(function (a) { n += 1 + countTree(a.replies || []); });
    return n;
  }
  function countFor(debateId) {
    return countTree(loadStoredTree(debateId) || defaultArgs());
  }

  window.DroboardDebateArgs = {
    attach: attach,
    seedArgs: function () { return JSON.parse(JSON.stringify(defaultArgs())); },
    countFor: countFor,
  };
})();
