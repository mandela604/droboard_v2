/**
 * reports-flags-service.js — Team story reports (Chief Editor scope)
 * Aggregate of all flagged stories under the managed SEs, rendered with the
 * shared ../component/reports-table.js component (same card UI as SE).
 * Resolving here stamps the CE name and reflects in the SE queue instantly
 * (shared store) — no escalation step needed.
 * reports-flags.html is shell only + ChiefStoryFlags.init().
 *
 * Going live: set USE_API=true in the component; endpoints:
 *   GET  /api/reports/story?scope=team
 *   POST /api/reports/story/:id/resolve | /dismiss
 */
(function(){
'use strict';

const VIEWER_NAME = 'Adaeze Bello';

function managedSeIds(){
  try {
    var D = window.ChiefEditorData && window.ChiefEditorData.DEMO;
    if (D && Array.isArray(D.seniorEditors) && D.seniorEditors.length) {
      return D.seniorEditors.map(function(s){ return s.id; });
    }
  } catch (e){}
  return 'all';
}

function statCard(n, l, ico, bg, color){
  return '<div class="stat-card"><div class="stat-ico" style="background:' + bg + ';color:' + color + '"><i class="fas ' + ico + '"></i></div>'
    + '<div><div class="stat-num">' + n + '</div><div class="stat-lbl">' + l + '</div></div></div>';
}
function renderStats(seIds){
  if (!window.DroboardReportsTable) return;
  var s = window.DroboardReportsTable.stats(seIds);
  document.getElementById('statCards').innerHTML =
    statCard(s.total, 'Team Reports', 'fa-flag', 'var(--red-bg)', 'var(--red)')
    + statCard(s.pending, 'Pending Review', 'fa-clock', 'var(--amber-bg)', 'var(--amber)')
    + statCard(s.resolved, 'Resolved', 'fa-circle-check', 'var(--green-bg)', 'var(--green)')
    + statCard(s.dismissed, 'Dismissed', 'fa-rotate-left', 'var(--blue-bg)', 'var(--blue)');
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

  var seIds = managedSeIds();
  renderStats(seIds);
  if (window.DroboardReportsTable) {
    window.DroboardReportsTable.attach('#reportsMount', {
      seIds: seIds,
      viewerName: VIEWER_NAME,
      canResolve: true,
      showSeFilter: true,
      pageSize: 6,
      onChange: function(){ renderStats(seIds); }
    });
  }
}

window.ChiefStoryFlags = { init: init };

})();
