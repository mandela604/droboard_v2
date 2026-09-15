/**
 * contracts-demo-data.js — Central demo data for the Contracts module
 * ──────────────────────────────────────────────────────────────
 * Exposes window.ContractsDemo with all demo data.
 */
(function(){
'use strict';
if(window.__contractsDemo) return;
window.__contractsDemo = true;

var DEMO = {
  contracts: [
    {id:'CNTR-2026-001',author:'Sofia Lindqvist',authorAv:'https://i.pravatar.cc/100?img=32',book:'Bound by the Ruthless Alpha',type:'Exclusive Publishing',status:'awaiting',dateSent:'Jul 5, 2026',signedDate:'—',duration:'2 Years',revenue:70,advance:80000,notes:'First exclusive deal. High-priority author.',replies:[]},
    {id:'CNTR-2026-002',author:'Daniel Reyes',authorAv:'https://i.pravatar.cc/100?img=51',book:"The CEO's Secret Baby",type:'Revenue Share',status:'signed',dateSent:'Jul 2, 2026',signedDate:'Jul 4, 2026',duration:'1 Year',revenue:65,advance:40000,notes:'Standard revenue share.',replies:[]},
    {id:'CNTR-2026-003',author:'Amara Okafor',authorAv:'https://i.pravatar.cc/100?img=45',book:'Lagos Love Chronicles',type:'Exclusive Publishing',status:'active',dateSent:'Jun 20, 2026',signedDate:'Jun 22, 2026',duration:'3 Years',revenue:75,advance:120000,notes:'Top-performing author renewal.',replies:[
      {from:'Amara Okafor',message:'Hi Reina! Thank you for the renewal offer. The terms look great.',time:'2026-06-21T11:00:00'},
      {from:'Reina Morgan',message:'Wonderful to hear, Amara! Your performance has been outstanding. We\'re excited to continue working with you.',time:'2026-06-21T11:30:00'},
      {from:'Amara Okafor',message:'One quick question — can we include a clause about audiobook rights for the new titles?',time:'2026-06-22T08:45:00'}
    ]},
    {id:'CNTR-2026-004',author:'Julien Moreau',authorAv:'https://i.pravatar.cc/100?img=15',book:'Midnight in Paris',type:'License Agreement',status:'awaiting',dateSent:'Jul 6, 2026',signedDate:'—',duration:'1 Year',revenue:60,advance:30000,notes:'International license for French market.',replies:[
      {from:'Julien Moreau',message:'Bonjour Reina, I have a few questions about the French territory restrictions in the contract.',time:'2026-07-07T08:30:00'},
      {from:'Reina Morgan',message:'Bonjour Julien! Of course, happy to clarify. The license covers France, Belgium, and Switzerland French-speaking regions.',time:'2026-07-07T09:15:00'},
      {from:'Julien Moreau',message:'What about digital distribution through French e-commerce platforms? Are those included?',time:'2026-07-07T10:00:00'}
    ]},
    {id:'CNTR-2026-005',author:'Nadia Petrov',authorAv:'https://i.pravatar.cc/100?img=24',book:"Winter's Promise",type:'Revenue Share',status:'rejected',dateSent:'Jun 28, 2026',signedDate:'—',duration:'2 Years',revenue:55,advance:25000,notes:'Author requested higher revenue split.',settled:true,replies:[
      {from:'Nadia Petrov',message:'Hi, I received the contract but I was hoping for a 65% revenue split. Is there any flexibility?',time:'2026-06-29T09:15:00'},
      {from:'Reina Morgan',message:'Hi Nadia, we understand your concern. The current offer is our standard rate for new authors. We can revisit after 6 months of performance.',time:'2026-06-29T10:00:00'},
      {from:'Nadia Petrov',message:'I understand. Could we at least add a clause for performance review at 3 months?',time:'2026-06-29T14:30:00'},
      {from:'Reina Morgan',message:'That\'s a reasonable request. I\'ll draft an addendum for a 3-month performance review. Let me send over the updated terms.',time:'2026-06-30T09:00:00'},
      {from:'System',message:'This conversation has been settled by Reina Morgan.',time:'2026-06-30T09:05:00'}
    ]},
    {id:'CNTR-2026-006',author:'Kenji Watanabe',authorAv:'https://i.pravatar.cc/100?img=13',book:'Tokyo Drift Hearts',type:'Exclusive Publishing',status:'signed',dateSent:'Jun 15, 2026',signedDate:'Jun 18, 2026',duration:'2 Years',revenue:70,advance:60000,notes:'Japanese market exclusive.',replies:[]},
    {id:'CNTR-2026-007',author:'Priya Nair',authorAv:'https://i.pravatar.cc/100?img=27',book:'Spice of Life',type:'Revenue Share',status:'active',dateSent:'May 10, 2026',signedDate:'May 12, 2026',duration:'1 Year',revenue:65,advance:35000,notes:'Ongoing. Good performance.',replies:[]},
    {id:'CNTR-2026-008',author:'Owen Fitzgerald',authorAv:'https://i.pravatar.cc/100?img=6',book:'The Irish Inheritance',type:'License Agreement',status:'expired',dateSent:'Jan 5, 2026',signedDate:'Jan 8, 2026',duration:'6 Months',revenue:50,advance:15000,notes:'Short-term license. Expired.',replies:[]},
    {id:'CNTR-2026-009',author:'Layla Haddad',authorAv:'https://i.pravatar.cc/100?img=48',book:'Desert Rose',type:'Exclusive Publishing',status:'awaiting',dateSent:'Jul 7, 2026',signedDate:'—',duration:'3 Years',revenue:72,advance:95000,notes:'New author. Promising debut.',replies:[]},
    {id:'CNTR-2026-010',author:'Isabella Rossi',authorAv:'https://i.pravatar.cc/100?img=38',book:'Under the Tuscan Sun',type:'Revenue Share',status:'active',dateSent:'Apr 1, 2026',signedDate:'Apr 3, 2026',duration:'2 Years',revenue:68,advance:55000,notes:'Consistent performer.',replies:[]},
    {id:'CNTR-2026-011',author:'Luna Skye',authorAv:'https://i.pravatar.cc/100?img=24',book:'His Hidden Luna',type:'Exclusive Publishing',status:'active',dateSent:'Jun 5, 2026',signedDate:'Jun 7, 2026',duration:'2 Years',revenue:70,advance:80000,notes:'Werewolf romance. Strong readership.',replies:[]},
    {id:'CNTR-2026-012',author:'Ava Winters',authorAv:'https://i.pravatar.cc/100?img=41',book:'The Ruthless CEO',type:'Exclusive Publishing',status:'signed',dateSent:'Jun 10, 2026',signedDate:'Jun 12, 2026',duration:'2 Years',revenue:70,advance:75000,notes:'Billionaire romance. Top seller.',replies:[]},
    {id:'CNTR-2026-013',author:'Mia Carter',authorAv:'https://i.pravatar.cc/100?img=29',book:'Reborn to Revenge',type:'Revenue Share',status:'awaiting',dateSent:'Jun 8, 2026',signedDate:'—',duration:'1 Year',revenue:60,advance:30000,notes:'Revenue share deal.',replies:[]},
    {id:'CNTR-2026-014',author:'Bella King',authorAv:'https://i.pravatar.cc/100?img=44',book:'Claimed by the Mafia King',type:'Exclusive Publishing',status:'active',dateSent:'May 20, 2024',signedDate:'May 22, 2024',duration:'2 Years',revenue:70,advance:60000,notes:'Mafia romance. Expiring soon.',replies:[]},
    {id:'CNTR-2026-015',author:'Ethan Vale',authorAv:'https://i.pravatar.cc/100?img=53',book:"The Vampire's Obsession",type:'License Agreement',status:'expired',dateSent:'Apr 15, 2024',signedDate:'Apr 18, 2024',duration:'2 Years',revenue:55,advance:20000,notes:'Vampire fantasy. License expired.',replies:[]}
  ],

  templates: [
    {id:1,name:'Exclusive Publishing Agreement',desc:'Full exclusive rights for publishing and distribution across all formats.',type:'Publishing',icon:'fa-file-circle-check',bg:'#e2f8ea',color:'#16a34a',status:'active',updated:'Jun 15, 2026',by:'Reina Morgan',clauses:14,
     preview:{title:'EXCLUSIVE PUBLISHING AGREEMENT',body:'This Exclusive Publishing Agreement ("Agreement") is entered into between NovelX Platform Ltd. ("Publisher") and the Author. The Author grants exclusive rights to publish, reproduce, distribute, and sell the Work in all digital and print formats worldwide for the duration of this Agreement.'}},
    {id:2,name:'Revenue Share Agreement',desc:'Standard revenue sharing terms between platform and author.',type:'Financial',icon:'fa-sack-dollar',bg:'#e2f8ea',color:'#16a34a',status:'active',updated:'Jun 10, 2026',by:'Reina Morgan',clauses:9,
     preview:{title:'REVENUE SHARE AGREEMENT',body:'This Revenue Share Agreement defines the financial terms between the Publisher and the Author. Revenue shall be split according to the percentage specified in the individual contract. Payments are processed monthly with a 30-day settlement period.'}},
    {id:3,name:'License Agreement',desc:'Limited license for specific territories or formats.',type:'Rights',icon:'fa-globe',bg:'#e3ecfd',color:'#2f7de1',status:'active',updated:'Jun 5, 2026',by:'Reina Morgan',clauses:10,
     preview:{title:'LICENSE AGREEMENT',body:'This License Agreement grants the Author a limited, non-exclusive license to distribute the Work in the specified territory or format. All rights not explicitly granted remain with the Author.'}},
    {id:4,name:'Non-Exclusive Publishing Agreement',desc:'Standard agreement for non-exclusive publishing rights.',type:'Publishing',icon:'fa-file-lines',bg:'#ece3fd',color:'#7c5cfc',status:'active',updated:'May 28, 2026',by:'Reina Morgan',clauses:12,
     preview:{title:'NON-EXCLUSIVE PUBLISHING AGREEMENT',body:'This Non-Exclusive Publishing Agreement allows the Author to publish the Work through the Platform while retaining the right to publish through other channels. The Platform receives a non-exclusive license to distribute the Work.'}},
    {id:5,name:'Author Assignment Agreement',desc:'Transfer of certain rights by the author to the platform.',type:'Legal',icon:'fa-user-pen',bg:'#fde3e3',color:'#e0384d',status:'active',updated:'May 25, 2026',by:'Reina Morgan',clauses:8,
     preview:{title:'AUTHOR ASSIGNMENT AGREEMENT',body:'This Assignment Agreement transfers specified rights from the Author to the Platform for the purpose of publishing, marketing, and distributing the Work.'}},
    {id:6,name:'Confidentiality Agreement (NDA)',desc:'Non-disclosure agreement for confidential manuscript information.',type:'Legal',icon:'fa-lock',bg:'#fde3e3',color:'#e0384d',status:'draft',updated:'May 20, 2026',by:'Reina Morgan',clauses:6,
     preview:{title:'NON-DISCLOSURE AGREEMENT',body:'This NDA ensures that all unpublished manuscript content, plot details, and author information remain confidential between the parties.'}},
    {id:7,name:'Translation Rights Agreement',desc:'Agreement for translation and foreign language distribution rights.',type:'Rights',icon:'fa-language',bg:'#e2f8ea',color:'#16a34a',status:'active',updated:'May 15, 2026',by:'Reina Morgan',clauses:10,
     preview:{title:'TRANSLATION RIGHTS AGREEMENT',body:'This Agreement grants the right to translate the Work into specified languages and distribute in foreign markets.'}},
    {id:8,name:'Short Story Publishing Agreement',desc:'Streamlined agreement for short-form content.',type:'Publishing',icon:'fa-book',bg:'#e2f8ea',color:'#16a34a',status:'active',updated:'May 10, 2026',by:'Reina Morgan',clauses:7,
     preview:{title:'SHORT STORY PUBLISHING AGREEMENT',body:'This Agreement covers the publishing rights for short-form content under 30,000 words.'}},
    {id:9,name:'Film & Adaptation Rights Agreement',desc:'Agreement for film, TV, and multimedia adaptation rights.',type:'Rights',icon:'fa-film',bg:'#fef3d8',color:'#d97706',status:'draft',updated:'May 5, 2026',by:'Reina Morgan',clauses:13,
     preview:{title:'FILM & ADAPTATION RIGHTS AGREEMENT',body:'This Agreement covers the rights to adapt the Work into film, television, or other multimedia formats.'}},
    {id:10,name:'Audiobook Rights Agreement',desc:'Agreement for audiobook production and distribution.',type:'Rights',icon:'fa-headphones',bg:'#fef3d8',color:'#d97706',status:'archived',updated:'Apr 20, 2026',by:'Reina Morgan',clauses:11,
     preview:{title:'AUDIOBOOK RIGHTS AGREEMENT',body:'This Agreement covers the production, distribution, and sale of audiobook versions of the Work.'}}
  ],

  signedContracts: [
    {id:'CNTR-2026-002',cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg',title:"The CEO's Secret Baby",author:'Daniel Reyes',authorAv:'https://i.pravatar.cc/100?img=51',type:'Revenue Share',status:'active',effective:'Jul 4, 2026',expiry:'Jul 4, 2027',duration:'1 Year',revenue:65,advance:40000,editor:'Reina Morgan',editorAvatar:'https://i.pravatar.cc/100?img=47',signedAt:'Jul 4, 2026',
     clauses:['Grant of Rights','Revenue Share Terms','Payment Schedule','Term & Termination','Author Representations','Confidentiality','Indemnification','Governing Law','Dispute Resolution']},
    {id:'CNTR-2026-003',cover:'https://i.postimg.cc/ftRZbhKx/3.jpg',title:'Lagos Love Chronicles',author:'Amara Okafor',authorAv:'https://i.pravatar.cc/100?img=45',type:'Exclusive Publishing',status:'active',effective:'Jun 22, 2026',expiry:'Jun 22, 2029',duration:'3 Years',revenue:75,advance:120000,editor:'Reina Morgan',editorAvatar:'https://i.pravatar.cc/100?img=47',signedAt:'Jun 22, 2026',
     clauses:['Grant of Rights','Exclusivity Terms','Revenue & Royalties','Payment Schedule','Term & Termination','Author Representations','Confidentiality','Indemnification','Governing Law','Dispute Resolution','Force Majeure','Assignment','Amendments','Severability']},
    {id:'CNTR-2026-006',cover:'https://i.postimg.cc/tY7KnJyr/images.jpg',title:'Tokyo Drift Hearts',author:'Kenji Watanabe',authorAv:'https://i.pravatar.cc/100?img=13',type:'Exclusive Publishing',status:'active',effective:'Jun 18, 2026',expiry:'Jun 18, 2028',duration:'2 Years',revenue:70,advance:60000,editor:'Daniel Carter',editorAvatar:'https://i.pravatar.cc/100?img=12',signedAt:'Jun 18, 2026',
     clauses:['Grant of Rights','Exclusivity Terms','Revenue & Royalties','Payment Schedule','Term & Termination','Author Representations','Confidentiality','Indemnification','Governing Law','Dispute Resolution','Force Majeure','Assignment','Amendments','Severability']},
    {id:'CNTR-2026-007',cover:'https://i.postimg.cc/N9jY0w4m/5.jpg',title:'Spice of Life',author:'Priya Nair',authorAv:'https://i.pravatar.cc/100?img=27',type:'Revenue Share',status:'active',effective:'May 12, 2026',expiry:'May 12, 2027',duration:'1 Year',revenue:65,advance:35000,editor:'Sophia Bennett',editorAvatar:'https://i.pravatar.cc/100?img=29',signedAt:'May 12, 2026',
     clauses:['Grant of Rights','Revenue Share Terms','Payment Schedule','Term & Termination','Author Representations','Confidentiality','Indemnification','Governing Law','Dispute Resolution']},
    {id:'CNTR-2026-010',cover:'https://i.postimg.cc/cgLZJNmC/8.jpg',title:'Under the Tuscan Sun',author:'Isabella Rossi',authorAv:'https://i.pravatar.cc/100?img=38',type:'Revenue Share',status:'active',effective:'Apr 3, 2026',expiry:'Apr 3, 2028',duration:'2 Years',revenue:68,advance:55000,editor:'Reina Morgan',editorAvatar:'https://i.pravatar.cc/100?img=47',signedAt:'Apr 3, 2026',
     clauses:['Grant of Rights','Revenue Share Terms','Payment Schedule','Term & Termination','Author Representations','Confidentiality','Indemnification','Governing Law','Dispute Resolution','Force Majeure']},
    {id:'CNTR-2026-011',cover:'https://i.postimg.cc/fkdXzjSj/wife.jpg',title:'His Hidden Luna',author:'Luna Skye',authorAv:'https://i.pravatar.cc/100?img=24',type:'Exclusive Publishing',status:'active',effective:'Jun 7, 2026',expiry:'Jun 7, 2028',duration:'2 Years',revenue:70,advance:80000,editor:'Reina Morgan',editorAvatar:'https://i.pravatar.cc/100?img=47',signedAt:'Jun 7, 2026',
     clauses:['Grant of Rights','Exclusivity Terms','Revenue & Royalties','Payment Schedule','Term & Termination','Author Representations','Confidentiality','Indemnification','Governing Law','Dispute Resolution','Force Majeure','Assignment','Amendments','Severability']},
    {id:'CNTR-2026-012',cover:'https://i.postimg.cc/0MyxNqfz/7.jpg',title:'The Ruthless CEO',author:'Ava Winters',authorAv:'https://i.pravatar.cc/100?img=41',type:'Exclusive Publishing',status:'active',effective:'Jun 12, 2026',expiry:'Jun 12, 2028',duration:'2 Years',revenue:70,advance:75000,editor:'Daniel Carter',editorAvatar:'https://i.pravatar.cc/100?img=12',signedAt:'Jun 12, 2026',
     clauses:['Grant of Rights','Exclusivity Terms','Revenue & Royalties','Payment Schedule','Term & Termination','Author Representations','Confidentiality','Indemnification','Governing Law','Dispute Resolution','Force Majeure','Assignment','Amendments','Severability']}
  ]
};

window.ContractsDemo = DEMO;
})();
