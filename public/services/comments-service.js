/* ═══════════════════════════════════════════════════════════════
   COMMENTS SERVICE
   Full comments page orchestration. HTML calls CommentsPage.init().

   Opened from the "View all ›" link next to "Tag your side" in both
   readers (?story=<id>&ch=<n>). Seeds come from the same sources the
   readers use (comments-data.js, then FULL_STORY.comments), so this
   page shows the same thread. The list flex-scrolls with the composer
   pinned at the bottom (fillHeight mode).
   When going live: swap seed reads for GET /api/stories/<id>/comments.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const THEME_KEY = 'droboardTheme';

  function toast(msg, dur) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), dur || 2200);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtN(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

  function qs() { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); } }
  function storyParam() { try { return qs().get('story') || ''; } catch (e) { return ''; } }
  function chParam() { try { const n = parseInt(qs().get('ch'), 10); return isNaN(n) ? 0 : n; } catch (e) { return 0; } }

  function resolveStory() {
    const sid = storyParam();
    const D = window.DemoData || {};
    if (D.FULL_STORY && (!sid || String(D.FULL_STORY.id) === String(sid))) return D.FULL_STORY;
    const hit = ((D.STORIES || [])).find(s => String(s.id) === String(sid));
    if (hit) {
      return {
        id: hit.id, title: hit.title, category: hit.cat || hit.genre || '',
        cover: hit.cover || '', author: { name: hit.author || '', avatar: hit.authorAv || '' },
        comments: [],
      };
    }
    if (D.FULL_STORY) return D.FULL_STORY;
    return { id: sid || 'story', title: 'Story', category: '', cover: '', author: { name: 'Writer', avatar: '' }, comments: [] };
  }

  function mapSeedComment(c) {
    return Object.assign({}, c, {
      statusRing: (c.statusRing || 'none').replace('ring-', ''),
      replies: (c.replies || []).map(mapSeedComment),
    });
  }
  function countAll(list) {
    return (list || []).reduce((n, c) => n + 1 + countAll(c.replies || []), 0);
  }

  /* ── Theme: component re-themes off body.theme-white ── */
  function initTheme() {
    let t = 'light';
    try { t = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) {}
    try {
      const rt = localStorage.getItem('dro_reader_theme');
      if (rt === 'theme-white') t = 'light';
      else if (rt && rt !== 'theme-white') t = 'dark';
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    document.body.classList.toggle('theme-white', t === 'light');
  }

  function pageUrl() {
    return 'comments.html?story=' + encodeURIComponent(storyParam()) + '&ch=' + chParam();
  }

  async function init() {
    initTheme();
    window.toast = toast;
    const FS = resolveStory();
    const chN = chParam();
    const sid = FS.id || storyParam();

    document.getElementById('backBtn').addEventListener('click', () => {
      if (window.history.length > 1) window.history.back();
      else location.href = 'full-reader.html?story=' + encodeURIComponent(sid) + (chN ? '&ch=' + chN : '');
    });

    const author = FS.author || {};
    document.title = 'Comments · ' + (FS.title || 'Story') + ' · DroBoard';
    // Title block lives at the top of the scroll flow (scrolls away).
    const byLine = author.name
      ? 'by ' + author.name + (chN ? ' · Ch ' + chN : '')
      : (chN ? 'Chapter ' + chN : '');
    const headHtml =
      '<div class="story-strip">' +
      (FS.cover ? '<img class="story-strip-cover" src="' + esc(FS.cover) + '" alt=""/>' : '') +
      '<div class="story-strip-body"><div class="story-strip-title">' + esc(FS.title || 'Story') + '</div>' +
      (byLine ? '<div class="story-strip-by">' + esc(byLine) + '</div>' : '') +
      '</div></div>';

    const raw = (typeof COMMENTS_DATA !== 'undefined' && COMMENTS_DATA.length) ? COMMENTS_DATA : (FS.comments || []);
    const SEED = raw.map(mapSeedComment);
    const sub = document.getElementById('pageSub');
    if (sub) sub.textContent = fmtN(countAll(SEED)) + ' comments';

    const TEAMS = (window.DemoData && window.DemoData.READER_TEAMS) || [];
    if (!window.DroboardComments) {
      document.getElementById('commentsMount').innerHTML =
        '<div style="padding:40px 20px;text-align:center;font-size:13px;color:var(--tx-muted)">comment-section.js missing</div>';
      return;
    }
    DroboardComments.attach('#commentsMount', {
      storyId: sid,
      title: fmtN(countAll(SEED)) + ' comments',
      comments: SEED,
      teams: TEAMS,
      currentUser: { name: 'You', avatar: null, team: null },
      requireTeam: false,
      collapsible: false,
      startOpen: true,
      fillHeight: true, // body scrolls (header + teams scroll away), composer pinned
      headerHtml: headHtml,
      getCommentUrl: (c) => pageUrl() + '#comment-' + (c && c.id),
      onPost: (c) => console.log('posted', c),
      onReply: (parentId, c) => console.log('replied to', parentId, c),
      onEdit: (c, oldText, newText) => console.log('edited', c.id, oldText, '->', newText),
      onProfileClick: (c) => { if (c && c.name) location.href = 'profile.html?u=' + encodeURIComponent(c.name); },
    });
  }

  window.CommentsPage = { init };
})();
