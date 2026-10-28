'use strict';
/* Ad surface + slot registry — the single source of truth for where ads can
   render. Mirrors public/marketing/shared/ad-setup-data.js (PAGES / PAGE_SLOTS);
   keep the two in step until the console renders its checkboxes from
   GET /api/ads/surfaces instead.

   Why it exists: page and slot ids are the join between a marketing decision
   ("show on Genre Hub, top slot") and a frontend marker (`data-ad-slot`).
   A typo on either side used to save cleanly and serve nothing, forever, with
   no signal anywhere. Validating here turns that silent failure into a 400. */

const PAGES = [
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

const PAGE_SLOTS = {
  fullReader: ['fullReader:top', 'fullReader:per-300-words', 'fullReader:bottom'],
  scrollReader: ['scrollReader:top', 'scrollReader:per-300-words', 'scrollReader:bottom'],
  comments: ['comments:list-top', 'comments:every-nth', 'comments:thread-top'],
  feed: ['feed:in-feed'],
  discover: ['discover:strip', 'discover:banner-top', 'discover:inline-banner', 'discover:banner-bottom', 'discover:spotlight'],
  genreHub: ['genreHub:strip'],
  library: ['library:slider'],
  store: ['store:below-packs'],
  droboardPage: ['droboardPage:feed'],
  collection: ['collection:top'],
  discussion: ['discussion:inline'],
  debate: ['debate:top', 'debate:inline', 'debate:thread-top'],
  home: ['home:swipe-card'],
  story: ['story:main'],
  bookReader: ['bookReader:top'],
  genreStories: ['genreStories:in-feed'],
  leaderboard: ['leaderboard:inline'],
  blog: ['blog:top', 'blog:bottom'],
  notifications: ['notifications:in-feed'],
  search: ['search:banner'],
  status: ['status:every-3rd'],
  // followers / profile render through their own services: followers injects
  // sponsored rows programmatically (followers:in-feed), profile is
  // page-targeted only and has no slot marker.
  followers: ['followers:in-feed'],
  profile: [],
};

/* Placement docs the ad-manager writes that are not reader-facing surfaces.
   `spotlight` holds the full-screen takeover schedule (seconds, everyN,
   allowSkip, adId, delaySeconds, cooldownHours, startHour, endHour, days,
   audienceMode, match, segments). */
const CONFIG_PAGES = ['spotlight'];

const PAGE_IDS = PAGES.map(p => p.id);
const SLOT_IDS = Object.keys(PAGE_SLOTS).reduce((acc, pid) => acc.concat(PAGE_SLOTS[pid]), []);
const SLOT_SET = new Set(SLOT_IDS);
const PAGE_SET = new Set(PAGE_IDS);

const isPage = id => PAGE_SET.has(id);
const isConfigPage = id => CONFIG_PAGES.indexOf(id) !== -1;
const isPlacementPage = id => isPage(id) || isConfigPage(id);
const isSlot = id => SLOT_SET.has(id);
const slotsFor = page => (PAGE_SLOTS[page] || []).slice();
/* A slot id carries its page ('genreHub:strip'), so the namespace is checked
   too: 'feed:banner' would otherwise pass as a known-looking id. */
function slotPage(slotId) {
  const i = String(slotId || '').indexOf(':');
  return i > 0 ? String(slotId).slice(0, i) : '';
}
function isSlotFor(page, slotId) {
  return isSlot(slotId) && slotsFor(page).indexOf(slotId) !== -1;
}

function httpError(message, status) {
  const e = new Error(message);
  e.status = status || 400;
  return e;
}

/* Console writes only. Reject ids no reader will ever ask for, listing the
   valid ones so the fix is obvious from the API response. */
function assertTargeting({ pages, slots } = {}) {
  if (Array.isArray(pages) && pages.length) {
    const bad = pages.filter(p => !isPage(p));
    if (bad.length) {
      throw httpError(`unknown_page:${bad.join(',')}|valid:${PAGE_IDS.join(',')}`);
    }
  }
  if (Array.isArray(slots) && slots.length) {
    const bad = slots.filter(s => !isSlot(s));
    if (bad.length) {
      throw httpError(`unknown_slot:${bad.join(',')}|valid:${SLOT_IDS.join(',')}`);
    }
    const orphan = slots.filter(s => isSlot(s) && !PAGE_SET.has(slotPage(s)));
    if (orphan.length) throw httpError(`slot_page_mismatch:${orphan.join(',')}`);
  }
}

function assertPlacementPage(page) {
  if (!isPlacementPage(page)) {
    throw httpError(`unknown_page:${page}|valid:${PAGE_IDS.concat(CONFIG_PAGES).join(',')}`);
  }
}

function assertPlacementSlots(page, slots) {
  if (!slots || typeof slots !== 'object' || isConfigPage(page)) return;
  const known = slotsFor(page);
  const bad = Object.keys(slots).filter(k => known.indexOf(k) === -1);
  if (bad.length) {
    throw httpError(`unknown_slot:${page} -> ${bad.join(',')}|valid:${known.join(',')}`);
  }
}

/* Campaign rows written before the registry existed spelled surfaces
   differently ('genre-hub', 'end-of-story'). Display + entitlement expansion
   translate them; nothing rewrites stored rows. */
const LEGACY_SURFACE_ALIAS = {
  'genre-hub': 'genreHub', 'end-of-story': 'fullReader', 'homepage': 'home',
  'social-feed': 'feed', 'status-stories': 'status',
};
function surfaceFromLegacy(id) { return LEGACY_SURFACE_ALIAS[id] || id; }

function surfaces() {
  return {
    pages: PAGES.slice(),
    pageSlots: PAGE_SLOTS,
    configPages: CONFIG_PAGES.slice(),
    allSlots: SLOT_IDS.slice(),
  };
}

module.exports = {
  PAGES, PAGE_SLOTS, CONFIG_PAGES, PAGE_IDS, SLOT_IDS,
  isPage, isConfigPage, isPlacementPage, isSlot, isSlotFor, slotsFor, slotPage,
  surfaceFromLegacy, LEGACY_SURFACE_ALIAS,
  assertTargeting, assertPlacementPage, assertPlacementSlots, surfaces,
};
