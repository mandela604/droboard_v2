/* ===============================================================
   SERIES READER SERVICE
   Series hub orchestration. HTML calls SeriesReaderPage.init().
   Data: data/series-demo-seed.js (+ profile books). Ads: ad-service.
   Share/save via shared components. No hardcoded content.
   When going live: swap seed reads for API calls.
=============================================================== */
(function () {
  "use strict";


/* ══════════════════════════════════════════════
   DATA — Full series catalogue (6 series)
══════════════════════════════════════════════ */

/* ══ PARAMS (+ profile-book lookup so writer books open here too) ══ */
const params = new URLSearchParams(location.search);
const seriesId = params.get('id') || 's1';
function synthFromBook(p, b) {
  const n = Math.max(1, +b.chapters || 1);
  const chapters = [];
  for (let i = 1; i <= n; i++) {
    chapters.push({
      n: i, title: 'Chapter ' + i, reads: '–', time: '4 min',
      state: i <= Math.min(3, n) ? 'done' : (i === Math.min(4, n) && n > 3 ? 'current' : 'locked'),
      badges: i === 1 ? ['free'] : (i === Math.min(4, n) && n > 3 ? ['new'] : []),
    });
  }
  return {
    id: b.id, title: b.title, cat: b.cat, status: 'ongoing', isContest: false, cover: b.cover,
    synopsis: `${b.title} — ${b.cat}. Full synopsis coming soon from the author.`,
    writer: { id: p.handle, name: p.name, handle: '@' + p.handle, avatar: p.avatar, followers: fmtN(p.stats.followers), isFollowed: false },
    stats: { reads: b.reads, likes: b.likes, comments: '0', saves: '0', shares: '0' },
    seasons: 1, totalChapters: n,
    currentProgress: { season: 1, chapter: 1, chapterTitle: 'Chapter 1', percent: 5 },
    genres: [b.cat], startDate: '', lastUpdated: 'Recently', completedDate: null,
    avgReadTime: '4 min/chapter', wordCount: '',
    hasTeams: false, teams: [], polls: [], predictions: [], debates: [],
    seasonData: [{ season: 1, title: 'Season 1', status: 'ongoing', chapters }],
  };
}
/* Catalogue: central demo data in demo, API live. Go-live = USE_API. */
const USE_API = false;
const API_BASE = '/api';
let CATALOG = {};
async function fetchCatalog() {
  if (USE_API) {
    const res = await fetch(`${API_BASE}/series`);
    if (!res.ok) throw new Error('Series API failed');
    const list = await res.json();
    const map = {};
    (Array.isArray(list) ? list : []).forEach(s => { map[s.id] = s; });
    return map;
  }
  await new Promise(r => setTimeout(r, 60));
  const d = window.DemoData || {};
  return d.SERIES_CATALOG || {};
}
function resolveSeries(id) {
  if (id && CATALOG[id]) return CATALOG[id];
  try {
    const seed = window.ProfileDemoSeed;
    if (seed && seed.DEMO_PROFILES) {
      for (const handle of Object.keys(seed.DEMO_PROFILES)) {
        const p = seed.DEMO_PROFILES[handle];
        const b = (p.books || []).find(x => String(x.id) === String(id));
        if (b) return synthFromBook(p, b);
      }
    }
  } catch (e) {}
  /* No id = entry default; unknown id = not found (like production). */
  if (!id) return CATALOG['s1'] || null;
  return null;
}
let SERIES = null;

/* ══ STATE ══ */
let isSaved = false;
let isFollowing = false;
let synExpanded = false;
const chPerPage = 25; // paginate when season has more than this many chapters
const debateUserVotes = {}; // debateId → 'for'|'against'
const debateCms = {}; // built from SERIES.debates

/* ══ UTILS ══ */
function toast(msg, dur=2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), dur);
}
function fmtN(n) {
  if (typeof n === 'string') return n;
  return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n);
}
function switchTab(tab) {
  document.querySelectorAll('.stab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
}

/* ══ INIT ══ */
async function init() {
  try { CATALOG = await fetchCatalog(); } catch (e) { CATALOG = {}; }
  SERIES = resolveSeries(seriesId);
  isFollowing = SERIES && SERIES.writer ? !!SERIES.writer.isFollowed : false;
  if (!SERIES || !SERIES.writer) {
    document.getElementById('tbSeriesName').textContent = 'Series not found';
    document.getElementById('chaptersContent').innerHTML =
      '<div class="empty-state"><i class="fas fa-book-open"></i><p>Series data failed to load. Check that data files are reachable.</p></div>';
    return;
  }
  // Top bar
  document.getElementById('tbSeriesName').textContent = SERIES.title;
  document.getElementById('tbSeriesSub').textContent = `@${SERIES.writer.name} · ${SERIES.seasons} Season${SERIES.seasons > 1 ? 's' : ''} · ${SERIES.totalChapters} chapters`;

  // Hero
  document.getElementById('heroCover').style.backgroundImage = `url('${SERIES.cover}')`;
  document.getElementById('heroTitle').textContent = SERIES.title;
  document.getElementById('hwAv').src = SERIES.writer.avatar;
  document.getElementById('hwName').textContent = `@${SERIES.writer.name}`;
  const fBtn = document.getElementById('hwFollow');
  fBtn.textContent = isFollowing ? '✓ Following' : '+ Follow';
  if (isFollowing) fBtn.classList.add('ing');

  // Badges
  const statusBadge = SERIES.status === 'ongoing'
    ? `<span class="hbadge hb-ongoing">🔥 Ongoing</span>`
    : `<span class="hbadge hb-complete">✓ Complete</span>`;
  const contestBadge = SERIES.isContest ? `<span class="hbadge hb-contest">🏆 Contest</span>` : '';
  document.getElementById('heroBadges').innerHTML = `
    <span class="hbadge hb-cat">${SERIES.cat}</span>
    ${statusBadge}
    <span class="hbadge hb-complete">S${SERIES.seasons} · ${SERIES.totalChapters} chapters</span>
    ${contestBadge}
  `;

  // Quick stats
  const qs = [
    { num: SERIES.stats.reads, label: 'Reads', cls: 'r' },
    { num: SERIES.stats.likes, label: 'Likes', cls: 'r' },
    { num: SERIES.stats.comments, label: 'Comments', cls: 'b' },
    { num: SERIES.stats.saves, label: 'Saves', cls: 'g' },
    { num: SERIES.stats.shares, label: 'Shares', cls: '' },
  ];
  document.getElementById('quickStats').innerHTML = qs.map(q =>
    `<div class="qs-item"><div class="qs-num ${q.cls}">${q.num}</div><div class="qs-label">${q.label}</div></div>`
  ).join('');

  // Continue banner
  const cp = SERIES.currentProgress;
  document.getElementById('cbChName').textContent = `S${cp.season} · Ch${cp.chapter} — ${cp.chapterTitle}`;
  document.getElementById('cbChMeta').textContent = `${cp.percent}% through this chapter`;
  document.getElementById('cbProgress').style.width = cp.percent + '%';

  // Teams tab visibility
  if (SERIES.hasTeams && SERIES.teams.length > 0) {
    document.getElementById('teamsTab').style.display = '';
  }

  // Writer → profile
  document.getElementById('hwName').addEventListener('click', () => {
    location.href = 'profile.html?u=' + encodeURIComponent((SERIES.writer.handle || SERIES.writer.name || '').replace(/^@/, ''));
  });

  // Render panels
  renderChapters();
  renderOverview();
  renderReviews();
  renderMoreLike();
  if (SERIES.hasTeams) renderTeams();
  renderPolls();
  renderDebates();
  window.onDroboardSaveChange = function (storyId, saved) {
    if (String(storyId) === String(SERIES.id)) {
      syncSaveIcon(saved);
      toast(saved ? "Saved to library!" : "Removed from library");
    }
  };
  mountAdStrip();
}

function trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }
async function mountAdStrip() {
  var el = document.getElementById("adStrip");
  if (!el) return;
  var ad = null;
  if (window.AdService) {
    try {
      var pools = await AdService.getAds({ page: "series" });
      ad = (pools.platform || [])[0] || (pools.banner || [])[0] || null;
    } catch (e) { ad = null; }
  }
  if (!ad) { el.style.display = "none"; return; }
  el.style.display = "flex";
  el.setAttribute("data-adid", ad.id || "");
  el.querySelector(".ad-strip-brand").textContent = ad.sponsor || ad.brand || "Sponsored";
  el.querySelector(".ad-strip-h").textContent = ad.title || ad.headline || "";
  el.querySelector(".ad-strip-sub").textContent = ad.cta || "";
  var cta = el.querySelector(".ad-strip-cta");
  if (cta) cta.textContent = ad.cta || "Open";
  trackAd(ad.id, "impression");
  el.addEventListener("click", function () { trackAd(ad.id, "click"); toast((ad.cta || "Opening") + "..."); });
}

