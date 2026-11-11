/**
 * user-insights-service.js — Data + controller for User Insights page
 * user-insights.html is shell only + mounts; everything renders here.
 *
 * Live: fetchInsights() reads the backend against:
 *   GET /api/insights/overview  (kpis, genre affinity, sessions, money, referrals)
  *   GET /api/insights/leaderboard?type=tips|readtime|referrals|streaks&role=&extra=
 * Backend event taxonomy (to build first): session.start/end, read.chapter_finished,
 * tip.sent, wallet.funded, coins.spent, subscription.started/cancelled,
 * referral.sent/converted. No HTML change needed.
 * Units: tips sent / coin spend are COINS (tipsCoins, coinsSpent). Funded and
 * payouts are naira (fundedNGN, payout, tipsReceivedNGN). Use coins() for the
 * first group and fmtNGN() for the second — never the same formatter for both.
 */
(function(global){
'use strict';

/* user-insights-service.js — User Insights page */

const USE_API = true;
const API_BASE = '/api/super-admin/insights';

function fmtNum(n){
  n = +n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}
function fmtNGN(n){ if (window.DroboardCurrency && DroboardCurrency.ngnToMoney) return DroboardCurrency.ngnToMoney(n); return '₦' + fmtNum(n); }
function coins(n){ if (window.DroboardCurrency && DroboardCurrency.coins) return DroboardCurrency.coins(n); return fmtNum(n) + ' coins'; }
function fmtUSD(n){ if (window.DroboardCurrency && DroboardCurrency.usdToMoneyShort) return DroboardCurrency.usdToMoneyShort(n); return '$' + fmtNum(n); }
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function dayDiff(a, b){
  try { return Math.floor((new Date(a) - new Date(b)) / 86400000); } catch (e){ return 9999; }
}

async function fetchInsights(){
  var token = null;
  try {
    token = localStorage.getItem('droboard_session') || localStorage.getItem('dro_access');
  } catch (e) {}
  var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
  var r = await fetch(API_BASE + '/overview', { credentials: 'include', headers: headers });
  if (!r.ok) {
    var body = null;
    try { body = await r.json(); } catch (e) {}
    var code = (body && (body.error || body.code)) || '';
    var e2 = new Error('HTTP ' + r.status + (code ? ' · ' + code : ''));
    e2.status = r.status;
    throw e2;
  }
  return r.json();
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
  var href = '../Pages/profile.html?id=' + esc(u.id);
  return '<div class="lb-row" data-lbid="' + esc(u.id) + '"><span class="lb-rank">' + (i + 1) + '</span>'
    + '<img class="lb-av" src="' + esc(u.avatar || '') + '" alt=""/>'
    + '<span class="lb-text"><a href="' + href + '" class="lb-name-link"><span class="lb-name">' + esc(u.name) + ' <span class="lb-role ' + roleClass(u.role) + '">· ' + esc(u.role || '') + '</span></span></a>'
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
    + lbMeta('Tips sent', coins(u.tipsCoins)) + (+u.tipsReceivedNGN ? lbMeta('Tips received', fmtNGN(u.tipsReceivedNGN)) : '')
    + lbMeta('Coin spend', coins(u.coinsSpent))
    + lbMeta('Referrals', x.referralsConverted + ' / ' + x.referralsSent + ' (' + rate + '%)')
    + lbMeta('Funded', fmtNGN(x.funded))
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
  var tips = d.users.reduce(function(s, u){ return s + (+u.tipsCoins || 0); }, 0);
  
  function kpiCard(label, value, icon, bgColor, colorName) {
    var colorVar = 'var(--' + colorName + ')';
    return '<div class="stat-card" style="background:#fff;border:1px solid var(--border);box-shadow:var(--shadow)">'
      + '<div class="stat-ico" style="background:' + bgColor + ';color:' + colorVar + '"><i class="fas ' + icon + '"></i></div>'
      + '<div><div class="stat-num" style="color:' + colorVar + '">' + value + '</div><div class="stat-lbl">' + label + '</div></div></div>';
  }
  
  document.getElementById('statCards').innerHTML = [
    kpiCard('Tracked users', d.users.length, 'fa-users', 'rgba(47,125,225,.12)', 'blue'),
    kpiCard('Premium subscribers', premium, 'fa-crown', 'rgba(212,160,23,.12)', 'gold'),
    kpiCard('Referral conversions', fmtNum(refConv), 'fa-user-plus', 'rgba(22,163,74,.12)', 'green'),
    kpiCard('Tips sent', coins(tips), 'fa-coins', 'rgba(217,119,6,.12)', 'amber')
  ].join('');
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
  if (activeLb === 'tips') entries = topBy(pool, function(e){ return +e.u.tipsCoins || 0; });
  else if (activeLb === 'readtime') entries = topBy(pool, function(e){ return +e.u.readingHours || 0; });
  else if (activeLb === 'referrals') entries = topBy(pool, function(e){ return e.x.referralsConverted; });
  else entries = topBy(pool, function(e){ return +e.u.streakDays || 0; });
  lbBoardEntries = entries;
  if (activeLb === 'tips') rows = entries.map(function(e, i){ return lbRow(i, e.u, coins(e.u.tipsCoins), rowMeta(e.u, e.x, 'tips')); });
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
  var tips = d.users.reduce(function(s, u){ return s + (+u.tipsCoins || 0); }, 0);
  var tipsToAuthors = d.users.reduce(function(s, u){ return s + (+u.tipsReceivedNGN || 0); }, 0);
  var payouts = d.users.reduce(function(s, u){ return s + (+u.payout || 0); }, 0);
  
  function moneyRow(label, val, sub, cls) {
    var colorVar = 'var(--' + cls + ')';
    return '<div class="m-stat" style="border-bottom:1px solid var(--border)">'
      + '<span>' + label + '</span><b style="color:' + colorVar + '">' + val + '</b>' + (sub ? '<small>' + sub + '</small>' : '')
      + '</div>';
  }
  document.getElementById('moneyGrid').innerHTML =
    moneyRow('MRR', fmtUSD(premium * d.subPrice), premium + ' × $' + d.subPrice, 'green') +
    moneyRow('Trials', trial, 'convert to premium', 'amber') +
    moneyRow('Wallet funding', fmtNGN(funded), 'top-ups', 'blue') +
    moneyRow('Coin spend', coins(coinSpend), 'all users', 'purple') +
    moneyRow('Tips sent', coins(tips), 'coins out', 'gold') +
    moneyRow('Tips to authors', fmtNGN(tipsToAuthors), 'naira in', 'green') +
    moneyRow('Author payouts', fmtNGN(payouts), 'earned', 'purple') +
    moneyRow('Avg streak', (d.ex.reduce(function(s, e){ return s + (+e.u.streakDays || 0); }, 0) / Math.max(1, d.ex.length)).toFixed(1) + 'd', 'engagement', 'amber') +
    moneyRow('Paying users', premium + trial, 'premium + trial', 'blue');
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
  var d;
  try {
    d = await fetchInsights();
    renderStats(d); renderBoard(d); renderGenres(d);
    renderSessions(d); renderMoney(d); renderReferrals(d);
  } catch (err) {
    var sc = document.getElementById('statCards');
    if (sc) sc.innerHTML = '<div class="empty-state" style="color:var(--red)"><i class="fas fa-circle-exclamation"></i> Failed to load insights: ' + esc(err.message) + '</div>';
    return;
  }
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
