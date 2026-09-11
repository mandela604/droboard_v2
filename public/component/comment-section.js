/**
 * comment-section.js — Droboard Reusable Comment Component (for stories)
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="comment-section.js"></script> in any page. Load
 * order matters for the optional integrations below — put this AFTER:
 *   - reaction-picker.js  (optional — enables full emoji reactions on
 *                           every comment instead of a plain heart/like)
 *   - status-viewer.js    (optional — tapping an avatar with `statuses`
 *                           opens the status viewer)
 *   - share-modal.js      (optional — "Share comment" opens the real
 *                           share sheet instead of a toast)
 * None of these are required. Each is auto-detected at runtime/attach
 * time — omit any of them and the component falls back to its own
 * built-in behaviour.
 *
 *   const cs = DroboardComments.attach('#commentsPlaceholder', {
 *     storyId: 5,
 *     title: 'Comments',
 *     comments: SEED_COMMENTS,      // optional initial data, see shape below
 *     teams: [                      // optional — omit to disable team tags entirely
 *       { id:'a', icon:'💔', name:'Team Ada',    col:'#ff0050' },
 *       { id:'b', icon:'🔥', name:'Team Emeka',  col:'#60a5fa' },
 *       { id:'c', icon:'🕊️', name:'Team Forgive',col:'#34d399' },
 *       { id:'d', icon:'👀', name:'Team Watching',col:'#a78bfa' },
 *     ],
 *     currentUser: { name:'You', avatar:null, team:null },
 *     requireTeam: false,           // true = must pick a team before posting
 *     collapsible: true,            // true = toggle header like reader.html
 *     startOpen: false,
 *
 *     onPost:        (comment) => { ... your API call ... },
 *     onReply:       (parentId, comment) => { ... },
 *     onEdit:        (comment, oldText, newText) => { ... your API call ... },
 *     onLike:        (comment, isLiked) => { ... },               // fallback mode only
 *     onReact:       (comment, reactionId) => { ... },            // fires either way
 *     onDotsAction:  (action, comment) => { ... 'report'|'copy'|'share'|'edit'|'delete'|'follow' },
 *     onTeamPick:    (teamId) => { ... },
 *     onProfileClick:(comment) => { ... },  // override the default location.href='profile.html'
 *     getCommentUrl: (comment) => 'https://yourapp.com/story/5#comment-' + comment.id, // used for Share
 *   });
 *
 *   cs.setComments(newList);   // replace all comments, re-render
 *   cs.addComment('Great chapter!');   // programmatically post as currentUser
 *   cs.getComments();          // read current in-memory state
 *   cs.destroy();              // remove and clean up
 *
 * Comment shape (any field can be omitted):
 *   {
 *     id,                      // unique — auto-assigned if omitted
 *     name, avatar, avatarBg,  // avatarBg used as fallback initial background
 *     verified,                // false | 'writer' | 'reader'
 *     team,                    // one of your teams[].id, or null
 *     statusRing,              // 'has' | 'viewed' | 'none' — draws the ring
 *     statuses,                // [{bg,quote,caption,time}] — enables status-viewer.js on avatar tap
 *     time, text, edited,      // edited is set true automatically after a save
 *     likes, liked,            // only read/written when reaction-picker.js is NOT loaded
 *     rx: { <reactionId>: n, userRx: null },  // reaction-picker's reaction ids when it's loaded
 *     replies: [ ...same shape..., can nest to any depth (reply-to-a-reply) ],
 *   }
 *
 * This component does NOT know about your backend. It keeps its own
 * in-memory comment tree (mutating the objects you pass in) and calls your
 * hooks so the host page can persist changes.
 *
 * ── LIGHT / DARK MODE ─────────────────────────────────────────────────
 * All of this component's colors are CSS custom properties (--dcs-*),
 * defined once with dark defaults and overridden under `body.theme-white`
 * — the exact same class full-reader.html and story.html already toggle
 * for their own light mode. Nothing extra to wire up: if the host page
 * has `<body class="theme-white">` set (or toggles it at runtime), every
 * comment, the thread view, popups, and menus re-theme automatically,
 * since they all read from the same variables. No dark-only hex codes
 * are hardcoded anywhere in this file except the Droboard accent
 * (#ff0050/#ff4d7a), which is intentionally brand-colored in both themes.
 *
 * ── LAYOUT: TEAM PICKER TOP, COMPOSER BOTTOM ─────────────────────────
 * The team picker sits at the TOP of the list (so it reads naturally
 * before you scroll through comments); the "add a comment" input sits
 * at the BOTTOM (chat-style). Picking a team smooth-scrolls the compose
 * box into view so it's obvious where your tag will be used. New
 * top-level comments are appended (not prepended) and scroll into view.
 *
 * ── REPLY PAGINATION & THE THREAD VIEW ────────────────────────────────
 * A top-level comment shows its replies inline ONLY while it has 2 or
 * fewer (counting every descendant, no matter how deeply nested — a
 * reply-to-a-reply still counts). Once a top-level comment has MORE
 * than 2 replies total, the inline list is capped at the first 2 and
 * followed by a "View all N replies" control showing the full count.
 * Tapping it opens a full-screen thread view with: the original
 * comment, every one of its replies flattened to a single indentation
 * level (regardless of real nesting depth), and its own team picker +
 * composer pinned to the bottom for adding more replies to that thread.
 *
 * ── EDITING ────────────────────────────────────────────────────────────
 * Any comment posted by `currentUser.name` gets an "Edit" option in its
 * 3-dot menu alongside Delete. Editing swaps the comment text for an
 * inline input with Save/Cancel controls (Enter saves, Escape cancels).
 * A saved edit sets `comment.edited = true` and shows an "(edited)" tag.
 *
 * ── REACTIONS ──────────────────────────────────────────────────────────
 * If `reaction-picker.js` is loaded before this file, every comment's
 * like/react control is rendered and driven by DroboardReactionPicker
 * (tap = love, hold = full emoji popup) instead of this file's simpler
 * built-in heart + reaction-bubble system. Reaction state lives on
 * `comment.rx`, shared through a small internal registry so it keeps
 * working correctly across the main list, the thread view, and as many
 * comment-section instances as you attach.
 *
 * ── SHARING ────────────────────────────────────────────────────────────
 * The 3-dot menu's "Share comment" action opens `window.openShareModal`
 * (from share-modal.js) pre-filled with the comment author, an excerpt
 * of the comment text, and a URL (from `options.getCommentUrl`, falling
 * back to the current page URL + a #comment-<id> anchor). Without
 * share-modal.js loaded, it falls back to the old "link copied" toast.
 *
 * ── AVATAR vs USERNAME TAPS ───────────────────────────────────────────
 * Tapping an avatar that HAS `statuses` opens the status viewer; an
 * avatar with no statuses does nothing (no toast, no navigation).
 * Tapping the USERNAME always navigates to profile.html (or calls your
 * `options.onProfileClick` hook instead, if you supply one).
 */