window.SeriesReaderPage = { init: init, toast: toast, switchTab: switchTab, toggleSeason: toggleSeason, pickTeam: pickTeam, votePoll: votePoll, pickPrediction: pickPrediction, voteDebate: voteDebate, postDebCm: postDebCm, toggleSave: toggleSave, toggleFollow: toggleFollow, openShare: openShare, toggleSynopsis: toggleSynopsis };

/* ══ REVIEWS (top-liked debate takes) + MORE LIKE THIS (book-details merge) ══ */
function renderReviews() {
  const el = document.getElementById('reviewsContent');
  if (!el) return;
  const takes = [];
  (SERIES.debates || []).forEach(d => (d.comments || []).forEach(c =>
    takes.push({ motion: d.motion, side: c.side, name: c.name, avatar: c.avatar, text: c.text, time: c.time, likes: c.likes || 0 })
  ));
  takes.sort((a, b) => b.likes - a.likes);
  const top = takes.slice(0, 3);
  if (!top.length) { el.innerHTML = `<div class="empty-state"><i class="fas fa-star"></i><p>No reviews yet — debates are where takes live.</p></div>`; return; }
  el.innerHTML = top.map(t => `
    <div class="rev-card">
      <div class="rev-head">
        <div class="rev-av">${t.avatar ? `<img src="${t.avatar}" alt=""/>` : esc0((t.name || '?')[0])}</div>
        <div><div class="rev-name">${t.name}</div><div class="rev-meta">${t.time} · ${t.side === 'for' ? 'For' : 'Against'} the motion</div></div>
      </div>
      <div class="rev-text">${t.text}</div>
      <div class="rev-foot"><i class="far fa-thumbs-up"></i> Helpful (${fmtN(t.likes)})</div>
    </div>`).join('');
}
function esc0(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }
function renderMoreLike() {
  const el = document.getElementById('moreRow');
  if (!el) return;
  const items = Object.values(CATALOG).filter(s => s.id !== SERIES.id).slice(0, 6);
  if (!items.length) { el.innerHTML = ''; return; }
  el.innerHTML = items.map(s => `
    <div class="more-card" data-id="${s.id}">
      <div class="more-cover"><img src="${s.cover}" loading="lazy" alt=""/></div>
      <div class="more-title">${s.title}</div>
    </div>`).join('');
  el.querySelectorAll('.more-card').forEach(c => c.addEventListener('click', () => {
    location.href = 'series-reader.html?id=' + encodeURIComponent(c.dataset.id);
  }));
}

