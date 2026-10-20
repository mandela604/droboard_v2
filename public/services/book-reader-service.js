/* ===============================================================
   BOOK READER SERVICE
   Book hub orchestration. HTML calls SeriesReaderPage.init().
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
        if (b) {
          // Books tagged with a catalogue id open the rich series record
          // (polls, predictions, debates, teams) instead of a bare synth.
          if (b.seriesId && CATALOG[b.seriesId]) {
            const rec = CATALOG[b.seriesId];
            rec._bookId = b.id; // keep original id for back-navigation
            return rec;
          }
          return synthFromBook(p, b);
        }
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

/* ══ WRITER PROFILE + STATUS RING (bridge parity) ══
   Red ring ONLY when the writer actually has statuses; gray after the
   status has been viewed; no border at all for a statusless avatar. */
function writer() { return (SERIES && SERIES.writer) || {}; }
function attachWriterStatus() {
  const w = writer();
  if (!w || w._stWired) return;
  w._stWired = true;
  try {
    const pool = (window.DemoData && window.DemoData.STATUSES) || [];
    const name = String(w.name || '').replace(/^@/, '');
    const hit = pool.find(p => !p.isYou && (
      (w.id != null && String(p.id) === String(w.id)) ||
      String(p.name || '').replace(/^@/, '') === name));
    if (hit && hit.statuses && hit.statuses.length) {
      w.statuses = hit.statuses;
      w.statusId = hit.id;
      w.statusRing = hit.ring === 'ring-viewed' ? 'viewed' : (hit.ring === 'ring-none' ? 'none' : 'has');
    }
  } catch (e) {}
}
function applyWriterRing() {
  const el = document.getElementById('hwAvRing');
  if (!el) return;
  const w = writer();
  el.classList.remove('ring-has', 'ring-viewed');
  if (!(w.statuses && w.statuses.length) || w.statusRing === 'none') return;
  el.classList.add(w.statusRing === 'viewed' ? 'ring-viewed' : 'ring-has');
}
function goProfile() {
  const w = writer();
  goProfileFor(w.handle || w.name);
}
/* Viewer queue for THIS page only — the writer plus any comment/review
   avatar that has statuses. People not shown on the page are never queued,
   so a lone profile opens with no next/back between people. Within one
   author their own multiple statuses still play in order. */
function statusViewQueue(fallback) {
  const viewable = [];
  const seen = {};
  const push = (rec) => {
    if (!rec || !rec.statuses || !rec.statuses.length || seen[String(rec.id)]) return;
    seen[String(rec.id)] = 1;
    viewable.push(rec);
  };
  const w = writer();
  if (w && w.statuses && w.statuses.length) {
    push({
      id: w.statusId || 'br_writer', name: w.name, avatar: w.avatar,
      ring: w.statusRing === 'viewed' ? 'ring-viewed' : 'ring-has',
      likes: 0, threads: 0, statuses: w.statuses,
    });
  }
  Object.keys(userStatus).forEach(k => {
    const r = userStatus[k];
    if (r && r.statuses && r.statuses.length) {
      push({
        id: r.id, name: r.name, avatar: r.avatar,
        ring: r.ring === 'viewed' ? 'ring-viewed' : 'ring-has',
        likes: 0, threads: 0, statuses: r.statuses,
      });
    }
  });
  if (fallback && fallback.statuses && fallback.statuses.length) {
    const i = viewable.findIndex(v => String(v.id) === String(fallback.id));
    if (i > 0) viewable.unshift(viewable.splice(i, 1)[0]);
    else if (i === -1) viewable.unshift(fallback);
  }
  return viewable;
}
function openWriterStatus() {
  const w = writer();
  if (!(w.statuses && w.statuses.length) || typeof window.openStatusViewer !== 'function') return false;
  const q = statusViewQueue({
    id: w.statusId || 'br_writer', name: w.name, avatar: w.avatar,
    ring: w.statusRing === 'viewed' ? 'ring-viewed' : 'ring-has',
    likes: 0, threads: 0, statuses: w.statuses,
  });
  window.openStatusViewer(q, q[0].id);
  return true;
}
function onWriterAvatar() {
  if (openWriterStatus()) return;
  goProfile();
}
function goProfileFor(name) {
  const u = String(name || '').replace(/^@/, '');
  if (!u || u === 'You') return;
  location.href = 'profile.html?u=' + encodeURIComponent(u);
}
function wireStatusRing() {
  const prev = window.onStatusViewerChange;
  window.onStatusViewerChange = function (wid, ring) {
    // Viewer reports full class names ('ring-viewed' | 'ring-has')
    const newRing = ring === 'ring-viewed' ? 'viewed' : ring === 'ring-has' ? 'has' : 'none';
    let changed = false;
    Object.keys(userStatus).forEach(k => {
      const rec = userStatus[k];
      if (String(rec.id) === String(wid) && newRing !== 'none' && rec.ring !== newRing) {
        rec.ring = newRing; changed = true;
      }
    });
    const w = writer();
    if (w && String(w.statusId || '') === String(wid) && newRing !== 'none') {
      w.statusRing = newRing; changed = true;
    }
    if (changed) paintStatusRings();
    if (typeof prev === 'function') prev(wid, ring);
  };
}

