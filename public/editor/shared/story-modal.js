/**
 * story-modal.js — Shared Story Viewer & Editor Modal for Droboard Editor
 * ─────────────────────────────────────────────────────────────────────
 * Provides window.openStoryModal(bookId) accessible from any editor page.
 */
(function() {
  'use strict';

  if (window.openStoryModal) return;

  window.openStoryModal = async function(bookId) {
    if (!window.DroboardAPI || !window.DroboardModal) {
      console.warn('[StoryModal] DroboardAPI or DroboardModal not available.');
      return;
    }

    const book = await window.DroboardAPI.getBookById(bookId);
    if (!book) {
      if (typeof window.toast === 'function') window.toast('Story not found');
      return;
    }

    const chapters = [
      { num: 1, title: 'The Unexpected Encounter', length: '1,850 words', views: '24.2k' },
      { num: 2, title: 'Royal Decree & Hidden Truths', length: '2,100 words', views: '19.8k' },
      { num: 3, title: 'Shadows of the Past', length: '1,940 words', views: '16.5k' },
      { num: 4, title: 'The Ultimatum', length: '2,400 words', views: '14.1k' },
    ];

    const html = `
      <div class="stm-wrap">
        <div class="stm-header">
          <div class="stm-cover-box">
            <img src="${book.img}" alt="${book.title}" class="stm-cover"/>
            <span class="stm-badge ${book.status.toLowerCase().replace(/\s+/g, '-')}">${book.status}</span>
          </div>
          <div class="stm-info">
            <h2 class="stm-title">${book.title}</h2>
            <div class="stm-author-row">
              <img src="${book.avatar || 'https://i.pravatar.cc/100?img=33'}" class="stm-avatar"/>
              <span class="stm-author">${book.author}</span>
            </div>
            <div class="stm-tags">
              <span class="stm-tag cat">${book.cat}</span>
              <span class="stm-tag genre">${book.genre}</span>
            </div>
            <div class="stm-stats-row">
              <div><b>${book.views || '0'}</b> Views</div>
              <div><b>ID:</b> ${book.id}</div>
              <div><b>Added:</b> ${book.added || 'Recently'}</div>
            </div>
          </div>
        </div>

        <div class="stm-section">
          <label class="stm-lbl">Story Synopsis</label>
          <p class="stm-desc">${book.desc || 'No detailed synopsis provided yet for this manuscript.'}</p>
        </div>

        <div class="stm-section">
          <label class="stm-lbl">Chapters (${chapters.length} available)</label>
          <div class="stm-chapters">
            ${chapters.map(c => `
              <div class="stm-chapter-item">
                <div>
                  <strong>Ch. ${c.num}: ${c.title}</strong>
                  <span class="stm-ch-sub">${c.length} • ${c.views} reads</span>
                </div>
                <button class="stm-ch-btn" onclick="toast('Loading chapter ${c.num} preview…')">Preview</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="stm-section">
          <label class="stm-lbl">Editorial Status Control</label>
          <div class="stm-status-change">
            <select id="stmStatusSelect" class="stm-select">
              <option value="Published" ${book.status === 'Published' ? 'selected' : ''}>Published</option>
              <option value="Under Review" ${book.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
              <option value="Draft" ${book.status === 'Draft' ? 'selected' : ''}>Draft</option>
              <option value="Flagged" ${book.status === 'Flagged' ? 'selected' : ''}>Flagged</option>
            </select>
            <button class="stm-save-btn" id="stmSaveStatusBtn">Update Status</button>
          </div>
        </div>

        <div class="stm-actions">
          <button class="stm-btn stm-btn-secondary" onclick="DroboardModal.closeTop()">Close</button>
          <button class="stm-btn stm-btn-primary" onclick="window.open('../public/createz.html?id=${book.id}', '_blank')">
            <i class="fas fa-pen-to-square"></i> Edit in Story Creator
          </button>
          <button class="stm-btn stm-btn-accent" onclick="window.open('../public/readz.html?id=${book.id}', '_blank')">
            <i class="fas fa-book-open"></i> Read Live Story
          </button>
        </div>
      </div>
    `;

    const modal = window.DroboardModal.show(html, { width: '640px' });

    modal.querySelector('#stmSaveStatusBtn').addEventListener('click', async () => {
      const newStatus = modal.querySelector('#stmStatusSelect').value;
      await window.DroboardAPI.updateBook(book.id, { status: newStatus });
      if (typeof window.toast === 'function') window.toast(`Story status updated to "${newStatus}"`);
      window.DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
      else location.reload();
    });
  };

  // Inject Story Modal CSS
  const css = `
    .stm-wrap { color: var(--text); font-family: 'Inter', system-ui, sans-serif; }
    .stm-header { display: flex; gap: 18px; margin-bottom: 20px; }
    .stm-cover-box { position: relative; width: 110px; flex-shrink: 0; }
    .stm-cover { width: 110px; height: 155px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border); box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
    .stm-badge { position: absolute; bottom: 8px; left: 8px; right: 8px; text-align: center; font-size: 10px; font-weight: 800; padding: 4px 6px; border-radius: 20px; background: rgba(0,0,0,0.75); color: #fff; text-transform: uppercase; }
    .stm-badge.published { background: var(--green); }
    .stm-badge.under-review { background: var(--amber); }
    .stm-badge.draft { background: var(--text-muted); }
    .stm-badge.flagged { background: var(--red); }
    .stm-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .stm-title { font-size: 18px; font-weight: 800; margin-bottom: 8px; line-height: 1.3; }
    .stm-author-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .stm-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
    .stm-author { font-size: 13px; font-weight: 600; color: var(--text-muted); }
    .stm-tags { display: flex; gap: 8px; margin-bottom: 12px; }
    .stm-tag { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 8px; }
    .stm-tag.cat { background: var(--accent-soft); color: var(--accent); }
    .stm-tag.genre { background: var(--blue-bg); color: var(--blue); }
    .stm-stats-row { display: flex; gap: 14px; font-size: 11.5px; color: var(--text-muted); }
    .stm-section { margin-bottom: 18px; }
    .stm-lbl { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 6px; }
    .stm-desc { font-size: 13px; color: var(--text); line-height: 1.5; background: var(--input-bg); border: 1px solid var(--input-border); padding: 12px; border-radius: 10px; }
    .stm-chapters { display: flex; flex-direction: column; gap: 8px; max-height: 160px; overflow-y: auto; }
    .stm-chapter-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-size: 12.5px; }
    .stm-ch-sub { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .stm-ch-btn { background: none; border: 1px solid var(--input-border); color: var(--text); padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; }
    .stm-ch-btn:hover { border-color: var(--accent); color: var(--accent); }
    .stm-status-change { display: flex; gap: 10px; }
    .stm-select { flex: 1; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; padding: 9px 12px; color: var(--text); font-size: 13px; font-weight: 600; outline: none; }
    .stm-save-btn { background: var(--accent); color: #fff; border: none; border-radius: 10px; padding: 9px 18px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
    .stm-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; flex-wrap: wrap; }
    .stm-btn { padding: 10px 16px; border-radius: 10px; font-size: 12.5px; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit; }
    .stm-btn-secondary { background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text); }
    .stm-btn-primary { background: var(--blue-bg); color: var(--blue); }
    .stm-btn-accent { background: var(--accent); color: #fff; }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
})();
