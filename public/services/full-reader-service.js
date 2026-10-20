/* ===============================================================
   FULL READER SERVICE
   Full-chapter reader orchestration. Page calls FullReader.init().
   Data: DemoData.FULL_STORY, DemoData.READER_TEAMS, etc.
   All UI via shared components: reaction-picker, share-modal,
   save-modal, tip-picker, comment-section, ad-card.
   When going live: swap DemoData reads for API calls.
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
    t._t = setTimeout(() => t.classList.remove("show"), 2500);
  }
  function fmtN(n) { return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }
  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ══ CENTRAL DATA ══ */
  const D = window.DemoData || {};
  const FS = D.FULL_STORY || { id: "", title: "", chapters: [], unlockedThrough: 0, author: {}, similar: [], comments: [], shares: 0, tips: 0 };
  const TEAMS = D.READER_TEAMS || [];
  const currentStoryId = FS.id || "";
  const AUTHOR = FS.author || { name: "Writer", avatar: "", handle: "@writer" };

  /* ══ SEASONS + CHAPTER CONTENT ══ */
  const SEASONS_DATA = [{
    label: "Season 1",
    chs: (FS.chapters || []).map((c, i) => ({
      n: c.n, title: c.title,
      meta: Math.max(1, Math.round((c.words || 600) / 200)) + " min",
      badge: c.n === 1 ? "free" : (i === (FS.unlockedThrough - 1) ? "new" : null),
      state: i < (FS.unlockedThrough - 1) ? "done" : (i === (FS.unlockedThrough - 1) ? "current" : "locked"),
    })),
  }];
  const CHAPTER_CONTENT = {};
  (FS.chapters || []).forEach((c) => {
    if (c.paras && c.paras.length) CHAPTER_CONTENT["s1c" + c.n] = c.paras;
  });
  function genericParas(title) {
    return [
      'This chapter continues the story — "' + esc(title) + '." The details replay in fragments: a door left ajar, a name spoken too carefully, a silence that says more than the sentence that follows it.',
      "Every choice made here presses against the ones that came before it. Nothing is undone. Nothing is simple.",
      "By the final page, something has shifted — quietly, the way most important things do.",
    ];
  }
  function getChapterParas(seasonIdx, ch) {
    const key = "s" + (seasonIdx + 1) + "c" + ch.n;
    return CHAPTER_CONTENT[key] || genericParas(ch.title);
  }

  /* ══ PREMIUM + WORD COUNT (for 300-word ads) ══ */
  function isPremiumUser() {
    try {
      const raw = localStorage.getItem('droboard_premium') || localStorage.getItem('dro_premium');
      if (raw === 'true' || raw === '1') return true;
      if (D && D.USERS && D.USERS['You_Reader'] && D.USERS['You_Reader'].isPremium) return true;
      if (FS && FS.isPremium) return true;
    } catch(e){}
    return false;
  }
  function countWords(s){ return (s||'').trim().split(/\s+/).filter(Boolean).length; }

  /* ══ AD STATE — mirrors scroll reader: how each chapter was unlocked
     (free/coin/ads), the fullReader placement flags, and slot toggles.
     Coin-unlocked chapters stay ad-free unless marketing flips
     fullReader.paidUnlockAds. ══ */
  const ADST = { unlockMode: {}, paidUnlockAdsOn: false, adsEnabled: true, slots: {} };
  function chKey(si, ci) {
    const chs = (SEASONS_DATA[si] || {}).chs || [];
    return si + ':' + ((chs[ci] || {}).n || ci);
  }
  function markUnlockRange(si, fromIdx, howMany, mode) {
    const chs = (SEASONS_DATA[si] || {}).chs || [];
    const last = howMany === "all" ? chs.length - 1 : Math.min(chs.length - 1, fromIdx + howMany - 1);
    for (let i = fromIdx; i <= last; i++) {
      if (chs[i]) ADST.unlockMode[si + ':' + chs[i].n] = mode;
    }
  }
  function paidAdsOff() { return ADST.paidUnlockAdsOn !== true; }
  function chapterAdFree(si, ci) {
    const chs = (SEASONS_DATA[si] || {}).chs || [];
    const ch = chs[ci];
    if (!ch) return false;
    return paidAdsOff() && ADST.unlockMode[si + ':' + ch.n] === 'coin';
  }
  function slotOn(key) {
    const s = ADST.slots || {};
    if (!(key in s)) return true;
    const v = s[key];
    return v !== false && !(v && typeof v === 'object' && v.enabled === false);
  }

  /* ══ WALLET — owned by the shared DroboardReader sheet
     (component/reader.js). This page builds no purchase UI: on coin lock
     it opens the sheet; the unlock retries after purchase. ══ */
  function updateCoinPill(balance) {
    const el = document.getElementById("coinBalanceLbl");
    if (el) el.textContent = fmtN(balance != null ? balance : (window.DroboardReader ? DroboardReader.getBalance() : 0));
  }
  // Real purchase inside the app build, simulated locally in demo
  // (the sheet shows its own loading state either way).
  function buyCoinsViaSheet(p) {
    if (window.DroboardIAP) {
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

  /* ══ TEAMS (from central data) ══ */
  let teamCounts = {};
  TEAMS.forEach(t => { teamCounts[t.id] = t.count || 0; });
  let teamPicked = null;

  function renderTeams() {
    const grid = document.getElementById("teamGrid");
    if (!grid) return;
    grid.innerHTML = TEAMS.map(t =>
      '<div class="team-btn' + (teamPicked === t.id ? " selected" : "") + '" data-team="' + t.id + '" onclick="FullReader.pickTeam(\'' + t.id + '\')">' +
        '<div class="team-icon">' + t.icon + '</div>' +
        '<div class="team-info">' +
          '<div class="team-name">' + t.name + '</div>' +
          '<div class="team-count" id="tc-' + t.id + '">' + fmtN(teamCounts[t.id]) + '</div>' +
        '</div>' +
        '<div class="team-check" id="tck-' + t.id + '"><i class="' + (teamPicked === t.id ? "fas fa-check-circle" : "far fa-circle") + '"></i></div>' +
      '</div>'
    ).join("");
    const tot = Object.values(teamCounts).reduce((a, b) => a + b, 0) || 1;
    document.getElementById("teamBarsWrap").innerHTML = TEAMS.map(t =>
      '<div class="team-bar-seg" data-team="' + t.id + '" style="width:' + Math.round(teamCounts[t.id] / tot * 100) + '%"></div>'
    ).join("");
    document.getElementById("teamBarLabels").innerHTML = TEAMS.map(t => {
      const pct = Math.round(teamCounts[t.id] / tot * 100);
      return '<div class="team-bar-lbl" style="width:' + pct + '%"><span class="dot" style="background:' + t.col + '"></span><span style="color:' + t.col + ';font-size:8px;">' + pct + '%</span></div>';
    }).join("");
  }
  function pickTeam(t) {
    if (teamPicked === t) return;
    if (teamPicked) teamCounts[teamPicked]--;
    teamPicked = t;
    teamCounts[t]++;
    const team = TEAMS.find(x => x.id === t);
    toast(team.icon + " You're " + team.name + "!");
    renderTeams();
    const commentTeamChip = document.querySelector('.dcs-team-picker .dcs-team-chip[data-team="' + t + '"]');
    if (commentTeamChip) commentTeamChip.click();
    // open comment box and scroll there
    const sec = document.getElementById("commentsSection");
    if (sec) {
      try { if (window.DroboardComments && typeof DroboardComments.open === 'function') DroboardComments.open(); } catch(e){}
      sec.scrollIntoView({behavior:"smooth", block:"start"});
      setTimeout(()=>{ const inp=document.querySelector('#commentsPlaceholder textarea, .dcs-input, textarea[placeholder*="comment" i]'); if(inp) inp.focus(); }, 350);
    }
  }

  /* ══ REACTIONS — via shared reaction-picker component ══ */
  function initReactions() {
    if (!window.DroboardReactionPicker) return;
    const totalReactions = (FS.shares || 0) + (FS.tips || 0) + 33000;
    const phoneEl = document.querySelector(".phone");
    if (!phoneEl) return;

    // Story-level reaction state (single story per page). attachCounters
    // handles all toggle math; this host just seeds counts + persists.
    const sid = "story-" + currentStoryId;

    DroboardReactionPicker.attachCounters(phoneEl, {
      getCounts: (id) => {
        if (String(id) !== sid) return null;
        return { userRx: null, love: totalReactions };
      },
      save: () => {}, // story-level reactions are ephemeral demo state
    });

    // Replace bottom bar Like button with reaction-picker trigger
    const bbLike = document.getElementById("bbLike");
    if (bbLike) {
      bbLike.outerHTML = DroboardReactionPicker.renderTrigger(sid, {
        liked: false,
        likeCount: totalReactions,
      });
    }
  }

  /* ══ SETTINGS ══ */
  let fsVal = 14; const FS_MIN = 11, FS_MAX = 24;
  function changeFontSize(d) {
    fsVal = Math.min(FS_MAX, Math.max(FS_MIN, fsVal + d));
    document.documentElement.style.setProperty("--fs", fsVal + "px");
    document.getElementById("fontSizeDisplay").textContent = fsVal + "px";
    document.getElementById("fontPreview").style.fontSize = Math.max(9, fsVal - 4) + "px";
  }
  function setLH(el, val) {
    document.querySelectorAll(".lh-opt").forEach(x => x.classList.remove("on"));
    el.classList.add("on");
    document.documentElement.style.setProperty("--lh", val);
  }
  function setFF(el, val) {
    document.querySelectorAll(".ff-opt").forEach(x => x.classList.remove("on"));
    el.classList.add("on");
    document.documentElement.style.setProperty("--font-story", val);
  }
  function setTheme(el, theme) {
    document.body.className = theme;
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
      document.querySelectorAll(".theme-opt").forEach(x => {
        const on = (x.getAttribute('onclick') || '').indexOf("'" + theme + "'") !== -1;
        x.classList.toggle("on", on);
      });
    }
  }
  function openSettings() {
    document.getElementById("settingsPanel").classList.add("open");
    document.getElementById("overlayBg").classList.add("show");
  }

  /* ══ CHAPTERS PANEL ══ */
  let curSeasonIdx = 0;
  let curChIdx = Math.max(0, (FS.unlockedThrough || 1) - 1);
  let panelActiveSeason = curSeasonIdx;

  /* ══ LIVE BOOK + READ TRACKING ══
     ?story=<bookId> loads the real book/chapters/read-state over the demo
     seed (demo stands on any failure). Tracking posts only for live books. */
  let LIVE_BOOK = null;
  function storyIdNow() { return (LIVE_BOOK && LIVE_BOOK.id) || currentStoryId; }
  function urlStoryId() { try { return new URLSearchParams(location.search).get('story') || ''; } catch (e) { return ''; } }
  function htmlToParas(html) {
    const t = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n\n').replace(/<[^>]+>/g, '');
    return t.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  }
  async function bootLive() {
    const sid = urlStoryId();
    if (!sid || sid === currentStoryId) return;
    try {
      const [bRes, cRes] = await Promise.all([
        fetch('/api/books/' + encodeURIComponent(sid), { credentials: 'include' }),
        fetch('/api/books/' + encodeURIComponent(sid) + '/chapters', { credentials: 'include' }),
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
      applyLiveBook(book, live, state || {});
      LIVE_BOOK = book;
    } catch (e) {}
  }
  function applyLiveBook(book, live, state) {
    FS.id = book.id; FS.title = book.title || FS.title;
    FS.category = book.genre || ''; FS.cover = book.cover || FS.cover;
    const unlocked = new Set((state.unlocked || []).map(String));
    const prog = state.progress || {};
    const chs = live.map(c => {
      const key = String(c.id || c.n);
      const p = prog[key] || prog[String(c.n)] || null;
      const done = !!(p && p.finished);
      const open = !book.vipLocked || +c.n <= 3 || unlocked.has(key) || unlocked.has(String(c.n)) || done;
      return { n: c.n, title: c.title, words: c.words || 0, liveId: c.id, state: done ? 'done' : (open ? 'current' : 'locked') };
    });
    live.forEach(c => { CHAPTER_CONTENT['s1c' + c.n] = htmlToParas(c.content).slice(0, 60); });
    SEASONS_DATA.length = 0;
    SEASONS_DATA.push({ label: 'Season 1', chs });
    FS.unlockedThrough = chs.filter(c => c.state !== 'locked').length || 1;
    // initial position: URL ?ch= wins (applyReaderDeepLink), else continue point
    try {
      const urlCh = parseInt(new URLSearchParams(location.search).get('ch'), 10) || 0;
      if (!urlCh && state.lastChapterId) {
        const idx = chs.findIndex(c => String(c.liveId) === String(state.lastChapterId) || +c.n === +state.lastChapterId);
        if (idx > -1) { curSeasonIdx = 0; curChIdx = idx; panelActiveSeason = 0; return; }
      }
      const firstOpen = chs.findIndex(c => c.state !== 'locked');
      curSeasonIdx = 0; curChIdx = Math.max(0, firstOpen); panelActiveSeason = 0;
    } catch (e) {}
  }

  /* per-chapter read session: flushed on leave, finished at 85% scroll */
  let TrackSession = null, TrackScrollBound = false;
  function TrackLeave() { try { if (TrackSession) TrackSession.stop(); } catch (e) {} TrackSession = null; }
  function TrackScrollCheck() {
    if (!TrackSession) return;
    try {
      const sb = document.getElementById('scrollBody');
      const max = sb.scrollHeight - sb.clientHeight;
      if (max > 0 && (sb.scrollTop / max) >= 0.85) TrackSession.finish();
    } catch (e) {}
  }

  function renderSeasonTabs() {
    // Single flat chapter list — no seasons, so no tabs. Container hidden.
    try {
      document.getElementById("seasonTabs").innerHTML = "";
      document.getElementById("seasonTabs").style.display = "none";
    } catch (e) {}
  }
  function setPanelSeason(i) { panelActiveSeason = 0; renderSeasonTabs(); renderChList(); }
  function renderChList() {
    const chs = SEASONS_DATA[panelActiveSeason].chs;
    document.getElementById("chListPanel").innerHTML = chs.map((c, idx) => {
      const isCurrent = panelActiveSeason === curSeasonIdx && idx === curChIdx;
      const numEl = c.state === "done"
        ? '<div class="ch-num done"><i class="fas fa-check" style="font-size:9px"></i></div>'
        : c.state === "locked"
        ? '<div class="ch-num locked"><i class="fas fa-lock" style="font-size:9px"></i></div>'
        : '<div class="ch-num current">' + c.n + "</div>";
      let badge = "";
      if (c.state === "locked") badge = '<span class="ch-row-badge crb-locked">LOCKED</span>';
      else if (c.badge === "new") badge = '<span class="ch-row-badge crb-new">NEW</span>';
      else if (c.badge === "free") badge = '<span class="ch-row-badge crb-free">FREE</span>';
      const right = isCurrent ? '<span class="ch-current-badge">Reading</span>'
        : c.state === "done" ? '<i class="fas fa-check ch-done-check"></i>'
        : c.state === "locked" ? '<i class="fas fa-lock" style="color:var(--gold);font-size:12px"></i>'
        : "";
      return '<div class="ch-row' + (isCurrent ? " current" : "") + (c.state === "locked" ? " locked" : "") + '" onclick="FullReader.openChapterFromPanel(' + panelActiveSeason + "," + idx + ')">' +
        numEl +
        '<div class="ch-row-body"><div class="ch-row-title">Ch.' + c.n + " — " + esc(c.title) + '</div><div class="ch-row-meta">' + c.meta + " " + badge + "</div></div>" +
        '<div class="ch-row-right">' + right + "</div>" +
      "</div>";
    }).join("");
  }
  function openChapterFromPanel(seasonIdx, idx) {
    closeChPanel();
    const ch = ((SEASONS_DATA[seasonIdx] || {}).chs || [])[idx];
    if (!ch) return;
    TrackLeave();
    window.location.href = chapterUrl(ch.n);
  }
  function openChPanel() {
    panelActiveSeason = curSeasonIdx;
    renderSeasonTabs();
    renderChList();
    document.getElementById("chPanel").classList.add("open");
    document.getElementById("overlayBg").classList.add("show");
  }
  function closeChPanel() {
    document.getElementById("chPanel").classList.remove("open");
    document.getElementById("overlayBg").classList.remove("show");
  }

  /* ══ UNLOCK CARD + CHAPTER NAVIGATION ══ */
  function renderUnlockCard(seasonIdx, chIdx) {
    const ch = SEASONS_DATA[seasonIdx].chs[chIdx];
    return '<div class="unlock-card" id="unlockCard">' +
      '<div class="unlock-icon"><i class="fas fa-lock"></i></div>' +
      '<div class="unlock-title">Unlock Chapter ' + ch.n + "</div>" +
      '<div class="unlock-sub">Continue with coins, or unlock the rest of the story.</div>' +
      '<div class="unlock-opts">' +
        '<div class="unlock-opt" onclick="FullReader.attemptUnlockChapter(' + seasonIdx + "," + chIdx + ",'one',15)\">" +
          '<div class="unlock-opt-lbl"><div class="unlock-opt-t">This chapter only</div><div class="unlock-opt-s">Chapter ' + ch.n + "</div></div>" +
          '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 15</div>' +
        "</div>" +
        '<div class="unlock-opt reco" onclick="FullReader.attemptUnlockChapter(' + seasonIdx + "," + chIdx + ",'bundle',60)\">" +
          '<div class="unlock-opt-lbl"><div class="unlock-opt-t">Next 5 chapters ⭐</div><div class="unlock-opt-s">Best value bundle</div></div>' +
          '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 60</div>' +
        "</div>" +
'<div class="unlock-opt" onclick="FullReader.attemptUnlockChapter(' + seasonIdx + "," + chIdx + ",'story',120)\">" +
'<div class="unlock-opt-lbl"><div class="unlock-opt-t">Full story</div><div class="unlock-opt-s">Every remaining chapter</div></div>' +
          '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 120</div>' +
        "</div>" +
        '<div class="unlock-opt" onclick="FullReader.watchAdsUnlock()">' +
          '<div class="unlock-opt-lbl"><div class="unlock-opt-t">Watch ads</div><div class="unlock-opt-s">2 short ads - unlocks this chapter free</div></div>' +
          '<div class="unlock-opt-price"><i class="fas fa-play" style="font-size:10px"></i> <span id="adprogNow">' + adProgressNow() + "/2</span></div>" +
        "</div>" +
      "</div>" +
    "</div>";
  }

  function attemptUnlockChapter(seasonIdx, chIdx, mode, cost) {
    if (!window.DroboardReader) { toast("Reader unavailable — please reload"); return; }
    if (!DroboardReader.spend(cost)) {
      // Coin lock: open the shared sheet; the unlock retries after purchase.
      toast("Not enough coins — top up below");
      DroboardReader.openBuyCoins(function () { attemptUnlockChapter(seasonIdx, chIdx, mode, cost); });
      return;
    }
    updateCoinPill(DroboardReader.getBalance());
    const chs = SEASONS_DATA[seasonIdx].chs;
    if (mode === "one") {
      markUnlockRange(seasonIdx, chIdx, 1, 'coin');
      chs[chIdx].state = "current";
    } else if (mode === "bundle") {
      markUnlockRange(seasonIdx, chIdx, 5, 'coin');
      for (let i = chIdx; i < Math.min(chs.length, chIdx + 5); i++) chs[i].state = "done";
      chs[chIdx].state = "current";
    } else if (mode === "story") {
      markUnlockRange(seasonIdx, chIdx, "all", 'coin');
      for (let i = chIdx; i < chs.length; i++) chs[i].state = "done";
      chs[chIdx].state = "current";
    }
    toast("Unlocked!");
    renderChapterView(seasonIdx, chIdx);
    renderChList();
  }

  /* Re-mount the thread when moving between paid and free chapters so
     the thread slot follows the same ad-free rule. */
  let _lastThreadAdFree = null;
  function syncThreadAds() {
    const free = ADST.adsEnabled === false || chapterAdFree(curSeasonIdx, curChIdx);
    if (free === _lastThreadAdFree) return;
    _lastThreadAdFree = free;
    try { initComments(); } catch (e) {}
  }

  function renderChapterView(seasonIdx, chIdx) {
    TrackLeave();
    curSeasonIdx = seasonIdx;
    curChIdx = chIdx;
    try {
      const _chs = (SEASONS_DATA[seasonIdx] || {}).chs || [];
      if (window.ReadingHistory && _chs[chIdx]) ReadingHistory.touch(currentStoryId, _chs[chIdx].n);
    } catch (e) {}
    const season = SEASONS_DATA[seasonIdx];
    const ch = season.chs[chIdx];
    const locked = ch.state === "locked";
    if (!locked && window.ReaderTrack && LIVE_BOOK) {
      TrackSession = ReaderTrack.session(storyIdNow(), (ch.liveId || ch.n), ch.words || 0);
      if (!TrackScrollBound) {
        TrackScrollBound = true;
        try { document.getElementById('scrollBody').addEventListener('scroll', TrackScrollCheck, { passive: true }); } catch (e) {}
      }
    }

    document.getElementById("chTitleEl").textContent = ch.title;
    document.getElementById("chMetaSC").innerHTML = '<i class="fas fa-book-open" style="font-size:8px"></i> Ch ' + ch.n;
    document.getElementById("tbChInfo").textContent = ch.title;
    document.getElementById("chNavCenter").textContent = "Ch " + ch.n + " of " + season.chs.length;
    // topbar + hero chrome (was hardcoded markup) rendered from story data
    document.getElementById("tbStoryTitle").textContent = FS.title || "Story";
    var catBadge = document.querySelector(".ch-cat-badge");
    if (catBadge) {
      if (FS.category) { catBadge.textContent = FS.category; catBadge.style.display = ""; }
      else catBadge.style.display = "none";
    }
    var authorPill = document.getElementById("chMetaAuthor");
    if (authorPill) authorPill.innerHTML = "✍️ " + esc(AUTHOR.name);
    var readPill = document.getElementById("chMetaRead");
    if (readPill) readPill.innerHTML = '<i class="far fa-clock" style="font-size:8px"></i> ~' + Math.max(1, Math.round((ch.words || 600) / 200)) + " min read";

    const prevBtn = document.getElementById("prevChBtn");
    const nextBtn = document.getElementById("nextChBtn");
    const nextLbl = document.getElementById("nextChLabel");
    const nextIco = document.getElementById("nextChIcon");
    prevBtn.classList.toggle("disabled", chIdx <= 0);

    const hasNext = chIdx < season.chs.length - 1;
    nextBtn.classList.remove("disabled", "locked-next");
    if (!hasNext) {
      nextBtn.classList.add("disabled");
      nextLbl.textContent = "You're caught up";
      nextIco.className = "fas fa-check";
    } else {
      const nextCh = season.chs[chIdx + 1];
      if (nextCh.state === "locked") {
        nextBtn.classList.add("locked-next");
        nextLbl.textContent = "Unlock";
        nextIco.className = "fas fa-lock";
      } else {
        nextLbl.textContent = "Next";
        nextIco.className = "fas fa-chevron-right";
      }
    }

    const paras = getChapterParas(seasonIdx, ch);
    const storyTextEl = document.getElementById("storyText");
    if (locked) {
      storyTextEl.innerHTML = paras.map(p => "<p>" + p + "</p>").join("");
    } else {
      let htmlParas = "";
      let wordCount = 0;
      let adIdx = 0;
      const gap = readerWords();
      paras.forEach(p => {
        htmlParas += "<p>" + p + "</p>";
        wordCount += countWords(p);
        if (wordCount >= gap) {
          if (!isPremiumUser() && ADST.adsEnabled !== false && slotOn('fullReader:per-300-words') && !chapterAdFree(seasonIdx, chIdx)) {
            let adHtml = "";
            const pool = (window._fullReaderBanners && window._fullReaderBanners.length) ? window._fullReaderBanners : null;
            if (pool && window.DroboardAdCard) {
              const item = pool[(adIdx + (ch.n || 0)) % pool.length];
              const ad = item && item.ad ? item.ad : item;
              const type = item && item.type ? item.type : "";
              if (ad) {
                try { if (window.AdService) AdService.track(ad.id, "impression", { page: "full-reader", slot: "fullReader:per-300-words", storyId: storyIdNow() }); } catch (e) {}
                let inner = "";
                if (type === "embed" && DroboardAdCard.renderEmbed) inner = DroboardAdCard.renderEmbed(ad);
                else if (type === "native") inner = DroboardAdCard.renderNative(ad);
                else if (type === "storyPromo") inner = DroboardAdCard.renderStoryPromo(ad);
                else if (type === "platform") inner = DroboardAdCard.renderPlatform(ad);
                else inner = DroboardAdCard.renderBanner(ad);
                if (inner) adHtml = '<div class="ad-slot" data-adid="' + ad.id + '"><div class="ad-slot-label">Sponsored</div>' + inner + '</div>';
              }
            } else {
              // pool not ready or empty: render no box (never a fake placeholder)
              adHtml = "";
            }
            if (adHtml) htmlParas += adHtml;
          }
          adIdx++;
          wordCount = 0;
        }
      });
      storyTextEl.innerHTML = htmlParas;
    }
    storyTextEl.classList.toggle("locked-fade", locked);

    const existingCard = document.getElementById("unlockCard");
    if (existingCard) existingCard.remove();
    // engagement mount (polls + predictions) — reused across chapters.
    // Anchored after the bottom ad slot when present.
    let engMount = document.getElementById("readerEngMount");
    if (engMount) engMount.remove();
    if (!locked && window.ReaderEngagement) {
      const anchor = document.getElementById('chBottomAd') || storyTextEl;
      anchor.insertAdjacentHTML("afterend", '<div id="readerEngMount" style="max-width:680px;margin:0 auto;padding:0"></div>');
      engMount = document.getElementById("readerEngMount");
      try { window.ReaderEngagement.renderInto("s" + (seasonIdx + 1) + "c" + ch.n, ch.n, engMount, ch.authorNote || ch.note || ""); } catch (e) {}
    }
    if (locked) {
      storyTextEl.insertAdjacentHTML("afterend", renderUnlockCard(seasonIdx, chIdx));
    }

    document.getElementById("teamSidingSection").style.display = locked ? "none" : "";
    document.getElementById("commentsSection").style.display = locked ? "none" : "";
    if (locked) {
      // Locked chapters carry no ads anywhere.
      document.getElementById("adSlotWrap").style.display = "none";
      try {
        const bh = document.getElementById('chBottomAd');
        if (bh) bh.style.display = 'none';
      } catch (e) {}
    } else {
      try { fillTopSlot(); } catch (e) {}
      try { fillBottomSlot(); } catch (e) {}
    }
    if (!locked) { try { syncThreadAds(); } catch (e) {} }
    document.getElementById("chEndSection").style.display = locked ? "none" : "";
    if (!locked) {
      document.getElementById("chEndTitle").textContent = "Chapter " + ch.n + " complete";
      try {
        var shEl = document.getElementById("ebShareCount");
        if (shEl) shEl.textContent = fmtN(FS.shares || 0);
        var tpEl = document.getElementById("ebTipsCount");
        if (tpEl) tpEl.textContent = fmtN(FS.tips || 0) + " tips";
      } catch (e) {}
      const nextExists = chIdx < season.chs.length - 1;
      document.getElementById("chEndSub").innerHTML = nextExists
        ? "Ready for the next chapter?<br/>" + season.chs[chIdx + 1].title
        : "You're all caught up on " + esc(FS.title || "this story") + ".<br/>New chapters drop soon.";
    }

    scrollChapterTop();
    renderChList();
  }

  /* Chapter navigation always restarts at the top: instant jump + a
     next-frame re-pin (covers late layout shifts from loading images). */
  function scrollChapterTop() {
    try {
      const sb = document.getElementById("scrollBody");
      if (!sb) return;
      try { sb.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { sb.scrollTop = 0; }
      sb.scrollTop = 0;
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function () { try { sb.scrollTop = 0; } catch (e) {} });
      }
    } catch (e) {}
  }

  /* ══ WATCH ADS TO UNLOCK — 2 full ad views unlock 1 chapter free.
     Progress persists per story+chapter so a refresh never wipes it. ══ */
  function adKeyNow() {
    var chs = SEASONS_DATA[curSeasonIdx].chs;
    return "dro_adunlock_full_" + currentStoryId + "_s" + curSeasonIdx + "c" + chs[curChIdx].n;
  }
  function adProgressNow() {
    try { return Math.min(2, parseInt(localStorage.getItem(adKeyNow()) || "0", 10) || 0); }
    catch (e) { return 0; }
  }
  function fullAdInventory() {
    return (window._fullReaderBanners || []).filter(function (b) {
      return b && (b.type === "banner" || b.type === "native") && b.ad;
    });
  }
  function watchAdsUnlock() {
    var chN = SEASONS_DATA[curSeasonIdx].chs[curChIdx].n;
    if (adProgressNow() >= 2) { unlockCurrentFree(); return; }
    if (!window.DroboardRewardedAd) { toast("Ads unavailable right now"); return; }
    var need = 2 - adProgressNow();
    DroboardRewardedAd.show({
      ads: fullAdInventory(),
      rewardLabel: "Watch to the end (" + need + " more) to unlock Chapter " + chN + " free",
      onComplete: function () {
        var n = adProgressNow() + 1;
        try { localStorage.setItem(adKeyNow(), String(n)); } catch (e) {}
        var lbl = document.getElementById("adprogNow");
        if (lbl) lbl.textContent = Math.min(2, n) + "/2";
        if (n >= 2) { unlockCurrentFree(); }
        else toast("1 more ad to unlock Chapter " + chN);
      },
    });
  }
  function unlockCurrentFree() {
    var chs = SEASONS_DATA[curSeasonIdx].chs;
    markUnlockRange(curSeasonIdx, curChIdx, 1, 'ads');
    chs[curChIdx].state = "current";
    toast("Unlocked!");
    renderChapterView(curSeasonIdx, curChIdx);
    renderChList();
  }

  /* Chapter navigation = real navigation (?story=&ch=): a fresh page load
     always starts at the top — no scroll-position fights. */
  function chapterUrl(n) {
    return 'full-reader.html?story=' + encodeURIComponent(storyIdNow()) + '&ch=' + n;
  }
  function goChapter(dir) {
    const season = SEASONS_DATA[curSeasonIdx];
    const nextIdx = curChIdx + dir;
    if (nextIdx < 0) { toast("You're on the first chapter!"); return; }
    if (nextIdx >= season.chs.length) { toast("You're all caught up!"); return; }
    TrackLeave();
    window.location.href = chapterUrl(season.chs[nextIdx].n);
  }

  /* ══ CLOSE ALL ══ */
  function closeAllSheets() {
    document.getElementById("settingsPanel").classList.remove("open");
    document.getElementById("chPanel").classList.remove("open");
    document.getElementById("overlayBg").classList.remove("show");
  }

  /* ══ SHARE / SAVE / TIP / NOTIFY — all via components ══ */
  let notifyOn = false;
  function toggleNotify() {
    notifyOn = !notifyOn;
    const btn = document.getElementById("notifyBtn");
    const icon = document.getElementById("notifyIcon");
    const label = document.getElementById("notifyLabel");
    if (btn) btn.classList.toggle("notify-active", notifyOn);
    if (icon) icon.className = notifyOn ? "fas fa-bell" : "far fa-bell";
    if (label) label.textContent = notifyOn ? "Notified" : "Notify";
    toast(notifyOn ? "🔔 You'll be notified when new chapters drop!" : "Notification removed");
  }

  function initShareSaveTip() {
    // Tip picker
    if (window.DroboardTip) {
      DroboardTip.attach({
        getWriter: () => ({ name: AUTHOR.name, avatar: AUTHOR.avatar, handle: AUTHOR.handle }),
        onSend: (id, amount, note, mode) => { console.log("tip sent", id, amount, note, mode); },
      });
    }
    // Save modal callback
    window.onDroboardSaveChange = function (storyId, saved) {
      const bbSave = document.getElementById("bbSave");
      if (bbSave) {
        bbSave.classList.toggle("saved", saved);
        bbSave.querySelector(".bb-icon").innerHTML = saved ? '<i class="fas fa-bookmark"></i>' : '<i class="far fa-bookmark"></i>';
        bbSave.querySelector(".bb-label").textContent = saved ? "Saved" : "Save";
      }
      const endSave = document.getElementById("ebSaveEnd");
      if (endSave) {
        endSave.classList.toggle("saved", !!saved);
        const ico = endSave.querySelector(".eb-icon");
        if (ico) ico.className = (saved ? "fas fa-bookmark eb-icon" : "far fa-bookmark eb-icon");
      }
    };
  }

  function openShare() {
    if (window.openShareModal) {
      window.openShareModal({
        title: FS.title || "Story",
        sub: "by " + AUTHOR.name,
        img: "",
        url: "https://droboard.app/story/" + currentStoryId,
      });
    }
  }
  function openSave() {
    if (window.openSaveModal) {
      window.openSaveModal({
        title: FS.title || "Story",
        sub: "by " + AUTHOR.name,
        img: "",
        storyId: currentStoryId,
      });
    }
  }
  function openTip() {
    if (window.DroboardTip) {
      DroboardTip.open(currentStoryId, {
        name: AUTHOR.name,
        avatar: AUTHOR.avatar,
        handle: AUTHOR.handle,
      });
    }
  }

  /* ══ COMMUNITIES — genre board + author circle via component ══ */
  function initCommunities() {
    if (!window.DroboardCommunityCards) return;
    const mount = document.getElementById("communitiesMount");
    if (!mount) return;
    const g = DroboardCommunityCards.genreInfo(FS.category);
    const state = { genreJoined: false, circleJoined: false };
    const paint = () => DroboardCommunityCards.mount(mount, {
      genre: { name: g.name, icon: g.icon, members: DroboardCommunityCards.demoMembers(g.name, 20000, 380000), joined: state.genreJoined },
      circle: {
        name: AUTHOR.name + "'s Inner Circle",
        members: DroboardCommunityCards.demoMembers(AUTHOR.name || AUTHOR.handle, 800, 9200),
        perks: 'Early chapters, behind-the-scenes, live Q&As',
        joined: state.circleJoined, avatar: AUTHOR.avatar,
      },
      showCircle: false, // genre board only — circle lives on the bridge page
      onJoin: (type, joined) => {
        if (type === 'genre') state.genreJoined = joined;
        else state.circleJoined = joined;
        paint();
        toast(joined ? '✅ Joined!' : 'Left the community');
      },
    });
    paint();
  }

  /* ══ COMMENTS — via component ══ */
  function mapSeedComment(c) {
    return Object.assign({}, c, {
      statusRing: (c.statusRing || "none").replace("ring-", ""),
      replies: (c.replies || []).map(mapSeedComment),
    });
  }
  function initComments() {
    const mount = document.getElementById("commentsPlaceholder");
    const fail = (msg) => {
      try {
        if (mount) mount.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--muted)">💬 ' + msg + '</div>';
        console.error('[FullReader] comments:', msg);
      } catch (e) {}
    };
    if (!window.DroboardComments) { fail('Comments failed to load — hard-refresh (Ctrl+Shift+R).'); return; }
    if (!mount) { fail('Comment mount missing on this page.'); return; }
    const raw = (typeof COMMENTS_DATA !== 'undefined' && COMMENTS_DATA.length) ? COMMENTS_DATA : (FS.comments || []);
    const SEED_COMMENTS = raw.map(mapSeedComment);
    const trueTotal = (function countAll(list) {
      return (list || []).reduce(function (n, c) { return n + 1 + countAll(c.replies || []); }, 0);
    })(SEED_COMMENTS); // same math as the component's own counter
    try {
      DroboardComments.attach("#commentsPlaceholder", {
      storyId: currentStoryId,
      title: fmtN(trueTotal) + " comments",
      comments: SEED_COMMENTS,
      teams: TEAMS,
      currentUser: { name: "You", avatar: null, team: null },
      requireTeam: false,
      collapsible: true,
      startOpen: false,
      adsRepeat: false, // top ad slot only, same as scroll reader
      scrollBox: 420, // bounded inner-scroll list (ad + ~2 comments) + pinned composer
      fullCommentsUrl: function () {
        return 'comments.html?story=' + encodeURIComponent(storyIdNow()) + '&ch=' + currentChNum();
      },
      ads: (ADST.adsEnabled === false || chapterAdFree(curSeasonIdx, curChIdx)) ? false : undefined,
      getCommentUrl: (c) => "https://droboard.app/story/" + currentStoryId + "#comment-" + c.id,
      onPost: (c) => console.log("posted", c),
      onReply: (parentId, c) => console.log("replied to", parentId, c),
      onEdit: (c, oldText, newText) => console.log("edited", c.id, oldText, "->", newText),
      onDotsAction: (action) => { if (action === "delete") toast("Comment deleted."); },
      });
    } catch (err) {
      fail('Comments crashed on load (' + ((err && err.message) || err) + ').');
    }
  }

  /* ══ SPONSORED AD — via component ══
     Three marketing-programmed slots: top (above chapter), per-N-words
     inline, bottom (after chapter, before engagement). Gap N comes from
     placement.wordsPerSlot (default 300). */
  let READER_WORDS = 300;
  function readerWords() { return Math.min(2000, Math.max(50, parseInt(READER_WORDS, 10) || 300)); }
  function ensureBottomAd() {
    let el = document.getElementById('chBottomAd');
    if (!el) {
      const st = document.getElementById('storyText');
      if (!st || !st.parentNode) return null;
      el = document.createElement('div');
      el.id = 'chBottomAd'; el.className = 'ad-slot';
      el.setAttribute('data-slot', 'fullReader:bottom');
      el.style.display = 'none';
      st.parentNode.insertBefore(el, st.nextSibling);
    }
    return el;
  }
  function initAdSlot() {
    function track(id, ev, ctx) { try { if (id && window.AdService) AdService.track(id, ev, ctx); } catch (e) {} }
    async function managedPool(slot) {
      const out = [];
      const p = await AdService.getAds({ page: "fullReader", slot: slot || "fullReader:per-300-words" });
      let fmt = 'auto';
      try {
        const pl = await AdService.getPlacement("fullReader");
        fmt = (pl && pl.format) || 'auto';
        if (pl && pl.wordsPerSlot) READER_WORDS = Math.min(2000, Math.max(50, parseInt(pl.wordsPerSlot, 10) || 300));
        ADST.paidUnlockAdsOn = !!(pl && pl.paidUnlockAds);
        ADST.adsEnabled = !(pl && pl.enabled === false);
        ADST.slots = (pl && pl.slots) || {};
      } catch (e) {}
      const allow = function (t) {
        if (!fmt || fmt === 'auto') return true;
        if (fmt === 'book') return t === 'storyPromo';
        return t === fmt;
      };
      (p.embed || []).filter(function (ad) { return ad && ad.code; }).forEach(ad => out.push({ type: "embed", ad }));
      (p.native || []).forEach(ad => out.push({ type: "native", ad }));
      (p.book || []).forEach(ad => out.push({ type: "storyPromo", ad }));
      // Same edge recipe as scroll reader: embed + native + book only
      // (no platform/house banners), so both readers show the same card.
      return out.filter(function (item) { return item.type !== "platform" && item.type !== "banner" && allow(item.type); });
    }
    (window.AdService ? managedPool("fullReader:per-300-words").catch(() => []) : Promise.resolve([])).then(function (pool) {
      window._fullReaderBanners = (pool || []).filter(function (p) { return p && p.ad; });
      // pool arrived after first paint: re-render current chapter once so
      // in-chapter slots fill with real ads instead of staying empty.
      try {
        if (window._fullReaderBanners.length && !document.querySelector('#storyText .ad-slot')) {
          renderChapterView(curSeasonIdx, curChIdx);
        }
      } catch (e) {}
      fillTopSlot();
      fillBottomSlot();
    });
    // In-chapter clicks: delegate once on #storyText (creatives are rendered
    // as innerHTML, so DroboardAdCard.attach never runs for them). storyPromo
    // tracks via its inline onclick — skip it here to avoid double-counting.
    try {
      const stEl = document.getElementById('storyText');
      if (stEl && !stEl.__adClickBound) {
        stEl.__adClickBound = true;
        stEl.addEventListener('click', function (e) {
          const item = e.target.closest('[data-adid]');
          if (!item || e.target.closest('.dac-story-promo')) return;
          const adid = item.getAttribute('data-adid');
          if (adid) track(adid, 'click', { page: 'full-reader', slot: 'fullReader:per-300-words', storyId: storyIdNow() });
        });
      }
    } catch (e) {}
  }
  function currentChNum() {
    const chs = (SEASONS_DATA[curSeasonIdx] || {}).chs || [];
    return (chs[curChIdx] || {}).n || 1;
  }
  // Top edge slot. Reader gates (premium / ad-free chapter / slot toggle)
  // are checked here; the creative itself is filled by DroboardAdSlot.
  // The component is mounted explicitly (no data-ad-slot attribute) so its
  // auto-scanner never bypasses the chapter-level gates below.
  function fillTopSlot() {
    const wrap = document.getElementById("adSlotWrap");
    const slot = document.getElementById("adSlot");
    if (!wrap || !slot) return;
    const allowed = ADST.adsEnabled !== false && slotOn('fullReader:top')
      && !chapterAdFree(curSeasonIdx, curChIdx);
    if (!allowed || !window.DroboardAdSlot) { wrap.style.display = "none"; return; }
    DroboardAdSlot.mount(slot, { slot: 'fullReader:top', page: 'full-reader', storyId: storyIdNow(), max: 1 }).then(function (filled) {
      wrap.style.display = filled ? "" : "none";
    });
  }
  // Bottom edge slot, refilled for every chapter view. Same gate + mount
  // pattern as the top slot.
  function fillBottomSlot() {
    let host = null;
    try { host = ensureBottomAd(); } catch (e) { host = null; }
    if (!host) return;
    const allowed = ADST.adsEnabled !== false && slotOn('fullReader:bottom')
      && !chapterAdFree(curSeasonIdx, curChIdx);
    if (!allowed || !window.DroboardAdSlot) { host.style.display = 'none'; return; }
    DroboardAdSlot.mount(host, { slot: 'fullReader:bottom', page: 'full-reader', storyId: storyIdNow(), max: 1 }).then(function (filled) {
      host.style.display = filled ? '' : 'none';
      if (filled) host.dataset.filled = '1';
    });
  }

  /* ══ YOU MAY ALSO LIKE — from central data ══ */
  function initYML() {
    const similar = FS.similar || [];
    if (!similar.length) { document.querySelector(".yml-section").style.display = "none"; return; }
    document.getElementById("ymlScroll").innerHTML = similar.map(s =>
      '<div class="yml-card" onclick="location.href=\'scroll-reader.html?story=' + (s.id || "") + '\'">' +
        '<div class="yml-cover"><img src="' + (s.cover || "") + '" loading="lazy" alt=""/><div class="yml-cover-scrim"></div>' +
        '<div class="yml-cover-views"><i class="fas fa-eye" style="font-size:7px"></i></div></div>' +
        '<div class="yml-text-title">' + esc(s.title || "") + "</div>" +
        '<div class="yml-text-author">@' + esc(s.author || "") + "</div>" +
      "</div>"
    ).join("");
  }

  /* ══ SCROLL + TOPBAR — same wiring as scroll-reader floating
     controls: tap anywhere toggles the top bar, scroll hides it,
     tap-show auto-hides after 3s. ══ */
  function wireScroll() {
    const sb = document.getElementById("scrollBody");
    const topbar = document.getElementById("topbar");
    if (!sb || !topbar) return;
    // Progress follows the real page scroll: the inner container only
    // scrolls when the phone shell is height-bounded, otherwise the
    // window does — measure whichever one actually moves.
    function paintProgress() {
      const fill = document.getElementById("readProgressFill");
      if (!fill) return;
      let pct = 0;
      const maxSb = sb.scrollHeight - sb.clientHeight;
      if (maxSb > 0) {
        pct = Math.round(sb.scrollTop / maxSb * 100);
      } else {
        const doc = document.documentElement;
        const maxW = doc.scrollHeight - doc.clientHeight;
        if (maxW > 0) pct = Math.round(((window.scrollY || doc.scrollTop || 0) / maxW) * 100);
      }
      fill.style.width = Math.min(100, Math.max(0, pct)) + "%";
    }
    sb.addEventListener("scroll", paintProgress, { passive: true });

    let hideTimer = null;
    const toTop = document.getElementById("toTopArrow");
    let topScrolling = false;
    function showTopbar() {
      topbar.classList.remove("hidden");
      if (toTop) toTop.classList.add("show");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { topbar.classList.add("hidden"); if (toTop) toTop.classList.remove("show"); }, 3000);
    }
    function hideTopbarNow() {
      topbar.classList.add("hidden");
      if (toTop) toTop.classList.remove("show");
      clearTimeout(hideTimer);
    }
    sb.addEventListener("click", (e) => {
      if (e.target.closest(".eb-btn, .unlock-opt, .team-btn, .ch-row, .dcs-wrap, .dac-banner, a, button, input, textarea, select")) return;
      topbar.classList.contains("hidden") ? showTopbar() : hideTopbarNow();
    });
    sb.addEventListener("scroll", () => { if (!topScrolling) hideTopbarNow(); }, { passive: true });
    window.addEventListener("scroll", () => { paintProgress(); if (!topScrolling) hideTopbarNow(); }, { passive: true });
    if (toTop) {
      if (topbar.classList.contains("hidden")) toTop.classList.remove("show");
      else toTop.classList.add("show");
      toTop.addEventListener("click", function () {
        topScrolling = true;
        showTopbar();
        try { sb.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { sb.scrollTop = 0; }
        try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {}
        const end = function () { topScrolling = false; };
        sb.addEventListener("scrollend", end, { once: true });
        window.addEventListener("scrollend", end, { once: true });
        setTimeout(end, 900);
      });
    }
  }

  /* ══ PUBLIC API (called by service-rendered templates) ══ */
  window.FullReader = {
    pickTeam,
    setPanelSeason,
    openChapterFromPanel,
    attemptUnlockChapter,
    watchAdsUnlock,
    toggleNotify,
  };
  // Page toast doubles as the shared-component toast target (reader sheet, etc.)
  window.toast = toast;
  /* Static shell controls — HTML carries data-act attributes only, no
     inline handlers. Wired here on init. */
  function goBack() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "discover.html";
  }
  function goScrollMode() {
    window.location.href = "scroll-reader.html?story=" + currentStoryId;
  }
  function wireStaticChrome() {
    const qa = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
    qa('[data-act="go-back"]').forEach(function (b) { b.addEventListener("click", goBack); });    qa('[data-act="open-settings"]').forEach(function (b) { b.addEventListener("click", openSettings); });
    var tbLogo = document.getElementById("tbLogo");
    if (tbLogo) tbLogo.addEventListener("click", function () { window.location.href = "discover.html"; });
    qa('[data-act="open-chapters"]').forEach(function (b) { b.addEventListener("click", openChPanel); });
    qa('[data-act="close-panels"]').forEach(function (b) { b.addEventListener("click", closeAllSheets); });
    qa('[data-act="ch-prev"]').forEach(function (b) { b.addEventListener("click", function () { goChapter(-1); }); });
    qa('[data-act="ch-next"]').forEach(function (b) { b.addEventListener("click", function () { goChapter(1); }); });
    qa('[data-act="toggle-notify"]').forEach(function (b) { b.addEventListener("click", toggleNotify); });
    qa('[data-act="open-share"]').forEach(function (b) { b.addEventListener("click", openShare); });
    qa('[data-act="open-save"]').forEach(function (b) { b.addEventListener("click", openSave); });
    qa('[data-act="open-tip"]').forEach(function (b) { b.addEventListener("click", openTip); });
    qa('[data-act="coin-pill"]').forEach(function (b) { b.addEventListener("click", function () { window.location.href = "store.html"; }); });
    qa('[data-act="scroll-mode"]').forEach(function (b) { b.addEventListener("click", goScrollMode); });
    qa('[data-act="fs-dec"]').forEach(function (b) { b.addEventListener("click", function () { changeFontSize(-1); }); });
    qa('[data-act="fs-inc"]').forEach(function (b) { b.addEventListener("click", function () { changeFontSize(1); }); });
    qa('[data-lh]').forEach(function (el) { el.addEventListener("click", function () { setLH(el, el.getAttribute("data-lh")); }); });
    qa('[data-ff]').forEach(function (el) { el.addEventListener("click", function () { setFF(el, el.getAttribute("data-ff")); }); });
    qa('[data-theme]').forEach(function (el) { el.addEventListener("click", function () { setTheme(el, el.getAttribute("data-theme")); }); });
  }

  /* ══ INIT ══ */
  async function init() {
    applyStoredTheme();
    try {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
      const sb0 = document.getElementById('scrollBody');
      if (sb0) sb0.scrollTop = 0;
    } catch (e) {}
    // Shared coin sheet owns the wallet now — attach once (demo starts at 45).
    if (window.DroboardReader) {
      DroboardReader.attach({ onBalanceChange: updateCoinPill, onBuyCoins: buyCoinsViaSheet });
      DroboardReader.setBalance(45);
    }
    // top slot lives above the chapter: move the wrap up once (no HTML change)
    try {
      const wrap = document.getElementById('adSlotWrap'), st = document.getElementById('storyText');
      if (wrap && st && st.parentNode) st.parentNode.insertBefore(wrap, st);
    } catch (e) {}
    wireStaticChrome();
    renderTeams();
    renderSeasonTabs();
    wireScroll();
    initShareSaveTip();
    initReactions();
    initComments();
    try { _lastThreadAdFree = (ADST.adsEnabled === false || chapterAdFree(curSeasonIdx, curChIdx)); } catch (e) {}
    initCommunities();
    initAdSlot();
    updateCoinPill();
    try { await bootLive(); } catch (e) {}
    if (window.ReaderTrack) { try { ReaderTrack.entitlements().catch(function () {}); } catch (e) {} }
    applyReaderDeepLink();
    renderChapterView(curSeasonIdx, curChIdx);
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

  // Deep link (?story=&ch=): jump straight to a chapter (e.g. from a
  // moderation report). Unknown chapters fall back to current position.
  // ?story= is reserved for the multi-story backend; the loaded story wins.
  function applyReaderDeepLink(){
    var chN = 0;
    try { chN = parseInt(new URLSearchParams(location.search).get('ch'), 10) || 0; } catch (e) {}
    if (!chN) return;
    for (var s = 0; s < SEASONS_DATA.length; s++) {
      var idx = (SEASONS_DATA[s].chs || []).findIndex(function(c){ return +c.n === chN; });
      if (idx > -1) { curSeasonIdx = s; curChIdx = idx; panelActiveSeason = s; return; }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
