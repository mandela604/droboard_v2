/**
 * reports-flags-service.js — Team story reports (Chief Editor scope)
 * Wired to backend: GET /api/chief/reports/story?seId=...&status=pending
 * Single data source, no demo fallback.
 */
(function(){
'use strict';

const API_BASE = '/api/chief';
async function callBackend(path, opts){
  const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, opts || {}));
  if(!res.ok) throw new Error('Backend error: ' + res.status);
  return res.json();
}

function statCard(n, l, ico, bg, color){
  return '<div class="stat-card"><div class="stat-ico" style="background:' + bg + ';color:' + color + '"><i class="fas ' + ico + '"></i></div>'
    + '<div><div class="stat-num">' + n + '</div><div class="stat-lbl">' + l + '</div></div></div>';
}

function renderStats(){
  if (!window.DroboardReportsTable) return;
  var list = window.DroboardReportsTable.getScoped('all').filter(function(r){ return r.status === 'pending'; });
  var sev = function(s){ return list.filter(function(r){ return r.severity === s; }).length; };
  document.getElementById('statCards').innerHTML =
    statCard(list.length, 'Flagged Books', 'fa-flag', 'var(--red-bg)', 'var(--red)')
    + statCard(sev('high'), 'High Severity', 'fa-triangle-exclamation', 'var(--red-bg)', 'var(--red)')
    + statCard(sev('medium'), 'Medium Severity', 'fa-circle-half-stroke', 'var(--amber-bg)', 'var(--amber)')
    + statCard(sev('low'), 'Low Severity', 'fa-circle-info', 'var(--blue-bg)', 'var(--blue)');
}

function init(){
  ChiefEditorSidebar.attach('#dashRoot', {
    activeItem: 'reports-flags',
    title: 'Story Reports',
    subtitle: 'Flagged stories across your senior editors',
    user: { name: 'Adaeze Bello', role: 'Chief Editor', avatar: 'https://i.pravatar.cc/100?img=9' },
    notifCount: 6,
    searchPlaceholder: 'Search anything…'
  });

  renderStats();
  if (window.DroboardReportsTable) {
    window.DroboardReportsTable.attach('#reportsMount', {
      seIds: 'all',
      layout: 'accordion',
      pendingOnly: true,
      canResolve: false,
      showSeFilter: true,
      pageSize: 8,
      onChange: renderStats
    });
  }
}

window.ChiefStoryFlags = { init: init };

})();
