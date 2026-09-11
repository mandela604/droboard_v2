/**
 * search-overlay.js — Droboard Reusable Search Component
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="component/search-overlay.js"></script> on any
 * page (after the page's own Font Awesome + font <link> tags, same as
 * every other Droboard page already loads). That's it — no per-page
 * wiring required.
 *
 * ── ZERO-JS INTEGRATION ───────────────────────────────────────────────
 * Any element, on any page, gets search-opening behavior just by adding
 * one attribute:
 *
 *   <div class="icon-btn" data-search-trigger><i class="fas fa-search"></i></div>
 *   <a class="bn-item" href="search.html" data-search-trigger>...</a>
 *
 * A single page-wide delegated click listener (bound the moment this
 * script loads) watches for that attribute. If the element is a link
 * (has an href), the default navigation is prevented and the overlay
 * opens in-place instead — so you can leave existing
 * href="search.html" fallbacks on bottom-nav items exactly as they are
 * (they still work fine for no-JS contexts) and just add the attribute
 * to upgrade them.
 *
 * ── PROGRAMMATIC API ──────────────────────────────────────────────────
 *   DroboardSearch.open()             // open, empty
 *   DroboardSearch.open('betrayal')   // open and immediately search
 *   DroboardSearch.close()
 *   DroboardSearch.isOpen()
 *   DroboardSearch.configure({ ...see below... })
 *   DroboardSearch.setTheme('light' | 'dark')   // switch theme at runtime
 *   DroboardSearch.getTheme()                   // 'light' | 'dark'
 *   DroboardSearch.toggleTheme()                // flip current theme
 *
 * ── THEMING ────────────────────────────────────────────────────────────
 * The overlay ships with a light theme AND a dark theme. Light is the
 * default theme, always, on first load, regardless of the host page's
 * own look — this is a deliberate product decision, not a "match the
 * OS" auto-detect. A small sun/moon toggle sits in the top bar so the
 * person can flip to dark themselves; their choice is remembered
 * (localStorage, 'dro_search_theme_v1') for next time.
 *
 * Hosts can also set the initial/forced theme in code:
 *
 *   DroboardSearch.configure({ theme: 'dark' });   // before or after open()
 *   DroboardSearch.setTheme('light');              // anytime
 *
 * All colors are CSS custom properties scoped to `.dso-root`, split
 * into a light block (default) and a `[data-dso-theme="dark"]`
 * override block. Nothing else in the component references a raw hex
 * color for anything theme-sensitive (backgrounds, borders, text) —
 * only the brand pink accent and a couple of semantic badge colors
 * (green/blue) stay constant across both themes, with light/dark
 * variants tuned for contrast.
 *
 * ── WHY AN OVERLAY, NOT A FILE-PER-PAGE COPY ─────────────────────────
 * Same reasoning as comment-section.js's thread view: this is built
 * once, appended to <body>, and reused every time it's opened —
 * regardless of which page called it. State (query, filter, recent
 * searches, theme) persists for the session; recent searches and the
 * chosen theme persist across sessions via localStorage, same keys the
 * original page used (plus one new key for theme).
 *
 * ── STYLING ────────────────────────────────────────────────────────────
 * Every class is prefixed `dso-` (Droboard Search Overlay) so it can
 * never collide with a host page's own CSS. Layout, motion, and
 * typography (Playfair Display + DM Sans, Font Awesome icons) are
 * unchanged from the original search.html — only the color layer is
 * now themeable, with light as the default look.
 */

