/**
 * reports-flags-service.js — Team story reports (Chief Editor scope)
 * READ-ONLY view of every book flagged by any senior editor, rendered as an
 * accordion via the shared ../component/reports-table.js (layout:'accordion').
 * Expanding a row reveals the editor who flagged it, the reason, type/
 * severity and the SE queue status. Resolution happens in the editor's own
 * module — the CE only watches. Senior-editor Book-Management flags mirror
 * into the same store, so they arrive here too.
 * reports-flags.html is shell only + ChiefStoryFlags.init().
 *
 * Going live: set USE_API=true in the component; endpoints:
 *   GET  /api/reports/story?scope=team
 */
(function(){
'use strict';

function seDirectory(){
  var map = {};
  try {
    var D = window.ChiefEditorData && window.ChiefEditorData.DEMO;
    if (D && Array.isArray(D.seniorEditors)) {
      D.seniorEditors.forEach(function(s){ map[s.id] = s.avatar; });
    }
  } catch (e){}
  return map;
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
      seAvatars: seDirectory(),
      canResolve: false,
      showSeFilter: true,
      pageSize: 8,
      onChange: renderStats
    });
  }
}

window.ChiefStoryFlags = { init: init };

})();
