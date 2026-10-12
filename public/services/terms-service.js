/* ===============================================================
   TERMS SERVICE — call-and-render only
   HTML calls TermsService.init(). No inline logic in HTML.
   =============================================================== */
(function () {
  'use strict';

  function init() {
    document.querySelectorAll('.tab').forEach(function (tb) {
      if (tb._wired) return; tb._wired = true;
      tb.addEventListener('click', function () {
        activate(tb.dataset.tab);
      });
    });
    // deep-link: terms.html#privacy opens the Privacy tab
    try {
      if ((location.hash || '').replace('#', '') === 'privacy') activate('privacy');
    } catch (e) {}
  }

  function activate(tab) {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === tab); });
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
    var panel = document.getElementById('panel-' + tab);
    if (panel) panel.classList.add('active');
  }

  window.TermsService = { init: init };
})();
