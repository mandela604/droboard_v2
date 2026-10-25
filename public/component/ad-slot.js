/* ═══════════════════════════════════════════════════════════════
   AD SLOT COMPONENT — window.DroboardAdSlot
   ───────────────────────────────────────────────────────────────
    Drop-in ad slot. Insert a marker anywhere, it fills itself:

      <div data-ad-slot="feed:in-feed"></div>
      <div data-ad-slot="debate:top" data-ad-post="p123"></div>

    Programmatic:
      DroboardAdSlot.mount('#mySlot', { slot: 'debate:top', max: 1, postId: 'p123' });

    TRACKING (unified — same for all surfaces):
      • impression fires on real view (IntersectionObserver 50%), once per
        rendered instance — the same creative shown again counts again
      • viewable fires after 1s at >=50% visible (IAB), same showingId
      • click binds centrally; storyPromo inline clicks excluded (no double)
      • AdService.track(id, event, {page, slot, postId, storyId, showingId, viewerId, ts})
      • viewerId = DroboardUser.id if logged in, else stable anon dro_viewer_id;
        live userId is resolved server-side from session, never trusted client

   TARGETING (all already built into AdService — nothing new):
     • slot id      → placements[page].slots[id] admin kill/format/pin
     • ad.pages[]   → ad only serves on those surfaces
     • ad.slots[]   → ad only serves in those slots (empty = all slots)
     • schedule     → ad.startDate / endDate
     • entitlement  → ad-free subscribers get empty pools (auto)

   Requires (in this order): ad-service.js, ad-card.js, ad-slot.js
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__adSlot) return;
  window.__adSlot = true;

  /* pool name (AdService) → adFormat (DroboardAdCard.renderSponsored) */
  var POOL_FMT = {
    book: 'storyPromo',
    platform: 'platform',
    native: 'native',
    banner: 'banner',
    minibanner: 'minibanner',
    follow: 'follow',
    embed: 'embed',
  };
  /* default preference when data-ad-format is omitted */
  var AUTO_ORDER = ['book', 'native', 'platform', 'banner', 'minibanner', 'follow', 'embed'];
  var CLICK_SEL = 'a, button, .ad-cta, .dac-native-cta, .dac-banner-cta, .dac-follow-btn, .dac-story-promo-cta';

  var _used = {};      // ad id → true (page-load scope: creative rotation only)

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* slot ids are namespaced 'page:localName' (see PAGE_SLOTS registry in
     marketing/shared/ad-setup-service.js), so the surface comes for free. */
  function splitSlot(slot) {
    var s = String(slot || '');
    var i = s.indexOf(':');
    return { page: i > 0 ? s.slice(0, i) : '', slot: s };
  }

  function track(id, ev, ctx) {
    if (!id) return;
    try { if (window.AdService) AdService.track(id, ev, ctx); } catch (e) {}
  }

  /* One impression per rendered instance, fired once the slot is >=50%
     visible; AdService.observe() then adds the IAB viewable event for the
     same showingId after 1s. Re-showing the same creative is a new showing
     and counts again — only this DOM node's re-entry is suppressed. */
  function trackOnView(el, adId, ctx) {
    if (!adId) return;
    try {
      if (!('IntersectionObserver' in window)) { track(adId, 'impression', ctx); return; }
      var ob = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          try { ob.disconnect(); } catch (e) {}
          track(adId, 'impression', ctx);
        });
      }, { threshold: 0.5 });
      ob.observe(el);
    } catch (e) { track(adId, 'impression', ctx); }
  }

  function readAttr(el, name) {
    var v = el.getAttribute(name);
    return v === null ? undefined : v;
  }

  function optsFromEl(el) {
    var slot = readAttr(el, 'data-ad-slot') || '';
    var o = { slot: slot };
    var page = readAttr(el, 'data-ad-page');
    var format = readAttr(el, 'data-ad-format');
    var max = readAttr(el, 'data-ad-max');
    if (page) o.page = page;
    if (format) o.format = format;
    if (max) o.max = parseInt(max, 10) || 1;
    var postId = readAttr(el, 'data-ad-post') || readAttr(el, 'data-ad-post-id') || readAttr(el, 'data-post-id');
    var storyId = readAttr(el, 'data-ad-story') || readAttr(el, 'data-ad-story-id') || readAttr(el, 'data-story-id');
    if (postId) o.postId = postId;
    if (storyId) o.storyId = storyId;
    if (el.hasAttribute('data-ad-compact')) o.compact = true;
    if (el.hasAttribute('data-ad-keep-empty')) o.hideOnEmpty = false;
    return o;
  }

  function resolveOpts(user) {
    var o = user || {};
    var sp = splitSlot(o.slot);
    return {
      slot: o.slot || '',
      page: o.page || sp.page || '',
      format: o.format || 'auto',
      max: Math.max(1, parseInt(o.max, 10) || 1),
      compact: !!o.compact,
      hideOnEmpty: o.hideOnEmpty !== false,
      genre: o.genre || '',
      postId: o.postId || o.storyId || '',
      storyId: o.storyId || o.postId || '',
    };
  }

  function fmtFor(pool, compact) {
    if (compact && pool === 'book') return 'listBook';
    if (compact && pool === 'platform') return 'listPlatform';
    return POOL_FMT[pool];
  }

  /* Pick up to `max` ads. Pass 0 = never-used ads, pass 1 = allow repeats
     so a pinned-format slot is never left empty just for dedupe's sake. */
  function takeAds(pools, format, max, genre) {
    var names = (format && format !== 'auto')
      ? [format]
      : AUTO_ORDER.slice();
    names = names.filter(function (n) { return POOL_FMT[n]; });

    var res = [], seen = {};
    for (var pass = 0; pass < 2 && res.length < max; pass++) {
      for (var n = 0; n < names.length && res.length < max; n++) {
        var list = pools[names[n]] || [];
        for (var i = 0; i < list.length && res.length < max; i++) {
          var ad = list[i];
          if (!ad || !ad.id || seen[ad.id]) continue;
          if (pass === 0 && _used[ad.id]) continue;
          if (genre) {
            var g = ad.genre || ad.cat || '';
            if (g && String(g).toLowerCase() !== String(genre).toLowerCase()) continue;
          }
          seen[ad.id] = true;
          res.push({ ad: ad, pool: names[n] });
        }
      }
    }
    return res;
  }

  function hideEl(el) {
    try { el.style.display = 'none'; el.setAttribute('data-adslot', 'empty'); } catch (e) {}
  }

  function showEl(el) {
    try { el.style.display = ''; el.setAttribute('data-adslot', 'filled'); } catch (e) {}
  }

  function bindClicks(el, ctx) {
    if (el.__adSlotClicks) { el.__adSlotCtx = ctx; return; }
    el.__adSlotClicks = true;
    el.__adSlotCtx = ctx;
    el.addEventListener('click', function (e) {
      var item = e.target.closest('[data-adid]');
      var node = item || el;
      var adid = node.getAttribute('data-adid') || node.getAttribute('data-slot-adid');
      if (!adid) return;
      /* storyPromo / listBook already track in their inline onclick */
      if (e.target.closest('.dac-story-promo')) return;
      if (e.target.closest(CLICK_SEL)) {
        var showingId = node.getAttribute('data-showing') || '';
        var clickCtx = showingId
          ? Object.assign({}, el.__adSlotCtx, { showingId: showingId })
          : el.__adSlotCtx;
        track(adid, 'click', clickCtx);
      }
    });
  }

  async function fill(el, userOpts) {
    if (!el || el.__adSlotBusy) return false;
    var opts = resolveOpts(Object.assign({}, optsFromEl(el), userOpts || {}));
    if (!window.AdService || !window.DroboardAdCard) { hideEl(el); return false; }
    if (!opts.slot) { hideEl(el); return false; }

    el.__adSlotBusy = true;
    try {
      var pools = await AdService.getAds({ page: opts.page, slot: opts.slot });
      var picks = takeAds(pools || {}, opts.format, opts.max, opts.genre);
      if (!picks.length) { hideEl(el); return false; }

      var html = picks.map(function (p) {
        _used[p.ad.id] = true;
        p.showingId = AdService.newShowing ? AdService.newShowing() : '';
        return '<div class="ad-slot-item" data-adid="' + esc(p.ad.id) + '"' +
          (p.showingId ? ' data-showing="' + esc(p.showingId) + '"' : '') + '>' +
          DroboardAdCard.renderSponsored({ ad: p.ad, adFormat: fmtFor(p.pool, opts.compact) }) +
          '</div>';
      }).join('');

      el.innerHTML = html;
      showEl(el);
      var ctx = { page: opts.page, slot: opts.slot, postId: opts.postId, storyId: opts.storyId };
      bindClicks(el, ctx);
      picks.forEach(function (p) {
        var item = el.querySelector('[data-adid="' + p.ad.id + '"]') || el;
        var showCtx = Object.assign({}, ctx, { showingId: p.showingId });
        trackOnView(item, p.ad.id, showCtx);
        if (AdService.observe) AdService.observe(item, p.ad.id, showCtx);
      });
      return true;
    } catch (e) {
      hideEl(el);
      return false;
    } finally {
      el.__adSlotBusy = false;
      el.__adSlotDone = true;
    }
  }

  /* Fill every [data-ad-slot] marker under root (document by default). */
  function scan(root) {
    var scope = root || document;
    if (!scope || !scope.querySelectorAll) return Promise.resolve(0);
    var nodes = Array.prototype.slice.call(scope.querySelectorAll('[data-ad-slot]'));
    if (scope.nodeType === 1 && scope.hasAttribute && scope.hasAttribute('data-ad-slot')) {
      nodes.unshift(scope);
    }
    var jobs = nodes.filter(function (el) { return !el.__adSlotDone; })
      .map(function (el) { return fill(el); });
    return Promise.all(jobs).then(function (r) {
      return r.filter(Boolean).length;
    }).catch(function () { return 0; });
  }

  /* Public: fill one element (selector or node) with explicit options. */
  function mount(target, opts) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return Promise.resolve(false);
    el.__adSlotDone = false;
    return fill(el, opts);
  }

  /* Public: re-run a filled slot (new creative / rotation). */
  function refresh(target) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return Promise.resolve(false);
    el.__adSlotDone = false;
    return fill(el);
  }

  /* Public: forget which ads already ran, so the next scan can reuse them. */
  function reset() {
    _used = {};
  }

  /* Auto-scan: static markers at load + any marker injected later. */
  function boot() {
    scan(document);
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes || [];
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (!n || n.nodeType !== 1) continue;
            if (n.hasAttribute && n.hasAttribute('data-ad-slot')) scan(n.parentNode || document);
            else if (n.querySelectorAll && n.querySelector('[data-ad-slot]')) scan(n);
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.DroboardAdSlot = { mount, scan, refresh, reset, fill: fill };
})();
