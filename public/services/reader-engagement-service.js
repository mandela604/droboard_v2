/* ===============================================================
   READER ENGAGEMENT SERVICE — shared polls + predictions + author note
   for full-reader and scroll-reader.
   Polls/predictions render as accordions (collapsed by default).
   Author note renders below content when present.
   Live source: GET /api/stories/:bookId/chapters/:chapterId/engagement
   (poll / prediction / debate / authorNote / myVotes).
   Votes: POST .../poll/vote, .../prediction/vote, .../debate/vote.
   Nothing is invented here — a chapter without a poll shows no poll.
=============================================================== */
(function () {
  'use strict';

  var API_BASE = (window.AuthorApiConfig && window.AuthorApiConfig.API_BASE) || '/api';

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmtN(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  // Theme-aware palette: dark unless the reader body is explicitly white.
  function darkTheme() {
    try { return (document.body.className || '').indexOf('theme-white') === -1; }
    catch (e) { return false; }
  }
  function pal() {
    if (darkTheme()) return {
      body: '#232329', hair: 'rgba(255,255,255,.12)',
      card: 'var(--surface, #16161c)', cardBd: 'rgba(255,255,255,.08)',
      title: '#f2f2f5', chevron: 'rgba(255,255,255,.6)',
      optPoll: '#2e2e38', optPollVoted: '#4a2333',
      optPred: '#2c2a3c', optPredVoted: '#3d2f5e',
      deb: '#2e2e38', debFor: '#23483a', debAg: '#55262e',
      ink: '#f2f2f5', sub: 'rgba(255,255,255,.55)'
    };
    return {
      body: '#FAF7F3', hair: 'rgba(0,0,0,.08)',
      card: 'var(--surface, #ffffff)', cardBd: 'rgba(255,255,255,.10)',
      title: '#161616', chevron: 'rgba(0,0,0,.45)',
      optPoll: '#FCE9F0', optPollVoted: '#ffe0e9',
      optPred: '#E7DCFA', optPredVoted: '#e9e2fb',
      deb: '#ffffff', debFor: '#e9f7ef', debAg: '#fde7ea',
      ink: '#17151b', sub: 'rgba(0,0,0,.55)'
    };
  }

  // ── data ──────────────────────────────────────────────────────────────
  // key -> { poll, prediction, debate, authorNote, myVotes }
  var cache = {};
  // key -> { bookId, chapterId } when the data came from the backend
  var liveInfo = {};
  // key -> page-supplied overrides (a page that already holds the rows)
  var overrides = {};

  function getVotes(key) { return (cache[key] && cache[key].myVotes) || {}; }
  function votedIndex(key, kind) {
    var v = getVotes(key)[kind];
    return (v !== undefined && v >= 0) ? v : -1;
  }
  // Open state is session-only: every page load starts collapsed.
  var sessionOpen = {};
  function isOpen(key, kind) { return !!sessionOpen[key + ':' + kind]; }
  function setOpen(key, kind, open) { sessionOpen[key + ':' + kind] = !!open; }

  function accordionShell(key, kind, icon, title, sub, bodyHtml) {
    var open = isOpen(key, kind);
    var P = pal();
    return '<div class="re-eng-card" style="background:' + P.card + ';border:1px solid ' + P.cardBd + ';border-radius:14px;overflow:hidden;margin:14px 0">'
      + '<div onclick="ReaderEngagement.toggle(\'' + key + '\',\'' + kind + '\')" style="padding:12px 14px;display:flex;align-items:center;gap:8px;cursor:pointer">'
      + '<span style="font-size:14px">' + icon + '</span>'
      + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:800;color:' + P.title + '">' + title + '</div>'
      + '<div style="font-size:10px;color:' + P.sub + '">' + sub + '</div></div>'
      + '<i class="fas fa-chevron-down" style="font-size:11px;color:' + P.chevron + ';transform:rotate(' + (open ? '180deg' : '0deg') + ');transition:.2s"></i></div>'
      + '<div style="display:' + (open ? 'block' : 'none') + '">' + bodyHtml + '</div></div>';
  }

  function pollBody(key, poll) {
    var P = pal();
    var tot = poll.opts.reduce(function (s, o) { return s + o.v; }, 0) || 1;
    var voted = votedIndex(key, 'poll');
    return '<div class="re-poll-body" style="background:' + P.body + ';border-radius:0 0 12px 12px;padding-bottom:4px">'
      + '<div style="margin:2px 14px 0;border-top:1px solid ' + P.hair + '"></div>'
      + '<div style="padding:10px 14px;font-size:13px;font-weight:700;color:' + P.ink + '">' + esc(poll.q) + '</div>'
      + '<div style="padding:0 14px 6px">' + poll.opts.map(function (o, i) {
        var pct = Math.round(o.v / tot * 100);
        var locked = voted >= 0, isMine = locked && voted === i;
        var cardBg = isMine ? P.optPollVoted : P.optPoll;
        var dim = (locked && !isMine) ? 'opacity:.5;' : '';
        var cur = locked ? 'cursor:default;' : 'cursor:pointer;';
        return '<div onclick="event.stopPropagation();ReaderEngagement.votePoll(\'' + key + '\',' + i + ')" style="position:relative;background:' + cardBg + ';border-radius:10px;padding:10px 12px;overflow:hidden;border:1.5px solid ' + (isMine ? '#ff0050' : 'var(--bd,rgba(255,255,255,.1))') + ';margin-bottom:7px;' + dim + cur + '">'
          + '<div style="position:absolute;left:0;top:0;bottom:0;background:rgba(255,0,80,.09);width:' + pct + '%"></div>'
          + '<div style="position:relative;display:flex;justify-content:space-between;gap:8px"><span style="font-size:12px;font-weight:600;color:' + P.ink + '">' + esc(o.t) + '</span><span style="font-size:11px;font-weight:800;color:#ff4d7a">' + pct + '%</span></div></div>';
      }).join('') + '</div>'
      + '<div style="padding:8px 14px;font-size:10px;color:' + P.sub + ';display:flex;justify-content:space-between"><span>' + fmtN(tot) + ' votes</span><span>' + (voted >= 0 ? 'Vote counted' : 'Tap to vote') + '</span></div>'
      + '</div>';
  }

  function predBody(key, pred) {
    var P = pal();
    var tot = pred.opts.reduce(function (s, o) { return s + o.v; }, 0) || 1;
    var voted = votedIndex(key, 'pred');
    return '<div class="re-pred-body" style="background:' + P.body + ';border-radius:0 0 12px 12px;padding-bottom:4px">'
      + '<div style="padding:10px 14px;font-size:13px;font-weight:700;color:' + P.ink + '">' + esc(pred.q) + '</div>'
      + '<div style="padding:0 14px 6px">' + pred.opts.map(function (o, i) {
        var pct = Math.round(o.v / tot * 100);
        var locked = voted >= 0, isMine = locked && voted === i;
        var cardBg = isMine ? P.optPredVoted : P.optPred;
        var dim = (locked && !isMine) ? 'opacity:.5;' : '';
        var cur = locked ? 'cursor:default;' : 'cursor:pointer;';
        return '<div onclick="event.stopPropagation();ReaderEngagement.votePred(\'' + key + '\',' + i + ')" style="position:relative;background:' + cardBg + ';border-radius:10px;padding:10px 12px;overflow:hidden;border:1.5px solid ' + (isMine ? '#a78bfa' : 'var(--bd,rgba(255,255,255,.1))') + ';margin-bottom:7px;' + dim + cur + '">'
          + '<div style="position:absolute;left:0;top:0;bottom:0;background:rgba(167,139,250,.12);width:' + pct + '%"></div>'
          + '<div style="position:relative;display:flex;justify-content:space-between;gap:8px"><span style="font-size:12px;font-weight:600;color:' + P.ink + '">' + esc(o.t) + '</span><span style="font-size:11px;font-weight:800;color:#a78bfa">' + pct + '%</span></div></div>';
      }).join('') + '</div>'
      + '<div style="padding:8px 14px;font-size:10px;color:' + P.sub + ';display:flex;justify-content:space-between"><span>' + fmtN(tot) + ' predicts</span><span>' + (voted >= 0 ? 'Prediction saved' : 'Tap to predict') + '</span></div>'
      + '</div>';
  }

  function authorNoteCard(note) {
    if (!note || !note.trim()) return '';
    return '<div class="re-author-note" style="background:rgba(255,0,80,.05);border:1px solid rgba(255,0,80,.15);border-radius:14px;margin:14px 0;padding:12px 14px">'
      + '<div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ff4d7a;margin-bottom:6px"><i class="fas fa-pen" style="margin-right:5px"></i>Author\u2019s Note</div>'
      + '<div style="font-size:12.5px;line-height:1.6">' + esc(note.trim()) + '</div></div>';
  }

  function rerender(key) {
    document.querySelectorAll('[data-eng-mount="' + key + '"]').forEach(function (mount) {
      var chN = mount.getAttribute('data-ch') || key;
      mount.innerHTML = htmlFor(key, chN);
    });
  }

  function htmlFor(key, chN) {
    var eng = cache[key];
    if (!eng) return '';
    var ov = overrides[key] || {};
    var lbl = ov.chapterLabel ? ' · ' + ov.chapterLabel : '';
    var parts = authorNoteCard(eng.authorNote);
    if (eng.poll && eng.poll.q && eng.poll.opts && eng.poll.opts.length) {
      var pollTot = eng.poll.opts.reduce(function (s, o) { return s + o.v; }, 0);
      parts += accordionShell(key, 'poll', '📊', 'Poll' + lbl, fmtN(pollTot) + ' votes · tap to expand', pollBody(key, eng.poll));
    }
    if (eng.prediction && eng.prediction.q && eng.prediction.opts && eng.prediction.opts.length) {
      var predTot = eng.prediction.opts.reduce(function (s, o) { return s + o.v; }, 0);
      parts += accordionShell(key, 'pred', '🔮', 'Prediction' + lbl, fmtN(predTot) + ' predicts · tap to expand', predBody(key, eng.prediction));
    }
    if (eng.debate && eng.debate.motion) {
      var debTot = (eng.debate.forV || 0) + (eng.debate.agV || 0);
      parts += accordionShell(key, 'deb', '⚖️', 'Debate' + lbl, fmtN(debTot) + ' takes · tap to expand', debateBody(key, eng.debate, ov.debateId));
    }
    return parts;
  }

  function debateBody(key, debate, debateId) {
    var P = pal();
    var f = debate.forV || 0, a = debate.agV || 0, tot = (f + a) || 1;
    var voted = votedIndex(key, 'debate');
    var locked = voted >= 0;
    var debHref = 'debate.html?id=' + encodeURIComponent(debateId || key);
    function sideCard(side, label, count, emoji, accent, washLight, washDark) {
      var mine = locked && ((side === 'for' && voted === 0) || (side === 'against' && voted === 1));
      var pct = Math.round(count / tot * 100);
      var bg = mine ? (darkTheme() ? washDark : washLight) : P.deb;
      var bd = mine ? accent : 'var(--bd,rgba(255,255,255,.1))';
      var dim = (locked && !mine) ? 'opacity:.55;' : '';
      return '<div onclick="event.stopPropagation();ReaderEngagement.voteDebate(\'' + key + '\',\'' + side + '\')" style="flex:1;position:relative;background:' + bg + ';border-radius:12px;padding:10px 8px;text-align:center;cursor:' + (locked ? 'default' : 'pointer') + ';overflow:hidden;border:2px solid ' + bd + ';display:flex;flex-direction:column;' + dim + '">'
        + (mine ? '<div style="position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;background:' + accent + ';color:#fff;font-size:8px;display:flex;align-items:center;justify-content:center"><i class="fas fa-check"></i></div>' : '')
        + '<div style="font-size:20px;margin-bottom:4px">' + emoji + '</div>'
        + '<div style="font-size:11px;font-weight:800;color:' + accent + ';margin-bottom:6px;line-height:1.35;min-height:30px;flex:1;display:flex;align-items:center;justify-content:center">' + esc(label) + '</div>'
        + '<div style="height:4px;background:var(--bd,rgba(0,0,0,.08));border-radius:4px;overflow:hidden;margin-bottom:5px"><div style="height:100%;border-radius:4px;background:' + accent + ';width:' + pct + '%"></div></div>'
        + '<div style="font-size:14px;font-weight:900;color:' + P.ink + '">' + pct + '%</div>'
        + '<div style="font-size:10px;color:' + P.sub + ';margin-top:2px">' + fmtN(count) + ' votes</div></div>';
    }
    return '<div class="re-deb-body" style="background:' + P.body + ';border-radius:0 0 12px 12px;padding-bottom:4px">'
      + '<div style="margin:2px 14px 0;border-top:1px solid ' + P.hair + '"></div>'
      + '<div style="padding:10px 14px;font-size:13px;font-weight:700;color:' + P.ink + '">' + esc(debate.motion) + '</div>'
      + '<div style="padding:0 14px 6px;display:flex;gap:8px">'
      + sideCard('for', (debate.forText || 'For'), f, '✅', '#0d9668', '#e9f7ef', '#23483a') + sideCard('against', (debate.againstText || 'Against'), a, '❌', '#dc2626', '#fde7ea', '#55262e')
      + '</div>'
      + '<div style="padding:8px 14px;font-size:10px;color:' + P.sub + ';display:flex;justify-content:space-between;align-items:center"><span>' + fmtN(f + a) + ' joined the discussion</span><a href="' + debHref + '" onclick="event.stopPropagation()" style="color:inherit;font-weight:800">View full debate →</a></div>'
      + '</div>';
  }

  // ── live transport ────────────────────────────────────────────────────

  // engagement.routes.js is mounted under /api/stories, so the reader's
  // chapter engagement lives at /api/stories/:bookId/chapters/:key/engagement
  function engUrl(bookId, chapterId, tail) {
    return API_BASE + '/stories/' + encodeURIComponent(bookId) + '/chapters/' + encodeURIComponent(chapterId) + (tail || '');
  }

  function loadEngagement(bookId, chapterId) {
    return fetch(engUrl(bookId, chapterId, '/engagement'), { credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('Engagement failed (' + r.status + ')');
        return r.json();
      })
      .then(function (j) {
        return {
          poll: j.poll || null,
          prediction: j.prediction || null,
          debate: j.debate || null,
          authorNote: j.authorNote || '',
          myVotes: j.myVotes || {},
        };
      });
  }

  function vote(bookId, chapterId, kind, body) {
    var tail = kind === 'poll' ? '/poll/vote' : kind === 'prediction' ? '/prediction/vote' : '/debate/vote';
    return fetch(engUrl(bookId, chapterId, tail), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (e) {
          throw new Error(e.error || ('Vote failed (' + r.status + ')'));
        });
      }
      return r.json().catch(function () { return {}; });
    });
  }

  function toast(msg) {
    try {
      if (window.DroboardToast && window.DroboardToast.show) { window.DroboardToast.show(msg); return; }
    } catch (e) {}
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    try {
      var t = document.getElementById('engToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'engToast';
        t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:8px 18px;border-radius:20px;font-size:12px;z-index:999;opacity:0;transition:.3s';
        document.body.appendChild(t);
      }
      t.textContent = msg; t.style.opacity = '1';
      clearTimeout(t._t); t._t = setTimeout(function () { t.style.opacity = '0'; }, 2000);
    } catch (e) {}
  }

  // A live vote writes to the backend, then the row is re-read so the
  // totals come from the server, never from a local guess.
  function liveVote(key, kind, body) {
    var info = liveInfo[key];
    if (!info) return;
    vote(info.bookId, info.chapterId, kind, body)
      .then(function () { return loadEngagement(info.bookId, info.chapterId); })
      .then(function (eng) {
        cache[key] = eng;
        setOpen(key, kind === 'prediction' ? 'pred' : kind, true);
        rerender(key);
        toast(kind === 'debate' ? 'Side taken' : kind === 'poll' ? 'Vote counted' : 'Prediction saved');
      })
      .catch(function (e) {
        toast((e && e.message) || 'Vote failed');
      });
  }

  window.ReaderEngagement = {
    htmlFor: htmlFor,
    /* renderInto(key, chN, mountEl, authorNote, opts)
       opts (optional): {
         poll / prediction / debate : rows the page already holds
         kinds   : { poll:bool, pred:bool, deb:bool } — which accordions to show
         chapterLabel : e.g. "Ch. 3" shown in accordion titles
         debateId : id for the "View full debate →" link
         live : { bookId, chapterId } — read the rows from the backend
       } */
    renderInto: function (key, chN, mountEl, authorNote, opts) {
      if (typeof mountEl === 'string') mountEl = document.getElementById(mountEl);
      if (!mountEl) return;
      opts = opts || {};
      overrides[key] = opts;
      mountEl.setAttribute('data-eng-mount', key);
      mountEl.setAttribute('data-ch', chN);

      var live = opts.live;
      if (!live || !live.bookId || !live.chapterId) {
        // Page-supplied rows (no backend read for this surface).
        cache[key] = {
          poll: opts.poll || null,
          prediction: opts.prediction || null,
          debate: opts.debate || null,
          authorNote: opts.authorNote !== undefined ? opts.authorNote : (authorNote || ''),
          myVotes: {},
        };
        if (opts.poll && typeof opts.poll.voted === 'number' && opts.poll.voted >= 0) cache[key].myVotes.poll = opts.poll.voted;
        if (opts.prediction && typeof opts.prediction.voted === 'number' && opts.prediction.voted >= 0) cache[key].myVotes.pred = opts.prediction.voted;
        if (opts.debate && typeof opts.debate.voted === 'number' && opts.debate.voted >= 0) cache[key].myVotes.debate = opts.debate.voted;
        mountEl.innerHTML = htmlFor(key, chN);
        return;
      }

      liveInfo[key] = { bookId: live.bookId, chapterId: live.chapterId };
      mountEl.innerHTML = '<div class="re-eng-loading" style="font-size:11px;color:var(--tx-muted,#888);padding:10px 0">Loading…</div>';
      loadEngagement(live.bookId, live.chapterId)
        .then(function (eng) {
          cache[key] = eng;
          mountEl.innerHTML = htmlFor(key, chN);
        })
        .catch(function (e) {
          cache[key] = null;
          mountEl.innerHTML = '<div class="re-eng-error" style="font-size:11px;color:#dc2626;padding:10px 0">Could not load engagement — ' + esc((e && e.message) || 'request failed') + '</div>';
        });
    },
    toggle: function (key, kind) {
      setOpen(key, kind, !isOpen(key, kind));
      rerender(key);
    },
    votePoll: function (key, idx) {
      if (votedIndex(key, 'poll') >= 0) return;
      if (liveInfo[key]) { liveVote(key, 'poll', { option: idx }); return; }
      var eng = cache[key];
      if (!eng || !eng.poll || !eng.poll.opts[idx]) return;
      eng.poll.opts[idx].v++;
      eng.myVotes.poll = idx;
      setOpen(key, 'poll', true);
      rerender(key);
      toast('Vote counted');
    },
    votePred: function (key, idx) {
      if (votedIndex(key, 'pred') >= 0) return;
      if (liveInfo[key]) { liveVote(key, 'prediction', { option: idx }); return; }
      var eng = cache[key];
      if (!eng || !eng.prediction || !eng.prediction.opts[idx]) return;
      eng.prediction.opts[idx].v++;
      eng.myVotes.pred = idx;
      setOpen(key, 'pred', true);
      rerender(key);
      toast('Prediction saved');
    },
    voteDebate: function (key, side) {
      if (votedIndex(key, 'debate') >= 0) return;
      if (side !== 'for' && side !== 'against') return;
      if (liveInfo[key]) { liveVote(key, 'debate', { side: side }); return; }
      var eng = cache[key];
      if (!eng || !eng.debate) return;
      if (side === 'for') eng.debate.forV++;
      else eng.debate.agV++;
      eng.myVotes.debate = side === 'for' ? 0 : 1;
      setOpen(key, 'deb', true);
      rerender(key);
      toast('Side taken');
    }
  };
})();
