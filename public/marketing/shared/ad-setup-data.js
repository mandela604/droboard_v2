/* ===============================================================
   AD SETUP DATA — catalogs for the ad setup page.
   Demo source of truth for formats, surfaces, creative fields and
   audience segments. Live: replace Ludwig/getAudienceCatalog() reads
   with /api/marketing/audience-catalog (same shape).
   =============================================================== */
(function () {
  'use strict';

  var FORMATS = [
    { id: 'platform', label: 'Platform', icon: 'fa-megaphone', desc: 'House promo card' },
    { id: 'book', label: 'Book promo', icon: 'fa-book-open', desc: 'Gold card for a story' },
    { id: 'native', label: 'Native', icon: 'fa-newspaper', desc: 'Sponsored in-feed post' },
    { id: 'embed', label: 'Network embed', icon: 'fa-code', desc: 'AdSense / Adsterra / Monetag tag' },
    { id: 'follow', label: 'Follow', icon: 'fa-user-plus', desc: 'Rich author follow card' },
    { id: 'banner', label: 'Banner', icon: 'fa-flag', desc: 'Brand headline strip' },
    { id: 'minibanner', label: 'Mini banner', icon: 'fa-rectangle-ad', desc: 'Small horizontal image banner (leaderboard)' },
    { id: 'spotlight', label: 'Spotlight', icon: 'fa-bolt', desc: 'Full-screen story takeover with countdown' },
    { id: 'promo', label: 'Promo slide', icon: 'fa-images', desc: 'Library / hub slider slide' },
  ];

  var PAGES = [
    { id: 'discover', label: 'Discover' },
    { id: 'feed', label: 'Feed' },
    { id: 'genreHub', label: 'Genre Hub' },
    { id: 'library', label: 'Library' },
    { id: 'store', label: 'Store (Coins & Subs)' },
    { id: 'story', label: 'Bridge Page' },
    { id: 'bookReader', label: 'Book Reader' },
    { id: 'home', label: 'Homepage' },
    { id: 'fullReader', label: 'Full Reader' },
    { id: 'scrollReader', label: 'Scroll Reader' },
    { id: 'comments', label: 'Comments (all)' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'debate', label: 'Debate' },
    { id: 'droboardPage', label: 'Droboard Page' },
    { id: 'collection', label: 'Collection' },
    { id: 'followers', label: 'Followers' },
    { id: 'profile', label: 'Profile' },
    { id: 'genreStories', label: 'Genre Stories' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'blog', label: 'Blog' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'search', label: 'Search Results' },
    { id: 'status', label: 'Status Viewer' },
  ];

  /* Slot registry per surface (mirrors the backend slot ids). An ad with an
     empty slots list serves on every slot of its checked pages. Shared by
     ad-setup-service.js (ad setup page) and ad-manager.js (placements). */
  var PAGE_SLOTS = {
    fullReader: [
      { id: 'fullReader:top', label: 'Top (above chapter)' },
      { id: 'fullReader:per-300-words', label: 'In-text (every N words)' },
      { id: 'fullReader:bottom', label: 'Bottom (after chapter)' },
    ],
    scrollReader: [
      { id: 'scrollReader:top', label: 'Top' },
      { id: 'scrollReader:per-300-words', label: 'In-text (every N words)' },
      { id: 'scrollReader:bottom', label: 'Bottom (end of page)' },
    ],
    comments: [
      { id: 'comments:list-top', label: 'List top' },
      { id: 'comments:every-nth', label: 'Every Nth' },
      { id: 'comments:thread-top', label: 'Thread top' },
    ],
    feed: [{ id: 'feed:in-feed', label: 'In-feed' }],
    discover: [
      { id: 'discover:strip', label: 'Strip' },
      { id: 'discover:banner-top', label: 'Inline banner (after Continue Reading)' },
      { id: 'discover:inline-banner', label: 'Inline banner (after New Releases)' },
      { id: 'discover:banner-bottom', label: 'Inline banner (above More Stories)' },
      { id: 'discover:spotlight', label: 'Full-screen spotlight' },
    ],
    genreHub: [{ id: 'genreHub:strip', label: 'Strip' }],
    library: [{ id: 'library:slider', label: 'Slider' }],
    store: [{ id: 'store:below-packs', label: 'Below the coin packs' }],
    droboardPage: [{ id: 'droboardPage:feed', label: 'Feed' }],
    collection: [{ id: 'collection:top', label: 'Top (below Follow)' }],
    discussion: [{ id: 'discussion:inline', label: 'Inline' }],
    debate: [
      { id: 'debate:top', label: 'Top (above question)' },
      { id: 'debate:inline', label: 'Inline (between arguments)' },
      { id: 'debate:thread-top', label: 'Thread top (view all replies)' },
    ],
    home: [{ id: 'home:swipe-card', label: 'Full-screen swipe card' }],
    story: [
      { id: 'story:main', label: 'Bridge page' },
    ],
    /* book-reader.html is its own surface (book detail + reviews), so its
       slot gets its own card instead of hiding under Bridge Page. */
    bookReader: [
      { id: 'bookReader:top', label: 'Top (above the book)' },
    ],
    genreStories: [{ id: 'genreStories:in-feed', label: 'Above the story list' }],
    leaderboard: [{ id: 'leaderboard:inline', label: 'Below the rankings' }],
    blog: [
      { id: 'blog:top', label: 'Top (above posts)' },
      { id: 'blog:bottom', label: 'Bottom (below posts)' },
    ],
    notifications: [{ id: 'notifications:in-feed', label: 'Above the list' }],
    search: [{ id: 'search:banner', label: 'Results banner' }],
    status: [{ id: 'status:every-3rd', label: 'Between stories (every Nth)' }],
  }; /* profile has page-level targeting only — no ad slot renders there */

  function pageSlots(pageId) { return PAGE_SLOTS[pageId] || []; }
  function pageLabel(pageId) {
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === pageId) return PAGES[i].label;
    return pageId;
  }
  /* Flat [{page, pageLabel, id, label}] for the slot-programming dropdown. */
  function allSlots() {
    var out = [];
    Object.keys(PAGE_SLOTS).forEach(function (pid) {
      (PAGE_SLOTS[pid] || []).forEach(function (s) {
        out.push({ page: pid, pageLabel: pageLabel(pid), id: s.id, label: s.label });
      });
    });
    return out;
  }

  /* field: [key, label, type] — type: text | area | img */
  var SPOT_STORY_FIELDS = [
    ['title', 'Story title', 'text'], ['author', 'Author', 'text'], ['authorAvatar', 'Author avatar URL (byline)', 'text'],
    ['genre', 'Genre', 'text'],
    ['chapters', 'Chapters', 'text'], ['reads', 'Reads', 'text'],
    ['preview', 'Preview line', 'area'], ['cta', 'CTA button', 'text'], ['img', 'Cover image (portrait)', 'img'],
  ];
  var SPOT_USER_FIELDS = [
    ['name', 'Creator name', 'text'], ['handle', 'Handle (without @)', 'text'],
    ['tagline', 'Tagline', 'area'], ['followers', 'Followers', 'text'],
    ['books', 'Books', 'text'], ['reads', 'Reads', 'text'],
    ['cta', 'CTA button', 'text'], ['avatar', 'Avatar', 'img'],
  ];
  /* Status-style leaderboard takeover — one top-three board per slide. */
  var SPOT_BOARD_FIELDS = [
    ['title', 'Lead line (blank = auto)', 'text'],
    ['sub', 'Sub line (optional)', 'area'],
    ['cta', 'CTA button', 'text'],
  ];
  /* Any promotion with a destination URL — referral, offer, brand link. */
  var SPOT_PROMO_FIELDS = [
    ['brand', 'Brand / label', 'text'], ['title', 'Headline', 'text'],
    ['sub', 'Body line', 'area'], ['badge', 'Badge (e.g. 250 coins)', 'text'],
    ['cta', 'CTA button', 'text'], ['img', 'Artwork (square)', 'img'],
  ];
  var FIELDS = {
    platform: [['sponsor', 'Sponsor', 'text'], ['title', 'Headline', 'text'], ['cta', 'CTA button', 'text'], ['img', 'Cover image', 'img']],
    book: [['title', 'Book title', 'text'], ['author', 'Author', 'text'], ['genre', 'Genre', 'text'], ['chapters', 'Chapters', 'text'], ['preview', 'Preview line', 'area'], ['cta', 'CTA button', 'text'], ['img', 'Cover image', 'img']],
    native: [['brand', 'Brand', 'text'], ['heading', 'Headline', 'text'], ['body', 'Body', 'area'], ['cta', 'CTA button', 'text'], ['image', 'Image', 'img']],
    embed: [['brand', 'Network / label', 'text'], ['title', 'Internal label', 'text'], ['code', 'Ad network code (script / HTML)', 'area']],
    follow: [['name', 'Display name', 'text'], ['handle', 'Handle', 'text'], ['tagline', 'Tagline', 'text'], ['headline', 'Headline', 'text'], ['body', 'Body', 'area'], ['cta', 'Follow button', 'text'], ['avatar', 'Avatar', 'img'], ['cover', 'Cover image', 'img']],
    banner: [['brand', 'Brand', 'text'], ['headline', 'Headline', 'text'], ['sub', 'Sub line', 'text'], ['cta', 'CTA button', 'text']],
    minibanner: [['img', 'Banner image (wide, ~800×180)', 'img'], ['brand', 'Brand', 'text'], ['headline', 'Headline', 'text'], ['sub', 'Sub line', 'text'], ['cta', 'CTA button', 'text']],
    promo: [['title', 'Title', 'text'], ['sub', 'Sub line', 'text'], ['author', 'Author', 'text'], ['cta', 'CTA button', 'text'], ['genre', 'Hub genre (blank = all hubs)', 'text'], ['img', 'Slide image', 'img']],
    spotlight: SPOT_STORY_FIELDS.concat(SPOT_USER_FIELDS),
    spotlightStory: SPOT_STORY_FIELDS,
    spotlightUser: SPOT_USER_FIELDS,
    spotlightBoard: SPOT_BOARD_FIELDS,
    spotlightPromo: SPOT_PROMO_FIELDS,
  };

  /* Spot creative types the setup wizard + ad manager understand. */
  var SPOT_KINDS = [
    { id: 'story', label: 'A story', icon: 'fa-book-open', desc: 'Poster takeover for a story' },
    { id: 'user', label: 'A creator', icon: 'fa-user', desc: 'Grow an author\'s followers' },
    { id: 'board', label: 'Top 3 leaderboard', icon: 'fa-trophy', desc: 'Writers or readers — status-style slides' },
    { id: 'promo', label: 'Promotion / link', icon: 'fa-gift', desc: 'Any offer — e.g. refer a friend, earn coins' },
  ];
  var SPOT_BOARD_TYPES = [
    { id: 'writers', label: 'Top writers' },
    { id: 'readers', label: 'Top readers' },
  ];
  var SPOT_PERIODS = [
    { id: 'last_week', label: 'Last week' },
    { id: 'last_month', label: 'Last month' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
  ];

  var TOTAL_READERS = 2400000;
  /* The segment catalog lives in one place — services/audience-rules.js —
     so the Ad Manager editor, ad setup and the client matcher cannot drift
     apart. Nothing here copies it. */
  function segments() {
    return (window.DroboardAudienceRules && window.DroboardAudienceRules.all()) || [];
  }
  /* Retired segments still count toward an existing ad's estimate — the ad
     keeps serving to them, so hiding them from the picker must not quietly
     shrink the reach shown on its review step. */
  function segmentsKnown() {
    return (window.DroboardAudienceRules && window.DroboardAudienceRules.all({ includeRetired: true })) || segments();
  }

  var GENRES = [
    { name: 'Romance', count: 428000 },
    { name: 'Fantasy', count: 312500 },
    { name: 'Billionaire & CEO', count: 349100 },
    { name: 'Werewolf', count: 264900 },
    { name: 'Mafia & Urban', count: 201800 },
    { name: 'Twist & Drama', count: 187600 },
    { name: 'Campus & Revenge', count: 176300 },
    { name: 'Horror', count: 154200 },
    { name: 'Heartbreak & Elegy', count: 132400 },
    { name: 'Comedy', count: 121900 },
    { name: 'Historical & Regency', count: 98700 },
    { name: 'Dark Fiction', count: 88300 },
    { name: 'Spiritual', count: 54200 },
  ];

  /* Tracked reader countries only (backend analytics set). Selecting
     countries scales the reach estimate by their reader share. */
  var TRACKED_COUNTRIES = [
    { code: 'NG', name: 'Nigeria', share: 0.44 },
    { code: 'GH', name: 'Ghana', share: 0.11 },
    { code: 'KE', name: 'Kenya', share: 0.08 },
    { code: 'ZA', name: 'South Africa', share: 0.06 },
    { code: 'US', name: 'United States', share: 0.09 },
    { code: 'GB', name: 'United Kingdom', share: 0.05 },
    { code: 'CA', name: 'Canada', share: 0.03 },
    { code: 'IN', name: 'India', share: 0.09 },
    { code: 'PH', name: 'Philippines', share: 0.05 },
  ];

  function fmtN(n) { return Number(n || 0).toLocaleString('en-US'); }

  /* Combined reach: union of selected sets with an overlap discount,
     scaled by selected country shares. Demo math — the backend replaces
     this with real audience counts. */
  function estimateAudience(sel) {
    sel = sel || {};
    var segIds = sel.segments || [];
    var genres = sel.genres || [];
    var countries = sel.countries || [];
    var SEG_MAP = {};
    segmentsKnown().forEach(function (s) { SEG_MAP[s.id] = s; });
    var sum = 0, sets = 0;
    segIds.forEach(function (id) { if (SEG_MAP[id]) { sum += SEG_MAP[id].reach; sets++; } });
    genres.forEach(function (g) {
      var found = null;
      GENRES.forEach(function (x) { if (x.name === g) found = x; });
      if (found) { sum += found.count; sets++; }
    });
    var share = 1;
    if (countries.length) {
      share = 0;
      TRACKED_COUNTRIES.forEach(function (c) { if (countries.indexOf(c.code) !== -1) share += c.share; });
    }
    if (!sets) return { reach: Math.round(TOTAL_READERS * share), sets: 0, capped: false };
    var reach = Math.round((sets > 1 ? sum * 0.7 : sum) * share);
    var capped = reach > TOTAL_READERS;
    return { reach: Math.min(TOTAL_READERS, reach), sets: sets, capped: capped };
  }

  function segmentLabel(id) {
    var list = segments();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i].label;
    }
    return id;
  }

  /* Live reach: pull /api/marketing/audience-catalog and cache the counts
     in the audience-rules store, which merges them over the definitions.
     Anonymous/offline -> the seeded figures stand. */
  function refreshCatalog() {
    try {
      return fetch('/api/marketing/audience-catalog', { credentials: 'include' }).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function (j) {
        if (!j) return;
        if (window.DroboardAudienceRules) {
          var byId = {};
          (j.segments || []).forEach(function (s) { if (s.id && s.reach != null) byId[s.id] = s.reach; });
          DroboardAudienceRules.setReach(byId);
        }
        if (Array.isArray(j.genres) && j.genres.length) {
          GENRES.length = 0;
          j.genres.forEach(function (g) { if (g.name) GENRES.push({ name: g.name, count: g.count || 0 }); });
        }
        if (j.totalReaders) {
          TOTAL_READERS = j.totalReaders;
          if (window.AdSetupData) window.AdSetupData.TOTAL_READERS = TOTAL_READERS;
        }
      }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }
  refreshCatalog();
  try { setInterval(refreshCatalog, 10 * 60 * 1000); } catch (e) {}

  /* Goal intents: what the marketer wants to promote. Each maps to the
     right card format, so setup feels guided (Facebook-style) while the
     engine underneath stays format-driven. */
  var GOALS = [
    { id: 'story', label: 'Promote a story', icon: 'fa-book-open', desc: 'Gold book card for a chapter or story', format: 'book' },
    { id: 'author', label: 'Promote an author', icon: 'fa-user-plus', desc: 'Rich follow card that grows followers', format: 'follow' },
    { id: 'offer', label: 'Sell coins or subscriptions', icon: 'fa-coins', desc: 'Platform card linked to a Finance offer', format: 'platform' },
    { id: 'sponsored', label: 'Sponsored content', icon: 'fa-newspaper', desc: 'Native in-feed post from a brand', format: 'native' },
    { id: 'brand', label: 'Brand awareness', icon: 'fa-flag', desc: 'Bold banner strip across surfaces', format: 'banner' },
    { id: 'miniBanner', label: 'Compact image banner', icon: 'fa-rectangle-ad', desc: 'Small horizontal banner between content sections', format: 'minibanner' },
    { id: 'slider', label: 'Feature in sliders', icon: 'fa-images', desc: 'Library and hub slider slide', format: 'promo' },
    { id: 'spotlight', label: 'Full-screen spotlight', icon: 'fa-bolt', desc: 'Story or creator takeover with a countdown timer', format: 'spotlight', spotKind: 'story' },
    { id: 'leaderboard', label: 'Top 3 writers or readers', icon: 'fa-trophy', desc: 'Status-style leaderboard takeover that auto-advances', format: 'spotlight', spotKind: 'board' },
    { id: 'referral', label: 'Promotion or referral link', icon: 'fa-gift', desc: 'Any link — e.g. refer a friend to earn coins', format: 'spotlight', spotKind: 'promo' },
    { id: 'network', label: 'Run a network tag', icon: 'fa-code', desc: 'Paste an AdSense / Adsterra / Monetag tag', format: 'embed' },
  ];

  /* The surface list the campaign wizard sells against. Same ids as the ad
     setup checkboxes and the `data-ad-slot` markers, so a campaign's
     entitlement and an ad's placement are the same vocabulary — a campaign
     that says "Genre Hub" constrains ad setup to genreHub, nothing else.
     (campaigns-page-service.js + campaign-wizard.js consume this.) */
  var SURFACE_ICONS = {
    discover: 'fa-compass', feed: 'fa-rss', genreHub: 'fa-layer-group', library: 'fa-bookmark',
    store: 'fa-coins', story: 'fa-link', bookReader: 'fa-book-open', home: 'fa-house',
    fullReader: 'fa-book-open', scrollReader: 'fa-book', comments: 'fa-comment-dots',
    discussion: 'fa-comments', debate: 'fa-scale-balanced', droboardPage: 'fa-hashtag',
    collection: 'fa-layer-group', followers: 'fa-user-group', profile: 'fa-circle-user',
    genreStories: 'fa-list-ol', leaderboard: 'fa-ranking-star', blog: 'fa-blog',
    notifications: 'fa-bell', search: 'fa-magnifying-glass', status: 'fa-circle-notch',
  };
  var CAMPAIGN_SURFACES = PAGES.map(function (p) {
    var slots = pageSlots(p.id);
    return {
      id: p.id, label: p.label, icon: SURFACE_ICONS[p.id] || 'fa-rectangle-ad',
      desc: slots.length
        ? slots.length + ' slot' + (slots.length === 1 ? '' : 's') + ': ' + slots.map(function (s) { return s.label; }).join(', ')
        : 'Page-level targeting only (no slot picker)',
    };
  });
  /* Legacy campaign placement ids (pre-registry rows) -> surface ids. Old
     campaigns still display, and their entitlement still constrains ad setup
     where the mapping is unambiguous. */
  var LEGACY_SURFACE_ALIAS = {
    'genre-hub': 'genreHub', 'end-of-story': 'fullReader', 'homepage': 'home',
    'social-feed': 'feed', 'status-stories': 'status',
  };
  function surfaceFromLegacy(id) { return LEGACY_SURFACE_ALIAS[id] || id; }
  /* Every slot id a campaign entitlement covers (all slots of the page when
     the campaign only recorded a page). */
  function campaignSlotIds(pages) {
    var out = [];
    (pages || []).forEach(function (raw) {
      var pid = surfaceFromLegacy(raw);
      if (String(raw).indexOf(':') !== -1) { if (out.indexOf(raw) === -1) out.push(raw); return; }
      pageSlots(pid).forEach(function (s) { if (out.indexOf(s.id) === -1) out.push(s.id); });
    });
    return out;
  }

  window.AdSetupData = {
    GOALS: GOALS,
    FORMATS: FORMATS,
    PAGES: PAGES,
    PAGE_SLOTS: PAGE_SLOTS,
    CAMPAIGN_SURFACES: CAMPAIGN_SURFACES,
    surfaceFromLegacy: surfaceFromLegacy,
    campaignSlotIds: campaignSlotIds,
    FIELDS: FIELDS,
    SPOT_KINDS: SPOT_KINDS,
    SPOT_BOARD_TYPES: SPOT_BOARD_TYPES,
    SPOT_PERIODS: SPOT_PERIODS,
    segments: segments,
    GENRES: GENRES,
    TRACKED_COUNTRIES: TRACKED_COUNTRIES,
    TOTAL_READERS: TOTAL_READERS,
    estimateAudience: estimateAudience,
    segmentLabel: segmentLabel,
    pageSlots: pageSlots,
    pageLabel: pageLabel,
    allSlots: allSlots,
    refreshCatalog: refreshCatalog,
  };
})();