(function () {
  'use strict';

  if (window.__droboardSearchOverlay) return;
  window.__droboardSearchOverlay = true;

  // ══════════════════════════════════════════════════════════════════
  // CSS (dso- prefixed, self-contained, injected once)
  // Color tokens live on .dso-root as CSS custom properties: a light
  // block (default) plus a [data-dso-theme="dark"] override block.
  // Everything else references var(--dso-*) instead of raw hex/rgba.
  // ══════════════════════════════════════════════════════════════════
  const CSS = `
    .dso-root{
      /* ---- Light theme tokens (default) ---- */
      --dso-bg:#ffffff;
      --dso-bg-topbar:rgba(255,255,255,.94);
      --dso-surface:#f7f7f9;
      --dso-surface-2:#eeeef1;
      --dso-border:rgba(20,20,30,.09);
      --dso-border-strong:rgba(20,20,30,.14);
      --dso-text:#16161c;
      --dso-text-secondary:#3a3a46;
      --dso-text-dim:#6f6f7d;
      --dso-text-faint:#a5a5b2;
      --dso-accent:#ff0050;
      --dso-accent-contrast:#ffffff;
      --dso-accent-soft:rgba(255,0,80,.08);
      --dso-accent-soft-strong:rgba(255,0,80,.13);
      --dso-accent-soft-border:rgba(255,0,80,.2);
      --dso-accent-text:#e0004a;
      --dso-shadow:rgba(20,20,30,.10);
      --dso-scrollbar:rgba(255,0,80,.25);
      --dso-rank-gold:#c8890a;
      --dso-rank-silver:#787a8c;
      --dso-rank-bronze:#a5673a;
      --dso-green-bg:rgba(16,185,129,.1);
      --dso-green-bg-strong:rgba(16,185,129,.18);
      --dso-green-border:rgba(16,185,129,.28);
      --dso-green-text:#059669;
      --dso-blue-bg:rgba(14,165,233,.1);
      --dso-blue-border:rgba(14,165,233,.28);
      --dso-blue-text:#0284c7;
      --dso-toast-bg:#1c1c22;
      --dso-toast-text:#f2f2f5;

      position:fixed;inset:0;z-index:5000;background:var(--dso-bg);color:var(--dso-text-secondary);
      font-family:'DM Sans',system-ui,sans-serif;display:none;flex-direction:column;
      overflow:hidden;transition:background .2s ease,color .2s ease;
    }
    .dso-root[data-dso-theme="dark"]{
      /* ---- Dark theme tokens (opt-in via toggle or configure) ---- */
      --dso-bg:#000000;
      --dso-bg-topbar:rgba(0,0,0,.97);
      --dso-surface:#08090c;
      --dso-surface-2:#1a1b22;
      --dso-border:rgba(255,255,255,.07);
      --dso-border-strong:rgba(255,255,255,.12);
      --dso-text:#e0e0e0;
      --dso-text-secondary:#c0c0c0;
      --dso-text-dim:#71717a;
      --dso-text-faint:#3f3f46;
      --dso-accent:#ff0050;
      --dso-accent-contrast:#ffffff;
      --dso-accent-soft:rgba(255,0,80,.07);
      --dso-accent-soft-strong:rgba(255,0,80,.09);
      --dso-accent-soft-border:rgba(255,0,80,.2);
      --dso-accent-text:#ff7a9a;
      --dso-shadow:rgba(0,0,0,.5);
      --dso-scrollbar:rgba(255,0,80,.2);
      --dso-rank-gold:#fbbf24;
      --dso-rank-silver:#a0aec0;
      --dso-rank-bronze:#c0956a;
      --dso-green-bg:rgba(52,211,153,.1);
      --dso-green-bg-strong:rgba(52,211,153,.12);
      --dso-green-border:rgba(52,211,153,.2);
      --dso-green-text:#34d399;
      --dso-blue-bg:rgba(56,189,248,.08);
      --dso-blue-border:rgba(56,189,248,.2);
      --dso-blue-text:#38bdf8;
      --dso-toast-bg:#13141a;
      --dso-toast-text:#c0c0c0;
    }
    .dso-root.open{display:flex}
    .dso-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    .dso-root ::-webkit-scrollbar{width:2px}
    .dso-root ::-webkit-scrollbar-thumb{background:var(--dso-scrollbar);border-radius:2px}
    .dso-scroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
      padding-bottom:24px;}

    .dso-topbar{position:sticky;top:0;z-index:20;background:var(--dso-bg-topbar);
      backdrop-filter:blur(20px);border-bottom:1px solid var(--dso-border);
      padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 9px;flex-shrink:0}
    .dso-toprow{display:flex;align-items:center;gap:10px;margin-bottom:2px}
    .dso-back{width:32px;height:32px;border-radius:50%;background:var(--dso-surface-2);
      border:none;color:var(--dso-text);display:flex;align-items:center;justify-content:center;
      font-size:13px;cursor:pointer;flex-shrink:0;transition:.15s}
    .dso-back:active{transform:scale(.9);background:var(--dso-accent-soft-strong);color:var(--dso-accent)}
    .dso-theme-toggle{width:32px;height:32px;border-radius:50%;background:var(--dso-surface-2);
      border:none;color:var(--dso-text);display:flex;align-items:center;justify-content:center;
      font-size:13px;cursor:pointer;flex-shrink:0;transition:.15s}
    .dso-theme-toggle:active{transform:scale(.9);background:var(--dso-accent-soft-strong);color:var(--dso-accent)}
    .dso-toplabel{font-family:'Playfair Display',serif;font-size:15px;font-weight:900;
      color:var(--dso-text);flex:1}
    .dso-search-wrap{display:flex;align-items:center;gap:9px;background:var(--dso-surface);
      border:1.5px solid var(--dso-border);border-radius:24px;padding:9px 14px;
      margin-top:9px;transition:border-color .2s}
    .dso-search-wrap:focus-within{border-color:rgba(255,0,80,.35);
      box-shadow:0 0 0 3px rgba(255,0,80,.12)}
    .dso-search-wrap i.dso-search-icon{color:var(--dso-text-faint);font-size:13px;flex-shrink:0}
    .dso-search-inp{flex:1;background:none;border:none;outline:none;color:var(--dso-text);
      font-family:'DM Sans',sans-serif;font-size:14px;caret-color:var(--dso-accent)}
    .dso-search-inp::placeholder{color:var(--dso-text-faint)}
    .dso-search-clear{width:22px;height:22px;border-radius:50%;background:var(--dso-surface-2);
      display:none;align-items:center;justify-content:center;font-size:9px;
      color:var(--dso-text-dim);cursor:pointer;flex-shrink:0}
    .dso-search-clear.show{display:flex}
    .dso-search-clear:active{transform:scale(.88)}

    .dso-filter-bar{display:none;gap:6px;padding:10px 14px 0;overflow-x:auto;
      scrollbar-width:none}
    .dso-filter-bar::-webkit-scrollbar{display:none}
    .dso-filter-bar.show{display:flex}
    .dso-fpill{flex-shrink:0;padding:5px 14px;border-radius:20px;font-size:10px;
      font-weight:700;cursor:pointer;border:1.5px solid var(--dso-border);
      color:var(--dso-text-faint);background:transparent;transition:all .18s;white-space:nowrap;
      font-family:'DM Sans',sans-serif}
    .dso-fpill.on{background:var(--dso-accent);color:var(--dso-accent-contrast);border-color:var(--dso-accent);
      box-shadow:0 2px 10px rgba(255,0,80,.15)}
    .dso-fpill:active{transform:scale(.95)}

    .dso-sh{display:flex;align-items:center;justify-content:space-between;
      padding:18px 14px 10px}
    .dso-sh-title{font-size:11px;font-weight:800;color:var(--dso-text-dim);text-transform:uppercase;
      letter-spacing:.1em;display:flex;align-items:center;gap:6px}
    .dso-sh-more{font-size:10px;font-weight:700;color:var(--dso-accent-text);cursor:pointer;
      padding:3px 9px;border-radius:10px;background:var(--dso-accent-soft);
      border:1px solid var(--dso-accent-soft-border);text-decoration:none}

    .dso-trending-list,.dso-recent-list,.dso-cat-grid{padding:0 14px}
    .dso-trend-item{display:flex;align-items:center;gap:12px;padding:11px 0;
      border-bottom:1px solid var(--dso-border);cursor:pointer;transition:.15s}
    .dso-trend-item:last-child{border-bottom:none}
    .dso-trend-item:active{opacity:.7}
    .dso-trend-rank{font-family:'Playfair Display',serif;font-size:13px;font-weight:900;
      width:24px;text-align:center;flex-shrink:0}
    .dso-trend-rank.t1{color:var(--dso-rank-gold)}.dso-trend-rank.t2{color:var(--dso-rank-silver)}
    .dso-trend-rank.t3{color:var(--dso-rank-bronze)}.dso-trend-rank.td{color:var(--dso-text-faint)}
    .dso-trend-body{flex:1;min-width:0}
    .dso-trend-query{font-size:13px;font-weight:700;color:var(--dso-text)}
    .dso-trend-meta{font-size:10px;color:var(--dso-text-dim);margin-top:1px}
    .dso-trend-arrow{font-size:11px;color:var(--dso-text-faint)}
    .dso-trend-fire{font-size:13px;flex-shrink:0}

    .dso-recent-item{display:flex;align-items:center;gap:10px;padding:10px 0;
      border-bottom:1px solid var(--dso-border);cursor:pointer}
    .dso-recent-item:last-child{border-bottom:none}
    .dso-recent-icon{width:32px;height:32px;border-radius:9px;background:var(--dso-surface);
      border:1px solid var(--dso-border);display:flex;align-items:center;
      justify-content:center;font-size:12px;color:var(--dso-text-dim);flex-shrink:0}
    .dso-recent-text{flex:1;font-size:13px;font-weight:600;color:var(--dso-text-secondary)}
    .dso-recent-del{width:26px;height:26px;border-radius:50%;background:transparent;
      border:none;display:flex;align-items:center;justify-content:center;font-size:11px;
      color:var(--dso-text-faint);cursor:pointer;flex-shrink:0;transition:.15s}
    .dso-recent-del:active{color:var(--dso-accent)}
    .dso-recent-empty{padding:10px 0;font-size:12px;color:var(--dso-text-faint)}

    .dso-story-card{display:flex;gap:11px;background:var(--dso-surface);
      border:1px solid var(--dso-border);border-radius:13px;padding:10px;
      cursor:pointer;transition:border-color .2s;margin-bottom:8px;position:relative}
    .dso-story-card:active{border-color:var(--dso-accent-soft-border)}
    .dso-sc-img{width:72px;height:86px;border-radius:8px;background-size:cover;
      background-position:center;flex-shrink:0}
    .dso-sc-body{flex:1;min-width:0;display:flex;flex-direction:column;
      justify-content:space-between}
    .dso-sc-cat{font-size:8px;font-weight:800;color:var(--dso-accent);text-transform:uppercase;
      letter-spacing:.05em;margin-bottom:3px}
    .dso-sc-title{font-family:'Playfair Display',serif;font-size:12px;font-weight:700;
      line-height:1.35;color:var(--dso-text);display:-webkit-box;-webkit-line-clamp:2;
      -webkit-box-orient:vertical;overflow:hidden;margin-bottom:5px}
    .dso-sc-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .dso-sc-av{width:14px;height:14px;border-radius:50%;object-fit:cover;
      border:1px solid var(--dso-border)}
    .dso-sc-author{font-size:9px;color:var(--dso-text-dim);font-weight:600}
    .dso-sc-stat{font-size:9px;color:var(--dso-text-faint);display:flex;align-items:center;gap:2px;
      font-weight:600}
    .dso-sc-badge{position:absolute;top:8px;right:8px;font-size:7px;font-weight:800;
      padding:2px 7px;border-radius:6px;letter-spacing:.03em}
    .dso-badge-hot{background:var(--dso-accent);color:var(--dso-accent-contrast)}
    .dso-badge-new{background:var(--dso-green-bg);color:var(--dso-green-text);
      border:1px solid var(--dso-green-border)}
    .dso-badge-free{background:var(--dso-blue-bg);color:var(--dso-blue-text);
      border:1px solid var(--dso-blue-border)}

    .dso-writer-card{display:flex;align-items:center;gap:10px;padding:10px 0;
      border-bottom:1px solid var(--dso-border);cursor:pointer}
    .dso-writer-card:last-child{border-bottom:none}
    .dso-wc-av-wrap{position:relative;flex-shrink:0}
    .dso-wc-av-ring{width:44px;height:44px;border-radius:50%;padding:2.5px;
      background:linear-gradient(135deg,#ff0050,#ff4d7a)}
    .dso-wc-av-ring.blue-ring{background:linear-gradient(135deg,#38bdf8,#0ea5e9)}
    .dso-wc-av-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;
      background:var(--dso-bg)}
    .dso-wc-av-inner img{width:100%;height:100%;object-fit:cover;display:block}
    .dso-wc-verified{position:absolute;bottom:-1px;right:-1px;width:16px;height:16px;
      border-radius:50%;background:var(--dso-blue-text);border:2px solid var(--dso-bg);display:flex;
      align-items:center;justify-content:center;font-size:6px;color:#fff}
    .dso-wc-body{flex:1;min-width:0}
    .dso-wc-name{font-size:13px;font-weight:700;color:var(--dso-text)}
    .dso-wc-handle{font-size:10px;color:var(--dso-text-dim);margin-top:1px}
    .dso-wc-genre{display:inline-flex;align-items:center;gap:3px;font-size:8px;
      font-weight:700;padding:2px 7px;border-radius:6px;background:var(--dso-accent-soft);
      border:1px solid var(--dso-accent-soft-border);color:var(--dso-accent-text);margin-top:4px}
    .dso-wc-follow-btn{padding:6px 14px;border-radius:20px;font-size:10px;font-weight:700;
      cursor:pointer;border:1.5px solid var(--dso-border);
      background:var(--dso-surface);color:var(--dso-text-secondary);white-space:nowrap;flex-shrink:0;
      transition:.2s;font-family:'DM Sans',sans-serif}
    .dso-wc-follow-btn.ing{background:var(--dso-accent);border-color:var(--dso-accent);color:var(--dso-accent-contrast)}
    .dso-wc-follow-btn:active{transform:scale(.96)}

    .dso-h-scroll{display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;
      padding:0 14px}
    .dso-h-scroll::-webkit-scrollbar{display:none}
    .dso-h-card{flex-shrink:0;width:130px;cursor:pointer;display:flex;
      flex-direction:column}
    .dso-h-card:active{opacity:.8}
    .dso-h-cover{position:relative;width:100%;height:160px;border-radius:10px;
      overflow:hidden;background:var(--dso-surface);box-shadow:0 4px 14px var(--dso-shadow)}
    .dso-h-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .dso-h-scrim{position:absolute;bottom:0;left:0;right:0;height:60%;
      background:linear-gradient(0deg,rgba(0,0,0,.94),transparent)}
    .dso-h-badge{position:absolute;top:5px;left:0;font-size:7px;font-weight:800;
      padding:2px 6px 2px 4px;border-radius:0 6px 6px 0;text-transform:uppercase;z-index:2}
    .dso-h-views{position:absolute;bottom:5px;left:7px;font-size:8px;font-weight:700;
      color:rgba(255,255,255,.85);display:flex;align-items:center;gap:2px}
    .dso-h-title{font-size:10.5px;font-weight:700;line-height:1.35;color:var(--dso-text);
      margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
      overflow:hidden}
    .dso-h-author{font-size:9px;color:var(--dso-text-dim);margin-top:3px;font-weight:600}

    .dso-cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .dso-cat-tile{position:relative;border-radius:12px;overflow:hidden;height:72px;
      cursor:pointer;transition:.15s}
    .dso-cat-tile:active{transform:scale(.97)}
    .dso-cat-tile-bg{position:absolute;inset:0;background-size:cover;
      background-position:center}
    .dso-cat-tile-ov{position:absolute;inset:0;display:flex;align-items:center;
      padding:0 12px}
    .dso-cat-tile-label{font-family:'Playfair Display',serif;font-size:13px;
      font-weight:900;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.7)}
    .dso-cat-tile-count{font-size:9px;color:rgba(255,255,255,.7);margin-top:2px;
      font-weight:600}

    .dso-results-count{font-size:11px;color:var(--dso-text-dim);font-weight:600;margin-bottom:12px;
      padding:12px 14px 0}
    .dso-results-count strong{color:var(--dso-text)}
    .dso-results-inner{padding:0 14px}

    .dso-empty-state{padding:52px 24px;text-align:center;display:flex;
      flex-direction:column;align-items:center;gap:12px}
    .dso-empty-icon{font-size:46px;animation:dsoFloat 3s ease-in-out infinite}
    @keyframes dsoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    .dso-empty-title{font-family:'Playfair Display',serif;font-size:19px;font-weight:900;
      color:var(--dso-text)}
    .dso-empty-body{font-size:12px;color:var(--dso-text-dim);line-height:1.6;max-width:240px}
    .dso-empty-try{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;
      margin-top:4px}
    .dso-empty-try-pill{font-size:10px;font-weight:700;padding:5px 12px;border-radius:20px;
      cursor:pointer;background:var(--dso-accent-soft);border:1px solid var(--dso-accent-soft-border);
      color:var(--dso-accent-text)}

    .dso-debate-card{background:var(--dso-surface);border:1px solid var(--dso-border);
      border-radius:13px;overflow:hidden;margin-bottom:8px;cursor:pointer;
      transition:border-color .2s}
    .dso-debate-card:active{border-color:var(--dso-accent-soft-border)}
    .dso-dc-header{display:flex;gap:9px;padding:11px 12px 9px}
    .dso-dc-thumb{width:44px;height:52px;border-radius:7px;background-size:cover;
      background-position:center;flex-shrink:0}
    .dso-dc-body{flex:1;min-width:0}
    .dso-dc-badge{font-size:7.5px;font-weight:800;padding:2px 7px;border-radius:6px;
      background:var(--dso-accent-soft);color:var(--dso-accent);border:1px solid var(--dso-accent-soft-border);
      display:inline-flex;align-items:center;gap:3px;margin-bottom:4px}
    .dso-dc-live-dot{width:4px;height:4px;border-radius:50%;background:var(--dso-accent);
      animation:dsoLive 1.3s ease-in-out infinite}
    @keyframes dsoLive{0%,100%{opacity:1}50%{opacity:.3}}
    .dso-dc-motion{font-size:11px;font-weight:700;color:var(--dso-text);line-height:1.35;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dso-dc-bars{display:flex;gap:5px;padding:0 12px 10px}
    .dso-dc-side{flex:1;border-radius:8px;padding:6px 8px;position:relative;overflow:hidden}
    .dso-dc-side.for{background:var(--dso-green-bg);border:1px solid var(--dso-green-border)}
    .dso-dc-side.ag{background:var(--dso-accent-soft);border:1px solid var(--dso-accent-soft-border)}
    .dso-dc-side-bar{position:absolute;left:0;top:0;bottom:0;z-index:0;border-radius:8px}
    .dso-dc-side.for .dso-dc-side-bar{background:var(--dso-green-bg-strong)}
    .dso-dc-side.ag .dso-dc-side-bar{background:var(--dso-accent-soft-strong)}
    .dso-dc-side-inner{position:relative;z-index:1;display:flex;justify-content:space-between;
      align-items:center}
    .dso-dc-side-lbl{font-size:8px;font-weight:800}
    .dso-dc-side.for .dso-dc-side-lbl{color:var(--dso-green-text)}
    .dso-dc-side.ag .dso-dc-side-lbl{color:var(--dso-accent-text)}
    .dso-dc-side-pct{font-size:11px;font-weight:900}
    .dso-dc-side.for .dso-dc-side-pct{color:var(--dso-green-text)}
    .dso-dc-side.ag .dso-dc-side-pct{color:var(--dso-accent-text)}
    .dso-dc-total{font-size:9px;color:var(--dso-text-faint);padding:0 12px 10px;font-weight:600}

    .dso-bottom-nav{position:sticky;bottom:0;z-index:20;background:var(--dso-bg-topbar);
      backdrop-filter:blur(20px);border-top:1px solid var(--dso-border);
      display:flex;justify-content:space-around;padding:8px 0 calc(env(safe-area-inset-bottom,0px) + 8px);
      flex-shrink:0}
    .dso-bn-item{text-align:center;font-size:9px;font-weight:600;color:var(--dso-text-faint);
      cursor:pointer;transition:.2s;padding:2px 8px;text-decoration:none;
      display:flex;flex-direction:column;align-items:center;gap:2px}
    .dso-bn-item i{font-size:20px;display:block}
    .dso-bn-item.active{color:var(--dso-accent)}

    .dso-sdiv{height:1px;background:var(--dso-border);margin:6px 0}

    .dso-ad-banner{margin:0 14px 14px;background:var(--dso-surface);
      border:1px solid var(--dso-border);border-radius:14px;padding:11px 13px;
      display:flex;align-items:center;gap:10px;position:relative;overflow:hidden;
      cursor:pointer}
    .dso-ad-banner::after{content:'AD';position:absolute;top:6px;right:8px;
      font-size:7px;font-weight:800;color:var(--dso-text-faint);letter-spacing:.08em}
    .dso-ad-logo{width:36px;height:36px;border-radius:9px;object-fit:cover;
      flex-shrink:0;border:1px solid var(--dso-border)}
    .dso-ad-body{flex:1;min-width:0}
    .dso-ad-brand{font-size:9px;font-weight:800;color:var(--dso-blue-text);margin-bottom:2px}
    .dso-ad-headline{font-size:11px;font-weight:700;color:var(--dso-text);margin-bottom:1px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dso-ad-sub{font-size:9px;color:var(--dso-text-faint)}
    .dso-ad-cta{background:var(--dso-accent);color:var(--dso-accent-contrast);border:none;padding:5px 11px;
      border-radius:10px;font-size:9px;font-weight:800;cursor:pointer;white-space:nowrap;
      flex-shrink:0;font-family:'DM Sans',sans-serif}

    .dso-toast{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);
      left:50%;transform:translateX(-50%) translateY(16px);background:var(--dso-toast-bg);
      border:1px solid var(--dso-border);color:var(--dso-toast-text);padding:8px 18px;
      border-radius:28px;font-size:12px;font-weight:600;z-index:5900;opacity:0;
      transition:.28s;pointer-events:none;white-space:nowrap;max-width:92vw;
      text-align:center;font-family:'DM Sans',sans-serif}
    .dso-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

    @keyframes dsoFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .dso-fu{animation:dsoFadeUp .22s ease both}
    .dso-d1{animation-delay:.03s}.dso-d2{animation-delay:.06s}.dso-d3{animation-delay:.09s}
    .dso-d4{animation-delay:.12s}.dso-d5{animation-delay:.15s}.dso-d6{animation-delay:.18s}

    .dso-view{display:none}
    .dso-view.show{display:block}
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'dso-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  // ══════════════════════════════════════════════════════════════════
  // Utils
  // ══════════════════════════════════════════════════════════════════
  function _fmtN(n) { if (typeof n === 'string') return n; n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function _esc(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _toast(msg, d) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('dsoToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dsoToast';
      el.className = 'dso-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), d || 2400);
  }

  const RECENT_KEY = 'dro_recent_v1';
  function _getRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; } }
  function _saveRecent(r) { try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch (e) {} }
  function _addRecent(q) { let r = _getRecent().filter(x => x !== q); r.unshift(q); r = r.slice(0, 8); _saveRecent(r); }

  // ══════════════════════════════════════════════════════════════════
  // Theme state — light is the default on first load, always.
  // A person's explicit choice (via the toggle, or DroboardSearch.setTheme)
  // is remembered across sessions; there is no OS/prefers-color-scheme
  // auto-detection, by design, so light stays the default even on a
  // device set to dark mode.
  // ══════════════════════════════════════════════════════════════════
  const THEME_KEY = 'dro_search_theme_v1';
  function _loadTheme() {
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }
    catch (e) { return 'light'; }
  }
  function _saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }

  let _theme = _loadTheme(); // 'light' (default) or 'dark'

  function _themeToggleIconHtml(t) {
    return t === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
  function _updateThemeToggleUI() {
    if (!_root) return;
    const btn = _root.querySelector('[data-dso-theme-toggle]');
    if (btn) btn.innerHTML = _themeToggleIconHtml(_theme);
  }
  function _applyTheme(t) {
    _theme = t === 'dark' ? 'dark' : 'light';
    _saveTheme(_theme);
    if (_root) _root.setAttribute('data-dso-theme', _theme);
    _updateThemeToggleUI();
  }
  function setTheme(t) { _applyTheme(t); }
  function getTheme() { return _theme; }
  function toggleTheme() { _applyTheme(_theme === 'dark' ? 'light' : 'dark'); }

  // ══════════════════════════════════════════════════════════════════
  // Default demo data — identical content to the original search.html.
  // Overridable wholesale (or per-key) via DroboardSearch.configure({data:...})
  // ══════════════════════════════════════════════════════════════════
  const DEFAULT_DATA = {
    trending: [
      { q: 'Ada_Writes', meta: '12.4k searches · Writer', fire: true },
      { q: 'betrayal stories', meta: '9.1k searches this week', fire: true },
      { q: 'The Runaway Bride', meta: '8.7k searches', fire: false },
      { q: 'campus romance 2025', meta: '7.2k searches', fire: false },
      { q: 'Chiamaka_N', meta: '6.8k searches · Writer', fire: false },
      { q: 'family drama series', meta: '5.9k searches', fire: false },
      { q: 'revenge arc', meta: '5.3k searches', fire: false },
      { q: 'best elegy stories', meta: '4.1k searches', fire: false },
    ],
    categories: [
      { label: '💔 Betrayal', count: '1.2k stories', bg: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg' },
      { label: '🎓 Campus', count: '890 stories', bg: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg' },
      { label: '👑 Family', count: '740 stories', bg: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg' },
      { label: '🔥 Revenge', count: '620 stories', bg: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg' },
      { label: '✨ Twist', count: '580 stories', bg: 'https://i.postimg.cc/tY7KnJyr/images.jpg' },
      { label: '🌙 Elegy', count: '310 stories', bg: 'https://i.postimg.cc/N9jY0w4m/5.jpg' },
      { label: '💍 Romance', count: '950 stories', bg: 'https://i.postimg.cc/WF1j4Pnh/6.jpg' },
      { label: '😂 Comedy', count: '420 stories', bg: 'https://i.postimg.cc/cgLZJNmC/8.jpg' },
    ],
    featured: [
      { img: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', cat: '💔 Betrayal', title: 'I came home early and caught my husband kissing her photograph', author: 'Ada_Writes', av: 'https://i.pravatar.cc/100?img=32', views: '171k', badge: 'hot' },
      { img: 'https://i.postimg.cc/tY7KnJyr/images.jpg', cat: '✨ Twist', title: 'The runaway bride in her socked feet', author: 'Ifeanyi_Story', av: 'https://i.pravatar.cc/100?img=53', views: '312k', badge: 'hot' },
      { img: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', cat: '👑 Family', title: "My grandmother's will revealed I wasn't her blood", author: 'Chiamaka_N', av: 'https://i.pravatar.cc/100?img=47', views: '204k', badge: 'free' },
      { img: 'https://i.postimg.cc/N9jY0w4m/5.jpg', cat: '🌙 Elegy', title: 'The letter he never sent', author: 'Efe_O', av: 'https://i.pravatar.cc/100?img=22', views: '218k', badge: '' },
      { img: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', cat: '🔥 Revenge', title: 'I became his boss before telling him who I was', author: 'Zara_M', av: 'https://i.pravatar.cc/100?img=16', views: '192k', badge: 'new' },
      { img: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', cat: '🎓 Campus', title: 'The richest boy started sitting beside me every morning', author: 'CampusQueen', av: 'https://i.pravatar.cc/100?img=12', views: '134k', badge: 'new' },
    ],
    writers: [
      { name: 'Ada_Writes', handle: '@ada_writes', genre: '💔 Betrayal', av: 'https://i.pravatar.cc/100?img=32', followers: '12.4k', verified: true, following: false },
      { name: 'Ifeanyi_Story', handle: '@ifeanyi_story', genre: '✨ Twist', av: 'https://i.pravatar.cc/100?img=53', followers: '31.7k', verified: true, following: false },
      { name: 'Chiamaka_N', handle: '@chiamaka_n', genre: '👑 Family', av: 'https://i.pravatar.cc/100?img=47', followers: '19.2k', verified: false, following: false },
      { name: 'Efe_O', handle: '@efe_o', genre: '🌙 Elegy', av: 'https://i.pravatar.cc/100?img=22', followers: '22.3k', verified: true, following: false },
      { name: 'Zara_M', handle: '@zara_m', genre: '🔥 Revenge', av: 'https://i.pravatar.cc/100?img=16', followers: '14.8k', verified: false, following: false },
    ],
    debates: [
      { thumb: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', motion: 'Ada should stay and fight for her marriage, not leave.', forV: 2341, agV: 3819, live: true },
      { thumb: 'https://i.postimg.cc/tY7KnJyr/images.jpg', motion: 'Walking out publicly at the altar was brave, not dramatic.', forV: 9800, agV: 2100, live: true },
      { thumb: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', motion: 'Legal action was the only appropriate response to theft.', forV: 5800, agV: 900, live: false },
    ],
    poolStories: [
      { type: 'story', img: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', cat: '💔 Betrayal', title: "I came home early and caught my husband kissing my late sister's photograph", author: 'Ada_Writes', av: 'https://i.pravatar.cc/100?img=32', views: '171k', likes: '24.3k', badge: 'hot', keywords: ['betrayal', 'husband', 'sister', 'photograph', 'ada'] },
      { type: 'story', img: 'https://i.postimg.cc/tY7KnJyr/images.jpg', cat: '✨ Twist', title: 'The runaway bride — I left at the altar in my socked feet', author: 'Ifeanyi_Story', av: 'https://i.pravatar.cc/100?img=53', views: '312k', likes: '45k', badge: 'hot', keywords: ['twist', 'bride', 'altar', 'runaway', 'ifeanyi'] },
      { type: 'story', img: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', cat: '👑 Family', title: "My grandmother's will revealed I wasn't her blood", author: 'Chiamaka_N', av: 'https://i.pravatar.cc/100?img=47', views: '204k', likes: '31k', badge: 'free', keywords: ['family', 'grandmother', 'will', 'blood', 'chiamaka'] },
      { type: 'story', img: 'https://i.postimg.cc/N9jY0w4m/5.jpg', cat: '🌙 Elegy', title: 'The letter folded inside his jacket pocket — he died before sending it', author: 'Efe_O', av: 'https://i.pravatar.cc/100?img=22', views: '218k', likes: '36.5k', badge: '', keywords: ['elegy', 'letter', 'death', 'grief', 'efe'] },
      { type: 'story', img: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', cat: '🔥 Revenge', title: 'My stepmother stole my university fund — so I uncovered her entire secret life', author: 'Zara_M', av: 'https://i.pravatar.cc/100?img=16', views: '192k', likes: '28k', badge: 'hot', keywords: ['revenge', 'stepmother', 'fund', 'zara'] },
      { type: 'story', img: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', cat: '🎓 Campus', title: 'The richest boy in school suddenly started sitting beside me every morning', author: 'CampusQueen', av: 'https://i.pravatar.cc/100?img=12', views: '134k', likes: '18.1k', badge: 'new', keywords: ['campus', 'rich', 'school', 'romance'] },
      { type: 'story', img: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg', cat: '💔 Heartbreak', title: "He proposed with my best friend's ring — she giggled before he even knelt", author: 'Kemi_A', av: 'https://i.pravatar.cc/100?img=28', views: '96k', likes: '19.2k', badge: 'new', keywords: ['heartbreak', 'proposal', 'ring', 'kemi'] },
      { type: 'story', img: 'https://i.postimg.cc/fkdXzjSj/wife.jpg', cat: '🏙️ Urban Love', title: "She rejected me 3 times. Now we share a mortgage and a dog named 'Finally'", author: 'Dami_Cole', av: 'https://i.pravatar.cc/100?img=64', views: '22.4k', likes: '22.4k', badge: '', keywords: ['romance', 'urban', 'love', 'dog', 'dami'] },
    ],
    poolWriters: [
      { type: 'writer', name: 'Ada_Writes', handle: '@ada_writes', genre: '💔 Betrayal', av: 'https://i.pravatar.cc/100?img=32', followers: '12.4k', verified: true, following: false, keywords: ['ada', 'ada_writes', 'betrayal', 'writer'] },
      { type: 'writer', name: 'Ifeanyi_Story', handle: '@ifeanyi_story', genre: '✨ Twist', av: 'https://i.pravatar.cc/100?img=53', followers: '31.7k', verified: true, following: false, keywords: ['ifeanyi', 'twist', 'writer'] },
      { type: 'writer', name: 'Chiamaka_N', handle: '@chiamaka_n', genre: '👑 Family', av: 'https://i.pravatar.cc/100?img=47', followers: '19.2k', verified: false, following: false, keywords: ['chiamaka', 'family', 'writer'] },
      { type: 'writer', name: 'Efe_O', handle: '@efe_o', genre: '🌙 Elegy', av: 'https://i.pravatar.cc/100?img=22', followers: '22.3k', verified: true, following: false, keywords: ['efe', 'elegy', 'writer'] },
      { type: 'writer', name: 'Zara_M', handle: '@zara_m', genre: '🔥 Revenge', av: 'https://i.pravatar.cc/100?img=16', followers: '14.8k', verified: false, following: false, keywords: ['zara', 'revenge', 'writer'] },
      { type: 'writer', name: 'CampusQueen', handle: '@campusqueen', genre: '🎓 Campus', av: 'https://i.pravatar.cc/100?img=12', followers: '8.1k', verified: false, following: false, keywords: ['campus', 'queen', 'writer'] },
      { type: 'writer', name: 'Kemi_A', handle: '@kemi_a', genre: '💔 Heartbreak', av: 'https://i.pravatar.cc/100?img=28', followers: '6.5k', verified: false, following: false, keywords: ['kemi', 'heartbreak', 'writer'] },
      { type: 'writer', name: 'Dami_Cole', handle: '@dami_cole', genre: '🏙️ Urban Love', av: 'https://i.pravatar.cc/100?img=64', followers: '9.4k', verified: false, following: false, keywords: ['dami', 'urban', 'love', 'writer'] },
    ],
    poolDebates: [
      { type: 'debate', thumb: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', motion: 'Ada should stay and fight for her marriage, not leave.', forV: 2341, agV: 3819, live: true, keywords: ['debate', 'ada', 'marriage', 'stay', 'leave', 'betrayal'] },
      { type: 'debate', thumb: 'https://i.postimg.cc/tY7KnJyr/images.jpg', motion: 'Walking out publicly at the altar was brave, not dramatic.', forV: 9800, agV: 2100, live: true, keywords: ['debate', 'bride', 'altar', 'brave', 'dramatic', 'twist'] },
      { type: 'debate', thumb: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', motion: 'Legal action was the only appropriate response to theft.', forV: 5800, agV: 900, live: false, keywords: ['debate', 'legal', 'theft', 'revenge', 'stepmother'] },
    ],
    ad: { logo: 'https://i.pravatar.cc/100?img=23', brand: 'PiggyVest', headline: 'Save smarter, build your future.', sub: '4M+ Nigerians already saving.', cta: 'Start' },
  };

  // ══════════════════════════════════════════════════════════════════
  // Module state
  // ══════════════════════════════════════════════════════════════════
  let _data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  let _hooks = {
    onOpenStory: () => { location.href = 'bridge.html'; },
    onOpenWriter: () => { location.href = 'profile.html'; },
    onOpenDebate: () => { _toast('⚔️ Opening debate…'); },
    onFollowToggle: null,
    onAdClick: (ad) => { _toast('Opening ' + (ad.brand || 'ad') + '…'); },
  };
  let _built = false;
  let _root, _scrollEl, _searchInp, _clearBtn, _filterBar;
  let _defaultView, _resultsView, _emptyView;
  let _currentFilter = 'all';
  let _debounceTimer = null;
  let _isOpen = false;

  function configure(options) {
    options = options || {};
    if (options.data) {
      Object.keys(options.data).forEach(k => { _data[k] = options.data[k]; });
    }
    if (options.theme) {
      _applyTheme(options.theme);
    }
    ['onOpenStory', 'onOpenWriter', 'onOpenDebate', 'onFollowToggle', 'onAdClick'].forEach(k => {
      if (typeof options[k] === 'function') _hooks[k] = options[k];
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // Build (once, lazily on first open)
  // ══════════════════════════════════════════════════════════════════
  function build() {
    if (_built) return;
    _built = true;
    _injectStyles();

    _root = document.createElement('div');
    _root.className = 'dso-root';
    _root.setAttribute('data-dso-theme', _theme); // light unless already switched/remembered
    _root.innerHTML = `
      <div class="dso-topbar">
        <div class="dso-toprow">
          <button class="dso-back" data-dso-close aria-label="Close search"><i class="fas fa-arrow-left"></i></button>
          <span class="dso-toplabel">Search</span>
          <button class="dso-theme-toggle" data-dso-theme-toggle aria-label="Toggle light/dark theme">${_themeToggleIconHtml(_theme)}</button>
        </div>
        <div class="dso-search-wrap">
          <i class="fas fa-magnifying-glass dso-search-icon"></i>
          <input class="dso-search-inp" type="search" placeholder="Stories, writers, genres, keywords…"
                 autocomplete="off" autocorrect="off" spellcheck="false"/>
          <div class="dso-search-clear"><i class="fas fa-xmark"></i></div>
        </div>
        <div class="dso-filter-bar">
          <div class="dso-fpill on" data-f="all">🔥 All</div>
          <div class="dso-fpill" data-f="stories">📖 Stories</div>
          <div class="dso-fpill" data-f="writers">✍️ Writers</div>
          <div class="dso-fpill" data-f="debates">⚔️ Debates</div>
          <div class="dso-fpill" data-f="tags"># Tags</div>
        </div>
      </div>

      <div class="dso-scroll">
        <div class="dso-view show" data-view="default">
          <div class="dso-sh dso-fu dso-d1">
            <div class="dso-sh-title"><i class="fas fa-clock-rotate-left" style="font-size:10px"></i> Recent</div>
            <div class="dso-sh-more" data-dso-clearrecent>Clear all</div>
          </div>
          <div class="dso-recent-list" data-dso-recentlist></div>

          <div class="dso-sdiv" style="margin:14px 0 0"></div>

          <div class="dso-sh dso-fu dso-d2">
            <div class="dso-sh-title"><i class="fas fa-fire" style="font-size:10px;color:var(--dso-accent)"></i> Trending Searches</div>
          </div>
          <div class="dso-trending-list dso-fu dso-d2" data-dso-trendinglist></div>

          <div class="dso-sdiv" style="margin:14px 0 0"></div>

          <div class="dso-sh dso-fu dso-d3">
            <div class="dso-sh-title"><i class="fas fa-compass" style="font-size:10px"></i> Browse by Genre</div>
            <a class="dso-sh-more" href="discover.html">See all</a>
          </div>
          <div class="dso-cat-grid dso-fu dso-d3" data-dso-catgrid></div>

          <div style="height:8px"></div>

          <div class="dso-sh dso-fu dso-d4">
            <div class="dso-sh-title"><i class="fas fa-star" style="font-size:10px;color:var(--dso-rank-gold)"></i> Featured This Week</div>
            <a class="dso-sh-more" href="browse.html">Browse all</a>
          </div>
          <div class="dso-h-scroll dso-fu dso-d4" data-dso-featuredscroll style="padding-bottom:10px"></div>

          <div class="dso-sdiv" style="margin:4px 0 0"></div>

          <div class="dso-sh dso-fu dso-d5">
            <div class="dso-sh-title"><i class="fas fa-pen-nib" style="font-size:10px"></i> Writers to Follow</div>
          </div>
          <div style="padding:0 14px" class="dso-fu dso-d5" data-dso-writerslist></div>

          <div class="dso-sdiv" style="margin:14px 0 0"></div>

          <div class="dso-sh dso-fu dso-d6">
            <div class="dso-sh-title"><i class="fas fa-gavel" style="font-size:10px;color:var(--dso-accent)"></i> Hot Debates</div>
            <a class="dso-sh-more" href="debate.html">All debates</a>
          </div>
          <div style="padding:0 14px" class="dso-fu dso-d6" data-dso-debateslist></div>

          <div class="dso-ad-banner dso-fu dso-d6" data-dso-ad></div>
        </div>

        <div class="dso-view" data-view="results">
          <div data-dso-resultswrap></div>
        </div>

        <div class="dso-view" data-view="empty">
          <div class="dso-empty-state">
            <div class="dso-empty-icon">🔍</div>
            <div class="dso-empty-title" data-dso-emptytitle>No results</div>
            <div class="dso-empty-body">Try a different keyword, writer name, or genre.</div>
            <div class="dso-empty-try" data-dso-emptytry></div>
          </div>
        </div>
      </div>

      <div class="dso-bottom-nav">
        <a class="dso-bn-item" href="index.html"><i class="fas fa-house"></i>Home</a>
        <a class="dso-bn-item" href="discover.html"><i class="fas fa-compass"></i>Discover</a>
        <a class="dso-bn-item active" href="search.html"><i class="fas fa-magnifying-glass"></i>Search</a>
        <a class="dso-bn-item" href="feed.html"><i class="fas fa-rss"></i>Feed</a>
        <a class="dso-bn-item" href="profile.html"><i class="fas fa-circle-user"></i>Profile</a>
      </div>
    `;
    document.body.appendChild(_root);

    _scrollEl = _root.querySelector('.dso-scroll');
    _searchInp = _root.querySelector('.dso-search-inp');
    _clearBtn = _root.querySelector('.dso-search-clear');
    _filterBar = _root.querySelector('.dso-filter-bar');
    _defaultView = _root.querySelector('[data-view="default"]');
    _resultsView = _root.querySelector('[data-view="results"]');
    _emptyView = _root.querySelector('[data-view="empty"]');

    bindStaticEvents();
    renderRecent();
    renderTrending();
    renderCategories();
    renderFeatured();
    renderWriters();
    renderDebates();
    renderAd();
  }

  // ══════════════════════════════════════════════════════════════════
  // Render: static/browse sections
  // ══════════════════════════════════════════════════════════════════
  function renderRecent() {
    const r = _getRecent();
    const el = _root.querySelector('[data-dso-recentlist]');
    if (!r.length) { el.innerHTML = `<div class="dso-recent-empty">No recent searches yet.</div>`; return; }
    el.innerHTML = r.map(q => `
      <div class="dso-recent-item" data-dso-recentrun="${_esc(q)}">
        <div class="dso-recent-icon"><i class="fas fa-clock-rotate-left"></i></div>
        <div class="dso-recent-text">${_esc(q)}</div>
        <button class="dso-recent-del" data-dso-recentdel="${_esc(q)}"><i class="fas fa-xmark"></i></button>
      </div>`).join('');
  }

  function renderTrending() {
    _root.querySelector('[data-dso-trendinglist]').innerHTML = (_data.trending || []).map((t, i) => `
      <div class="dso-trend-item" data-dso-run="${_esc(t.q)}">
        <div class="dso-trend-rank ${i === 0 ? 't1' : i === 1 ? 't2' : i === 2 ? 't3' : 'td'}">${i + 1}</div>
        <div class="dso-trend-body">
          <div class="dso-trend-query">${_esc(t.q)}</div>
          <div class="dso-trend-meta">${_esc(t.meta)}</div>
        </div>
        ${t.fire ? '<div class="dso-trend-fire">🔥</div>' : ''}
        <div class="dso-trend-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>`).join('');
  }

  function renderCategories() {
    _root.querySelector('[data-dso-catgrid]').innerHTML = (_data.categories || []).map(c => `
      <div class="dso-cat-tile" data-dso-run="${_esc((c.label || '').replace(/[^a-zA-Z ]/g, '').trim())}">
        <div class="dso-cat-tile-bg" style="background-image:url('${c.bg}')"></div>
        <div class="dso-cat-tile-ov" style="background:linear-gradient(90deg,rgba(0,0,0,.75),rgba(0,0,0,.3))">
          <div>
            <div class="dso-cat-tile-label">${c.label}</div>
            <div class="dso-cat-tile-count">${c.count}</div>
          </div>
        </div>
      </div>`).join('');
  }

  function renderFeatured() {
    _root.querySelector('[data-dso-featuredscroll]').innerHTML = (_data.featured || []).map(s => {
      const bc = s.badge === 'hot' ? 'dso-badge-hot' : s.badge === 'new' ? 'dso-badge-new' : s.badge === 'free' ? 'dso-badge-free' : '';
      return `<div class="dso-h-card" data-dso-openstory='${_esc(JSON.stringify(s))}'>
        <div class="dso-h-cover">
          <img src="${s.img}" loading="lazy" alt=""/>
          <div class="dso-h-scrim"></div>
          ${s.badge ? `<div class="dso-h-badge ${bc}">${s.badge.toUpperCase()}</div>` : ''}
          <div class="dso-h-views"><i class="fas fa-eye" style="font-size:6px"></i> ${s.views}</div>
        </div>
        <div class="dso-h-title">${_esc(s.title)}</div>
        <div class="dso-h-author">@${_esc(s.author)}</div>
      </div>`;
    }).join('');
  }

  function renderWriters() {
    _root.querySelector('[data-dso-writerslist]').innerHTML = (_data.writers || []).map((w, i) => `
      <div class="dso-writer-card" data-dso-openwriter='${_esc(JSON.stringify(w))}'>
        <div class="dso-wc-av-wrap">
          <div class="dso-wc-av-ring${i % 2 === 0 ? '' : ' blue-ring'}">
            <div class="dso-wc-av-inner"><img src="${w.av}" loading="lazy" alt=""/></div>
          </div>
          ${w.verified ? `<div class="dso-wc-verified"><i class="fas fa-check" style="font-size:5px"></i></div>` : ''}
        </div>
        <div class="dso-wc-body">
          <div class="dso-wc-name">${_esc(w.name)}</div>
          <div class="dso-wc-handle">${_esc(w.handle)} · ${_esc(w.followers)} followers</div>
          <div class="dso-wc-genre">${w.genre}</div>
        </div>
        <button class="dso-wc-follow-btn${w.following ? ' ing' : ''}" data-dso-follow="${i}">${w.following ? '✓ Following' : '+ Follow'}</button>
      </div>`).join('');
  }

  function renderDebates() {
    const list = (_data.debates || []).map(d => debateCardHtml(d));
    _root.querySelector('[data-dso-debateslist]').innerHTML = list.join('');
  }

  function debateCardHtml(d) {
    const tot = (d.forV + d.agV) || 1;
    const fp = Math.round(d.forV / tot * 100), ap = 100 - fp;
    return `<div class="dso-debate-card" data-dso-opendebate='${_esc(JSON.stringify(d))}'>
      <div class="dso-dc-header">
        <div class="dso-dc-thumb" style="background-image:url('${d.thumb}')"></div>
        <div class="dso-dc-body">
          <div class="dso-dc-badge">${d.live ? `<span class="dso-dc-live-dot"></span>LIVE` : 'Debate'}</div>
          <div class="dso-dc-motion">"${_esc(d.motion)}"</div>
        </div>
      </div>
      <div class="dso-dc-bars">
        <div class="dso-dc-side for"><div class="dso-dc-side-bar" style="width:${fp}%"></div><div class="dso-dc-side-inner"><span class="dso-dc-side-lbl">✅ FOR</span><span class="dso-dc-side-pct">${fp}%</span></div></div>
        <div class="dso-dc-side ag"><div class="dso-dc-side-bar" style="width:${ap}%"></div><div class="dso-dc-side-inner"><span class="dso-dc-side-lbl">❌ AGAINST</span><span class="dso-dc-side-pct">${ap}%</span></div></div>
      </div>
      <div class="dso-dc-total">${_fmtN(d.forV + d.agV)} voices</div>
    </div>`;
  }

  function renderAd() {
    const ad = _data.ad;
    if (!ad) { _root.querySelector('[data-dso-ad]').style.display = 'none'; return; }
    _root.querySelector('[data-dso-ad]').innerHTML = `
      <img class="dso-ad-logo" src="${ad.logo}" loading="lazy" alt="${_esc(ad.brand)}"/>
      <div class="dso-ad-body">
        <div class="dso-ad-brand">${_esc(ad.brand)}</div>
        <div class="dso-ad-headline">${_esc(ad.headline)}</div>
        <div class="dso-ad-sub">${_esc(ad.sub)}</div>
      </div>
      <button class="dso-ad-cta">${_esc(ad.cta)}</button>`;
  }

  // ══════════════════════════════════════════════════════════════════
  // Search logic
  // ══════════════════════════════════════════════════════════════════
  function switchView(name) {
    [_defaultView, _resultsView, _emptyView].forEach(v => v.classList.remove('show'));
    if (name === 'default') _defaultView.classList.add('show');
    if (name === 'results') _resultsView.classList.add('show');
    if (name === 'empty') _emptyView.classList.add('show');
  }

  function clearSearchUI() {
    _searchInp.value = '';
    _clearBtn.classList.remove('show');
    _filterBar.classList.remove('show');
    switchView('default');
  }

  function runSearch(q) {
    _searchInp.value = q;
    _searchInp.dispatchEvent(new Event('input'));
    _searchInp.blur();
  }

  function doSearch(q) {
    q = (q || '').trim();
    if (!q) { clearSearchUI(); return; }
    _clearBtn.classList.add('show');
    _filterBar.classList.add('show');
    _addRecent(q);
    renderRecent();
    displayResults(q);
  }

  function allPool() {
    return [].concat(_data.poolStories || [], _data.poolWriters || [], _data.poolDebates || []);
  }

  function displayResults(q) {
    const qLow = q.toLowerCase();
    let hits = allPool().filter(item => {
      const inKw = (item.keywords || []).some(k => k.includes(qLow) || qLow.includes(k));
      const inTitle = (item.title || item.motion || item.name || '').toLowerCase().includes(qLow);
      const inAuthor = (item.author || item.handle || '').toLowerCase().includes(qLow);
      return inKw || inTitle || inAuthor;
    });

    if (_currentFilter === 'stories') hits = hits.filter(h => h.type === 'story');
    else if (_currentFilter === 'writers') hits = hits.filter(h => h.type === 'writer');
    else if (_currentFilter === 'debates') hits = hits.filter(h => h.type === 'debate');
    else if (_currentFilter === 'tags') hits = hits.filter(h => h.type === 'story');

    if (!hits.length) {
      switchView('empty');
      _root.querySelector('[data-dso-emptytitle]').textContent = `Nothing for "${q}"`;
      _root.querySelector('[data-dso-emptytry]').innerHTML =
        ['betrayal', 'campus', 'Ada_Writes', 'elegy', 'romance'].map(s =>
          `<div class="dso-empty-try-pill" data-dso-run="${_esc(s)}">${s}</div>`).join('');
      return;
    }

    switchView('results');

    const storiesHits = hits.filter(h => h.type === 'story');
    const writersHits = hits.filter(h => h.type === 'writer');
    const debatesHits = hits.filter(h => h.type === 'debate');

    let html = `<div class="dso-results-count"><strong>${hits.length}</strong> result${hits.length !== 1 ? 's' : ''} for "<strong>${_esc(q)}</strong>"</div><div class="dso-results-inner">`;

    if (writersHits.length && (_currentFilter === 'all' || _currentFilter === 'writers')) {
      html += `<div class="dso-sh" style="padding:4px 0 10px"><div class="dso-sh-title"><i class="fas fa-pen-nib" style="font-size:10px"></i> Writers</div></div>`;
      html += writersHits.map(w => `
        <div class="dso-writer-card" style="margin-bottom:4px" data-dso-openwriter='${_esc(JSON.stringify(w))}'>
          <div class="dso-wc-av-wrap">
            <div class="dso-wc-av-ring"><div class="dso-wc-av-inner"><img src="${w.av}" loading="lazy" alt=""/></div></div>
            ${w.verified ? `<div class="dso-wc-verified"><i class="fas fa-check" style="font-size:5px"></i></div>` : ''}
          </div>
          <div class="dso-wc-body">
            <div class="dso-wc-name">${_esc(w.name)}</div>
            <div class="dso-wc-handle">${_esc(w.handle)} · ${_esc(w.followers)} followers</div>
            <div class="dso-wc-genre">${w.genre}</div>
          </div>
          <button class="dso-wc-follow-btn" data-dso-followresult='${_esc(JSON.stringify(w))}'>${w.following ? '✓ Following' : '+ Follow'}</button>
        </div>`).join('');
      if (storiesHits.length || debatesHits.length) html += `<div class="dso-sdiv" style="margin:8px 0 0"></div>`;
    }

    if (storiesHits.length && (_currentFilter === 'all' || _currentFilter === 'stories' || _currentFilter === 'tags')) {
      html += `<div class="dso-sh" style="padding:${writersHits.length ? '12px' : '4px'} 0 10px"><div class="dso-sh-title"><i class="fas fa-book-open" style="font-size:10px"></i> Stories</div></div>`;
      html += storiesHits.map(s => {
        const bc = s.badge === 'hot' ? 'dso-badge-hot' : s.badge === 'new' ? 'dso-badge-new' : s.badge === 'free' ? 'dso-badge-free' : '';
        return `<div class="dso-story-card" data-dso-openstory='${_esc(JSON.stringify(s))}'>
          <div class="dso-sc-img" style="background-image:url('${s.img}')"></div>
          <div class="dso-sc-body">
            <div class="dso-sc-cat">${s.cat}</div>
            <div class="dso-sc-title">${_esc(s.title)}</div>
            <div class="dso-sc-meta">
              <img class="dso-sc-av" src="${s.av}" loading="lazy" alt=""/>
              <span class="dso-sc-author">@${_esc(s.author)}</span>
              <span class="dso-sc-stat"><i class="fas fa-eye" style="font-size:7px"></i>${s.views}</span>
              <span class="dso-sc-stat"><i class="fas fa-heart" style="font-size:7px;color:var(--dso-accent)"></i>${s.likes}</span>
            </div>
          </div>
          ${s.badge ? `<span class="dso-sc-badge ${bc}">${s.badge.toUpperCase()}</span>` : ''}
        </div>`;
      }).join('');
      if (debatesHits.length) html += `<div class="dso-sdiv" style="margin:4px 0 0"></div>`;
    }

    if (debatesHits.length && (_currentFilter === 'all' || _currentFilter === 'debates')) {
      html += `<div class="dso-sh" style="padding:12px 0 10px"><div class="dso-sh-title"><i class="fas fa-gavel" style="font-size:10px;color:var(--dso-accent)"></i> Debates</div></div>`;
      html += debatesHits.map(d => debateCardHtml(d)).join('');
    }

    html += `<div style="height:8px"></div></div>`;
    _root.querySelector('[data-dso-resultswrap]').innerHTML = html;
  }

  // ══════════════════════════════════════════════════════════════════
  // Events (delegated — bound once, at build time)
  // ══════════════════════════════════════════════════════════════════
  function bindStaticEvents() {
    _root.querySelector('[data-dso-close]').addEventListener('click', close);
    _root.querySelector('[data-dso-theme-toggle]').addEventListener('click', toggleTheme);

    _searchInp.addEventListener('input', e => {
      const q = e.target.value;
      _clearBtn.classList.toggle('show', q.length > 0);
      clearTimeout(_debounceTimer);
      if (!q.trim()) { clearSearchUI(); return; }
      _debounceTimer = setTimeout(() => doSearch(q), 280);
    });
    _searchInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(_searchInp.value); }
    });
    _clearBtn.addEventListener('click', clearSearchUI);

    _filterBar.querySelectorAll('.dso-fpill').forEach(p => {
      p.addEventListener('click', () => {
        _currentFilter = p.dataset.f;
        _filterBar.querySelectorAll('.dso-fpill').forEach(x => x.classList.toggle('on', x === p));
        const q = _searchInp.value.trim();
        if (q) displayResults(q);
      });
    });

    _root.querySelector('[data-dso-clearrecent]').addEventListener('click', () => {
      _saveRecent([]); renderRecent(); _toast('🗑️ Recent searches cleared');
    });

    // One big delegated handler covers: recent run/delete, trending run,
    // category run, empty-state suggestion pills, story/writer/debate
    // opens (both in the browse sections and inside live results), and
    // follow toggles (both sections use the same data attributes).
    _root.addEventListener('click', e => {
      const runEl = e.target.closest('[data-dso-run],[data-dso-recentrun]');
      if (runEl) { runSearch(runEl.dataset.dsoRun || runEl.dataset.dsoRecentrun); return; }

      const delEl = e.target.closest('[data-dso-recentdel]');
      if (delEl) {
        e.stopPropagation();
        _saveRecent(_getRecent().filter(x => x !== delEl.dataset.dsoRecentdel));
        renderRecent();
        return;
      }

      const followBtn = e.target.closest('[data-dso-follow]');
      if (followBtn) {
        e.stopPropagation();
        const i = +followBtn.dataset.dsoFollow;
        const w = _data.writers[i];
        if (!w) return;
        w.following = !w.following;
        followBtn.textContent = w.following ? '✓ Following' : '+ Follow';
        followBtn.classList.toggle('ing', w.following);
        _toast(w.following ? `✅ Following @${w.name}` : `Unfollowed @${w.name}`);
        if (_hooks.onFollowToggle) _hooks.onFollowToggle(w, w.following);
        return;
      }
      const followResultBtn = e.target.closest('[data-dso-followresult]');
      if (followResultBtn) {
        e.stopPropagation();
        const w = JSON.parse(followResultBtn.dataset.dsoFollowresult);
        w.following = !w.following;
        followResultBtn.textContent = w.following ? '✓ Following' : '+ Follow';
        followResultBtn.classList.toggle('ing', w.following);
        _toast(w.following ? `✅ Following @${w.name}` : `Unfollowed @${w.name}`);
        if (_hooks.onFollowToggle) _hooks.onFollowToggle(w, w.following);
        return;
      }

      const storyEl = e.target.closest('[data-dso-openstory]');
      if (storyEl) { _hooks.onOpenStory(JSON.parse(storyEl.dataset.dsoOpenstory)); return; }

      const writerEl = e.target.closest('[data-dso-openwriter]');
      if (writerEl && !e.target.closest('[data-dso-follow],[data-dso-followresult]')) {
        _hooks.onOpenWriter(JSON.parse(writerEl.dataset.dsoOpenwriter)); return;
      }

      const debateEl = e.target.closest('[data-dso-opendebate]');
      if (debateEl) { _hooks.onOpenDebate(JSON.parse(debateEl.dataset.dsoOpendebate)); return; }

      const adEl = e.target.closest('[data-dso-ad]');
      if (adEl) { _hooks.onAdClick(_data.ad); return; }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════════════
  function open(prefillQuery) {
    build();
    _root.classList.add('open');
    document.body.style.overflow = 'hidden';
    _isOpen = true;
    if (prefillQuery) {
      runSearch(prefillQuery);
    } else if (!_searchInp.value) {
      clearSearchUI();
    }
    setTimeout(() => _searchInp && _searchInp.focus(), 60);
  }

  function close() {
    if (!_built) return;
    _root.classList.remove('open');
    document.body.style.overflow = '';
    _isOpen = false;
  }

  function isOpen() { return _isOpen; }

  window.DroboardSearch = { open, close, isOpen, configure, setTheme, getTheme, toggleTheme };

  // ══════════════════════════════════════════════════════════════════
  // Auto-bind: any element anywhere with data-search-trigger opens this
  // overlay. Works for elements that don't exist yet at script-load time
  // too, since it's one delegated listener on the document.
  // ══════════════════════════════════════════════════════════════════
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-search-trigger]');
    if (!trigger) return;
    e.preventDefault();
    open();
  });

})();

