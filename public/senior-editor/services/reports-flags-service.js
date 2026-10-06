/**
 * services/reports-flags-service.js — Story reports queue (Senior Editor scope)
 * Scope: viewing SE's own authors only — out-of-scope rows are never rendered.
 * Table UI lives in the shared ../component/reports-table.js component.
 * reports-flags.html is shell only + ReportsFlagsService.init().
 *
 * Going live: set USE_API=true in the component; endpoints:
 *   GET  /api/reports/story?seId=SE-01
 *   POST /api/reports/story/:id/resolve | /dismiss
 */
(function(){
'use strict';

// Viewing SE — matches the sidebar user. Only this SE's rows ever render.
const MY_SE_ID = 'SE-01';
const VIEWER_NAME = 'Chioma Reddy';

function setNum(id, v){
  var el = document.getElementById(id);
  if (el) el.textContent = v;
}
function renderStats(){
  if (!window.DroboardReportsTable) return;
  var s = window.DroboardReportsTable.stats([MY_SE_ID]);
  setNum('statTotal', s.total);
  setNum('statPending', s.pending);
  setNum('statResolved', s.resolved);
  setNum('statDismissed', s.dismissed);
  setNum('sumContent', s.byType.content);
  setNum('sumSpam', s.byType.spam);
  setNum('sumPlagiarism', s.byType.plagiarism);
  setNum('sumAbuse', s.byType.abuse);
  setNum('sumOther', s.byType.other);
}

function init(){
  SeniorEditorSidebar.attach('#dashboardRoot', {
    activeItem: 'reports-flags',
    title: 'Story Reports',
    subtitle: 'Review flags raised on your authors\u2019 stories',
    user: { name: 'Chioma Reddy', role: 'Senior Editor', avatar: 'https://i.pravatar.cc/100?img=5' },
    notifCount: 8,
    searchPlaceholder: 'Search by story, reporter, or ID...'
  });

  if (window.DroboardReportsTable) {
    window.DroboardReportsTable.attach('#reportsMount', {
      seIds: [MY_SE_ID],
      viewerName: VIEWER_NAME,
      canResolve: true,
      showSeFilter: false,
      pageSize: 6,
      onChange: renderStats
    });
  }
  renderStats();
}

function svcToast(m){ if(typeof window.toast==='function'){ try{ window.toast(m); return; }catch(e){} } }
function openReportSettings(){ return callBackend('/reports/settings').then(function(r){ if(!r) svcToast('Opening report settings…'); }); }

window.ReportsFlagsService = { init: init, openReportSettings: openReportSettings, scope: [MY_SE_ID] };

})();
