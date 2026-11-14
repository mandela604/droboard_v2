/* ===============================================================
   BOOK READER SERVICE — live
   Book hub orchestration. HTML calls StoryReaderPage.init().
   All content comes from the backend:
     GET /api/books/:id                                   → story detail
     GET /api/stories/:id/engagement                      → book-level polls/predictions/debates
     POST /api/stories/:id/engagement/vote                → book-level votes (via ReaderEngagement)
     GET /api/stories/:id/ratings                         → reviews (server-sorted, paginated)
     POST|DELETE /api/stories/:id/ratings/:rid/helpful    → review helpful marks
     GET /api/stories/:id/read-state                      → per-user progress + unlocks
     POST|DELETE /api/users/:handle/follow                → follow
   Writer status rings come from window.DroboardStatus (live status
   service) — never from a local pool. Any backend failure renders an
   error empty-state carrying the failure message.
=============================================================== */
(function () {
  "use strict";

/* ══ PARAMS ══ */
const params = new URLSearchParams(location.search);
const storyId = params.get('id') || '';
const API_BASE = '/api';
let STORY = null;

/* ══ STATE ══ */
let isSaved = false;
let isFollowing = false;
let followBusy = false;
let synExpanded = false;
const chPerPage = 25; // paginate when a story has more than this many chapters

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
  n = Number(n) || 0;
  return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n);
}
function esc0(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }
function timeAgo(ts) {
  const n = Number(ts);
  if (!n) return '';
  const s = Math.max(0, Date.now() - n) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return Math.floor(s / 604800) + 'w ago';
}
function switchTab(tab) {
  document.querySelectorAll('.stab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
}

/* ══ STORY FETCH — GET /api/books/:id ══ */
async function fetchStoryDetail(id) {
  const res = await fetch(`${API_BASE}/books/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch (e) {}
    throw new Error('Story not found (' + res.status + ')' + (detail ? ' — ' + detail : ''));
  }
  return normalizeLive(await res.json());
}
/* Live backend detail → rich record shape (one mapper for this page). */
function normalizeLive(b) {
  if (!b) return null;
  const rows = b.chapters || [];
  const totalCh = Math.max(1, rows.length || b.chapterCount || 1);
  const chapters = rows.map((c, i) => ({
    cid: c.id, price: c.price || 0, n: c.n, title: c.title,
    reads: c.views != null && c.views > 0 ? fmtN(c.views) : '–',
    time: c.words ? Math.max(1, Math.round(c.words / 200)) + ' min' : '—',
    state: c.price > 0 ? 'locked' : (i === 0 ? 'current' : 'done'),
    badges: c.price > 0 ? [] : (i === 0 ? ['free'] : []),
  }));
  const w = b.writer || {};
  const stats = b.stats || {};
  // continueReading from backend → currentProgress
  const cr = b.continueReading || null;
  const continueChN = cr && cr.chapterId
    ? (rows.find(c => c.id === cr.chapterId || String(c.n) === String(cr.chapterId)) || rows[0] || {}).n || 1
    : 1;
  const continueChTitle = (rows.find(c => c.n === continueChN) || rows[0] || {}).title || 'Chapter 1';
  const continuePct = cr ? Math.round(cr.pct || 0) : 0;
  // similar from backend response
  const similar = (b.similar || []).map(x => ({
    id: x.id, img: x.cover || '', title: x.title || '',
    author: (x.author && (x.author.name || x.author.handle)) || '',
  }));
  const wordTotal = rows.reduce((s, c) => s + (c.words || 0), 0);
  const avgMin = rows.length && wordTotal ? Math.max(1, Math.round(wordTotal / rows.length / 200)) : 0;
  return {
    id: b.id, title: b.title, cover: b.cover || '',
    cat: b.genre || '', status: b.status === 'completed' ? 'completed' : 'ongoing',
    isContest: false, synopsis: b.synopsis || '',
    writer: {
      id: w.id, username: w.username || w.name || 'unknown',
      name: w.name || w.username || 'Unknown',
      handle: '@' + (w.username || 'unknown'), avatar: w.avatar || '',
      followers: fmtN(w.followers || 0), isFollowed: !!w.following,
    },
    stats: {
      reads: fmtN(stats.reads || b.reads || 0),
      likes: fmtN(stats.likes || b.likes || 0),
      comments: fmtN(stats.comments || 0),
      shares: fmtN(stats.shares || 0),
      rating: stats.rating ? parseFloat(stats.rating).toFixed(1) : '–',
    },
    totalChapters: totalCh,
    currentProgress: { chapter: continueChN, chapterTitle: continueChTitle, percent: continuePct, cid: cr ? cr.chapterId : null },
    genres: [b.genre].filter(Boolean),
    startDate: b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
    lastUpdated: b.updatedAt ? timeAgo(new Date(b.updatedAt).getTime()) : '—',
    completedDate: b.status === 'completed' ? b.updatedAt || null : null,
    avgReadTime: avgMin ? avgMin + ' min/chapter' : '—',
    wordCount: b.wordCount ? fmtN(b.wordCount) + ' words' : '—',
    similar: similar,
    chapters,
    polls: [], predictions: [], debates: [], // filled from book-level engagement
  };
}

/* ══ WRITER PROFILE + STATUS RING (bridge parity) ══
   Red ring ONLY when the writer actually has statuses; gray after the
   status has been viewed; no border at all for a statusless avatar.
   Statuses resolve live from the status service by author name. */
function writer() { return (STORY && STORY.writer) || {}; }
function attachWriterStatus() {
  const w = writer();
  if (!w || w._stWired) return;
  w._stWired = true;
  try {
    const name = String(w.username || w.handle || w.name || '').replace(/^@/, '');
    const statuses = (window.DroboardStatus && DroboardStatus.writerStatuses(name)) || [];
    w.statuses = statuses;
    w.statusRing = statuses.length ? 'has' : 'none';
  } catch (e) { w.statuses = []; w.statusRing = 'none'; }
}
function writerPerson() {
  const w = writer();
  return {
    id: w.id, name: w.name, avatar: w.avatar,
    statuses: w.statuses,
    ring: w.statusRing === 'viewed' ? 'ring-viewed' : (w.statusRing === 'none' ? 'ring-none' : 'ring-has'),
  };
}
function renderWriterRing() {
  const host = document.getElementById('hwAvWrap');
  if (!host) return;
  const p = writerPerson();
  if (window.DroboardStatusRing) {
    host.innerHTML = DroboardStatusRing.html(p, {
      size: 28, key: p.name || p.id, personKey: p.name || '', innerBg: 'var(--l2,#1a1a24)',
    });
  } else {
    host.innerHTML = `<img src="${uAttr(p.avatar)}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block"/>`;
  }
}
function applyWriterRing() {
  if (window.DroboardStatusRing) DroboardStatusRing.apply(document.getElementById('hwAvWrap'));
}
function goProfile() {
  const w = writer();
  goProfileFor(w.username || w.handle || w.name);
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
      id: w.id || 'br_writer', name: w.name, avatar: w.avatar,
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
  if (!(w.statuses && w.statuses.length)) return false;
  const q = statusViewQueue({
    id: w.id || 'br_writer', name: w.name, avatar: w.avatar,
    ring: w.statusRing === 'viewed' ? 'ring-viewed' : 'ring-has',
    likes: 0, threads: 0, statuses: w.statuses,
  });
  if (window.DroboardStatusRing) {
    DroboardStatusRing.open(q, q[0].id).then(ok => { if (!ok) goProfile(); });
    return true;
  }
  if (typeof window.openStatusViewer !== 'function') return false;
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
  window.onStatusViewerChange = function (wid, ring, name) {
    // Viewer reports full class names ('ring-viewed' | 'ring-has')
    const newRing = ring === 'ring-viewed' ? 'viewed' : ring === 'ring-has' ? 'has' : ring === 'ring-live' ? 'live' : 'none';
    // The viewer keys on the author's NAME, not our per-surface ids.
    const key = String(name || wid || '').replace(/^@/, '').toLowerCase();
    const samePerson = (v) => v && (String(v.id) === String(wid) ||
      String(v.name || v.handle || '').replace(/^@/, '').toLowerCase() === key);
    let changed = false;
    Object.keys(userStatus).forEach(k => {
      const rec = userStatus[k];
      if (samePerson(rec) && newRing !== 'none' && rec.ring !== newRing) {
        rec.ring = newRing; changed = true;
      }
    });
    const w = writer();
    if (w && samePerson({ id: w.id, name: w.name || w.handle }) && newRing !== 'none') {
      w.statusRing = newRing; changed = true;
    }
    if (changed) paintStatusRings();
    if (typeof prev === 'function') prev(wid, ring, name);
  };
}

/* ══ ANY USER AVATAR / NAME (reviews, …) ══
   Same contract as the bridge: red ring ONLY when that author actually has
   statuses (resolved live from the status service by author name), gray
   after viewing, no border otherwise; names open the profile. */
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
    const canon = (window.DroboardStatus && DroboardStatus.writerStatuses(rec.name)) || [];
    if (canon.length) { rec.statuses = canon; rec.ring = 'has'; }
  } catch (e) {}
  userStatus[key] = rec;
  return rec;
}
function userAvHtml(name, avatar, size) {
  const rec = userStatusFor(name, avatar);
  const p = {
    id: rec.id, name: rec.name, avatar: rec.avatar, statuses: rec.statuses,
    ring: rec.ring === 'viewed' ? 'ring-viewed' : (rec.ring === 'none' ? 'ring-none' : 'ring-has'),
  };
  const attrs = `data-av-user="${uAttr(uKey(name, avatar))}"`;
  if (window.DroboardStatusRing) {
    // Key by the AUTHOR, never the record id — the viewer stores seen-state
    // under the author's name.
    return DroboardStatusRing.html(p, {
      size: size || 34, key: rec.name, personKey: rec.name, innerBg: 'rgba(255,0,80,.15)', gap: 0, attrs,
    });
  }
  const s = size || 34;
  const body = avatar
    ? `<img src="${uAttr(avatar)}" alt="" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
    : `<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,0,80,.15);font-weight:800;color:#fff">${esc0((name || '?').charAt(0).toUpperCase())}</span>`;
  return `<div data-av-user="${uAttr(uKey(name, avatar))}" style="width:${s}px;height:${s}px;border-radius:50%;overflow:hidden;flex-shrink:0">${body}</div>`;
}
function userNameHtml(name, cls) {
  return `<span class="${cls}" data-user-name="${uAttr(String(name || '').replace(/^@/, ''))}" style="cursor:pointer">${esc0(name)}</span>`;
}
function onUserAvatar(el) {
  const rec = userStatus[el.getAttribute('data-av-user')];
  if (rec && rec.statuses && rec.statuses.length) {
    const q = statusViewQueue({
      id: rec.id, name: rec.name, avatar: rec.avatar,
      ring: rec.ring === 'viewed' ? 'ring-viewed' : 'ring-has',
      likes: 0, threads: 0, statuses: rec.statuses,
    });
    if (window.DroboardStatusRing) {
      DroboardStatusRing.open(q, q[0].id).then(ok => { if (!ok) goProfileFor(rec.name); });
    } else if (typeof window.openStatusViewer === 'function') {
      window.openStatusViewer(q, q[0].id);
    } else {
      goProfileFor(rec.name);
    }
    return;
  }
  goProfileFor(rec ? rec.name : el.getAttribute('data-av-user'));
}
function paintStatusRings() {
  if (window.DroboardStatusRing) DroboardStatusRing.apply();
}

/* ══ INIT ══ */
async function init() {
  try {
    STORY = await fetchStoryDetail(storyId);
  } catch (e) {
    document.getElementById('tbStoryName').textContent = 'Story not found';
    document.getElementById('chaptersContent').innerHTML =
      '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>' + esc0(e.message || 'Failed to load story.') + '</p></div>';
    return;
  }
  if (!STORY || !STORY.writer) {
    document.getElementById('tbStoryName').textContent = 'Story not found';
    document.getElementById('chaptersContent').innerHTML =
      '<div class="empty-state"><i class="fas fa-book-open"></i><p>Story not available.</p></div>';
    return;
  }
  isFollowing = !!STORY.writer.isFollowed;
  // Top bar — only short story / long story types (no seasons)
  document.getElementById('tbStoryName').textContent = STORY.title;
  var _chTotal = STORY.totalChapters || 0;
  var _storyType = _chTotal > 1 ? 'Long story' : 'Short story';
  document.getElementById('tbStorySub').textContent = `@${STORY.writer.name} · ${_storyType} · ${_chTotal} chapter${_chTotal === 1 ? '' : 's'}`;

  // Hero
  document.getElementById('heroCover').style.backgroundImage = `url('${STORY.cover}')`;
  document.getElementById('heroTitle').textContent = STORY.title;
  document.getElementById('hwName').textContent = `@${STORY.writer.name}`;
  paintFollowButton();

  // Badges
  const statusBadge = STORY.status === 'ongoing'
    ? `<span class="hbadge hb-ongoing">🔥 Ongoing</span>`
    : `<span class="hbadge hb-complete">✓ Complete</span>`;
  const contestBadge = STORY.isContest ? `<span class="hbadge hb-contest">🏆 Contest</span>` : '';
  document.getElementById('heroBadges').innerHTML = `
    <span class="hbadge hb-cat">${esc0(STORY.cat)}</span>
    ${statusBadge}
    <span class="hbadge hb-complete">${_storyType} · ${STORY.totalChapters} chapter${STORY.totalChapters === 1 ? '' : 's'}</span>
    ${contestBadge}
  `;

  // Quick stats
  const qs = [
    { num: STORY.stats.reads, label: 'Reads', cls: 'r' },
    { num: STORY.stats.likes, label: 'Likes', cls: 'r' },
    { num: STORY.stats.comments, label: 'Comments', cls: 'b' },
    { num: STORY.stats.rating, label: 'Rating', cls: 'g' },
    { num: STORY.stats.shares, label: 'Shares', cls: '' },
  ];
  document.getElementById('quickStats').innerHTML = qs.map(q =>
    `<div class="qs-item"><div class="qs-num ${q.cls}">${q.num}</div><div class="qs-label">${q.label}</div></div>`
  ).join('');

  // Continue banner (no seasons — chapter only)
  paintContinueBanner();

  // Writer → profile (name) + status ring (avatar) — same contract as the
  // bridge page: red ring only when the writer actually has statuses.
  attachWriterStatus();
  renderWriterRing();
  applyWriterRing();
  wireStatusRing();
  document.getElementById('hwName').addEventListener('click', goProfile);
  // One delegated handler covers every user avatar/name rendered later
  // (reviews, re-renders) without rebinding.
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
  loadReviews();
  loadRatingSummary();
  const rateBtn = document.getElementById('rateBookBtn');
  if (rateBtn) rateBtn.addEventListener('click', openRateBook);
  renderMoreLike();
  loadEngagementRows();
  window.onDroboardSaveChange = function (sid, saved) {
    if (String(sid) === String(STORY.id)) {
      syncSaveIcon(saved);
      toast(saved ? "Saved to library!" : "Removed from library");
    }
  };
  mountAdStrip();

  // Signed-in refinement of chapter states + continue banner (guests keep
  // the price-based default state — no invented progress).
  loadReadState();

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

function paintContinueBanner() {
  const cp = STORY.currentProgress || {};
  document.getElementById('cbChName').textContent = cp.chapter ? `Ch${cp.chapter} — ${cp.chapterTitle}` : 'Start reading';
  document.getElementById('cbChMeta').textContent = cp.percent > 0 ? `${cp.percent}% through this chapter` : 'Not started yet';
  document.getElementById('cbProgress').style.width = (cp.percent || 0) + '%';
}
function paintFollowButton() {
  const btn = document.getElementById('hwFollow');
  if (!btn) return;
  btn.textContent = isFollowing ? '✓ Following' : '+ Follow';
  btn.classList.toggle('ing', isFollowing);
}

function trackAd(id, ev, ctx) { try { if (id && window.AdService) AdService.track(id, ev, ctx || { page: 'bookReader', slot: 'bookReader:top', storyId: storyId }); } catch (e) {} }
async function mountAdStrip() {
  var el = document.getElementById("adStripWrap");
  if (!el) return;
  if (!window.DroboardAdSlot) { el.style.display = "none"; return; }
  try {
    var filled = await window.DroboardAdSlot.mount(el, { slot: "bookReader:top", page: "bookReader", postId: storyId });
    el.style.display = filled ? "" : "none";
  } catch (e) { el.style.display = "none"; }
}

window.StoryReaderPage = { init: init, toast: toast, switchTab: switchTab, votePoll: ReaderEngagementVote, pickPrediction: ReaderEngagementVote, voteDebate: ReaderEngagementVote, toggleSave: toggleSave, toggleFollow: toggleFollow, openShare: openShare, toggleSynopsis: toggleSynopsis, openChapter: openChapter, continueReading: continueReading, moreEng: moreEng, helpfulTake: helpfulTake, goProfile: goProfile, onWriterAvatar: onWriterAvatar, onUserAvatar: onUserAvatar };
/* Votes are handled inside the shared ReaderEngagement component (its card
   onclicks call ReaderEngagement.votePoll/votePred/voteDebate directly).
   This stub only guards against stale inlined markup calling the old
   StoryReaderPage vote exports. */
function ReaderEngagementVote() {}

/* ══ REVIEWS — live ratings list (server-sorted + paginated) ══
   GET /api/stories/:id/ratings?page&limit&sort=helpful|newest|rating
   → { items:[{id,name,avatar,stars,text,spoiler,createdAt,helpful,mineHelpful}], total } */
const REV_PER_PAGE = 12;
let revSort = 'helpful';   // helpful | newest | rating
let revPage = 1;           // 1-based server page
let revTotal = 0;
const revMarked = {};      // rating id → mineHelpful (server truth from last load)

async function loadReviews() {
  const el = document.getElementById('reviewsContent');
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading reviews…</p></div>`;
  try {
    const res = await fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}/ratings?page=${revPage}&limit=${REV_PER_PAGE}&sort=${encodeURIComponent(revSort)}`, { credentials: 'include' });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error || ''; } catch (e) {}
      throw new Error('Ratings failed (' + res.status + ')' + (detail ? ' — ' + detail : ''));
    }
    const j = await res.json();
    revTotal = j.total || 0;
    renderReviews(j.items || []);
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Could not load reviews — ${esc0(e.message || 'request failed')}</p></div>`;
  }
}
/* ── RATE THIS BOOK — GET /api/stories/:id/rating (mine + avg/count + gate).
   The modal owns the gate; the server decides it from ReadingProgress, so a
   book shorter than the gate unlocks at its full length. */
let ratingInfo = null;
async function loadRatingSummary() {
  try {
    const res = await fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}/rating`, { credentials: 'include' });
    if (!res.ok) throw new Error(String(res.status));
    ratingInfo = await res.json();
  } catch (e) { ratingInfo = null; }
  paintRatingSummary();
}
function starRow(n) {
  n = Math.max(0, Math.min(5, Math.round(n)));
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}
function paintRatingSummary() {
  const el = document.getElementById('rateSummary');
  if (!el) return;
  const r = ratingInfo || {};
  const avg = Number(r.avg) || 0;
  const count = Number(r.count) || 0;
  const mine = (r.mine && r.mine.stars) || 0;
  const btn = document.getElementById('rateBookBtn');
  if (btn) btn.innerHTML = `<i class="fas fa-star"></i> ${mine ? 'Edit your rating' : 'Rate this book'}`;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:10px 12px;border:1px solid var(--bd);border-radius:12px;background:var(--l1)">
      <div style="color:#fbbf24;font-size:14px;letter-spacing:2px;white-space:nowrap">${starRow(avg)}</div>
      <div style="font-size:11px;color:var(--tx-muted)"><b style="color:var(--tx-high)">${avg ? avg.toFixed(1) : '—'}</b> · ${count} rating${count === 1 ? '' : 's'}</div>
      <div style="margin-left:auto;font-size:10px;font-weight:800;color:${mine ? '#ff4d7a' : 'var(--tx-muted)'}">${mine ? '✓ You rated ' + mine + '★' : 'Not rated yet'}</div>
    </div>`;
}
function openRateBook() {
  if (window.RequireAuth && !RequireAuth.ensure('rate this book')) return;
  if (!window.openRateModal) { toast('Rate modal not loaded'); return; }
  const s = STORY || {};
  window.openRateModal({
    storyId: s.id || storyId,
    title: s.title || '',
    img: s.cover || '',
    chaptersRead: ratingInfo && ratingInfo.chaptersRead,
    need: ratingInfo && ratingInfo.need,
    canRate: ratingInfo && ratingInfo.canRate,
    onDone: () => { loadRatingSummary(); loadReviews(); }
  });
}

function setRevSort(s) {
  if (revSort === s) return;
  revSort = s; revPage = 1;
  loadReviews();
}
function revGoPage(p) {
  const pages = Math.max(1, Math.ceil(revTotal / REV_PER_PAGE));
  revPage = Math.min(Math.max(1, p), pages);
  loadReviews();
  const head = document.getElementById('reviewsHead');
  if (head) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderReviews(items) {
  const el = document.getElementById('reviewsContent');
  if (!el) return;
  if (!items.length) { el.innerHTML = `<div class="empty-state"><i class="fas fa-star"></i><p>No reviews yet.</p></div>`; return; }
  items.forEach(t => { revMarked[String(t.id)] = !!t.mineHelpful; });
  const pages = Math.max(1, Math.ceil(revTotal / REV_PER_PAGE));
  if (revPage > pages) revPage = pages;

  const sortOpts = [['helpful', 'Most helpful'], ['newest', 'Newest'], ['rating', 'Top rated']];
  let html = '<div class="rev-sort">' + sortOpts.map(([k, l]) =>
    `<button type="button" class="rev-chip${revSort === k ? ' on' : ''}" data-revsort="${k}">${l}</button>`).join('') + '</div>';

  html += items.map(t => {
    const h = !!t.mineHelpful;
    return `
    <div class="rev-card">
      <div class="rev-head">
        ${userAvHtml(t.name, t.avatar, 34)}
        <div>${userNameHtml(t.name, 'rev-name')}<div class="rev-meta">${esc0(timeAgo(t.createdAt))}${t.spoiler ? ' · <span style="color:#f59e0b;font-weight:800">⚠ Spoiler</span>' : ''}</div></div>
        <div class="rev-stars">${starHtml(t.stars)}</div>
      </div>
      <div class="rev-text">${esc0(t.text)}</div>
      <div class="rev-foot rev-helpful${h ? ' on' : ''}" data-rev="${uAttr(t.id)}"><i class="${h ? 'fas' : 'far'} fa-thumbs-up"></i> Helpful (${fmtN(t.helpful || 0)})</div>
    </div>`;
  }).join('');

  if (pages > 1) {
    html += `<div class="rev-pager">
      <button type="button" class="rev-pg" data-revpg="${revPage - 1}" ${revPage === 1 ? 'disabled' : ''}>‹ Prev</button>
      <span class="rev-pg-info">Page ${revPage} of ${pages}</span>
      <button type="button" class="rev-pg" data-revpg="${revPage + 1}" ${revPage >= pages ? 'disabled' : ''}>Next ›</button>
    </div>`;
  }

  el.innerHTML = html;
  el.querySelectorAll('[data-revsort]').forEach(b => b.addEventListener('click', () => setRevSort(b.dataset.revsort)));
  el.querySelectorAll('[data-revpg]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) revGoPage(+b.dataset.revpg); }));
  el.querySelectorAll('[data-rev]').forEach(b => b.addEventListener('click', () => helpfulTake(b.dataset.rev)));
}
/* POST / DELETE …/ratings/:ratingId/helpful — the server response is the
   only state; on failure we surface the error and never toggle locally. */
async function helpfulTake(id) {
  id = String(id);
  if (window.RequireAuth && !RequireAuth.ensure('mark reviews helpful')) return;
  const wantMark = !revMarked[id];
  try {
    const res = await fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}/ratings/${encodeURIComponent(id)}/helpful`, {
      method: wantMark ? 'POST' : 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error || ''; } catch (e) {}
      throw new Error(detail || res.status);
    }
    const j = await res.json().catch(() => ({}));
    revMarked[id] = !!j.mineHelpful;
    toast(j.mineHelpful ? '👍 Marked helpful' : 'Helpful removed');
    loadReviews(); // re-paint from server truth (updated helpful counts)
  } catch (e) {
    toast('Could not save — ' + (e.message || 'request failed'));
  }
}
function starHtml(rating) {
  const r = Number(rating) || 0;
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  let out = '';
  for (let i = 0; i < 5; i++) {
    if (i < full) out += '<i class="fas fa-star"></i>';
    else if (i === full && half) out += '<i class="fas fa-star-half-alt"></i>';
    else out += '<i class="far fa-star"></i>';
  }
  return `<span class="rev-stars" title="${r} out of 5">${out}<span class="rev-star-num">${r ? r.toFixed(1) : '—'}</span></span>`;
}

