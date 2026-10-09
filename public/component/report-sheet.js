/**
 * report-sheet.js — Droboard Shared Report Types (single source of truth)
 * ─────────────────────────────────────────────────────────────────
 * Both report menus read from here, so the predefined types can never
 * drift apart:
 *   - component/dots-menu.js          (posts / discussions sheet)
 *   - component/comment-section.js    (comment inline menu)
 *
 * Backend mirror: POST /api/reports reasons
 *   ['spam','harassment','hate','sexual','violence','misinformation',
 *    'copyright','other']
 *
 * USAGE:
 *   <script src="component/report-sheet.js"></script>  <!-- BEFORE the menus -->
 *   <script src="component/dots-menu.js"></script>
 *   <script src="component/comment-section.js"></script>
 *
 *   DroboardReportSheet.REPORT_TYPES  // [{id,label,icon}...]
 *   DroboardReportSheet.label('spam') // 'Spam or scam'
 *
 * Consumers that load without this file fall back to their own inline
 * copy (identical content), so nothing breaks — but keep the script
 * tag so edits happen in exactly one place.
 */
(function () {
  'use strict';
  if (window.DroboardReportSheet) return;

  const REPORT_TYPES = [
    { id: 'spam', label: 'Spam or scam', icon: 'fa-ban' },
    { id: 'harassment', label: 'Harassment or bullying', icon: 'fa-user-slash' },
    { id: 'hate', label: 'Hate speech', icon: 'fa-circle-exclamation' },
    { id: 'sexual', label: 'Sexual content', icon: 'fa-eye-slash' },
    { id: 'violence', label: 'Violence or threats', icon: 'fa-triangle-exclamation' },
    { id: 'misinformation', label: 'Misinformation', icon: 'fa-circle-question' },
    { id: 'copyright', label: 'Copyright violation', icon: 'fa-copyright' },
    { id: 'other', label: 'Something else', icon: 'fa-flag' },
  ];

  function label(id) {
    const t = REPORT_TYPES.find(x => x.id === id);
    return t ? t.label : String(id || '');
  }

  function valid(id) {
    return REPORT_TYPES.some(x => x.id === id);
  }

  window.DroboardReportSheet = { REPORT_TYPES, label, valid };
})();
