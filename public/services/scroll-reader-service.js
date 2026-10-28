/* ===============================================================
   SCROLL READER SERVICE
   Continuous-scroll reader orchestration. HTML calls ScrollReader.init().
   Data: data/story.js (ES module) with fallback. Ads: ad-service.
   Comments/share/save/tip via shared components.
   When going live: swap story.js import for API calls.
=============================================================== */
(function () {
  "use strict";

  /* ══ UTILS ══ */
  function toast(m) {
    const t = document.getElementById("toastEl");
    if (!t) return;
    t.textContent = m;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2300);
  }
  function fmtN(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }
  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ══ PARAMS ══ */
  const params = new URLSearchParams(location.search);
  const STORY_ID = params.get("story") || "story-8";

  /* ══ TEAMS ══ */
  const TEAMS = [
    { id: "a", icon: "\u{1F494}", name: "Team Ada", col: "#ff0050" },
    { id: "b", icon: "\u{1F525}", name: "Team Emeka", col: "#60a5fa" },
    { id: "c", icon: "\u{1F54A}\uFE0F", name: "Team Forgive", col: "#34d399" },
    { id: "d", icon: "\u{1F440}", name: "Team Watching", col: "#a78bfa" },
  ];

  /* ══ FALLBACK ══ */
  const FALLBACK_DEMO = {
    id: STORY_ID, title: "Untitled Story", category: "\u{1F4D6} Story",
    author: { name: "Droboard Writer", avatar: "https://i.pravatar.cc/100?img=1", handle: "@writer" },
    unlockedThrough: 1, coinsBalance: 0,
    chapters: [{ n: 1, title: "Chapter One", words: 100, paras: ["This story could not be loaded. Please check that data/story.js is reachable."] }],
    comments: [], shares: 0, tips: 0, similar: [],
    exitAd: { bg: "", headline: "Wait \u2014 before you go\u2026", sub: "", cta: "Explore" },
  };

  let DATA = null;

  /* ── PREMIUM CHECK ── */
  function isPremiumUser() {
    try {
      const raw = localStorage.getItem('droboard_premium') || localStorage.getItem('dro_premium');
      if (raw === 'true' || raw === '1') return true;
      if (window.DemoData && DemoData.USERS && DemoData.USERS['You_Reader'] && DemoData.USERS['You_Reader'].isPremium) return true;
      if (DATA && DATA.isPremium) return true;
    } catch(e){}
    return false;
  }
  function countWords(text) { return (text||'').trim().split(/\s+/).filter(Boolean).length; }

  /* ══════════════════════════════════════════════════════════════════
     WALLET / COINS — delegated to the shared DroboardReader sheet
     (component/reader.js). This page builds no purchase UI of its own:
     on coin lock it opens the sheet; the unlock retries after purchase.
     ══════════════════════════════════════════════════════════════════ */
  const IS_APP_BUILD = !!window.DroboardIAP;

  // Real purchase inside the app build, simulated locally in demo
  // (the sheet shows its own loading state either way).
  function buyCoinsViaSheet(p) {
    if (IS_APP_BUILD && window.DroboardIAP) {
      return window.DroboardIAP.purchase(p.storeProductId).then(function (result) {
        const status = result && result.status;
        if (status === "success") return { ok: true, coins: (result.coins != null ? result.coins : p.coins) };
        if (status === "cancelled") return { ok: false, message: "Purchase cancelled" };
        return { ok: false, message: (result && result.message) || "Purchase failed. Please try again." };
      }).catch(function (err) {
        console.error("[Droboard IAP] purchase failed", err);
        return { ok: false, message: "Purchase failed. Please try again." };
      });
    }
    return new Promise(function (resolve) { setTimeout(function () { resolve({ ok: true }); }, 1100); });
  }

  function updateCoinDisplays(balance) {
    const fc = document.getElementById("fcCoinBalance");
    if (fc) fc.textContent = fmtN(balance != null ? balance : (window.DroboardReader ? DroboardReader.getBalance() : 0));
  }

  function attemptUnlock(fromCh, howMany, cost) {
    if (!window.DroboardReader) { toast("Reader unavailable — please reload"); return; }
    if (!DroboardReader.spend(cost)) {
      // Coin lock: open the shared sheet; the unlock retries after purchase.
      DroboardReader.openBuyCoins(function () { attemptUnlock(fromCh, howMany, cost); });
      return;
    }
    updateCoinDisplays(DroboardReader.getBalance());
    markUnlockMode(fromCh, howMany, 'coin');
    unlockChapters(fromCh, howMany);
  }

  // How each chapter was unlocked: 'free' (default), 'coin', or 'ads'.
  // Coin-unlocked chapters stay ad-free unless marketing flips the
  // scrollReader.paidUnlockAds placement flag.
  function markUnlockMode(fromCh, howMany, mode) {
    const last = howMany === "all"
      ? DATA.chapters[DATA.chapters.length - 1].n
      : Math.min(DATA.chapters[DATA.chapters.length - 1].n, fromCh + howMany - 1);
    DATA.chapters.forEach(ch => {
      if (ch.n >= fromCh && ch.n <= last) ST.unlockMode[ch.n] = mode;
    });
  }
  function paidAdsOff() { return ST.paidUnlockAdsOn !== true; }
  function chapterAdFree(chN) { return paidAdsOff() && ST.unlockMode[chN] === 'coin'; }
  function slotOn(key) {
    const s = ST.slots || {};
    if (!(key in s)) return true;
    const v = s[key];
    return v !== false && !(v && typeof v === 'object' && v.enabled === false);
  }

  /* Purchase UI removed -- the shared DroboardReader sheet (component/
     reader.js) is the single purchase surface. Coin lock opens the sheet
     via attemptUnlock; unlocks retry automatically after purchase. */

  /* ══ PER-CHAPTER EDGE SLOTS — every unlocked chapter gets a top and a
     bottom slot (embed first, else book, else native; never platform or
     red banners). Locked chapters get no ads at all. Empty = hidden. ══ */
  function edgePick(offset) {
    if (!READER_BANNERS.length || !window.DroboardAdCard) return null;
    const item = READER_BANNERS[offset % READER_BANNERS.length];
    const ad = item && item.ad;
    if (!ad) return null;
    let html = "";
    try {
      if (item.type === "embed" && DroboardAdCard.renderEmbed) html = DroboardAdCard.renderEmbed(ad);
      else if (item.type === "native") html = DroboardAdCard.renderNative(ad);
      else html = DroboardAdCard.renderStoryPromo(ad);
    } catch (e) { return null; }
    if (!html) return null;
    return { html, ad };
  }
  function fillEdgeSlot(el, pick) {
    if (!el) return;
    if (!pick) { el.style.display = "none"; return; }
    el.innerHTML = pick.html;
    el.style.display = "";
    const sl = (el.id && el.id.indexOf("Top") > -1) ? "scrollReader:top" : "scrollReader:bottom";
    trackAd(pick.ad.id, "impression", sl);
    try {
      DroboardAdCard.attach(el, {
        getAds: () => [pick.ad],
        onOpen: (ad) => { if (ad) trackAd(ad.id, "click", sl); },
        onCta: (ad) => { if (ad) trackAd(ad.id, "click", sl); toast("Opening story…"); },
        onLike: () => {},
        onComment: () => {},
        onShare: () => {},
      });
    } catch (e) {}
  }
  function fillChapterEdges() {
    if (isPremiumUser() || ST.adsEnabled === false) return;
    DATA.chapters.forEach(ch => {
      if (ch.n > ST.unlockedThrough || chapterAdFree(ch.n)) return;
      if (slotOn('scrollReader:top')) fillEdgeSlot(document.getElementById("chTopAd-" + ch.n), edgePick((ch.n - 1) * 2));
      if (slotOn('scrollReader:bottom')) fillEdgeSlot(document.getElementById("chBottomAd-" + ch.n), edgePick((ch.n - 1) * 2 + 1));
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════════════ */
  const ST = { unlockedThrough: 0, saved: false, currentCh: 1, unlockMode: {}, paidUnlockAdsOn: false, adsEnabled: true, slots: {} };

  /* ══ MANAGED AD SLOTS — inventory format picked in marketing ══
     Three slots per unlocked chapter: top edge, per-N-words inline,
     bottom edge. Gap N comes from placement.wordsPerSlot (default 300).
     Locked chapters get no ads. */
  let READER_BANNERS = [];
  let READER_SERVED = [];
  let READER_WORDS = 300;
  function readerWords() { return Math.min(2000, Math.max(50, parseInt(READER_WORDS, 10) || 300)); }
  function trackAd(id, ev, slot) { try { if (id && window.AdService) AdService.track(id, ev, { page: "scroll-reader", slot: slot || "scrollReader:per-300-words", storyId: STORY_ID }); } catch (e) {} }
  // placement scrollReader.format: auto|embed|native|book|platform|banner
  function slotFormatAllows(type) {
    const f = (READER_SLOT_FORMAT || 'auto');
    if (!f || f === 'auto') return true;
    if (f === 'book') return type === 'storyPromo';
    return type === f;
  }
  let READER_SLOT_FORMAT = 'auto';
  async function loadReaderAds() {
    READER_BANNERS = []; READER_SERVED = [];
    if (!window.AdService) return;
    try {
      try {
        const pl = await AdService.getPlacement('scrollReader');
        READER_SLOT_FORMAT = (pl && pl.format) || 'auto';
        if (pl && pl.wordsPerSlot) READER_WORDS = Math.min(2000, Math.max(50, parseInt(pl.wordsPerSlot, 10) || 300));
        ST.paidUnlockAdsOn = !!(pl && pl.paidUnlockAds);
        ST.adsEnabled = !(pl && pl.enabled === false);
        ST.slots = (pl && pl.slots) || {};
      } catch (e) { READER_SLOT_FORMAT = 'auto'; }
      const pools = await AdService.getAds({ page: "scrollReader", slot: "scrollReader:per-300-words" });
      (pools.embed || []).filter(function (ad) { return ad && ad.code; }).forEach(function (ad) { READER_BANNERS.push({ type: "embed", ad: ad }); });
      (pools.native || []).forEach(function (ad) { READER_BANNERS.push({ type: "native", ad: ad }); });
(pools.book || []).forEach(function (ad) { READER_BANNERS.push({ type: "storyPromo", ad: ad }); });
// No platform/house banners in scroll reader — red house ads stay out.
READER_BANNERS = READER_BANNERS.filter(function (item) { return item.type !== "platform" && slotFormatAllows(item.type); });
    } catch (e) { READER_BANNERS = []; }
  }
  function renderAdSlot(afterCh, wordPos) {
    if (isPremiumUser()) return "";
    if (ST.adsEnabled === false || !slotOn('scrollReader:per-300-words')) return "";
    if (chapterAdFree(afterCh)) return "";
    // inventory only — format + targeting fully marketing-controlled.
    if (READER_BANNERS.length && window.DroboardAdCard) {
      const item = READER_BANNERS[(wordPos + (afterCh || 0)) % READER_BANNERS.length];
      const ad = item.ad; if (!ad) return "";
      READER_SERVED.push(ad.id); trackAd(ad.id, "impression");
      var html = "";
      if (item.type === "embed" && window.DroboardAdCard.renderEmbed) html = window.DroboardAdCard.renderEmbed(ad);
      else if (item.type === "native") html = window.DroboardAdCard.renderNative(ad);
      else if (item.type === "storyPromo") html = window.DroboardAdCard.renderStoryPromo(ad);
      else if (item.type === "platform") html = window.DroboardAdCard.renderPlatform(ad);
      else html = window.DroboardAdCard.renderBanner(ad);
      if (!html) return "";
      try { console.info("[ScrollReader] ad served:", ad.id); } catch (e) {}
      return '<div class="ad-slot" data-adid="' + ad.id + '"><div class="ad-slot-lbl">Sponsored</div>' + html + '</div>';
    }
    return "";
  }

  /* ══ LIVE BOOK + READ TRACKING ══
     ?story=<bookId> loads the real book/chapters/read-state over the demo
     seed (demo stands on any failure). Tracking posts only for live books. */
  let LIVE = false;
  let TrackSession = null, TrackN = null;
  function htmlToParas(html) {
    const t = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n\n').replace(/<[^>]+>/g, '');
    return t.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  }
  async function bootLiveScroll() {
    if (!STORY_ID || STORY_ID === 'story-8') return;
    try {
      const [bRes, cRes] = await Promise.all([
        fetch('/api/books/' + encodeURIComponent(STORY_ID), { credentials: 'include' }),
        fetch('/api/books/' + encodeURIComponent(STORY_ID) + '/chapters', { credentials: 'include' }),
      ]);
      if (!bRes.ok || !cRes.ok) return;
      const book = await bRes.json();
      const cj = await cRes.json();
      const raw = Array.isArray(cj) ? cj : (cj.items || cj.chapters || []);
      const live = (raw || []).filter(c => ['live', 'published'].includes(String(c.status || 'live')));
      if (!book || !book.id || !live.length) return;
      let state = null;
      try {
        const sRes = await fetch('/api/stories/' + encodeURIComponent(book.id) + '/read-state', { credentials: 'include' });
        if (sRes.ok) state = await sRes.json();
      } catch (e) {}
      const unlocked = new Set(((state && state.unlocked) || []).map(String));
      const prog = (state && state.progress) || {};
      DATA.id = book.id; DATA.title = book.title || DATA.title;
      DATA.category = book.genre || DATA.category; DATA.cover = book.cover || DATA.cover;
      DATA.chapters = live.map(c => {
        const key = String(c.id || c.n);
        const p = prog[key] || prog[String(c.n)] || null;
        const done = !!(p && p.finished);
        const open = !book.vipLocked || +c.n <= 3 || unlocked.has(key) || unlocked.has(String(c.n)) || done;
        return { n: c.n, title: c.title, paras: htmlToParas(c.content).slice(0, 80), liveId: c.id, words: c.words || 0, locked: !open };
      });
      DATA.unlockedThrough = DATA.chapters.filter(c => !c.locked).length || 3;
      LIVE = true;
    } catch (e) {}
  }
  function TrackLeave() { try { if (TrackSession) TrackSession.stop(); } catch (e) {} TrackSession = null; TrackN = null; }
  function TrackStart(el) {
    if (!LIVE || !window.ReaderTrack || !el || el.classList.contains('locked-wrap')) return;
    const n = +el.dataset.ch;
    const ch = (DATA.chapters || []).find(c => +c.n === n);
    TrackN = n;
    TrackSession = ReaderTrack.session(STORY_ID, (el.dataset && el.dataset.cid) || n, (ch && ch.words) || 0);
  }
  function TrackFinishIf(el) {
    if (TrackSession && TrackN !== null && el && +el.dataset.ch === TrackN) {
      try { TrackSession.finish(); } catch (e) {}
    }
  }
  function buildReaderColumn() {
    const col = document.getElementById("readerCol");
    let html = "";
    DATA.chapters.forEach((ch) => {
      const locked = ch.locked !== undefined ? ch.locked : (ch.n > ST.unlockedThrough);
      html += renderChapterBlock(ch, locked);
    });
    col.innerHTML = html;
    // hydrate engagement mounts (polls + predictions + author note) for unlocked chapters
    if (window.ReaderEngagement) {
      col.querySelectorAll('[data-eng-mount]').forEach(function (mount) {
        const key = mount.getAttribute('data-eng-mount');
        const chN = mount.getAttribute('data-ch');
        const note = mount.getAttribute('data-note') || '';
        try { window.ReaderEngagement.renderInto(key, chN, mount, note); } catch (e) {}
      });
    }
  }

  function renderChapterBlock(ch, locked) {
    if (locked) {
      const paras = ch.paras.map(p => "<p>" + esc(p) + "</p>").join("");
      return '<section class="chapter-block locked-wrap" data-ch="' + ch.n + '" data-cid="' + (ch.liveId || '') + '" id="chapterSec-' + ch.n + '">' +
        '<div class="chapter-heading">Chapter ' + ch.n + " \u2014 " + esc(ch.title) + "</div>" +
        '<div class="story-text locked-fade">' + paras + "</div>" +
        '<div class="unlock-card" id="unlockCard-' + ch.n + '">' +
          '<div class="unlock-icon"><i class="fas fa-lock"></i></div>' +
          '<div class="unlock-title">Unlock Chapter ' + ch.n + "</div>" +
          '<div class="unlock-sub">You\'ve read through Chapter ' + ST.unlockedThrough + " free. Keep going with coins or unlock the rest of the season.</div>" +
          '<div class="unlock-opts">' +
            '<div class="unlock-opt" onclick="ScrollReader.attemptUnlock(' + ch.n + ", 1, 15)\">" +
              '<div class="unlock-opt-lbl"><div class="unlock-opt-t">This chapter only</div><div class="unlock-opt-s">Chapter ' + ch.n + "</div></div>" +
              '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 15</div>' +
            "</div>" +
            '<div class="unlock-opt reco" onclick="ScrollReader.attemptUnlock(' + ch.n + ", 5, 60)\">" +
              '<div class="unlock-opt-lbl"><div class="unlock-opt-t">Next 5 chapters \u2B50</div><div class="unlock-opt-s">Best value bundle</div></div>' +
              '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 60</div>' +
            "</div>" +
            '<div class="unlock-opt" onclick="ScrollReader.attemptUnlock(' + ch.n + ", 'all', 120)\">" +
              '<div class="unlock-opt-lbl"><div class="unlock-opt-t">Full season</div><div class="unlock-opt-s">Every remaining chapter</div></div>' +
              '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 120</div>' +
            "</div>" +
            '<div class="unlock-opt" onclick="ScrollReader.watchAdsUnlock(' + ch.n + ')">' +
              '<div class="unlock-opt-lbl"><div class="unlock-opt-t">Watch ads</div><div class="unlock-opt-s">2 short ads - unlocks this chapter free</div></div>' +
              '<div class="unlock-opt-price"><i class="fas fa-play" style="font-size:10px"></i> <span id="adprog-' + ch.n + '">' + adProgress(ch.n) + "/2</span></div>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</section>";
    }
    let htmlParas = "";
    let wordCount = 0;
    let adIdx = 0;
    const gap = readerWords();
    ch.paras.forEach(p => {
      htmlParas += "<p>" + esc(p) + "</p>";
      wordCount += countWords(p);
      if (wordCount >= gap) {
        const adHtml = renderAdSlot(ch.n, adIdx++);
        if (adHtml) htmlParas += adHtml;
        wordCount = 0;
      }
    });
    return '<section class="chapter-block" data-ch="' + ch.n + '" data-cid="' + (ch.liveId || '') + '" id="chapterSec-' + ch.n + '">' +
      '<div class="chapter-heading">Chapter ' + ch.n + " — " + esc(ch.title) + "</div>" +
      '<div class="ch-edge-ad" id="chTopAd-' + ch.n + '" style="display:none"></div>' +
      '<div class="story-text">' + htmlParas + "</div>" +
      '<div class="ch-edge-ad" id="chBottomAd-' + ch.n + '" style="display:none"></div>' +
      '<div data-eng-mount="s1c' + ch.n + '" data-ch="' + ch.n + '" data-note="' + esc(ch.authorNote || ch.note || "") + '"></div>' +
      renderCommentLine(ch) +
      renderEngageBar(ch) +
      '<div class="comm-chapter-mount" id="commMount-' + ch.n + '"></div>' +
    "</section>";
  }

  function renderEngageBar(ch) {
    return '<div class="engage-bar">' +
      '<div class="eb-btn" id="ebSave-' + ch.n + '" onclick="ScrollReader.doSave()"><i class="far fa-bookmark eb-icon"></i><span class="eb-lbl">Save</span></div>' +
      '<div class="eb-btn" onclick="ScrollReader.doShare(' + ch.n + ')"><i class="fas fa-share-alt eb-icon"></i><span class="eb-lbl">' + fmtN(DATA.shares) + "</span></div>" +
      '<div class="eb-btn" onclick="ScrollReader.doTip()"><i class="fas fa-coins eb-icon"></i><span class="eb-lbl">' + fmtN(DATA.tips) + " tips</span></div>" +
    "</div>";
  }

  function renderCommentLine(ch) {
    return '<div class="comment-line-wrap"><div class="comments-inline-mount" id="commentsMount-' + ch.n + '"></div></div>';
  }

  /* ══ WATCH ADS TO UNLOCK — 2 full ad views unlock 1 chapter free.
     Progress persists per story+chapter so a refresh never wipes it. ══ */
  function adKey(chN) { return "dro_adunlock_" + STORY_ID + "_" + chN; }
  function adProgress(chN) {
    try { return Math.min(2, parseInt(localStorage.getItem(adKey(chN)) || "0", 10) || 0); }
    catch (e) { return 0; }
  }
  function readerAdInventory() {
    return (READER_BANNERS || []).filter(function (b) {
      return b && (b.type === "banner" || b.type === "native") && b.ad;
    });
  }
  function watchAdsUnlock(chN) {
    if (adProgress(chN) >= 2) { markUnlockMode(chN, 1, 'ads'); unlockChapters(chN, 1); return; }
    if (!window.DroboardRewardedAd) { toast("Ads unavailable right now"); return; }
    var need = 2 - adProgress(chN);
    DroboardRewardedAd.show({
      ads: readerAdInventory(),
      rewardLabel: "Watch to the end (" + need + " more) to unlock Chapter " + chN + " free",
      onComplete: function () {
        var n = adProgress(chN) + 1;
        try { localStorage.setItem(adKey(chN), String(n)); } catch (e) {}
        var lbl = document.getElementById("adprog-" + chN);
        if (lbl) lbl.textContent = Math.min(2, n) + "/2";
        if (n >= 2) { toast("Chapter " + chN + " unlocked - enjoy!"); markUnlockMode(chN, 1, 'ads'); unlockChapters(chN, 1); }
        else toast("1 more ad to unlock Chapter " + chN);
      },
    });
  }

  /* ══ UNLOCKING ══ */
  function unlockChapters(fromCh, howMany) {
    const label = howMany === "all" ? "the full season" : (howMany === 1 ? "Chapter " + fromCh : howMany + " chapters");
    toast("Unlocked " + label + "!");
    const newThrough = howMany === "all" ? DATA.chapters[DATA.chapters.length - 1].n
      : Math.min(DATA.chapters[DATA.chapters.length - 1].n, fromCh + howMany - 1);
    ST.unlockedThrough = newThrough;

    const oldSec = document.getElementById("chapterSec-" + fromCh);
    if (oldSec) oldSec.remove();

    let html = "";
    DATA.chapters.forEach((ch) => {
      if (ch.n < fromCh) return;
      const locked = ch.n > ST.unlockedThrough;
      html += renderChapterBlock(ch, locked);
    });
    document.getElementById("readerCol").insertAdjacentHTML("beforeend", html);
    wireComponents();
    fillChapterEdges();
    buildChaptersPanel();
  }

  /* ══ COMMUNITIES — genre board + author circle in EVERY chapter,
     right after that chapter's comment accordion. One shared join
     state so all mounts stay in sync. ══ */
  const COMMSTATE = { genreJoined: false, circleJoined: false };
  function commOpts() {
    const g = window.DroboardCommunityCards.genreInfo(DATA.category);
    const author = DATA.author || {};
    return {
      genre: { name: g.name, icon: g.icon, members: window.DroboardCommunityCards.demoMembers(g.name, 20000, 380000), joined: COMMSTATE.genreJoined },
      circle: {
        name: (author.name || 'Writer') + "'s Inner Circle",
        members: window.DroboardCommunityCards.demoMembers(author.name || author.handle, 800, 9200),
        perks: 'Early chapters, behind-the-scenes, live Q&As',
        joined: COMMSTATE.circleJoined, avatar: author.avatar,
      },
      showCircle: false, // genre board only — circle lives on the bridge page
      onJoin: (type, joined) => {
        if (type === 'genre') COMMSTATE.genreJoined = joined;
        else COMMSTATE.circleJoined = joined;
        paintChapterCommunities();
        toast(joined ? '✅ Joined!' : 'Left the community');
      },
    };
  }
  function paintChapterCommunities() {
    if (!window.DroboardCommunityCards || !DATA) return;
    document.querySelectorAll('.comm-chapter-mount').forEach(mount => {
      try { window.DroboardCommunityCards.mount(mount, commOpts()); } catch (e) {}
    });
  }
  function initCommunities() { paintChapterCommunities(); }

  /* ══ COMPONENTS ══ */
  function mapSeedComment(c) {
    return Object.assign({}, c, {
      statusRing: (c.statusRing || "none").replace("ring-", ""),
      replies: (c.replies || []).map(mapSeedComment),
    });
  }
  function getSeedComments() {
    const raw = (typeof COMMENTS_DATA !== "undefined" && COMMENTS_DATA.length) ? COMMENTS_DATA : (DATA.comments || []);
    return raw.map(mapSeedComment);
  }

  function countAllReplies(list) {
    return (list || []).reduce((n, c) => n + 1 + countAllReplies(c.replies || []), 0);
  }
  function wireComponents() {
    const seedComments = getSeedComments();
    const trueTotal = countAllReplies(seedComments); // same math as the component's own counter
    if (!window.DroboardComments) {
      try { console.error('[ScrollReader] comments: component missing — hard-refresh (Ctrl+Shift+R).'); } catch (e) {}
    }
    DATA.chapters.forEach(ch => {
      if (ch.n > ST.unlockedThrough) return;
      const mount = document.getElementById("commentsMount-" + ch.n);
      if (!mount || !window.DroboardComments) return;
      try {
        mount.innerHTML = "";
        DroboardComments.attach(mount, {
          storyId: STORY_ID + "-ch" + ch.n,
          title: fmtN(trueTotal) + " comments",
          comments: seedComments.map(c => Object.assign({}, c)),
          teams: TEAMS,
          currentUser: { name: "You", avatar: null, team: null },
          requireTeam: false,
          collapsible: true,
          startOpen: false,
            adsRepeat: false, // no repeating slots in reader chapters
            adsFirst: false, // reading comments never start with an ad
            scrollBox: 420, // bounded inner-scroll list + pinned composer
          fullCommentsUrl: 'comments.html?story=' + encodeURIComponent(STORY_ID) + '&ch=' + ch.n,
          ads: (ST.adsEnabled === false || chapterAdFree(ch.n)) ? false : undefined, // paid unlock / page-off = ad-free thread
        });
      } catch (e) {
        try {
          mount.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--muted)">💬 Comments crashed on load (' + ((e && e.message) || e) + ').</div>';
          console.error("[ScrollReader] comments failed for ch" + ch.n, e);
        } catch (e2) {}
      }
    });

    if (window.DroboardAdCard) {
      DroboardAdCard.attach(document.getElementById("readerCol"), {
        getAds: () => [],
        onOpen: () => {},
        onCta: () => { toast("Opening story\u2026"); },
      });
    }
    document.querySelectorAll(".ad-slot[data-adid]").forEach(el => {
      const sl = (el.id && el.id.indexOf("Top") > -1) ? "scrollReader:top"
        : (el.id && el.id.indexOf("Bottom") > -1) ? "scrollReader:bottom"
        : "scrollReader:per-300-words";
      el.addEventListener("click", () => trackAd(el.dataset.adid, "click", sl));
    });
    paintChapterCommunities();

    window.onDroboardSaveChange = function (storyId, saved) {
      ST.saved = saved;
      document.querySelectorAll('[id^="ebSave-"]').forEach(el => {
        el.classList.toggle("saved", saved);
        el.querySelector("i").className = saved ? "fas fa-bookmark eb-icon" : "far fa-bookmark eb-icon";
      });
    };
    if (window.DroboardTip) {
      DroboardTip.attach({
        getWriter: () => ({ name: DATA.author.name, avatar: DATA.author.avatar, handle: DATA.author.handle }),
        onSend: () => { DATA.tips++; document.querySelectorAll(".eb-btn .eb-lbl").forEach(l => { if (l.textContent.includes("tips")) l.textContent = fmtN(DATA.tips) + " tips"; }); },
      });
    }
  }

  function doSave() { if (window.openSaveModal) window.openSaveModal({ title: DATA.title, sub: "by " + DATA.author.name, img: "", storyId: STORY_ID }); }
  function doShare(chN) { if (window.openShareModal) window.openShareModal({ title: DATA.title, sub: "by " + DATA.author.name + " \u00B7 Chapter " + chN, img: "", url: "https://droboard.app/story/" + STORY_ID + "#ch" + chN }); }
  function doTip() { if (window.DroboardTip) DroboardTip.open(STORY_ID, { name: DATA.author.name, avatar: DATA.author.avatar, handle: DATA.author.handle }); }

  /* ══ CHAPTERS PANEL ══ */
  function buildChaptersPanel() {
    document.getElementById("chPanelBody").innerHTML = DATA.chapters.map(ch => {
      const locked = ch.n > ST.unlockedThrough;
      const numEl = locked
        ? '<div class="ch-num locked"><i class="fas fa-lock" style="font-size:9px"></i></div>'
        : '<div class="ch-num">' + ch.n + "</div>";
      return '<div class="ch-row' + (locked ? " locked" : "") + '" onclick="ScrollReader.jumpToChapter(' + ch.n + "," + locked + ')">' +
        numEl +
        '<div class="ch-row-body"><div class="ch-row-title">Ch.' + ch.n + " \u2014 " + esc(ch.title) + '</div><div class="ch-row-meta">' + (locked ? "Locked \u00B7 " : "") + "~" + Math.round(ch.words / 220) + " min \u00B7 " + ch.words + " words</div></div>" +
      "</div>";
    }).join("");
  }
  function jumpToChapter(n, locked) {
    closeChPanel();
    if (locked && n > ST.unlockedThrough) {
      const firstLocked = DATA.chapters.find(c => c.n > ST.unlockedThrough);
      document.getElementById("chapterSec-" + firstLocked.n).scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    document.getElementById("chapterSec-" + n).scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function openChPanel() { document.getElementById("chPanel").classList.add("open"); document.getElementById("overlayBg").classList.add("show"); }
  function closeChPanel() { document.getElementById("chPanel").classList.remove("open"); document.getElementById("overlayBg").classList.remove("show"); }

  /* ══ SETTINGS ══ */
  let fsVal = 14; const FS_MIN = 11, FS_MAX = 24;
  function changeFontSize(d) { fsVal = Math.min(FS_MAX, Math.max(FS_MIN, fsVal + d)); document.documentElement.style.setProperty("--fs", fsVal + "px"); document.getElementById("fontSizeDisplay").textContent = fsVal + "px"; }
  function setLH(el, val) { document.querySelectorAll(".lh-opt").forEach(x => x.classList.remove("on")); el.classList.add("on"); document.documentElement.style.setProperty("--lh", val); }
  function setFF(el, val) { document.querySelectorAll(".ff-opt").forEach(x => x.classList.remove("on")); el.classList.add("on"); document.documentElement.style.setProperty("--font-story", val); }
  function setTheme(el, theme) {
    document.body.className = theme;
    document.documentElement.setAttribute('data-theme', theme === 'theme-white' ? 'light' : 'dark');
    try {
      localStorage.setItem('dro_reader_theme', theme);
      if (theme === 'theme-white') localStorage.setItem('droboardTheme', 'light');
      else if (theme === 'theme-dark') localStorage.setItem('droboardTheme', 'dark');
    } catch (e) {}
    document.querySelectorAll(".theme-opt").forEach(x => x.classList.remove("on"));
    el.classList.add("on");
  }
  // Readers honor the site theme: stored reader choice wins, otherwise the
  // shared light/dark setting (discussion + every other page use it).
  function applyStoredTheme() {
    let theme = null;
    try {
      theme = localStorage.getItem('dro_reader_theme');
      if (!theme || theme === 'theme-dark') {
        const site = localStorage.getItem('droboardTheme');
        if (site === 'light') theme = 'theme-white';
        else if (!theme) theme = 'theme-dark';
      }
    } catch (e) {}
    if (theme) {
      document.body.className = theme;
      document.documentElement.setAttribute('data-theme', theme === 'theme-white' ? 'light' : 'dark');
      document.querySelectorAll(".theme-opt").forEach(x => {
        const on = (x.getAttribute('data-theme') || '') === theme;
        x.classList.toggle("on", on);
      });
    }
  }
  function openSettings() { document.getElementById("settingsPanel").classList.add("open"); document.getElementById("overlayBg").classList.add("show"); }
  function closeAllSheets() {
    document.getElementById("settingsPanel").classList.remove("open");
    document.getElementById("chPanel").classList.remove("open");
    document.getElementById("overlayBg").classList.remove("show");
  }

  /* ══ FLOATING CONTROLS ══ */
  function wireFloatingControls() {
    const sb = document.getElementById("scrollBody");
    const fc = document.getElementById("floatingControls");
    const toTop = document.getElementById("toTopArrow");
    let hideTimer = null;
    let topScrolling = false;
    function showControls() { fc.classList.add("show"); if (toTop) toTop.classList.add("show"); clearTimeout(hideTimer); hideTimer = setTimeout(() => { fc.classList.remove("show"); if (toTop) toTop.classList.remove("show"); }, 3000); }
    function hideControlsNow() { fc.classList.remove("show"); if (toTop) toTop.classList.remove("show"); clearTimeout(hideTimer); }
    sb.addEventListener("click", e => {
      if (e.target.closest(".eb-btn, .dac-banner, .unlock-opt, .dcs-wrap, a, button")) return;
      fc.classList.contains("show") ? hideControlsNow() : showControls();
    });
    sb.addEventListener("scroll", () => { if (!topScrolling) hideControlsNow(); }, { passive: true });
    document.getElementById("fcChapters").addEventListener("click", openChPanel);
    document.getElementById("fcSettings").addEventListener("click", openSettings);
    document.getElementById("fcBack").addEventListener("click", function () {
      if (window.history.length > 1) { window.history.back(); } else { window.location.href = "../index.html"; }
    });
    document.getElementById("fcCoinPill").addEventListener("click", function () {
      window.location.href = "store.html";
    });
    document.getElementById("fcLogo").addEventListener("click", function () {
      window.location.href = "discover.html";
    });
    if (toTop) toTop.addEventListener("click", function () {
      topScrolling = true;
      showControls();
      try { sb.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { sb.scrollTop = 0; }
      const end = function () { topScrolling = false; };
      sb.addEventListener("scrollend", end, { once: true });
      setTimeout(end, 900);
    });
  }

  /* ══ SCROLL PROGRESS ══
     Top pill ("Ch N") tracks the chapter under the reading line (~1/3 down
     the viewport) — computed on scroll, so it updates between observer
     callbacks and never gets stuck on Ch 1. DOM text only: no re-render,
     no page reload. The observer only handles enter/leave (tracking), since
     a 0.5 threshold can never fire for chapter blocks taller than the
     viewport — that was why the pill never changed. */
  function wireScrollProgress() {
    const sb = document.getElementById("scrollBody");

    function syncCurrentChapter() {
      const list = document.querySelectorAll(".chapter-block");
      if (!list.length) return;
      const rr = sb.getBoundingClientRect();
      const marker = rr.top + rr.height * 0.32;
      let cur = null, above = null;
      for (let i = 0; i < list.length; i++) {
        const r = list[i].getBoundingClientRect();
        if (r.top <= marker && r.bottom > marker) { cur = list[i]; break; }
        if (r.top <= marker) above = list[i];
      }
      cur = cur || above || list[0];
      const n = +cur.dataset.ch;
      const pill = document.getElementById("fcProgressPill");
      const label = "Ch " + n;
      if (pill && pill.textContent !== label) pill.textContent = label;
      if (n !== ST.currentCh) {
        TrackLeave(); ST.currentCh = n; TrackStart(cur);
        try { if (window.ReadingHistory) ReadingHistory.touch(STORY_ID, n); } catch (e) {}
      }
    }

    sb.addEventListener("scroll", () => {
      const max = sb.scrollHeight - sb.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.round(sb.scrollTop / max * 100)) : 0;
      document.getElementById("readProgressFill").style.width = pct + "%";
      syncCurrentChapter();
    }, { passive: true });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting && en.boundingClientRect && en.boundingClientRect.top < 0) {
          TrackFinishIf(en.target); // fully scrolled past = read
        }
      });
      syncCurrentChapter();
    }, { root: sb, threshold: 0 });
    document.querySelectorAll(".chapter-block").forEach(sec => observer.observe(sec));
    syncCurrentChapter();
  }

  /* ══ EXIT-INTENT ══ */
  let exitTimer = null, exitSeconds = 5;
  function wireExitIntent() {}
  function attemptExit() {
    showExitAd();
  }
  function showExitAd() {
    const ad = DATA.exitAd || {};
    document.getElementById("exitBg").style.backgroundImage = "url('" + (ad.bg || "") + "')";
    document.getElementById("exitHeadline").textContent = ad.headline || "Wait \u2014 before you go\u2026";
    document.getElementById("exitSub").textContent = ad.sub || "";
    document.getElementById("exitCta").textContent = ad.cta || "Explore";
    document.getElementById("exitOv").classList.add("show");

    exitSeconds = 5;
    const btn = document.getElementById("exitCloseBtn");
    const lbl = document.getElementById("exitCountLabel");
    const ring = document.getElementById("exitRing");
    btn.disabled = true;
    lbl.textContent = exitSeconds;
    ring.style.clipPath = "inset(0 0 0 0)";

    clearInterval(exitTimer);
    exitTimer = setInterval(() => {
      exitSeconds--;
      const pct = (exitSeconds / 5) * 100;
      ring.style.clipPath = "inset(0 " + pct + "% 0 0)";
      if (exitSeconds <= 0) {
        clearInterval(exitTimer);
        btn.disabled = false;
        lbl.innerHTML = '<i class="fas fa-times"></i>';
      } else {
        lbl.textContent = exitSeconds;
      }
    }, 1000);
  }
  function confirmExit() {
    document.getElementById("exitOv").classList.remove("show");
    clearInterval(exitTimer);
    if (window.history.length > 1) { window.history.back(); } else { window.location.href = "../index.html"; }
  }
  function exitCtaClick() {
    document.getElementById("exitOv").classList.remove("show");
    clearInterval(exitTimer);
    window.location.href = "store.html";
  }

  /* ══ INIT ══ */
  async function init() {
    let story = null;
    try {
      if (window.DemoData && window.DemoData.FULL_STORY) {
        story = window.DemoData.FULL_STORY;
      }
    } catch (err) { console.warn("[Droboard] Could not load FULL_STORY from central-demo-data", err); }
    DATA = story || FALLBACK_DEMO;
    try { await bootLiveScroll(); } catch (e) {}
    if (window.ReaderTrack) { try { ReaderTrack.entitlements().catch(function () {}); } catch (e) {} }

    ST.unlockedThrough = DATA.unlockedThrough;
    await loadReaderAds();
    applyStoredTheme();
    // Shared coin sheet owns the wallet now — attach once, start at zero.
    if (window.DroboardReader) {
      DroboardReader.attach({ onBalanceChange: updateCoinDisplays, onBuyCoins: buyCoinsViaSheet });
      DroboardReader.setBalance(0);
    }

    document.getElementById("loadingState").style.display = "none";
    document.getElementById("storyTop").style.display = "";
    document.getElementById("storyTop").innerHTML =
      '<div class="story-top-cat">' + esc(DATA.category) + "</div>" +
      '<div class="story-top-title">' + esc(DATA.title) + "</div>" +
      '<div class="story-top-author">by ' + esc(DATA.author.name) + "</div>";

    updateCoinDisplays();
    buildReaderColumn();
    fillChapterEdges();
    // Impressions already tracked per-render in renderAdSlot — no batch re-track here.
    buildChaptersPanel();
    wireComponents();
    initCommunities();
    wireStaticChrome();
    wireFloatingControls();
    wireScrollProgress();
    wireExitIntent();
    hidePageSkeleton();
  }

  function hidePageSkeleton() {
    try {
      window.__pageReady = true;
      var sk = document.getElementById('pageSkeleton');
      if (!sk) return;
      sk.style.transition = 'opacity .3s';
      sk.style.opacity = '0';
      sk.style.pointerEvents = 'none';
      setTimeout(function () { if (sk.parentNode) sk.parentNode.removeChild(sk); }, 350);
    } catch (e) {}
  }

  /* ══ PUBLIC API (called by service-rendered templates) ══ */
  window.ScrollReader = {
    attemptUnlock,
    watchAdsUnlock,
    jumpToChapter,
    doSave,
    doShare,
    doTip,
    attemptExit,
    confirmExit,
    exitCtaClick,
  };

  /* Static shell controls — HTML carries data-act attributes only, no
     inline handlers. Wired here on init. */
  function wireStaticChrome() {
    const q = function (sel) { return document.querySelector(sel); };
    const qa = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
    const closeBtn = q('#chPanel [data-act="close-panels"]');
    if (closeBtn) closeBtn.addEventListener("click", closeChPanel);
    qa('[data-act="fs-dec"]').forEach(function (b) { b.addEventListener("click", function () { changeFontSize(-1); }); });
    qa('[data-act="fs-inc"]').forEach(function (b) { b.addEventListener("click", function () { changeFontSize(1); }); });
    qa('[data-lh]').forEach(function (el) { el.addEventListener("click", function () { setLH(el, el.getAttribute("data-lh")); }); });
    qa('[data-ff]').forEach(function (el) { el.addEventListener("click", function () { setFF(el, el.getAttribute("data-ff")); }); });
    qa('[data-theme]').forEach(function (el) { el.addEventListener("click", function () { setTheme(el, el.getAttribute("data-theme")); }); });
    const overlay = document.getElementById("overlayBg");
    if (overlay) overlay.addEventListener("click", closeAllSheets);
    const exitCta = document.getElementById("exitCta");
    if (exitCta) exitCta.addEventListener("click", exitCtaClick);
    const exitClose = document.getElementById("exitCloseBtn");
    if (exitClose) exitClose.addEventListener("click", confirmExit);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
