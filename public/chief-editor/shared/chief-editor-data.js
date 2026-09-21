(function () {
  'use strict';
  if (window.__chiefEditorData) return;
  window.__chiefEditorData = true;

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

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
      { id:'TPL-001', name:'Standard Non-Exclusive Agreement', type:'Non-Exclusive', status:'active', royaltyRate:15, termLength:'1 Year', autoRenew:true,  usageCount:38, created:'Jan 14, 2025', lastEdited:'Jun 02, 2026', defaultChapterPrice:15, description:'Baseline agreement for authors who retain rights to publish the same work on other platforms. Standard royalty split with quarterly payout.', clauses:'Non-exclusive distribution rights, quarterly royalty statements, 30-day termination notice, no platform-exclusivity bonus.' },
      { id:'TPL-002', name:'Premium Exclusive Agreement',      type:'Exclusive',     status:'active', royaltyRate:25, termLength:'2 Years', autoRenew:true,  usageCount:22, created:'Feb 03, 2025', lastEdited:'Jul 10, 2026', defaultChapterPrice:15, description:'For authors publishing exclusively on Droboard. Higher royalty split and eligibility for platform promotion slots.', clauses:'Full platform exclusivity, elevated royalty tier, featured-slot eligibility, 90-day early termination penalty.' },
      { id:'TPL-003', name:'Contract Renewal — Standard',      type:'Renewal',       status:'active', royaltyRate:15, termLength:'1 Year', autoRenew:false, usageCount:47, created:'Nov 21, 2024', lastEdited:'May 18, 2026', defaultChapterPrice:15, description:'Used to extend an existing non-exclusive or exclusive agreement under the same royalty terms for another cycle.', clauses:'Carries forward prior royalty rate, resets term length, requires fresh countersignature.' },
      { id:'TPL-004', name:'Royalty Amendment — Rate Increase', type:'Amendment',    status:'active', royaltyRate:20, termLength:'Indefinite', autoRenew:false, usageCount:9,  created:'Mar 09, 2025', lastEdited:'Jun 28, 2026', defaultChapterPrice:15, description:'Adjusts the royalty percentage on an existing agreement without changing the underlying term or exclusivity.', clauses:'Supersedes prior royalty clause only, all other original contract terms remain in force.' },
      { id:'TPL-005', name:'Work-for-Hire Agreement',          type:'Work-for-Hire', status:'paused', royaltyRate:0,  termLength:'Indefinite', autoRenew:false, usageCount:4,  created:'Apr 17, 2025', lastEdited:'Apr 17, 2025', defaultChapterPrice:0, description:'Flat one-time payment in exchange for full rights transfer. No ongoing royalties. Currently paused pending legal review.', clauses:'Full IP transfer to platform, one-time flat fee, no royalty entitlement, author retains attribution credit.' },
      { id:'TPL-006', name:'Ghostwriting Agreement',           type:'Work-for-Hire', status:'active', royaltyRate:0,  termLength:'6 Months', autoRenew:false, usageCount:6,  created:'Jun 12, 2025', lastEdited:'Jun 12, 2025', defaultChapterPrice:0, description:'For commissioned ghostwriters producing work under a pen name or brand owned by another author or the platform.', clauses:'No public authorship credit, confidentiality clause, milestone-based flat payments.' },
      { id:'TPL-007', name:'Translation Rights Addendum',      type:'Amendment',    status:'active', royaltyRate:10, termLength:'2 Years', autoRenew:true,  usageCount:13, created:'Aug 05, 2025', lastEdited:'Feb 14, 2026', defaultChapterPrice:15, description:'Grants the platform rights to commission and distribute translated editions of an existing work.', clauses:'Translation rights only, separate royalty pool, original agreement terms unaffected.' },
      { id:'TPL-008', name:'Audio Rights Addendum',            type:'Amendment',    status:'paused', royaltyRate:12, termLength:'2 Years', autoRenew:true,  usageCount:5,  created:'Sep 22, 2025', lastEdited:'Jan 30, 2026', defaultChapterPrice:15, description:'Grants audiobook production and distribution rights. Paused while narration vendor contracts are renegotiated.', clauses:'Audio-format rights only, revenue split on audiobook sales, narrator selection subject to author approval.' },
      { id:'TPL-009', name:'New Author Starter Agreement',     type:'Non-Exclusive', status:'active', royaltyRate:12, termLength:'6 Months', autoRenew:false, usageCount:61, created:'Oct 30, 2024', lastEdited:'Jul 21, 2026', defaultChapterPrice:10, description:'Entry-level agreement offered to first-time authors on the platform, with a shorter initial commitment.', clauses:'Short initial term, standard non-exclusive rights, automatic upgrade offer to Standard tier at renewal.' },
      { id:'TPL-010', name:'Legacy Exclusive Agreement (2023)', type:'Exclusive',     status:'archived', royaltyRate:22, termLength:'2 Years', autoRenew:true, usageCount:31, created:'Jan 05, 2023', lastEdited:'Dec 01, 2024', defaultChapterPrice:15, description:'Older exclusive template retained for reference on legacy contracts still in force. No longer offered for new signings.', clauses:'Legacy royalty tier, superseded by Premium Exclusive Agreement, retained for existing signatory reference only.' },
    ],

    reports: [
      { id:'RPT-201', targetType:'author', target:'Marcus Webb Jr.', avatar:'https://i.pravatar.cc/60?img=12', reason:'Chapter 14 of "Whispers of the Old City" matches three external sources with over 70% textual overlap, flagged by the plagiarism scanner and manually confirmed by the reporting editor.', reportedBy:'Daniel Carter', reporterType:'Senior Editor', severity:'high', filed:'3h ago', status:'open' },
      { id:'RPT-202', targetType:'author', target:"CEO's Secret Baby (unassigned)", avatar:'https://i.pravatar.cc/60?img=19', reason:'Automated scan detected near-identical opening chapters shared with a work published on a competing platform two weeks prior.', reportedBy:'System', reporterType:'System', severity:'high', filed:'1d ago', status:'open' },
      { id:'RPT-203', targetType:'editor', target:'Priya Nair', avatar:'https://i.pravatar.cc/100?img=45', reason:'Author reports slow, dismissive feedback across three consecutive chapter submissions, with turnaround times exceeding two weeks each.', reportedBy:'Ada_Writes', reporterType:'Author (direct report)', severity:'medium', filed:'1d ago', status:'open' },
      { id:'RPT-204', targetType:'author', target:'Zara_M', avatar:'https://i.pravatar.cc/60?img=36', reason:'Reader complaint about an abusive, threatening reply left on a critical review of chapter 9.', reportedBy:'Reader', reporterType:'Reader', severity:'low', filed:'2d ago', status:'open' },
      { id:'RPT-205', targetType:'editor', target:'Daniel Carter', avatar:'https://i.pravatar.cc/100?img=13', reason:'Author disputes a chapter rejection as unfair and inconsistent with prior editorial feedback on the same manuscript.', reportedBy:'Marcus Webb Jr.', reporterType:'Author (direct report)', severity:'medium', filed:'2d ago', status:'open' },
      { id:'RPT-206', targetType:'author', target:'Ada_Writes', avatar:'https://i.pravatar.cc/60?img=45', reason:'System flagged a suspected duplicate account created shortly after a prior ban, sharing device and payment fingerprints.', reportedBy:'System', reporterType:'System', severity:'high', filed:'3d ago', status:'open' },
      { id:'RPT-207', targetType:'author', target:'Wren Okonkwo', avatar:'https://i.pravatar.cc/60?img=41', reason:'Reader reported explicit content posted outside the platform\'s mature-content tagging guidelines in chapter 22.', reportedBy:'Reader', reporterType:'Reader', severity:'medium', filed:'4d ago', status:'dismissed', resolvedBy:'Adaeze Bello', resolvedAt:'3d ago', resolutionNote:'Reviewed the chapter — content was already correctly tagged mature. No violation found.' },
      { id:'RPT-208', targetType:'author', target:'Ifeanyi_Story', avatar:'https://i.pravatar.cc/60?img=8', reason:'Senior editor flagged repeated missed deadlines and unresponsiveness across two manuscript cycles.', reportedBy:'Chioma Reddy', reporterType:'Senior Editor', severity:'low', filed:'5d ago', status:'suspended', resolvedBy:'Adaeze Bello', resolvedAt:'4d ago', resolutionNote:'Account suspended for 14 days pending a response from the author.' },
      { id:'RPT-209', targetType:'author', target:'Luna Skye', avatar:'https://i.pravatar.cc/60?img=24', reason:'False report later found to be a mistaken duplicate submission of the same manuscript, not a plagiarism case.', reportedBy:'System', reporterType:'System', severity:'low', filed:'6d ago', status:'dismissed', resolvedBy:'Adaeze Bello', resolvedAt:'5d ago', resolutionNote:'Confirmed as a duplicate upload by the same author. Extra copy removed, no penalty applied.' },
      { id:'RPT-210', targetType:'editor', target:'Marcus Ihejirika', avatar:'https://i.pravatar.cc/100?img=59', reason:'Two authors independently reported delayed royalty statement explanations and unclear quota communication.', reportedBy:'Multiple authors', reporterType:'Author (direct report)', severity:'medium', filed:'1w ago', status:'open' },
      { id:'RPT-211', targetType:'author', target:'Elena Vasquez', avatar:'https://i.pravatar.cc/60?img=31', reason:'Confirmed plagiarism — full chapter lifted from a publicly available short story with only character names changed.', reportedBy:'Sophia Bennett', reporterType:'Senior Editor', severity:'high', filed:'1w ago', status:'banned', resolvedBy:'Adaeze Bello', resolvedAt:'6d ago', resolutionNote:'Account permanently banned after confirming verbatim plagiarism across the full chapter.' },
      { id:'RPT-212', targetType:'author', target:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', reason:'Reader reported impersonation — a fan account was posting chapter previews before official release.', reportedBy:'Reader', reporterType:'Reader', severity:'medium', filed:'1w ago', status:'removed', resolvedBy:'Adaeze Bello', resolvedAt:'6d ago', resolutionNote:'Confirmed the fan account was unauthorized and unrelated to the author. Content taken down by the platform team.' },
    ],

    authorPool: [
      { id:'AW-01', handle:'Ada_Writes',      name:'Ada Writes',       avatar:'https://i.pravatar.cc/100?img=32', genres:['romance','betrayal','mafia'],   books:3, reads:'1.28M', verified:true },
      { id:'AW-02', handle:'Sarah_Odum',       name:'Sarah Odum',       avatar:'https://i.pravatar.cc/100?img=48', genres:['billionaire','romance'],        books:2, reads:'2.1M',  verified:true },
      { id:'AW-03', handle:'Luna_Grey',        name:'Luna Grey',        avatar:'https://i.pravatar.cc/100?img=15', genres:['fantasy','werewolf'],           books:2, reads:'890K',  verified:true },
      { id:'AW-04', handle:'Ifeanyi_Story',    name:'Ifeanyi Story',    avatar:'https://i.pravatar.cc/100?img=53', genres:['twist','drama','romance'],      books:1, reads:'620K',  verified:true },
      { id:'AW-05', handle:'Chiamaka_N',       name:'Chiamaka Nwosu',   avatar:'https://i.pravatar.cc/100?img=47', genres:['family','drama','betrayal'],    books:1, reads:'420K',  verified:false },
      { id:'AW-06', handle:'Zara_M',           name:'Zara Mohammed',    avatar:'https://i.pravatar.cc/100?img=16', genres:['revenge','betrayal','romance'], books:1, reads:'340K',  verified:true },
      { id:'AW-07', handle:'Efe_O',            name:'Efe Okoro',        avatar:'https://i.pravatar.cc/100?img=22', genres:['elegy','romance','drama'],      books:1, reads:'510K',  verified:true },
      { id:'AW-08', handle:'Kemi_A',           name:'Kemi Adeyemi',     avatar:'https://i.pravatar.cc/100?img=28', genres:['campus','romance','drama'],     books:1, reads:'180K',  verified:false },
      { id:'AW-09', handle:'Bode_Ilo',         name:'Bode Ilo',         avatar:'https://i.pravatar.cc/100?img=12', genres:['campus','comedy'],              books:1, reads:'260K',  verified:false },
      { id:'AW-10', handle:'Marcus_Webb',      name:'Marcus Webb Jr.',   avatar:'https://i.pravatar.cc/100?img=12', genres:['drama','fantasy'],              books:1, reads:'150K',  verified:false },
      { id:'AW-11', handle:'Wren_O',           name:'Wren Okonkwo',     avatar:'https://i.pravatar.cc/100?img=41', genres:['romance','drama'],              books:1, reads:'210K',  verified:true },
      { id:'AW-12', handle:'Elena_V',          name:'Elena Vasquez',    avatar:'https://i.pravatar.cc/100?img=31', genres:['romance','betrayal'],           books:1, reads:'180K',  verified:true },
    ],

    seniorEditorAssignments: {
      'SE-01': ['AW-01','AW-04','AW-06'],
      'SE-02': ['AW-10','AW-11'],
      'SE-03': ['AW-02','AW-03','AW-07'],
      'SE-04': ['AW-05','AW-12'],
      'SE-05': ['AW-08'],
      'SE-06': ['AW-09'],
      'SE-07': [],
      'SE-08': [],
      'SE-09': [],
      'SE-10': [],
      'SE-11': [],
      'SE-12': [],
      'SE-13': [],
      'SE-14': [],
    },
  };

  window.ChiefEditorData = {
    async getDashboard() { return clone(DEMO.dashboard); },
    async getDashboardStats() {
      const d = DEMO.dashboard;
      return {
        seniorEditors: d.totalSeniorEditors,
        seniorEditorsDelta: '+2 this quarter',
        pendingPolicies: 3,
        pendingPoliciesDelta: '+1 this week',
        escalatedDisputes: d.flaggedReports.filter(r => r.status === 'open').length,
        escalatedDisputesDelta: '+2 today',
        contractsAwaiting: d.pendingSignatures,
        contractsAwaitingDelta: '4 pending',
        submissionsThisMonth: 847,
        submissionsDelta: '+12% vs last month',
      };
    },
    async getPerformanceTrend(period) {
      const trends = {
        week:   { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], submissions: [42,58,51,67,73,38,24], approvalRate: [88,85,90,82,87,91,89] },
        month:  { labels: ['W1','W2','W3','W4'], submissions: [186,214,198,249], approvalRate: [86,84,89,87] },
        quarter:{ labels: ['Jan','Feb','Mar'], submissions: [720,810,847], approvalRate: [85,87,88] },
        year:   { labels: ['2023','2024','2025','2026'], submissions: [4200,6800,8400,3200], approvalRate: [82,85,87,88] },
      };
      return trends[period] || trends.month;
    },
    async getDashboardQueues() {
      return {
        dispute: DEMO.dashboard.flaggedReports.filter(r => r.status === 'open').map(r => ({
          id: r.id, title: r.target, from: r.reportedBy, escalatedBy: r.reportedBy,
          time: r.filed, priority: r.severity, detail: r.reason,
        })),
        policy: [
          { id: 'POL-01', title: 'Updated Plagiarism Detection Policy', from: 'Adaeze Bello', escalatedBy: 'Platform Policy Team', time: '2d ago', priority: 'high', detail: 'Requires chief editor sign-off before enforcement. Adds AI-generated content detection clause.' },
          { id: 'POL-02', title: 'Mature Content Tagging Guidelines v2', from: 'Adaeze Bello', escalatedBy: 'Content Standards', time: '3d ago', priority: 'medium', detail: 'Proposed update to tagging rules after reader complaints about inconsistent labels.' },
        ],
        contract: DEMO.dashboard.pendingContracts.map(c => ({
          id: c.id, title: c.type + ' — ' + c.author, from: c.forwardedBy, escalatedBy: c.forwardedBy,
          time: c.submitted, priority: 'medium', detail: 'Author has signed. Awaiting chief editor countersignature.', value: null,
        })),
      };
    },
    async getEditorialTeam() {
      return DEMO.seniorEditors.map(ed => ({
        id: ed.id,
        name: ed.name,
        avatar: ed.avatar,
        email: ed.email,
        team: ed.authorsManaged + ' authors managed',
        reviewsThisMonth: Math.floor(Math.random() * 30) + 15,
        approvalRate: ed.status === 'ahead' ? 92 : ed.status === 'on-track' ? 88 : 74,
        status: ed.openReports > 0 ? 'needs-attention' : 'online',
      }));
    },
    async getRecentActivity() { return clone(DEMO.dashboard.recentActivity); },
    async resolveQueueItem() { return { ok: true }; },
    async getSeniorEditors() { return clone(DEMO.seniorEditors); },
    async getContractTemplates() { return clone(DEMO.contractTemplates); },
    async getReports() { return clone(DEMO.reports); },
    async getAuthorPool() { return clone(DEMO.authorPool); },
    async getAssignments() { return clone(DEMO.seniorEditorAssignments); },
    async saveAssignments(a) { Object.assign(DEMO.seniorEditorAssignments, a); return { ok: true }; },

    async addPendingEditor(data) {
      var id = 'SE-' + String(DEMO.seniorEditors.length + 1).padStart(2, '0');
      var token = 'inv_' + Math.random().toString(36).substring(2, 14) + Date.now().toString(36);
      var editor = {
        id: id,
        name: data.name,
        avatar: 'https://i.pravatar.cc/100?img=' + (Math.floor(Math.random() * 60) + 1),
        email: data.email,
        joined: '',
        authorsManaged: 0,
        target: data.target || 50,
        invited: 0,
        status: 'pending',
        monthlyPay: data.pay || '$0',
        ytdPaid: '$0',
        deadline: data.deadline || '',
        openReports: 0,
        inviteToken: token,
        inviteNote: data.note || '',
        invitedAt: new Date().toISOString(),
      };
      DEMO.seniorEditors.push(editor);
      DEMO.seniorEditorAssignments[id] = [];
      return clone(editor);
    },

    async getByInviteToken(token) {
      return clone(DEMO.seniorEditors.find(function(e) { return e.inviteToken === token && e.status === 'pending'; }) || null);
    },

    async acceptInvite(token, password) {
      var editor = DEMO.seniorEditors.find(function(e) { return e.inviteToken === token && e.status === 'pending'; });
      if (!editor) return null;
      editor.status = 'on-track';
      editor.joined = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      editor.password = password;
      return clone(editor);
    },

    async cancelInvite(id) {
      var idx = DEMO.seniorEditors.findIndex(function(e) { return e.id === id && e.status === 'pending'; });
      if (idx === -1) return null;
      var removed = DEMO.seniorEditors.splice(idx, 1)[0];
      delete DEMO.seniorEditorAssignments[id];
      return clone(removed);
    },

    async getEditorialStrategy() {
      return {
        strategyNotes: 'Focus on expanding romance and thriller genres while maintaining quality in fantasy. Partner with 3 new translation services for Asian markets. Launch seasonal writing contests to drive engagement.',
        genrePriorities: [
          { genre: 'Romance', priority: 'high', currentSubmissions: 245, targetSubmissions: 300, growth: '+18% QoQ', notes: 'Highest demand genre. Expand sub-genres.' },
          { genre: 'Thriller', priority: 'high', currentSubmissions: 189, targetSubmissions: 250, growth: '+24% QoQ', notes: 'Fastest growing. Recruit thriller specialists.' },
          { genre: 'Fantasy', priority: 'medium', currentSubmissions: 132, targetSubmissions: 150, growth: '+8% QoQ', notes: 'Steady demand. Focus on worldbuilding quality.' },
          { genre: 'Sci-Fi', priority: 'medium', currentSubmissions: 98, targetSubmissions: 120, growth: '+12% QoQ', notes: 'Growing niche. Partner with tech publications.' },
          { genre: 'Non-Fiction', priority: 'low', currentSubmissions: 67, targetSubmissions: 80, growth: '+5% QoQ', notes: 'Stable but low volume. Maintain current output.' },
        ],
        quarterlyGoals: [
          { quarter: 'Q3 2026', goals: ['Increase romance submissions by 20%', 'Launch 2 seasonal writing contests', 'Onboard 5 new senior editors', 'Reduce dispute resolution time to 48 hours'] },
          { quarter: 'Q4 2026', goals: ['Expand to 3 new translation markets', 'Launch author mentorship program', 'Achieve 90% author satisfaction score', 'Process all pending contracts within 72 hours'] },
        ],
        seasonalCampaigns: [
          { name: 'Summer Romance Blitz', status: 'active', deadline: 'Aug 31, 2026', budget: '$12,000', submissions: 89, target: 150 },
          { name: 'Thriller October', status: 'planning', deadline: 'Oct 31, 2026', budget: '$8,500', submissions: 0, target: 100 },
          { name: 'Winter Fantasy Festival', status: 'planning', deadline: 'Dec 31, 2026', budget: '$15,000', submissions: 0, target: 200 },
        ],
        acquisitionTargets: [
          { author: 'Nadia Volkov', status: 'contacted', genre: 'Romance / Drama', followers: '245K', notes: 'Bestselling author on competing platform. Open to exclusive deals.' },
          { author: 'James Okoro', status: 'targeted', genre: 'Thriller / Mystery', followers: '180K', notes: 'Strong following in West African market. High engagement rate.' },
          { author: 'Mika Tanaka', status: 'negotiating', genre: 'Fantasy / Sci-Fi', followers: '310K', notes: 'Award-winning author. Seeking higher royalty rates.' },
        ],
      };
    },

    async getEditorialPolicies() {
      return {
        policies: [
          { id: 'POL-001', title: 'Plagiarism Detection & Enforcement Policy', status: 'published', updated: 'Jul 12, 2026', author: 'Adaeze Bello', summary: 'Comprehensive policy for detecting, investigating, and enforcing against plagiarism across all submissions. Includes automated scanning thresholds and manual review procedures.' },
          { id: 'POL-002', title: 'Content Quality Standards', status: 'published', updated: 'Jun 28, 2026', author: 'Adaeze Bello', summary: 'Minimum quality standards for all published content including grammar, pacing, character development, and reader engagement metrics.' },
          { id: 'POL-003', title: 'Author Code of Conduct', status: 'published', updated: 'Jun 15, 2026', author: 'Adaeze Bello', summary: 'Expected behavior standards for all authors including response times, professional communication, and community guidelines.' },
          { id: 'POL-004', title: 'Mature Content Tagging Guidelines v2', status: 'under-review', updated: 'Jul 15, 2026', author: 'Content Standards Team', summary: 'Updated guidelines for tagging mature content including explicit scenes, violence, and trigger warnings. Addresses reader complaints about inconsistent labeling.' },
          { id: 'POL-005', title: 'AI-Generated Content Disclosure Policy', status: 'draft', updated: 'Jul 18, 2026', author: 'Adaeze Bello', summary: 'New policy requiring authors to disclose AI-assisted writing. Defines acceptable use boundaries and disclosure requirements.' },
          { id: 'POL-006', title: 'Senior Editor Performance Review', status: 'published', updated: 'May 30, 2026', author: 'Adaeze Bello', summary: 'Framework for evaluating senior editor performance including quotas, author satisfaction, and dispute resolution metrics.' },
        ],
        policyHistory: [
          { date: 'Jul 18, 2026', action: 'AI-Generated Content Disclosure Policy submitted for review', by: 'Adaeze Bello' },
          { date: 'Jul 15, 2026', action: 'Mature Content Tagging Guidelines v2 submitted for review', by: 'Content Standards Team' },
          { date: 'Jul 12, 2026', action: 'Plagiarism Detection & Enforcement Policy updated', by: 'Adaeze Bello' },
          { date: 'Jun 28, 2026', action: 'Content Quality Standards revised', by: 'Adaeze Bello' },
          { date: 'Jun 15, 2026', action: 'Author Code of Conduct published', by: 'Adaeze Bello' },
          { date: 'May 30, 2026', action: 'Senior Editor Performance Review framework published', by: 'Adaeze Bello' },
        ],
      };
    },

    async getAuthorContracts() {
      return {
        templates: [
          { name: 'Standard Non-Exclusive', type: 'non-exclusive', royalty: 15, defaultChapterPrice: 15, term: '1 Year', used: 38, status: 'active' },
          { name: 'Premium Exclusive', type: 'exclusive', royalty: 25, defaultChapterPrice: 15, term: '2 Years', used: 22, status: 'active' },
          { name: 'Contract Renewal', type: 'renewal', royalty: 15, defaultChapterPrice: 15, term: '1 Year', used: 47, status: 'active' },
          { name: 'Royalty Amendment', type: 'amendment', royalty: 20, defaultChapterPrice: 15, term: 'Indefinite', used: 9, status: 'active' },
          { name: 'New Author Starter', type: 'non-exclusive', royalty: 12, defaultChapterPrice: 10, term: '6 Months', used: 61, status: 'active' },
          { name: 'Work-for-Hire', type: 'work-for-hire', royalty: 0, defaultChapterPrice: 0, term: 'Indefinite', used: 4, status: 'draft' },
        ],
        activeContracts: [
          { author: 'Luna Skye', status: 'active', template: 'Standard Non-Exclusive', value: '$18,400', start: 'Jan 15, 2026', end: 'Jan 15, 2027' },
          { author: 'Wren Okonkwo', status: 'active', template: 'Premium Exclusive', value: '$32,500', start: 'Mar 01, 2026', end: 'Mar 01, 2028' },
          { author: 'Ada_Writes', status: 'active', template: 'Standard Non-Exclusive', value: '$12,800', start: 'Feb 10, 2026', end: 'Feb 10, 2027' },
          { author: 'Marcus Webb Jr.', status: 'expiring', template: 'Standard Non-Exclusive', value: '$8,200', start: 'Aug 20, 2025', end: 'Aug 20, 2026' },
          { author: 'Ifeanyi_Story', status: 'active', template: 'Premium Exclusive', value: '$24,600', start: 'Apr 05, 2026', end: 'Apr 05, 2028' },
        ],
        pendingOffers: [
          { author: 'Zara_M', status: 'awaiting-signature', template: 'New Author Starter', value: '$6,000', sent: 'Jul 14, 2026' },
          { author: 'Elena Vasquez', status: 'pending', template: 'Standard Non-Exclusive', value: '$9,500', sent: 'Jul 10, 2026' },
          { author: 'Isabelle Moreau', status: 'under-review', template: 'Premium Exclusive', value: '$28,000', sent: 'Jul 08, 2026' },
        ],
      };
    },

    async getDisputesAppeals() {
      return {
        authorAppeals: [
          { author: 'Marcus Webb Jr.', type: 'Plagiarism Charge Appeal', priority: 'high', status: 'open', detail: 'Author disputes plagiarism findings for Chapter 14 of "Whispers of the Old City", claiming independent inspiration.', filed: '3h ago', id: 'APL-001' },
          { author: 'Zara_M', type: 'Content Takedown Appeal', priority: 'medium', status: 'investigating', detail: 'Author appeals the removal of Chapter 9, arguing the content was taken out of context.', filed: '2d ago', id: 'APL-002' },
          { author: 'Ada_Writes', type: 'Duplicate Account Appeal', priority: 'high', status: 'open', detail: 'Author claims the flagged account is not a duplicate but a new account created after account recovery issues.', filed: '3d ago', id: 'APL-003' },
        ],
        copyrightDisputes: [
          { title: 'CEO\'s Secret Baby — Source Material Dispute', status: 'investigating', claimant: 'Original Author (External)', respondent: 'Unassigned Work', filed: '1d ago', resolution: null },
          { title: 'Chapter 22 Mature Content Rights', status: 'resolved', claimant: 'Wren Okonkwo', respondent: 'Platform Content Team', filed: '4d ago', resolution: 'Content correctly tagged. No rights violation found.' },
        ],
        plagiarismCases: [
          { story: '"Whispers of the Old City" Ch.14', status: 'open', accused: 'Marcus Webb Jr.', filed: '3h ago', confidence: 78 },
          { story: '"CEO\'s Secret Baby" Opening', status: 'open', accused: 'Unassigned Work', filed: '1d ago', confidence: 92 },
          { story: '"Desert Nights" Ch.8', status: 'resolved', accused: 'Elena Vasquez', filed: '1w ago', confidence: 95 },
        ],
        escalatedReports: [
          { type: 'DMCA Takedown', priority: 'high', status: 'open', filed: '1d ago', reporter: 'External Publisher', against: 'Unassigned Work' },
          { type: 'Author Misconduct', priority: 'medium', status: 'open', filed: '2d ago', reporter: 'Marcus Webb Jr.', against: 'Daniel Carter' },
          { type: 'Unfair Rejection', priority: 'medium', status: 'investigating', filed: '2d ago', reporter: 'Marcus Webb Jr.', against: 'Daniel Carter' },
        ],
        resolutionHistory: [
          { action: 'Mature content tag verified — no violation', date: '3d ago', by: 'Adaeze Bello' },
          { action: 'Plagiarism confirmed — Elena Vasquez account banned', date: '6d ago', by: 'Adaeze Bello' },
          { action: 'Fan account content taken down', date: '6d ago', by: 'Platform Team' },
          { action: 'Ifeanyi_Story suspended for 14 days', date: '4d ago', by: 'Adaeze Bello' },
        ],
      };
    },

    async getPartnerships() {
      return {
        publishingPartners: [
          { name: 'Penguin Random House SEA', status: 'active', type: 'Traditional Publisher', region: 'Southeast Asia', titlesLicensed: 45, revenue: '$124,000' },
          { name: 'Kadokawa International', status: 'negotiating', type: 'Media Conglomerate', region: 'Japan / East Asia', titlesLicensed: 32, revenue: '$98,500' },
          { name: 'Hachette Livre Africa', status: 'active', type: 'Traditional Publisher', region: 'West Africa', titlesLicensed: 28, revenue: '$67,200' },
        ],
        translationPartners: [
          { name: 'LinguaSoft Translations', status: 'active', languages: 'Spanish, Portuguese, French', territories: 'Europe, Latin America', revenue: '$45,800' },
          { name: 'AsiaLingua Services', status: 'active', languages: 'Mandarin, Japanese, Korean', territories: 'East Asia', revenue: '$62,300' },
          { name: 'ArabicScript Translations', status: 'contacted', languages: 'Arabic, Turkish', territories: 'Middle East, North Africa', revenue: '$0' },
        ],
        writingContests: [
          { name: 'Droboard Summer Romance Contest', status: 'active', prize: '$5,000 + Publishing Deal', deadline: 'Aug 31, 2026', entries: 342 },
          { name: 'Thriller writers Championship', status: 'planning', prize: '$3,000 + Featured Placement', deadline: 'Oct 31, 2026', entries: 0 },
          { name: 'Fantasy World Builder Award', status: 'planning', prize: '$4,000 + Audiobook Production', deadline: 'Dec 15, 2026', entries: 0 },
        ],
        ipMediaOpportunities: [
          { title: 'Film Adaptation — "Whispers of the Old City"', status: 'negotiating', type: 'Film', partner: 'Nollywood Global Studios', value: '$85,000' },
          { title: 'Audiobook Series — Romance Collection', status: 'active', type: 'Audiobook', partner: 'Audible Originals', value: '$42,000' },
          { title: 'Web Drama — "CEO\'s Secret Baby"', status: 'targeted', type: 'Web Series', partner: 'Various Studios', value: '$120,000' },
        ],
        partnershipRequests: [
          { from: 'Storytel Nordics', status: 'under-review', type: 'Audiobook Licensing', date: 'Jul 15, 2026', notes: 'Requesting exclusive audiobook rights for Scandinavian markets. 30 titles offered.' },
          { from: 'Wattpad Studios', status: 'exploring', type: 'Co-Production', date: 'Jul 10, 2026', notes: 'Proposal for joint production of top-performing stories into short-form video content.' },
          { from: 'Google Play Books', status: 'active', type: 'Distribution', date: 'Jun 28, 2026', notes: 'Expanded distribution agreement for European markets. Currently processing.' },
        ],
      };
    },
  };
})();
