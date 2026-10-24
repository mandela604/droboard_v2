/**
 * component/genre-card.js — Droboard Genre Hub Discussion Card
 * ─────────────────────────────────────────────────────────────
 * Purpose-built for genre-hub.html. Renders discussion threads from
 * GenreDemoSeed / genre-data (same field shapes). Does NOT render ads —
 * the host page interleaves ad-card / promo-slider itself.
 *
 * USAGE:
 *
 *   <script src="component/genre-card.js"></script>
 *   ...
 *   DroboardGenreCard.attach(document.getElementById('feed'), {
 *     genreName: 'Fantasy',
 *     onLike:   (post) => { post.liked = !post.liked; post.likes += post.liked ? 1 : -1; DroboardGenreCard.update(post); },
 *     onThread: (post) => toast('Opening discussion…'),
 *     onComment: (post) => { location.href = 'discussion.html?id=' + post.id; }, // falls back to onThread
 *     onShare:  (post) => openShareModal({ ... }),
 *     onDots:   (post, el) => DroboardDotsMenu.open(post, el),
 *     onStory:  (post) => toast('Opening story…'),
 *     onAvatar: (post) => { location.href = 'profile.html?u=' + post.name; },
 *     onPinned: (post) => toast('Hub rules…'),
 *   });
 *
 *   DroboardGenreCard.setPosts(POSTS);  // pinned + discussions
 *   DroboardGenreCard.update(post);     // after like, etc.
 *
 * Each post:
 *   {
 *     id, name, avatar, time, title, body,
 *     tag, tagClass,          // discussion | recommendation | theory | question | controversial
 *     trope?,                 // story trope pill, e.g. 'Secret Baby' (rendered beside tag)
 *     badge?, badgeClass?,
 *     media?, story?: { title, writer, cover },
 *     likes, comments, liked?,
 *     hot?, score?, controversy?,
 *     isThread?, replies?,
 *     participants?: string[], extra?,
 *     pinned?: true, desc?    // pinned rules card
 *   }
 */
