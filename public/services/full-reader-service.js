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

  /* ══ WALLET (demo) ══ */
  let walletBalance = 45;
  function updateCoinPill() {
    const el = document.getElementById("coinBalanceLbl");
    if (el) el.textContent = fmtN(walletBalance);
  }
  function grantDemoCoins() {
    walletBalance += 50;
    updateCoinPill();
    toast("+50 coins added (demo)");
    const getCoinsBox = document.getElementById("unlockGetCoins");
    if (getCoinsBox) getCoinsBox.classList.remove("show");
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
    document.getElementById("teamBarLabels").innerHTML = TEAMS.map(t =>
      '<div class="team-bar-lbl"><span class="dot" style="background:' + t.col + '"></span><span style="color:' + t.col + ';font-size:8px;">' + Math.round(teamCounts[t.id] / tot * 100) + '%</span></div>'
    ).join("");
  }
  function pickTeam(t) {
    if (teamPicked === t) return;
    if (teamPicked) teamCounts[teamPicked]--;
    teamPicked = t;
    teamCounts[t]++;
    const team = TEAMS.find(x => x.id === t);
    toast(team.icon + " You're " + team.name + "!");
    renderTeams();

    // Sync team to comments component's internal team picker
    const commentTeamChip = document.querySelector('.dcs-team-picker .dcs-team-chip[data-team="' + t + '"]');
    if (commentTeamChip) commentTeamChip.click();
  }

  /* ══ REACTIONS — via shared reaction-picker component ══ */
  function initReactions() {
    if (!window.DroboardReactionPicker) return;
    const totalReactions = (FS.shares || 0) + (FS.tips || 0) + 33000;
    const phoneEl = document.querySelector(".phone");
    if (!phoneEl) return;

    // No onReact hook — let the component manage its own state internally
    DroboardReactionPicker.attach(phoneEl);

    // Replace bottom bar Like button with reaction-picker trigger
    const bbLike = document.getElementById("bbLike");
    if (bbLike) {
      bbLike.outerHTML = DroboardReactionPicker.renderTrigger("story-" + currentStoryId, {
        liked: false,
        likeCount: totalReactions,
      });
    }
  }

  /* ══ SETTINGS ══ */
  let fsVal = 13; const FS_MIN = 11, FS_MAX = 24;
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
    document.querySelectorAll(".theme-opt").forEach(x => x.classList.remove("on"));
    el.classList.add("on");
  }
  function openSettings() {
    document.getElementById("settingsPanel").classList.add("open");
    document.getElementById("overlayBg").classList.add("show");
  }

  /* ══ CHAPTERS PANEL ══ */
  let curSeasonIdx = 0;
  let curChIdx = Math.max(0, (FS.unlockedThrough || 1) - 1);
  let panelActiveSeason = curSeasonIdx;

  function renderSeasonTabs() {
    document.getElementById("seasonTabs").innerHTML = SEASONS_DATA.map((s, i) =>
      '<div class="stab' + (i === panelActiveSeason ? " active" : "") + '" onclick="FullReader.setPanelSeason(' + i + ')">' + s.label + "</div>"
    ).join("");
  }
  function setPanelSeason(i) { panelActiveSeason = i; renderSeasonTabs(); renderChList(); }
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
    renderChapterView(seasonIdx, idx);
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
      '<div class="unlock-sub">Continue with coins, or unlock the rest of the season.</div>' +
      '<div class="unlock-opts">' +
        '<div class="unlock-opt" onclick="FullReader.attemptUnlockChapter(' + seasonIdx + "," + chIdx + ",'one',15)\">" +
          '<div class="unlock-opt-lbl"><div class="unlock-opt-t">This chapter only</div><div class="unlock-opt-s">Chapter ' + ch.n + "</div></div>" +
          '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 15</div>' +
        "</div>" +
        '<div class="unlock-opt reco" onclick="FullReader.attemptUnlockChapter(' + seasonIdx + "," + chIdx + ",'bundle',60)\">" +
          '<div class="unlock-opt-lbl"><div class="unlock-opt-t">Next 5 chapters ⭐</div><div class="unlock-opt-s">Best value bundle</div></div>' +
          '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 60</div>' +
        "</div>" +
        '<div class="unlock-opt" onclick="FullReader.attemptUnlockChapter(' + seasonIdx + "," + chIdx + ",'season',120)\">" +
          '<div class="unlock-opt-lbl"><div class="unlock-opt-t">Full season</div><div class="unlock-opt-s">Every remaining chapter</div></div>' +
          '<div class="unlock-opt-price"><i class="fas fa-coins" style="font-size:10px"></i> 120</div>' +
        "</div>" +
      "</div>" +
      '<div class="unlock-getcoins" id="unlockGetCoins">' +
        '<div class="unlock-getcoins-txt">Not enough coins.</div>' +
        '<button class="unlock-getcoins-btn" onclick="grantDemoCoins()"><i class="fas fa-coins" style="font-size:10px"></i> Get 50 coins (demo)</button>' +
      "</div>" +
    "</div>";
  }

  function attemptUnlockChapter(seasonIdx, chIdx, mode, cost) {
    if (walletBalance < cost) {
      const box = document.getElementById("unlockGetCoins");
      if (box) box.classList.add("show");
      toast("Not enough coins — top up below");
      return;
    }
    walletBalance -= cost;
    updateCoinPill();
    const chs = SEASONS_DATA[seasonIdx].chs;
    if (mode === "one") {
      chs[chIdx].state = "current";
    } else if (mode === "bundle") {
      for (let i = chIdx; i < Math.min(chs.length, chIdx + 5); i++) chs[i].state = "done";
      chs[chIdx].state = "current";
    } else if (mode === "season") {
      for (let i = chIdx; i < chs.length; i++) chs[i].state = "done";
      chs[chIdx].state = "current";
    }
    toast("Unlocked!");
    renderChapterView(seasonIdx, chIdx);
    renderChList();
  }

  function renderChapterView(seasonIdx, chIdx) {
    curSeasonIdx = seasonIdx;
    curChIdx = chIdx;
    const season = SEASONS_DATA[seasonIdx];
    const ch = season.chs[chIdx];
    const locked = ch.state === "locked";

    document.getElementById("chTitleEl").textContent = ch.title;
    document.getElementById("chMetaSC").innerHTML = '<i class="fas fa-book-open" style="font-size:8px"></i> S' + (seasonIdx + 1) + " · Ch " + ch.n;
    document.getElementById("tbChInfo").textContent = season.label + " · Chapter " + ch.n;
    document.getElementById("chNavCenter").textContent = "Ch " + ch.n + " of " + season.chs.length;

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
    storyTextEl.innerHTML = paras.map(p => "<p>" + p + "</p>").join("");
    storyTextEl.classList.toggle("locked-fade", locked);

    const existingCard = document.getElementById("unlockCard");
    if (existingCard) existingCard.remove();
    if (locked) {
      storyTextEl.insertAdjacentHTML("afterend", renderUnlockCard(seasonIdx, chIdx));
    }

    document.getElementById("teamSidingSection").style.display = locked ? "none" : "";
    document.getElementById("adSlotWrap").style.display = locked ? "none" : "";
    document.getElementById("commentsSection").style.display = locked ? "none" : "";
    document.getElementById("chEndSection").style.display = locked ? "none" : "";
    if (!locked) {
      document.getElementById("chEndTitle").textContent = "Chapter " + ch.n + " complete";
      const nextExists = chIdx < season.chs.length - 1;
      document.getElementById("chEndSub").innerHTML = nextExists
        ? "Ready for the next chapter?<br/>" + season.chs[chIdx + 1].title
        : "You're all caught up on " + season.label + ".<br/>New chapters drop soon.";
    }

    document.getElementById("scrollBody").scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
    renderChList();
  }

  function goChapter(dir) {
    const season = SEASONS_DATA[curSeasonIdx];
    const nextIdx = curChIdx + dir;
    if (nextIdx < 0) { toast("You're on the first chapter!"); return; }
    if (nextIdx >= season.chs.length) { toast("You're all caught up!"); return; }
    renderChapterView(curSeasonIdx, nextIdx);
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
      if (!bbSave) return;
      bbSave.classList.toggle("saved", saved);
      bbSave.querySelector(".bb-icon").innerHTML = saved ? '<i class="fas fa-bookmark"></i>' : '<i class="far fa-bookmark"></i>';
      bbSave.querySelector(".bb-label").textContent = saved ? "Saved" : "Save";
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

  /* ══ COMMENTS — via component ══ */
  function mapSeedComment(c) {
    return Object.assign({}, c, {
      statusRing: (c.statusRing || "none").replace("ring-", ""),
      replies: (c.replies || []).map(mapSeedComment),
    });
  }
  function initComments() {
    if (!window.DroboardComments) return;
    const SEED_COMMENTS = (FS.comments || []).map(mapSeedComment);
    DroboardComments.attach("#commentsPlaceholder", {
      storyId: currentStoryId,
      title: "Comments",
      comments: SEED_COMMENTS,
      teams: TEAMS,
      currentUser: { name: "You", avatar: null, team: null },
      requireTeam: false,
      collapsible: true,
      startOpen: false,
      getCommentUrl: (c) => "https://droboard.app/story/" + currentStoryId + "#comment-" + c.id,
      onPost: (c) => console.log("posted", c),
      onReply: (parentId, c) => console.log("replied to", parentId, c),
      onEdit: (c, oldText, newText) => console.log("edited", c.id, oldText, "->", newText),
      onDotsAction: (action) => { if (action === "delete") toast("Comment deleted."); },
    });
  }

  /* ══ SPONSORED AD — via component ══ */
  function initAdSlot() {
    function track(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }
    async function managedPool() {
      const out = [];
      const p = await AdService.getAds({ page: "fullReader" });
      (p.native || []).forEach(ad => out.push({ type: "native", ad }));
      (p.book || []).forEach(ad => out.push({ type: "storyPromo", ad }));
      (p.banner || []).forEach(ad => out.push({ type: "banner", ad }));
      return out;
    }
    (window.AdService ? managedPool().catch(() => []) : Promise.resolve([])).then(function (pool) {
      const slot = document.getElementById("adSlot");
      if (!pool.length) { document.getElementById("adSlotWrap").style.display = "none"; return; }

      const chosen = pool[Math.floor(Math.random() * pool.length)];
      function renderChosen(item) {
        if (item.type === "native") return DroboardAdCard.renderNative(item.ad);
        if (item.type === "storyPromo") return DroboardAdCard.renderStoryPromo(item.ad);
        return DroboardAdCard.renderBanner(item.ad);
      }
      slot.innerHTML = renderChosen(chosen);
      track(chosen.ad && chosen.ad.id, "impression");

      DroboardAdCard.attach(slot, {
        getAds: () => pool.map(p => p.ad),
        onOpen(ad) { if (ad) track(ad.id, "click"); if (ad.url) window.open(ad.url, "_blank"); else toast("Opening " + (ad.brand || "sponsor") + "…"); },
        onLike(ad) { ad.liked = !ad.liked; ad.likes += ad.liked ? 1 : -1; slot.innerHTML = DroboardAdCard.renderNative(ad); },
        onComment(ad) { toast(fmtN(ad.comments) + " comments"); },
        onShare(ad) { window.openShareModal({ title: ad.heading || ad.title || ad.brand, sub: "Sponsored · " + ad.brand, img: ad.image || ad.cover || "", url: ad.url || "https://droboard.app" }); },
        onCta(ad) { if (ad) track(ad.id, "click"); toast("Opening " + (ad.brand || "sponsor") + "…"); if (ad.url) window.open(ad.url, "_blank"); },
      });
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

  /* ══ SCROLL + TOPBAR ══ */
  function wireScroll() {
    const sb = document.getElementById("scrollBody");
    sb.addEventListener("scroll", () => {
      const max = sb.scrollHeight - sb.clientHeight;
      const pct = max > 0 ? Math.round(sb.scrollTop / max * 100) : 0;
      document.getElementById("readProgressFill").style.width = pct + "%";
    }, { passive: true });

    let lastY = 0;
    const topbar = document.getElementById("topbar");
    sb.addEventListener("scroll", () => {
      const y = sb.scrollTop, d = y - lastY; lastY = y;
      if (y < 60) { topbar.classList.remove("hidden"); return; }
      if (d > 6) topbar.classList.add("hidden");
      else if (d < -6) topbar.classList.remove("hidden");
    }, { passive: true });
    document.getElementById("storyText").addEventListener("click", () => topbar.classList.remove("hidden"));
  }

  /* ══ PUBLIC API ══ */
  window.FullReader = {
    pickTeam,
    changeFontSize,
    setLH,
    setFF,
    setTheme,
    openSettings,
    setPanelSeason,
    openChapterFromPanel,
    goChapter,
    attemptUnlockChapter,
    closeChPanel,
    closeAllSheets,
    openShare,
    openSave,
    openTip,
    openChPanel,
    grantDemoCoins,
    toggleNotify,
  };

  /* Expose for inline onclick handlers in HTML */
  window.openSettings = openSettings;
  window.openChPanel = openChPanel;
  window.closeChPanel = closeChPanel;
  window.closeAllSheets = closeAllSheets;
  window.changeFontSize = changeFontSize;
  window.setLH = setLH;
  window.setFF = setFF;
  window.setTheme = setTheme;
  window.openShare = openShare;
  window.openSave = openSave;
  window.openTip = openTip;
  window.goChapter = goChapter;
  window.grantDemoCoins = grantDemoCoins;
  window.toast = toast;
  window.toggleNotify = toggleNotify;
  window.currentStoryId = currentStoryId;

  /* ══ INIT ══ */
  function init() {
    renderTeams();
    renderSeasonTabs();
    wireScroll();
    initShareSaveTip();
    initReactions();
    initComments();
    initAdSlot();
    initYML();
    updateCoinPill();
    renderChapterView(curSeasonIdx, curChIdx);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
