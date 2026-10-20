/* ===============================================================
   READER ENGAGEMENT SERVICE — shared polls + predictions + author note
   for full-reader and scroll-reader.
   Polls/predictions render as accordions (collapsed by default).
   Author note renders below content when present.
   Demo now, backend later: GET /api/stories/:id/chapters/:n/engagement
=============================================================== */
(function () {
  'use strict';

  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api' };

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
      card: 'var(--surface, #ffffff)', cardBd: 'rgba(0,0,0,.10)',
      title: '#161616', chevron: 'rgba(0,0,0,.45)',
      optPoll: '#FCE9F0', optPollVoted: '#ffe0e9',
      optPred: '#E7DCFA', optPredVoted: '#e9e2fb',
      deb: '#ffffff', debFor: '#e9f7ef', debAg: '#fde7ea',
      ink: '#17151b', sub: 'rgba(0,0,0,.55)'
    };
  }
  function store(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } }
  function save(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} }

  // Demo engagement per chapter — mirrors create.html eng shape
  function demoEng(chN) {
    var n = parseInt(chN) || 1;
    return {
      poll: {
        q: 'Who was truly wrong in chapter ' + n + '?',
        opts: [{ t: 'The lead', v: 1240 }, { t: 'The partner', v: 890 }],
        voted: -1
      },
      prediction: {
        q: 'What happens next?',
        opts: [{ t: 'Reconciliation', v: 2100 }, { t: 'Bigger twist', v: 3400 }, { t: 'Someone leaves', v: 900 }],
        voted: -1
      },
      // demo author note on ch 1 so UI is visible; backend/create will supply real notes
      authorNote: n === 1 ? 'Thanks for reading! Next chapter drops Friday — tell me who you trust.' : '',
      debate: {
        motion: 'Was the lead right in chapter ' + n + '?',
        forText: 'Yes, everyone deserves a second chance.',
        againstText: 'No, some actions are unforgivable.',
        forV: 1200 + ((n * 137) % 900), agV: 800 + ((n * 89) % 700),
        voted: -1
      }
    };
  }

  // Preview mode: votes live in session memory only — nothing is saved, so
  // every page load renders clean and a click shows the live feel.
  var sessionVotes = {};
  function getVotes(key) { return sessionVotes[key] || {}; }
  function setVoted(key, kind, idx) {
    if (!sessionVotes[key]) sessionVotes[key] = {};
    sessionVotes[key][kind] = idx;
  }
  function hasVoted(key, kind) {
    var v = getVotes(key); return (v[kind] !== undefined && v[kind] >= 0) ? v[kind] : -1;
  }
  // Open state is session-only: every page load starts collapsed.
  // (Votes above stay persisted — only the expanded/collapsed UI resets.)
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
    var voted = hasVoted(key, 'poll');
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
      + '<div style="padding:8px 14px;font-size:10px;color:' + P.sub + ';display:flex;justify-content:space-between"><span>' + fmtN(tot) + ' votes</span><span>Tap to vote</span></div>'
      + '</div>';
  }

  function predBody(key, pred) {
    var P = pal();
    var tot = pred.opts.reduce(function (s, o) { return s + o.v; }, 0) || 1;
    var voted = hasVoted(key, 'pred');
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
      + '<div style="padding:8px 14px;font-size:10px;color:' + P.sub + ';display:flex;justify-content:space-between"><span>' + fmtN(tot) + ' predicts</span><span>Tap to predict</span></div>'
      + '</div>';
  }

  function authorNoteCard(note) {
    if (!note || !note.trim()) return '';
    return '<div class="re-author-note" style="background:rgba(255,0,80,.05);border:1px solid rgba(255,0,80,.15);border-radius:14px;margin:14px 0;padding:12px 14px">'
      + '<div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ff4d7a;margin-bottom:6px"><i class="fas fa-pen" style="margin-right:5px"></i>Author\u2019s Note</div>'
      + '<div style="font-size:12.5px;line-height:1.6">' + esc(note.trim()) + '</div></div>';
  }

  // Cache demo objects so votes accumulate per session.
  // Real-story overrides (poll/prediction/debate from SERIES_CATALOG etc.)
  // are stored per key and applied ONCE when the cache entry is created so
  // later votes are never wiped by a re-render.
  var cache = {};
  var overrides = {}; // key -> { poll, prediction, debate, kinds, chapterLabel, debateId, authorNote }
  function applyOverride(key, chN) {
    if (!cache[key]) {
      cache[key] = demoEng(chN || key);
      var ov = overrides[key];
      if (ov) {
        if (ov.poll) cache[key].poll = ov.poll;
        if (ov.prediction) cache[key].prediction = ov.prediction;
        if (ov.debate) cache[key].debate = ov.debate;
        if (typeof ov.authorNote === 'string') cache[key].authorNote = ov.authorNote;
      }
    }
    return cache[key];
  }
  function getEng(key, chN) {
    applyOverride(key, chN);
    var v = getVotes(key);
    if (v.poll !== undefined) cache[key].poll.voted = v.poll;
    if (v.pred !== undefined) cache[key].prediction.voted = v.pred;
    if (v.debate !== undefined) cache[key].debate.voted = v.debate;
    return cache[key];
  }

  function rerender(key) {
    document.querySelectorAll('[data-eng-mount="' + key + '"]').forEach(function (mount) {
      var chN = mount.getAttribute('data-ch') || key;
      var note = mount.getAttribute('data-note') || '';
      mount.innerHTML = htmlFor(key, chN, note);
    });
  }

  function htmlFor(key, chN, authorNote) {
    var eng = getEng(key, chN);
    var ov = overrides[key] || {};
    var kinds = ov.kinds || { poll: true, pred: true, deb: true };
    // TODO backend: if CFG.USE_API, fetch GET /api/stories/chapters/:key/engagement and merge
    var lbl = ov.chapterLabel ? ' · ' + ov.chapterLabel : '';
    var parts = authorNoteCard(eng.authorNote);
    if (kinds.poll) {
      var pollTot = eng.poll.opts.reduce(function (s, o) { return s + o.v; }, 0);
      parts += accordionShell(key, 'poll', '📊', 'Poll' + lbl, fmtN(pollTot) + ' votes · tap to expand', pollBody(key, eng.poll));
    }
    if (kinds.pred) {
      var predTot = eng.prediction.opts.reduce(function (s, o) { return s + o.v; }, 0);
      parts += accordionShell(key, 'pred', '🔮', 'Prediction' + lbl, fmtN(predTot) + ' predicts · tap to expand', predBody(key, eng.prediction));
    }
    if (kinds.deb) {
      var debTot = (eng.debate.forV || 0) + (eng.debate.agV || 0);
      parts += accordionShell(key, 'deb', '⚖️', 'Debate' + lbl, fmtN(debTot) + ' takes · tap to expand', debateBody(key, eng.debate, ov.debateId));
    }
    return parts;
  }

  function debateBody(key, debate, debateId) {
    var P = pal();
    var f = debate.forV || 0, a = debate.agV || 0, tot = (f + a) || 1;
    var voted = hasVoted(key, 'debate');
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

  window.ReaderEngagement = {
    htmlFor: htmlFor,
    /* renderInto(key, chN, mountEl, authorNote, opts)
       opts (optional): {
         poll / prediction / debate : real data overrides (applied once)
         kinds   : { poll:bool, pred:bool, deb:bool } — which accordions to show
         chapterLabel : e.g. "Ch. 3" shown in accordion titles
         debateId : id for the "View full debate →" link
       } */
    renderInto: function (key, chN, mountEl, authorNote, opts) {
      if (typeof mountEl === 'string') mountEl = document.getElementById(mountEl);
      if (!mountEl) return;
      if (opts) overrides[key] = opts;
      mountEl.setAttribute('data-eng-mount', key);
      mountEl.setAttribute('data-ch', chN);
      if (authorNote !== undefined) mountEl.setAttribute('data-note', authorNote || '');
      // Seed cache now so overrides stick before first vote
      applyOverride(key, chN);
      mountEl.innerHTML = htmlFor(key, chN, authorNote);
    },
    toggle: function (key, kind) {
      setOpen(key, kind, !isOpen(key, kind));
      rerender(key);
    },
    votePoll: function (key, idx) {
      if (hasVoted(key, 'poll') >= 0) return;
      var eng = getEng(key); eng.poll.opts[idx].v++; eng.poll.voted = idx;
      setVoted(key, 'poll', idx); setOpen(key, 'poll', true); rerender(key);
      toast('Vote counted');
    },
    votePred: function (key, idx) {
      if (hasVoted(key, 'pred') >= 0) return;
      var eng = getEng(key); eng.prediction.opts[idx].v++; eng.prediction.voted = idx;
      setVoted(key, 'pred', idx); setOpen(key, 'pred', true); rerender(key);
      toast('Prediction saved');
    },
    voteDebate: function (key, side) {
      if (hasVoted(key, 'debate') >= 0) return;
      if (side !== 'for' && side !== 'against') return;
      var eng = getEng(key);
      if (side === 'for') { eng.debate.forV++; eng.debate.voted = 0; }
      else { eng.debate.agV++; eng.debate.voted = 1; }
      setVoted(key, 'debate', eng.debate.voted); setOpen(key, 'deb', true); rerender(key);
      toast('Side taken');
    }
  };
})();
