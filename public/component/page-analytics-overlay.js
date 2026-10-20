/**
 * page-analytics-overlay.js — All Pages Traffic Stats overlay
 * ─────────────────────────────────────────────────────────────
 * Self-contained component: "View all pages" from Marketing →
 * Traffic & Activity. Lists EVERY user-facing page (nothing is
 * ranked out); clicking a row opens that page's analysis:
 * stat tiles, 24h activity bars (CSS — no Chart.js dependency)
 * and traffic-source breakdown.
 *
 * Usage:
 *   <script src="../component/page-analytics-overlay.js"></script>
 *   PageAnalyticsOverlay.open();          // list view
 *   PageAnalyticsOverlay.open('feed');    // jump straight to a page's detail
 *   PageAnalyticsOverlay.close();
 *
 * Demo data — live swap: GET /api/analytics/pages → same shape.
 */
(function(){
  'use strict';
  if(window.__pageAnalyticsOverlay) return;
  window.__pageAnalyticsOverlay = true;

  const CSS = `
    .paov-root{position:fixed;inset:0;z-index:4000;background:var(--bg,#fff);display:none;flex-direction:column}
    .paov-root.open{display:flex}
    .paov-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border,#f1f1f1);background:var(--bg,#fff);flex-shrink:0}
    .paov-back{width:36px;height:36px;border-radius:50%;border:1px solid var(--border,#f1f1f1);background:var(--l1,#f8f9fa);color:var(--tx,#1a1a2e);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;text-decoration:none}
    .paov-back:active{transform:scale(.92)}
    .paov-title{font-size:16px;font-weight:800;color:var(--tx,#1a1a2e);flex:1;min-width:0}
    .paov-title small{display:block;font-size:10.5px;font-weight:600;color:var(--tx-muted,#6b7280);margin-top:1px}
    .paov-scroll{flex:1;overflow-y:auto;padding:16px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}

    .paov-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .paov-search{display:flex;align-items:center;gap:8px;background:var(--l1,#f8f9fa);border:1px solid var(--border,#f1f1f1);border-radius:10px;padding:9px 12px;flex:1;min-width:170px}
    .paov-search input{border:none;background:none;outline:none;color:var(--tx,#1a1a2e);font-size:12.5px;flex:1;font-family:inherit;min-width:0}
    .paov-search i{color:var(--tx-faint,#9ca3af);font-size:12px}
    .paov-select{font-size:12px;font-weight:600;padding:9px 10px;border-radius:10px;border:1px solid var(--border,#f1f1f1);background:var(--l1,#f8f9fa);color:var(--tx,#1a1a2e);font-family:inherit;cursor:pointer}
    .paov-count{font-size:11px;color:var(--tx-faint,#9ca3af);font-weight:600;margin-bottom:6px}

    .paov-cols{display:grid;grid-template-columns:minmax(0,1.3fr) 76px 54px 56px 50px 46px 54px 48px;gap:10px;padding:8px 26px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--tx-faint,#9ca3af);border-bottom:1px solid var(--border,#f1f1f1);position:sticky;top:-16px;z-index:5;background:var(--bg,#fff);margin:0 -16px;box-shadow:0 1px 0 var(--border,#f1f1f1)}
    .paov-cols .num{text-align:right}
    .paov-row{display:grid;grid-template-columns:minmax(0,1.3fr) 76px 54px 56px 50px 46px 54px 48px;gap:10px;align-items:center;padding:10px;border-bottom:1px solid var(--border,#f1f1f1);cursor:pointer;transition:.12s}
    .paov-row:hover{background:var(--hover,#f7f6fd)}
    .paov-row:last-child{border-bottom:none}
    .paov-page{display:flex;align-items:center;gap:10px;min-width:0}
    .paov-ico{width:30px;height:30px;border-radius:8px;background:var(--l1,#f8f9fa);color:var(--acc,#ff0050);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
    .paov-name{font-size:12.5px;font-weight:700;color:var(--tx,#1a1a2e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .paov-path{font-size:9.5px;color:var(--tx-faint,#9ca3af);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .paov-bar-track{height:4px;border-radius:4px;background:var(--l1,#f8f9fa);margin-top:4px;overflow:hidden}
    .paov-bar-fill{height:100%;border-radius:4px;background:var(--acc,#ff0050)}
    .paov-num{font-size:12px;font-weight:700;text-align:right;color:var(--tx,#1a1a2e)}
    .paov-num.faint{color:var(--tx-muted,#6b7280);font-weight:600;font-size:11.5px}
    .paov-total{border-top:2px solid var(--border,#e5e7eb);background:var(--hover,#f7f6fd);cursor:default}
    .paov-total:hover{background:var(--hover,#f7f6fd)}
    .paov-total .paov-name{font-weight:800}
    .paov-total .paov-num{font-weight:800}
    .paov-total .paov-ico{background:rgba(255,0,80,.12);color:var(--acc,#ff0050)}
    .paov-empty{padding:34px 12px;text-align:center;color:var(--tx-faint,#9ca3af);font-size:12.5px}

    .sec-chip{font-size:8.5px;font-weight:800;padding:3px 8px;border-radius:20px;white-space:nowrap;text-transform:uppercase;letter-spacing:.03em;display:inline-block}
    .sec-chip.reader{background:rgba(91,75,207,.12);color:#5b4bcf}
    .sec-chip.community{background:rgba(47,125,225,.12);color:#2f7de1}
    .sec-chip.creator{background:rgba(22,163,74,.12);color:#16a34a}
    .sec-chip.account{background:rgba(217,119,6,.12);color:#d97706}
    .sec-chip.auth{background:rgba(120,120,140,.12);color:var(--tx-muted,#6b7280)}
    .ad-chip{font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:20px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
    .ad-chip.hot{background:rgba(224,56,77,.12);color:#e0384d}
    .ad-chip.good{background:rgba(22,163,74,.12);color:#16a34a}
    .ad-chip.mid{background:rgba(217,119,6,.12);color:#d97706}
    .ad-chip.low{background:rgba(120,120,140,.12);color:var(--tx-faint,#9ca3af)}

    /* detail view */
    .paov-d-head{display:flex;align-items:center;gap:11px;margin-bottom:14px}
    .paov-d-ico{width:44px;height:44px;border-radius:12px;background:rgba(255,0,80,.1);color:var(--acc,#ff0050);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
    .paov-d-name{font-size:16px;font-weight:800;color:var(--tx,#1a1a2e)}
    .paov-d-sub{font-size:11px;color:var(--tx-faint,#9ca3af);margin-top:2px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .paov-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px;margin-bottom:16px}
    .paov-tile{background:var(--l1,#f8f9fa);border:1px solid var(--border,#f1f1f1);border-radius:11px;padding:11px 12px}
    .paov-tile-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--tx-faint,#9ca3af);margin-bottom:4px}
    .paov-tile-val{font-size:16px;font-weight:800;color:var(--tx,#1a1a2e);line-height:1.1}
    .paov-tile-sub{font-size:9.5px;color:var(--tx-muted,#6b7280);font-weight:600;margin-top:2px}
    .paov-sec-label{font-size:11px;font-weight:800;color:var(--tx-muted,#6b7280);text-transform:uppercase;letter-spacing:.06em;margin:0 0 9px}
    .paov-hourbars{display:flex;align-items:flex-end;gap:3px;height:110px;padding:10px 10px 6px;background:var(--l1,#f8f9fa);border:1px solid var(--border,#f1f1f1);border-radius:11px;margin-bottom:6px}
    .paov-hb{flex:1;border-radius:3px 3px 0 0;background:rgba(255,0,80,.28);min-height:3px;position:relative}
    .paov-hb.peak{background:var(--acc,#ff0050)}
    .paov-hourlbls{display:flex;gap:3px;font-size:8.5px;font-weight:700;color:var(--tx-faint,#9ca3af);margin-bottom:16px;padding:0 10px}
    .paov-hourlbls span{flex:1;text-align:center}
    .paov-src{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border,#f1f1f1)}
    .paov-src:last-child{border-bottom:none}
    .paov-src-ico{width:28px;height:28px;border-radius:8px;background:var(--l1,#f8f9fa);color:var(--acc,#ff0050);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
    .paov-src-name{font-size:12px;font-weight:700;color:var(--tx,#1a1a2e);width:96px;flex-shrink:0}
    .paov-src-track{flex:1;height:7px;border-radius:5px;background:var(--l1,#f8f9fa);overflow:hidden}
    .paov-src-fill{height:100%;border-radius:5px;background:var(--acc,#ff0050)}
    .paov-src-pct{font-size:11.5px;font-weight:800;color:var(--tx,#1a1a2e);width:40px;text-align:right;flex-shrink:0}
    .paov-note{font-size:11px;color:var(--tx-muted,#6b7280);line-height:1.55;background:var(--l1,#f8f9fa);border:1px solid var(--border,#f1f1f1);border-radius:10px;padding:10px 12px;margin-top:14px}
    .paov-note i{color:var(--acc,#ff0050);margin-right:5px}

    [data-theme="dark"] .paov-root{background:#000}
    [data-theme="dark"] .paov-head{background:#000;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .paov-cols{background:#000}
    [data-theme="dark"] .paov-row,[data-theme="dark"] .paov-tile,[data-theme="dark"] .paov-hourbars,[data-theme="dark"] .paov-note{background:#0e0f13;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .paov-cols{border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .paov-row{border-color:rgba(255,255,255,.07)}

    @media (max-width:640px){
      .paov-tiles{grid-template-columns:repeat(2,1fr)}
      .paov-cols,.paov-row{grid-template-columns:minmax(0,1.3fr) 72px 60px 60px}
      .paov-cols .col-hide,.paov-row .col-hide{display:none}
    }
  `;

  /* Full inventory — every user-facing page, nothing ranked out.
     imp = ad impressions, clicks = ad clicks (AdService ctx.page). */
  function pg(page, path, section, icon, visits, uniques, avgMin, bounce, imp, clicks){
    return { id: path.replace(/[^a-z0-9]/gi,'_'), page: page, path: path, section: section, icon: icon, visits: visits, uniques: uniques, avgMin: avgMin, bounce: bounce, imp: imp || 0, clicks: clicks || 0 };
  }
  const PAGES = [
    pg('Home', 'index.html', 'Reader', 'fa-house', 148200, 61400, 7.4, 24, 474000, 9500),
    pg('Full Reader', 'Pages/full-reader.html', 'Reader', 'fa-book-open', 121800, 54900, 18.6, 16, 487000, 7800),
    pg('Feed', 'Pages/feed.html', 'Reader', 'fa-rss', 64500, 31200, 9.2, 26, 168000, 3700),
    pg('Browse Overlay', 'overlay:browse', 'Reader', 'fa-table-list', 95000, 46000, 5.9, 27, 190000, 4750),
    pg('Discover', 'Pages/discover.html', 'Reader', 'fa-compass', 68100, 41700, 4.8, 38, 170000, 4250),
    pg('Library', 'Pages/library.html', 'Reader', 'fa-library', 38200, 21500, 5.2, 33, 76000, 1750),
    pg('Scroll Reader', 'Pages/scroll-reader.html', 'Reader', 'fa-file-arrow-down', 34600, 19800, 15.2, 18, 121000, 1815),
    pg('Genre Stories', 'Pages/genre-stories.html', 'Reader', 'fa-masks-theater', 31400, 18900, 6.7, 30, 63000, 1450),
    pg('Book Reader', 'Pages/book-reader.html', 'Reader', 'fa-book', 28900, 15600, 9.8, 22, 72000, 1150),
    pg('Leaderboard', 'Pages/leaderboard.html', 'Reader', 'fa-ranking-star', 22300, 14100, 3.9, 40, 22000, 330),
    pg('Collection', 'Pages/collection.html', 'Reader', 'fa-folder-open', 17600, 10800, 5.5, 32, 17600, 440),
    pg('Store', 'Pages/store.html', 'Reader', 'fa-store', 14200, 9600, 4.2, 36, 21000, 630),
    pg('Blog', 'Pages/blog.html', 'Reader', 'fa-newspaper', 9800, 6700, 4.6, 44, 24500, 735),
    pg('Genre Hub', 'Pages/genre-hub.html', 'Community', 'fa-layer-group', 76400, 39200, 6.1, 29, 229000, 5725),
    pg('Discussion', 'Pages/discussion.html', 'Community', 'fa-comments', 52600, 27300, 8.9, 22, 79000, 1975),
    pg('Profile', 'Pages/profile.html', 'Community', 'fa-circle-user', 44900, 26800, 3.6, 41, 45000, 675),
    pg('Debate', 'Pages/debate.html', 'Community', 'fa-scale-balanced', 33700, 18200, 10.4, 21, 34000, 850),
    pg('Comments', 'Pages/comments.html', 'Community', 'fa-comment-dots', 29400, 16900, 7.2, 26, 59000, 1770),
    pg('DroBoard Page', 'Pages/droboard-page.html', 'Community', 'fa-globe', 18800, 11900, 5.7, 31, 56000, 1400),
    pg('Notifications', 'Pages/notifications.html', 'Community', 'fa-bell', 16400, 12100, 2.1, 47, 0, 0),
    pg('Chat', 'Pages/chat.html', 'Community', 'fa-message', 15900, 8800, 8.4, 25, 0, 0),
    pg('Followers', 'Pages/followers.html', 'Community', 'fa-user-group', 11200, 7900, 2.8, 43, 22000, 550),
    pg('Create', 'Pages/create.html', 'Creator', 'fa-pen-nib', 29700, 12400, 11.3, 19, 0, 0),
    pg('Story Management', 'Pages/story-management.html', 'Creator', 'fa-list-check', 13600, 6100, 9.1, 23, 0, 0),
    pg('Insights', 'Pages/insights.html', 'Creator', 'fa-chart-simple', 10400, 5300, 6.9, 27, 0, 0),
    pg('YouTube Earn', 'Pages/youtube-earn.html', 'Creator', 'fa-youtube', 7300, 4800, 5.4, 39, 0, 0),
    pg('Refer', 'Pages/refer.html', 'Creator', 'fa-share-nodes', 6800, 4400, 3.3, 45, 0, 0),
    pg('Edit Profile', 'Pages/edit-profile.html', 'Account', 'fa-user-pen', 12800, 8600, 4.4, 35, 0, 0),
    pg('Settings', 'Pages/settings.html', 'Account', 'fa-gear', 11700, 8200, 3.8, 37, 0, 0),
    pg('Help Center', 'Pages/help-center.html', 'Account', 'fa-circle-question', 8900, 6300, 4.9, 34, 6000, 90),
    pg('Terms', 'Pages/terms.html', 'Account', 'fa-file-contract', 5200, 4100, 2.6, 58, 0, 0),
    pg('Interactive Demo', 'Pages/interactive-demo.html', 'Account', 'fa-circle-play', 4600, 3400, 5.8, 42, 0, 0),
    pg('Login', 'Pages/login.html', 'Auth', 'fa-right-to-bracket', 42600, 33800, 1.9, 62, 0, 0),
    pg('Sign Up', 'Pages/signup.html', 'Auth', 'fa-user-plus', 36900, 29400, 2.7, 55, 0, 0),
    pg('Forgot Password', 'Pages/forgot-password.html', 'Auth', 'fa-key', 7400, 6800, 1.4, 71, 0, 0),
    pg('Reset Password', 'Pages/reset-password.html', 'Auth', 'fa-lock', 5100, 4700, 1.6, 68, 0, 0),
  ];

  /* App-wide hourly shape — pages inherit it with per-page jitter. */
  const APP_HOURLY = [420, 310, 240, 190, 170, 210, 380, 760, 1420, 2180, 2640, 2980, 3410, 3620, 3350, 3120, 3280, 3840, 4620, 5480, 6210, 5740, 3960, 1840];

  function adPriority(p){
    if(p.visits >= 60000 && p.avgMin >= 5) return 'hot';
    if(p.visits >= 30000) return 'good';
    if(p.visits >= 10000) return 'mid';
    return 'low';
  }
  function ctrPct(p){ return p.imp ? (p.clicks / p.imp * 100) : 0; }
  function ctrText(p){ return p.imp ? ctrPct(p).toFixed(1) + '%' : '—'; }
  const AD_LABEL = { hot:'🔥 Hot', good:'Good', mid:'Mid', low:'Low' };
  const SEC_CLS = { Reader:'reader', Community:'community', Creator:'creator', Account:'account', Auth:'auth' };

  function fmtNum(n){
    n = Number(n) || 0;
    if(n >= 1e6) return (n/1e6).toFixed(1)+'M';
    if(n >= 1e3) return (n/1e3).toFixed(1)+'k';
    return String(n);
  }
  // 12-hour labels: 0 → 12am, 12 → 12pm, 13 → 1pm, 23 → 11pm
  function fmtHour(h){
    h = ((h % 24) + 24) % 24;
    return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? 'am' : 'pm');
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* Deterministic seed from page path — re-renders never jitter. */
  function seedFrom(str){
    let h = 0;
    for(let i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i)) % 100003;
    return h;
  }
  function pageHourly(p){
    const seed = seedFrom(p.path);
    const share = p.visits / 148200; // relative to busiest page
    return APP_HOURLY.map(function(v,i){
      const jitter = 0.85 + (((seed + i*17) % 30) / 100); // 0.85–1.14
      return Math.max(1, Math.round(v * Math.min(1.25, share) * jitter));
    });
  }
  function pageSources(p){
    const seed = seedFrom(p.path + 'src');
    const direct = 26 + seed % 15;            // 26–40
    const feed   = 18 + (seed >> 3) % 16;      // 18–33
    const search = 10 + (seed >> 5) % 14;      // 10–23
    const share  = 5  + (seed >> 7) % 11;      // 5–15
    const ext    = Math.max(2, 100 - direct - feed - search - share);
    return [
      { name:'Direct',   ico:'fa-link',        v: direct },
      { name:'Feed',     ico:'fa-rss',         v: feed },
      { name:'Search',   ico:'fa-magnifying-glass', v: search },
      { name:'Shares',   ico:'fa-share-nodes', v: share },
      { name:'External', ico:'fa-arrow-up-right-from-square', v: ext },
    ];
  }

  /* ── DATE RANGE FILTER ─────────────────────────────────
     PAGES figures are 30-day baselines; every other range is
     derived deterministically (identical numbers each render).
     'week' follows the CURRENT Mon→Sun window — it naturally
     resets when Sunday 23:59:59 rolls over into Monday.
  ───────────────────────────────────────────────────────── */
  const RANGES = [
    { v:'d1',   label:'Today' },
    { v:'week', label:'This Week (Mon–Sun)' },
    { v:'d7',   label:'Last 7 Days' },
    { v:'d30',  label:'Last 30 Days' },
    { v:'d90',  label:'Last 90 Days' },
    { v:'all',  label:'All Time' },
  ];
  let _range = 'd30';

  function weekInfo(now){
    now = now || new Date();
    const dow = now.getDay();                       // 0 = Sun
    const dayIdx = dow === 0 ? 6 : dow - 1;         // Mon = 0 … Sun = 6
    const start = new Date(now); start.setHours(0,0,0,0); start.setDate(now.getDate() - dayIdx);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
    return { start:start, end:end, elapsed: dayIdx + 1 };  // elapsed = 1…7 days into the week
  }
  function rangeDays(key){
    if(key === 'week') return weekInfo().elapsed;
    if(key === 'd1') return 1;
    if(key === 'd7') return 7;
    if(key === 'd90') return 90;
    if(key === 'all') return 365;
    return 30;
  }
  function rangeFactor(key){
    const d = rangeDays(key);
    if(d <= 30) return d / 30;
    return Math.pow(d / 30, 0.92);                 // long windows taper (uniques don't grow linearly)
  }
  function rangeJit(p, key, salt){
    if(key === 'd30') return 1;
    return 0.92 + (seedFrom(p.path + key + salt) % 17) / 100;   // 0.92–1.08, stable per page+range
  }
  function viewPages(){
    const f = rangeFactor(_range);
    return PAGES.map(function(p){
      const visits = Math.max(1, Math.round(p.visits * f * rangeJit(p, _range, 'v')));
      const uniques = Math.min(visits, Math.max(1, Math.round(p.uniques * Math.pow(f, 0.97) * rangeJit(p, _range, 'u'))));
      return Object.assign({}, p, {
        visits: visits,
        uniques: uniques,
        imp: p.imp ? Math.max(1, Math.round(p.imp * f * rangeJit(p, _range, 'i'))) : 0,
        clicks: p.clicks ? Math.max(1, Math.round(p.clicks * f * rangeJit(p, _range, 'c'))) : 0,
      });
    });
  }
  function rangeLabel(){
    for(let i=0;i<RANGES.length;i++) if(RANGES[i].v === _range) return RANGES[i].label;
    return 'Last 30 Days';
  }
  function fmtDay(d){ return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }); }
  function rangeNote(){
    if(_range === 'week'){
      const w = weekInfo();
      return fmtDay(w.start) + ' – ' + fmtDay(w.end) + ' · resets Sun 11:59 PM';
    }
    return rangeLabel();
  }

  let _built = false, _root = null;
  let _filtered = PAGES.slice();
  let _backToList = false; // detail shown → back button returns to list

  function ensureDom(){
    if(_built) return;
    _built = true;
    const style = document.createElement('style');
    style.id = 'paov-style';
    style.textContent = CSS;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="paov-root" id="paovRoot">
        <div class="paov-head">
          <button class="paov-back" id="paovBack" aria-label="Back"><i class="fas fa-arrow-left"></i></button>
          <div class="paov-title" id="paovTitle">All Pages — Traffic Stats<small id="paovSub"></small></div>
          <button class="paov-back" id="paovClose" aria-label="Close"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="paov-scroll" id="paovScroll"></div>
      </div>`.trim();
    while(wrap.firstChild) document.body.appendChild(wrap.firstChild);
    _root = document.getElementById('paovRoot');

    document.getElementById('paovClose').addEventListener('click', close);
    document.getElementById('paovBack').addEventListener('click', function(){
      if(_backToList){ renderList(); }
      else close();
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && _root.classList.contains('open')) close();
    });
  }

  /* ── LIST VIEW ─────────────────────────────────────────── */
  function renderList(){
    _backToList = false;
    document.getElementById('paovTitle').childNodes[0].nodeValue = 'All Pages — Traffic Stats';
    document.getElementById('paovSub').textContent = PAGES.length + ' pages tracked — none ranked out';
    const scroll = document.getElementById('paovScroll');

    scroll.innerHTML = `
      <div class="paov-toolbar">
        <div class="paov-search"><i class="fas fa-magnifying-glass"></i><input id="paovSearch" placeholder="Search page or path…"/></div>
        <select class="paov-select" id="paovRange">
          ${RANGES.map(function(o){ return '<option value="' + o.v + '"' + (o.v === _range ? ' selected' : '') + '>' + o.label + '</option>'; }).join('')}
        </select>
        <select class="paov-select" id="paovSec">
          <option value="">All Sections</option>
          <option value="Reader">Reader</option>
          <option value="Community">Community</option>
          <option value="Creator">Creator</option>
          <option value="Account">Account</option>
          <option value="Auth">Auth</option>
        </select>
        <select class="paov-select" id="paovSort">
          <option value="visits">Most Visits</option>
          <option value="imp">Most Impressions</option>
          <option value="clicks">Most Clicks</option>
          <option value="ctr">Best CTR</option>
          <option value="uniques">Most Uniques</option>
          <option value="avgMin">Longest Dwell</option>
          <option value="bounce">Lowest Bounce</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <div class="paov-count" id="paovCount"></div>
      <div class="paov-cols">
        <span>Page</span><span class="num">Section</span><span class="num">Visits</span><span class="num">Imp</span><span class="num col-hide">Clicks</span><span class="num col-hide">CTR</span><span class="num col-hide">Unique</span><span class="num col-hide">Avg Time</span>
      </div>
      <div id="paovList"></div>`;

    document.getElementById('paovSearch').addEventListener('input', applyFilters);
    document.getElementById('paovRange').addEventListener('change', function(){ _range = this.value; applyFilters(); });
    document.getElementById('paovSec').addEventListener('change', applyFilters);
    document.getElementById('paovSort').addEventListener('change', applyFilters);
    document.getElementById('paovList').addEventListener('click', function(e){
      const row = e.target.closest('[data-page]');
      if(row) renderDetail(row.dataset.page);
    });
    applyFilters();
  }

  function applyFilters(){
    const q = (document.getElementById('paovSearch').value || '').trim().toLowerCase();
    const sec = document.getElementById('paovSec').value;
    const sort = document.getElementById('paovSort').value;
    const pages = viewPages();

    _filtered = pages.filter(function(p){
      if(sec && p.section !== sec) return false;
      if(q && p.page.toLowerCase().indexOf(q) === -1 && p.path.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    if(sort === 'visits') _filtered.sort(function(a,b){ return b.visits - a.visits; });
    else if(sort === 'imp') _filtered.sort(function(a,b){ return b.imp - a.imp; });
    else if(sort === 'clicks') _filtered.sort(function(a,b){ return b.clicks - a.clicks; });
    else if(sort === 'ctr') _filtered.sort(function(a,b){ return ctrPct(b) - ctrPct(a); });
    else if(sort === 'uniques') _filtered.sort(function(a,b){ return b.uniques - a.uniques; });
    else if(sort === 'avgMin') _filtered.sort(function(a,b){ return b.avgMin - a.avgMin; });
    else if(sort === 'bounce') _filtered.sort(function(a,b){ return a.bounce - b.bounce; });
    else if(sort === 'name') _filtered.sort(function(a,b){ return a.page.localeCompare(b.page); });

    const max = Math.max.apply(null, pages.map(function(p){ return p.visits; }));
    document.getElementById('paovCount').textContent = _filtered.length + ' of ' + PAGES.length + ' pages · ' + rangeNote();
    let sumV = 0, sumI = 0, sumC = 0, sumU = 0, wMin = 0;
    _filtered.forEach(function(p){
      sumV += p.visits; sumI += p.imp || 0; sumC += p.clicks || 0; sumU += p.uniques; wMin += p.avgMin * p.visits;
    });
    const totalRow = _filtered.length
      ? '<div class="paov-row paov-total">'
        + '<div class="paov-page"><div class="paov-ico"><i class="fas fa-sigma"></i></div>'
        + '<div style="min-width:0;flex:1"><div class="paov-name">Total</div>'
        + '<div class="paov-path">' + _filtered.length + ' pages · ' + rangeNote() + '</div></div></div>'
        + '<div></div>'
        + '<div class="paov-num">' + fmtNum(sumV) + '</div>'
        + '<div class="paov-num faint">' + (sumI ? fmtNum(sumI) : '—') + '</div>'
        + '<div class="paov-num faint col-hide">' + (sumC ? fmtNum(sumC) : '—') + '</div>'
        + '<div class="paov-num faint col-hide">' + (sumI && sumC ? (Math.round(sumC / sumI * 1000) / 10) + '%' : '—') + '</div>'
        + '<div class="paov-num faint col-hide">' + fmtNum(sumU) + '</div>'
        + '<div class="paov-num faint col-hide">' + (sumV ? (Math.round(wMin / sumV * 10) / 10) : 0) + 'm</div>'
        + '</div>'
      : '';
    document.getElementById('paovList').innerHTML = _filtered.length ? _filtered.map(function(p){
      const pct = Math.round((p.visits / max) * 100);
      return '<div class="paov-row" data-page="' + esc(p.id) + '">'
        + '<div class="paov-page"><div class="paov-ico"><i class="fas ' + p.icon + '"></i></div>'
        + '<div style="min-width:0;flex:1"><div class="paov-name">' + esc(p.page) + '</div>'
        + '<div class="paov-path">' + esc(p.path) + '</div>'
        + '<div class="paov-bar-track"><div class="paov-bar-fill" style="width:' + pct + '%"></div></div></div></div>'
        + '<div style="text-align:right"><span class="sec-chip ' + SEC_CLS[p.section] + '">' + p.section + '</span></div>'
        + '<div class="paov-num">' + fmtNum(p.visits) + '</div>'
        + '<div class="paov-num faint">' + (p.imp ? fmtNum(p.imp) : '—') + '</div>'
        + '<div class="paov-num faint col-hide">' + (p.clicks ? fmtNum(p.clicks) : '—') + '</div>'
        + '<div class="paov-num faint col-hide">' + ctrText(p) + '</div>'
        + '<div class="paov-num faint col-hide">' + fmtNum(p.uniques) + '</div>'
        + '<div class="paov-num faint col-hide">' + p.avgMin + 'm</div>'
        + '</div>';
    }).join('') + totalRow : '<div class="paov-empty"><i class="fas fa-inbox" style="display:block;font-size:22px;opacity:.5;margin-bottom:8px"></i>No pages match your filters.</div>';
  }

  /* ── DETAIL VIEW (per-page analysis) ───────────────────── */
  function renderDetail(id){
    const p = viewPages().find(function(x){ return x.id === id; });
    if(!p) return;
    _backToList = true;
    document.getElementById('paovTitle').childNodes[0].nodeValue = p.page;
    document.getElementById('paovSub').textContent = p.path;

    const ad = adPriority(p);
    const hourly = pageHourly(p);
    const max = Math.max.apply(null, hourly);
    const peakIdx = hourly.indexOf(max);
    const peakLabel = fmtHour(peakIdx);
    const sources = pageSources(p);
    const hourBars = hourly.map(function(v,i){
      const h = Math.max(3, Math.round((v / max) * 100));
      return '<div class="paov-hb' + (i === peakIdx ? ' peak' : '') + '" style="height:' + h + '%" title="' + fmtHour(i) + ' · ' + fmtNum(v) + ' visits"></div>';
    }).join('');

    document.getElementById('paovScroll').innerHTML = `
      <div class="paov-d-head">
        <div class="paov-d-ico"><i class="fas ${p.icon}"></i></div>
        <div style="flex:1;min-width:0">
          <div class="paov-d-name">${esc(p.page)}</div>
          <div class="paov-d-sub"><span class="sec-chip ${SEC_CLS[p.section]}">${p.section}</span><span>${esc(p.path)}</span><span class="ad-chip ${ad}">Ad: ${AD_LABEL[ad]}</span></div>
        </div>
        ${p.path.indexOf('overlay:') === 0 ? '' : `<a class="paov-back" href="../${esc(p.path)}" title="Open page" style="color:var(--acc,#ff0050)"><i class="fas fa-arrow-up-right-from-square"></i></a>`}
      </div>

      <div class="paov-tiles">
        <div class="paov-tile"><div class="paov-tile-lbl">Visits</div><div class="paov-tile-val">${fmtNum(p.visits)}</div><div class="paov-tile-sub">${esc(rangeLabel())}</div></div>
        <div class="paov-tile"><div class="paov-tile-lbl">Ad Impressions</div><div class="paov-tile-val">${p.imp ? fmtNum(p.imp) : '—'}</div><div class="paov-tile-sub">${p.imp ? fmtNum(Math.round(p.imp / Math.max(1, p.visits) * 10) / 10) + ' per visit' : 'no ad slots on this page'}</div></div>
        <div class="paov-tile"><div class="paov-tile-lbl">Ad Clicks</div><div class="paov-tile-val">${p.clicks ? fmtNum(p.clicks) : '—'}</div><div class="paov-tile-sub">${p.imp ? ctrText(p) + ' CTR' : 'no ad slots on this page'}</div></div>
        <div class="paov-tile"><div class="paov-tile-lbl">Unique Users</div><div class="paov-tile-val">${fmtNum(p.uniques)}</div><div class="paov-tile-sub">${Math.round(p.uniques / p.visits * 100)}% of visits</div></div>
        <div class="paov-tile"><div class="paov-tile-lbl">Avg Time</div><div class="paov-tile-val">${p.avgMin}m</div><div class="paov-tile-sub">dwell per visit</div></div>
        <div class="paov-tile"><div class="paov-tile-lbl">Bounce</div><div class="paov-tile-val">${p.bounce}%</div><div class="paov-tile-sub">left after one view</div></div>
      </div>

      <div class="paov-sec-label">24h Activity — peak ${peakLabel}</div>
      <div class="paov-hourbars">${hourBars}</div>
      <div class="paov-hourlbls"><span>12am</span><span>3am</span><span>6am</span><span>9am</span><span>12pm</span><span>3pm</span><span>6pm</span><span>9pm</span></div>

      <div class="paov-sec-label">Traffic Sources</div>
      <div>
        ${sources.map(function(s){
          return '<div class="paov-src"><div class="paov-src-ico"><i class="fas ' + s.ico + '"></i></div>'
            + '<div class="paov-src-name">' + s.name + '</div>'
            + '<div class="paov-src-track"><div class="paov-src-fill" style="width:' + s.v + '%"></div></div>'
            + '<div class="paov-src-pct">' + s.v + '%</div></div>';
        }).join('')}
      </div>

      <div class="paov-note"><i class="fas fa-lightbulb"></i>${adInsight(p, ad)}</div>`;

    document.getElementById('paovScroll').scrollTop = 0;
  }

  function adInsight(p, ad){
    if(ad === 'hot') return 'High reach + long dwell — prime surface for paid placements and promo pushes.';
    if(ad === 'good') return 'Solid traffic base — good candidate for sponsored cards or banner slots.';
    if(ad === 'mid') return 'Steady but smaller audience — best for targeted, niche placements.';
    return 'Low traffic today — pair placements with a promotional push or skip for now.';
  }

  /* ── API ───────────────────────────────────────────────── */
  function open(pageId){
    ensureDom();
    _root.classList.add('open');
    document.body.style.overflow = 'hidden';
    if(pageId && PAGES.some(function(p){ return p.id === pageId; })) renderDetail(pageId);
    else renderList();
  }
  function close(){
    if(!_root) return;
    _root.classList.remove('open');
    document.body.style.overflow = '';
  }

  window.PageAnalyticsOverlay = { open: open, close: close, PAGES: PAGES };
})();
