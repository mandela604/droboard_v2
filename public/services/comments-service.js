/* ═══════════════════════════════════════════════════════════════
   COMMENTS SERVICE
   Full comments page orchestration. HTML calls CommentsPage.init().
   Wired to GET /api/comments and POST /api/comments.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';
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

  function countAll(list) {
    return (list || []).reduce((n, c) => n + 1 + countAll(c.replies || []), 0);
  }

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

  // The live transport lives in the shared component (comment-section.js) so
  // the reader pages and this page read and write comments the same way.
  function shapeComment(c) {
    return (window.DroboardComments && window.DroboardComments.api)
      ? window.DroboardComments.api.shapeComment(c)
      : c;
  }

  async function fetchComments(sid, chN) {
    return window.DroboardComments.api.fetchComments({ storyId: sid, chapterId: chN || '', limit: 50 });
  }

  async function postComment({ sid, chN, text, parentId, team }) {
    return window.DroboardComments.api.postComment({ storyId: sid, chapterId: chN || '', text, parentId, team });
  }

  async function init() {
    initTheme();
    window.toast = toast;
    const sid = storyParam();
    const chN = chParam();

    if (!sid) {
      document.getElementById('commentsMount').innerHTML =
        '<div style="padding:40px 20px;text-align:center;font-size:13px;color:var(--tx-muted)">No story specified.</div>';
      return;
    }

    document.getElementById('backBtn').addEventListener('click', () => {
      if (window.history.length > 1) window.history.back();
      else location.href = 'full-reader.html?story=' + encodeURIComponent(sid) + (chN ? '&ch=' + chN : '');
    });

    if (!window.DroboardComments) {
      document.getElementById('commentsMount').innerHTML =
        '<div style="padding:40px 20px;text-align:center;font-size:13px;color:var(--tx-muted)">comment-section.js missing</div>';
      return;
    }

    // Show loading state
    document.getElementById('commentsMount').innerHTML =
      '<div style="padding:40px 20px;text-align:center;font-size:13px;color:var(--tx-muted)"><i class="fas fa-spinner fa-spin"></i> Loading comments…</div>';

    let comments = [];
    try {
      comments = await fetchComments(sid, chN);
    } catch (err) {
      document.getElementById('commentsMount').innerHTML =
        '<div style="padding:40px 20px;text-align:center;font-size:13px;color:var(--tx-muted)">Could not load comments: ' + (err.message || 'network error') + '</div>';
      return;
    }

    const sub = document.getElementById('pageSub');
    if (sub) sub.textContent = fmtN(countAll(comments)) + ' comments';

    // Need to fetch story meta for the header strip
    let storyTitle = '', storyCover = '', storyAuthor = '';
    try {
      const bRes = await fetch(API_BASE + '/books/' + encodeURIComponent(sid), { credentials: 'include' });
      if (bRes.ok) {
        const b = await bRes.json();
        storyTitle = b.title || '';
        storyCover = b.cover || '';
        storyAuthor = (b.writer && b.writer.name) || '';
      }
    } catch (e) {}

    document.title = 'Comments · ' + (storyTitle || 'Story') + ' · DroBoard';
    const byLine = storyAuthor
      ? 'by ' + storyAuthor + (chN ? ' · Ch ' + chN : '')
      : (chN ? 'Chapter ' + chN : '');
    const headHtml =
      '<div class="story-strip">' +
      (storyCover ? '<img class="story-strip-cover" src="' + esc(storyCover) + '" alt=""/>' : '') +
      '<div class="story-strip-body"><div class="story-strip-title">' + esc(storyTitle || 'Story') + '</div>' +
      (byLine ? '<div class="story-strip-by">' + esc(byLine) + '</div>' : '') +
      '</div></div>';

    DroboardComments.attach('#commentsMount', {
      storyId: sid,
      chapterId: chN ? String(chN) : undefined,
      title: fmtN(countAll(comments)) + ' comments',
      comments,
      teams: [],
      currentUser: { name: 'You', avatar: null, team: null },
      requireTeam: false,
      collapsible: false,
      startOpen: true,
      adsFirst: false,
      fillHeight: true,
      headerHtml: headHtml,
      getCommentUrl: (c) => pageUrl() + '#comment-' + (c && c.id),
      onPost: async (c) => {
        try {
          const saved = await postComment({ sid, chN, text: c.text, parentId: c.parentId, team: c.team });
          return saved;
        } catch (err) {
          toast(err.message || 'Could not post comment');
          throw err;
        }
      },
      onReply: async (parentId, c) => {
        try {
          return await postComment({ sid, chN, text: c.text, parentId, team: c.team });
        } catch (err) {
          toast(err.message || 'Could not post reply');
          throw err;
        }
      },
      onEdit: (c, oldText, newText) => {
        window.DroboardComments.api.editComment(c.id, newText).catch(() => toast('Could not save edit'));
      },
      onProfileClick: (c) => { if (c && c.name) location.href = 'profile.html?u=' + encodeURIComponent(c.name); },
    });
  }

  window.CommentsPage = { init };
})();
