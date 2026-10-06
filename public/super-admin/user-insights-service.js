/**
 * user-insights-service.js — Data + controller for User Insights page
 * user-insights.html is shell only + mounts; everything renders here.
 *
 * DEMO: reads window.__usersAPI (users-service.js) with AdminDemo fallback.
 * referrals / plans / funding / sessions-per-day are derived deterministically
 * from each user id (stable across reloads) until the backend supplies them.
 * Going live: set USE_API=true and implement fetchInsights() against:
 *   GET /api/insights/overview  (kpis, genre affinity, sessions, money, referrals)
  *   GET /api/insights/leaderboard?type=tips|readtime|referrals|streaks&role=&extra=
 * Backend event taxonomy (to build first): session.start/end, read.chapter_finished,
 * tip.sent, wallet.funded, coins.spent, subscription.started/cancelled,
 * referral.sent/converted. No HTML change needed.
 */
(function(global){
'use strict';

/* Demo-data self-load for the direct AdminDemo fallback path (primary reads
   come via window.__usersAPI). Page HTML no longer includes the data script;
   delete these 3 lines at go-live. */
if(typeof global.AdminDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="data/admin-demo-data.js"><\/script>');
}

const USE_API = false;
const API_BASE = '/api/super-admin/insights';

const SUB_PRICE = 5; // USD/month assumed for MRR demo math

function hashStr(s){
  var h = 0;
  s = String(s || '');
  for (var i = 0; i < s.length; i++){ h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}
function fmtNum(n){
  n = +n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}
function fmtMoney(n){ return '$' + fmtNum(n); }
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function dayDiff(a, b){
  try { return Math.floor((new Date(a) - new Date(b)) / 86400000); } catch (e){ return 9999; }
}

function readUsers(){
  try {
    if (global.__usersAPI && typeof global.__usersAPI.users === 'function') {
      var list = global.__usersAPI.users();
      if (list && list.length) return list;
    }
  } catch (e){}
  try {
    var D = global.AdminDemo || {};
    return (D.PLATFORM_USERS || []).slice();
  } catch (e){ return []; }
}
function readGenreColors(){
  try {
    if (global.__usersAPI && typeof global.__usersAPI.genreColors === 'function') return global.__usersAPI.genreColors() || {};
  } catch (e){}
  return {};
}

/* Demo derivation — deterministic per user id; replaced by backend fields. */
function derive(u){
  var h = hashStr(u.id);
  var sent = h % 41;
  var converted = Math.floor(sent * (0.10 + (h % 30) / 100));
  var plan = 'free';
  if (u.role === 'Reader') plan = (h % 10 < 2) ? 'premium' : ((h % 10 < 3) ? 'trial' : 'free');
  return {
    referralsSent: sent,
    referralsConverted: converted,
    plan: plan,
    funded: (+u.coinsSpent || 0) + (h % 50000),
    sessionsPerDay: 1 + (h % 6)
  };
}

async function fetchInsights(){
  if (USE_API) {
    var r = await fetch(API_BASE + '/overview', { credentials: 'include' });
    if (!r.ok) throw new Error('insights API failed');
    return r.json();
  }
  var users = readUsers();
  var ex = users.map(function(u){ return { u: u, x: derive(u) }; });
  var maxActive = null;
  users.forEach(function(u){
    if (!u.lastActive) return;
    if (!maxActive || u.lastActive > maxActive) maxActive = u.lastActive;
  });
  return { users: users, ex: ex, genreColors: readGenreColors(), refDate: maxActive, subPrice: SUB_PRICE };
}

function topBy(ex, fn, n){
  return ex.slice().sort(function(a, b){ return fn(b) - fn(a); }).slice(0, n || 10);
}
function metaChip(txt, cls){ return '<span class="' + cls + '">' + txt + '</span>'; }
function rowMeta(u, x, tab){
  var parts = [];
  if (x.plan === 'premium') parts.push(metaChip('Premium', 'pos'));
  else if (x.plan === 'trial') parts.push(metaChip('Trial', 'warn'));
  if (u.status === 'banned') parts.push(metaChip('Banned', 'neg'));
  else if (u.status === 'suspended') parts.push(metaChip('Suspended', 'warn'));
  var streak = +u.streakDays || 0;
  if (streak >= 7) parts.push(metaChip('🔥 ' + streak + 'd streak', 'pos'));
  if (tab === 'tips' || tab === 'streaks') {
    if (+u.reads > 0) parts.push(metaChip(fmtNum(u.reads) + ' reads', 'mut'));
    else parts.push(metaChip(x.sessionsPerDay + '/day sessions', 'mut'));
  }
  if (tab === 'readtime') parts.push(metaChip((+u.avgSessionMin || 0) + 'm avg', 'mut'));
  if (tab === 'referrals') {
    var rate = x.referralsSent ? Math.round((x.referralsConverted / x.referralsSent) * 100) : 0;
    parts.push(metaChip(rate + '% conv', rate >= 20 ? 'pos' : (x.referralsSent ? 'mut' : 'neg')));
  }
  var top = (u.topGenres && u.topGenres.length) ? u.topGenres.slice().sort(function(a, b){ return (+b.count || 0) - (+a.count || 0); })[0] : null;
  if (top) parts.push(metaChip('❤ ' + top.name, 'mut'));
  return parts.join(' ');
}
function roleClass(role){
  var r = String(role || '').toLowerCase();
  if (r === 'writer' || r === 'author') return 'writer';
  if (r === 'reader') return 'reader';
  return 'other';
}
function lbRow(i, u, val, sub){
  return '<div class="lb-row" data-lbid="' + esc(u.id) + '"><span class="lb-rank">' + (i + 1) + '</span>'
    + '<img class="lb-av" src="' + esc(u.avatar || '') + '" alt=""/>'
    + '<span class="lb-text"><span class="lb-name">' + esc(u.name) + ' <span class="lb-role ' + roleClass(u.role) + '">· ' + esc(u.role || '') + '</span></span>'
    + '<span class="lb-sub">' + (sub || '') + '</span></span>'
    + '<span class="lb-val">' + val + '</span>'
    + '<i class="fas fa-chevron-right lb-chev"></i></div>'
    + '<div class="lb-detail" id="lbd-' + esc(u.id) + '"></div>';
}
var openLbId = null;
function lbMeta(label, val){
  return '<div class="lb-meta"><span>' + label + '</span><b>' + val + '</b></div>';
}
function renderLbDetail(entry){
  var box = document.getElementById('lbd-' + entry.u.id);
  if (!box) return;
  var u = entry.u, x = entry.x;
  var rate = x.referralsSent ? Math.round((x.referralsConverted / x.referralsSent) * 100) : 0;
  var genres = (u.topGenres || []).map(function(g){
    return '<span class="lb-chip">' + esc(g.name) + ' <b>+' + (+g.count || 0) + '</b></span>';
  }).join('') || '<span class="lb-chip">No genre tags</span>';
  var topGenre = (u.topGenres && u.topGenres.length) ? u.topGenres.slice().sort(function(a, b){ return (+b.count || 0) - (+a.count || 0); })[0] : null;
  box.innerHTML = '<div class="lb-detail-inner">'
    + '<div class="lb-meta-grid">'
    + lbMeta('Role', esc(u.role || '—')) + lbMeta('Status', esc(u.status || '—'))
    + lbMeta('Plan', esc(x.plan)) + (+u.reads > 0 ? lbMeta('Reads', fmtNum(u.reads)) : lbMeta('Sessions', x.sessionsPerDay + '/day'))
    + lbMeta('Read time', (+u.readingHours || 0) + 'h total')
    + lbMeta('Top genre', topGenre ? esc(topGenre.name) : '—')
    + lbMeta('Tips', fmtMoney(u.tipsAmount)) + lbMeta('Coin spend', fmtMoney(u.coinsSpent))
    + lbMeta('Referrals', x.referralsConverted + ' / ' + x.referralsSent + ' (' + rate + '%)')
    + lbMeta('Funded', fmtMoney(x.funded))
    + lbMeta('Sessions', x.sessionsPerDay + '/day · ' + (+u.avgSessionMin || 0) + 'm avg')
    + lbMeta('Streak', (u.streakDays || 0) + 'd')
    + lbMeta('Following', fmtNum(u.following)) + lbMeta('Last active', esc(u.lastActive || '—'))
    + '</div><div class="lb-chips">' + genres + '</div></div>';
}
function bindLbAccordion(bodyEl, entries){
  if (!bodyEl || bodyEl._lbBound) return;
  bodyEl._lbBound = true;
  bodyEl.addEventListener('click', function(e){
    var row = e.target.closest('[data-lbid]');
    if (!row) return;
    var id = row.getAttribute('data-lbid');
    var wasOpen = openLbId === id;
    openLbId = wasOpen ? null : id;
    document.querySelectorAll('.lb-row.is-open').forEach(function(r){ if (!bodyEl.contains(r)) r.classList.remove('is-open'); });
    document.querySelectorAll('.lb-detail.show').forEach(function(d){ if (!bodyEl.contains(d)) { d.classList.remove('show'); d.innerHTML = ''; } });
    bodyEl.querySelectorAll('.lb-row').forEach(function(r){ r.classList.toggle('is-open', r.getAttribute('data-lbid') === openLbId); });
    bodyEl.querySelectorAll('.lb-detail').forEach(function(d){ d.classList.remove('show'); d.innerHTML = ''; });
    if (!wasOpen) {
      var list = (typeof entries === 'function') ? entries() : (entries || []);
      var entry = null;
      list.forEach(function(en){ if (String(en.u.id) === String(id)) entry = en; });
      if (entry) {
        renderLbDetail(entry);
        var box = document.getElementById('lbd-' + entry.u.id);
        if (box) box.classList.add('show');
      }
    }
  });
}

function renderStats(d){
  var premium = d.ex.filter(function(e){ return e.x.plan === 'premium'; }).length;
  var refConv = d.ex.reduce(function(s, e){ return s + e.x.referralsConverted; }, 0);
  var tips = d.users.reduce(function(s, u){ return s + (+u.tipsAmount || 0); }, 0);
  var cards = [
    { n: d.users.length, l: 'Tracked users', ico: 'fa-users', c: 'blue', bg: 'var(--blue-bg)' },
    { n: premium, l: 'Premium subscribers', ico: 'fa-crown', c: 'gold', bg: 'var(--gold-bg)' },
    { n: fmtNum(refConv), l: 'Referral conversions', ico: 'fa-user-plus', c: 'green', bg: 'var(--green-bg)' },
    { n: fmtMoney(tips), l: 'Tips volume', ico: 'fa-coins', c: 'amber', bg: 'var(--amber-bg)' }
  ];
  document.getElementById('statCards').innerHTML = cards.map(function(s){
    return '<div class="stat-card"><div class="stat-ico" style="background:' + s.bg + ';color:var(--' + s.c + ')"><i class="fas ' + s.ico + '"></i></div>'
      + '<div><div class="stat-num">' + s.n + '</div><div class="stat-lbl">' + s.l + '</div></div></div>';
  }).join('');
}

var activeLb = 'tips';
var lbBoardEntries = [];
var lbRefEntries = [];
var lbFilters = { role: 'all', extra: 'all' };
function lbExtraOptions(){
  if (activeLb === 'tips') return [
    { v: 'all', l: 'All plans' }, { v: 'premium', l: 'Premium' }, { v: 'trial', l: 'Trial' }, { v: 'free', l: 'Free' }
  ];
  if (activeLb === 'readtime') return [
    { v: 'all', l: 'Any time' }, { v: 'h10', l: '10h+' }, { v: 'h50', l: '50h+' }
  ];
  if (activeLb === 'referrals') return [
    { v: 'all', l: 'All referrers' }, { v: 'converted', l: 'Has conversions' }
  ];
  return [
    { v: 'all', l: 'All streaks' }, { v: 'w7', l: '7d+' }, { v: 'w30', l: '30d+' }
  ];
}
function lbApplyFilters(ex){
  var out = ex.filter(function(e){
    if (lbFilters.role !== 'all' && String(e.u.role || '').toLowerCase() !== lbFilters.role) return false;
    var x = lbFilters.extra;
    if (x === 'all') return true;
    if (activeLb === 'tips') return e.x.plan === x;
    if (activeLb === 'readtime') return (+e.u.readingHours || 0) >= (x === 'h50' ? 50 : 10);
    if (activeLb === 'referrals') return x === 'converted' ? e.x.referralsConverted > 0 : true;
    return (+e.u.streakDays || 0) >= (x === 'w30' ? 30 : 7);
  });
  return out;
}
function renderLbFilters(){
  var box = document.getElementById('lbFilters');
  if (!box) return;
  var roles = [{ v: 'all', l: 'All roles' }, { v: 'writer', l: 'Writers' }, { v: 'reader', l: 'Readers' }];
  var html = '<span class="lb-filter-lbl">Role</span>' + roles.map(function(r){
    return '<button class="lb-filter' + (lbFilters.role === r.v ? ' on' : '') + '" data-lf="role" data-v="' + r.v + '">' + r.l + '</button>';
  }).join('');
  html += '<span class="lb-filter-lbl">Filter</span>' + lbExtraOptions().map(function(o){
    return '<button class="lb-filter' + (lbFilters.extra === o.v ? ' on' : '') + '" data-lf="extra" data-v="' + o.v + '">' + o.l + '</button>';
  }).join('');
  box.innerHTML = html;
}
function renderBoard(d){
  var body = document.getElementById('lbBody');
  openLbId = null;
  var rows = [], entries = [];
  var pool = lbApplyFilters(d.ex);
  if (activeLb === 'tips') entries = topBy(pool, function(e){ return +e.u.tipsAmount || 0; });
  else if (activeLb === 'readtime') entries = topBy(pool, function(e){ return +e.u.readingHours || 0; });
  else if (activeLb === 'referrals') entries = topBy(pool, function(e){ return e.x.referralsConverted; });
  else entries = topBy(pool, function(e){ return +e.u.streakDays || 0; });
  lbBoardEntries = entries;
  if (activeLb === 'tips') rows = entries.map(function(e, i){ return lbRow(i, e.u, fmtMoney(e.u.tipsAmount), rowMeta(e.u, e.x, 'tips')); });
  else if (activeLb === 'readtime') rows = entries.map(function(e, i){ return lbRow(i, e.u, fmtNum(e.u.readingHours) + 'h total', rowMeta(e.u, e.x, 'readtime')); });
  else if (activeLb === 'referrals') rows = entries.map(function(e, i){ return lbRow(i, e.u, e.x.referralsConverted + ' conv · ' + e.x.referralsSent + ' sent', rowMeta(e.u, e.x, 'referrals')); });
  else rows = entries.map(function(e, i){ return lbRow(i, e.u, (e.u.streakDays || 0) + 'd', rowMeta(e.u, e.x, 'streaks')); });
  body.innerHTML = rows.length ? rows.join('') : '<div class="empty-msg">No data for these filters.</div>';
  bindLbAccordion(body, function(){ return lbBoardEntries; });
}

function renderGenres(d){
  var totals = {};
  d.users.forEach(function(u){
    (u.topGenres || []).forEach(function(g){ totals[g.name] = (totals[g.name] || 0) + (+g.count || 0); });
  });
  var names = Object.keys(totals).sort(function(a, b){ return totals[b] - totals[a]; }).slice(0, 8);
  var max = 1;
  names.forEach(function(n){ if (totals[n] > max) max = totals[n]; });
  document.getElementById('genreBars').innerHTML = names.length ? names.map(function(n){
    var pct = Math.round((totals[n] / max) * 100);
    var col = d.genreColors[n] || 'var(--accent)';
    return '<div class="h-bar-row"><div class="h-bar-lbl">' + esc(n) + '</div>'
      + '<div class="h-bar-track"><div class="h-bar-fill" style="width:' + pct + '%;background:' + col + '"></div></div>'
      + '<div class="h-bar-val">' + fmtNum(totals[n]) + '</div></div>';
  }).join('') : '<div class="empty-msg">No genre tags.</div>';
}

function mstat(label, val, sub){
  return '<div class="m-stat"><span>' + label + '</span><b>' + val + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
}
function renderSessions(d){
  var dau = 0, wau = 0, mau = 0, sessSum = 0, sessN = 0, streakSum = 0;
  var buckets = { '1/day': 0, '2–3/day': 0, '4+/day': 0 };
  d.ex.forEach(function(e){
    var age = d.refDate ? dayDiff(d.refDate, e.u.lastActive) : 9999;
    if (age <= 0) dau++;
    if (age <= 7) wau++;
    if (age <= 30) mau++;
    sessSum += (+e.u.avgSessionMin || 0); sessN++;
    streakSum += (+e.u.streakDays || 0);
    var s = e.x.sessionsPerDay;
    buckets[s === 1 ? '1/day' : (s <= 3 ? '2–3/day' : '4+/day')]++;
  });
  document.getElementById('sessionStats').innerHTML =
    mstat('DAU', dau, 'active ref day') + mstat('WAU', wau, 'last 7 days') +
    mstat('MAU', mau, 'last 30 days') + mstat('Avg session', Math.round(sessSum / Math.max(1, sessN)) + 'm', 'mean');
  var max = 1;
  Object.keys(buckets).forEach(function(k){ if (buckets[k] > max) max = buckets[k]; });
  document.getElementById('sessionDist').innerHTML = Object.keys(buckets).map(function(k){
    var pct = Math.round((buckets[k] / d.ex.length) * 100);
    return '<div class="h-bar-row"><div class="h-bar-lbl">' + k + '</div>'
      + '<div class="h-bar-track"><div class="h-bar-fill" style="width:' + Math.round((buckets[k] / max) * 100) + '%"></div></div>'
      + '<div class="h-bar-val">' + buckets[k] + ' · ' + pct + '%</div></div>';
  }).join('');
}

function renderMoney(d){
  var premium = d.ex.filter(function(e){ return e.x.plan === 'premium'; }).length;
  var trial = d.ex.filter(function(e){ return e.x.plan === 'trial'; }).length;
  var funded = d.ex.reduce(function(s, e){ return s + e.x.funded; }, 0);
  var coinSpend = d.users.reduce(function(s, u){ return s + (+u.coinsSpent || 0); }, 0);
  var tips = d.users.reduce(function(s, u){ return s + (+u.tipsAmount || 0); }, 0);
  var payouts = d.users.reduce(function(s, u){ return s + (+u.payout || 0); }, 0);
  document.getElementById('moneyGrid').innerHTML =
    mstat('MRR', fmtMoney(premium * d.subPrice), premium + ' × $' + d.subPrice) +
    mstat('Trials', trial, 'convert to premium') +
    mstat('Wallet funding', fmtMoney(funded), 'top-ups') +
    mstat('Coin spend', fmtMoney(coinSpend), 'all users') +
    mstat('Tips volume', fmtMoney(tips), 'sent') +
    mstat('Author payouts', fmtMoney(payouts), 'earned') +
    mstat('Avg streak', (d.ex.reduce(function(s, e){ return s + (+e.u.streakDays || 0); }, 0) / Math.max(1, d.ex.length)).toFixed(1) + 'd', 'engagement') +
    mstat('Paying users', premium + trial, 'premium + trial');
}

function renderReferrals(d){
  var sent = d.ex.reduce(function(s, e){ return s + e.x.referralsSent; }, 0);
  var conv = d.ex.reduce(function(s, e){ return s + e.x.referralsConverted; }, 0);
  var rate = sent ? Math.round((conv / sent) * 100) : 0;
  var active = d.ex.filter(function(e){ return e.x.referralsSent > 0; }).length;
  document.getElementById('refFunnel').innerHTML =
    mstat('Invites sent', fmtNum(sent), 'all time') +
    mstat('Converted', fmtNum(conv), 'signed up') +
    mstat('Conv. rate', rate + '%', 'target ≥ 20%') +
    mstat('Referrers active', active, 'sent ≥ 1 invite');
  var top = topBy(d.ex, function(e){ return e.x.referralsConverted; }, 8);
  lbRefEntries = top;
  var refBody = document.getElementById('refTable');
  refBody.innerHTML = top.map(function(e, i){
    return lbRow(i, e.u, e.x.referralsConverted + ' conv · ' + e.x.referralsSent + ' sent', rowMeta(e.u, e.x, 'referrals'));
  }).join('');
  bindLbAccordion(refBody, function(){ return lbRefEntries; });
}

async function init(){
  global.SuperAdminSidebar.attach('#dashRoot', {
    activeItem: 'user-insights',
    title: 'User Insights',
    subtitle: 'Who your users are, what they read, and what they spend',
    user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
    notifCount: 9,
    searchPlaceholder: 'Search everything…'
  });
  var d = await fetchInsights();
  renderStats(d); renderBoard(d); renderGenres(d);
  renderSessions(d); renderMoney(d); renderReferrals(d);
  document.getElementById('lbTabs').addEventListener('click', function(e){
    var btn = e.target.closest('[data-lb]');
    if (!btn) return;
    activeLb = btn.dataset.lb;
    lbFilters.extra = 'all';
    document.querySelectorAll('#lbTabs .lb-tab').forEach(function(b){ b.classList.toggle('on', b === btn); });
    renderLbFilters();
    renderBoard(d);
  });
  document.getElementById('lbFilters').addEventListener('click', function(e){
    var btn = e.target.closest('[data-lf]');
    if (!btn) return;
    lbFilters[btn.dataset.lf] = btn.dataset.v;
    renderLbFilters();
    renderBoard(d);
  });
  renderLbFilters();
}

init();

})(window);
