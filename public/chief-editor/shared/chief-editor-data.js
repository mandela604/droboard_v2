/**
 * chief-editor-data.js — Data layer for Chief Editor pages.
 * All methods call /api/chief directly. Errors propagate to the caller.
 */
(function () {
  'use strict';
  if (window.__chiefEditorData) return;
  window.__chiefEditorData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/chief';
  const TIMEOUT_MS = 10000;

  async function api(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({
        credentials: 'include',
        signal: controller.signal,
      }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }

  function post(path, body) {
    return api(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  }
  function patch(path, body) {
    return api(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  }
  function put(path, body) {
    return api(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  }
  function del(path) {
    return api(path, { method: 'DELETE' });
  }

  window.ChiefEditorData = {
    // ── Dashboard ──────────────────────────────────────────
    getDashboard()               { return api('/dashboard'); },
    getDashboardStats()          { return api('/dashboard/stats'); },
    getPerformanceTrend(period)  { return api('/performance?period=' + encodeURIComponent(period || 'month')); },
    getDashboardQueues(type)     { return api('/queues/' + encodeURIComponent(type || 'all')); },
    getEditorialTeam()           { return api('/editorial-team'); },
    getRecentActivity()          { return api('/activity'); },
    resolveQueueItem(type, id, action) { return post('/queues/' + encodeURIComponent(type) + '/' + encodeURIComponent(id), { action }); },

    // ── Senior Editors ──────────────────────────────────────
    getSeniorEditors()           { return api('/senior-editors'); },
    getSeniorEditorQuotas()      { return api('/senior-editors/quotas'); },
    getSeniorEditor(id)          { return api('/senior-editors/' + encodeURIComponent(id)); },
    patchSeniorEditor(id, data)  { return patch('/senior-editors/' + encodeURIComponent(id), data); },
    getInvites()                 { return api('/senior-editors/invites'); },
    createInvite(data)           { return post('/senior-editors/invites', data); },
    patchInvite(id, data)        { return patch('/senior-editors/invites/' + encodeURIComponent(id), data); },
    cancelInvite(id)             { return del('/senior-editors/invites/' + encodeURIComponent(id)); },
    resendInvite(id)             { return post('/senior-editors/' + encodeURIComponent(id) + '/resend-invite', {}); },
    getByInviteToken(token)      { return api('/invites/by-token/' + encodeURIComponent(token)); },
    acceptInvite(data)           { return post('/invites/accept', data); },

    // ── Author assignments ──────────────────────────────────
    getAssignments()             { return api('/assignments'); },
    saveAssignments(editorId, data) { return put('/senior-editors/' + encodeURIComponent(editorId) + '/assignments', data); },
    addAssignment(editorId, authorId) { return post('/senior-editors/' + encodeURIComponent(editorId) + '/assignments/authors', { authorId }); },
    removeAssignment(editorId, authorId) { return del('/senior-editors/' + encodeURIComponent(editorId) + '/assignments/authors/' + encodeURIComponent(authorId)); },
    getUnassignedAuthors(opts)   { const q = new URLSearchParams(opts || {}).toString(); return api('/unassigned-authors' + (q ? '?' + q : '')); },
    getAuthorPool()              { return api('/authors'); },
    searchPlatformUsers(q)       { return api('/users/search?q=' + encodeURIComponent(q || '')); },

    // ── Contract Templates ──────────────────────────────────
    getContractTemplates(opts)   { const q = new URLSearchParams(opts || {}).toString(); return api('/contract-templates' + (q ? '?' + q : '')); },
    getContractTemplate(id)      { return api('/contract-templates/' + encodeURIComponent(id)); },
    createContractTemplate(data) { return post('/contract-templates', data); },
    updateContractTemplate(id, data) { return patch('/contract-templates/' + encodeURIComponent(id), data); },
    deleteContractTemplate(id)   { return del('/contract-templates/' + encodeURIComponent(id)); },
    pauseContractTemplate(id)    { return post('/contract-templates/' + encodeURIComponent(id) + '/pause', {}); },
    activateContractTemplate(id) { return post('/contract-templates/' + encodeURIComponent(id) + '/activate', {}); },

    // ── Author Contracts ────────────────────────────────────
    getAuthorContracts()         { return api('/author-contracts'); },
    getActiveContracts()         { return api('/author-contracts/active'); },
    getPendingOffers()           { return api('/author-contracts/pending-offers'); },
    createContractOffer(data)    { return post('/author-contracts/offers', data); },
    signContract(id)             { return post('/author-contracts/' + encodeURIComponent(id) + '/sign', {}); },
    approveContract(id)          { return post('/author-contracts/' + encodeURIComponent(id) + '/approve', {}); },
    rejectContract(id, reason)   { return post('/author-contracts/' + encodeURIComponent(id) + '/reject', { reason }); },

    // ── Reports ─────────────────────────────────────────────
    getReports(opts)             { const q = new URLSearchParams(opts || {}).toString(); return api('/reports/story' + (q ? '?' + q : '')); },
    getReportStats()             { return api('/reports/story/stats'); },
    getReport(id)                { return api('/reports/story/' + encodeURIComponent(id)); },
    resolveReport(id, note)      { return post('/reports/story/' + encodeURIComponent(id) + '/resolve', { note }); },
    dismissReport(id, note)      { return post('/reports/story/' + encodeURIComponent(id) + '/dismiss', { note }); },
    reopenReport(id)             { return post('/reports/story/' + encodeURIComponent(id) + '/reopen', {}); },

    // ── Disputes & Appeals ──────────────────────────────────
    getDisputesAppeals()         { return api('/disputes-appeals'); },
    getAppeals()                 { return api('/appeals'); },
    upholdAppeal(id)             { return post('/appeals/' + encodeURIComponent(id) + '/uphold', {}); },
    overturnAppeal(id)           { return post('/appeals/' + encodeURIComponent(id) + '/overturn', {}); },
    investigateAppeal(id)        { return post('/appeals/' + encodeURIComponent(id) + '/investigate', {}); },
    getEscalatedReports()        { return api('/escalated-reports'); },
    resolveEscalated(id)         { return post('/escalated-reports/' + encodeURIComponent(id) + '/resolve', {}); },
    getPlagiarismCases()         { return api('/plagiarism-cases'); },
    confirmPlagiarism(id)        { return post('/plagiarism-cases/' + encodeURIComponent(id) + '/confirm', {}); },
    clearPlagiarism(id)          { return post('/plagiarism-cases/' + encodeURIComponent(id) + '/clear', {}); },
    getResolutionHistory()       { return api('/resolution-history'); },

    // ── Editorial Strategy ──────────────────────────────────
    getEditorialStrategy()       { return api('/editorial-strategy'); },
    getStrategyNotes()           { return api('/editorial-strategy/notes'); },
    getGenrePriorities()         { return api('/editorial-strategy/genre-priorities'); },
    getQuarterlyGoals()          { return api('/editorial-strategy/quarterly-goals'); },
    getCampaigns()               { return api('/editorial-strategy/campaigns'); },
    getAcquisitionTargets()      { return api('/editorial-strategy/acquisition-targets'); },

    // ── Editorial Policies ──────────────────────────────────
    getPolicies()                { return api('/policies'); },
    getPoliciesHistory()         { return api('/policies/history'); },
    getPolicy(id)                { return api('/policies/' + encodeURIComponent(id)); },
    createPolicy(data)           { return post('/policies', data); },
    updatePolicy(id, data)       { return patch('/policies/' + encodeURIComponent(id), data); },
    archivePolicy(id)            { return post('/policies/' + encodeURIComponent(id) + '/archive', {}); },
    publishPolicy(id)            { return post('/policies/' + encodeURIComponent(id) + '/publish', {}); },
    approvePolicy(id)            { return post('/policies/' + encodeURIComponent(id) + '/approve', {}); },
    sendBackPolicy(id, note)     { return post('/policies/' + encodeURIComponent(id) + '/send-back', { note }); },

    // ── Partnerships ────────────────────────────────────────
    getPartnerships()            { return api('/partnerships'); },
    getPartnershipRequests()     { return api('/partnerships/requests'); },
    approvePartnership(id)       { return post('/partnerships/requests/' + encodeURIComponent(id) + '/approve', {}); },
    declinePartnership(id)       { return post('/partnerships/requests/' + encodeURIComponent(id) + '/decline', {}); },

    // ── Books / Content ─────────────────────────────────────
    getBooks(opts)               { const q = new URLSearchParams(opts || {}).toString(); return api('/books' + (q ? '?' + q : '')); },
    getFlaggedBooks()            { return api('/books/flagged'); },
    getBook(id)                  { return api('/books/' + encodeURIComponent(id)); },
    getCategories()              { return api('/categories'); },
    createCategory(data)         { return post('/categories', data); },
    updateCategory(id, data)     { return patch('/categories/' + encodeURIComponent(id), data); },
    deleteCategory(id)           { return del('/categories/' + encodeURIComponent(id)); },
    toggleCategoryStatus(id)     { return post('/categories/' + encodeURIComponent(id) + '/toggle-status', {}); },
    getGenres(opts)              { const q = new URLSearchParams(opts || {}).toString(); return api('/genres' + (q ? '?' + q : '')); },
    createGenre(data)            { return post('/genres', data); },
    updateGenre(id, data)        { return patch('/genres/' + encodeURIComponent(id), data); },
    deleteGenre(id)              { return del('/genres/' + encodeURIComponent(id)); },
    toggleGenreStatus(id)        { return post('/genres/' + encodeURIComponent(id) + '/toggle-status', {}); },
    getTropes(opts)              { const q = new URLSearchParams(opts || {}).toString(); return api('/tropes' + (q ? '?' + q : '')); },
    createTrope(data)            { return post('/tropes', data); },
    updateTrope(id, data)        { return patch('/tropes/' + encodeURIComponent(id), data); },
    deleteTrope(id)              { return del('/tropes/' + encodeURIComponent(id)); },
    toggleTropeStatus(id)        { return post('/tropes/' + encodeURIComponent(id) + '/toggle-status', {}); },

    // ── Featured Stories ────────────────────────────────────
    getFeaturedTags()            { return api('/featured/tags'); },
    getFeaturedSections()        { return api('/featured/sections'); },
    getFeaturedLibrary()         { return api('/featured/library'); },
    getFeaturedPlacements()      { return api('/featured/placements'); },
    addFeaturedPlacement(data)   { return post('/featured/placements', data); },
    updateFeaturedPlacement(storyId, data) { return patch('/featured/placements/' + encodeURIComponent(storyId), data); },
    removeFeaturedPlacement(storyId) { return del('/featured/placements/' + encodeURIComponent(storyId)); },
    getFeaturedHistory()         { return api('/featured/history'); },
    refeatureStory(index)        { return post('/featured/history/' + encodeURIComponent(index) + '/refeature', {}); },

    // ── Earnings ────────────────────────────────────────────
    getEarningsSettings()        { return api('/earnings/settings'); },
    updateEarningsSettings(data) { return put('/earnings/settings', data); },
    getEarningsSummary()         { return api('/earnings/summary'); },

    // ── Profile / Sessions ──────────────────────────────────
    getProfile()                 { return api('/profile'); },
    getSessions()                { return api('/sessions'); },
    revokeOtherSessions()        { return post('/sessions/revoke-others', {}); },
  };
})();