function moreLikeItems() {
  // Backend-provided similar books array
  if (STORY && Array.isArray(STORY.similar) && STORY.similar.length) {
    return STORY.similar.slice(0, 8);
  }
  return [];
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
    <div class="more-card" data-id="${uAttr(s.id)}">
      <div class="more-cover"><img src="${uAttr(s.img)}" loading="lazy" alt=""/></div>
      <div class="more-title">${esc0(s.title)}</div>
    </div>`).join('');
  el.querySelectorAll('.more-card').forEach(c => c.addEventListener('click', () => {
    location.href = 'book-reader.html?id=' + encodeURIComponent(c.dataset.id);
  }));
}

/* ══ CHAPTERS — flat list (no seasons: short story vs long story only) ══ */
function allChaptersFlat() {
  return Array.isArray(STORY.chapters) ? STORY.chapters : [];
}
/* Chapter → engagement icons (poll 📊 / prediction 🔮 / debate ⚔️) from the
   chapter refs on the live book-level engagement rows. */
function engMap() {
  const m = {};
  const add = (item, key) => {
    if (!item || item.chapter == null) return;
    const k = String(item.chapter);
    (m[k] = m[k] || []).push(key);
  };
  (STORY.polls || []).forEach(p => add(p, '📊'));
  (STORY.predictions || []).forEach(p => add(p, '🔮'));
  (STORY.debates || []).forEach(d => add(d, '⚔️'));
  return m;
}
function openChapter(n) {
  location.href = 'full-reader.html?story=' + encodeURIComponent(storyId) + '&ch=' + n;
}
/* Continue banner → jump straight into the full reader at saved progress. */
function continueReading() {
  const cp = STORY && STORY.currentProgress;
  openChapter(cp ? (cp.chapter || 1) : 1);
}
function renderChapters() {
  const container = document.getElementById('chaptersContent');
  const chapters = allChaptersFlat();
  container.innerHTML = renderChapterList(chapters);
}
/* Signed-in refinement: GET /api/stories/:id/read-state →
   { unlocked[chapterIds], progress{cid:{pct,finished}}, lastChapterId } */
function loadReadState() {
  if (!(window.AuthSession && AuthSession.isSignedIn())) return;
  fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}/read-state`, { credentials: 'include' })
    .then(r => r.ok ? r.json() : null)
    .then(rs => {
      if (!rs) return;
      applyReadState(rs);
      renderChapters();
      paintContinueBanner();
    })
    .catch(() => {});
}
function applyReadState(rs) {
  if (!STORY || !Array.isArray(STORY.chapters) || !STORY.chapters.length) return;
  const unlocked = new Set((rs.unlocked || []).map(String));
  const prog = rs.progress || {};
  const crId = STORY.currentProgress && STORY.currentProgress.cid != null ? String(STORY.currentProgress.cid) : null;
  const lastId = rs.lastChapterId != null ? String(rs.lastChapterId) : crId;
  let currentSet = false;
  const rows = STORY.chapters;
  rows.forEach(c => {
    const id = String(c.cid);
    if (c.price > 0 && !unlocked.has(id)) { c.state = 'locked'; return; }
    if (lastId && id === lastId) { c.state = 'current'; currentSet = true; return; }
    const p = prog[c.cid] || prog[id];
    if (p && (p.finished || (p.pct || 0) > 0)) { c.state = 'done'; return; }
    c.state = '';
  });
  if (!currentSet) {
    const first = rows.find(c => c.state === '');
    if (first) { first.state = 'current'; currentSet = true; }
  }
  rows.forEach(c => { if (c.state === '') c.state = 'done'; });
  if (lastId) {
    const ch = rows.find(c => String(c.cid) === lastId);
    if (ch) {
      const p = prog[ch.cid] || prog[String(ch.cid)] || {};
      STORY.currentProgress = { chapter: ch.n, chapterTitle: ch.title, percent: Math.round(p.pct || 0), cid: ch.cid };
    }
  }
}

