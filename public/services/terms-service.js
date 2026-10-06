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
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        tb.classList.add('active');
        document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
        document.getElementById('panel-' + tb.dataset.tab).classList.add('active');
      });
    });
  }

  window.TermsService = { init: init };
})();
