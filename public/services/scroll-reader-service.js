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

  /* ══════════════════════════════════════════════════════════════════
     WALLET / COINS
     ══════════════════════════════════════════════════════════════════ */
  const IS_APP_BUILD = !!window.DroboardIAP;
  let walletBalance = 0;
  let purchaseState = "idle";
  const COIN_PACKAGES = [
    { coins: 100, bonus: 0, price: 500, label: "Starter", storeProductId: "coins_100" },
    { coins: 300, bonus: 20, price: 1200, label: "Popular", storeProductId: "coins_300", reco: true },
    { coins: 700, bonus: 80, price: 2500, label: "Best Value", storeProductId: "coins_700" },
    { coins: 1500, bonus: 250, price: 5000, label: "Mega", storeProductId: "coins_1500" },
  ];
  let _pendingInsufficientRetry = null;
  let _pendingBuyRetry = null;

  function updateCoinDisplays() {
    const fc = document.getElementById("fcCoinBalance");
    if (fc) fc.textContent = fmtN(walletBalance);
    const buycBal = document.getElementById("buycBalance");
    if (buycBal) buycBal.textContent = fmtN(walletBalance);
  }

  function attemptUnlock(fromCh, howMany, cost) {
    if (walletBalance < cost) {
      showInsufficientBalance(cost, walletBalance, () => attemptUnlock(fromCh, howMany, cost));
      return;
    }
    walletBalance -= cost;
    updateCoinDisplays();
    unlockChapters(fromCh, howMany);
  }

  /* ══ INSUFFICIENT BALANCE ══ */
  function showInsufficientBalance(need, have, retryFn) {
    _pendingInsufficientRetry = retryFn || null;
    document.getElementById("balNeed").textContent = need;
    document.getElementById("balHave").textContent = have;
    document.getElementById("balOv").classList.add("show");
  }
  function closeInsufficientBalance() {
    document.getElementById("balOv").classList.remove("show");
  }

  /* ══ COIN PACKAGES ══ */
  function renderCoinPackages() {
    const busy = purchaseState !== "idle";
    document.getElementById("buycPackages").innerHTML = COIN_PACKAGES.map((p, i) =>
      '<div class="pkg-card' + (p.reco ? " reco" : "") + '" style="' + (busy ? "opacity:.45;pointer-events:none;" : "") + '" onclick="ScrollReader.buyPackage(' + i + ')">' +
        "<div>" +
          '<div class="pkg-label">' + esc(p.label) + "</div>" +
          '<div class="pkg-coins"><i class="fas fa-coins"></i> ' + fmtN(p.coins) + "</div>" +
          (p.bonus ? '<div class="pkg-bonus">+' + p.bonus + " bonus coins</div>" : "") +
        "</div>" +
        '<div class="pkg-right"><div class="pkg-price">\u20A6' + fmtN(p.price) + "</div></div>" +
      "</div>"
    ).join("");
  }

  function openBuyCoins(retryFn) {
    _pendingBuyRetry = retryFn || null;
    renderCoinPackages();
    updateCoinDisplays();
    const fundTab = document.getElementById("buycFundTab");
    if (fundTab) fundTab.style.display = IS_APP_BUILD ? "none" : "";
    setBuyTab(document.querySelector('.buyc-tab[data-tab="packages"]'), "packages");
    document.getElementById("buycOv").classList.add("show");
    if (purchaseState !== "idle") setPurchaseUI(purchaseState);
  }
  function closeBuyCoins() {
    if (purchaseState === "purchasing") return;
    document.getElementById("buycOv").classList.remove("show");
  }
  function setBuyTab(el, tab) {
    document.querySelectorAll(".buyc-tab").forEach(t => t.classList.remove("on"));
    el.classList.add("on");
    document.getElementById("buycPackages").style.display = tab === "packages" ? "" : "none";
    document.getElementById("buycFund").style.display = tab === "fund" ? "" : "none";
  }

  function setPurchaseUI(state) {
    purchaseState = state;
    const loading = document.getElementById("buycLoading");
    const loadingText = document.getElementById("buycLoadingText");
    const closeBtn = document.getElementById("buycClose");
    loading.classList.toggle("show", state === "purchasing" || state === "pending");
    if (state === "purchasing") loadingText.textContent = "Processing purchase\u2026";
    if (state === "pending") loadingText.textContent = "Purchase pending \u2014 you'll be credited once it clears.";
    closeBtn.style.pointerEvents = state === "purchasing" ? "none" : "";
    closeBtn.style.opacity = state === "purchasing" ? ".4" : "";
    renderCoinPackages();
  }

  function _grantCoinsAndRetry(amount) {
    walletBalance += amount;
    updateCoinDisplays();
    toast(fmtN(amount) + " coins added to your wallet!");
    setPurchaseUI("idle");
    closeBuyCoins();
    if (_pendingBuyRetry) { const fn = _pendingBuyRetry; _pendingBuyRetry = null; setTimeout(fn, 200); }
  }

  async function buyPackage(i) {
    if (purchaseState !== "idle") return;
    const p = COIN_PACKAGES[i];
    if (!p) return;
    if (!IS_APP_BUILD) {
      setPurchaseUI("purchasing");
      setTimeout(() => { _grantCoinsAndRetry(p.coins + (p.bonus || 0)); }, 1100);
      return;
    }
    setPurchaseUI("purchasing");
    try {
      const result = await window.DroboardIAP.purchase(p.storeProductId);
      const status = result && result.status;
      if (status === "success") {
        _grantCoinsAndRetry((result.coins != null ? result.coins : p.coins) + (p.bonus || 0));
      } else if (status === "cancelled") {
        setPurchaseUI("idle");
      } else if (status === "pending") {
        setPurchaseUI("pending");
        toast("Purchase pending \u2014 you'll be credited once it clears.");
      } else {
        setPurchaseUI("idle");
        toast((result && result.message ? result.message : "Purchase failed. Please try again."));
      }
    } catch (err) {
      console.error("[Droboard IAP] purchase failed", err);
      setPurchaseUI("idle");
      toast("Purchase failed. Please try again.");
    }
  }

  function fundWallet() {
    if (IS_APP_BUILD) return;
    if (purchaseState !== "idle") return;
    const naira = +document.getElementById("fundInput").value;
    if (!naira || naira < 100) { toast("Enter at least \u20A6100"); return; }
    const coins = Math.floor(naira / 20);
    document.getElementById("fundInput").value = "";
    setPurchaseUI("purchasing");
    setTimeout(() => { _grantCoinsAndRetry(coins); }, 900);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════════════ */
  const ST = { unlockedThrough: 0, saved: false, currentCh: 1 };

  /* ══ MANAGED AD SLOTS ══ */
  let READER_BANNERS = [];
  let READER_SERVED = [];
  function trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }
  async function loadReaderAds() {
    READER_BANNERS = []; READER_SERVED = [];
    if (!window.AdService) return;
    try {
      const pools = await AdService.getAds({ page: "scrollReader" });
      READER_BANNERS = pools.banner || [];
    } catch (e) { READER_BANNERS = []; }
  }

  function renderAdSlot(afterCh) {
    if (!READER_BANNERS.length || !window.DroboardAdCard) return "";
    const ad = READER_BANNERS[Math.floor(afterCh / 2 - 1) % READER_BANNERS.length];
    if (!ad) return "";
    READER_SERVED.push(ad.id);
    return '<div class="ad-slot" data-adid="' + ad.id + '">' +
      '<div class="ad-slot-lbl">Sponsored</div>' +
      window.DroboardAdCard.renderBanner(ad) +
    "</div>";
  }

  /* ══ RENDERING ══ */
  function buildReaderColumn() {
    const col = document.getElementById("readerCol");
    let html = "";
    DATA.chapters.forEach((ch, idx) => {
      const locked = ch.n > ST.unlockedThrough;
      html += renderChapterBlock(ch, locked);
      if (locked) return;
      if (ch.n % 2 === 0 && idx < DATA.chapters.length - 1) {
        html += renderAdSlot(ch.n);
      }
    });
    col.innerHTML = html;
  }

  function renderChapterBlock(ch, locked) {
    const paras = ch.paras.map(p => "<p>" + esc(p) + "</p>").join("");
    if (!locked) {
      return '<section class="chapter-block" data-ch="' + ch.n + '" id="chapterSec-' + ch.n + '">' +
        '<div class="chapter-heading">Chapter ' + ch.n + " \u2014 " + esc(ch.title) + "</div>" +
        '<div class="story-text">' + paras + "</div>" +
        renderEngageBar(ch) +
        renderCommentLine(ch) +
      "</section>";
    }
    return '<section class="chapter-block locked-wrap" data-ch="' + ch.n + '" id="chapterSec-' + ch.n + '">' +
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
        "</div>" +
      "</div>" +
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
    DATA.chapters.forEach((ch, idx) => {
      if (ch.n < fromCh) return;
      const locked = ch.n > ST.unlockedThrough;
      html += renderChapterBlock(ch, locked);
      if (locked) return;
      if (ch.n % 2 === 0 && idx < DATA.chapters.length - 1) html += renderAdSlot(ch.n);
    });
    document.getElementById("readerCol").insertAdjacentHTML("beforeend", html);
    wireComponents();
    buildChaptersPanel();
  }

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

  function wireComponents() {
    const seedComments = getSeedComments();
    DATA.chapters.forEach(ch => {
      if (ch.n > ST.unlockedThrough) return;
      const mount = document.getElementById("commentsMount-" + ch.n);
      if (!mount || !window.DroboardComments) return;
      mount.innerHTML = "";
      DroboardComments.attach(mount, {
        storyId: STORY_ID + "-ch" + ch.n,
        title: fmtN(seedComments.length * 37) + " comments",
        comments: seedComments.map(c => Object.assign({}, c)),
        teams: TEAMS,
        currentUser: { name: "You", avatar: null, team: null },
        requireTeam: false,
        collapsible: true,
        startOpen: false,
      });
    });

    if (window.DroboardAdCard) {
      DroboardAdCard.attach(document.getElementById("readerCol"), {
        getAds: () => [],
        onOpen: () => {},
        onCta: () => { toast("Opening story\u2026"); },
      });
    }
    document.querySelectorAll(".ad-slot[data-adid]").forEach(el => {
      el.addEventListener("click", () => trackAd(el.dataset.adid, "click"));
    });

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
  function setTheme(el, theme) { document.body.className = theme; document.querySelectorAll(".theme-opt").forEach(x => x.classList.remove("on")); el.classList.add("on"); }
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
    let hideTimer = null;
    function showControls() { fc.classList.add("show"); clearTimeout(hideTimer); hideTimer = setTimeout(() => fc.classList.remove("show"), 3000); }
    function hideControlsNow() { fc.classList.remove("show"); clearTimeout(hideTimer); }
    sb.addEventListener("click", e => {
      if (e.target.closest(".eb-btn, .dac-banner, .unlock-opt, .dcs-wrap, a, button")) return;
      fc.classList.contains("show") ? hideControlsNow() : showControls();
    });
    sb.addEventListener("scroll", hideControlsNow, { passive: true });
    document.getElementById("fcChapters").addEventListener("click", openChPanel);
    document.getElementById("fcSettings").addEventListener("click", openSettings);
    document.getElementById("fcBack").addEventListener("click", function () {
      if (window.history.length > 1) { window.history.back(); } else { window.location.href = "../index.html"; }
    });
    document.getElementById("fcCoinPill").addEventListener("click", function () {
      window.location.href = "store.html";
    });
  }

  /* ══ SCROLL PROGRESS ══ */
  function wireScrollProgress() {
    const sb = document.getElementById("scrollBody");
    sb.addEventListener("scroll", () => {
      const max = sb.scrollHeight - sb.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.round(sb.scrollTop / max * 100)) : 0;
      document.getElementById("readProgressFill").style.width = pct + "%";
    }, { passive: true });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const n = +en.target.dataset.ch;
          ST.currentCh = n;
          document.getElementById("fcProgressPill").textContent = "Ch " + n;
        }
      });
    }, { root: sb, threshold: 0.5 });
    document.querySelectorAll(".chapter-block").forEach(sec => observer.observe(sec));
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

    ST.unlockedThrough = DATA.unlockedThrough;
    await loadReaderAds();
    walletBalance = 0;

    document.getElementById("loadingState").style.display = "none";
    document.getElementById("storyTop").style.display = "";
    document.getElementById("storyTop").innerHTML =
      '<div class="story-top-cat">' + esc(DATA.category) + "</div>" +
      '<div class="story-top-title">' + esc(DATA.title) + "</div>" +
      '<div class="story-top-author">by ' + esc(DATA.author.name) + "</div>";

    updateCoinDisplays();
    buildReaderColumn();
    READER_SERVED.forEach(id => trackAd(id, "impression"));
    buildChaptersPanel();
    wireComponents();
    wireFloatingControls();
    wireScrollProgress();
    wireExitIntent();
  }

  /* ══ PUBLIC API ══ */
  window.ScrollReader = {
    attemptUnlock,
    buyPackage,
    jumpToChapter,
    doSave,
    doShare,
    doTip,
    changeFontSize,
    setLH,
    setFF,
    setTheme,
    openSettings,
    openChPanel,
    closeChPanel,
    closeAllSheets,
    closeBuyCoins,
    setBuyTab,
    fundWallet,
    attemptExit,
    confirmExit,
    exitCtaClick,
  };

  /* Expose for inline onclick handlers in HTML */
  window.closeAllSheets = closeAllSheets;
  window.closeChPanel = closeChPanel;
  window.changeFontSize = changeFontSize;
  window.setLH = setLH;
  window.setFF = setFF;
  window.setTheme = setTheme;
  window.setBuyTab = setBuyTab;
  window.fundWallet = fundWallet;
  window.confirmExit = confirmExit;
  window.exitCtaClick = exitCtaClick;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