/* ══ CHAPTERS ══ */
function renderChapters() {
  const container = document.getElementById('chaptersContent');
  let html = '';

  SERIES.seasonData.forEach((season, si) => {
    const isLast = si === SERIES.seasonData.length - 1;
    const isOpen = isLast; // last season open by default
    const hasNew = season.chapters.some(c => c.state === 'current' || (c.badges && c.badges.includes('new')));
    const doneCount = season.chapters.filter(c => c.state === 'done').length;
    const statusBadge = season.status === 'ongoing'
      ? `<span class="season-badge sb-new">🔥 Ongoing</span>`
      : `<span class="season-badge sb-done">✓ Complete</span>`;

    html += `
      <div class="season-block" id="sb-${si}">
        <div class="season-hdr" onclick="SeriesReaderPage.toggleSeason(${si})">
          <div class="season-num">S${season.season}</div>
          <div class="season-meta">
            <div class="season-title">${season.title}</div>
            <div class="season-sub">
              ${season.chapters.length} chapters · ${doneCount} read
              ${statusBadge}
              ${hasNew ? '<span class="season-badge sb-new">NEW</span>' : ''}
            </div>
          </div>
          <i class="fas fa-chevron-down season-arrow ${isOpen ? 'open' : ''}" id="sarr-${si}"></i>
        </div>
        <div class="season-body ${isOpen ? 'open' : ''}" id="sbody-${si}">
          ${renderChapterList(season.chapters, si)}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

function renderChapterList(chapters, si) {
  return chapters.map((ch, ci) => {
    const numCls = ch.state === 'done' ? 'done' : ch.state === 'current' ? 'current' : 'locked';
    const numIcon = ch.state === 'done'
      ? `<i class="fas fa-check" style="font-size:9px"></i>`
      : ch.state === 'locked'
        ? `<i class="fas fa-lock" style="font-size:9px"></i>`
        : ch.n;
    const badges = (ch.badges || []).map(b => {
      if (b === 'new') return `<span class="ch-badge crb-new">NEW</span>`;
      if (b === 'free') return `<span class="ch-badge crb-free">FREE</span>`;
      return '';
    }).join('');
    const rightEl = ch.state === 'current'
      ? `<span class="ch-current-tag">Reading</span><button class="ch-read-btn" onclick="event.stopPropagation();toast('📖 Opening chapter…')">Continue</button>`
      : ch.state === 'done'
        ? `<i class="fas fa-check-circle ch-done-ico"></i>`
        : `<i class="fas fa-lock ch-lock-ico"></i>`;

    return `
      <div class="ch-row${ch.state === 'current' ? ' current-ch' : ''}" onclick="${ch.state !== 'locked' ? "toast('📖 Reading chapter…')" : "toast('🔒 Not yet available')"}">
        <div class="ch-num-badge ${numCls}">${numIcon}</div>
        <div class="ch-info">
          <div class="ch-title">Ch.${ch.n} — ${ch.title}</div>
          <div class="ch-meta">
            ${ch.reads !== '–' ? `<span><i class="far fa-eye" style="font-size:8px"></i> ${ch.reads}</span>` : ''}
            <span>⏱ ${ch.time}</span>
            ${badges}
          </div>
        </div>
        <div class="ch-right">${rightEl}</div>
      </div>`;
  }).join('');
}

function toggleSeason(si) {
  const body = document.getElementById('sbody-' + si);
  const arr = document.getElementById('sarr-' + si);
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  arr.classList.toggle('open', !isOpen);
}

/* ══ OVERVIEW ══ */
function renderOverview() {
  document.getElementById('synopsisText').textContent = SERIES.synopsis;

  const infoRows = [
    { icon: '✍️', label: 'Author', val: `@${SERIES.writer.name} · ${SERIES.writer.followers} followers` },
    { icon: '📅', label: 'Started', val: SERIES.startDate },
    { icon: '🔄', label: 'Last updated', val: SERIES.lastUpdated },
    { icon: '📺', label: 'Seasons', val: `${SERIES.seasons} season${SERIES.seasons > 1 ? 's' : ''}` },
    { icon: '📖', label: 'Chapters', val: `${SERIES.totalChapters} total · ${SERIES.seasonData.map(s => s.chapters.filter(c => c.state !== 'locked').length).reduce((a,b) => a+b, 0)} published` },
    { icon: '⏱', label: 'Read time', val: SERIES.avgReadTime },
    { icon: '📝', label: 'Word count', val: SERIES.wordCount },
    { icon: '🏷️', label: 'Genres', val: null, pills: SERIES.genres },
  ];

  document.getElementById('infoRows').innerHTML = infoRows.map(r => `
    <div class="info-row">
      <div class="info-icon">${r.icon}</div>
      <div>
        <div class="info-label">${r.label}</div>
        ${r.val ? `<div class="info-val">${r.val}</div>` : ''}
        ${r.pills ? `<div class="tag-row">${r.pills.map(p => `<span class="genre-pill">${p}</span>`).join('')}</div>` : ''}
      </div>
    </div>`).join('');

  // Stats deep
  const topReads = SERIES.seasonData.flatMap(s => s.chapters).filter(c => c.reads !== '–').sort((a,b) => parseInt((b.reads||'0').replace('k','000')) - parseInt((a.reads||'0').replace('k','000'))).slice(0,3);
  document.getElementById('statsDeep').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      ${[
        { n: SERIES.stats.reads, l: 'Total Reads', c: '#ff0050' },
        { n: SERIES.stats.likes, l: 'Total Likes', c: '#ff0050' },
        { n: SERIES.stats.saves, l: 'Saves', c: '#38bdf8' },
      ].map(s => `<div style="background:var(--l2);border:1px solid var(--bd);border-radius:11px;padding:10px;text-align:center"><div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:${s.c}">${s.n}</div><div style="font-size:8px;color:var(--tx-muted);margin-top:2px">${s.l}</div></div>`).join('')}
    </div>
    ${topReads.length ? `<div style="font-size:9px;font-weight:800;color:var(--tx-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🏆 Most-read chapters</div>
    ${topReads.map((c,i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd2)"><div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:${i===0?'#fbbf24':i===1?'#a0a0b0':'#a07040'};width:20px">${i+1}</div><div style="flex:1;font-size:11px;color:var(--tx-high);font-weight:600">${c.title}</div><div style="font-size:11px;font-weight:800;color:var(--acc)">${c.reads}</div></div>`).join('')}` : ''}`;
}

function toggleSynopsis() {
  synExpanded = !synExpanded;
  document.getElementById('synopsisText').classList.toggle('truncated', !synExpanded);
  document.getElementById('synToggle').textContent = synExpanded ? 'Show less ‹' : 'Read more ›';
}

/* ══ TEAMS ══ */
let teamPicked = null;

function renderTeams() {
  const container = document.getElementById('teamsSection');
  const teams = SERIES.teams;
  const tot = teams.reduce((a, t) => a + t.count, 0) || 1;

  const colsClass = teams.length === 2 ? 'grid-template-columns:1fr 1fr' :
                    teams.length === 3 ? 'grid-template-columns:1fr 1fr 1fr' :
                    'grid-template-columns:1fr 1fr';

  const teamBtns = teams.map(t => `
    <div class="team-btn${teamPicked === t.id ? ' selected' : ''}" data-team="${t.id}" onclick="SeriesReaderPage.pickTeam('${t.id}')">
      <div class="team-icon">${t.icon}</div>
      <div class="team-info">
        <div class="team-name">${t.name}</div>
        <div class="team-count" id="tc-${t.id}">${fmtN(t.count)} readers</div>
      </div>
      <div class="team-check" id="tck-${t.id}">
        <i class="${teamPicked === t.id ? 'fas fa-check-circle' : 'far fa-circle'}"></i>
      </div>
    </div>`).join('');

  const barSegs = teams.map(t =>
    `<div class="team-bar-seg" data-team="${t.id}" style="width:${Math.round(t.count/tot*100)}%;background:${t.color}"></div>`
  ).join('');

  const barLabels = teams.map(t =>
    `<div class="tbl-item"><span class="tbl-dot" style="background:${t.color}"></span><span style="color:${t.color}">${t.icon} ${Math.round(t.count/tot*100)}%</span></div>`
  ).join('');

  const topTeam = [...teams].sort((a,b) => b.count - a.count)[0];

  container.innerHTML = `
    <div style="margin-bottom:14px">
      <div class="sh" style="margin-bottom:4px">
        <div class="sh-title">Choose Your Side</div>
        <div style="font-size:9px;color:var(--tx-muted);font-weight:600">${fmtN(tot)} readers have picked</div>
      </div>
      <div style="font-size:11px;color:var(--tx-muted);margin-bottom:12px">
        Leading: <strong style="color:${topTeam.color}">${topTeam.icon} ${topTeam.name}</strong> with ${Math.round(topTeam.count/tot*100)}%
      </div>
      <div class="team-grid" style="${colsClass}" id="teamBtnsWrap">${teamBtns}</div>
      <div class="team-bars" id="teamBarsEl">${barSegs}</div>
      <div class="team-bar-labels">${barLabels}</div>
    </div>

    ${teamPicked ? `
    <div style="background:rgba(255,0,80,.06);border:1px solid var(--bd-acc);border-radius:12px;padding:12px;margin-bottom:12px;font-size:12px;color:var(--tx-body);line-height:1.6;text-align:center">
      You're on <strong style="color:${teams.find(t=>t.id===teamPicked)?.color}">${teams.find(t=>t.id===teamPicked)?.icon} ${teams.find(t=>t.id===teamPicked)?.name}</strong>!
      Head to Debates to argue your case 👇
    </div>` : ''}

    <div style="background:var(--l1);border:1px solid var(--bd);border-radius:14px;padding:14px">
      <div class="sh-title" style="margin-bottom:10px">Team Breakdown</div>
      ${teams.sort((a,b) => b.count-a.count).map((t,i) => {
        const pct = Math.round(t.count/tot*100);
        return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bd2)">
          <div style="font-size:18px;width:26px;text-align:center">${t.icon}</div>
          <div style="flex:1">
            <div style="font-size:11px;font-weight:700;color:${t.color};margin-bottom:3px">${t.name}</div>
            <div style="height:3px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${t.color};border-radius:3px;transition:width .5s ease"></div></div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:11px;font-weight:800;color:${t.color}">${pct}%</div>
            <div style="font-size:9px;color:var(--tx-faint)">${fmtN(t.count)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function pickTeam(id) {
  const teams = SERIES.teams;
  if (teamPicked === id) return;
  if (teamPicked) {
    const prev = teams.find(t => t.id === teamPicked);
    if (prev) prev.count--;
  }
  teamPicked = id;
  const team = teams.find(t => t.id === id);
  if (team) {
    team.count++;
    toast(`${team.icon} You're on ${team.name}!`);
  }
  renderTeams();
}

