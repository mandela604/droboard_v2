/**
 * earnings-overview-service.js — Earnings Overview page logic (pure call-and-render).
 * Live API only. No demo data: every number rendered here comes from the
 * backend, and failures show an honest error/empty state.
 */
(function () {
'use strict';

const USE_API = true;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

function money(n) {
  if (window.DroboardCurrency && DroboardCurrency.usdToMoney) return DroboardCurrency.usdToMoney(n);
  return typeof n === 'string' ? n : '$' + Number(n || 0).toLocaleString('en-US');
}
function num(n) { return Number(n) || 0; }

/* Real stats from the backend. No monthly series is exposed by the API, so
   the chart area shows a plain statement instead of invented bars. */
function renderStats(ov, sum) {
  const el = document.getElementById('overviewStats'); if (!el) return;
  const lifetime = num(ov && ov.lifetime) || num(sum && sum.earned) || 0;
  const pending = num(ov && ov.pending) || num(sum && sum.pendingPayout) || 0;
  const available = num(sum && sum.available) || 0;
  const cards = [
    { l: 'Lifetime earnings', v: money(lifetime), c: 'var(--green)' },
    { l: 'Pending payout', v: money(pending), c: 'var(--accent)' },
    { l: 'Available balance', v: money(available), c: 'var(--blue)' },
  ];
  el.innerHTML = cards.map(s => '<div class="stat-card"><div class="num" style="color:' + s.c + '">' + s.v + '</div><div class="lbl">' + s.l + '</div></div>').join('');
}

function renderChartEmpty() {
  const c = document.getElementById('earningsChart'); if (!c) return;
  c.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:24px;font-size:12px">Earnings trend appears once monthly data is available.</div>';
}

function renderTopEarners() {
  const el = document.getElementById('topEarners'); if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:20px">No top-earner data yet.</div>';
}

async function init() {
  (async function () {
    const user = await (window.SeniorEditorGetUser || (async () => null))();
    SeniorEditorSidebar.attach('#dashboardRoot', { activeItem: 'earnings-overview', title: 'Earnings Overview', subtitle: 'Track platform revenue, author payouts and earnings trends', user: null, notifCount: 0, hideSearch: true });
  })();
  try {
    const [ov, sum] = await Promise.all([
      callBackend('/earnings-overview'),
      callBackend('/earnings/summary'),
    ]);
    renderStats(ov, sum);
  } catch (e) {
    const el = document.getElementById('overviewStats');
    if (el) el.innerHTML = '<div style="text-align:center;color:var(--red);padding:20px">Could not load earnings — ' + String(e && e.message || e) + '</div>';
  }
  renderChartEmpty();
  renderTopEarners();
}

function svcToast(m) { if (typeof window.toast === 'function') { try { window.toast(m); return; } catch (e) {} } }
function downloadCsv(path, filename, failMsg) {
  return fetch(API_BASE + path, { method: 'POST', credentials: 'include' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var cd = res.headers.get('Content-Disposition') || '';
      var m = /filename="?([^";]+)"?/.exec(cd);
      return res.blob().then(function (blob) { return { blob: blob, name: (m && m[1]) || filename }; });
    })
    .then(function (x) {
      var url = URL.createObjectURL(x.blob);
      var a = document.createElement('a'); a.href = url; a.download = x.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      svcToast('CSV downloaded');
    })
    .catch(function (e) { console.warn('[export] failed', e); svcToast(failMsg); });
}
function exportReport() { return downloadCsv('/earnings/export', 'earnings-overview.csv', 'Export failed — is the backend reachable?'); }
function openDetailedAnalytics() { return callBackend('/earnings/analytics').catch(function (e) { svcToast(String(e && e.message || e)); }); }
function openFullLeaderboard() { return callBackend('/earnings/leaderboard').catch(function (e) { svcToast(String(e && e.message || e)); }); }

window.EarningsOverviewService = { init: init, exportReport: exportReport, openDetailedAnalytics: openDetailedAnalytics, openFullLeaderboard: openFullLeaderboard };

})();
