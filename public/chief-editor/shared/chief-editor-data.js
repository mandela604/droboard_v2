(function () {
  'use strict';
  if (window.__chiefEditorData) return;
  window.__chiefEditorData = true;

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
    } catch (e) { clearTimeout(timer); throw e; }
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms || 200 + Math.random() * 200)); }

  const DEMO = {
    dashboard: {
      pendingSignatures: 4,
      openReports: 6,
      editorsBehindQuota: 2,
      paymentsDueTotal: '$18,240',
      totalSeniorEditors: 6,
      totalAuthors: 142,

      quickActions: [
        { label: 'Sign Pending Contracts', icon: 'fa-file-signature', cls: 'blue',   count: 4, href: 'contracts-payments.html' },
        { label: 'Review Flagged Authors',  icon: 'fa-flag',           cls: 'red',    count: 6, href: 'reports-actions.html' },
        { label: 'Run Payments',            icon: 'fa-money-check-dollar', cls: 'green', href: 'contracts-payments.html' },
        { label: 'Review Editor Quotas',    icon: 'fa-bullseye',       cls: 'purple', count: 2, href: 'senior-editors.html' },
      ],

      pendingContracts: [
        { id:'CT-101', author:'Luna Skye', avatar:'https://i.pravatar.cc/60?img=24', type:'New Author Agreement', forwardedBy:'Chioma Reddy', authorSigned:true, submitted:'2h ago' },
        { id:'CT-102', author:'Wren Okonkwo', avatar:'https://i.pravatar.cc/60?img=41', type:'Contract Renewal', forwardedBy:'Priya Nair', authorSigned:true, submitted:'6h ago' },
        { id:'CT-103', author:'Ifeanyi_Story', avatar:'https://i.pravatar.cc/60?img=8', type:'Royalty Amendment', forwardedBy:'Daniel Carter', authorSigned:true, submitted:'1d ago' },
        { id:'CT-104', author:'Zara_M', avatar:'https://i.pravatar.cc/60?img=36', type:'New Author Agreement', forwardedBy:'Marcus Ihejirika', authorSigned:true, submitted:'1d ago' },
      ],

      flaggedReports: [
        { id:'RPT-201', targetType:'author', target:'Marcus Webb Jr.', reason:'Plagiarism — chapter matches 3 external sources', reportedBy:'Daniel Carter (Senior Editor)', severity:'high', filed:'3h ago' },
        { id:'RPT-202', targetType:'author', target:'CEO\'s Secret Baby (unassigned)', reason:'Plagiarism — flagged by system scan', reportedBy:'System', severity:'high', filed:'1d ago' },
        { id:'RPT-203', targetType:'editor', target:'Priya Nair', reason:'Author reports slow, dismissive feedback on 3 submissions', reportedBy:'Ada_Writes (Author, direct report)', severity:'medium', filed:'1d ago' },
        { id:'RPT-204', targetType:'author', target:'Zara_M', reason:'Reader complaint — abusive reply to a review', reportedBy:'Reader', severity:'low', filed:'2d ago' },
        { id:'RPT-205', targetType:'editor', target:'Daniel Carter', reason:'Author disputes a chapter rejection as unfair', reportedBy:'Marcus Webb Jr. (Author, direct report)', severity:'medium', filed:'2d ago' },
        { id:'RPT-206', targetType:'author', target:'Ada_Writes', reason:'Suspected duplicate account after a prior ban', reportedBy:'System', severity:'high', filed:'3d ago' },
      ],

      editorQuotas: [
        { name:'Chioma Reddy',      avatar:'https://i.pravatar.cc/100?img=5',  target:50, invited:41, deadline:'Jul 31, 2026', status:'on-track' },
        { name:'Daniel Carter',     avatar:'https://i.pravatar.cc/100?img=13', target:50, invited:22, deadline:'Jul 31, 2026', status:'behind' },
        { name:'Sophia Bennett',    avatar:'https://i.pravatar.cc/100?img=48', target:50, invited:53, deadline:'Jul 31, 2026', status:'ahead' },
        { name:'Marcus Ihejirika',  avatar:'https://i.pravatar.cc/100?img=59', target:50, invited:37, deadline:'Jul 31, 2026', status:'on-track' },
        { name:'Priya Nair',        avatar:'https://i.pravatar.cc/100?img=45', target:50, invited:18, deadline:'Jul 31, 2026', status:'behind' },
      ],

      paymentsQueue: [
        { name:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', role:'Author', amount:'$2,140', due:'Jul 31, 2026', status:'due' },
        { name:'Elena Vasquez',   avatar:'https://i.pravatar.cc/60?img=31', role:'Author', amount:'$980', due:'Jul 31, 2026', status:'due' },
        { name:'Chioma Reddy',    avatar:'https://i.pravatar.cc/100?img=5', role:'Senior Editor', amount:'$3,200', due:'Aug 1, 2026', status:'scheduled' },
        { name:'Daniel Carter',   avatar:'https://i.pravatar.cc/100?img=13', role:'Senior Editor', amount:'$3,200', due:'Aug 1, 2026', status:'scheduled' },
        { name:'Luna Skye',       avatar:'https://i.pravatar.cc/60?img=24', role:'Author', amount:'$1,510', due:'Jul 31, 2026', status:'due' },
      ],

      recentActivity: [
        { icon:'fa-file-signature', color:'blue',   text:'<b>Chioma Reddy</b> forwarded a signed contract for <b>Luna Skye</b>', time:'2h ago' },
        { icon:'fa-flag',           color:'red',    text:'<b>Daniel Carter</b> flagged <b>Marcus Webb Jr.</b> for suspected plagiarism', time:'3h ago' },
        { icon:'fa-comment-dots',   color:'amber',  text:'<b>Ada_Writes</b> filed a direct report about their senior editor', time:'1d ago' },
        { icon:'fa-money-check-dollar', color:'green', text:'Payout of $3,200 released to <b>Sophia Bennett</b>', time:'1d ago' },
        { icon:'fa-bullseye',       color:'purple', text:'<b>Priya Nair</b> fell behind on the July invite quota (18 of 50)', time:'1d ago' },
        { icon:'fa-ban',            color:'red',    text:'Suspended <b>a duplicate account</b> flagged after a prior ban', time:'2d ago' },
      ],
    },

    seniorEditors: [
      { id:'SE-01', name:'Chioma Reddy',     avatar:'https://i.pravatar.cc/100?img=5',  email:'chioma.reddy@droboard.io',    joined:'Mar 12, 2024', authorsManaged:24, target:50, invited:41, status:'on-track', monthlyPay:'$3,200', ytdPaid:'$28,800', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-02', name:'Daniel Carter',    avatar:'https://i.pravatar.cc/100?img=13', email:'daniel.carter@droboard.io',   joined:'Jan 08, 2024', authorsManaged:19, target:50, invited:22, status:'behind',   monthlyPay:'$3,200', ytdPaid:'$25,600', deadline:'Jul 31, 2026', openReports:1 },
      { id:'SE-03', name:'Sophia Bennett',   avatar:'https://i.pravatar.cc/100?img=48', email:'sophia.bennett@droboard.io',  joined:'Jun 02, 2023', authorsManaged:31, target:50, invited:53, status:'ahead',    monthlyPay:'$3,400', ytdPaid:'$40,800', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-04', name:'Marcus Ihejirika', avatar:'https://i.pravatar.cc/100?img=59', email:'marcus.ihejirika@droboard.io',joined:'Sep 21, 2023', authorsManaged:22, target:50, invited:37, status:'on-track', monthlyPay:'$3,200', ytdPaid:'$32,000', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-05', name:'Priya Nair',       avatar:'https://i.pravatar.cc/100?img=45', email:'priya.nair@droboard.io',      joined:'Nov 14, 2024', authorsManaged:14, target:50, invited:18, status:'behind',   monthlyPay:'$3,000', ytdPaid:'$15,000', deadline:'Jul 31, 2026', openReports:1 },
      { id:'SE-06', name:'Elias Thornton',   avatar:'https://i.pravatar.cc/100?img=15', email:'elias.thornton@droboard.io',  joined:'Feb 27, 2024', authorsManaged:27, target:50, invited:48, status:'on-track', monthlyPay:'$3,300', ytdPaid:'$29,700', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-07', name:'Amara Okafor',     avatar:'https://i.pravatar.cc/100?img=32', email:'amara.okafor@droboard.io',    joined:'Apr 03, 2023', authorsManaged:35, target:50, invited:56, status:'ahead',    monthlyPay:'$3,500', ytdPaid:'$45,500', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-08', name:'Jonas Whitfield',  avatar:'https://i.pravatar.cc/100?img=52', email:'jonas.whitfield@droboard.io', joined:'Aug 19, 2024', authorsManaged:11, target:50, invited:15, status:'behind',   monthlyPay:'$2,900', ytdPaid:'$11,600', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-09', name:'Nadia Petrova',    avatar:'https://i.pravatar.cc/100?img=28', email:'nadia.petrova@droboard.io',   joined:'Dec 05, 2023', authorsManaged:20, target:50, invited:34, status:'on-track', monthlyPay:'$3,100', ytdPaid:'$27,900', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-10', name:'Tobias Adeyemi',   avatar:'https://i.pravatar.cc/100?img=51', email:'tobias.adeyemi@droboard.io',  joined:'Jul 30, 2024', authorsManaged:9,  target:50, invited:12, status:'behind',   monthlyPay:'$2,900', ytdPaid:'$8,700',  deadline:'Jul 31, 2026', openReports:2 },
      { id:'SE-11', name:'Freya Lindqvist',  avatar:'https://i.pravatar.cc/100?img=25', email:'freya.lindqvist@droboard.io', joined:'May 16, 2023', authorsManaged:33, target:50, invited:50, status:'ahead',    monthlyPay:'$3,400', ytdPaid:'$44,200', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-12', name:'Kwame Asante',     avatar:'https://i.pravatar.cc/100?img=60', email:'kwame.asante@droboard.io',    joined:'Oct 09, 2024', authorsManaged:16, target:50, invited:26, status:'on-track', monthlyPay:'$3,000', ytdPaid:'$18,000', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-13', name:'Isla Fitzgerald',  avatar:'https://i.pravatar.cc/100?img=47', email:'isla.fitzgerald@droboard.io', joined:'Mar 22, 2024', authorsManaged:23, target:50, invited:39, status:'on-track', monthlyPay:'$3,200', ytdPaid:'$28,800', deadline:'Jul 31, 2026', openReports:0 },
      { id:'SE-14', name:'Rahul Mehta',      avatar:'https://i.pravatar.cc/100?img=33', email:'rahul.mehta@droboard.io',     joined:'Jan 30, 2025', authorsManaged:6,  target:50, invited:9,  status:'behind',   monthlyPay:'$2,800', ytdPaid:'$5,600',  deadline:'Jul 31, 2026', openReports:0 },
    ],

    contractTemplates: [
      { id:'TPL-001', name:'Standard Non-Exclusive Agreement', type:'Non-Exclusive', status:'active', royaltyRate:15, termLength:'1 Year', autoRenew:true,  usageCount:38, created:'Jan 14, 2025', lastEdited:'Jun 02, 2026', description:'Baseline agreement for authors who retain rights to publish the same work on other platforms. Standard royalty split with quarterly payout.', clauses:'Non-exclusive distribution rights, quarterly royalty statements, 30-day termination notice, no platform-exclusivity bonus.' },
      { id:'TPL-002', name:'Premium Exclusive Agreement',      type:'Exclusive',     status:'active', royaltyRate:25, termLength:'2 Years', autoRenew:true,  usageCount:22, created:'Feb 03, 2025', lastEdited:'Jul 10, 2026', description:'For authors publishing exclusively on Droboard. Higher royalty split and eligibility for platform promotion slots.', clauses:'Full platform exclusivity, elevated royalty tier, featured-slot eligibility, 90-day early termination penalty.' },
      { id:'TPL-003', name:'Contract Renewal — Standard',      type:'Renewal',       status:'active', royaltyRate:15, termLength:'1 Year', autoRenew:false, usageCount:47, created:'Nov 21, 2024', lastEdited:'May 18, 2026', description:'Used to extend an existing non-exclusive or exclusive agreement under the same royalty terms for another cycle.', clauses:'Carries forward prior royalty rate, resets term length, requires fresh countersignature.' },
      { id:'TPL-004', name:'Royalty Amendment — Rate Increase', type:'Amendment',    status:'active', royaltyRate:20, termLength:'Indefinite', autoRenew:false, usageCount:9,  created:'Mar 09, 2025', lastEdited:'Jun 28, 2026', description:'Adjusts the royalty percentage on an existing agreement without changing the underlying term or exclusivity.', clauses:'Supersedes prior royalty clause only, all other original contract terms remain in force.' },
      { id:'TPL-005', name:'Work-for-Hire Agreement',          type:'Work-for-Hire', status:'paused', royaltyRate:0,  termLength:'Indefinite', autoRenew:false, usageCount:4,  created:'Apr 17, 2025', lastEdited:'Apr 17, 2025', description:'Flat one-time payment in exchange for full rights transfer. No ongoing royalties. Currently paused pending legal review.', clauses:'Full IP transfer to platform, one-time flat fee, no royalty entitlement, author retains attribution credit.' },
      { id:'TPL-006', name:'Ghostwriting Agreement',           type:'Work-for-Hire', status:'active', royaltyRate:0,  termLength:'6 Months', autoRenew:false, usageCount:6,  created:'Jun 12, 2025', lastEdited:'Jun 12, 2025', description:'For commissioned ghostwriters producing work under a pen name or brand owned by another author or the platform.', clauses:'No public authorship credit, confidentiality clause, milestone-based flat payments.' },
      { id:'TPL-007', name:'Translation Rights Addendum',      type:'Amendment',    status:'active', royaltyRate:10, termLength:'2 Years', autoRenew:true,  usageCount:13, created:'Aug 05, 2025', lastEdited:'Feb 14, 2026', description:'Grants the platform rights to commission and distribute translated editions of an existing work.', clauses:'Translation rights only, separate royalty pool, original agreement terms unaffected.' },
      { id:'TPL-008', name:'Audio Rights Addendum',            type:'Amendment',    status:'paused', royaltyRate:12, termLength:'2 Years', autoRenew:true,  usageCount:5,  created:'Sep 22, 2025', lastEdited:'Jan 30, 2026', description:'Grants audiobook production and distribution rights. Paused while narration vendor contracts are renegotiated.', clauses:'Audio-format rights only, revenue split on audiobook sales, narrator selection subject to author approval.' },
      { id:'TPL-009', name:'New Author Starter Agreement',     type:'Non-Exclusive', status:'active', royaltyRate:12, termLength:'6 Months', autoRenew:false, usageCount:61, created:'Oct 30, 2024', lastEdited:'Jul 21, 2026', description:'Entry-level agreement offered to first-time authors on the platform, with a shorter initial commitment.', clauses:'Short initial term, standard non-exclusive rights, automatic upgrade offer to Standard tier at renewal.' },
      { id:'TPL-010', name:'Legacy Exclusive Agreement (2023)', type:'Exclusive',     status:'archived', royaltyRate:22, termLength:'2 Years', autoRenew:true, usageCount:31, created:'Jan 05, 2023', lastEdited:'Dec 01, 2024', description:'Older exclusive template retained for reference on legacy contracts still in force. No longer offered for new signings.', clauses:'Legacy royalty tier, superseded by Premium Exclusive Agreement, retained for existing signatory reference only.' },
    ],

    reports: [
      { id:'RPT-201', targetType:'author', target:'Marcus Webb Jr.', avatar:'https://i.pravatar.cc/60?img=12', reason:'Chapter 14 of "Whispers of the Old City" matches three external sources with over 70% textual overlap, flagged by the plagiarism scanner and manually confirmed by the reporting editor.', reportedBy:'Daniel Carter', reporterType:'Senior Editor', severity:'high', filed:'3h ago', status:'open' },
      { id:'RPT-202', targetType:'author', target:"CEO's Secret Baby (unassigned)", avatar:'https://i.pravatar.cc/60?img=19', reason:'Automated scan detected near-identical opening chapters shared with a work published on a competing platform two weeks prior.', reportedBy:'System', reporterType:'System', severity:'high', filed:'1d ago', status:'open' },
      { id:'RPT-203', targetType:'editor', target:'Priya Nair', avatar:'https://i.pravatar.cc/100?img=45', reason:'Author reports slow, dismissive feedback across three consecutive chapter submissions, with turnaround times exceeding two weeks each.', reportedBy:'Ada_Writes', reporterType:'Author (direct report)', severity:'medium', filed:'1d ago', status:'open' },
      { id:'RPT-204', targetType:'author', target:'Zara_M', avatar:'https://i.pravatar.cc/60?img=36', reason:'Reader complaint about an abusive, threatening reply left on a critical review of chapter 9.', reportedBy:'Reader', reporterType:'Reader', severity:'low', filed:'2d ago', status:'open' },
      { id:'RPT-205', targetType:'editor', target:'Daniel Carter', avatar:'https://i.pravatar.cc/100?img=13', reason:'Author disputes a chapter rejection as unfair and inconsistent with prior editorial feedback on the same manuscript.', reportedBy:'Marcus Webb Jr.', reporterType:'Author (direct report)', severity:'medium', filed:'2d ago', status:'open' },
      { id:'RPT-206', targetType:'author', target:'Ada_Writes', avatar:'https://i.pravatar.cc/60?img=45', reason:'System flagged a suspected duplicate account created shortly after a prior ban, sharing device and payment fingerprints.', reportedBy:'System', reporterType:'System', severity:'high', filed:'3d ago', status:'open' },
      { id:'RPT-207', targetType:'author', target:'Wren Okonkwo', avatar:'https://i.pravatar.cc/60?img=41', reason:'Reader reported explicit content posted outside the platform’s mature-content tagging guidelines in chapter 22.', reportedBy:'Reader', reporterType:'Reader', severity:'medium', filed:'4d ago', status:'dismissed', resolvedBy:'Adaeze Bello', resolvedAt:'3d ago', resolutionNote:'Reviewed the chapter — content was already correctly tagged mature. No violation found.' },
      { id:'RPT-208', targetType:'author', target:'Ifeanyi_Story', avatar:'https://i.pravatar.cc/60?img=8', reason:'Senior editor flagged repeated missed deadlines and unresponsiveness across two manuscript cycles.', reportedBy:'Chioma Reddy', reporterType:'Senior Editor', severity:'low', filed:'5d ago', status:'suspended', resolvedBy:'Adaeze Bello', resolvedAt:'4d ago', resolutionNote:'Account suspended for 14 days pending a response from the author.' },
      { id:'RPT-209', targetType:'author', target:'Luna Skye', avatar:'https://i.pravatar.cc/60?img=24', reason:'False report later found to be a mistaken duplicate submission of the same manuscript, not a plagiarism case.', reportedBy:'System', reporterType:'System', severity:'low', filed:'6d ago', status:'dismissed', resolvedBy:'Adaeze Bello', resolvedAt:'5d ago', resolutionNote:'Confirmed as a duplicate upload by the same author. Extra copy removed, no penalty applied.' },
      { id:'RPT-210', targetType:'editor', target:'Marcus Ihejirika', avatar:'https://i.pravatar.cc/100?img=59', reason:'Two authors independently reported delayed royalty statement explanations and unclear quota communication.', reportedBy:'Multiple authors', reporterType:'Author (direct report)', severity:'medium', filed:'1w ago', status:'open' },
      { id:'RPT-211', targetType:'author', target:'Elena Vasquez', avatar:'https://i.pravatar.cc/60?img=31', reason:'Confirmed plagiarism — full chapter lifted from a publicly available short story with only character names changed.', reportedBy:'Sophia Bennett', reporterType:'Senior Editor', severity:'high', filed:'1w ago', status:'banned', resolvedBy:'Adaeze Bello', resolvedAt:'6d ago', resolutionNote:'Account permanently banned after confirming verbatim plagiarism across the full chapter.' },
      { id:'RPT-212', targetType:'author', target:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', reason:'Reader reported impersonation — a fan account was posting chapter previews before official release.', reportedBy:'Reader', reporterType:'Reader', severity:'medium', filed:'1w ago', status:'removed', resolvedBy:'Adaeze Bello', resolvedAt:'6d ago', resolutionNote:'Confirmed the fan account was unauthorized and unrelated to the author. Content taken down by the platform team.' },
    ],
  };

  window.ChiefEditorData = {
    async getDashboard() {
      try { return await callBackend('/dashboard'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.dashboard)); }
    },
    async getSeniorEditors() {
      try { return await callBackend('/senior-editors'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.seniorEditors)); }
    },
    async getContractTemplates() {
      try { return await callBackend('/contract-templates'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.contractTemplates)); }
    },
    async getReports() {
      try { return await callBackend('/reports'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.reports)); }
    },
  };
})();