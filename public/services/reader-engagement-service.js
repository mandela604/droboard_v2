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
      authorNote: n === 1 ? 'Thanks for reading! Next chapter drops Friday — tell me who you trust.' : ''
    };
  }

  function getVotes(key) { return store('dro_eng_' + key); }
  function setVoted(key, kind, idx) {
    var v = getVotes(key); v[kind] = idx; save('dro_eng_' + key, v);
  }
  function hasVoted(key, kind) {
    var v = getVotes(key); return (v[kind] !== undefined && v[kind] >= 0) ? v[kind] : -1;
  }
  function isOpen(key, kind) {
    var v = getVotes(key); return v['open_' + kind] === true;
  }
  function setOpen(key, kind, open) {
    var v = getVotes(key); v['open_' + kind] = open; save('dro_eng_' + key, v);
  }

  function accordionShell(key, kind, icon, title, sub, bodyHtml) {
    var open = isOpen(key, kind);
    return '<div class="re-eng-card" style="background:var(--surface,#111);border:1px solid var(--bd,rgba(255,255,255,.08));border-radius:14px;overflow:hidden;margin:14px 0">'
      + '<div onclick="ReaderEngagement.toggle(\'' + key + '\',\'' + kind + '\')" style="padding:12px 14px;display:flex;align-items:center;gap:8px;cursor:pointer">'
      + '<span style="font-size:14px">' + icon + '</span>'
      + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:800">' + title + '</div>'
      + '<div style="font-size:10px;opacity:.55">' + sub + '</div></div>'
      + '<i class="fas fa-chevron-down" style="font-size:11px;opacity:.6;transform:rotate(' + (open ? '180deg' : '0deg') + ');transition:.2s"></i></div>'
      + '<div style="display:' + (open ? 'block' : 'none') + '">' + bodyHtml + '</div></div>';
  }

  function pollBody(key, poll) {
    var tot = poll.opts.reduce(function (s, o) { return s + o.v; }, 0) || 1;
    var voted = hasVoted(key, 'poll');
    return '<div style="padding:10px 14px;font-size:13px;font-weight:700">' + esc(poll.q) + '</div>'
      + '<div style="padding:0 14px 6px">' + poll.opts.map(function (o, i) {
        var pct = Math.round(o.v / tot * 100);
        return '<div onclick="event.stopPropagation();ReaderEngagement.votePoll(\'' + key + '\',' + i + ')" style="position:relative;border-radius:10px;padding:10px 12px;cursor:pointer;overflow:hidden;border:1.5px solid ' + (voted === i ? '#ff0050' : 'var(--bd,rgba(255,255,255,.1))') + ';margin-bottom:7px">'
          + '<div style="position:absolute;left:0;top:0;bottom:0;background:rgba(255,0,80,.09);width:' + pct + '%"></div>'
          + '<div style="position:relative;display:flex;justify-content:space-between;gap:8px"><span style="font-size:12px;font-weight:600">' + esc(o.t) + '</span><span style="font-size:11px;font-weight:800;color:#ff4d7a">' + pct + '%</span></div></div>';
      }).join('') + '</div>'
      + '<div style="padding:8px 14px;font-size:10px;opacity:.6;display:flex;justify-content:space-between"><span>' + fmtN(tot) + ' votes</span><span>Tap to vote</span></div>';
  }

  function predBody(key, pred) {
    var tot = pred.opts.reduce(function (s, o) { return s + o.v; }, 0) || 1;
    var voted = hasVoted(key, 'pred');
    return '<div style="padding:10px 14px;font-size:13px;font-weight:700">' + esc(pred.q) + '</div>'
      + '<div style="padding:0 14px 6px">' + pred.opts.map(function (o, i) {
        var pct = Math.round(o.v / tot * 100);
        return '<div onclick="event.stopPropagation();ReaderEngagement.votePred(\'' + key + '\',' + i + ')" style="position:relative;border-radius:10px;padding:10px 12px;cursor:pointer;overflow:hidden;border:1.5px solid ' + (voted === i ? '#a78bfa' : 'var(--bd,rgba(255,255,255,.1))') + ';margin-bottom:7px">'
          + '<div style="position:absolute;left:0;top:0;bottom:0;background:rgba(167,139,250,.12);width:' + pct + '%"></div>'
          + '<div style="position:relative;display:flex;justify-content:space-between;gap:8px"><span style="font-size:12px;font-weight:600">' + esc(o.t) + '</span><span style="font-size:11px;font-weight:800;color:#a78bfa">' + pct + '%</span></div></div>';
      }).join('') + '</div>'
      + '<div style="padding:8px 14px;font-size:10px;opacity:.6;display:flex;justify-content:space-between"><span>' + fmtN(tot) + ' predicts</span><span>Tap to predict</span></div>';
  }

  function authorNoteCard(note) {
    if (!note || !note.trim()) return '';
    return '<div class="re-author-note" style="background:rgba(255,0,80,.05);border:1px solid rgba(255,0,80,.15);border-radius:14px;margin:14px 0;padding:12px 14px">'
      + '<div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ff4d7a;margin-bottom:6px"><i class="fas fa-pen" style="margin-right:5px"></i>Author\u2019s Note</div>'
      + '<div style="font-size:12.5px;line-height:1.6">' + esc(note.trim()) + '</div></div>';
  }

  // Cache demo objects so votes accumulate per session
  var cache = {};
  function getEng(key, chN, override) {
    if (!cache[key]) cache[key] = demoEng(chN || key);
    if (override) {
      if (override.poll) cache[key].poll = override.poll;
      if (override.prediction) cache[key].prediction = override.prediction;
      if (typeof override.authorNote === 'string') cache[key].authorNote = override.authorNote;
    }
    var v = getVotes(key);
    if (v.poll !== undefined) cache[key].poll.voted = v.poll;
    if (v.pred !== undefined) cache[key].prediction.voted = v.pred;
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
    var eng = getEng(key, chN, authorNote ? { authorNote: authorNote } : null);
    // TODO backend: if CFG.USE_API, fetch GET /api/stories/chapters/:key/engagement and merge
    var pollTot = eng.poll.opts.reduce(function (s, o) { return s + o.v; }, 0);
    var predTot = eng.prediction.opts.reduce(function (s, o) { return s + o.v; }, 0);
    return authorNoteCard(eng.authorNote)
      + accordionShell(key, 'poll', '📊', 'Poll', fmtN(pollTot) + ' votes · tap to expand', pollBody(key, eng.poll))
      + accordionShell(key, 'pred', '🔮', 'Prediction', fmtN(predTot) + ' predicts · tap to expand', predBody(key, eng.prediction));
  }

  window.ReaderEngagement = {
    htmlFor: htmlFor,
    renderInto: function (key, chN, mountEl, authorNote) {
      if (typeof mountEl === 'string') mountEl = document.getElementById(mountEl);
      if (!mountEl) return;
      mountEl.setAttribute('data-eng-mount', key);
      mountEl.setAttribute('data-ch', chN);
      if (authorNote !== undefined) mountEl.setAttribute('data-note', authorNote || '');
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
    },
    votePred: function (key, idx) {
      if (hasVoted(key, 'pred') >= 0) return;
      var eng = getEng(key); eng.prediction.opts[idx].v++; eng.prediction.voted = idx;
      setVoted(key, 'pred', idx); setOpen(key, 'pred', true); rerender(key);
    }
  };
})();