/* ══ POLLS & PREDICTIONS ══ */
function renderPolls() {
  const container = document.getElementById('pollsContent');
  let html = '';

  if (!SERIES.polls.length && !SERIES.predictions.length) {
    html = `<div class="empty-state"><i class="fas fa-poll"></i><p>No polls yet for this series</p></div>`;
  } else {
    // Polls
    if (SERIES.polls.length) {
      html += `<div class="sh" style="margin-bottom:10px"><div class="sh-title">📊 Reader Polls</div></div>`;
      SERIES.polls.forEach(poll => {
        const tot = poll.options.reduce((a,o) => a + o.votes, 0) || 1;
        html += `
          <div class="poll-card">
            <div class="poll-hdr">
              <span class="poll-icon">📊</span>
              <div class="poll-title">${poll.question}</div>
              <span class="poll-season-tag">Season ${poll.season}</span>
            </div>
            <div class="poll-opts">
              ${poll.options.map((opt, i) => {
                const pct = Math.round(opt.votes / tot * 100);
                return `<div class="poll-opt${poll.voted === i ? ' voted' : ''}" data-pollid="${poll.id}" data-oi="${i}" onclick="SeriesReaderPage.votePoll('${poll.id}',${i})">
                  <div class="poll-bar" style="width:${pct}%"></div>
                  <div class="poll-row">
                    <span class="poll-opt-txt">${opt.text}</span>
                    <span class="poll-pct">${pct}%</span>
                  </div>
                </div>`;
              }).join('')}
            </div>
            <div class="poll-footer">
              <span class="poll-total"><i class="fas fa-users" style="font-size:9px;margin-right:3px"></i>${fmtN(tot)} votes</span>
              <span class="poll-share" onclick="toast('📤 Poll link copied!')"><i class="fas fa-share-alt" style="font-size:9px;margin-right:3px"></i>Share</span>
            </div>
          </div>`;
      });
    }

    // Predictions
    if (SERIES.predictions.length) {
      html += `<div class="sh" style="margin:14px 0 10px"><div class="sh-title">🔮 Predictions</div></div>`;
      SERIES.predictions.forEach(pred => {
        const tot = pred.options.reduce((a,o) => a + o.votes, 0) || 1;
        html += `
          <div class="pred-card">
            <div class="pred-hdr">
              <div class="pred-label"><i class="fas fa-crystal-ball" style="font-size:8px"></i> Reader Prediction</div>
              <div class="pred-question">${pred.question}</div>
            </div>
            <div class="pred-opts">
              ${pred.options.map((opt, i) => {
                const pct = Math.round(opt.votes / tot * 100);
                return `<div class="pred-opt${opt.picked ? ' picked' : ''}" onclick="SeriesReaderPage.pickPrediction('${pred.id}',${i})">
                  <div class="pred-opt-em">${opt.em}</div>
                  <div class="pred-opt-body">
                    <div class="pred-opt-txt">${opt.text}</div>
                    <div class="pred-opt-sub">${opt.sub}</div>
                  </div>
                  <div class="pred-opt-pct">${pct}%</div>
                </div>`;
              }).join('')}
            </div>
            <div class="pred-footer"><i class="fas fa-users" style="font-size:9px"></i> ${fmtN(tot)} predictions · Reveals at series end</div>
          </div>`;
      });
    }
  }

  container.innerHTML = html;
}

