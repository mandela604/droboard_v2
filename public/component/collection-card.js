/* ═══════════════════════════════════════════════════════════════
   COLLECTION CARD COMPONENT
   Renders collection folders with cover grids. Click to expand
   and see stories inside. Self-contained: injects own CSS.
   Exposes: window.DroboardCollectionCard (attach / setCollections)
   Also: window.CollectionCard (legacy render helpers)
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardCollectionCard) return;

  const CSS = `
    .dcc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .dcc-card{background:var(--l1,#fff);border:1px solid var(--bd,#efedf2);border-radius:14px;overflow:hidden;cursor:pointer;transition:transform .15s;position:relative}
    .dcc-manage{position:absolute;top:6px;right:6px;z-index:4;width:28px;height:28px;border-radius:50%;border:1px solid var(--bd,#efedf2);background:rgba(255,255,255,.95);color:var(--tx-high,#17151b);font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.15);line-height:1}
    .dcc-menu{position:absolute;top:38px;right:6px;z-index:5;min-width:168px;background:var(--l1,#fff);border:1px solid var(--bd,#efedf2);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14);overflow:hidden;display:none}
    .dcc-menu.open{display:block}
    .dcc-menu-item{display:flex;align-items:center;gap:9px;width:100%;padding:11px 13px;font-size:12px;font-weight:600;color:var(--tx-body,#3a3a3a);background:none;border:none;cursor:pointer;text-align:left}
    .dcc-menu-item:active{background:var(--l2,#f3f1f5)}
    .dcc-menu-item.danger{color:#dc2626}
    .dcc-menu-item + .dcc-menu-item{border-top:1px solid var(--bd2,#f0f0f0)}
    .dcc-card:active{transform:scale(.97)}
    .dcc-covers{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px;height:110px;padding:8px 8px 0}
    .dcc-cov{border-radius:6px;overflow:hidden;background:var(--l2,#f3f1f5)}
    .dcc-cov img{width:100%;height:100%;object-fit:cover;display:block}
    .dcc-cov.single{grid-column:1/-1;grid-row:1/-1}
    .dcc-cov.empty{background:var(--l2,#f3f1f5)}
    .dcc-info{padding:10px 12px 12px}
    .dcc-name{font-size:12.5px;font-weight:700;color:var(--tx-high,#17151b);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dcc-meta{font-size:10px;color:var(--tx-muted,#635f6e);display:flex;align-items:center;gap:6px}
    .dcc-priv{font-size:8px;font-weight:700;padding:2px 6px;border-radius:6px;text-transform:uppercase;letter-spacing:.03em}
    .dcc-priv.public{background:rgba(52,211,153,.1);color:#0d9668}
    .dcc-priv.private{background:rgba(255,0,80,.08);color:var(--acc,#ff0050)}
    .dcc-stories{display:none;padding:8px}
    .dcc-stories.open{display:block}
    .dcc-story{display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;cursor:pointer;transition:background .12s;text-decoration:none;color:inherit}
    .dcc-story:active{background:var(--l2,#f3f1f5)}
    .dcc-story-av{width:42px;height:56px;border-radius:7px;overflow:hidden;flex-shrink:0;background:var(--l2,#f3f1f5)}
    .dcc-story-av img{width:100%;height:100%;object-fit:cover;display:block}
    .dcc-story-info{flex:1;min-width:0}
    .dcc-story-title{font-size:12px;font-weight:700;color:var(--tx-high,#17151b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dcc-story-meta{font-size:10px;color:var(--tx-muted,#635f6e);margin-top:2px;display:flex;gap:8px}
    .dcc-story-badge{font-size:8px;font-weight:700;padding:2px 6px;border-radius:6px;text-transform:uppercase}
    .dcc-story-badge.hot{background:rgba(255,0,80,.08);color:var(--acc,#ff0050)}
    .dcc-story-badge.new{background:rgba(56,189,248,.1);color:#0284c7}
    .dcc-story-badge.updated{background:rgba(167,139,250,.1);color:#7c3aed}
    .dcc-story-badge.free{background:rgba(52,211,153,.1);color:#0d9668}
    .dcc-back{display:none;align-items:center;gap:6px;padding:6px 12px;font-size:11px;font-weight:700;color:var(--tx-muted,#635f6e);cursor:pointer;border:none;background:none}
    .dcc-back.show{display:flex}
    .dcc-empty{grid-column:1/-1;text-align:center;padding:30px;color:var(--tx-muted,#635f6e);font-size:12px}
    .dcc-empty i{font-size:20px;display:block;margin-bottom:8px;opacity:.5}
    .new-coll-btn{width:100%;padding:10px;border-radius:13px;background:rgba(0,0,0,.02);border:1px dashed var(--bd,#efedf2);color:var(--tx-faint,#8a8a8a);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px}
  `;

  function injectStyles() {
    if (document.getElementById('dcc-style')) return;
    const s = document.createElement('style');
    s.id = 'dcc-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  let _container = null;
  let _collections = [];
  let _options = {};
  let _expandedId = null;
  let _docBound = false;

  function renderCovers(covers) {
    if (!covers || !covers.length) return '<div class="dcc-cov empty"></div>';
    if (covers.length === 1) return `<div class="dcc-cov single"><img src="${covers[0]}" alt="" loading="lazy"/></div>`;
    const show = covers.slice(0, 4);
    return show.map(c => `<div class="dcc-cov"><img src="${c}" alt="" loading="lazy"/></div>`).join('');
  }

  function renderGrid() {
    if (!_container) return;
    if (_expandedId) {
      const col = _collections.find(c => c.id === _expandedId);
      if (!col) { _expandedId = null; renderGrid(); return; }
      const stories = col.stories || [];
      let html = `<button class="dcc-back show" data-dcc-back><i class="fas fa-arrow-left"></i> Back to collections</button>`;
      html += `<div style="padding:0 4px"><div style="font-size:13px;font-weight:700;color:var(--tx-high);margin-bottom:8px">${col.name}</div>`;
      if (!stories.length) {
        html += `<div class="dcc-empty"><i class="fas fa-folder-open"></i>No stories in this collection yet.</div>`;
      } else {
        html += stories.map(st => {
          const href = `bridge.html?id=${encodeURIComponent(st.id || st.title || '')}`;
          const badgeCls = st.badge ? st.badge.toLowerCase() : '';
          return `<a class="dcc-story" href="${href}">
            <div class="dcc-story-av"><img src="${st.cover}" alt="" loading="lazy"/></div>
            <div class="dcc-story-info">
              <div class="dcc-story-title">${st.title || ''}</div>
              <div class="dcc-story-meta">
                <span>${st.author || ''}</span>
                <span>${st.reads || ''}</span>
                ${st.badge ? `<span class="dcc-story-badge ${badgeCls}">${st.badge}</span>` : ''}
              </div>
            </div>
          </a>`;
        }).join('');
      }
      html += '</div>';
      _container.innerHTML = html;
      _container.querySelector('[data-dcc-back]')?.addEventListener('click', () => { _expandedId = null; renderGrid(); });
      return;
    }

    if (!_collections.length) {
      _container.innerHTML = `<div class="dcc-empty" style="grid-column:1/-1"><i class="fas fa-folder"></i>No collections yet.</div>`;
      return;
    }
    // When hrefFor is provided, cards navigate (e.g. profile →
    // collection.html?id=…) as real links. With onManage they also get a
    // ＋ button for owners. Otherwise they expand inline to show stories.
    const linkFor = (typeof _options.hrefFor === 'function') ? _options.hrefFor : null;
    const manageable = (typeof _options.onManage === 'function');
    _container.innerHTML = _collections.map(c => {
      const privCls = (c.privacy || 'public').toLowerCase();
      const asLink = linkFor && !manageable;
      const tag = asLink ? 'a' : 'div';
      const href = asLink ? ` href="${linkFor(c)}"` : '';
      const style = asLink ? ' style="text-decoration:none;color:inherit"' : '';
      const manage = manageable ? `<button class="dcc-manage" data-dcc-dots="${c.id}" title="Manage collection">⋯</button>
        <div class="dcc-menu" data-dcc-menufor="${c.id}">
          <button class="dcc-menu-item" data-dcc-act="open" data-dcc-id="${c.id}">📂 Open full page</button>
          <button class="dcc-menu-item" data-dcc-act="edit" data-dcc-id="${c.id}">✏️ Edit (name, stories)</button>
          <button class="dcc-menu-item danger" data-dcc-act="delete" data-dcc-id="${c.id}">🗑️ Delete</button>
        </div>` : '';
      return `<${tag} class="dcc-card" data-dcc-id="${c.id}"${href}${style}>${manage}
        <div class="dcc-covers">${renderCovers(c.covers)}</div>
        <div class="dcc-info">
          <div class="dcc-name">${c.name || ''}</div>
          <div class="dcc-meta">
            <span>${c.count || 0} stories</span>
            <span class="dcc-priv ${privCls}">${c.privacy || 'Public'}</span>
          </div>
        </div>
      </${tag}>`;
    }).join('');

    if (manageable) {
      _container.querySelectorAll('[data-dcc-dots]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          const id = String(btn.dataset.dccDots);
          const menu = _container.querySelector(`[data-dcc-menufor="${id}"]`);
          const wasOpen = menu && menu.classList.contains('open');
          _container.querySelectorAll('.dcc-menu.open').forEach(m => m.classList.remove('open'));
          if (menu && !wasOpen) menu.classList.add('open');
        });
      });
      _container.querySelectorAll('[data-dcc-act]').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          _container.querySelectorAll('.dcc-menu.open').forEach(m => m.classList.remove('open'));
          const col = _collections.find(c => String(c.id) === String(item.dataset.dccId));
          if (col) _options.onManage(col, item.dataset.dccAct);
        });
      });
      if (!_docBound) {
        _docBound = true;
        document.addEventListener('click', () => {
          document.querySelectorAll('.dcc-menu.open').forEach(m => m.classList.remove('open'));
        });
      }
    }
    if (linkFor && !manageable) return; // real navigation — no inline expansion
    if (manageable && linkFor) {
      _container.querySelectorAll('.dcc-card').forEach(card => {
        card.addEventListener('click', () => {
          const col = _collections.find(c => String(c.id) === String(card.dataset.dccId));
          if (col) location.href = linkFor(col);
        });
      });
      return;
    }
    _container.querySelectorAll('.dcc-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.dccId;
        _expandedId = id;
        const col = _collections.find(c => c.id === id);
        if (col && _options.onOpen) _options.onOpen(col);
        renderGrid();
      });
    });
  }

  function attach(containerEl, options) {
    injectStyles();
    _container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
    _options = options || {};
    _expandedId = null;
    if (_container) _container.classList.add('dcc-grid');
    // Wire the page's "+ New" button (e.g. profile's #newCollBtn) to onCreateNew
    const btn = _options.createButtonEl
      ? (typeof _options.createButtonEl === 'string' ? document.querySelector(_options.createButtonEl) : _options.createButtonEl)
      : null;
    if (btn && !btn.dataset.dccWired) {
      btn.dataset.dccWired = '1';
      btn.addEventListener('click', () => { if (_options.onCreateNew) _options.onCreateNew(); });
    }
    return { setCollections: setCollections };
  }

  function setCollections(collections) {
    _collections = collections || [];
    _expandedId = null;
    renderGrid();
  }

  window.DroboardCollectionCard = { attach, setCollections };

  /* ── Legacy helpers (used by collection.html) ── */
  function renderStoryCard(story) {
    injectStyles();
    const href = `bridge.html?id=${encodeURIComponent(story.id || story.title || '')}`;
    return `<a class="dcc-story" href="${href}" style="text-decoration:none;color:inherit">
      <div class="dcc-story-av"><img src="${story.cover}" alt="" loading="lazy"/></div>
      <div class="dcc-story-info">
        <div class="dcc-story-title">${story.title || ''}</div>
        <div class="dcc-story-meta"><span>${story.author || ''}</span><span>${story.reads || ''}</span></div>
      </div>
    </a>`;
  }
  function renderGridCard(story) {
    injectStyles();
    const href = `bridge.html?id=${encodeURIComponent(story.id || story.title || '')}`;
    return `<a class="dcc-story" href="${href}" style="text-decoration:none;color:inherit">
      <div class="dcc-story-av"><img src="${story.cover}" alt="" loading="lazy"/></div>
      <div class="dcc-story-info">
        <div class="dcc-story-title">${story.title || ''}</div>
        <div class="dcc-story-meta"><span>${story.author || ''}</span><span>${story.reads || ''}</span></div>
      </div>
    </a>`;
  }
  function renderStoryList(containerId, stories) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = stories.map(renderStoryCard).join('');
  }
  function renderGridList(containerId, stories) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = stories.map(renderGridCard).join('');
  }
  window.CollectionCard = { renderStoryCard, renderGridCard, renderStoryList, renderGridList };
})();
