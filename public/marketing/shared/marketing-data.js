/**
 * marketing-data.js — Data layer for Marketing & Growth pages.
 * ──────────────────────────────────────────────────────────────
 * Every function tries the real backend first and falls back to
 * demo data. Set window.DROBOARD_API_BASE to switch to production.
 */
(function () {
  'use strict';
  if (window.__marketingData) return;
  window.__marketingData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/marketing';
  const TIMEOUT_MS = 2500;

  async function callBackend(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Bad response: ' + res.status);
      return res.status === 204 ? null : await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms || 200 + Math.random() * 200)); }
  function uid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(); }

  const DEMO = {
    /* ── Dashboard ── */
    dashboard: {
      activeCampaigns: 4,
      livePromotions: 6,
      sponsoredPlacementsLive: 3,
      homepageBannersLive: 2,
      avgEngagementRate: '6.8%',
      emailsSentThisMonth: '182K',
      upcomingEventsCount: 2,

      quickActions: [
        { label: 'Launch New Promotion',      icon: 'fa-bullhorn', cls: 'accent', href: 'promotions.html' },
        { label: 'Schedule Homepage Banner',  icon: 'fa-image',    cls: 'blue',   href: 'homepage-banners.html' },
        { label: 'Create Email Campaign',     icon: 'fa-envelope', cls: 'purple', href: 'email-campaigns.html' },
        { label: 'Set Up New Contest',        icon: 'fa-gift',     cls: 'green',  href: 'events-contests.html' },
      ],

      upcomingEvents: [
        { name:'Summer Romance Writing Contest', type:'Contest', date:'Starts Aug 1, 2026', detail:'$5,000 prize · 214 entries so far' },
        { name:'Reader Appreciation Week', type:'Event', date:'Starts Aug 15, 2026', detail:'Platform-wide reading challenge' },
      ],

      analyticsSnapshot: { impressions:'3.4M', clicks:'218K', ctr:'6.4%', conversions:'12.8K', revenueLift:'+14%' },

      recentActivity: [
        { icon:'fa-bullhorn', color:'accent', text:'<b>Summer Romance Push</b> crossed 480K impressions', time:'1h ago' },
        { icon:'fa-image',    color:'blue',   text:'Homepage banner for <b>New Author Spotlight</b> went live', time:'3h ago' },
        { icon:'fa-envelope', color:'purple', text:'<b>Back-to-School Reader Drive</b> email sequence scheduled', time:'5h ago' },
        { icon:'fa-gift',     color:'green',  text:'<b>Summer Romance Writing Contest</b> passed 200 entries', time:'8h ago' },
        { icon:'fa-star',     color:'amber',  text:'Sponsored placement renewed for <b>Werewolf Week</b>', time:'1d ago' },
        { icon:'fa-chart-line', color:'blue', text:'Weekly marketing report generated — CTR up 1.2pt', time:'1d ago' },
      ],
    },

    /* ── Campaigns: ONE shared list (campaigns.html + ad-manager + dashboard).
       Same records the campaigns page uses, so status cascades to ads. ── */
    campaigns: [
      { id:'CMP-001', type:'story', objective:'story-reads', name:'Summer Romance Push', status:'live',
        storyId:'ST-001', storyTitle:'Bound by the Ruthless Alpha', storyAuthor:'Chioma Okafor', storyCover:'https://i.postimg.cc/fkdXzjS8/wolf.jpg', storyGenre:'Romance & Betrayal',
        placements:['discover','feed','status'], startDate:'2026-07-10', endDate:'2026-08-05',
        hasBudget:false, budget:0, spent:0, owner:'Tari Benson',
        description:'Boosting romance genre visibility across homepage, feed and status during the summer reading peak.',
        reach:482000, impressions:610000, clicks:34400, ctr:7.2, conversions:1840, updatedAt:'2026-07-27T10:00:00Z' },
      { id:'CMP-002', type:'story', objective:'followers', name:'New Author Spotlight', status:'live',
        storyId:'ST-006', storyTitle:'Revenge at the Ivy League', storyAuthor:'Wren Okonkwo', storyCover:'https://i.postimg.cc/cgLZJNmC/8.jpg', storyGenre:'Campus & Revenge',
        placements:['discover','end-of-story'], startDate:'2026-07-15', endDate:'2026-08-02',
        hasBudget:false, budget:0, spent:0, owner:'Tari Benson',
        description:'Rotating spotlight for newly onboarded authors, placed on the homepage banner and at the end of related chapters.',
        reach:210000, impressions:265000, clicks:11300, ctr:5.4, conversions:640, updatedAt:'2026-07-26T09:00:00Z' },
      { id:'CMP-003', type:'business', objective:'brand-awareness', name:'PiggyVest Reader Drive', status:'live',
        advertiserName:'PiggyVest', advertiserEmail:'ads@piggyvest.com',
        placements:['feed','comments','search'], startDate:'2026-07-01', endDate:'2026-08-15',
        hasBudget:true, budget:12000, spent:6400, owner:'Tari Benson',
        description:'Native ad placements for PiggyVest across the social feed, comment sections and search results.',
        reach:390000, impressions:520000, clicks:19800, ctr:3.8, conversions:2100, updatedAt:'2026-07-27T08:00:00Z' },
      { id:'CMP-004', type:'story', objective:'engagement', name:'Werewolf Week', status:'live',
        storyId:'ST-003', storyTitle:"Wolf King's Vow", storyAuthor:'Elena Vasquez', storyCover:'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', storyGenre:'Werewolf & Fantasy',
        placements:['genre-hub','discover','status'], startDate:'2026-07-24', endDate:'2026-07-31',
        hasBudget:false, budget:0, spent:0, owner:'Chioma Reddy',
        description:'Week-long push for werewolf & fantasy titles across the genre hub, homepage and status row.',
        reach:315000, impressions:401000, clicks:24500, ctr:6.1, conversions:1120, updatedAt:'2026-07-27T08:00:00Z' },
      { id:'CMP-005', type:'business', objective:'brand-awareness', name:'Konga Back-to-School', status:'scheduled',
        advertiserName:'Konga', advertiserEmail:'partnerships@konga.com',
        placements:['feed','search','end-of-story'], startDate:'2026-08-10', endDate:'2026-08-24',
        hasBudget:true, budget:9000, spent:0, owner:'Tari Benson',
        description:'Back-to-school shopping push timed around the seasonal reader spike.',
        reach:0, impressions:0, clicks:0, ctr:0, conversions:0, updatedAt:'2026-07-25T14:20:00Z' },
      { id:'CMP-006', type:'story', objective:'story-reads', name:"Editor's Choice Autumn Preview", status:'draft',
        storyId:'ST-008', storyTitle:'The Letter He Never Sent', storyAuthor:'Efe_O', storyCover:'https://i.postimg.cc/N9jY0w4m/5.jpg', storyGenre:'Elegy & Heartbreak',
        placements:['profile','discover'], startDate:'', endDate:'',
        hasBudget:false, budget:0, spent:0, owner:'Chioma Reddy',
        description:'Draft preview push for autumn editor picks — not yet scheduled.',
        reach:0, impressions:0, clicks:0, ctr:0, conversions:0, updatedAt:'2026-07-20T11:00:00Z' },
      { id:'CMP-007', type:'story', objective:'story-reads', name:'Mafia & Urban Flash Push', status:'ended',
        storyId:'ST-004', storyTitle:'Betrayed by the Mafia Prince', storyAuthor:'Marcus Webb Jr.', storyCover:'https://i.postimg.cc/WF1j4Pnh/6.jpg', storyGenre:'Mafia & Urban',
        placements:['discover','feed'], startDate:'2026-06-01', endDate:'2026-06-07',
        hasBudget:false, budget:0, spent:0, owner:'Tari Benson',
        description:'One-week push on mafia & urban titles across homepage and feed.',
        reach:198000, impressions:240000, clicks:21400, ctr:8.9, conversions:980, updatedAt:'2026-06-08T09:00:00Z' },
      { id:'CMP-008', type:'business', objective:'brand-awareness', name:'Historical Romance Discount (Jumia)', status:'paused',
        advertiserName:'Jumia', advertiserEmail:'brands@jumia.com',
        placements:['feed','comments'], startDate:'2026-07-01', endDate:'2026-08-15',
        hasBudget:true, budget:5000, spent:2870, owner:'Tari Benson',
        description:'Ongoing discount campaign for Jumia, temporarily paused for creative refresh.',
        reach:64000, impressions:81000, clicks:3480, ctr:4.3, conversions:290, updatedAt:'2026-07-22T16:40:00Z' },
      { id:'CMP-009', type:'story', objective:'inner-circle', name:'Historical & Regency Highlight', status:'live',
        storyId:'ST-005', storyTitle:"The Duke's Secret", storyAuthor:'Isabelle Moreau', storyCover:'https://i.postimg.cc/fkdXzjSj/wife.jpg', storyGenre:'Historical & Regency',
        placements:['search','genre-hub','end-of-story'], startDate:'2026-07-18', endDate:'2026-08-01',
        hasBudget:false, budget:0, spent:0, owner:'Chioma Reddy',
        description:'Surfacing a completed fan-favourite in search and the genre hub.',
        reach:143000, impressions:171000, clicks:9700, ctr:5.7, conversions:410, updatedAt:'2026-07-27T07:00:00Z' },
      { id:'CMP-010', type:'story', objective:'story-reads', name:'Twist & Drama Runaway Bride Push', status:'live',
        storyId:'ST-007', storyTitle:'The Runaway Bride in Socked Feet', storyAuthor:'Ifeanyi_Story', storyCover:'https://i.postimg.cc/tY7KnJyr/images.jpg', storyGenre:'Twist & Drama',
        placements:['discover','feed','search','status','end-of-story'], startDate:'2026-07-05', endDate:'2026-08-05',
        hasBudget:false, budget:0, spent:0, owner:'Tari Benson',
        description:'Full-surface push for the platform\u2019s #1 story this month.',
        reach:520000, impressions:640000, clicks:44800, ctr:7.0, conversions:2650, updatedAt:'2026-07-27T09:30:00Z' },
    ],
  };

  /* ── Ad Manager: inventory shared with services/ad-service.js ──
     Demo persistence goes to localStorage 'dro_ads_override', which the
     client AdService reads — so admin edits affect client pages
     immediately in demo. Live, these hit /api/marketing/ads. */
  const ADS_OVERRIDE_KEY = 'dro_ads_override';
  const ADS_STATS_KEY = 'dro_ads_stats';

  function readAdOverrides() {
    try { return JSON.parse(localStorage.getItem(ADS_OVERRIDE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeAdOverrides(ov) {
    try { localStorage.setItem(ADS_OVERRIDE_KEY, JSON.stringify(ov)); } catch (e) {}
  }
  function defaultAdInventory() {
    const d = window.DemoData || {};
    return {
      pools: JSON.parse(JSON.stringify(d.AD_POOLS || { platform: [], book: [], native: [], follow: [], banner: [] })),
      placements: JSON.parse(JSON.stringify(d.AD_PLACEMENTS || { discover: { interval: 6 }, feed: { interval: 4 }, genreHub: { interval: 3 } })),
    };
  }
  function currentAdInventory() {
    const base = defaultAdInventory();
    const ov = readAdOverrides();
    if (ov.pools && Object.keys(ov.pools).length) base.pools = ov.pools;
    if (ov.placements && Object.keys(ov.placements).length) base.placements = ov.placements;
    return base;
  }

  /* ── Campaign ↔ ad connection ──
     Campaigns gate their ads: pausing/ending a campaign switches its ads
     off (flagged autoPaused); resuming restores only those — a manually
     switched-off ad stays off. Campaigns persist to localStorage in demo
     so the cascade survives reloads, like the ad overrides do. */
  const CAMPS_KEY = 'dro_marketing_campaigns';
  function readStoredCamps() {
    try { return JSON.parse(localStorage.getItem(CAMPS_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function writeStoredCamps(list) {
    try { localStorage.setItem(CAMPS_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function persistCamps() { writeStoredCamps(DEMO.campaigns); }
  function cascadeCampaignStatus(id, status) {
    const off = (status === 'paused' || status === 'ended');
    const on = (status === 'live' || status === 'scheduled');
    if (!off && !on) return;
    const inv = currentAdInventory();
    let changed = false;
    Object.keys(inv.pools || {}).forEach(f => {
      (inv.pools[f] || []).forEach(ad => {
        if (String(ad.campaign || '') !== String(id)) return;
        if (off && ad.active !== false) { ad.active = false; ad.autoPaused = true; changed = true; }
        if (on && ad.autoPaused) { ad.active = true; delete ad.autoPaused; changed = true; }
      });
    });
    if (changed) writeAdOverrides(inv);
  }
  function liveAdCount() {
    const inv = currentAdInventory();
    let n = 0;
    Object.keys(inv.pools || {}).forEach(f => {
      (inv.pools[f] || []).forEach(ad => { if (ad.active !== false) n++; });
    });
    return n;
  }

  // Demo campaigns persist (like ad overrides) so status cascades survive reloads
  (function seedStoredCamps() {
    if (!readStoredCamps()) writeStoredCamps(DEMO.campaigns);
    else DEMO.campaigns = readStoredCamps();
  })();

  window.MarketingData = {
    async getDashboard() {
      try { return await callBackend('/dashboard'); }
      catch (e) {
        await delay();
        const dash = JSON.parse(JSON.stringify(DEMO.dashboard));
        const liveCamps = DEMO.campaigns.filter(c => c.status === 'live').length;
        dash.activeCampaigns = DEMO.campaigns.filter(c => ['live', 'scheduled'].includes(c.status)).length;
        dash.livePromotions = liveCamps;
        dash.sponsoredPlacementsLive = liveAdCount();
        return dash;
      }
    },

    /* ── Campaigns: full CRUD ── */
    async getCampaigns() {
      try {
        const data = await callBackend('/campaigns');
        return Array.isArray(data) ? data : data.campaigns;
      } catch (e) {
        await delay();
        DEMO.campaigns = readStoredCamps() || DEMO.campaigns;
        return JSON.parse(JSON.stringify(DEMO.campaigns));
      }
    },

    async createCampaign(payload) {
      try {
        return await callBackend('/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } catch (e) {
        await delay();
        const record = Object.assign({
          id: uid('CMP'), spent: 0, impressions: 0, clicks: 0, reach: 0, ctr: 0, conversions: 0,
        }, payload);
        DEMO.campaigns.unshift(record);
        persistCamps();
        cascadeCampaignStatus(record.id, record.status);
        return JSON.parse(JSON.stringify(record));
      }
    },

    async updateCampaign(id, payload) {
      try {
        return await callBackend('/campaigns/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } catch (e) {
        await delay();
        const idx = DEMO.campaigns.findIndex(c => c.id === id);
        if (idx === -1) throw new Error('Campaign not found');
        DEMO.campaigns[idx] = Object.assign({}, DEMO.campaigns[idx], payload);
        persistCamps();
        if (payload && payload.status) cascadeCampaignStatus(id, payload.status);
        return JSON.parse(JSON.stringify(DEMO.campaigns[idx]));
      }
    },

    async deleteCampaign(id) {
      try {
        return await callBackend('/campaigns/' + id, { method: 'DELETE' });
      } catch (e) {
        await delay();
        const idx = DEMO.campaigns.findIndex(c => c.id === id);
        if (idx === -1) throw new Error('Campaign not found');
        DEMO.campaigns.splice(idx, 1);
        persistCamps();
        return { id, deleted: true };
      }
    },

    /* Ads linked to one campaign (for campaign cards / detail views) */
    async getAdsByCampaign(id) {
      try {
        const data = await callBackend('/ads?campaign=' + encodeURIComponent(id));
        const pools = data.pools || data;
        const out = [];
        Object.keys(pools || {}).forEach(f => {
          (pools[f] || []).forEach(ad => {
            if (String(ad.campaign || '') === String(id)) out.push(Object.assign({ format: f }, ad));
          });
        });
        return out;
      } catch (e) {
        await delay();
        const inv = currentAdInventory();
        const out = [];
        Object.keys(inv.pools || {}).forEach(f => {
          (inv.pools[f] || []).forEach(ad => {
            if (String(ad.campaign || '') === String(id)) out.push(Object.assign({ format: f }, ad));
          });
        });
        return out;
      }
    },

    /* ── Ad Manager: inventory ── */
    async getAdInventory() {
      try {
        return await callBackend('/ads/inventory');
      } catch (e) {
        await delay();
        return currentAdInventory();
      }
    },

    async saveAd(format, ad) {
      const payload = Object.assign({}, ad, { format });
      try {
        return await callBackend('/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } catch (e) {
        await delay();
        const inv = currentAdInventory();
        inv.pools[format] = inv.pools[format] || [];
        if (!payload.id) payload.id = uid('AD');
        const idx = inv.pools[format].findIndex(a => String(a.id) === String(payload.id));
        if (idx === -1) inv.pools[format].unshift(payload);
        else inv.pools[format][idx] = Object.assign({}, inv.pools[format][idx], payload);
        writeAdOverrides(inv);
        return JSON.parse(JSON.stringify(payload));
      }
    },

    async deleteAd(format, id) {
      try {
        return await callBackend('/ads/' + encodeURIComponent(id), { method: 'DELETE' });
      } catch (e) {
        await delay();
        const inv = currentAdInventory();
        inv.pools[format] = (inv.pools[format] || []).filter(a => String(a.id) !== String(id));
        writeAdOverrides(inv);
        return { id, deleted: true };
      }
    },

    async toggleAd(format, id, active) {
      try {
        return await callBackend('/ads/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
      } catch (e) {
        await delay();
        const inv = currentAdInventory();
        const ad = (inv.pools[format] || []).find(a => String(a.id) === String(id));
        if (!ad) throw new Error('Ad not found');
        ad.active = !!active;
        writeAdOverrides(inv);
        return JSON.parse(JSON.stringify(ad));
      }
    },

    async savePlacements(patch) {
      try {
        return await callBackend('/ads/placements', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      } catch (e) {
        await delay();
        const inv = currentAdInventory();
        Object.keys(patch || {}).forEach(page => {
          inv.placements[page] = Object.assign({}, inv.placements[page], patch[page]);
        });
        writeAdOverrides(inv);
        return JSON.parse(JSON.stringify(inv.placements));
      }
    },

    async resetAds() {
      try {
        return await callBackend('/ads/reset', { method: 'POST' });
      } catch (e) {
        await delay();
        try { localStorage.removeItem(ADS_OVERRIDE_KEY); } catch (e2) {}
        return currentAdInventory();
      }
    },

    async getAdStats() {
      let tracked = {};
      try { tracked = JSON.parse(localStorage.getItem(ADS_STATS_KEY) || '{}') || {}; } catch (e) {}
      try {
        const live = await callBackend('/ads/stats');
        if (live) return live;
      } catch (e) { /* fall through to demo merge */ }
      await delay(120);
      const inv = currentAdInventory();
      const rows = [];
      Object.keys(inv.pools).forEach(format => {
        (inv.pools[format] || []).forEach(ad => {
          const t = tracked[ad.id] || { impressions: 0, clicks: 0 };
          const ctr = t.impressions ? ((t.clicks / t.impressions) * 100).toFixed(1) : '0.0';
          rows.push({ id: ad.id, format, title: ad.title || ad.heading || ad.brand || ad.name || ad.id, active: ad.active !== false, impressions: t.impressions, clicks: t.clicks, ctr });
        });
      });
      return rows;
    },
  };
})();