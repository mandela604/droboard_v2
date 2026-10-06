/* ===============================================================
   HELP-CENTER SERVICE — call-and-render only
   HTML calls HelpCenterService.init(). No inline logic in HTML.
   =============================================================== */
(function () {
  'use strict';

  function init() {
    document.querySelectorAll('.faq-item').forEach(function (it) {
      if (it._wired) return; it._wired = true;
      it.querySelector('.faq-q').addEventListener('click', function () { it.classList.toggle('open'); });
    });
  }

  window.HelpCenterService = { init: init };
})();