function votePoll(pollId, oi) {
  const poll = SERIES.polls.find(p => p.id === pollId);
  if (!poll || poll.voted >= 0) { toast('✅ Already voted!'); return; }
  poll.options[oi].votes++;
  poll.voted = oi;
  toast('✅ Vote recorded!');
  renderPolls();
}

let predPickedMap = {};
function pickPrediction(predId, oi) {
  const pred = SERIES.predictions.find(p => p.id === predId);
  if (!pred) return;
  if (predPickedMap[predId] === oi) {
    pred.options[oi].votes--;
    pred.options[oi].picked = false;
    predPickedMap[predId] = null;
  } else {
    if (predPickedMap[predId] != null) {
      pred.options[predPickedMap[predId]].votes--;
      pred.options[predPickedMap[predId]].picked = false;
    }
    pred.options[oi].votes++;
    pred.options[oi].picked = true;
    predPickedMap[predId] = oi;
    toast(`🔮 Prediction locked: "${pred.options[oi].text}"`);
  }
  renderPolls();
}

/* ══ DEBATES ══ */
function renderDebates() {
  const container = document.getElementById('debatesContent');
  if (!SERIES.debates.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-comments"></i><p>No debates yet for this series</p></div>`;
    return;
  }

  const userTeam = teamPicked ? SERIES.teams.find(t => t.id === teamPicked) : null;

  let html = '';
  if (userTeam) {
    html += `<div style="background:rgba(255,0,80,.06);border:1px solid var(--bd-acc);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--tx-body);display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${userTeam.icon}</span>
      Debating as <strong style="color:${userTeam.color}">${userTeam.name}</strong>
    </div>`;
  }

  SERIES.debates.forEach(deb => {
    if (!debateCms[deb.id]) debateCms[deb.id] = [...deb.comments.map(c => ({...c, liked: false}))];
    const cms = debateCms[deb.id];
    const uv = debateUserVotes[deb.id] || deb.userVote;
    const tot = (deb.forV + deb.agV) || 1;
    const fp = Math.round(deb.forV / tot * 100);
    const ap = 100 - fp;

    html += `
      <div class="debate-card">
        <div class="debate-hdr">
          <div class="debate-live-tag"><div class="dlive-dot"></div>LIVE DEBATE · ${fmtN(deb.forV + deb.agV)} arguing</div>
          <div class="debate-motion">${deb.motion}</div>
        </div>
        <div class="debate-sides">
          <div class="deb-side for${uv === 'for' ? ' chosen' : ''}" data-debid="${deb.id}" data-side="for" onclick="SeriesReaderPage.voteDebate('${deb.id}','for')">
            <div class="deb-em">✅</div>
            <div class="deb-lbl">FOR</div>
            <div class="deb-bar-wrap"><div class="deb-bar" style="width:${fp}%"></div></div>
            <div class="deb-pct">${fp}%</div>
            <div class="deb-cnt">${fmtN(deb.forV)}</div>
          </div>
          <div class="deb-side against${uv === 'against' ? ' chosen' : ''}" data-debid="${deb.id}" data-side="against" onclick="SeriesReaderPage.voteDebate('${deb.id}','against')">
            <div class="deb-em">❌</div>
            <div class="deb-lbl">AGAINST</div>
            <div class="deb-bar-wrap"><div class="deb-bar" style="width:${ap}%"></div></div>
            <div class="deb-pct">${ap}%</div>
            <div class="deb-cnt">${fmtN(deb.agV)}</div>
          </div>
        </div>
        <div class="debate-stats-row">
          <i class="fas fa-fire" style="color:var(--acc);font-size:9px"></i>
          ${fmtN(deb.forV + deb.agV)} readers debating · Tap a side to join
        </div>
        <div class="debate-comments">
          <div class="deb-cm-label">💬 Arguments</div>
          <div class="deb-cm-list" id="debcms-${deb.id}">
            ${cms.map(c => renderDebCm(c)).join('')}
          </div>
        </div>
        <div class="debate-input-row">
          <input class="deb-inp" id="debinp-${deb.id}" placeholder="${uv ? 'Make your argument…' : 'Pick a side first…'}" ${!uv ? 'disabled' : ''}/>
          <button class="deb-post-btn" onclick="SeriesReaderPage.postDebCm('${deb.id}')">Post</button>
        </div>
      </div>`;
  });

  container.innerHTML = html;
  attachDebateLikes();
}

