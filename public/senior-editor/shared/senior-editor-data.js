/**
 * senior-editor-data.js — Data layer for Senior Editor pages.
 * ──────────────────────────────────────────────────────────────
 * Every function tries the real backend first and falls back to
 * demo data. Set window.DROBOARD_API_BASE to switch to production.
 */
(function () {
  'use strict';
  if (window.__seniorEditorData) return;
  window.__seniorEditorData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor';
  const TIMEOUT_MS = 2500;

  async function callBackend(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Bad response: ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms || 200 + Math.random() * 200)); }

  const DEMO = {
    /* ── Dashboard ── */
    dashboard: {
      assignedAuthors: 24,
      pendingReviews: 18,
      recentSubmissions: 42,
      approvalRate: 87,
      submissionsThisWeek: 18,
      avgTurnaround: '3.4h',
      recentSubs: [
        { title: 'The CEO\'s Hidden Son - Ch.24', author: 'Luna Skye', genre: 'Billionaire & CEO', submitted: '2h ago', status: 'pending' },
        { title: 'Wolf King\'s Vow - Ch.12', author: 'Elena Vasquez', genre: 'Werewolf & Fantasy', submitted: '4h ago', status: 'pending' },
        { title: 'Betrayed by the Mafia Prince - Ch.7', author: 'Marcus Webb Jr.', genre: 'Mafia & Urban', submitted: '6h ago', status: 'pending' },
        { title: 'Revenge at the Ivy League - Ch.3', author: 'Wren Okonkwo', genre: 'Campus & Revenge', submitted: '8h ago', status: 'approved' },
        { title: 'The Duke\'s Secret - Ch.31', author: 'Isabelle Moreau', genre: 'Historical & Regency', submitted: '12h ago', status: 'approved' },
      ],
      quickActions: [
        { label: 'Review Pending Submissions', icon: 'fa-inbox', cls: 'red', count: 18 },
        { label: 'Check Plagiarism Reports', icon: 'fa-copy', cls: 'amber', count: 3 },
        { label: 'Respond to Author Messages', icon: 'fa-comment-dots', cls: 'blue', count: 7 },
        { label: 'Select Editor\'s Pick', icon: 'fa-award', cls: 'purple' },
      ],
      activity: [
        { icon: 'fa-check-circle', color: 'green', text: 'Approved <b>The Duke\'s Secret - Ch.31</b> by Isabelle Moreau', time: '1h ago' },
        { icon: 'fa-pen', color: 'accent', text: 'Left feedback on <b>Wolf King\'s Vow - Ch.11</b>', time: '3h ago' },
        { icon: 'fa-flag', color: 'amber', text: 'Flagged <b>Mafia Prince - Ch.6</b> for content review', time: '5h ago' },
        { icon: 'fa-star', color: 'purple', text: 'Selected <b>CEO\'s Hidden Son</b> as Editor\'s Pick', time: '1d ago' },
      ],
    },

    /* ── Review Queue ── */
    reviewQueue: {
      items: [
        { id: 'REV-001', title: 'The CEO\'s Hidden Son - Ch.24', author: 'Luna Skye', genre: 'Billionaire & CEO', submitted: '2h ago', words: 3450, status: 'pending', priority: 'high', feedback: '' },
        { id: 'REV-002', title: 'Wolf King\'s Vow - Ch.12', author: 'Elena Vasquez', genre: 'Werewolf & Fantasy', submitted: '4h ago', words: 5200, status: 'pending', priority: 'high', feedback: '' },
        { id: 'REV-003', title: 'Betrayed by the Mafia Prince - Ch.7', author: 'Marcus Webb Jr.', genre: 'Mafia & Urban', submitted: '6h ago', words: 2800, status: 'pending', priority: 'medium', feedback: '' },
        { id: 'REV-004', title: 'Bound by the Ruthless Alpha - Ch.18', author: 'Chioma Okafor', genre: 'Romance & Betrayal', submitted: '10h ago', words: 4100, status: 'pending', priority: 'medium', feedback: '' },
        { id: 'REV-005', title: 'The Billionaire\'s Bargain - Ch.9', author: 'Lena Park', genre: 'Billionaire & CEO', submitted: '14h ago', words: 3900, status: 'pending', priority: 'low', feedback: '' },
        { id: 'REV-006', title: 'The Duke\'s Secret - Ch.31', author: 'Isabelle Moreau', genre: 'Historical & Regency', submitted: '1d ago', words: 3600, status: 'approved', priority: 'medium', feedback: 'Great chapter! Pacing is excellent.' },
        { id: 'REV-007', title: 'Revenge at the Ivy League - Ch.3', author: 'Wren Okonkwo', genre: 'Campus & Revenge', submitted: '1d ago', words: 2200, status: 'approved', priority: 'low', feedback: 'Approved with minor edits.' },
        { id: 'REV-008', title: 'Mafia Prince\'s Vengeance - Ch.6', author: 'Amara Chen', genre: 'Mafia & Urban', submitted: '2d ago', words: 4800, status: 'rejected', priority: 'medium', feedback: 'Contains explicit content that violates guidelines. Please revise.' },
      ],
    },

    /* ── Story Management ── */
    storyManagement: {
      stories: [
        { id: 'ST-001', title: 'Bound by the Ruthless Alpha', author: 'Chioma Okafor', genre: 'Romance & Betrayal', chapters: 31, status: 'ongoing', lastUpdated: '2d ago', words: 124000, rating: 4.5 },
        { id: 'ST-002', title: 'The CEO\'s Hidden Son', author: 'Luna Skye', genre: 'Billionaire & CEO', chapters: 24, status: 'ongoing', lastUpdated: '1d ago', words: 96000, rating: 4.3 },
        { id: 'ST-003', title: 'Wolf King\'s Vow', author: 'Elena Vasquez', genre: 'Werewolf & Fantasy', chapters: 12, status: 'ongoing', lastUpdated: '4h ago', words: 48000, rating: 4.1 },
        { id: 'ST-004', title: 'Betrayed by the Mafia Prince', author: 'Marcus Webb Jr.', genre: 'Mafia & Urban', chapters: 7, status: 'ongoing', lastUpdated: '6h ago', words: 28000, rating: 3.9 },
        { id: 'ST-005', title: 'The Duke\'s Secret', author: 'Isabelle Moreau', genre: 'Historical & Regency', chapters: 31, status: 'completed', lastUpdated: '1w ago', words: 155000, rating: 4.7 },
      ],
    },

    /* ── Authors ── */
    authors: [
      { id: 'A-001', name: 'Luna Skye', email: 'luna.skye@droboard.io', avatar: 'https://i.pravatar.cc/100?img=24', genre: 'Billionaire & CEO', stories: 4, status: 'active', joined: 'Mar 2025', earnings: '$12,400', rating: 4.3, warnings: 0 },
      { id: 'A-002', name: 'Elena Vasquez', email: 'elena.vasquez@droboard.io', avatar: 'https://i.pravatar.cc/100?img=31', genre: 'Werewolf & Fantasy', stories: 6, status: 'active', joined: 'Jan 2024', earnings: '$28,100', rating: 4.5, warnings: 0 },
      { id: 'A-003', name: 'Marcus Webb Jr.', email: 'marcus.webb@droboard.io', avatar: 'https://i.pravatar.cc/100?img=33', genre: 'Mafia & Urban', stories: 3, status: 'active', joined: 'Aug 2025', earnings: '$5,800', rating: 3.9, warnings: 1 },
      { id: 'A-004', name: 'Wren Okonkwo', email: 'wren.okonkwo@droboard.io', avatar: 'https://i.pravatar.cc/100?img=41', genre: 'Campus & Revenge', stories: 2, status: 'active', joined: 'Oct 2025', earnings: '$3,200', rating: 4.1, warnings: 0 },
      { id: 'A-005', name: 'Isabelle Moreau', email: 'isabelle.moreau@droboard.io', avatar: 'https://i.pravatar.cc/100?img=44', genre: 'Historical & Regency', stories: 8, status: 'active', joined: 'Sep 2023', earnings: '$35,600', rating: 4.7, warnings: 0 },
      { id: 'A-006', name: 'Chioma Okafor', email: 'chioma.okafor@droboard.io', avatar: 'https://i.pravatar.cc/100?img=5', genre: 'Romance & Betrayal', stories: 5, status: 'suspended', joined: 'Jun 2024', earnings: '$18,900', rating: 4.5, warnings: 2 },
    ],

    /* ── Featured Stories ── */
    featuredStories: {
      active: [
        { id: 'FS-001', title: 'The CEO\'s Hidden Son', author: 'Luna Skye', placement: 'Homepage Banner', start: 'Jul 20', end: 'Aug 3', status: 'active' },
        { id: 'FS-002', title: 'Bound by the Ruthless Alpha', author: 'Chioma Okafor', placement: 'Romance Genre', start: 'Jul 15', end: 'Jul 29', status: 'active' },
        { id: 'FS-003', title: 'Wolf King\'s Vow', author: 'Elena Vasquez', placement: 'Fantasy Genre', start: 'Jul 22', end: 'Aug 5', status: 'active' },
      ],
      history: [
        { title: 'The Duke\'s Secret', author: 'Isabelle Moreau', placement: 'Historical Genre', featured: 'Jun 1 - Jun 15', status: 'ended' },
        { title: 'Betrayed by the Mafia Prince', author: 'Marcus Webb Jr.', placement: 'Homepage Banner', featured: 'May 15 - May 29', status: 'ended' },
      ],
      availableStories: [
        { id: 'ST-003', title: 'Wolf King\'s Vow', author: 'Elena Vasquez', genre: 'Werewolf & Fantasy', rating: 4.1 },
        { id: 'ST-004', title: 'Betrayed by the Mafia Prince', author: 'Marcus Webb Jr.', genre: 'Mafia & Urban', rating: 3.9 },
        { id: 'ST-005', title: 'The Duke\'s Secret', author: 'Isabelle Moreau', genre: 'Historical & Regency', rating: 4.7 },
      ],
    },

    /* ── Editor's Picks ── */
    editorsPicks: {
      current: [
        { id: 'EP-001', title: 'The Duke\'s Secret', author: 'Isabelle Moreau', category: 'Historical Fiction', note: 'A masterful blend of romance and period detail — our top pick for July.', selected: 'Jul 1, 2026', visibility: 'Homepage + Genre' },
        { id: 'EP-002', title: 'The CEO\'s Hidden Son', author: 'Luna Skye', category: 'Romance', note: 'Gripping storyline with unexpected twists. Perfect for CEO romance fans.', selected: 'Jul 15, 2026', visibility: 'Homepage' },
      ],
      previous: [
        { title: 'Wolf King\'s Vow', author: 'Elena Vasquez', category: 'Fantasy', selected: 'Jun 15 - Jul 1', note: 'Rich world-building and compelling character arcs.' },
        { title: 'Bound by the Ruthless Alpha', author: 'Chioma Okafor', category: 'Romance', selected: 'Jun 1 - Jun 15', note: 'A fresh take on the werewolf romance genre.' },
      ],
      categories: ['Romance', 'Fantasy', 'Historical Fiction', 'Urban Drama', 'Campus Life', 'Family Saga'],
    },

    /* ── Announcements ── */
    announcements: [
      { id: 'ANN-001', title: 'New Submission Guidelines', audience: 'authors', content: 'Updated guidelines for chapter submissions are now in effect. Minimum chapter length is now 2,000 words.', status: 'published', created: 'Jul 25, 2026', scheduled: '' },
      { id: 'ANN-002', title: 'Platform Maintenance July 30', audience: 'all', content: 'The platform will be under maintenance on July 30 from 2-4 AM EST. No submissions will be accepted during this window.', status: 'published', created: 'Jul 24, 2026', scheduled: '' },
      { id: 'ANN-003', title: 'Writing Contest: Summer Romance', audience: 'authors', content: 'Submit your best romance chapters for a chance to win $5,000 and a featured placement!', status: 'scheduled', created: 'Jul 22, 2026', scheduled: 'Aug 1, 2026' },
      { id: 'ANN-004', title: 'New Feature: Beta Reading', audience: 'readers', content: 'Readers can now sign up as beta readers for upcoming chapters. Opt in from your profile settings.', status: 'draft', created: 'Jul 20, 2026', scheduled: '' },
    ],

    /* ── Story Analytics ── */
    storyAnalytics: {
      stories: [
        { id: 'SA-001', title: 'The CEO\'s Hidden Son', author: 'Luna Skye', reads: 28400, completions: 62, retention: 71, chapters: 24, engagement: 8.4, revenue: '$4,200' },
        { id: 'SA-002', title: 'Bound by the Ruthless Alpha', author: 'Chioma Okafor', reads: 52100, completions: 58, retention: 68, chapters: 31, engagement: 7.9, revenue: '$8,100' },
        { id: 'SA-003', title: 'Wolf King\'s Vow', author: 'Elena Vasquez', reads: 12300, completions: 45, retention: 55, chapters: 12, engagement: 6.2, revenue: '$1,800' },
        { id: 'SA-004', title: 'The Duke\'s Secret', author: 'Isabelle Moreau', reads: 67800, completions: 74, retention: 82, chapters: 31, engagement: 9.1, revenue: '$12,400' },
      ],
    },

    /* ── Reports & Compliance ── */
    reportsCompliance: {
      plagiarism: [
        { id: 'PLG-101', story: 'CEO\'s Secret Baby', reporter: 'System', status: 'investigating', filed: 'Jul 24, 2026', confidence: 91, notes: 'Matches 3 sources. Awaiting author response.' },
        { id: 'PLG-102', story: 'Wolf King\'s Curse - Ch.5', reporter: 'Chioma Reddy', status: 'confirmed', filed: 'Jul 22, 2026', confidence: 87, notes: 'Copied from another platform. Content removed.' },
      ],
      violations: [
        { id: 'VIO-201', story: 'Mafia Prince\'s Vengeance - Ch.6', type: 'explicit content', reporter: 'System', status: 'resolved', filed: 'Jul 20, 2026', action: 'Chapter rejected. Author notified.' },
      ],
      complaints: [
        { id: 'CMP-301', reader: 'Anonymous', against: 'Marcus Webb Jr.', type: 'abusive response', status: 'open', filed: 'Jul 25, 2026', detail: 'Author responded aggressively to a 3-star review.' },
        { id: 'CMP-302', reader: 'BookLover92', against: 'Author', type: 'plagiarism concern', status: 'investigating', filed: 'Jul 23, 2026', detail: 'Reader suspects content was copied from Wattpad.' },
      ],
    },

    /* ── Communication ── */
    communication: {
      messages: [
        { id: 'MSG-001', from: 'Luna Skye', subject: 'Chapter 24 submission question', preview: 'Hi, I wanted to ask about the word count requirement for...', date: '2h ago', unread: true },
        { id: 'MSG-002', from: 'Elena Vasquez', subject: 'Feedback on Ch.11', preview: 'Thanks for the notes on chapter 11. I\'ve made the revisions and...', date: '5h ago', unread: true },
        { id: 'MSG-003', from: 'Marcus Webb Jr.', subject: 'Dispute: Chapter rejection', preview: 'I don\'t agree with the rejection of chapter 6. The content is...', date: '1d ago', unread: true },
        { id: 'MSG-004', from: 'Wren Okonkwo', subject: 'New story idea', preview: 'I have an idea for a new series set in a dystopian college...', date: '2d ago', unread: false },
        { id: 'MSG-005', from: 'Isabelle Moreau', subject: 'Series completion', preview: 'Just wanted to let you know I\'m planning to wrap up The Duke\'s...', date: '3d ago', unread: false },
      ],
      teamChat: [
        { from: 'Chioma Reddy', text: 'Has anyone reviewed the latest romance submissions?', time: '1h ago' },
        { from: 'Daniel Carter', text: 'Working through the campus drama queue now.', time: '45m ago' },
        { from: 'Sophia Bennett', text: 'The new quality guidelines are live. Check the policies page.', time: '30m ago' },
      ],
    },
  };

  window.SeniorEditorData = {
    /* Dashboard */
    async getDashboard() {
      try { return await callBackend('/dashboard'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.dashboard)); }
    },
    /* Review Queue */
    async getReviewQueue() {
      try { return await callBackend('/review-queue'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.reviewQueue)); }
    },
    async updateReviewItem(id, action, feedback) {
      try { return await callBackend('/review-queue/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, feedback }) }); }
      catch (e) { await delay(200); const item = DEMO.reviewQueue.items.find(x => x.id === id); if (item) { item.status = action; if (feedback) item.feedback = feedback; } return { ok: true }; }
    },
    /* Story Management */
    async getStories() {
      try { return await callBackend('/stories'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.storyManagement)); }
    },
    /* Authors */
    async getAuthors() {
      try { return await callBackend('/authors'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.authors)); }
    },
    /* Featured Stories */
    async getFeaturedStories() {
      try { return await callBackend('/featured-stories'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.featuredStories)); }
    },
    /* Editor's Picks */
    async getEditorsPicks() {
      try { return await callBackend('/editors-picks'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.editorsPicks)); }
    },
    /* Announcements */
    async getAnnouncements() {
      try { return await callBackend('/announcements'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.announcements)); }
    },
    async createAnnouncement(data) {
      try { return await callBackend('/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
      catch (e) { await delay(200); const a = Object.assign({ id: 'ANN-'+String(DEMO.announcements.length+1).padStart(3,'0'), status: 'draft', created: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }, data); DEMO.announcements.unshift(a); return { ok: true, item: a }; }
    },
    /* Story Analytics */
    async getStoryAnalytics() {
      try { return await callBackend('/story-analytics'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.storyAnalytics)); }
    },
    /* Reports & Compliance */
    async getReports() {
      try { return await callBackend('/reports'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.reportsCompliance)); }
    },
    /* Communication */
    async getMessages() {
      try { return await callBackend('/messages'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.communication)); }
    },
  };
})();