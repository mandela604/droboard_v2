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
    { id: 'promo', label: 'Promo slide', icon: 'fa-images', desc: 'Library / hub slider slide' },
  ];

  var PAGES = [
    { id: 'discover', label: 'Discover' },
    { id: 'feed', label: 'Feed' },
    { id: 'genreHub', label: 'Genre Hub' },
    { id: 'library', label: 'Library' },
    { id: 'series', label: 'Series Page' },
    { id: 'home', label: 'Homepage' },
    { id: 'fullReader', label: 'Full Reader' },
    { id: 'scrollReader', label: 'Scroll Reader' },
    { id: 'comments', label: 'Comments (all)' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'droboardPage', label: 'Droboard Page' },
    { id: 'profile', label: 'Profile' },
  ];

  /* field: [key, label, type] — type: text | area | img */
  var FIELDS = {
    platform: [['sponsor', 'Sponsor', 'text'], ['title', 'Headline', 'text'], ['cta', 'CTA button', 'text'], ['img', 'Cover image', 'img']],
    book: [['title', 'Book title', 'text'], ['author', 'Author', 'text'], ['genre', 'Genre', 'text'], ['rating', 'Rating', 'text'], ['chapters', 'Chapters', 'text'], ['preview', 'Preview line', 'area'], ['cta', 'CTA button', 'text'], ['img', 'Cover image', 'img']],
    native: [['brand', 'Brand', 'text'], ['heading', 'Headline', 'text'], ['body', 'Body', 'area'], ['cta', 'CTA button', 'text'], ['image', 'Image', 'img']],
    embed: [['brand', 'Network / label', 'text'], ['title', 'Internal label', 'text'], ['code', 'Ad network code (script / HTML)', 'area']],
    follow: [['name', 'Display name', 'text'], ['handle', 'Handle', 'text'], ['tagline', 'Tagline', 'text'], ['headline', 'Headline', 'text'], ['body', 'Body', 'area'], ['cta', 'Follow button', 'text'], ['avatar', 'Avatar', 'img'], ['cover', 'Cover image', 'img']],
    banner: [['brand', 'Brand', 'text'], ['headline', 'Headline', 'text'], ['sub', 'Sub line', 'text'], ['cta', 'CTA button', 'text']],
    promo: [['title', 'Title', 'text'], ['sub', 'Sub line', 'text'], ['author', 'Author', 'text'], ['cta', 'CTA button', 'text'], ['genre', 'Hub genre (blank = all hubs)', 'text'], ['img', 'Slide image', 'img']],
  };

  var TOTAL_READERS = 2400000;
  var SEGMENTS = [
    { id: 'top-tippers', label: 'Top Tippers', icon: 'fa-coins', color: '#f0a800', desc: 'Tipped a writer in the last 30 days — proven spenders.', reach: 184000, rule: { signal: 'tip_sent', windowDays: 30, op: 'gte', value: 1 } },
    { id: 'super-reactors', label: 'Super Reactors', icon: 'fa-heart', color: '#ff0050', desc: '50+ reactions in 30 days — the loudest engagers.', reach: 642000, rule: { signal: 'reactions', windowDays: 30, op: 'gte', value: 50 } },
    { id: 'commentators', label: 'Commentators', icon: 'fa-comments', color: '#38bdf8', desc: '10+ comments in 30 days — discussion drivers.', reach: 388000, rule: { signal: 'comments', windowDays: 30, op: 'gte', value: 10 } },
    { id: 'sharers', label: 'Sharers', icon: 'fa-share-nodes', color: '#34d399', desc: 'Shared 3+ stories — organic amplifiers.', reach: 296000, rule: { signal: 'shares', windowDays: 90, op: 'gte', value: 3 } },
    { id: 'savers', label: 'Savers', icon: 'fa-bookmark', color: '#60a5fa', desc: '20+ saved stories — library builders with intent.', reach: 514000, rule: { signal: 'saves', windowDays: 90, op: 'gte', value: 20 } },
    { id: 'unlockers', label: 'Chapter Unlockers', icon: 'fa-lock-open', color: '#d97706', desc: 'Unlocked 3+ chapters — pay for content already.', reach: 228000, rule: { signal: 'chapters_unlocked', windowDays: 90, op: 'gte', value: 3 } },
    { id: 'coin-buyers', label: 'Coin Buyers', icon: 'fa-wallet', color: '#a78bfa', desc: 'Bought coins in the last 90 days — wallet open.', reach: 176000, rule: { signal: 'coin_purchase', windowDays: 90, op: 'gte', value: 1 } },
    { id: 'premium', label: 'Premium Members', icon: 'fa-crown', color: '#fbbf24', desc: 'Active subscription — highest lifetime value.', reach: 96000, rule: { signal: 'subscription_active', op: 'eq', value: true } },
    { id: 'power-followers', label: 'Power Followers', icon: 'fa-user-group', color: '#f472b6', desc: 'Follows 25+ accounts — discovery hungry.', reach: 342000, rule: { signal: 'following_count', op: 'gte', value: 25 } },
    { id: 'binge-readers', label: 'Binge Readers', icon: 'fa-fire', color: '#ef4444', desc: '5+ hrs/week or a 10-day streak — always reading.', reach: 458000, rule: { signal: 'weekly_hours_or_streak', op: 'any', value: [5, 10] } },
    { id: 'finishers', label: 'Finishers', icon: 'fa-circle-check', color: '#22c55e', desc: 'Completed 3+ books — commit to full stories.', reach: 524000, rule: { signal: 'books_finished', op: 'gte', value: 3 } },
    { id: 'referrers', label: 'Referrers', icon: 'fa-user-plus', color: '#0ea5e9', desc: 'Brought 1+ converted reader — trusted voices.', reach: 88000, rule: { signal: 'referrals_converted', op: 'gte', value: 1 } },
    { id: 'ad-responders', label: 'Ad Responders', icon: 'fa-rectangle-ad', color: '#fb923c', desc: 'Clicked an ad in 30 days — proven to convert.', reach: 612000, rule: { signal: 'ad_click', windowDays: 30, op: 'gte', value: 1 } },
    { id: 'winback', label: 'Win-back', icon: 'fa-moon', color: '#818cf8', desc: 'Dormant 30+ days — re-engagement plays.', reach: 734000, rule: { signal: 'days_since_active', op: 'gte', value: 30 } },
    { id: 'newcomers', label: 'Newcomers', icon: 'fa-seedling', color: '#4ade80', desc: 'Joined in the last 14 days — onboarding window.', reach: 142000, rule: { signal: 'account_age_days', op: 'lte', value: 14 } },
    { id: 'lapsed-subscribers', label: 'Lapsed Subscribers', icon: 'fa-ticket', color: '#f97316', desc: 'Held Daily/Weekly/Monthly before but not subscribed now — win them back.', reach: 64000, rule: { signal: 'had_subscription', op: 'eq', value: true } },
    { id: 'writers', label: 'Writers', icon: 'fa-feather-pointed', color: '#e879f9', desc: 'Verified authors — for tools, promos, services.', reach: 28000, rule: { signal: 'is_writer', op: 'eq', value: true } },
  ];

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
    SEGMENTS.forEach(function (s) { SEG_MAP[s.id] = s; });
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
    for (var i = 0; i < SEGMENTS.length; i++) {
      if (SEGMENTS[i].id === id) return SEGMENTS[i].label;
    }
    return id;
  }

  /* Live reach: pull /api/marketing/audience-catalog and patch the demo
     numbers in place (same array refs, so ad-setup screens pick it up).
     Anonymous/offline -> demo figures stand. */
  function refreshCatalog() {
    try {
      return fetch('/api/marketing/audience-catalog', { credentials: 'include' }).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function (j) {
        if (!j) return;
        (j.segments || []).forEach(function (s) {
          for (var i = 0; i < SEGMENTS.length; i++) {
            if (SEGMENTS[i].id === s.id && s.reach != null) SEGMENTS[i].reach = s.reach;
          }
        });
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
    { id: 'story', label: 'Promote a story', icon: 'fa-book-open', desc: 'Gold book card for a chapter or series', format: 'book' },
    { id: 'author', label: 'Promote an author', icon: 'fa-user-plus', desc: 'Rich follow card that grows followers', format: 'follow' },
    { id: 'offer', label: 'Sell coins or subscriptions', icon: 'fa-coins', desc: 'Platform card linked to a Finance offer', format: 'platform' },
    { id: 'sponsored', label: 'Sponsored content', icon: 'fa-newspaper', desc: 'Native in-feed post from a brand', format: 'native' },
    { id: 'brand', label: 'Brand awareness', icon: 'fa-flag', desc: 'Bold banner strip across surfaces', format: 'banner' },
    { id: 'slider', label: 'Feature in sliders', icon: 'fa-images', desc: 'Library and hub slider slide', format: 'promo' },
    { id: 'network', label: 'Run a network tag', icon: 'fa-code', desc: 'Paste an AdSense / Adsterra / Monetag tag', format: 'embed' },
  ];

  window.AdSetupData = {
    GOALS: GOALS,
    FORMATS: FORMATS,
    PAGES: PAGES,
    FIELDS: FIELDS,
    SEGMENTS: SEGMENTS,
    GENRES: GENRES,
    TRACKED_COUNTRIES: TRACKED_COUNTRIES,
    TOTAL_READERS: TOTAL_READERS,
    estimateAudience: estimateAudience,
    segmentLabel: segmentLabel,
    refreshCatalog: refreshCatalog,
  };
})();