function renderDebCm(c) {
  const av = c.avatar
    ? `<div class="deb-cm-av"><img src="${c.avatar}" loading="lazy"/></div>`
    : `<div class="deb-cm-av">${(c.name||'?')[0]}</div>`;
  return `
    <div class="deb-cm-item" id="debcm-${c.id}">
      ${av}
      <div class="deb-cm-body">
        <div class="deb-cm-name">
          ${c.name}
          <span class="deb-side-tag dst-${c.side}">${c.side === 'for' ? '✅ FOR' : '❌ AGAINST'}</span>
        </div>
        <div class="deb-cm-txt">${c.text}</div>
        <div class="deb-cm-meta">
          <span class="deb-cm-time">${c.time}</span>
          <span class="deb-cm-like${c.liked ? ' liked' : ''}" data-cmid="${c.id}">
            <i class="${c.liked ? 'fas' : 'far'} fa-heart"></i> ${c.likes}
          </span>
        </div>
      </div>
    </div>`;
}

function voteDebate(debId, side) {
  if (debateUserVotes[debId]) { toast('✅ Already voted!'); return; }
  const deb = SERIES.debates.find(d => d.id === debId);
  if (!deb) return;
  debateUserVotes[debId] = side;
  if (side === 'for') deb.forV++;
  else deb.agV++;
  toast(side === 'for' ? '✅ You\'re FOR!' : '❌ You\'re AGAINST!');
  renderDebates();
}

