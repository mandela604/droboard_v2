/* ═══════════════════════════════════════════════════════════════
   CONTINUE READING — one self-contained component (CSS + markup + logic).

   Mount it anywhere with:
     ContinueReadingCard.render(el, data, { onOpen: (chapterN) => ... });

   `data` is the backend `continueReading` object + the chapter list, or an
   already-normalized card object. One card, one look, on every page.

   Rules:
   - Never read a book  -> Chapter 1, progress 0, "Not started yet".
   - Read + stopped at Ch5 -> Ch5, onOpen(resume) lands on Ch5 (no auto-advance).
   - Label: "P% complete · Ch X of Y" (or "Not started yet · Ch X of Y").
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.ContinueReadingCard) return;

  const CSS = `
.crc-card{background:linear-gradient(135deg,rgba(255,0,80,.08),rgba(255,0,80,.02)),var(--card,var(--surface,#17171d));border:1px solid var(--bd-acc,var(--bd,rgba(255,255,255,.12)));border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:transform .15s,filter .15s}
.crc-card:hover{filter:brightness(1.06)}
.crc-card:active{transform:scale(.99)}
.crc-icon{width:40px;height:40px;border-radius:10px;background:var(--acc,#ff0050);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.crc-body{flex:1;min-width:0}
.crc-label{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--acc,#ff0050)}
.crc-title{font-size:12px;font-weight:700;color:var(--tx-high,var(--tx,#f2f2f5));margin:2px 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.crc-bar{height:3px;background:var(--bg2,rgba(255,255,255,.08));border-radius:3px;overflow:hidden}
.crc-fill{height:100%;background:linear-gradient(90deg,var(--acc,#ff0050),var(--acc2,#ff4d7a));border-radius:3px;transition:width .4s}
.crc-meta{display:flex;justify-content:space-between;gap:8px;margin-top:5px;font-size:9px;color:var(--tx-muted,var(--muted,#8a8a95))}
.crc-arrow{font-size:14px;color:var(--acc,#ff0050);flex-shrink:0}
[data-theme="light"] .crc-card{background:linear-gradient(135deg,rgba(255,0,80,.05),transparent),var(--card,#fff)}
[data-theme="light"] .crc-title{color:var(--tx-high,#17151b)}
[data-theme="light"] .crc-bar{background:rgba(0,0,0,.08)}`;

  function injectStyles() {
    if (document.getElementById('crc-style')) return;
    const s = document.createElement('style');
    s.id = 'crc-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function normalize(cr, chapters) {
    const list = Array.isArray(chapters) ? chapters : [];
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
      totalChapters: list.length,
    };
  }

  function labels(d) {
    const of = d.totalChapters ? ' · Ch ' + d.chapterN + ' of ' + d.totalChapters : '';
    // Derive from the raw numbers, never trust a possibly-stale `started` flag.
    const started = !!(d.started || (Number(d.chaptersRead) || 0) > 0 || (Number(d.progress) || 0) > 0);
    return {
      title: 'Ch' + d.chapterN + ' — ' + d.chapterTitle,
      meta: (started ? d.progress + '% complete' : 'Not started yet') + of,
      sub: started ? 'Keep reading' : 'Start reading',
      width: (d.progress || 0) + '%',
    };
  }

  // Render the full self-contained card into `mount`. onOpen(chapterN) fires on tap.
  function render(mount, data, opts) {
    if (!mount) return null;
    injectStyles();
    const d = data || normalize(null, []);
    const L = labels(d);
    mount.innerHTML =
      '<div class="crc-card" role="button" tabindex="0">' +
        '<div class="crc-icon">📖</div>' +
        '<div class="crc-body">' +
          '<div class="crc-label">Continue Reading</div>' +
          '<div class="crc-title">' + esc(L.title) + '</div>' +
          '<div class="crc-bar"><div class="crc-fill" style="width:' + esc(L.width) + '"></div></div>' +
          '<div class="crc-meta"><span class="crc-pct">' + esc(L.meta) + '</span>' +
            '<span class="crc-sub">' + esc(L.sub) + '</span></div>' +
        '</div>' +
        '<div class="crc-arrow">→</div>' +
      '</div>';
    const card = mount.firstElementChild;
    const open = function () { if (opts && typeof opts.onOpen === 'function') opts.onOpen(d.chapterN); };
    card.addEventListener('click', open);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    return d;
  }

  window.ContinueReadingCard = { normalize, labels, render };
})();