/* ══ ANY USER AVATAR / NAME (reviews, debate comments, …) ══
   Same contract as the bridge: red ring ONLY when that author actually has
   statuses (resolved from DemoData.STATUSES by name/avatar), gray after
   viewing, no border otherwise; names open the profile. */
const userStatus = {};   // 'name|avatar' → { id, name, avatar, statuses, ring }
function uKey(name, avatar) { return String(name || '') + '|' + String(avatar || ''); }
function uAttr(s) { return esc0(s).replace(/"/g, '&quot;'); }
function userStatusFor(name, avatar) {
  const key = uKey(name, avatar);
  if (userStatus[key]) return userStatus[key];
  const rec = {
    id: 'br_u_' + key.replace(/[^a-z0-9]+/gi, '_').slice(0, 48),
    name: String(name || '').replace(/^@/, ''), avatar: avatar || '',
    statuses: null, ring: 'none',
  };
  try {
    const pool = (window.DemoData && window.DemoData.STATUSES) || [];
    const hit = pool.find(p => !p.isYou && (
      String(p.name || '').replace(/^@/, '') === rec.name ||
      (rec.avatar && p.avatar === rec.avatar)));
    if (hit && hit.statuses && hit.statuses.length) {
      rec.statuses = hit.statuses;
      rec.id = hit.id;
      rec.ring = hit.ring === 'ring-viewed' ? 'viewed' : (hit.ring === 'ring-none' ? 'none' : 'has');
    }
  } catch (e) {}
  userStatus[key] = rec;
  return rec;
}
function userAvHtml(name, avatar, innerCls) {
  const rec = userStatusFor(name, avatar);
  const ring = !(rec.statuses && rec.statuses.length) || rec.ring === 'none'
    ? '' : (rec.ring === 'viewed' ? ' ring-viewed' : ' ring-has');
  const body = avatar
    ? `<img src="${uAttr(avatar)}" alt="" loading="lazy"/>`
    : esc0((name || '?').charAt(0).toUpperCase());
  return `<span class="${innerCls}-wrap${ring}" data-av-user="${uAttr(uKey(name, avatar))}"><span class="${innerCls}">${body}</span></span>`;
}
function userNameHtml(name, cls) {
  return `<span class="${cls}" data-user-name="${uAttr(String(name || '').replace(/^@/, ''))}" style="cursor:pointer">${esc0(name)}</span>`;
}
function onUserAvatar(el) {
  const rec = userStatus[el.getAttribute('data-av-user')];
  if (rec && rec.statuses && rec.statuses.length && typeof window.openStatusViewer === 'function') {
    const q = statusViewQueue({
      id: rec.id, name: rec.name, avatar: rec.avatar,
      ring: rec.ring === 'viewed' ? 'ring-viewed' : 'ring-has',
      likes: 0, threads: 0, statuses: rec.statuses,
    });
    window.openStatusViewer(q, q[0].id);
    return;
  }
  goProfileFor(rec ? rec.name : el.getAttribute('data-av-user'));
}
function paintStatusRings() {
  document.querySelectorAll('[data-av-user]').forEach(el => {
    const rec = userStatus[el.getAttribute('data-av-user')];
    el.classList.remove('ring-has', 'ring-viewed');
    if (rec && rec.statuses && rec.statuses.length && rec.ring !== 'none') {
      el.classList.add(rec.ring === 'viewed' ? 'ring-viewed' : 'ring-has');
    }
  });
  applyWriterRing();
}

/* ══ INIT ══ */
async function init() {
  try { CATALOG = await fetchCatalog(); } catch (e) { CATALOG = {}; }
  SERIES = resolveSeries(seriesId);
  isFollowing = SERIES && SERIES.writer ? !!SERIES.writer.isFollowed : false;
  if (!SERIES || !SERIES.writer) {
    document.getElementById('tbSeriesName').textContent = 'Story not found';
    document.getElementById('chaptersContent').innerHTML =
      '<div class="empty-state"><i class="fas fa-book-open"></i><p>Series data failed to load. Check that data files are reachable.</p></div>';
    return;
  }
  // Top bar — only short story / long story types (no seasons)
  document.getElementById('tbSeriesName').textContent = SERIES.title;
  var _chTotal = SERIES.totalChapters || 0;
  var _storyType = _chTotal > 1 ? 'Long story' : 'Short story';
  document.getElementById('tbSeriesSub').textContent = `@${SERIES.writer.name} · ${_storyType} · ${_chTotal} chapter${_chTotal === 1 ? '' : 's'}`;

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
    <span class="hbadge hb-complete">${_storyType} · ${SERIES.totalChapters} chapter${SERIES.totalChapters === 1 ? '' : 's'}</span>
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

  // Continue banner (no seasons — chapter only)
  const cp = SERIES.currentProgress;
  document.getElementById('cbChName').textContent = `Ch${cp.chapter} — ${cp.chapterTitle}`;
  document.getElementById('cbChMeta').textContent = `${cp.percent}% through this chapter`;
  document.getElementById('cbProgress').style.width = cp.percent + '%';

  // Teams tab visibility
  if (SERIES.hasTeams && SERIES.teams.length > 0) {
    document.getElementById('teamsTab').style.display = '';
  }

  // Writer → profile (name) + status ring (avatar) — same contract as the
  // bridge page: red ring only when the writer actually has statuses.
  attachWriterStatus();
  applyWriterRing();
  wireStatusRing();
  document.getElementById('hwName').addEventListener('click', goProfile);
  // One delegated handler covers every user avatar/name rendered later
  // (reviews, debate comments, re-renders) without rebinding.
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const av = t.closest('[data-av-user]');
    if (av) { onUserAvatar(av); return; }
    const nm = t.closest('[data-user-name]');
    if (nm) goProfileFor(nm.getAttribute('data-user-name'));
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

  /* Deep link: book-reader.html?id=…&view=reviews → open Overview and
     scroll to the reviews block (used by the bridge's "View all reviews"). */
  if (params.get('view') === 'reviews') {
    switchTab('overview');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const rv = document.getElementById('reviewsHead') || document.getElementById('reviewsContent');
      if (rv) rv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
}

function trackAd(id, ev, ctx) { try { if (id && window.AdService) AdService.track(id, ev, ctx || { page: 'series', slot: 'series:top' }); } catch (e) {} }
async function mountAdStrip() {
  var el = document.getElementById("adStripWrap");
  if (!el) return;
  if (!window.DroboardAdSlot) { el.style.display = "none"; return; }
  try {
    var filled = await window.DroboardAdSlot.mount(el, { slot: "series:top", page: "series", postId: seriesId });
    el.style.display = filled ? "" : "none";
  } catch (e) { el.style.display = "none"; }
}

window.SeriesReaderPage = { init: init, toast: toast, switchTab: switchTab, toggleSeason: toggleSeason, pickTeam: pickTeam, votePoll: votePoll, pickPrediction: pickPrediction, voteDebate: voteDebate, postDebCm: postDebCm, toggleSave: toggleSave, toggleFollow: toggleFollow, openShare: openShare, toggleSynopsis: toggleSynopsis, openChapter: openChapter, continueReading: continueReading, moreEng: moreEng, helpfulTake: helpfulTake, goProfile: goProfile, onWriterAvatar: onWriterAvatar, onUserAvatar: onUserAvatar };

/* ══ REVIEWS — sorted + paginated (12 per page) ══ */
const REV_PER_PAGE = 12;
const helpfulPicks = {};   // review id → marked helpful
let revSort = 'helpful';   // helpful | newest | rating
let revPage = 0;

function reviewList() {
  const takes = [];
  (SERIES.debates || []).forEach(d => (d.comments || []).forEach((c, i) =>
    takes.push({
      id: c.id || ('rv_' + takes.length + '_' + i),
      motion: d.motion, side: c.side, name: c.name, avatar: c.avatar,
      text: c.text, time: c.time, likes: c.likes || 0,
    })
  ));
  return takes;
}
/* '2h' | '3h' | '1d' | '2w' → hours, so relative times can be ordered */
function timeToH(t) {
  const m = /^(\d+)\s*([hdwm])$/i.exec(String(t || '').trim());
  if (!m) return 1e9;
  return +m[1] * ({ h: 1, d: 24, w: 168, m: 1 / 60 }[m[2].toLowerCase()]);
}
function sortedReviews() {
  const list = reviewList();
  if (revSort === 'newest') list.sort((a, b) => timeToH(a.time) - timeToH(b.time));
  else if (revSort === 'rating') list.sort((a, b) => takeRating(b) - takeRating(a) || b.likes - a.likes);
  else list.sort((a, b) => b.likes - a.likes); // Most helpful (default)
  return list;
}
function setRevSort(s) {
  if (revSort === s) return;
  revSort = s; revPage = 0;
  renderReviews();
}
function revGoPage(p) {
  const pages = Math.max(1, Math.ceil(sortedReviews().length / REV_PER_PAGE));
  revPage = Math.min(Math.max(0, p), pages - 1);
  renderReviews();
  const head = document.getElementById('reviewsHead');
  if (head) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderReviews() {
  const el = document.getElementById('reviewsContent');
  if (!el) return;
  const list = sortedReviews();
  if (!list.length) { el.innerHTML = `<div class="empty-state"><i class="fas fa-star"></i><p>No reviews yet — debates are where takes live.</p></div>`; return; }
  const pages = Math.max(1, Math.ceil(list.length / REV_PER_PAGE));
  if (revPage > pages - 1) revPage = pages - 1;
  const page = list.slice(revPage * REV_PER_PAGE, (revPage + 1) * REV_PER_PAGE);

  const sortOpts = [['helpful', 'Most helpful'], ['newest', 'Newest'], ['rating', 'Top rated']];
  let html = '<div class="rev-sort">' + sortOpts.map(([k, l]) =>
    `<button type="button" class="rev-chip${revSort === k ? ' on' : ''}" data-revsort="${k}">${l}</button>`).join('') + '</div>';

  html += page.map(t => {
    const h = !!helpfulPicks[t.id];
    return `
    <div class="rev-card">
      <div class="rev-head">
        ${userAvHtml(t.name, t.avatar, 'rev-av')}
        <div>${userNameHtml(t.name, 'rev-name')}<div class="rev-meta">${esc0(t.time)} · ${t.side === 'for' ? 'For' : 'Against'} the motion</div></div>
        <div class="rev-stars">${starHtml(t)}</div>
      </div>
      <div class="rev-text">${esc0(t.text)}</div>
      <div class="rev-foot rev-helpful" data-rev="${esc0(t.id)}"><i class="${h ? 'fas' : 'far'} fa-thumbs-up"></i> Helpful (${fmtN(t.likes + (h ? 1 : 0))})</div>
    </div>`;
  }).join('');

  if (pages > 1) {
    html += `<div class="rev-pager">
      <button type="button" class="rev-pg" data-revpg="${revPage - 1}" ${revPage === 0 ? 'disabled' : ''}>‹ Prev</button>
      <span class="rev-pg-info">Page ${revPage + 1} of ${pages}</span>
      <button type="button" class="rev-pg" data-revpg="${revPage + 1}" ${revPage >= pages - 1 ? 'disabled' : ''}>Next ›</button>
    </div>`;
  }

  el.innerHTML = html;
  el.querySelectorAll('[data-revsort]').forEach(b => b.addEventListener('click', () => setRevSort(b.dataset.revsort)));
  el.querySelectorAll('[data-revpg]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) revGoPage(+b.dataset.revpg); }));
  el.querySelectorAll('[data-rev]').forEach(b => b.addEventListener('click', () => helpfulTake(b.dataset.rev)));
}
function helpfulTake(id) {
  id = String(id);
  if (helpfulPicks[id]) { toast('Already marked helpful'); return; }
  helpfulPicks[id] = true;
  renderReviews();
  toast('👍 Marked helpful');
}
/* Deterministic demo rating: explicit t.rating if seeded, else hash the
   take text → stable 3.5–5 stars (mostly high, feels real). */
function takeRating(t) {
  if (t.rating != null) return t.rating;
  let h = 0; const s = String(t.text || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 3.5 + (h % 4) * 0.5; // 3.5, 4, 4.5, 5
}
function starHtml(t) {
  const r = takeRating(t);
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  let out = '';
  for (let i = 0; i < 5; i++) {
    if (i < full) out += '<i class="fas fa-star"></i>';
    else if (i === full && half) out += '<i class="fas fa-star-half-alt"></i>';
    else out += '<i class="far fa-star"></i>';
  }
  return `<span class="rev-stars" title="${r} out of 5">${out}<span class="rev-star-num">${r.toFixed(1)}</span></span>`;
}
function esc0(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }
function moreLikeItems() {
  const items = [], seen = {};
  function push(id, cover, title, author) {
    if (id == null || String(id) === String(SERIES.id) || seen[id]) return;
    seen[id] = 1;
    items.push({ id: id, img: cover, title: title, author: author || '' });
  }
  Object.values(CATALOG).forEach(s =>
    push(s.id, s.cover, s.title,
      (s.writer && String(s.writer.name || '').replace(/^@/, '')) || s.author || ''));
  // Top up with profile books (same 4-card row the bridge/discover show)
  try {
    const seed = window.ProfileDemoSeed;
    if (seed && seed.DEMO_PROFILES) {
      Object.values(seed.DEMO_PROFILES).forEach(p =>
        (p.books || []).forEach(b => push(b.id, b.cover, b.title, String(p.name || '').replace(/^@/, ''))));
    }
  } catch (e) {}
  return items.slice(0, 8);
}
function renderMoreLike() {
  const el = document.getElementById('moreRow');
  if (!el) return;
  const items = moreLikeItems();
  if (!items.length) { el.innerHTML = ''; return; }
  // Shared component (more-like-this.js): header + DiscoverCard card row.
  if (window.DroboardMoreLikeThis) {
    DroboardMoreLikeThis.mount(el, items, {
      title: 'More Like This',
      icon: '✨',
      href: it => 'book-reader.html?id=' + encodeURIComponent(it.id),
    });
    return;
  }
  el.innerHTML = items.map(s => `
    <div class="more-card" data-id="${s.id}">
      <div class="more-cover"><img src="${s.cover}" loading="lazy" alt=""/></div>
      <div class="more-title">${s.title}</div>
    </div>`).join('');
  el.querySelectorAll('.more-card').forEach(c => c.addEventListener('click', () => {
    location.href = 'book-reader.html?id=' + encodeURIComponent(c.dataset.id);
  }));
}

/* ══ CHAPTERS — flat list (no seasons: short story vs long story only) ══ */
function allChaptersFlat() {
  if (Array.isArray(SERIES.chapters) && SERIES.chapters.length) return SERIES.chapters;
  const out = [];
  (SERIES.seasonData || []).forEach(s => (s.chapters || []).forEach(c => { c._s = s.season; out.push(c); }));
  return out;
}
/* Chapter → engagement icons (poll 🔮📊 / debate ⚔️) from the
   season+chapter refs on SERIES.polls / predictions / debates. */
function engMap() {
  const m = {};
  const add = (item, key) => {
    if (!item || item.season == null || item.chapter == null) return;
    const k = item.season + ':' + item.chapter;
    (m[k] = m[k] || []).push(key);
  };
  (SERIES.polls || []).forEach(p => add(p, '📊'));
  (SERIES.predictions || []).forEach(p => add(p, '🔮'));
  (SERIES.debates || []).forEach(d => add(d, '⚔️'));
  return m;
}
function engChipHtml(season, chapter, label) {
  if (season == null || chapter == null) return '';
  return `<span class="eng-chip" onclick="event.stopPropagation();SeriesReaderPage.openChapter(${chapter})" title="Opens Ch.${chapter}" style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;background:rgba(255,0,80,.1);border:1px solid var(--bd-acc);color:var(--acc3);border-radius:20px;padding:3px 9px;font-size:9.5px;font-weight:800;flex-shrink:0">📖 ${label || ('Ch. ' + chapter)}</span>`;
}
function openChapter(n) {
  location.href = 'full-reader.html?story=' + encodeURIComponent(SERIES && (SERIES._bookId || SERIES.id) || seriesId) + '&ch=' + n;
}
/* Continue banner → jump straight into the full reader at saved progress. */
function continueReading() {
  const cp = SERIES && SERIES.currentProgress;
  openChapter(cp ? (cp.chapter || 1) : 1);
}
function renderChapters() {
  const container = document.getElementById('chaptersContent');
  const chapters = allChaptersFlat();
  container.innerHTML = renderChapterList(chapters, 0);
}

function renderChapterList(chapters, si) {
  const em = engMap();
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
    const eng = (em[(ch._s || 1) + ':' + ch.n] || []).map(icon =>
      `<span title="Engagement in this chapter" style="font-size:10px">${icon}</span>`
    ).join('');
    const rightEl = ch.state === 'current'
      ? `<span class="ch-current-tag">Reading</span><button class="ch-read-btn" onclick="event.stopPropagation();SeriesReaderPage.openChapter(${ch.n})">Continue</button>`
      : ch.state === 'done'
        ? `<i class="fas fa-check-circle ch-done-ico"></i>`
        : `<i class="fas fa-lock ch-lock-ico"></i>`;

    return `
      <div class="ch-row${ch.state === 'current' ? ' current-ch' : ''}" onclick="SeriesReaderPage.openChapter(${ch.n})">
        <div class="ch-num-badge ${numCls}">${numIcon}</div>
        <div class="ch-info">
          <div class="ch-title">Ch.${ch.n} — ${ch.title}</div>
          <div class="ch-meta">
            ${ch.reads !== '–' ? `<span><i class="far fa-eye" style="font-size:8px"></i> ${ch.reads}</span>` : ''}
            <span>⏱ ${ch.time}</span>
            ${eng}
            ${badges}
          </div>
        </div>
        <div class="ch-right">${rightEl}</div>
      </div>`;
  }).join('');
}

function toggleSeason(si) {
  // deprecated: chapters are flat (no seasons) — kept so old onclicks don't throw
  return;
}

/* ══ OVERVIEW ══ */
function renderOverview() {
  document.getElementById('synopsisText').textContent = SERIES.synopsis;

  const _isLong = (SERIES.totalChapters || 0) > 1;
  const infoRows = [
    { icon: '✍️', label: 'Author', val: `@${SERIES.writer.name} · ${SERIES.writer.followers} followers` },
    { icon: '📅', label: 'Started', val: SERIES.startDate },
    { icon: '🔄', label: 'Last updated', val: SERIES.lastUpdated },
    { icon: '📖', label: 'Type', val: _isLong ? 'Long story' : 'Short story' },
    { icon: '📖', label: 'Chapters', val: `${allChaptersFlat().length} published` },
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
  const topReads = allChaptersFlat().filter(c => c.reads !== '–').sort((a,b) => parseInt((b.reads||'0').replace('k','000')) - parseInt((a.reads||'0').replace('k','000'))).slice(0,3);
  document.getElementById('statsDeep').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      ${[
        { n: SERIES.stats.reads, l: 'Total Reads', c: '#ff0050' },
        { n: SERIES.stats.likes, l: 'Total Likes', c: '#ff0050' },
        { n: SERIES.stats.saves, l: 'Saves', c: '#38bdf8' },
      ].map(s => `<div style="background:var(--l2);border:1px solid var(--bd);border-radius:11px;padding:10px;text-align:center"><div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:${s.c}">${s.n}</div><div style="font-size:8px;color:var(--tx-muted);margin-top:2px">${s.l}</div></div>`).join('')}
    </div>
    ${topReads.length ? `<div style="font-size:9px;font-weight:800;color:var(--tx-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🏆 Most-read chapters</div>
    ${topReads.map((c,i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd2);cursor:pointer" onclick="SeriesReaderPage.openChapter(${c.n})"><div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:${i===0?'#fbbf24':i===1?'#a0a0b0':'#a07040'};width:20px">${i+1}</div><div style="flex:1;font-size:11px;color:var(--tx-high);font-weight:600"><span style="display:inline-block;font-size:8.5px;font-weight:800;color:var(--acc3);background:rgba(255,0,80,.09);border:1px solid var(--bd-acc);border-radius:6px;padding:1px 6px;margin-right:6px;vertical-align:middle">CH.${c.n}</span>${c.title}</div><div style="font-size:11px;font-weight:800;color:var(--acc)">${c.reads}</div><i class="fas fa-chevron-right" style="font-size:9px;color:var(--tx-faint)"></i></div>`).join('')}` : ''}`;
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

  const barLabels = teams.map(t => {
    const pct = Math.round(t.count/tot*100);
    return `<div class="tbl-item" style="flex:${pct} 1 0"><span class="tbl-dot" style="background:${t.color}"></span><span style="color:${t.color}">${t.icon} ${pct}%</span></div>`;
  }).join('');

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

/* ══ POLLS & PREDICTIONS ══
   Rendered with the shared ReaderEngagement accordion component —
   same collapsed-by-default cards as full-reader / scroll-reader.
   Each item shows its chapter in the accordion title.
   Paginated 10 per page. */
function chLabel(item) {
  if (item.chapter == null) return '';
  return 'Ch. ' + item.chapter;
}
const ENG_PAGE = 10;
const engShown = { poll: ENG_PAGE, pred: ENG_PAGE, deb: ENG_PAGE };
function moreEng(kind) {
  engShown[kind] += ENG_PAGE;
  if (kind === 'deb') renderDebates(); else renderPolls();
}
function engMoreBtn(kind, total) {
  if (total <= engShown[kind]) return '';
  const left = total - engShown[kind];
  return `<button onclick="SeriesReaderPage.moreEng('${kind}')" style="width:100%;margin-top:10px;padding:11px;border-radius:12px;background:var(--l3);border:1px solid var(--bd);color:var(--tx-body);font-size:12px;font-weight:700;cursor:pointer">Show more (${left} remaining)</button>`;
}
function renderPolls() {
  const container = document.getElementById('pollsContent');
  let html = '';

  if (!SERIES.polls.length && !SERIES.predictions.length) {
    html = `<div class="empty-state"><i class="fas fa-poll"></i><p>No polls yet for this story</p></div>`;
    container.innerHTML = html;
    return;
  }

  const polls = SERIES.polls.slice(0, engShown.poll);
  const preds = SERIES.predictions.slice(0, engShown.pred);

  if (polls.length) {
    html += `<div class="sh" style="margin-bottom:10px"><div class="sh-title">📊 Reader Polls</div></div>`;
    polls.forEach(poll => {
      html += `<div id="eng-${SERIES.id}-poll-${poll.id}"></div>`;
    });
    html += engMoreBtn('poll', SERIES.polls.length);
  }
  if (preds.length) {
    html += `<div class="sh" style="margin:14px 0 10px"><div class="sh-title">🔮 Predictions</div></div>`;
    preds.forEach(pred => {
      html += `<div id="eng-${SERIES.id}-pred-${pred.id}"></div>`;
    });
    html += engMoreBtn('pred', SERIES.predictions.length);
  }
  container.innerHTML = html;

  if (!window.ReaderEngagement) return;
  polls.forEach(poll => {
    const mount = document.getElementById(`eng-${SERIES.id}-poll-${poll.id}`);
    if (!mount) return;
    ReaderEngagement.renderInto(
      `${SERIES.id}-poll-${poll.id}`,
      poll.chapter || 1,
      mount,
      '',
      {
        poll: {
          q: poll.question,
          opts: poll.options.map(o => ({ t: o.text, v: o.votes })),
          voted: poll.voted != null ? poll.voted : -1
        },
        kinds: { poll: true, pred: false, deb: false },
        chapterLabel: chLabel(poll)
      }
    );
  });
  preds.forEach(pred => {
    const mount = document.getElementById(`eng-${SERIES.id}-pred-${pred.id}`);
    if (!mount) return;
    ReaderEngagement.renderInto(
      `${SERIES.id}-pred-${pred.id}`,
      pred.chapter || 1,
      mount,
      '',
      {
        prediction: {
          q: pred.question,
          opts: pred.options.map(o => ({ t: (o.em ? o.em + ' ' : '') + o.text, v: o.votes })),
          voted: predPickedMap[pred.id] != null ? predPickedMap[pred.id] : -1
        },
        kinds: { poll: false, pred: true, deb: false },
        chapterLabel: chLabel(pred)
      }
    );
  });
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

/* ══ DEBATES ══
   Same accordion debate card as the reader pages — both boxes carry
   argument text (forText / againstText). Full threads live on
   debate.html (View full debate →). Paginated 10 per page. */
function renderDebates() {
  const container = document.getElementById('debatesContent');
  if (!SERIES.debates.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-comments"></i><p>No debates yet for this story</p></div>`;
    return;
  }

  const userTeam = teamPicked ? SERIES.teams.find(t => t.id === teamPicked) : null;
  const debits = SERIES.debates.slice(0, engShown.deb);

  let html = '';
  if (userTeam) {
    html += `<div style="background:rgba(255,0,80,.06);border:1px solid var(--bd-acc);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--tx-body);display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${userTeam.icon}</span>
      Debating as <strong style="color:${userTeam.color}">${userTeam.name}</strong>
    </div>`;
  }
  debits.forEach(deb => {
    html += `<div id="eng-${SERIES.id}-deb-${deb.id}"></div>`;
  });
  html += engMoreBtn('deb', SERIES.debates.length);
  container.innerHTML = html;

  if (!window.ReaderEngagement) return;
  debits.forEach(deb => {
    const mount = document.getElementById(`eng-${SERIES.id}-deb-${deb.id}`);
    if (!mount) return;
    const uv = debateUserVotes[deb.id] || deb.userVote;
    ReaderEngagement.renderInto(
      `${SERIES.id}-deb-${deb.id}`,
      deb.chapter || 1,
      mount,
      '',
      {
        debate: {
          motion: deb.motion,
          forText: deb.forText || 'For',
          againstText: deb.againstText || 'Against',
          forV: deb.forV,
          agV: deb.agV,
          voted: uv === 'for' ? 0 : uv === 'against' ? 1 : -1
        },
        kinds: { poll: false, pred: false, deb: true },
        chapterLabel: chLabel(deb),
        debateId: deb.id
      }
    );
  });
}

function renderDebCm(c) {
  const av = userAvHtml(c.name, c.avatar, 'deb-cm-av');
  return `
    <div class="deb-cm-item" id="debcm-${c.id}">
      ${av}
      <div class="deb-cm-body">
        <div class="deb-cm-name">
          ${userNameHtml(c.name, 'deb-cm-uname')}
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
  try { if (window.ReaderLeague) ReaderLeague.track('debate'); } catch (e) {}
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