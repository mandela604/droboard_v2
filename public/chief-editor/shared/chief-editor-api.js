/**
 * chief-editor-api.js — Data layer for the Chief Editor dashboard.
 * ──────────────────────────────────────────────────────────────
 * Every function tries the real backend first (fetch to API_BASE) and
 * falls back to in-memory demo data if the request fails, times out, or
 * no backend is configured yet. The demo data is mutable, so actions
 * like "approve" or "dismiss" persist for the rest of the session even
 * though nothing is really being written to a server.
 */
(function () {
  'use strict';

  const API_BASE = window.DROBOARD_API_BASE || '/api/chief-editor';
  const TIMEOUT_MS = 2500;

  async function callBackend(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Bad response: ' + res.status);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms || 260 + Math.random() * 260)); }

  /* ═══════════════════════════ DEMO STORE ═══════════════════════════ */
  const DEMO = {
    stats: {
      seniorEditors: 12,
      seniorEditorsDelta: '+2 this quarter',
      pendingPolicies: 3,
      pendingPoliciesDelta: '1 urgent',
      escalatedDisputes: 5,
      escalatedDisputesDelta: '+1 today',
      contractsAwaiting: 4,
      contractsAwaitingDelta: '$182K total value',
      submissionsThisMonth: 2840,
      submissionsDelta: '+14% vs last month',
    },

    seniorEditors: [
      { id: 'se1', name: 'Chioma Reddy', avatar: 'https://i.pravatar.cc/100?img=29', team: 'Romance & Betrayal', reviewsThisMonth: 214, approvalRate: 91, status: 'active' },
      { id: 'se2', name: 'Daniel Carter', avatar: 'https://i.pravatar.cc/100?img=12', team: 'Campus & Revenge', reviewsThisMonth: 178, approvalRate: 88, status: 'active' },
      { id: 'se3', name: 'Sophia Bennett', avatar: 'https://i.pravatar.cc/100?img=29', team: 'Family & Elegy', reviewsThisMonth: 202, approvalRate: 95, status: 'active' },
      { id: 'se4', name: 'Ethan Walker', avatar: 'https://i.pravatar.cc/100?img=53', team: 'Werewolf & Fantasy', reviewsThisMonth: 96, approvalRate: 79, status: 'needs-attention' },
      { id: 'se5', name: 'Marcus Webb', avatar: 'https://i.pravatar.cc/100?img=33', team: 'Mafia & Urban', reviewsThisMonth: 165, approvalRate: 90, status: 'active' },
    ],

    queues: {
      dispute: [
        { id: 'D-2201', title: 'Royalty split dispute — "The Ruthless CEO"', from: 'Ava Winters (Author)', escalatedBy: 'Daniel Carter', priority: 'high', time: '2h ago', detail: 'Author disputes the 70/30 royalty split applied after the contract renewal; claims she agreed to 75/25 verbally with her Senior Editor.' },
        { id: 'D-2200', title: 'Plagiarism appeal — "Bound by the Ruthless Alpha"', from: 'Luna Skye (Author)', escalatedBy: 'Chioma Reddy', priority: 'high', time: '5h ago', detail: 'Author is appealing a plagiarism takedown, providing timestamps proving originality. Needs Chief Editor sign-off to restore.' },
        { id: 'D-2199', title: 'Reader harassment report against author', from: 'Reader report', escalatedBy: 'Marcus Webb', priority: 'medium', time: '1d ago', detail: 'Multiple readers report an author responding abusively to critical reviews in the comments section.' },
        { id: 'D-2198', title: 'Co-authorship credit dispute', from: 'Two authors, joint submission', escalatedBy: 'Sophia Bennett', priority: 'medium', time: '2d ago', detail: 'Two authors disagree on how co-authorship and royalty credit should be split on a jointly written series.' },
        { id: 'D-2197', title: 'Contract termination request contested', from: 'Isabella Rossi (Author)', escalatedBy: 'Ethan Walker', priority: 'low', time: '3d ago', detail: 'Author requested early termination; platform believes this breaches the 2-year exclusivity clause.' },
      ],
      policy: [
        { id: 'P-0088', title: 'Update AI-generated content disclosure policy', from: 'Content Standards Committee', escalatedBy: 'System', priority: 'high', time: '1d ago', detail: 'Proposes requiring authors to disclose any AI-assisted writing tools used, platform-wide.' },
        { id: 'P-0087', title: 'Revise plagiarism appeal window', from: 'Legal', escalatedBy: 'System', priority: 'medium', time: '2d ago', detail: 'Extend the appeal window for plagiarism takedowns from 7 to 14 days.' },
        { id: 'P-0086', title: 'New mature-content labeling standard', from: 'Trust & Safety', escalatedBy: 'System', priority: 'low', time: '4d ago', detail: 'Standardize mature-content labels across categories for consistency.' },
      ],
      contract: [
        { id: 'CNTR-3310', title: 'Exclusive Publishing Agreement — Amara Okafor', from: 'Amara Okafor (Top Author)', escalatedBy: 'Chioma Reddy', priority: 'high', time: '6h ago', detail: 'Special terms: 75% royalty rate (above standard 70%) in recognition of her 31 published books and platform tenure.', value: '$0 upfront · 75% royalty' },
        { id: 'CNTR-3309', title: 'Film & Adaptation Rights — "Bound by the Ruthless Alpha"', from: 'Luna Skye (Author)', escalatedBy: 'Daniel Carter', priority: 'medium', time: '1d ago', detail: 'Third-party studio has offered to license adaptation rights; needs Chief Editor approval before signing.', value: '$45,000 licensing fee' },
        { id: 'CNTR-3308', title: 'Multi-book exclusivity deal — Isabella Rossi', from: 'Isabella Rossi (Author)', escalatedBy: 'Sophia Bennett', priority: 'medium', time: '2d ago', detail: '5-book exclusivity deal with an advance, above the standard single-contract terms.', value: '$12,000 advance' },
        { id: 'CNTR-3307', title: 'Translation Rights — Spanish & Portuguese', from: 'NoveluX LatAm (Partner)', escalatedBy: 'Marcus Webb', priority: 'low', time: '3d ago', detail: 'Regional partner requesting translation rights for 40 top-performing titles.', value: '$8,200 total' },
      ],
    },

    performance: {
      week:    { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], submissions: [380, 410, 395, 460, 505, 340, 290], approvalRate: [88,90,89,91,92,87,86] },
      month:   { labels: ['W1','W2','W3','W4'], submissions: [2480, 2620, 2710, 2840], approvalRate: [87,89,90,91] },
      quarter: { labels: ['Apr','May','Jun'], submissions: [7900, 8400, 8960], approvalRate: [85,88,90] },
      year:    { labels: ['Q1','Q2','Q3','Q4'], submissions: [21400, 25260, 24800, 26100], approvalRate: [83,87,89,90] },
    },

    activity: [
      { icon: 'fa-file-signature', color: 'accent', text: 'Approved <b>Exclusive Publishing Agreement</b> for <b>Amara Okafor</b>', time: '18 minutes ago' },
      { icon: 'fa-scale-balanced', color: 'red', text: 'Escalated dispute <b>D-2201</b> assigned to your queue by <b>Daniel Carter</b>', time: '2 hours ago' },
      { icon: 'fa-scroll', color: 'purple', text: 'Published updated <b>Content Moderation Policy v3.2</b> platform-wide', time: '5 hours ago' },
      { icon: 'fa-user-plus', color: 'green', text: 'Promoted <b>Ethan Walker</b> to Senior Editor — Werewolf & Fantasy desk', time: '1 day ago' },
      { icon: 'fa-globe', color: 'blue', text: 'Signed regional partnership with <b>NoveluX LatAm</b>', time: '2 days ago' },
      { icon: 'fa-chart-line', color: 'amber', text: 'Reviewed Q2 editorial performance report', time: '3 days ago' },
    ],
  };

  /* ═══════════════════════════ PUBLIC API ═══════════════════════════ */
  const ChiefEditorAPI = {

    async getDashboardStats() {
      try { return await callBackend('/stats'); }
      catch (e) { await delay(); return Object.assign({}, DEMO.stats); }
    },

    async getSeniorEditors() {
      try { return await callBackend('/senior-editors'); }
      catch (e) { await delay(); return DEMO.seniorEditors.slice(); }
    },

    async getQueue(type) {
      try { return await callBackend('/queue/' + type); }
      catch (e) { await delay(); return (DEMO.queues[type] || []).slice(); }
    },

    async resolveQueueItem(type, id, action) {
      try { return await callBackend('/queue/' + type + '/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); }
      catch (e) {
        await delay(200);
        const list = DEMO.queues[type] || [];
        const idx = list.findIndex(x => x.id === id);
        if (idx >= 0) list.splice(idx, 1);
        // keep the headline stat counters in sync with the demo queue
        if (type === 'dispute') DEMO.stats.escalatedDisputes = DEMO.queues.dispute.length;
        if (type === 'policy') DEMO.stats.pendingPolicies = DEMO.queues.policy.length;
        if (type === 'contract') DEMO.stats.contractsAwaiting = DEMO.queues.contract.length;
        return { ok: true, action, id };
      }
    },

    async getPerformanceTrend(period) {
      try { return await callBackend('/performance?period=' + period); }
      catch (e) { await delay(); return DEMO.performance[period] || DEMO.performance.month; }
    },

    async getRecentActivity() {
      try { return await callBackend('/activity'); }
      catch (e) { await delay(); return DEMO.activity.slice(); }
    },
  };

  window.ChiefEditorAPI = ChiefEditorAPI;
})();