function renderChapterList(chapters) {
  const em = engMap();
  return chapters.map((ch) => {
    const numCls = ch.state === 'done' ? 'done' : ch.state === 'current' ? 'current' : 'locked';
    const numIcon = ch.state === 'done'
      ? `<i class="fas fa-check" style="font-size:9px"></i>`
      : ch.state === 'locked'
        ? `<i class="fas fa-lock" style="font-size:9px"></i>`
        : ch.n;
    const badges = (ch.badges || []).map(b =>
      b === 'free' ? `<span class="ch-badge crb-free">FREE</span>` : ''
    ).join('');
    const eng = (em[String(ch.n)] || []).map(icon =>
      `<span title="Engagement in this chapter" style="font-size:10px">${icon}</span>`
    ).join('');
    const rightEl = ch.state === 'current'
      ? `<span class="ch-current-tag">Reading</span><button class="ch-read-btn" onclick="event.stopPropagation();StoryReaderPage.openChapter(${ch.n})">Continue</button>`
      : ch.state === 'done'
        ? `<i class="fas fa-check-circle ch-done-ico"></i>`
        : `<i class="fas fa-lock ch-lock-ico"></i>`;

    return `
      <div class="ch-row${ch.state === 'current' ? ' current-ch' : ''}" onclick="StoryReaderPage.openChapter(${ch.n})">
        <div class="ch-num-badge ${numCls}">${numIcon}</div>
        <div class="ch-info">
          <div class="ch-title">Ch.${ch.n} — ${esc0(ch.title)}</div>
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

/* ══ OVERVIEW ══ */
function renderOverview() {
  document.getElementById('synopsisText').textContent = STORY.synopsis;

  const _isLong = (STORY.totalChapters || 0) > 1;
  const infoRows = [
    { icon: '✍️', label: 'Author', val: `@${STORY.writer.name} · ${STORY.writer.followers} followers` },
    { icon: '📅', label: 'Started', val: STORY.startDate },
    { icon: '🔄', label: 'Last updated', val: STORY.lastUpdated },
    { icon: '📖', label: 'Type', val: _isLong ? 'Long story' : 'Short story' },
    { icon: '📖', label: 'Chapters', val: `${allChaptersFlat().length} published` },
    { icon: '⏱', label: 'Read time', val: STORY.avgReadTime },
    { icon: '📝', label: 'Word count', val: STORY.wordCount },
    { icon: '🏷️', label: 'Genres', val: null, pills: STORY.genres },
  ];

  document.getElementById('infoRows').innerHTML = infoRows.map(r => `
    <div class="info-row">
      <div class="info-icon">${r.icon}</div>
      <div>
        <div class="info-label">${r.label}</div>
        ${r.val ? `<div class="info-val">${esc0(r.val)}</div>` : ''}
        ${r.pills ? `<div class="tag-row">${r.pills.map(p => `<span class="genre-pill">${esc0(p)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`).join('');

  // Stats deep
  const topReads = allChaptersFlat()
    .filter(c => c.reads !== '–')
    .sort((a, b) => (b.readsNum || 0) - (a.readsNum || 0))
    .slice(0, 3);
  document.getElementById('statsDeep').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      ${[
        { n: STORY.stats.reads, l: 'Total Reads', c: '#ff0050' },
        { n: STORY.stats.likes, l: 'Total Likes', c: '#ff0050' },
        { n: STORY.stats.shares, l: 'Shares', c: '#38bdf8' },
      ].map(s => `<div style="background:var(--l2);border:1px solid var(--bd);border-radius:11px;padding:10px;text-align:center"><div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:${s.c}">${s.n}</div><div style="font-size:8px;color:var(--tx-muted);margin-top:2px">${s.l}</div></div>`).join('')}
    </div>
    ${topReads.length ? `<div style="font-size:9px;font-weight:800;color:var(--tx-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🏆 Most-read chapters</div>
    ${topReads.map((c, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd2);cursor:pointer" onclick="StoryReaderPage.openChapter(${c.n})"><div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:${i===0?'#fbbf24':i===1?'#a0a0b0':'#a07040'};width:20px">${i+1}</div><div style="flex:1;font-size:11px;color:var(--tx-high);font-weight:600"><span style="display:inline-block;font-size:8.5px;font-weight:800;color:var(--acc3);background:rgba(255,0,80,.09);border:1px solid var(--bd-acc);border-radius:6px;padding:1px 6px;margin-right:6px;vertical-align:middle">CH.${c.n}</span>${esc0(c.title)}</div><div style="font-size:11px;font-weight:800;color:var(--acc)">${c.reads}</div><i class="fas fa-chevron-right" style="font-size:9px;color:var(--tx-faint)"></i></div>`).join('')}` : ''}`;
}

function toggleSynopsis() {
  synExpanded = !synExpanded;
  document.getElementById('synopsisText').classList.toggle('truncated', !synExpanded);
  document.getElementById('synToggle').textContent = synExpanded ? 'Show less ‹' : 'Read more ›';
}

/* ══ BOOK-LEVEL ENGAGEMENT (polls / predictions / debates) ══
   Rows are read through the shared ReaderEngagement component, which loads
   GET /api/stories/:bookId/engagement and votes via
   POST /api/stories/:bookId/engagement/vote (requireAuth — guests hit the
   login gate). Nothing is invented here: a story with no engagement rows
   shows the honest empty state. Paginated 10 per page. */
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
  return `<button onclick="StoryReaderPage.moreEng('${kind}')" style="width:100%;margin-top:10px;padding:11px;border-radius:12px;background:var(--l3);border:1px solid var(--bd);color:var(--tx-body);font-size:12px;font-weight:700;cursor:pointer">Show more (${left} remaining)</button>`;
}
/* One shared read of the book-level engagement feeds both the listing and
   the per-row mounts (the component caches per book). */
function loadEngagementRows() {
  if (!(window.ReaderEngagement && ReaderEngagement.bookEngagement)) {
    STORY.polls = []; STORY.predictions = []; STORY.debates = [];
    renderPolls(); renderDebates();
    return;
  }
  ReaderEngagement.bookEngagement(storyId).then(eng => {
    STORY.polls = eng.polls || [];
    STORY.predictions = eng.predictions || [];
    STORY.debates = eng.debates || [];
    renderPolls();
    renderDebates();
  }).catch(e => {
    STORY.polls = []; STORY.predictions = []; STORY.debates = [];
    const msg = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Could not load engagement — ${esc0(e.message || 'request failed')}</p></div>`;
    const pc = document.getElementById('pollsContent');
    const dc = document.getElementById('debatesContent');
    if (pc) pc.innerHTML = msg;
    if (dc) dc.innerHTML = msg;
  });
}
function renderPolls() {
  const container = document.getElementById('pollsContent');
  const polls = STORY.polls || [];
  const preds = STORY.predictions || [];

  if (!polls.length && !preds.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-poll"></i><p>No polls or predictions yet for this story</p></div>`;
    return;
  }

  const pShow = polls.slice(0, engShown.poll);
  const dShow = preds.slice(0, engShown.pred);
  let html = '';

  if (pShow.length) {
    html += `<div class="sh" style="margin-bottom:10px"><div class="sh-title">📊 Reader Polls</div></div>`;
    pShow.forEach(poll => { html += `<div id="eng-${STORY.id}-poll-${poll.id}"></div>`; });
    html += engMoreBtn('poll', polls.length);
  }
  if (dShow.length) {
    html += `<div class="sh" style="margin:14px 0 10px"><div class="sh-title">🔮 Predictions</div></div>`;
    dShow.forEach(pred => { html += `<div id="eng-${STORY.id}-pred-${pred.id}"></div>`; });
    html += engMoreBtn('pred', preds.length);
  }
  container.innerHTML = html;

  if (!window.ReaderEngagement) return;
  pShow.forEach(poll => {
    const mount = document.getElementById(`eng-${STORY.id}-poll-${poll.id}`);
    if (!mount) return;
    ReaderEngagement.renderInto(
      `${STORY.id}-poll-${poll.id}`,
      poll.chapter || 1,
      mount,
      '',   // NO author note for polls
      {
        kinds: { poll: true, pred: false, deb: false },
        chapterLabel: chLabel(poll),
        live: { bookId: STORY.id, bookLevel: true, rowId: poll.id, kind: 'poll' },
      }
    );
  });
  dShow.forEach(pred => {
    const mount = document.getElementById(`eng-${STORY.id}-pred-${pred.id}`);
    if (!mount) return;
    ReaderEngagement.renderInto(
      `${STORY.id}-pred-${pred.id}`,
      pred.chapter || 1,
      mount,
      '',   // NO author note for predictions
      {
        kinds: { poll: false, pred: true, deb: false },
        chapterLabel: chLabel(pred),
        live: { bookId: STORY.id, bookLevel: true, rowId: pred.id, kind: 'pred' },
      }
    );
  });
}

/* ══ DEBATES ══
   Same accordion debate card as the reader pages — book-wide debates
   (chapter: null) first, then chapter-scoped. Full threads live on
   debate.html (View full debate →). Paginated 10 per page. */
function renderDebates() {
  const container = document.getElementById('debatesContent');
  const debates = STORY.debates || [];

  if (!debates.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-comments"></i><p>No debates yet for this story</p></div>`;
    return;
  }

  // Book-wide debates first (chapter: null), then chapter-scoped
  const bookWideDebs = debates.filter(d => d.chapter == null);
  const chapterDebs = debates.filter(d => d.chapter != null);
  const debits = bookWideDebs.concat(chapterDebs).slice(0, engShown.deb);

  let html = '';
  debits.forEach(deb => {
    html += `<div id="eng-${STORY.id}-deb-${deb.id}"></div>`;
  });
  html += engMoreBtn('deb', debates.length);
  container.innerHTML = html;

  if (!window.ReaderEngagement) return;
  debits.forEach(deb => {
    const mount = document.getElementById(`eng-${STORY.id}-deb-${deb.id}`);
    if (!mount) return;

    // Book-wide engagement (chapter: null) — no "Ch." label
    const isBookWide = deb.chapter == null;
    ReaderEngagement.renderInto(
      `${STORY.id}-deb-${deb.id}`,
      deb.chapter || 1,
      mount,
      '',   // NO author note for book-wide engagement
      {
        kinds: { poll: false, pred: false, deb: true },
        chapterLabel: isBookWide ? '' : chLabel(deb), // only show "Ch. X" for chapter-scoped
        debateId: deb.id,
        live: { bookId: STORY.id, bookLevel: true, rowId: deb.id, kind: 'deb' },
      }
    );
  });
}

/* ══ SAVE / FOLLOW ══ */
function toggleSave() {
  if (window.RequireAuth && !RequireAuth.ensure('save this story')) return;
  if (!window.openSaveModal) { toast("Save unavailable"); return; }
  openSaveModal({
    title: STORY.title,
    sub: "by @" + STORY.writer.name,
    img: STORY.cover,
    storyId: STORY.id,
  });
}
function syncSaveIcon(saved) {
  var btn = document.getElementById("saveBtn");
  if (!btn) return;
  isSaved = !!saved;
  btn.classList.toggle("active", isSaved);
  btn.innerHTML = '<i class="' + (isSaved ? "fas" : "far") + ' fa-bookmark"></i>';
}
/* POST / DELETE /api/users/:handle/follow — server truth only. */
async function toggleFollow() {
  if (followBusy) return;
  if (window.RequireAuth && !RequireAuth.ensure('follow this writer')) return;
  const handle = String(STORY.writer.username || STORY.writer.name || '').replace(/^@/, '');
  if (!handle) { toast('Writer profile unavailable'); return; }
  followBusy = true;
  const wantFollow = !isFollowing;
  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(handle)}/follow`, {
      method: wantFollow ? 'POST' : 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error || ''; } catch (e) {}
      throw new Error(detail || res.status);
    }
    isFollowing = wantFollow;
    paintFollowButton();
    toast(isFollowing ? `✅ Following @${STORY.writer.name}` : `Unfollowed @${STORY.writer.name}`);
  } catch (e) {
    toast('Could not update follow — ' + (e.message || 'request failed'));
  }
  followBusy = false;
}

/* ══ SHARE ══ */
function openShare() {
  if (!window.openShareModal) { toast("Share unavailable"); return; }
  openShareModal({
    title: STORY.title,
    sub: "by @" + STORY.writer.name + " " + STORY.stats.reads + " reads",
    img: STORY.cover,
    url: "https://droboard.app/story/" + STORY.id,
    contentId: STORY.id,
    contentType: 'books',
  });
}

})();