/*─── USAGE ──────────────────────────────────────────────────────────────

  1) Add the script once per page (after Font Awesome + the two Google
     Fonts links every Droboard page already has):

     <script src="component/search-overlay.js"></script>

  2) Upgrade any existing search icon/link to open the overlay instead
     of navigating — just add the attribute, no other change needed:

     <!-- Discover's search bar -->
     <div class="search" data-search-trigger>
       <i class="fas fa-search"></i><span>Search stories, genres...</span>
     </div>

     <!-- Bottom-nav Search tab, on every page -->
     <a class="bn-item" href="search.html" data-search-trigger>
       <i class="fas fa-magnifying-glass"></i><span>Search</span>
     </a>

     The href stays as a working fallback; the attribute upgrades the
     click to open in-place instead (e.preventDefault() runs only when
     the attribute is present, so nothing else on the page needs to
     change to adopt this everywhere at once).

  3) Optional — point it at real data/navigation once, anywhere
     (e.g. your app's shared bootstrap script):

     DroboardSearch.configure({
       onOpenStory:  (story)  => location.href = `story.html?id=${story.id}`,
       onOpenWriter: (writer) => location.href = `profile.html?u=${writer.handle}`,
       onOpenDebate: (debate) => location.href = `debate.html?id=${debate.id}`,
       onFollowToggle: (writer, isFollowing) => api.follow(writer.handle, isFollowing),
       data: { poolStories: MY_REAL_STORY_INDEX, poolWriters: MY_REAL_WRITERS, ... },
       theme: 'light', // optional — force a starting theme (default is 'light' regardless)
     });

  4) Or trigger it purely from code (e.g. a keyboard shortcut):

     document.addEventListener('keydown', e => {
       if (e.key === '/' ) DroboardSearch.open();
     });

  5) Theme is switchable at runtime too, independent of configure():

     DroboardSearch.setTheme('dark');
     DroboardSearch.toggleTheme();
     DroboardSearch.getTheme(); // 'light' | 'dark'

─────────────────────────────────────────────────────────────────────────*/