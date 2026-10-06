/**
 * signed-contracts-service.js — Contract Details page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and point API_BASE at the real API
 * to fetch data via callBackend(); demo paths keep working with local data.
 */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    try {
      const res = await fetch(API_BASE + path, options || {});
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     TAB SWITCHING (visual only — Overview is the fully-built tab
     as shown in the reference design; other tabs just re-toggle
     state so the page still feels alive)
     ═══════════════════════════════════════════════════════════ */
  const TAB_LABELS = {
    overview: 'Overview',
    terms: 'Terms & Clauses',
    royalty: 'Royalty & Payment',
    files: 'Files',
    history: 'History',
    renewal: 'Renewal',
  };

  function bindTabs(){
    document.querySelectorAll('.doc-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const key = tab.dataset.tab;
        if (key !== 'overview') toast(`Opening ${TAB_LABELS[key]}…`);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     DOCUMENT VIEWER — page nav + zoom (visual only, single page
     of sample content is shown regardless of page number)
     ═══════════════════════════════════════════════════════════ */
  let currentPage = 1;
  let currentZoom = 100;
  const TOTAL_PAGES = 12;

  function changePage(delta){
    const next = currentPage + delta;
    if (next < 1 || next > TOTAL_PAGES) return;
    currentPage = next;
    document.getElementById('pgNow').textContent = currentPage;
  }

  function zoom(delta){
    const next = currentZoom + (delta * 10);
    if (next < 50 || next > 150) return;
    currentZoom = next;
    document.getElementById('zoomInd').textContent = currentZoom + '%';
    document.getElementById('docPage').style.transform = `scale(${currentZoom / 100})`;
  }

  // Markup onclick attributes reference these globals — re-expose.
  window.changePage = changePage;
  window.zoom = zoom;

  let _inited = false;

  function init(){
    /* ATTACH THE SHARED SHELL — sidebar + topbar wrap the content
       already inside #dashboardRoot above. */
    DroboardShell.attach('#dashboardRoot', {
      activeFile: 'signed-contracts.html',
      title: 'Contract Details',
      subtitle: 'View and manage this publishing agreement',
      user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
      notifCount: 8,
      hideSearch: true,
    });
    if (_inited) return;
    _inited = true;
    bindTabs();
    // Re-expose after init as well (in case enhanced scripts overwrote them).
    window.changePage = changePage;
    window.zoom = zoom;
  }

  window.SignedContractsService = { init: init };

})();
