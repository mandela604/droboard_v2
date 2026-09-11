/**
 * Enhanced Editor Pages - Generic Interactivity Layer
 * Applies to: earnings-overview, transaction-history, featured-banners,
 *             system-pages, notification-center, author-messages,
 *             contract-templates, author-verification, platform-settings,
 *             categories-genres, promotions, announcements, signed-contracts,
 *             book-review-center
 */

(function() {
  'use strict';

  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof window.DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhanceCurrentPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function enhanceCurrentPage() {
    const path = window.location.pathname;

    if (path.includes('earnings-overview')) {
      setupEarningsPage();
    } else if (path.includes('transaction-history')) {
      setupTransactionPage();
    } else if (path.includes('featured-banners')) {
      setupBannersPage();
    } else if (path.includes('system-pages')) {
      setupSystemPages();
    } else if (path.includes('notification-center')) {
      setupNotificationCenter();
    } else if (path.includes('author-messages')) {
      setupAuthorMessages();
    } else if (path.includes('contract-templates')) {
      setupContractTemplates();
    } else if (path.includes('author-verification')) {
      setupAuthorVerification();
    } else if (path.includes('platform-settings')) {
      setupPlatformSettings();
    } else if (path.includes('categories-genres')) {
      setupCategoriesPage();
    } else if (path.includes('promotions')) {
      setupPromotionsPage();
    } else if (path.includes('announcements')) {
      setupAnnouncementsPage();
    } else if (path.includes('signed-contracts')) {
      setupSignedContracts();
    } else if (path.includes('book-review-center')) {
      setupBookReviewCenter();
    }

    setupCommonFeatures();
  }

  // ── CATEGORIES & GENRES PAGE ──────────────────────────────────
  function setupCategoriesPage() {
    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentView = window.currentView || 'categories';
        if (currentView === 'categories') {
          showAddCategoryModal();
        } else {
          showAddGenreModal();
        }
      });
    }
  }

  function showAddCategoryModal() {
    const html = `
      <h2>Add New Category</h2>
      <div class="sub">Create a new book category for the platform</div>
      <div class="drm-form-group">
        <label>Category Name</label>
        <input type="text" id="catName" placeholder="e.g. Paranormal Romance"/>
      </div>
      <div class="drm-form-group">
        <label>FontAwesome Icon</label>
        <input type="text" id="catIcon" value="fa-heart" placeholder="fa-heart, fa-crown, etc."/>
      </div>
      <div class="drm-form-group">
        <label>Description</label>
        <textarea id="catDesc" placeholder="Describe the type of stories in this category..."></textarea>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="saveCatBtn">Create Category</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#saveCatBtn').addEventListener('click', async () => {
      const name = modal.querySelector('#catName').value.trim();
      const icon = modal.querySelector('#catIcon').value.trim() || 'fa-tag';
      const desc = modal.querySelector('#catDesc').value.trim() || 'Book category.';
      if (!name) { toast('Please enter a category name'); return; }
      await window.DroboardAPI.createCategory({ name, icon, desc });
      toast(`Category "${name}" created successfully!`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
      else location.reload();
    });
  }

  function showAddGenreModal() {
    const html = `
      <h2>Add New Genre</h2>
      <div class="sub">Create a sub-genre tag</div>
      <div class="drm-form-group">
        <label>Genre Name</label>
        <input type="text" id="gnrName" placeholder="e.g. Billionaire Romance"/>
      </div>
      <div class="drm-form-group">
        <label>Parent Category</label>
        <select id="gnrCat">
          <option value="Romance">Romance</option>
          <option value="Billionaire">Billionaire</option>
          <option value="Werewolf">Werewolf</option>
          <option value="Vampire">Vampire</option>
          <option value="Fantasy">Fantasy</option>
          <option value="Urban">Urban</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Icon</label>
        <input type="text" id="gnrIcon" value="fa-bookmark"/>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="saveGnrBtn">Create Genre</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#saveGnrBtn').addEventListener('click', async () => {
      const name = modal.querySelector('#gnrName').value.trim();
      const cat = modal.querySelector('#gnrCat').value;
      const icon = modal.querySelector('#gnrIcon').value.trim() || 'fa-bookmark';
      if (!name) { toast('Please enter a genre name'); return; }
      await window.DroboardAPI.createGenre({ name, cat, icon });
      toast(`Genre "${name}" created under ${cat}!`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
      else location.reload();
    });
  }

  // ── BOOK REVIEW CENTER ────────────────────────────────────────
  function setupBookReviewCenter() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button, .act-btn, a');
      if (!btn) return;
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes('approve') || btn.classList.contains('approve-btn')) {
        e.preventDefault();
        const id = btn.dataset.id || 'BK002';
        await window.DroboardAPI.approveReview(id);
        toast(`Review #${id} approved! Manuscript published.`);
        if (typeof window.refresh === 'function') window.refresh();
      } else if (txt.includes('reject') || btn.classList.contains('reject-btn')) {
        e.preventDefault();
        const id = btn.dataset.id || 'BK002';
        showRejectFeedbackModal(id);
      } else if (txt.includes('view') || txt.includes('preview')) {
        e.preventDefault();
        const id = btn.dataset.id || 'BK001256';
        if (window.openStoryModal) window.openStoryModal(id);
      }
    });
  }

  function showRejectFeedbackModal(id) {
    const html = `
      <h2>Reject Review Submission</h2>
      <div class="sub">Provide feedback to the author on required revisions</div>
      <div class="drm-form-group">
        <label>Rejection Reason</label>
        <select id="rejReason">
          <option value="formatting">Formatting Issues</option>
          <option value="guidelines">Content Guidelines Violation</option>
          <option value="plagiarism">Plagiarism Suspected</option>
          <option value="incomplete">Incomplete Chapters</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Detailed Notes for Author</label>
        <textarea id="rejNotes" placeholder="Explain what changes are needed before resubmitting..."></textarea>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" style="background:var(--red);" id="confirmRejBtn">Confirm Rejection</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#confirmRejBtn').addEventListener('click', async () => {
      await window.DroboardAPI.rejectReview(id);
      toast(`Submission #${id} rejected with feedback.`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
    });
  }

  // ── PROMOTIONS PAGE ──────────────────────────────────────────
  function setupPromotionsPage() {
    const addBtn = document.querySelector('.btn-add, #addPromoBtn');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showAddPromotionModal();
      });
    }
  }

  function showAddPromotionModal() {
    const html = `
      <h2>Create New Promotion</h2>
      <div class="sub">Launch a discount campaign or featured placement</div>
      <div class="drm-form-group">
        <label>Campaign Title</label>
        <input type="text" id="prmTitle" placeholder="e.g. Summer Romance Sale"/>
      </div>
      <div class="drm-form-group">
        <label>Promotion Type</label>
        <select id="prmType">
          <option value="Discount">Discount</option>
          <option value="Featured Banner">Featured Banner</option>
          <option value="Spotlight">Spotlight Deal</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Target Story or Category</label>
        <input type="text" id="prmTarget" placeholder="e.g. The Ruthless CEO or Romance"/>
      </div>
      <div class="drm-form-group">
        <label>Discount / Offer Value</label>
        <input type="text" id="prmVal" placeholder="e.g. 50% OFF or Free Chapter 1"/>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="savePrmBtn">Launch Promotion</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#savePrmBtn').addEventListener('click', async () => {
      const title = modal.querySelector('#prmTitle').value.trim();
      const type = modal.querySelector('#prmType').value;
      const target = modal.querySelector('#prmTarget').value.trim() || 'All Stories';
      const value = modal.querySelector('#prmVal').value.trim() || '20% OFF';
      if (!title) { toast('Please enter a promotion title'); return; }
      await window.DroboardAPI.createPromotion({ title, type, target, value });
      toast(`Promotion "${title}" launched!`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
      else location.reload();
    });
  }

  // ── BANNERS PAGE ──────────────────────────────────────────────
  function setupBannersPage() {
    const addBtn = document.querySelector('.btn-add, #addBannerBtn');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showAddBannerModal();
      });
    }
  }

  function showAddBannerModal() {
    const html = `
      <h2>Add Featured Banner</h2>
      <div class="sub">Add a promotional banner to the mobile app carousel</div>
      <div class="drm-form-group">
        <label>Banner Title</label>
        <input type="text" id="bnrTitle" placeholder="e.g. Must Read Werewolf Series"/>
      </div>
      <div class="drm-form-group">
        <label>Target Destination Link</label>
        <input type="text" id="bnrLink" placeholder="e.g. /category/werewolf or /book/BK001255"/>
      </div>
      <div class="drm-form-group">
        <label>Carousel Position</label>
        <select id="bnrPos">
          <option value="Home Slider 1">Home Slider 1 (Hero)</option>
          <option value="Home Slider 2">Home Slider 2</option>
          <option value="Category Top Banner">Category Top Banner</option>
        </select>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="saveBnrBtn">Add Banner</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#saveBnrBtn').addEventListener('click', async () => {
      const title = modal.querySelector('#bnrTitle').value.trim();
      const link = modal.querySelector('#bnrLink').value.trim() || '/';
      const pos = modal.querySelector('#bnrPos').value;
      if (!title) { toast('Please enter a banner title'); return; }
      await window.DroboardAPI.createBanner({ title, link, pos });
      toast(`Banner "${title}" added to carousel!`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
      else location.reload();
    });
  }

  // ── ANNOUNCEMENTS PAGE ────────────────────────────────────────
  function setupAnnouncementsPage() {
    const addBtn = document.querySelector('.btn-add, #addAncBtn');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showAddAnnouncementModal();
      });
    }
  }

  function showAddAnnouncementModal() {
    const html = `
      <h2>New System Announcement</h2>
      <div class="sub">Broadcast an update to authors or readers</div>
      <div class="drm-form-group">
        <label>Announcement Title</label>
        <input type="text" id="ancTitle" placeholder="e.g. Q3 Royalty Rates Update"/>
      </div>
      <div class="drm-form-group">
        <label>Target Audience</label>
        <select id="ancAudience">
          <option value="All Authors">All Authors</option>
          <option value="All Readers">All Readers</option>
          <option value="All Users">All Users</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Priority Level</label>
        <select id="ancPriority">
          <option value="Normal">Normal</option>
          <option value="High">High (Pinned to top)</option>
          <option value="Urgent">Urgent Banner</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Announcement Body</label>
        <textarea id="ancBody" placeholder="Write full announcement message..."></textarea>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="saveAncBtn">Publish Announcement</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#saveAncBtn').addEventListener('click', async () => {
      const title = modal.querySelector('#ancTitle').value.trim();
      const audience = modal.querySelector('#ancAudience').value;
      const priority = modal.querySelector('#ancPriority').value;
      const body = modal.querySelector('#ancBody').value.trim() || 'System announcement.';
      if (!title) { toast('Please enter an announcement title'); return; }
      await window.DroboardAPI.createAnnouncement({ title, audience, priority, body });
      toast(`Announcement "${title}" published!`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
      else location.reload();
    });
  }

  // ── CONTRACT TEMPLATES ───────────────────────────────────────
  function setupContractTemplates() {
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showAddTemplateModal();
      });
    }
  }

  function showAddTemplateModal() {
    const html = `
      <h2>Create Contract Template</h2>
      <div class="sub">Add a standard legal template for author contracts</div>
      <div class="drm-form-group">
        <label>Template Name</label>
        <input type="text" id="tplName" placeholder="e.g. Exclusive Tier-1 Publishing Agreement"/>
      </div>
      <div class="drm-form-group">
        <label>Contract Type</label>
        <select id="tplType">
          <option value="Exclusive">Exclusive Publishing</option>
          <option value="Revenue Share">Revenue Share</option>
          <option value="License Agreement">License Agreement</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Default Royalty Share (%)</label>
        <input type="text" id="tplRoyalty" value="70%"/>
      </div>
      <div class="drm-form-group">
        <label>Contract Term Duration</label>
        <input type="text" id="tplDuration" value="2 Years"/>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="saveTplBtn">Save Template</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#saveTplBtn').addEventListener('click', async () => {
      const name = modal.querySelector('#tplName').value.trim();
      const type = modal.querySelector('#tplType').value;
      const royalty = modal.querySelector('#tplRoyalty').value.trim() || '70%';
      const duration = modal.querySelector('#tplDuration').value.trim() || '2 Years';
      if (!name) { toast('Please enter a template name'); return; }
      await window.DroboardAPI.createTemplate({ name, type, royalty, duration });
      toast(`Contract template "${name}" saved!`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
      else location.reload();
    });
  }

  // ── AUTHOR MESSAGES ──────────────────────────────────────────
  function setupAuthorMessages() {
    const replyBtns = document.querySelectorAll('.btn-reply, .msg-reply-btn');
    replyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showReplyModal();
      });
    });
  }

  function showReplyModal() {
    const html = `
      <h2>Send Message to Author</h2>
      <div class="sub">Direct communication with contracted authors</div>
      <div class="drm-form-group">
        <label>Author Name or Email</label>
        <input type="text" id="msgAuthor" value="Luna Skye"/>
      </div>
      <div class="drm-form-group">
        <label>Subject</label>
        <input type="text" id="msgSubj" value="RE: June Royalty Finalization"/>
      </div>
      <div class="drm-form-group">
        <label>Message Content</label>
        <textarea id="msgBody" placeholder="Type your message to the author..."></textarea>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="sendMsgBtn">Send Message</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#sendMsgBtn').addEventListener('click', async () => {
      const author = modal.querySelector('#msgAuthor').value;
      const subject = modal.querySelector('#msgSubj').value;
      const text = modal.querySelector('#msgBody').value.trim() || 'Message sent.';
      await window.DroboardAPI.sendMessage({ author, subject, text });
      toast(`Message sent to ${author}!`);
      DroboardModal.close(modal);
    });
  }

  // ── AUTHOR VERIFICATION ───────────────────────────────────────
  function setupAuthorVerification() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button, .act-btn');
      if (!btn) return;
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes('approve') || btn.classList.contains('approve-btn')) {
        e.preventDefault();
        const id = btn.dataset.id || 'VRF-001';
        await window.DroboardAPI.approveVerification(id);
        toast(`Author verification #${id} approved! Badge issued.`);
        if (typeof window.refresh === 'function') window.refresh();
      } else if (txt.includes('reject')) {
        e.preventDefault();
        const id = btn.dataset.id || 'VRF-001';
        await window.DroboardAPI.rejectVerification(id);
        toast(`Author verification #${id} rejected.`);
        if (typeof window.refresh === 'function') window.refresh();
      } else if (txt.includes('document') || txt.includes('view id')) {
        e.preventDefault();
        showDocViewerModal();
      }
    });
  }

  function showDocViewerModal() {
    const html = `
      <h2>Submitted Identity Document</h2>
      <div class="sub">National Passport & Tax ID Verification</div>
      <div style="text-align:center;margin:16px 0;">
        <img src="https://i.postimg.cc/0MyxNqfz/7.jpg" style="max-width:100%;border-radius:12px;border:1px solid var(--border);box-shadow:0 4px 14px rgba(0,0,0,0.2)"/>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Close</button>
        <button class="drm-btn drm-ok" onclick="DroboardModal.closeTop(); toast('Verification approved!');">Approve Verification</button>
      </div>
    `;
    DroboardModal.show(html, { width: '560px' });
  }

  // ── PLATFORM SETTINGS ────────────────────────────────────────
  function setupPlatformSettings() {
    const saveBtn = document.querySelector('.btn-save, #saveSettingsBtn, button[type="submit"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const siteName = document.getElementById('siteName')?.value || 'TikStory Portal';
        const currency = document.getElementById('currencySelect')?.value || 'USD ($)';
        const authorRoyalty = document.getElementById('royaltyRate')?.value || '70';
        await window.DroboardAPI.saveSettings({ siteName, currency, authorRoyalty });
        toast('Platform settings saved successfully!');
      });
    }
  }

  // ── SYSTEM PAGES ──────────────────────────────────────────────
  function setupSystemPages() {
    const editBtns = document.querySelectorAll('.btn-edit-page, .act-btn');
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showSystemPageEditorModal();
      });
    });
  }

  function showSystemPageEditorModal() {
    const html = `
      <h2>Edit System Page</h2>
      <div class="sub">Modify Terms of Service, Privacy Policy, or FAQ</div>
      <div class="drm-form-group">
        <label>Page Title</label>
        <input type="text" id="sysPageTitle" value="Terms of Service"/>
      </div>
      <div class="drm-form-group">
        <label>Page Content (HTML/Markdown)</label>
        <textarea id="sysPageBody" style="min-height:160px;">Welcome to our platform. By accessing or using our service, you agree to be bound by these terms.</textarea>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="saveSysPageBtn">Save Changes</button>
      </div>
    `;
    const modal = DroboardModal.show(html, { width: '600px' });
    modal.querySelector('#saveSysPageBtn').addEventListener('click', async () => {
      const title = modal.querySelector('#sysPageTitle').value;
      const body = modal.querySelector('#sysPageBody').value;
      await window.DroboardAPI.updateSystemPage('terms', { title, body });
      toast(`System page "${title}" updated!`);
      DroboardModal.close(modal);
    });
  }

  // ── SIGNED CONTRACTS ─────────────────────────────────────────
  function setupSignedContracts() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-doc-btn, .act-btn');
      if (!btn) return;
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes('view') || txt.includes('document')) {
        e.preventDefault();
        showSignedDocumentModal();
      }
    });
  }

  function showSignedDocumentModal() {
    const html = `
      <h2>Signed Legal Document</h2>
      <div class="sub">Contract ID: CNTR-2026-00125 — Digital Signature Verified</div>
      <div style="background:var(--input-bg);border:1px solid var(--input-border);padding:18px;border-radius:12px;font-size:12.5px;line-height:1.6;margin:14px 0;max-height:260px;overflow-y:auto;">
        <h4 style="margin-bottom:8px;">EXCLUSIVE PUBLISHING AGREEMENT</h4>
        <p>This agreement is made between <strong>TikStory Publishing Ltd</strong> and <strong>Luna Skye</strong> for the literary manuscript titled <em>"Bound by the Ruthless Alpha"</em>.</p>
        <br/>
        <p><strong>Terms:</strong> Exclusive World Rights in All Formats, 70% Net Revenue Royalty Share, Effective Term: 24 Months.</p>
        <br/>
        <div style="border-top:1px dashed var(--border);padding-top:10px;display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);">
          <div>Author Signature: <em>Luna Skye (Verified ID)</em></div>
          <div>Date: Jun 14, 2026</div>
        </div>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Close</button>
        <button class="drm-btn drm-ok" onclick="toast('Downloading PDF contract document…'); DroboardModal.closeTop();"><i class="fas fa-download"></i> Download PDF</button>
      </div>
    `;
    DroboardModal.show(html, { width: '580px' });
  }

  // ── NOTIFICATION CENTER ───────────────────────────────────────
  function setupNotificationCenter() {
    const markReadBtn = document.querySelector('.mark-read-btn, #markAllReadBtn');
    if (markReadBtn) {
      markReadBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await window.DroboardAPI.markAllRead();
        toast('All notifications marked as read');
        if (typeof window.refresh === 'function') window.refresh();
      });
    }
  }

  function setupEarningsPage() { setupDateRangePicker(); setupExport(); }
  function setupTransactionPage() { setupDateRangePicker(); setupExport(); }

  // ── COMMON FEATURES: DATE RANGE PICKER & EXPORT ───────────────
  function setupCommonFeatures() {
    setupDateRangePicker();
    setupExport();
  }

  function setupDateRangePicker() {
    const dateBtns = document.querySelectorAll('.date-range, .date-btn, #dateRangeBtn');
    dateBtns.forEach(btn => {
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showDateRangeModal();
      });
    });
  }

  function showDateRangeModal() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const html = `
      <h2>Filter by Date Range</h2>
      <div class="sub">Select timeframe for analytics and logs</div>
      <div class="drm-form-group">
        <label>Start Date</label>
        <input type="date" id="dateStart" value="${lastMonth.toISOString().split('T')[0]}"/>
      </div>
      <div class="drm-form-group">
        <label>End Date</label>
        <input type="date" id="dateEnd" value="${today.toISOString().split('T')[0]}"/>
      </div>
      <div class="drm-form-group">
        <label>Quick Preset</label>
        <select id="quickRange" onchange="window.applyQuickRange(this.value)">
          <option value="">Custom Selection</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month" selected>This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="window.applyDateFilter()">Apply Filter</button>
      </div>
    `;
    DroboardModal.show(html);

    window.applyQuickRange = function(val) {
      const s = document.getElementById('dateStart');
      const e = document.getElementById('dateEnd');
      const t = new Date();
      if (val === 'today') {
        s.value = e.value = t.toISOString().split('T')[0];
      } else if (val === 'week') {
        const w = new Date(t.getFullYear(), t.getMonth(), t.getDate() - t.getDay());
        s.value = w.toISOString().split('T')[0];
        e.value = t.toISOString().split('T')[0];
      } else if (val === 'month') {
        s.value = new Date(t.getFullYear(), t.getMonth(), 1).toISOString().split('T')[0];
        e.value = t.toISOString().split('T')[0];
      } else if (val === 'year') {
        s.value = new Date(t.getFullYear(), 0, 1).toISOString().split('T')[0];
        e.value = t.toISOString().split('T')[0];
      }
    };

    window.applyDateFilter = function() {
      const s = document.getElementById('dateStart').value;
      const e = document.getElementById('dateEnd').value;
      toast(`Filtered data from ${s} to ${e}`);
      DroboardModal.closeTop();
      if (typeof window.refresh === 'function') window.refresh();
    };
  }

  function setupExport() {
    const exportBtns = document.querySelectorAll('.btn-export, .export-btn, #exportBtn');
    exportBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toast('Exporting table data to CSV file…');
      });
    });
  }
})();