(function () {
  'use strict';

  if (window.__droboardCommentSection) return;
  window.__droboardCommentSection = true;

  // ══════════════════════════════════════════════════════════════════════
  // CSS  (dcs- prefixed, self-contained)
  // ──────────────────────────────────────────────────────────────────────
  // Every color below is a var(--dcs-*) custom property. Dark-mode values
  // are declared once in :root; body.theme-white overrides them for light
  // mode — same convention used by story.html / full-reader.html, so this
  // component re-themes automatically wherever it's dropped in.
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    :root{
      --dcs-bg:#0a0a0d; --dcs-card:#111318; --dcs-surface:rgba(255,255,255,.03); --dcs-surface2:#1a1b22;
      --dcs-tx:#e0e0e0; --dcs-muted:#a1a1aa; --dcs-muted2:#71717a; --dcs-muted3:#3f3f46;
      --dcs-bd:rgba(255,255,255,.07); --dcs-bd2:rgba(255,255,255,.04); --dcs-hover:rgba(255,255,255,.05);
      --dcs-ring-viewed:#3f3f46;
      --dcs-shadow-sm:rgba(0,0,0,.3); --dcs-shadow-md:rgba(0,0,0,.9); --dcs-shadow-lg:rgba(0,0,0,.95);
      --dcs-acc:#ff0050; --dcs-acc2:#ff4d7a;
    }
    body.theme-white{
      --dcs-bg:#f5f5f5; --dcs-card:#ffffff; --dcs-surface:rgba(0,0,0,.03); --dcs-surface2:#ececec;
      --dcs-tx:#1a1a1a; --dcs-muted:#555555; --dcs-muted2:#888888; --dcs-muted3:#cfcfd4;
      --dcs-bd:rgba(0,0,0,.08); --dcs-bd2:rgba(0,0,0,.04); --dcs-hover:rgba(0,0,0,.04);
      --dcs-ring-viewed:#d4d4d8;
      --dcs-shadow-sm:rgba(0,0,0,.08); --dcs-shadow-md:rgba(0,0,0,.16); --dcs-shadow-lg:rgba(0,0,0,.18);
    }

    .dcs-wrap{font-family:'DM Sans',system-ui,sans-serif;color:var(--dcs-tx);}
    .dcs-toggle{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;padding:12px 14px;background:var(--dcs-card);border:1.5px solid var(--dcs-bd);border-radius:12px;transition:.18s;}
    .dcs-toggle:active{transform:scale(.99)}
    .dcs-toggle-icon{width:32px;height:32px;border-radius:50%;background:var(--dcs-bg);border:1px solid var(--dcs-bd);display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--dcs-muted);flex-shrink:0}
    .dcs-toggle-label{flex:1;font-size:12px;font-weight:700;color:var(--dcs-muted)}
    .dcs-toggle-count{font-size:10px;font-weight:700;color:var(--dcs-muted2);background:var(--dcs-bg);padding:2px 8px;border-radius:999px}
    .dcs-toggle-arrow{font-size:11px;color:var(--dcs-muted2);transition:transform .25s}
    .dcs-toggle-arrow.open{transform:rotate(180deg)}
    .dcs-body{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(.4,0,.2,1),opacity .3s;opacity:0}
    .dcs-body.open{max-height:none;opacity:1}
    .dcs-body.no-toggle{max-height:none;opacity:1;overflow:visible}

    /* Team picker — top of the list */
    .dcs-team-picker{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:12px 0 4px;}
    .dcs-team-picker::-webkit-scrollbar{display:none}
    .dcs-team-chip{flex-shrink:0;display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:999px;font-size:10.5px;font-weight:700;cursor:pointer;border:1.5px solid var(--dcs-bd);background:var(--dcs-surface);color:var(--dcs-muted);transition:.18s;white-space:nowrap;}
    .dcs-team-chip:active{transform:scale(.95)}
    .dcs-team-chip.on{color:#fff;box-shadow:0 2px 10px var(--dcs-shadow-sm)}
    .dcs-team-hint{font-size:9.5px;color:var(--dcs-muted2);padding:0 0 6px;}

    /* Input row — bottom composer */
    .dcs-input-row{display:flex;gap:9px;align-items:flex-start;padding:12px 0 4px;border-top:1px solid var(--dcs-bd2);margin-top:6px}
    .dcs-input-av{width:34px;height:34px;border-radius:50%;flex-shrink:0;background:rgba(255,0,80,.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;overflow:hidden}
    .dcs-input-av img{width:100%;height:100%;object-fit:cover}
    .dcs-input-wrap{flex:1;background:var(--dcs-card);border:1.5px solid var(--dcs-bd);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:8px}
    .dcs-input{flex:1;background:transparent;border:none;outline:none;color:var(--dcs-tx);font-family:inherit;font-size:12px}
    .dcs-input::placeholder{color:var(--dcs-muted2)}
    .dcs-send-btn{background:var(--dcs-acc);color:#fff;border:none;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;flex-shrink:0;transition:.15s}
    .dcs-send-btn:active{transform:scale(.9)}
    .dcs-send-btn:disabled{background:var(--dcs-surface2);cursor:default}

    /* List */
    .dcs-list{display:flex;flex-direction:column;gap:0}
    .dcs-item{position:relative}
    .dcs-inner{display:flex;gap:9px;padding:10px 0 0}
    .dcs-item.is-reply .dcs-inner{padding-left:16px;border-left:2px solid rgba(255,0,80,.12);margin-left:18px}

    .dcs-av-wrap{position:relative;width:32px;height:32px;flex-shrink:0;cursor:pointer}
    .dcs-av-ring{width:32px;height:32px;border-radius:50%;padding:2px}
    .dcs-av-ring.ring-has{background:conic-gradient(#ff0050,#ff4d7a,#ff7a9a,#ff0050)}
    .dcs-av-ring.ring-viewed{background:var(--dcs-ring-viewed)}
    .dcs-av-ring.ring-none{background:transparent}
    .dcs-av-ring-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--dcs-card)}
    .dcs-av-ring-inner img{width:100%;height:100%;object-fit:cover;border-radius:50%}
    .dcs-av-initial{width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff}

    .dcs-cbody{flex:1;min-width:0}
    .dcs-chead{display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap}
    .dcs-name{font-size:11px;font-weight:800;color:var(--dcs-tx);cursor:pointer}
    .dcs-verified{width:13px;height:13px;border-radius:50%;background:#38bdf8;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
    .dcs-verified i{font-size:6px;color:#fff}
    .dcs-verified.writer{background:#ff0050}
    .dcs-team-tag{font-size:7.5px;font-weight:800;padding:2px 7px;border-radius:999px;letter-spacing:.03em;white-space:nowrap;border:1px solid transparent}
    .dcs-time{font-size:9px;color:var(--dcs-muted2)}
    .dcs-edited-tag{font-size:9px;color:var(--dcs-muted2);font-style:italic}
    .dcs-text{font-size:11.5px;color:var(--dcs-muted);line-height:1.55;word-break:break-word}
    .dcs-text .dcs-mention{color:var(--dcs-acc);font-weight:700}

    /* Inline edit form */
    .dcs-edit-row{display:flex;gap:7px;align-items:center;padding:2px 0 6px}
    .dcs-edit-inp{flex:1;background:var(--dcs-card);border:1.5px solid rgba(255,0,80,.35);border-radius:18px;padding:7px 12px;color:var(--dcs-tx);font-family:inherit;font-size:11.5px;outline:none}
    .dcs-edit-btn{width:26px;height:26px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;flex-shrink:0;transition:.15s}
    .dcs-edit-btn:active{transform:scale(.9)}
    .dcs-edit-save{background:var(--dcs-acc);color:#fff}
    .dcs-edit-cancel{background:var(--dcs-surface2);color:var(--dcs-muted)}

    /* Fallback reaction bubble (only rendered when reaction-picker.js is absent) */
    .dcs-rx-bubble{display:inline-flex;align-items:center;gap:2px;background:var(--dcs-card);border:1px solid var(--dcs-bd);border-radius:999px;padding:1px 6px;margin-top:4px;cursor:pointer;font-size:11px;color:var(--dcs-muted)}
    .dcs-rx-bubble.has-rx{border-color:rgba(255,0,80,.3);background:rgba(255,0,80,.1)}

    .dcs-actions{display:flex;align-items:center;gap:0;margin-top:5px;flex-wrap:wrap}
    .dcs-action-btn{font-size:10px;color:var(--dcs-muted2);cursor:pointer;display:flex;align-items:center;gap:3px;font-weight:600;padding:3px 7px;border-radius:7px;transition:.15s;user-select:none}
    .dcs-action-btn:active{background:rgba(255,0,80,.1)}
    .dcs-action-btn.liked{color:var(--dcs-acc)}
    .dcs-action-btn i{font-size:11px}

    /* Fallback reaction popup (only used without reaction-picker.js) */
    .dcs-rx-popup{position:absolute;left:0;bottom:100%;z-index:400;background:var(--dcs-bg);border:1px solid var(--dcs-bd);border-radius:30px;padding:6px 8px;display:none;flex-direction:row;gap:2px;box-shadow:0 8px 24px var(--dcs-shadow-md);animation:dcsRxPop .18s cubic-bezier(.34,1.56,.64,1)}
    .dcs-rx-popup.show{display:flex}
    @keyframes dcsRxPop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
    .dcs-rx-btn{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 5px;border-radius:10px;cursor:pointer;transition:.14s;user-select:none}
    .dcs-rx-btn:active{transform:scale(.85)}
    .dcs-rx-btn.picked{background:rgba(255,0,80,.12)}
    .dcs-rx-em{font-size:20px;line-height:1}
    .dcs-rx-ct{font-size:7.5px;font-weight:700;color:var(--dcs-muted2);min-width:14px;text-align:center}
    .dcs-rx-btn.picked .dcs-rx-ct{color:#ff7a9a}

    .dcs-dots-btn{margin-left:auto;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--dcs-muted2);cursor:pointer;flex-shrink:0;transition:.15s}
    .dcs-dots-btn:active{background:var(--dcs-card);color:var(--dcs-tx)}
    .dcs-dots-menu{position:fixed;z-index:1900;background:var(--dcs-bg);border:1px solid var(--dcs-bd);border-radius:12px;padding:5px;min-width:170px;box-shadow:0 8px 32px var(--dcs-shadow-lg);display:none}
    .dcs-dots-menu.open{display:block}
    .dcs-dots-item{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;font-size:12px;font-weight:600;color:var(--dcs-muted);cursor:pointer;transition:.12s}
    .dcs-dots-item:active{background:var(--dcs-hover);color:var(--dcs-tx)}
    .dcs-dots-item.danger{color:#f87171}
    .dcs-dots-item i{font-size:12px;width:14px;text-align:center}
    .dcs-dots-sep{height:1px;background:var(--dcs-bd2);margin:3px 8px}
    .dcs-menu-overlay{position:fixed;inset:0;z-index:1898;display:none}
    .dcs-menu-overlay.on{display:block}

    .dcs-reply-area{display:none;padding:6px 0 0 16px;border-left:2px solid rgba(255,0,80,.12);margin-left:18px;margin-top:3px}
    .dcs-reply-area.open{display:flex;gap:7px;align-items:center}
    .dcs-reply-av-sm{width:24px;height:24px;border-radius:50%;background:var(--dcs-acc);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex-shrink:0}
    .dcs-reply-inp{flex:1;background:var(--dcs-card);border:1.5px solid var(--dcs-bd);border-radius:18px;padding:6px 11px;color:var(--dcs-tx);font-family:inherit;font-size:11px;outline:none;transition:border-color .2s}
    .dcs-reply-inp:focus{border-color:rgba(255,0,80,.35)}
    .dcs-reply-send{background:var(--dcs-acc);border:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:#fff;flex-shrink:0}
    .dcs-reply-send:disabled{background:var(--dcs-card);cursor:default}
    .dcs-sep{height:1px;background:var(--dcs-bd2);margin:2px 0}

    .dcs-empty{text-align:center;padding:28px 14px;color:var(--dcs-muted2)}
    .dcs-empty i{font-size:26px;margin-bottom:8px;display:block;color:var(--dcs-muted3)}
    .dcs-empty p{font-size:11.5px;line-height:1.5}

    /* "View all N replies" control */
    .dcs-view-replies{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--dcs-acc2);cursor:pointer;padding:8px 0 10px 16px;margin-left:18px;user-select:none}
    .dcs-view-replies:active{opacity:.7}
    .dcs-view-replies i{font-size:10px}

    /* ── Thread view — full-screen flattened reply page ── */
    .dcs-thread-ov{position:fixed;inset:0;z-index:1850;background:var(--dcs-bg);display:none;flex-direction:column;font-family:'DM Sans',system-ui,sans-serif;color:var(--dcs-tx)}
    .dcs-thread-ov.open{display:flex}
    .dcs-thread-sheet{display:flex;flex-direction:column;height:100%;min-height:0}
    .dcs-thread-hdr{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 12px;border-bottom:1px solid var(--dcs-bd);flex-shrink:0}
    .dcs-thread-back{width:32px;height:32px;border-radius:50%;background:var(--dcs-surface2);border:none;color:var(--dcs-tx);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:13px;transition:.15s}
    .dcs-thread-back:active{transform:scale(.9);background:var(--dcs-hover)}
    .dcs-thread-title{font-size:13px;font-weight:800;color:var(--dcs-tx)}
    .dcs-thread-body{flex:1;min-height:0;overflow-y:auto;padding:6px 14px 14px;-webkit-overflow-scrolling:touch}
    .dcs-thread-composer{flex-shrink:0;padding:0 14px calc(env(safe-area-inset-bottom,0px) + 12px);border-top:1px solid var(--dcs-bd2);background:var(--dcs-bg)}
    .dcs-thread-composer .dcs-team-picker{padding-top:10px}
    .dcs-thread-composer .dcs-input-row{border-top:none;margin-top:0}

    /* Built-in fallback toast (used only if the host page has no window.toast) */
    .dcs-fallback-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(14px);background:var(--dcs-card);border:1px solid var(--dcs-bd);color:var(--dcs-tx);padding:8px 18px;border-radius:24px;font-size:12px;font-weight:600;z-index:2200;opacity:0;transition:.26s;pointer-events:none;white-space:nowrap;font-family:'DM Sans',sans-serif;box-shadow:0 4px 20px var(--dcs-shadow-sm);}
    .dcs-fallback-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  `;

  // Default reactions — only used as a fallback when reaction-picker.js
  // is NOT loaded. When it IS loaded, DroboardReactionPicker.REACTIONS
  // is the single source of truth for every comment's reaction ids.
  const DEFAULT_REACTIONS = [
    { id: 'cry',    e: '😭', label: 'Crying' },
    { id: 'broken', e: '💔', label: 'Heartbroken' },
    { id: 'shock',  e: '😱', label: 'Shocked' },
    { id: 'emo',    e: '🥹', label: 'Emotional' },
    { id: 'savage', e: '🔥', label: 'Savage' },
    { id: 'twist',  e: '🫢', label: 'Plot Twist' },
  ];

  // ══════════════════════════════════════════════════════════════════════
  // Utils
  // ══════════════════════════════════════════════════════════════════════
  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _escAttr(s) { return _esc(s).replace(/"/g, '&quot;'); }
  function _mentions(s) { return _esc(s).replace(/@([\w_]+)/g, '<span class="dcs-mention">@$1</span>'); }
  function _fmtN(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function _hexToRgba(hex, a) {
    hex = (hex || '#ff0050').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substr(0, 2), 16) || 0;
    const g = parseInt(hex.substr(2, 2), 16) || 0;
    const b = parseInt(hex.substr(4, 2), 16) || 0;
    return `rgba(${r},${g},${b},${a})`;
  }
  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    // Fallback toast — styled entirely via the .dcs-fallback-toast class
    // above, so it re-themes with the rest of the component instead of
    // carrying its own hardcoded dark colors.
    let el = document.getElementById('dcsToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dcsToast';
      el.className = 'dcs-fallback-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.classList.remove('show'); }, 2400);
  }

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'dcs-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  // ── Optional reaction-picker.js integration ─────────────────────────
  // Detected at runtime, not required. When present, every comment-section
  // instance shares ONE global DroboardReactionPicker.attach() binding
  // (it's a page-wide singleton) plus a small registry mapping each
  // "namespace::commentId" key back to the live comment object, so
  // reactions stay in sync across the main list, the thread view, and
  // however many comment-section instances you attach.
  function _rpAvailable() { return typeof window.DroboardReactionPicker !== 'undefined'; }

  function _ensureReactionPickerBound() {
    if (!_rpAvailable() || window.__dcsRPBound) return;
    window.__dcsRPBound = true;
    window.__dcsRPRegistry = window.__dcsRPRegistry || {};
    window.DroboardReactionPicker.attach(document.body, {
      getState(key) {
        const entry = window.__dcsRPRegistry[key];
        return entry ? entry.comment.rx : { userRx: null };
      },
      onReact(key, rid) {
        const entry = window.__dcsRPRegistry[key];
        if (!entry) return;
        const c = entry.comment;
        if (c.rx.userRx === rid) {
          c.rx[rid] = Math.max(0, (c.rx[rid] || 0) - 1);
          c.rx.userRx = null;
        } else {
          if (c.rx.userRx) c.rx[c.rx.userRx] = Math.max(0, (c.rx[c.rx.userRx] || 0) - 1);
          c.rx[rid] = (c.rx[rid] || 0) + 1;
          c.rx.userRx = rid;
        }
        if (typeof entry.onReact === 'function') entry.onReact(c, rid);
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Instance factory — each attach() call gets its own isolated state
  // ══════════════════════════════════════════════════════════════════════
  let _idCounter = 1000;
  let _instanceCounter = 0;

  function _newRx(reactions) {
    const o = { userRx: null };
    reactions.forEach(r => (o[r.id] = 0));
    return o;
  }

  function attach(target, options) {
    options = options || {};
    _injectStyles();
    _ensureReactionPickerBound();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[DroboardComments] Target not found:', target); return null; }

    const instId = 'dcs' + (++_instanceCounter);
    const TEAMS = options.teams || [];
    const REACTIONS = _rpAvailable() ? window.DroboardReactionPicker.REACTIONS : (options.reactions || DEFAULT_REACTIONS);
    const currentUser = Object.assign({ name: 'You', avatar: null, team: null }, options.currentUser || {});
    let comments = (options.comments || []).map(_normalize);
    let open = !options.collapsible || !!options.startOpen;
    let pickedTeam = currentUser.team || null;
    let activeRxPopupId = null;   // fallback-mode reaction popup, format "ns:cid"
    let openDotsId = null;
    let editingId = null;
    let threadOpenId = null;      // id of the top-level comment shown in the thread view, or null

    function _normalize(c) {
      c = Object.assign({
        id: ++_idCounter, name: 'Anonymous', avatar: null, avatarBg: null,
        verified: false, team: null, statusRing: 'none', statuses: null,
        time: 'Just now', text: '', edited: false, likes: 0, liked: false, replies: [],
      }, c);
      c.rx = Object.assign(_newRx(REACTIONS), c.rx || {});
      c.replies = (c.replies || []).map(_normalize);
      return c;
    }

    // ── Build shell: team picker at TOP, list, composer at BOTTOM ──
    container.innerHTML = `
      <div class="dcs-wrap" id="${instId}">
        ${options.collapsible ? `
        <div class="dcs-toggle" data-dcs-toggle>
          <div class="dcs-toggle-icon"><i class="fas fa-comment-dots"></i></div>
          <div class="dcs-toggle-label">${_esc(options.title || 'Comments')}</div>
          <div class="dcs-toggle-count" data-dcs-count>0</div>
          <div class="dcs-toggle-arrow${open ? ' open' : ''}" data-dcs-arrow><i class="fas fa-chevron-down"></i></div>
        </div>` : ''}
        <div class="dcs-body${open ? ' open' : ''}${options.collapsible ? '' : ' no-toggle'}" data-dcs-body>
          ${TEAMS.length ? `
          <div class="dcs-team-hint">${options.requireTeam ? 'Pick a side to comment' : 'Tag your side (optional)'}</div>
          <div class="dcs-team-picker" data-dcs-teams></div>` : ''}
          <div class="dcs-list" data-dcs-list></div>
          <div class="dcs-input-row">
            <div class="dcs-input-av" data-dcs-my-av>${currentUser.avatar ? `<img src="${currentUser.avatar}"/>` : (currentUser.name || '?')[0].toUpperCase()}</div>
            <div class="dcs-input-wrap">
              <input class="dcs-input" data-dcs-input placeholder="${_esc(options.placeholder || 'Add a comment…')}" autocomplete="off"/>
              <button class="dcs-send-btn" data-dcs-send disabled><i class="fas fa-paper-plane"></i></button>
            </div>
          </div>
        </div>
      </div>`;

    const root       = container.querySelector('#' + instId);
    const bodyEl      = root.querySelector('[data-dcs-body]');
    const listEl      = root.querySelector('[data-dcs-list]');
    const inputEl     = root.querySelector('[data-dcs-input]');
    const sendBtn     = root.querySelector('[data-dcs-send]');
    const teamsWrapEl = root.querySelector('[data-dcs-teams]');
    const countEl     = root.querySelector('[data-dcs-count]');
    const arrowEl     = root.querySelector('[data-dcs-arrow]');
    const toggleEl    = root.querySelector('[data-dcs-toggle]');

    // ── Thread view overlay (built once, appended to <body> so it can
    //     be truly full-screen regardless of where the container sits) ──
    const threadWrap = document.createElement('div');
    threadWrap.innerHTML = `
      <div class="dcs-thread-ov" id="${instId}-threadov">
        <div class="dcs-thread-sheet">
          <div class="dcs-thread-hdr">
            <button class="dcs-thread-back" id="${instId}-threadback"><i class="fas fa-arrow-left"></i></button>
            <div class="dcs-thread-title" id="${instId}-threadtitle">Replies</div>
          </div>
          <div class="dcs-thread-body" id="${instId}-threadbody"></div>
          <div class="dcs-thread-composer">
            ${TEAMS.length ? `
            <div class="dcs-team-hint">${options.requireTeam ? 'Pick a side to reply' : 'Tag your side (optional)'}</div>
            <div class="dcs-team-picker" id="${instId}-tv-teams"></div>` : ''}
            <div class="dcs-input-row">
              <div class="dcs-input-av">${currentUser.avatar ? `<img src="${currentUser.avatar}"/>` : (currentUser.name || '?')[0].toUpperCase()}</div>
              <div class="dcs-input-wrap">
                <input class="dcs-input" id="${instId}-threadinput" placeholder="Reply to this thread…" autocomplete="off"/>
                <button class="dcs-send-btn" id="${instId}-threadsend" disabled><i class="fas fa-paper-plane"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    const threadOv       = threadWrap.firstElementChild;
    document.body.appendChild(threadOv);
    const threadBackBtn  = document.getElementById(instId + '-threadback');
    const threadBodyEl   = document.getElementById(instId + '-threadbody');
    const threadTitleEl  = document.getElementById(instId + '-threadtitle');
    const threadInputEl  = document.getElementById(instId + '-threadinput');
    const threadSendBtn  = document.getElementById(instId + '-threadsend');
    const threadTeamsEl  = document.getElementById(instId + '-tv-teams');

    // ── Team picker (rendered in BOTH the top of the main list and the
    //     bottom of the thread composer — same underlying selection) ──
    function teamChipsHtml() {
      return TEAMS.map(t => `
        <div class="dcs-team-chip${pickedTeam === t.id ? ' on' : ''}" data-team="${t.id}"
             style="${pickedTeam === t.id ? `background:${_hexToRgba(t.col, .22)};border-color:${t.col}` : ''}">
          ${t.icon} ${t.name}
        </div>`).join('');
    }
    function bindTeamChips(wrapEl, onPick) {
      if (!wrapEl) return;
      wrapEl.querySelectorAll('.dcs-team-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          pickedTeam = pickedTeam === chip.dataset.team ? (options.requireTeam ? pickedTeam : null) : chip.dataset.team;
          currentUser.team = pickedTeam;
          renderAllTeamPickers();
          if (typeof options.onTeamPick === 'function') options.onTeamPick(pickedTeam);
          const t = TEAMS.find(x => x.id === pickedTeam);
          if (t) _toast(t.icon + ' You picked ' + t.name);
          if (onPick) onPick();
        });
      });
    }
    function renderAllTeamPickers() {
      if (!TEAMS.length) return;
      if (teamsWrapEl) teamsWrapEl.innerHTML = teamChipsHtml();
      if (threadTeamsEl) threadTeamsEl.innerHTML = teamChipsHtml();
      bindTeamChips(teamsWrapEl, () => inputEl.closest('.dcs-input-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      bindTeamChips(threadTeamsEl, () => threadInputEl?.closest('.dcs-input-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    renderAllTeamPickers();

    // ── Count comments recursively (also used per-comment for the
    //     "more than 2 replies" pagination threshold) ──
    function countAll(list) {
      return list.reduce((n, c) => n + 1 + countAll(c.replies || []), 0);
    }
    function refreshCount() {
      if (countEl) countEl.textContent = _fmtN(countAll(comments));
    }

    // Flatten every descendant of a comment (any depth) into one array,
    // in depth-first order — this is what powers the "single indentation"
    // preview/thread-view rendering.
    function flattenReplies(c) {
      const out = [];
      (function walk(list) { list.forEach(r => { out.push(r); walk(r.replies || []); }); })(c.replies || []);
      return out;
    }

    // ── Team tag / verified badge / avatar builders ──
    function teamTag(teamId) {
      if (!teamId) return '';
      const t = TEAMS.find(x => x.id === teamId);
      if (!t) return '';
      return `<span class="dcs-team-tag" style="color:${t.col};background:${_hexToRgba(t.col, .15)};border-color:${_hexToRgba(t.col, .35)}">${t.icon} ${_esc(t.name)}</span>`;
    }
    function verifiedBadge(v) {
      if (!v) return '';
      if (v === 'writer') return `<span class="dcs-verified writer" title="Verified Writer"><i class="fas fa-check"></i></span>`;
      return `<span class="dcs-verified" title="Verified"><i class="fas fa-check"></i></span>`;
    }
    function ringClass(r) { return r === 'has' ? 'ring-has' : r === 'viewed' ? 'ring-viewed' : 'ring-none'; }
    function buildAvatar(c) {
      const ring = ringClass(c.statusRing);
      const inner = c.avatar
        ? `<img src="${c.avatar}" loading="lazy"/>`
        : `<div class="dcs-av-initial" style="background:${c.avatarBg || 'rgba(255,0,80,.25)'}">${(c.name || '?')[0].toUpperCase()}</div>`;
      return `<div class="dcs-av-wrap" data-dcs-avatar="${c.id}"><div class="dcs-av-ring ${ring}"><div class="dcs-av-ring-inner">${inner}</div></div></div>`;
    }

    // ── Find helpers ──
    function findById(list, id) {
      for (const c of list) {
        if (c.id === id) return c;
        const r = findById(c.replies || [], id);
        if (r) return r;
      }
      return null;
    }
    function removeById(list, id) {
      const i = list.findIndex(x => x.id === id);
      if (i > -1) { list.splice(i, 1); return true; }
      for (const c of list) { if (removeById(c.replies || [], id)) return true; }
      return false;
    }

    // ── Reaction popup + bubble (FALLBACK ONLY — used when reaction-picker.js isn't loaded) ──
    function rxBubble(c) {
      const total = Object.entries(c.rx).filter(([k]) => k !== 'userRx').reduce((a, [, v]) => a + v, 0);
      if (!total) return '';
      const top = REACTIONS.filter(r => c.rx[r.id] > 0).sort((a, b) => c.rx[b.id] - c.rx[a.id]).slice(0, 3).map(r => r.e).join('');
      return `<div class="dcs-rx-bubble${c.rx.userRx ? ' has-rx' : ''}" data-dcs-rxbubble="${c.id}">${top || '❤️'} <span style="font-size:9px;font-weight:700">${total}</span></div>`;
    }
    function rxPopup(c, ns) {
      return `<div class="dcs-rx-popup" id="${ns}-rxp-${c.id}">${REACTIONS.map(r => `
        <div class="dcs-rx-btn${c.rx.userRx === r.id ? ' picked' : ''}" data-dcs-rxpick="${c.id}" data-rid="${r.id}">
          <span class="dcs-rx-em">${r.e}</span><span class="dcs-rx-ct">${c.rx[r.id] || ''}</span>
        </div>`).join('')}</div>`;
    }

    // ── Like/react control — uses DroboardReactionPicker when available,
    //     otherwise falls back to this file's own heart + popup. ──
    function renderReactionBubble(c) {
      if (_rpAvailable()) return ''; // reaction-picker's trigger shows its own top-3 + total
      return rxBubble(c);
    }
    function renderLikeTrigger(c, ns) {
      if (_rpAvailable()) {
        return window.DroboardReactionPicker.renderTrigger(ns + '::' + c.id, { icon: 'heart' });
      }
      return `${rxPopup(c, ns)}<div class="dcs-action-btn dcs-like-btn${c.liked ? ' liked' : ''}" data-dcs-like="${c.id}">
        <i class="${c.liked ? 'fas' : 'far'} fa-heart"></i> ${_fmtN(c.likes)}
      </div>`;
    }

    // ── Keep the global reaction registry in sync with whatever this
    //     instance currently has rendered under a given namespace ──
    function registerReactionsFor(ns, list) {
      if (!_rpAvailable()) return;
      const reg = window.__dcsRPRegistry;
      const prefix = ns + '::';
      Object.keys(reg).forEach(k => { if (k.indexOf(prefix) === 0) delete reg[k]; });
      list.forEach(c => {
        reg[prefix + c.id] = {
          comment: c,
          onReact: (cc, rid) => { if (typeof options.onReact === 'function') options.onReact(cc, rid); },
        };
      });
    }
    function registerMainReactions() {
      const all = [];
      (function walk(list) { list.forEach(c => { all.push(c); walk(c.replies || []); }); })(comments);
      registerReactionsFor(instId, all);
    }

    // ── One comment "card" — reused for the main list, reply previews,
    //     and every row in the thread view. `ns` namespaces this card's
    //     element ids (and reaction key) so the same comment can be
    //     rendered in more than one place without id collisions. ──
    function renderCommentCard(c, ns, isReply) {
      const isEditing = editingId === c.id;
      return `
        <div class="dcs-item${isReply ? ' is-reply' : ''}" id="${ns}-ci-${c.id}">
          <div class="dcs-inner">
            ${buildAvatar(c)}
            <div class="dcs-cbody">
              <div class="dcs-chead">
                <span class="dcs-name" data-dcs-nameclick="${c.id}">${_esc(c.name)}</span>
                ${verifiedBadge(c.verified)}
                ${teamTag(c.team)}
                <span class="dcs-time">${_esc(c.time)}</span>
                ${c.edited ? `<span class="dcs-edited-tag">(edited)</span>` : ''}
              </div>
              ${isEditing ? `
              <div class="dcs-edit-row">
                <input class="dcs-edit-inp" id="${ns}-cei-${c.id}" value="${_escAttr(c.text)}"/>
                <button class="dcs-edit-btn dcs-edit-save" data-dcs-editsave="${c.id}"><i class="fas fa-check"></i></button>
                <button class="dcs-edit-btn dcs-edit-cancel" data-dcs-editcancel="${c.id}"><i class="fas fa-xmark"></i></button>
              </div>` : `
              <div class="dcs-text">${_mentions(c.text)}</div>
              ${renderReactionBubble(c)}
              <div class="dcs-actions" style="position:relative">
                ${renderLikeTrigger(c, ns)}
                <div class="dcs-action-btn" data-dcs-replybtn="${c.id}"><i class="fas fa-reply"></i> Reply</div>
                <div class="dcs-dots-btn" data-dcs-dots="${c.id}"><i class="fas fa-ellipsis-vertical"></i></div>
              </div>`}
            </div>
          </div>
          <div class="dcs-reply-area" id="${ns}-cra-${c.id}">
            <div class="dcs-reply-av-sm">${(currentUser.name || 'Y')[0].toUpperCase()}</div>
            <input class="dcs-reply-inp" id="${ns}-cri-${c.id}" placeholder="Replying to @${_esc(c.name)}…"/>
            <button class="dcs-reply-send" id="${ns}-crs-${c.id}" disabled data-dcs-replysend="${c.id}"><i class="fas fa-paper-plane"></i></button>
          </div>
          <div class="dcs-sep"></div>
        </div>`;
    }

    // ── A top-level comment + its (possibly paginated) replies ──
    function renderTopLevelBlock(c) {
      const ns = instId;
      const total = countAll(c.replies || []);
      let html = renderCommentCard(c, ns, false);
      if (total > 2) {
        const flat = flattenReplies(c).slice(0, 2);
        html += flat.map(r => renderCommentCard(r, ns, true)).join('');
        html += `<div class="dcs-view-replies" data-dcs-viewthread="${c.id}"><i class="fas fa-turn-down"></i> View all ${total} replies</div>`;
      } else if (total > 0) {
        html += flattenReplies(c).map(r => renderCommentCard(r, ns, true)).join('');
      }
      return html;
    }

    function render() {
      registerMainReactions();
      if (!comments.length) {
        listEl.innerHTML = `<div class="dcs-empty"><i class="fas fa-comment-slash"></i><p>No comments yet.<br/>Be the first to say something.</p></div>`;
      } else {
        listEl.innerHTML = comments.map(c => renderTopLevelBlock(c)).join('');
      }
      refreshCount();
      attachReplyInputListeners(instId, listEl);
      attachEditInputListeners(instId);
    }

    // Re-renders the main list and, if a thread is currently open,
    // the thread view too — call this after any mutation.
    function syncAll() {
      render();
      if (threadOpenId !== null) renderThreadBody();
    }

    function attachReplyInputListeners(ns, scopeEl) {
      scopeEl.querySelectorAll('[id^="' + ns + '-cri-"]').forEach(inp => {
        const cid = parseInt(inp.id.split('-').pop(), 10);
        const btn = document.getElementById(ns + '-crs-' + cid);
        if (btn) inp.oninput = () => { btn.disabled = inp.value.trim().length < 1; };
        inp.onkeydown = e => { if (e.key === 'Enter') submitReply(ns, cid); };
      });
    }

    function attachEditInputListeners(ns) {
      if (editingId === null) return;
      const inp = document.getElementById(ns + '-cei-' + editingId);
      if (!inp) return;
      inp.onkeydown = e => {
        if (e.key === 'Enter') saveEdit(ns, editingId);
        else if (e.key === 'Escape') cancelEdit();
      };
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }

    // ── Thread view ──
    function renderThreadBody() {
      if (threadOpenId === null) return;
      const c = findById(comments, threadOpenId);
      if (!c) { closeThread(); return; }
      const ns = instId + '-tv';
      const flat = flattenReplies(c);
      threadTitleEl.textContent = flat.length ? `${flat.length} repl${flat.length === 1 ? 'y' : 'ies'}` : 'Replies';
      threadBodyEl.innerHTML = renderCommentCard(c, ns, false) + flat.map(r => renderCommentCard(r, ns, true)).join('');
      registerReactionsFor(ns, [c, ...flat]);
      attachReplyInputListeners(ns, threadBodyEl);
      attachEditInputListeners(ns);
    }
    function openThread(topId) {
      closeDots();
      threadOpenId = topId;
      renderThreadBody();
      threadOv.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeThread() {
      threadOpenId = null;
      threadOv.classList.remove('open');
      document.body.style.overflow = '';
    }
    function postThreadReply() {
      if (threadOpenId === null) return;
      const text = threadInputEl.value.trim();
      if (!text) return;
      if (TEAMS.length && options.requireTeam && !pickedTeam) { _toast('Pick a side first'); return; }
      const parent = findById(comments, threadOpenId);
      if (!parent) return;
      const c = _normalize({
        name: currentUser.name, avatar: currentUser.avatar, avatarBg: currentUser.avatarBg,
        verified: currentUser.verified || false, team: pickedTeam, statusRing: 'none',
        time: 'Just now', text, likes: 0, liked: false, replies: [],
      });
      parent.replies = parent.replies || [];
      parent.replies.push(c);
      threadInputEl.value = ''; threadSendBtn.disabled = true;
      syncAll();
      if (typeof options.onReply === 'function') options.onReply(threadOpenId, c);
      _toast('💬 Reply posted!');
      setTimeout(() => document.getElementById(instId + '-tv-ci-' + c.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    }
    threadBackBtn.addEventListener('click', closeThread);
    threadInputEl.addEventListener('input', () => { threadSendBtn.disabled = threadInputEl.value.trim().length < 1; });
    threadInputEl.addEventListener('keydown', e => { if (e.key === 'Enter') postThreadReply(); });
    threadSendBtn.addEventListener('click', postThreadReply);

    // ── Post / reply ──
    function postTop() {
      const text = inputEl.value.trim();
      if (!text) return;
      if (TEAMS.length && options.requireTeam && !pickedTeam) { _toast('Pick a side first'); return; }
      const c = _normalize({
        name: currentUser.name, avatar: currentUser.avatar, avatarBg: currentUser.avatarBg,
        verified: currentUser.verified || false, team: pickedTeam, statusRing: 'none',
        time: 'Just now', text, likes: 0, liked: false, replies: [],
      });
      comments.push(c);
      inputEl.value = ''; sendBtn.disabled = true;
      syncAll();
      if (typeof options.onPost === 'function') options.onPost(c);
      _toast('💬 Comment posted!');
      setTimeout(() => document.getElementById(instId + '-ci-' + c.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    }
    function submitReply(ns, parentId) {
      const inp = document.getElementById(ns + '-cri-' + parentId);
      if (!inp || !inp.value.trim()) return;
      const parent = findById(comments, parentId);
      if (!parent) return;
      const text = inp.value.trim();
      const full = text.startsWith('@') ? text : `@${parent.name} ${text}`;
      const c = _normalize({
        name: currentUser.name, avatar: currentUser.avatar, avatarBg: currentUser.avatarBg,
        verified: currentUser.verified || false, team: pickedTeam, statusRing: 'none',
        time: 'Just now', text: full, likes: 0, liked: false, replies: [],
      });
      parent.replies = parent.replies || [];
      parent.replies.push(c);
      inp.value = '';
      document.getElementById(ns + '-cra-' + parentId)?.classList.remove('open');
      syncAll();
      if (typeof options.onReply === 'function') options.onReply(parentId, c);
      _toast('💬 Reply posted!');
      setTimeout(() => document.getElementById(ns + '-ci-' + c.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    }

    // ── Edit ──
    function startEdit(cid) {
      const c = findById(comments, cid);
      if (!c) return;
      closeDots();
      editingId = cid;
      syncAll();
    }
    function cancelEdit() {
      editingId = null;
      syncAll();
    }
    function saveEdit(ns, cid) {
      const inp = document.getElementById(ns + '-cei-' + cid);
      if (!inp) return;
      const newText = inp.value.trim();
      if (!newText) { _toast("Comment can't be empty"); return; }
      const c = findById(comments, cid);
      if (!c) return;
      const oldText = c.text;
      c.text = newText;
      c.edited = true;
      editingId = null;
      syncAll();
      if (typeof options.onEdit === 'function') options.onEdit(c, oldText, newText);
      _toast('✏️ Comment updated!');
    }

    // ── Like / react (FALLBACK ONLY — used when reaction-picker.js isn't loaded) ──
    function toggleLike(cid) {
      const c = findById(comments, cid); if (!c) return;
      c.liked = !c.liked; c.likes += c.liked ? 1 : -1;
      syncAll();
      if (typeof options.onLike === 'function') options.onLike(c, c.liked);
    }
    function pickReaction(cid, rid) {
      const c = findById(comments, cid); if (!c) return;
      if (c.rx.userRx === rid) { c.rx[rid] = Math.max(0, (c.rx[rid] || 0) - 1); c.rx.userRx = null; }
      else {
        if (c.rx.userRx) c.rx[c.rx.userRx] = Math.max(0, (c.rx[c.rx.userRx] || 0) - 1);
        c.rx[rid] = (c.rx[rid] || 0) + 1; c.rx.userRx = rid;
      }
      activeRxPopupId = null;
      syncAll();
      if (typeof options.onReact === 'function') options.onReact(c, rid);
    }
    function toggleRxPopup(cid, ns) {
      const key = ns + ':' + cid;
      if (activeRxPopupId && activeRxPopupId !== key) {
        const [pns, pcid] = activeRxPopupId.split(':');
        document.getElementById(pns + '-rxp-' + pcid)?.classList.remove('show');
      }
      const pop = document.getElementById(ns + '-rxp-' + cid);
      if (!pop) return;
      const wasOpen = pop.classList.contains('show');
      pop.classList.toggle('show', !wasOpen);
      activeRxPopupId = wasOpen ? null : key;
    }

    // ── 3-dot menu ──
    function closeDots() {
      if (openDotsId !== null) {
        document.getElementById(instId + '-dotsmenu')?.remove();
        document.getElementById(instId + '-menuov')?.classList.remove('on');
        openDotsId = null;
      }
    }
    function openDots(cid, triggerEl) {
      if (openDotsId === cid) { closeDots(); return; }
      closeDots();
      openDotsId = cid;
      const c = findById(comments, cid);
      const isOwn = c && c.name === currentUser.name;
      let overlay = document.getElementById(instId + '-menuov');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = instId + '-menuov';
        overlay.className = 'dcs-menu-overlay';
        overlay.addEventListener('click', closeDots);
        document.body.appendChild(overlay);
      }
      overlay.classList.add('on');
      const menu = document.createElement('div');
      menu.className = 'dcs-dots-menu open';
      menu.id = instId + '-dotsmenu';
      menu.innerHTML = `
        <div class="dcs-dots-item" data-act="report"><i class="fas fa-flag"></i> Report</div>
        <div class="dcs-dots-item" data-act="copy"><i class="fas fa-copy"></i> Copy text</div>
        <div class="dcs-dots-item" data-act="share"><i class="fas fa-share-alt"></i> Share comment</div>
        <div class="dcs-dots-sep"></div>
        ${isOwn
          ? `<div class="dcs-dots-item" data-act="edit"><i class="fas fa-pen"></i> Edit</div>
             <div class="dcs-dots-item danger" data-act="delete"><i class="fas fa-trash"></i> Delete</div>`
          : `<div class="dcs-dots-item" data-act="follow"><i class="fas fa-user-plus"></i> Follow @${_esc(c?.name || '')}</div>`}`;
      document.body.appendChild(menu);
      const rect = triggerEl.getBoundingClientRect();
      let top = rect.bottom + 4, left = rect.right - 175;
      if (left < 8) left = 8;
      if (top + 180 > window.innerHeight) top = rect.top - 185;
      menu.style.top = top + 'px'; menu.style.left = left + 'px';
      menu.querySelectorAll('.dcs-dots-item').forEach(item => {
        item.addEventListener('click', () => { dotAction(item.dataset.act, cid); closeDots(); });
      });
    }
    function dotAction(action, cid) {
      const c = findById(comments, cid);
      if (action === 'report') _toast('🚩 Comment reported.');
      else if (action === 'copy') { navigator.clipboard?.writeText(c?.text || '').catch(() => {}); _toast('📋 Copied!'); }
      else if (action === 'share') {
        if (typeof window.openShareModal === 'function') {
          const excerpt = c?.text ? (c.text.length > 90 ? c.text.slice(0, 90) + '…' : c.text) : '';
          const url = typeof options.getCommentUrl === 'function'
            ? options.getCommentUrl(c)
            : (location.href.split('#')[0] + '#comment-' + cid);
          window.openShareModal({
            title: c ? `${c.name}'s comment` : 'Comment',
            sub: excerpt,
            img: c && c.avatar ? c.avatar : null,
            url,
          });
        } else {
          _toast('📤 Share link copied!');
        }
      }
      else if (action === 'edit') startEdit(cid);
      else if (action === 'delete') {
        removeById(comments, cid);
        if (threadOpenId === cid) closeThread();
        syncAll();
        _toast('🗑️ Comment deleted.');
      }
      else if (action === 'follow') _toast(`✅ Following @${c?.name}!`);
      if (typeof options.onDotsAction === 'function') options.onDotsAction(action, c);
    }

    // ── Status viewer hookup (avatar) + profile navigation (username) ──
    function openStatusFor(cid) {
      const c = findById(comments, cid);
      if (!c) return;
      if (c.statuses && c.statuses.length && typeof window.openStatusViewer === 'function') {
        window.openStatusViewer([{
          id: 'dcs_' + c.id, name: c.name, avatar: c.avatar, ring: c.statusRing,
          likes: 0, threads: 0, statuses: c.statuses,
        }], 'dcs_' + c.id);
      }
      // No statuses on this comment's author → intentionally do nothing.
    }
    function goToProfile(cid) {
      const c = findById(comments, cid);
      if (typeof options.onProfileClick === 'function') { options.onProfileClick(c); return; }
      location.href = 'profile.html?u=' + encodeURIComponent((c && c.name) || '');
    }

    // ── Toggle collapse ──
    function toggleOpen() {
      open = !open;
      bodyEl.classList.toggle('open', open);
      arrowEl?.classList.toggle('open', open);
    }

    // ── Event delegation — bound once per "surface" (the main list and
    //     the thread view each get their own binding, parametrized by a
    //     namespace `ns` so DOM id lookups stay scoped to that surface) ──
    function bindDelegatedEvents(scopeEl, ns) {
      scopeEl.addEventListener('click', e => {
        const av = e.target.closest('[data-dcs-avatar]');
        if (av) { openStatusFor(+av.dataset.dcsAvatar); return; }

        const nm = e.target.closest('[data-dcs-nameclick]');
        if (nm) { goToProfile(+nm.dataset.dcsNameclick); return; }

        const rxb = e.target.closest('[data-dcs-rxbubble]');
        if (rxb) { toggleRxPopup(+rxb.dataset.dcsRxbubble, ns); return; }

        const rxpick = e.target.closest('[data-dcs-rxpick]');
        if (rxpick) { pickReaction(+rxpick.dataset.dcsRxpick, rxpick.dataset.rid); return; }

        const like = e.target.closest('[data-dcs-like]');
        if (like && !e.target.closest('.dcs-rx-popup')) { toggleLike(+like.dataset.dcsLike); return; }

        const viewbtn = e.target.closest('[data-dcs-viewthread]');
        if (viewbtn) { openThread(+viewbtn.dataset.dcsViewthread); return; }

        const replybtn = e.target.closest('[data-dcs-replybtn]');
        if (replybtn) {
          const cid = +replybtn.dataset.dcsReplybtn;
          scopeEl.querySelectorAll('.dcs-reply-area').forEach(a => a.classList.remove('open'));
          const area = document.getElementById(ns + '-cra-' + cid);
          if (area) { area.classList.add('open'); document.getElementById(ns + '-cri-' + cid)?.focus(); }
          return;
        }

        const replysend = e.target.closest('[data-dcs-replysend]');
        if (replysend) { submitReply(ns, +replysend.dataset.dcsReplysend); return; }

        const editsave = e.target.closest('[data-dcs-editsave]');
        if (editsave) { saveEdit(ns, +editsave.dataset.dcsEditsave); return; }

        const editcancel = e.target.closest('[data-dcs-editcancel]');
        if (editcancel) { cancelEdit(); return; }

        const dots = e.target.closest('[data-dcs-dots]');
        if (dots) { e.stopPropagation(); openDots(+dots.dataset.dcsDots, dots); return; }

        if (!e.target.closest('.dcs-action-btn') && !e.target.closest('.dcs-rx-popup')) {
          scopeEl.querySelectorAll('.dcs-rx-popup.show').forEach(p => p.classList.remove('show'));
          activeRxPopupId = null;
        }
      });
    }
    bindDelegatedEvents(root, instId);
    bindDelegatedEvents(threadOv, instId + '-tv');

    toggleEl?.addEventListener('click', toggleOpen);
    inputEl.addEventListener('input', () => { sendBtn.disabled = inputEl.value.trim().length < 1; });
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') postTop(); });
    sendBtn.addEventListener('click', postTop);

    render();

    // ── Public control object ──
    return {
      setComments(list) { comments = (list || []).map(_normalize); syncAll(); },
      addComment(text, opts) {
        const c = _normalize(Object.assign({
          name: currentUser.name, avatar: currentUser.avatar, avatarBg: currentUser.avatarBg,
          verified: currentUser.verified || false, team: pickedTeam, time: 'Just now',
          text, likes: 0, liked: false, replies: [],
        }, opts || {}));
        comments.push(c); syncAll();
        setTimeout(() => document.getElementById(instId + '-ci-' + c.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
        return c;
      },
      getComments() { return comments; },
      open() { if (!open) toggleOpen(); },
      close() { if (open) toggleOpen(); },
      destroy() {
        closeDots();
        closeThread();
        if (_rpAvailable() && window.__dcsRPRegistry) {
          Object.keys(window.__dcsRPRegistry).forEach(k => {
            if (k.indexOf(instId + '::') === 0 || k.indexOf(instId + '-tv::') === 0) delete window.__dcsRPRegistry[k];
          });
        }
        threadOv.remove();
        container.innerHTML = '';
      },
    };
  }

  window.DroboardComments = { attach };

})();

/*─── USAGE ──────────────────────────────────────────────────────────────

  <div id="commentsPlaceholder"></div>
  <script src="reaction-picker.js"></script> <!-- optional, enables full emoji reactions -->
  <script src="status-viewer.js"></script>   <!-- optional, enables avatar taps -->
  <script src="share-modal.js"></script>     <!-- optional, enables real "Share comment" -->
  <script src="comment-section.js"></script>
  <script>
    const TEAMS = [
      { id:'a', icon:'💔', name:'Team Ada',     col:'#ff0050' },
      { id:'b', icon:'🔥', name:'Team Emeka',   col:'#60a5fa' },
      { id:'c', icon:'🕊️', name:'Team Forgive', col:'#34d399' },
      { id:'d', icon:'👀', name:'Team Watching',col:'#a78bfa' },
    ];

    const SEED = [
      {
        name:'Ada_Writes', avatar:'https://i.pravatar.cc/100?img=32',
        verified:'writer', team:'a', statusRing:'has',
        statuses:[{ bg:'https://.../cover.jpg', quote:'Working on Ch.5…', caption:'🖊️', time:'2h ago' }],
        time:'2h ago', text:'She said "I know" in front of everyone. The courage!! 😭',
        likes:421, rx:{ cry:89, broken:42 },
        replies:[
          { name:'CampusQueen', team:'b', statusRing:'none', time:'1h ago',
            text:'@Ada_Writes Right! Ice queen energy 💔', likes:87 },
        ],
      },
    ];

    const cs = DroboardComments.attach('#commentsPlaceholder', {
      title: 'Comments',
      comments: SEED,
      teams: TEAMS,
      currentUser: { name:'You', avatar:null },
      collapsible: true,
      getCommentUrl: (c) => `https://droboard.app/story/5#comment-${c.id}`,
      onPost:  (c) => console.log('posted', c),
      onReply: (parentId, c) => console.log('replied to', parentId, c),
      onEdit:  (c, oldText, newText) => console.log('edited', c.id, oldText, '->', newText),
    });
  </script>

── DRIVING TEAM TAGS FROM THE "PICK YOUR SIDE" SIDING ON reader.html ────

  If your page already has its own team-siding UI (like reader.html), keep
  them in sync by passing the picked team in as `currentUser.team` when you
  attach, and re-calling `cs` methods as needed — or just let users pick
  their team directly inside the built-in picker at the top of the list
  (it smooth-scrolls the composer into view on pick); both write to the
  same `comment.team` field.

── DISABLING TEAMS OR STATUS RINGS ───────────────────────────────────────

  Omit `options.teams` entirely to disable team tags/picker everywhere
  (main list AND the thread view composer).
  Omit `statuses` on a comment (or leave `statusRing:'none'`) to render a
  plain avatar with no ring — tapping it does nothing; tapping the
  username still navigates to profile.html as usual.

── LIGHT / DARK THEME ─────────────────────────────────────────────────

  Every color in this file is a var(--dcs-*) custom property (dark
  defaults in :root, light overrides under body.theme-white). To theme
  the component yourself without touching this file, just toggle
  `document.body.classList.toggle('theme-white')` — same convention as
  story.html and full-reader.html.

─────────────────────────────────────────────────────────────────────────*/