function postDebCm(debId) {
  const inp = document.getElementById('debinp-' + debId);
  const text = inp?.value.trim();
  if (!text) { toast('✍️ Write your argument!'); return; }
  const uv = debateUserVotes[debId];
  if (!uv) { toast('Pick a side first!'); return; }
  const newCm = {
    id: 'dc_' + Date.now(),
    name: 'You',
    avatar: null,
    side: uv,
    text,
    time: 'Just now',
    likes: 0,
    liked: false
  };
  if (!debateCms[debId]) debateCms[debId] = [];
  debateCms[debId].push(newCm);
  inp.value = '';
  const list = document.getElementById('debcms-' + debId);
  if (list) list.insertAdjacentHTML('beforeend', renderDebCm(newCm));
  attachDebateLikes();
  toast('💬 Argument posted!');
}

function attachDebateLikes() {
  document.querySelectorAll('.deb-cm-like').forEach(el => {
    el.onclick = () => {
      const cmId = el.dataset.cmid;
      // find across all debates
      for (const debId in debateCms) {
        const c = debateCms[debId].find(x => x.id === cmId);
        if (c) {
          c.liked = !c.liked;
          c.likes += c.liked ? 1 : -1;
          el.classList.toggle('liked', c.liked);
          el.innerHTML = `<i class="${c.liked ? 'fas' : 'far'} fa-heart"></i> ${c.likes}`;
          return;
        }
      }
    };
  });
}