(function () {
  'use strict';
  if (window.__droboardGenreCard) return;
  window.__droboardGenreCard = true;

  const CSS = `
      .dgc-post{
        background:var(--l1,#fff);border-bottom:8px solid var(--dgc-div,var(--bg,#d8d8d8));
        padding:14px 14px 12px;position:relative;
      font-family:var(--font-ui,'Inter',system-ui,sans-serif);
      box-sizing:border-box;
    }
    .dgc-post *,.dgc-pinned *{box-sizing:border-box}
    
    
    

    .dgc-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .dgc-av{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--l2,#f1f1f1);cursor:pointer}
    .dgc-meta{flex:1;min-width:0}
    .dgc-name-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .dgc-name{font-size:13.5px;font-weight:800;color:var(--tx-high,#161616);cursor:pointer}
    .dgc-badge{font-size:9px;font-weight:800;padding:2px 7px;border-radius:8px;background:rgba(167,139,250,.12);color:var(--purple,#a78bfa);letter-spacing:.02em}
    .dgc-badge.author{background:rgba(255,0,80,.08);color:var(--acc,#ff0050)}
    .dgc-time{font-size:11px;color:var(--tx-muted,#666);font-weight:600;margin-top:1px}
    .dgc-dots{
      width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      color:var(--tx-muted,#666);font-size:14px;flex-shrink:0;background:none;border:none;cursor:pointer;font-family:inherit;
    }
    .dgc-dots:active{background:rgba(127,127,127,.1)}

    .dgc-title{font-size:15px;font-weight:800;color:var(--tx-high,#161616);line-height:1.3;letter-spacing:-.01em;margin-bottom:6px;cursor:pointer}
    .dgc-body{font-size:13px;color:var(--tx-body,#3a3a3a);line-height:1.55;margin-bottom:4px}
    .dgc-body.clamp{
      display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;
      overflow:hidden;margin-bottom:4px;
    }
    .dgc-more{
      display:block;height:17px;line-height:17px;font-size:12.5px;font-weight:800;color:var(--acc,#ff0050);
      margin-bottom:10px;cursor:pointer;background:none;border:none;padding:0;font-family:inherit;
    }
    .dgc-more.dgc-more-void{cursor:default;pointer-events:none}
    .dgc-more:active{opacity:.7}

    .dgc-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
    .dgc-tag{font-size:10px;font-weight:800;padding:4px 9px;border-radius:12px;letter-spacing:.02em}
    .dgc-tag.discussion{background:rgba(167,139,250,.12);color:#7c3aed}
    .dgc-tag.recommendation{background:rgba(255,0,80,.08);color:var(--acc,#ff0050)}
    .dgc-tag.theory{background:rgba(56,189,248,.12);color:#0284c7}
    .dgc-tag.question{background:rgba(52,211,153,.12);color:#0d9668}
    .dgc-tag.controversial{background:rgba(251,146,60,.14);color:#c2410c}
    .dgc-tag.trope{background:transparent;border:1px solid var(--bd-acc,rgba(255,0,80,.25));color:var(--acc,#ff0050)}
    [data-theme="dark"] .dgc-tag.trope{border-color:rgba(255,0,80,.4);color:#ff7a9a}
    .dgc-tag.hot{background:rgba(255,0,80,.1);color:var(--acc,#ff0050)}
    .dgc-tag.pinned{background:rgba(240,168,0,.12);color:#b57e00;border:1px solid rgba(240,168,0,.3)}
    [data-theme="dark"] .dgc-tag.hot{background:rgba(255,0,80,.25);color:#ff7a9a;border:1px solid rgba(255,0,80,.4)}

    .dgc-media{width:100%;max-height:220px;border-radius:12px;overflow:hidden;margin-bottom:10px;background:var(--l2,#f1f1f1);cursor:pointer}
    .dgc-media img{width:100%;height:100%;max-height:220px;object-fit:cover;display:block}

    /* ── Engagement widgets (poll / prediction / debate) — same reader-page
       UI, always expanded (no accordion), dgc- prefixed, host CSS vars. ── */
    .dgc-eng{border:1px solid var(--bd,rgba(0,0,0,.1));border-radius:14px;overflow:hidden;margin-bottom:10px;background:var(--l2,#f1f1f1)}
    .dgc-eng-hdr{display:flex;align-items:center;gap:8px;padding:12px 14px}
    .dgc-eng-hdr-ico{font-size:14px;line-height:1}
    .dgc-eng-hdr-body{flex:1;min-width:0}
    .dgc-eng-hdr-title{font-size:12px;font-weight:800;color:var(--tx-high,#161616)}
    .dgc-eng-hdr-sub{font-size:10px;color:var(--tx-muted,#666);margin-top:1px}
    .dgc-eng-panel{display:block;border-top:1px solid var(--bd,rgba(0,0,0,.1))}
    .dgc-eng-q{padding:10px 14px 8px;font-size:13px;font-weight:700;color:var(--tx-high,#161616)}
    .dgc-eng-opts{padding:0 14px 6px}
    .dgc-eng-opt{position:relative;border-radius:10px;padding:10px 12px;overflow:hidden;border:1.5px solid var(--bd,rgba(0,0,0,.1));margin-bottom:7px;cursor:pointer;transition:border-color .2s;user-select:none}
    .dgc-eng-opt:last-child{margin-bottom:0}
    .dgc-eng-opt.voted{border-color:#ff0050}
    .dgc-eng-opt-bar{position:absolute;left:0;top:0;bottom:0;background:rgba(255,0,80,.09);transition:width .6s cubic-bezier(.4,0,.2,1);z-index:0}
    .dgc-eng-opt-row{position:relative;z-index:1;display:flex;justify-content:space-between;gap:8px}
    .dgc-eng-opt-txt{font-size:12px;font-weight:600;color:var(--tx-body,#3a3a3a)}
    .dgc-eng-opt-pct{font-size:11px;font-weight:800;color:var(--acc,#ff0050)}
    .dgc-eng-opt-mine{color:var(--acc,#ff0050);font-weight:700}
    .dgc-eng.pred .dgc-eng-opt.voted{border-color:var(--purple,#a78bfa)}
    .dgc-eng.pred .dgc-eng-opt-bar{background:rgba(167,139,250,.12)}
    .dgc-eng.pred .dgc-eng-opt-pct,.dgc-eng.pred .dgc-eng-opt-mine{color:var(--purple,#a78bfa)}
    .dgc-eng-foot{padding:8px 14px;font-size:10px;color:var(--tx-muted,#666);display:flex;justify-content:space-between;align-items:center}
    .dgc-eng-foot-link{color:var(--acc,#ff0050);font-weight:800;cursor:pointer}
    .dgc-eng-deb-sides{display:flex;gap:8px;padding:0 14px 6px}
    .dgc-eng-deb-side{flex:1;position:relative;border-radius:12px;padding:10px 8px;text-align:center;border:2px solid var(--bd,rgba(0,0,0,.1));cursor:pointer;overflow:hidden;transition:all .2s;user-select:none;display:flex;flex-direction:column}
    .dgc-eng-deb-side.for.chosen{border-color:#0d9668;background:rgba(52,211,153,.06)}
    .dgc-eng-deb-side.against.chosen{border-color:var(--acc,#ff0050);background:rgba(255,0,80,.06)}
    .dgc-eng-deb-check{position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;background:#0d9668;color:#fff;font-size:8px;display:flex;align-items:center;justify-content:center}
    .dgc-eng-deb-side.against .dgc-eng-deb-check{background:var(--acc,#ff0050)}
    .dgc-eng-deb-em{font-size:20px;margin-bottom:4px;flex-shrink:0}
    .dgc-eng-deb-lbl{font-size:11px;font-weight:800;line-height:1.35;min-height:30px;display:flex;align-items:center;justify-content:center;margin-bottom:6px;flex:1}
    .dgc-eng-deb-side.for .dgc-eng-deb-lbl{color:#0d9668}
    .dgc-eng-deb-side.against .dgc-eng-deb-lbl{color:var(--acc,#ff0050)}
    .dgc-eng-deb-barwrap{height:4px;background:var(--bd,rgba(0,0,0,.08));border-radius:4px;overflow:hidden;margin-bottom:5px}
    .dgc-eng-deb-bar{height:100%;border-radius:4px;transition:width .6s ease}
    .dgc-eng-deb-side.for .dgc-eng-deb-bar{background:#0d9668}
    .dgc-eng-deb-side.against .dgc-eng-deb-bar{background:var(--acc,#ff0050)}
    .dgc-eng-deb-pct{font-size:14px;font-weight:900;color:var(--tx-high,#161616)}
    .dgc-eng-deb-cnt{font-size:10px;color:var(--tx-muted,#666);margin-top:2px}

    .dgc-story{
      display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;
      background:var(--l2,#f1f1f1);border:1px solid var(--bd,rgba(0,0,0,.1));margin-bottom:10px;cursor:pointer;
    }
    .dgc-story:active{border-color:var(--bd-acc,rgba(255,0,80,.25))}
    .dgc-story-cover{width:36px;height:48px;border-radius:7px;object-fit:cover;flex-shrink:0;background:var(--l4,#e8e8e8)}
    .dgc-story-body{flex:1;min-width:0}
    .dgc-story-lbl{font-size:9px;font-weight:800;color:var(--tx-muted,#666);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
    .dgc-story-title{font-size:12.5px;font-weight:700;color:var(--tx-high,#161616);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dgc-story-by{font-size:11px;color:var(--tx-muted,#666)}
    .dgc-story-go{color:var(--acc,#ff0050);font-size:12px;flex-shrink:0}
    /* Recommendation row — compact story promo (cover + genre + hook + author) */
    .dgc-story.rec{background:#eef2f6;padding:12px;gap:12px;border-radius:14px}
    [data-theme="dark"] .dgc-story.rec{background:#121318;border-color:rgba(255,255,255,.08)}
    .dgc-story.rec .dgc-story-cover{width:56px;height:80px;border-radius:8px}
    .dgc-story-cat{font-size:10px;font-weight:800;color:#0d9668;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
    .dgc-story.rec .dgc-story-title{font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:700;line-height:1.35;white-space:normal;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .dgc-story.rec .dgc-story-by{font-size:12px;font-weight:600}

    .dgc-foot{
      display:flex;align-items:center;justify-content:space-between;gap:8px;
      padding-top:10px;border-top:1px solid var(--bd2,rgba(0,0,0,.05));flex-wrap:wrap;
    }
    .dgc-actions{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
    .dgc-topslot{display:inline-flex;align-items:center;margin-left:2px}
    .dgc-act{
      display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:20px;
      font-size:12px;font-weight:700;color:var(--tx-muted,#666);background:var(--bg);border:none;
      cursor:pointer;font-family:inherit;
    }
    .dgc-act:active{background:var(--l4,#e8e8e8)}
    [data-theme="dark"] .dgc-act:active{background:var(--l2)}
      .dgc-act.liked,.dgc-act.liked i{color:var(--acc,#ff0050)}
    .dgc-parts{display:flex;align-items:center}
    .dgc-part{width:22px;height:22px;border-radius:50%;object-fit:cover;border:2px solid var(--l1,#fff);margin-left:-6px;background:var(--l2,#f1f1f1)}
    .dgc-part:first-child{margin-left:0}
    .dgc-part-more{font-size:10.5px;font-weight:700;color:var(--tx-muted,#666);margin-left:5px}

      .dgc-pinned{
        background:linear-gradient(135deg,rgba(255,0,80,.05),rgba(167,139,250,.05));
        border-bottom:8px solid var(--dgc-div,var(--bg,#d8d8d8));padding:14px;margin:0;
      font-family:var(--font-ui,'Inter',system-ui,sans-serif);
    }
    .dgc-pinned-tag{font-size:10.5px;font-weight:800;color:var(--acc,#ff0050);display:flex;align-items:center;gap:5px;margin-bottom:6px}
    .dgc-pinned-title{font-size:14.5px;font-weight:800;color:var(--tx-high,#161616);margin-bottom:4px}
    .dgc-pinned-desc{font-size:12.5px;color:var(--tx-muted,#666);line-height:1.45;margin-bottom:10px}
    .dgc-pinned-foot{display:flex;align-items:center;justify-content:space-between}
    .dgc-pinned-stats{display:flex;gap:12px;font-size:12px;font-weight:700;color:var(--tx-muted,#666)}
    .dgc-pinned-stats i{color:var(--acc,#ff0050)}
    .dgc-pinned-more{font-size:12px;font-weight:800;color:var(--acc,#ff0050);background:none;border:none;cursor:pointer;font-family:inherit}
    .dgc-actions .drp-trigger{color:var(--tx-muted,#666);background:none;padding:0;font-size:12px;font-weight:700}
    .dgc-actions .drp-trigger i{font-size:12px}
    .dgc-actions .drp-like-count{font-size:12px;font-weight:700}
    .dgc-actions .drp-trigger.liked,.dgc-actions .drp-trigger.liked .drp-like{color:var(--acc,#ff0050)}
    .dgc-actions .drp-trigger:active{background:none}
    .dgc-actions .drp-like{display:inline-flex;align-items:center;gap:5px;background:var(--bg);padding:6px 11px;border-radius:20px}
    .dgc-actions .drp-like:active{background:var(--l4,#e8e8e8)}
    [data-theme="light"] .dgc-actions .drp-popup{background:#fff;border-color:rgba(0,0,0,.08);box-shadow:0 8px 28px rgba(0,0,0,.12)}
    [data-theme="light"] .dgc-actions .drp-count{color:#888}
    [data-theme="dark"]{
      --dgc-div:#000000;
    }
    [data-theme="dark"] .dgc-post,
    [data-theme="dark"] .dgc-pinned{
      border-bottom-color:#000;
    }
    /* stronger separator when card bg is near-black */
    [data-theme="dark"] .dgc-post{
      border-bottom:8px solid #000;
      box-shadow:inset 0 -1px 0 rgba(255,255,255,.06);
    }
    [data-theme="dark"] .dgc-pinned{
      border-bottom:8px solid #000;
      box-shadow:inset 0 -1px 0 rgba(255,255,255,.06);
    }
    [data-theme="dark"] .dgc-foot{border-top-color:rgba(255,255,255,.08)}

    /* ── Feed trending equal height (comm-slide only) ── */
    .comm-slide .dgc-post{
      display:flex;flex-direction:column;flex:1;
    }
    .comm-slide .dgc-title{
      display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;
      overflow:hidden;min-height:39px;line-height:1.3;
    }
    .comm-slide .dgc-body{
      display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;
      overflow:hidden;min-height:60px;line-height:1.55;
    }
    .comm-slide .dgc-body.clamp{
      -webkit-line-clamp:3;min-height:60px;
    }
    .comm-slide .dgc-tags{
      flex-wrap:nowrap;overflow:hidden;white-space:nowrap;
      height:22px;min-height:22px;align-items:center;margin-bottom:0;
    }
    .comm-slide .dgc-tags .dgc-tag{flex-shrink:0}
    .comm-slide .dgc-foot{margin-top:auto;padding-top:8px;flex-wrap:nowrap;align-items:center}
    .comm-slide .dgc-actions{flex-wrap:nowrap;min-width:0;overflow:visible}
    .comm-slide .dgc-act{padding:6px 8px;gap:4px;flex-shrink:1;min-width:0;white-space:nowrap}
    .comm-slide .dgc-act-lbl{display:none}
    .comm-slide .dgc-actions .drp-trigger{padding:0;flex-shrink:1;min-width:0;white-space:nowrap;position:static}
    .comm-slide .dgc-actions .drp-like{padding:6px 8px;gap:4px;flex-shrink:0;white-space:nowrap}
    .comm-slide .dgc-parts{flex-shrink:0}
    /* Long-press popup must escape the actions bar: anchor it to the card
       (trigger goes static) so it fits inside the 260px slide and can't be
       clipped by overflow or overflow the row's horizontal scroll. */
    .comm-slide .dgc-post{position:relative}
    .comm-slide .drp-popup{left:8px;right:8px;width:auto;bottom:48px}
    .comm-slide .dgc-media{flex-shrink:0}
    .comm-slide .dgc-story{flex-shrink:0}
  `;

  let _root = null;
  let _hooks = {};
  let _posts = [];
  const _bindings = [];
  let _genreName = '';
  let _sort = 'hot';

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _injectStyles() {
    if (document.getElementById('dgc-style')) return;
    const style = document.createElement('style');
    style.id = 'dgc-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function _findIn(posts, id) {
    return (posts || []).find(p => String(p.id) === String(id));
  }
  function _find(id) {
    const local = _findIn(_posts, id);
    if (local) return local;
    for (let i = 0; i < _bindings.length; i++) {
      const hit = _findIn(_bindings[i].posts, id);
      if (hit) return hit;
    }
    return undefined;
  }
  function _findByName(name) {
    const match = (arr) => (arr || []).find(x => String(x.name) === String(name));
    return match(_posts) || _bindings.reduce((found, b) => found || match(b.posts), undefined);
  }

  // ── Engagement widgets (poll / prediction / debate) — reader-page UI, always expanded ──
  function _fmtN(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0); }
  function _engShell(icon, title, sub, bodyHtml) {
    return `<div class="dgc-eng" data-dgc-eng>
      <div class="dgc-eng-hdr">
        <span class="dgc-eng-hdr-ico">${icon}</span>
        <div class="dgc-eng-hdr-body">
          <div class="dgc-eng-hdr-title">${_esc(title)}</div>
          <div class="dgc-eng-hdr-sub">${sub}</div>
        </div>
      </div>
      <div class="dgc-eng-panel">${bodyHtml}</div>
    </div>`;
  }
  function _pollHtml(p) {
    const pl = p.poll || {};
    const opts = pl.opts || [];
    const total = pl.total || opts.reduce((a, o) => a + (o.v || 0), 0) || 1;
    const rows = opts.map((o, i) => {
      const pct = Math.round(((o.v || 0) / total) * 100) || 0;
      const voted = pl.voted === i;
      return `<div class="dgc-eng-opt${voted ? ' voted' : ''}" data-dgc-poll-opt="${_esc(p.id)}:${i}">
        <div class="dgc-eng-opt-bar" style="width:${pct}%"></div>
        <div class="dgc-eng-opt-row"><span class="dgc-eng-opt-txt">${_esc(o.label || o.t)}${voted ? ' <span class="dgc-eng-opt-mine">· your vote</span>' : ''}</span><span class="dgc-eng-opt-pct">${pct}%</span></div>
      </div>`;
    }).join('');
    const body = `<div class="dgc-eng-q">${_esc(pl.question || pl.q)}</div><div class="dgc-eng-opts">${rows}</div>
      <div class="dgc-eng-foot"><span>${pl.voted >= 0 ? 'Thanks for voting' : 'Tap an option to vote'}</span><span>${_fmtN(total)} votes</span></div>`;
    return _engShell('📊', 'Poll', `${_fmtN(total)} votes`, body);
  }
  function _predHtml(p) {
    const pr = p.prediction || {};
    const opts = pr.opts || [];
    const total = pr.total || opts.reduce((a, o) => a + (o.v || 0), 0) || 1;
    const rows = opts.map((o, i) => {
      const pct = Math.round(((o.v || 0) / total) * 100) || 0;
      const voted = pr.voted === i;
      return `<div class="dgc-eng-opt${voted ? ' voted' : ''}" data-dgc-pred-opt="${_esc(p.id)}:${i}">
        <div class="dgc-eng-opt-bar" style="width:${pct}%"></div>
        <div class="dgc-eng-opt-row"><span class="dgc-eng-opt-txt">${_esc(o.label || o.t || o.text)}${voted ? ' <span class="dgc-eng-opt-mine">· your pick</span>' : ''}</span><span class="dgc-eng-opt-pct">${pct}%</span></div>
      </div>`;
    }).join('');
    const body = `<div class="dgc-eng-q">${_esc(pr.question || pr.q)}</div><div class="dgc-eng-opts">${rows}</div>
      <div class="dgc-eng-foot"><span>${pr.voted >= 0 ? 'Prediction locked in' : 'Tap an option to predict'}</span><span>${_fmtN(total)} predicts</span></div>`;
    return _engShell('🔮', 'Prediction', `${_fmtN(total)} predicts`, body);
  }
  function _debHtml(p) {
    const d = p.debateData || {};
    const f = d.forV || 0, a = d.agV || 0, tot = (f + a) || 1;
    const fp = Math.round(f / tot * 100), ap = 100 - fp;
    const voted = d.userVote || null;
    const side = (s, lbl, cnt, em, cls, pct) => `<div class="dgc-eng-deb-side ${cls}${voted === s ? ' chosen' : ''}" data-dgc-debate="${_esc(p.id)}:${s}">
      ${voted === s ? `<div class="dgc-eng-deb-check"><i class="fas fa-check"></i></div>` : ''}
      <div class="dgc-eng-deb-em">${em}</div>
      <div class="dgc-eng-deb-lbl">${_esc(lbl)}</div>
      <div class="dgc-eng-deb-barwrap"><div class="dgc-eng-deb-bar" style="width:${pct}%"></div></div>
      <div class="dgc-eng-deb-pct">${pct}%</div>
      <div class="dgc-eng-deb-cnt">${_fmtN(cnt)} votes</div>
    </div>`;
    const body = `<div class="dgc-eng-q">${_esc(d.motion || d.question)}</div>
      <div class="dgc-eng-deb-sides">${side('for', d.forText || 'For', f, '✅', 'for', fp)}${side('against', d.againstText || 'Against', a, '❌', 'against', ap)}</div>
      <div class="dgc-eng-foot"><span>${_fmtN(f + a)} joined the discussion</span><span class="dgc-eng-foot-link" data-dgc-debate-open="${_esc(p.id)}">View full debate <i class="fas fa-chevron-right"></i></span></div>`;
    return _engShell('⚖️', 'Debate', `${_fmtN(f + a)} takes`, body);
  }
  // Returns the engagement accordion HTML for a post, or '' if it has none.
  function _engHtml(p) {
    let h = '';
    if (p.poll) h += _pollHtml(p);
    if (p.prediction) h += _predHtml(p);
    if (p.debateData) h += _debHtml(p);
    return h;
  }

  function renderPinned(p) {
    return `<div class="dgc-pinned" data-dgc-id="${_esc(p.id)}" data-dgc-pinned="1">
      <div class="dgc-pinned-tag"><i class="fas fa-thumbtack"></i> Pinned · Hub rules</div>
      <div class="dgc-pinned-title">${_esc(p.title)}</div>
      <div class="dgc-pinned-desc">${_esc(p.desc || p.body || '')}</div>
      <div class="dgc-pinned-foot">
        <div></div>
        <button type="button" class="dgc-pinned-more" data-dgc-pinned-more="${_esc(p.id)}">Read more <i class="fas fa-chevron-right"></i></button>
      </div>
    </div>`;
  }

  function renderCard(p) {
    if (p.pinned) return renderPinned(p);

    const flags = [];
    if (p.hot || _sort === 'hot') flags.push('dgc-hot');
    if ((p.controversy || 0) >= 50 || p.tagClass === 'controversial') flags.push('dgc-controversial');

    const badge = p.badge
      ? `<span class="dgc-badge ${p.badgeClass === 'author' ? 'author' : ''}">${_esc(p.badge)}</span>`
      : '';

    let tags = '';
    const tagName = String(p.tag || '').toLowerCase();
    const tagCls = String(p.tagClass || 'discussion').toLowerCase();
    if (p.tag) {
      if (p.pinTop) tags += `<span class="dgc-tag pinned"><i class="fas fa-thumbtack"></i> Pinned</span>`;
      tags += `<span class="dgc-tag ${p.tagClass || 'discussion'}">${_esc(p.tag)}</span>`;
    }
    if (p.trope) {
      tags += `<span class="dgc-tag trope"><i class="fas fa-wand-magic-sparkles"></i> ${_esc(p.trope)}</span>`;
    }
    // One pill per meaning: skip auto pills the type tag already covers.
    if (p.hot && tagName !== 'hot') tags += `<span class="dgc-tag hot"><i class="fas fa-fire"></i> Hot</span>`;
    if ((p.controversy || 0) >= 50 && tagName !== 'controversial' && tagCls !== 'controversial') tags += `<span class="dgc-tag controversial"><i class="fas fa-bolt"></i> Controversial</span>`;

    const media = p.media
      ? `<div class="dgc-media" data-dgc-thread="${_esc(p.id)}"><img src="${_esc(p.media)}" alt="" loading="lazy"/></div>`
      : '';

    const isRec = String(p.tagClass || '').toLowerCase() === 'recommendation';
    const storyBy = p.story ? (p.story.writer || p.story.author || '') : '';
    const storyCat = (p.story && (p.story.cat || p.story.genre)) || _genreName || 'Recommended';
    const story = p.story
      ? `<div class="dgc-story${isRec ? ' rec' : ''}" data-dgc-story="${_esc(p.id)}">
          <img class="dgc-story-cover" src="${_esc(p.story.cover || '')}" alt=""/>
          <div class="dgc-story-body">
            ${isRec ? `<div class="dgc-story-cat">${_esc(storyCat)}</div>` : `<div class="dgc-story-lbl">Discussing</div>`}
            <div class="dgc-story-title">${_esc(p.story.title || '')}</div>
            <div class="dgc-story-by">by ${isRec ? '@' : ''}${_esc(storyBy)}</div>
          </div>
          ${isRec ? '' : '<i class="fas fa-arrow-right dgc-story-go"></i>'}
        </div>`
      : '';

    const parts = (p.participants || [])
      .map(u => `<img class="dgc-part" src="${_esc(u)}" alt=""/>`)
      .join('');

    const genreBit = _genreName ? ` · ${_esc(_genreName)}` : '';

    return `<article class="dgc-post ${flags.join(' ')}" data-dgc-id="${_esc(p.id)}">
      <div class="dgc-head">
        <img class="dgc-av" src="${_esc(p.avatar || '')}" alt="" data-dgc-av="${_esc(p.id)}"/>
        <div class="dgc-meta">
          <div class="dgc-name-row">
            <span class="dgc-name" data-dgc-name="${_esc(p.name || '')}">${_esc(p.name || '')}</span>
            ${badge}
          </div>
          <div class="dgc-time">${_esc(p.time || '')}${genreBit}</div>
        </div>
        <button type="button" class="dgc-dots" data-dgc-dots="${_esc(p.id)}" aria-label="More"><i class="fas fa-ellipsis"></i></button>
      </div>
      <div class="dgc-title" data-dgc-thread="${_esc(p.id)}">${_esc(p.title || '')}</div>
      ${(() => {
        const full = p.body || '';
        const needsMore = full.length > 120 || (full.match(/\n/g) || []).length >= 2;
        const bodyHtml = full ? `<div class="dgc-body${needsMore ? ' clamp' : ''}">${_esc(full)}</div>` : '';
        const moreHtml = needsMore
          ? `<button type="button" class="dgc-more" data-dgc-thread="${_esc(p.id)}">… See more</button>`
          : `<span class="dgc-more dgc-more-void" aria-hidden="true"></span>`;
        return bodyHtml + moreHtml;
      })()}
      ${media}${story}${_engHtml(p)}
      ${tags ? `<div class="dgc-tags">${tags}</div>` : ''}
      <div class="dgc-foot">
        <div class="dgc-actions">
          ${typeof _hooks.getReactionHTML === 'function'
            ? _hooks.getReactionHTML(p)
            : `<button type="button" class="dgc-act ${p.liked ? 'liked' : ''}" data-dgc-like="${_esc(p.id)}">
            <i class="${p.liked ? 'fas' : 'far'} fa-heart"></i> ${p.likes || 0}
          </button>`}
          <button type="button" class="dgc-act" data-dgc-comment="${_esc(p.id)}">
            <i class="far fa-comment"></i> ${p.comments || 0}<span class="dgc-act-lbl"> · Thread</span>
          </button>
          <button type="button" class="dgc-act" data-dgc-share="${_esc(p.id)}"><i class="fas fa-share-nodes"></i></button>
          <span class="dgc-topslot">${(window.DroboardReactionPicker && typeof DroboardReactionPicker.renderTop === 'function' && typeof DroboardReactionPicker.topRowMode === 'function' && DroboardReactionPicker.topRowMode() === 'external') ? DroboardReactionPicker.renderTop(String(p.id), 2) : ''}</span>
        </div>
        <div class="dgc-parts">${parts}${p.extra ? `<span class="dgc-part-more">+${p.extra}</span>` : ''}</div>
      </div>
    </article>`;
  }

  function _paint() {
    if (!_root) return;
    _root.innerHTML = _posts.map(renderCard).join('');
  }

  function setPosts(posts) {
    _posts = Array.isArray(posts) ? posts.slice() : [];
    const b = _bindings.find(x => x.root === _root);
    if (b) b.posts = _posts;
    _paint();
  }

  function update(post) {
    if (!post || post.id == null) return;
    const sid = String(post.id);
    const apply = (arr) => {
      if (!arr) return false;
      const i = arr.findIndex(p => String(p.id) === sid);
      if (i >= 0) { arr[i] = post; return true; }
      return false;
    };
    if (!apply(_posts)) _posts.push(post);
    _bindings.forEach(b => { if (!apply(b.posts)) { /* keep row lists independent */ } });
    const sel = `[data-dgc-id="${CSS.escape ? CSS.escape(sid) : sid}"]`;
    const roots = _bindings.map(b => b.root).concat(_root ? [_root] : []);
    let replaced = false;
    roots.forEach(root => {
      if (!root) return;
      root.querySelectorAll(sel).forEach(el => {
        const tmp = document.createElement('div');
        tmp.innerHTML = renderCard(post);
        const next = tmp.firstElementChild;
        if (next) { el.replaceWith(next); replaced = true; }
      });
    });
    if (!replaced && _root) _paint();
  }

  function setGenreName(name) {
    _genreName = name || '';
  }

  function setSort(sort) {
    _sort = sort || 'hot';
  }

  function attach(rootEl, hooks) {
    _injectStyles();
    if (!rootEl) return;
    _root = rootEl;
    _hooks = hooks || {};
    if (_hooks.genreName) _genreName = _hooks.genreName;
    if (_hooks.sort) _sort = _hooks.sort;

    let b = _bindings.find(x => x.root === rootEl);
    if (!b) {
      b = { root: rootEl, hooks: _hooks, posts: [] };
      _bindings.push(b);
      rootEl.addEventListener('click', (e) => {
        const hooksNow = (b.hooks && Object.keys(b.hooks).length) ? b.hooks : _hooks;
        const handled = (fn) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          fn();
        };
        const pollOpt = e.target.closest('[data-dgc-poll-opt]');
        if (pollOpt) {
          handled(() => {
            const [pid, idx] = pollOpt.dataset.dgcPollOpt.split(':');
            const p = _find(pid);
            if (p && typeof hooksNow.onPollVote === 'function') hooksNow.onPollVote(p, parseInt(idx, 10));
          });
          return;
        }
        const predOpt = e.target.closest('[data-dgc-pred-opt]');
        if (predOpt) {
          handled(() => {
            const [pid, idx] = predOpt.dataset.dgcPredOpt.split(':');
            const p = _find(pid);
            if (p && typeof hooksNow.onPredVote === 'function') hooksNow.onPredVote(p, parseInt(idx, 10));
          });
          return;
        }
        const debSide = e.target.closest('[data-dgc-debate]');
        if (debSide) {
          handled(() => {
            const [pid, side] = debSide.dataset.dgcDebate.split(':');
            const p = _find(pid);
            if (p && typeof hooksNow.onDebateVote === 'function') hooksNow.onDebateVote(p, side);
          });
          return;
        }
        const debOpen = e.target.closest('[data-dgc-debate-open]');
        if (debOpen) {
          handled(() => {
            const p = _find(debOpen.dataset.dgcDebateOpen);
            if (p && typeof hooksNow.onOpenDebate === 'function') hooksNow.onOpenDebate(p);
          });
          return;
        }
        const like = e.target.closest('[data-dgc-like]');
        if (like) {
          handled(() => {
            const p = _find(like.dataset.dgcLike);
            if (p && typeof hooksNow.onLike === 'function') hooksNow.onLike(p);
          });
          return;
        }
        const dots = e.target.closest('[data-dgc-dots]');
        if (dots) {
          handled(() => {
            const p = _find(dots.dataset.dgcDots);
            if (p && typeof hooksNow.onDots === 'function') hooksNow.onDots(p, dots);
          });
          return;
        }
        const share = e.target.closest('[data-dgc-share]');
        if (share) {
          handled(() => {
            const p = _find(share.dataset.dgcShare);
            if (p && typeof hooksNow.onShare === 'function') hooksNow.onShare(p);
          });
          return;
        }
        const story = e.target.closest('[data-dgc-story]');
        if (story) {
          handled(() => {
            const p = _find(story.dataset.dgcStory);
            if (p && typeof hooksNow.onStory === 'function') hooksNow.onStory(p);
          });
          return;
        }
        const pinnedMore = e.target.closest('[data-dgc-pinned-more]');
        if (pinnedMore) {
          handled(() => {
            const p = _find(pinnedMore.dataset.dgcPinnedMore);
            if (p && typeof hooksNow.onPinned === 'function') hooksNow.onPinned(p);
          });
          return;
        }
        const av = e.target.closest('[data-dgc-av]');
        if (av) {
          handled(() => {
            const p = _find(av.dataset.dgcAv);
            if (p && typeof hooksNow.onAvatar === 'function') hooksNow.onAvatar(p);
          });
          return;
        }
        const nm = e.target.closest('[data-dgc-name]');
        if (nm) {
          handled(() => {
            const p = _findByName(nm.dataset.dgcName) || _find(nm.dataset.dgcName);
            if (typeof hooksNow.onNameClick === 'function') hooksNow.onNameClick(p, nm.dataset.dgcName);
            else if (p && typeof hooksNow.onAvatar === 'function') hooksNow.onAvatar(p);
          });
          return;
        }
        const comment = e.target.closest('[data-dgc-comment]');
        if (comment) {
          handled(() => {
            const p = _find(comment.dataset.dgcComment);
            if (!p) return;
            if (typeof hooksNow.onComment === 'function') hooksNow.onComment(p);
            else if (typeof hooksNow.onThread === 'function') hooksNow.onThread(p);
          });
          return;
        }
        const thread = e.target.closest('[data-dgc-thread]');
        if (thread) {
          handled(() => {
            const p = _find(thread.dataset.dgcThread);
            if (p && typeof hooksNow.onThread === 'function') hooksNow.onThread(p);
          });
        }
      });
    } else {
      b.hooks = _hooks;
    }
  }

  window.DroboardGenreCard = {
    attach,
    setPosts,
    update,
    setGenreName,
    setSort,
    renderCard, // optional manual HTML
  };
})();
