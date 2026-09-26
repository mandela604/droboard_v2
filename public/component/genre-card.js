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
      font-family:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
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
      display:inline-block;font-size:12.5px;font-weight:800;color:var(--acc,#ff0050);
      margin-bottom:10px;cursor:pointer;background:none;border:none;padding:0;font-family:inherit;
    }
    .dgc-more:active{opacity:.7}

    .dgc-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
    .dgc-tag{font-size:10px;font-weight:800;padding:4px 9px;border-radius:12px;letter-spacing:.02em}
    .dgc-tag.discussion{background:rgba(167,139,250,.12);color:#7c3aed}
    .dgc-tag.recommendation{background:rgba(255,0,80,.08);color:var(--acc,#ff0050)}
    .dgc-tag.theory{background:rgba(56,189,248,.12);color:#0284c7}
    .dgc-tag.question{background:rgba(52,211,153,.12);color:#0d9668}
    .dgc-tag.controversial{background:rgba(251,146,60,.14);color:#c2410c}
    .dgc-tag.hot{background:rgba(255,0,80,.1);color:var(--acc,#ff0050)}
    [data-theme="dark"] .dgc-tag.hot{background:rgba(255,0,80,.25);color:#ff7a9a;border:1px solid rgba(255,0,80,.4)}

    .dgc-media{width:100%;max-height:220px;border-radius:12px;overflow:hidden;margin-bottom:10px;background:var(--l2,#f1f1f1);cursor:pointer}
    .dgc-media img{width:100%;height:100%;max-height:220px;object-fit:cover;display:block}

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

    .dgc-foot{
      display:flex;align-items:center;justify-content:space-between;gap:8px;
      padding-top:10px;border-top:1px solid var(--bd2,rgba(0,0,0,.05));flex-wrap:wrap;
    }
    .dgc-actions{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
    .dgc-topslot{display:inline-flex;align-items:center;margin-left:2px}
    .dgc-act{
      display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:20px;
      font-size:12px;font-weight:700;color:var(--tx-muted,#666);background:none;border:none;
      cursor:pointer;font-family:inherit;
    }
    .dgc-act:active{background:var(--l2,#f1f1f1)}
      .dgc-act.liked,.dgc-act.liked i{color:var(--acc,#ff0050)}
    .dgc-parts{display:flex;align-items:center}
    .dgc-part{width:22px;height:22px;border-radius:50%;object-fit:cover;border:2px solid var(--l1,#fff);margin-left:-6px;background:var(--l2,#f1f1f1)}
    .dgc-part:first-child{margin-left:0}
    .dgc-part-more{font-size:10.5px;font-weight:700;color:var(--tx-muted,#666);margin-left:5px}

    .dgc-pinned{
      background:linear-gradient(135deg,rgba(255,0,80,.05),rgba(167,139,250,.05));
      border-bottom:8px solid var(--dgc-div,var(--bg,#d8d8d8));padding:14px;margin:0;
      font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
    }
    .dgc-pinned-tag{font-size:10.5px;font-weight:800;color:var(--acc,#ff0050);display:flex;align-items:center;gap:5px;margin-bottom:6px}
    .dgc-pinned-title{font-size:14.5px;font-weight:800;color:var(--tx-high,#161616);margin-bottom:4px}
    .dgc-pinned-desc{font-size:12.5px;color:var(--tx-muted,#666);line-height:1.45;margin-bottom:10px}
    .dgc-pinned-foot{display:flex;align-items:center;justify-content:space-between}
    .dgc-pinned-stats{display:flex;gap:12px;font-size:12px;font-weight:700;color:var(--tx-muted,#666)}
    .dgc-pinned-stats i{color:var(--acc,#ff0050)}
    .dgc-pinned-more{font-size:12px;font-weight:800;color:var(--acc,#ff0050);background:none;border:none;cursor:pointer;font-family:inherit}
    .dgc-actions .drp-trigger{color:var(--tx-muted,#666)}
    .dgc-actions .drp-trigger.liked{color:var(--acc,#ff0050)}
    [data-theme="light"] .dgc-actions .drp-top3-emoji{background:#f1f1f1;border-color:#fff}
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
      display:flex;flex-direction:column;
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
    .comm-slide .dgc-foot{margin-top:8px;padding-top:8px}
    .comm-slide .dgc-media{flex-shrink:0}
    .comm-slide .dgc-story{flex-shrink:0}
  `;

  let _root = null;
  let _hooks = {};
  let _posts = [];
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

  function _find(id) {
    return _posts.find(p => String(p.id) === String(id));
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
    if (p.tag) {
      tags += `<span class="dgc-tag ${p.tagClass || 'discussion'}">${_esc(p.tag)}</span>`;
    }
    if (p.hot) tags += `<span class="dgc-tag hot"><i class="fas fa-fire"></i> Hot</span>`;
    if ((p.controversy || 0) >= 50) tags += `<span class="dgc-tag controversial"><i class="fas fa-bolt"></i> Controversial</span>`;

    const media = p.media
      ? `<div class="dgc-media" data-dgc-thread="${_esc(p.id)}"><img src="${_esc(p.media)}" alt="" loading="lazy"/></div>`
      : '';

    const story = p.story
      ? `<div class="dgc-story" data-dgc-story="${_esc(p.id)}">
          <img class="dgc-story-cover" src="${_esc(p.story.cover || '')}" alt=""/>
          <div class="dgc-story-body">
            <div class="dgc-story-lbl">${p.tagClass === 'recommendation' ? 'Recommending' : 'Discussing'}</div>
            <div class="dgc-story-title">${_esc(p.story.title || '')}</div>
            <div class="dgc-story-by">by ${_esc(p.story.writer || p.story.author || '')}</div>
          </div>
          <i class="fas fa-arrow-right dgc-story-go"></i>
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
        if (!needsMore) return full ? `<div class="dgc-body">${_esc(full)}</div>` : '';
        return `<div class="dgc-body clamp">${_esc(full)}</div>
          <button type="button" class="dgc-more" data-dgc-thread="${_esc(p.id)}">… See more</button>`;
      })()}
      ${tags ? `<div class="dgc-tags">${tags}</div>` : ''}
      ${media}${story}
      <div class="dgc-foot">
        <div class="dgc-actions">
          ${typeof _hooks.getReactionHTML === 'function'
            ? _hooks.getReactionHTML(p)
            : `<button type="button" class="dgc-act ${p.liked ? 'liked' : ''}" data-dgc-like="${_esc(p.id)}">
            <i class="${p.liked ? 'fas' : 'far'} fa-heart"></i> ${p.likes || 0}
          </button>`}
          <button type="button" class="dgc-act" data-dgc-thread="${_esc(p.id)}">
            <i class="far fa-comment"></i> ${p.comments || 0} · Thread
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
    _paint();
  }

  function update(post) {
    if (!post || post.id == null) return;
    const i = _posts.findIndex(p => String(p.id) === String(post.id));
    if (i >= 0) _posts[i] = post;
    else _posts.push(post);
    const el = _root && _root.querySelector(`[data-dgc-id="${CSS.escape ? CSS.escape(String(post.id)) : String(post.id)}"]`);
    if (el) {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderCard(post);
      const next = tmp.firstElementChild;
      if (next) el.replaceWith(next);
    } else {
      _paint();
    }
  }

  function setGenreName(name) {
    _genreName = name || '';
  }

  function setSort(sort) {
    _sort = sort || 'hot';
  }

  function attach(rootEl, hooks) {
    _injectStyles();
    _root = rootEl;
    _hooks = hooks || {};
    if (_hooks.genreName) _genreName = _hooks.genreName;
    if (_hooks.sort) _sort = _hooks.sort;

    _root.addEventListener('click', (e) => {
      const like = e.target.closest('[data-dgc-like]');
      if (like) {
        e.stopPropagation();
        const p = _find(like.dataset.dgcLike);
        if (p && typeof _hooks.onLike === 'function') _hooks.onLike(p);
        return;
      }
      const dots = e.target.closest('[data-dgc-dots]');
      if (dots) {
        e.stopPropagation();
        const p = _find(dots.dataset.dgcDots);
        if (p && typeof _hooks.onDots === 'function') _hooks.onDots(p, dots);
        return;
      }
      const share = e.target.closest('[data-dgc-share]');
      if (share) {
        e.stopPropagation();
        const p = _find(share.dataset.dgcShare);
        if (p && typeof _hooks.onShare === 'function') _hooks.onShare(p);
        return;
      }
      const story = e.target.closest('[data-dgc-story]');
      if (story) {
        e.stopPropagation();
        const p = _find(story.dataset.dgcStory);
        if (p && typeof _hooks.onStory === 'function') _hooks.onStory(p);
        return;
      }
      const pinnedMore = e.target.closest('[data-dgc-pinned-more]');
      if (pinnedMore) {
        e.stopPropagation();
        const p = _find(pinnedMore.dataset.dgcPinnedMore);
        if (p && typeof _hooks.onPinned === 'function') _hooks.onPinned(p);
        return;
      }
      const av = e.target.closest('[data-dgc-av]');
      if (av) {
        e.stopPropagation();
        const p = _find(av.dataset.dgcAv);
        if (p && typeof _hooks.onAvatar === 'function') _hooks.onAvatar(p);
        return;
      }
      const nm = e.target.closest('[data-dgc-name]');
      if (nm) {
        e.stopPropagation();
        const p = _posts.find(x => String(x.name) === String(nm.dataset.dgcName)) || _find(nm.dataset.dgcName);
        if (typeof _hooks.onNameClick === 'function') _hooks.onNameClick(p, nm.dataset.dgcName);
        else if (p && typeof _hooks.onAvatar === 'function') _hooks.onAvatar(p);
        return;
      }
      const thread = e.target.closest('[data-dgc-thread]');
      if (thread) {
        e.stopPropagation();
        const p = _find(thread.dataset.dgcThread);
        if (p && typeof _hooks.onThread === 'function') _hooks.onThread(p);
      }
    });
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