/* ══ SAVE / FOLLOW ══ */
function toggleSave() {
  if (!window.openSaveModal) { toast("Save unavailable"); return; }
  openSaveModal({
    title: SERIES.title,
    sub: "by @" + SERIES.writer.name,
    img: SERIES.cover,
    storyId: SERIES.id,
  });
}
function syncSaveIcon(saved) {
  var btn = document.getElementById("saveBtn");
  if (!btn) return;
  isSaved = !!saved;
  btn.classList.toggle("active", isSaved);
  btn.innerHTML = "<i class=\"" + (isSaved ? "fas" : "far") + "\ fa-bookmark></i>";
}
function toggleFollow() {
  isFollowing = !isFollowing;
  const btn = document.getElementById('hwFollow');
  btn.textContent = isFollowing ? '✓ Following' : '+ Follow';
  btn.classList.toggle('ing', isFollowing);
  toast(isFollowing ? `✅ Following @${SERIES.writer.name}` : `Unfollowed @${SERIES.writer.name}`);
}

/* ══ SHARE ══ */
function openShare() {
  if (!window.openShareModal) { toast("Share unavailable"); return; }
  openShareModal({
    title: SERIES.title,
    sub: "by @" + SERIES.writer.name + " " + SERIES.stats.reads + " reads",
    img: SERIES.cover,
    url: "https://droboard.app/series/" + SERIES.id,
  });
}



})();