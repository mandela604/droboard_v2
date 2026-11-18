/* ═══════════════════════════════════════════════════════════════
   CONTINUE READING — one component for bridge.html + book-reader.html.

   Both pages used to normalize the same backend `continueReading` payload
   twice and print different labels. This owns the single source of truth:
   normalize once, label once, fill whichever markup the host page uses.

   Rules:
   - Never read a book  -> Chapter 1, progress 0, "Not started yet".
   - Read + stopped at Ch5 -> Ch5, clicking resumes Ch5 (no auto-advance).
   - Label is always "P% complete · Ch X of Y" (or "Not started yet · Ch X of Y").
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.ContinueReadingCard) return;

  function normalize(cr, chapters) {
    const list = Array.isArray(chapters) ? chapters : [];
    const total = list.length;
    const pct = Math.min(100, Math.max(0, Number(cr && cr.pct) || 0));
    const read = Number(cr && cr.chaptersRead) || 0;
    const byId = cr && list.find(c => String(c.id) === String(cr.chapterId));
    const byNum = cr && cr.chapterN != null && list.find(c => Number(c.n) === Number(cr.chapterN));
    const row = byId || byNum || null;
    const chapterN = row ? Number(row.n) : (Number(cr && cr.chapterN) || 1);
    return {
      chapterN,
      chapterId: (cr && cr.chapterId) || (row && row.id) || null,
      chapterTitle: (row && (row.title || row.chapterTitle)) || (cr && cr.title) || ('Chapter ' + chapterN),
      progress: pct,
      started: read > 0 || pct > 0 || !!(cr && cr.started),
      chaptersRead: read,
      totalChapters: total,
    };
  }

  function labels(d) {
    const of = d.totalChapters ? ' · Ch ' + d.chapterN + ' of ' + d.totalChapters : '';
    return {
      title: 'Ch' + d.chapterN + ' — ' + d.chapterTitle,
      meta: (d.started ? d.progress + '% complete' : 'Not started yet') + of,
      sub: d.started ? 'Keep reading' : 'Start reading',
      width: (d.progress || 0) + '%',
    };
  }

  // Fill the host page's existing nodes. `els` = { title, meta, sub, bar }.
  function render(els, d) {
    const L = labels(d);
    if (els.title) els.title.textContent = L.title;
    if (els.meta) els.meta.textContent = L.meta;
    if (els.sub) els.sub.textContent = L.sub;
    if (els.bar) els.bar.style.width = L.width;
    return d;
  }

  window.ContinueReadingCard = { normalize, labels, render };
})();
