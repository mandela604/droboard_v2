/* ═══════════════════════════════════════════════════════════════
   editor-demo-data.js — Centralized demo data for all Editor pages
   Each page reads from window.EditorDemo instead of inline arrays.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── ACTIVITY LOGS ── */
  var LOGS = [
    { user:'Reina Morgan', av:'https://i.pravatar.cc/100?img=47', action:'Approved contract CNTR-2026-00125', type:'update', detail:'Signed Exclusive Publishing Agreement for "Bound by the Ruthless Alpha"', ip:'192.168.1.42', time:'Jun 17, 2026 10:24 AM' },
    { user:'System', av:'https://i.pravatar.cc/100?img=3', action:'Processed payout batch', type:'create', detail:'Monthly payout of $12,840 disbursed to 24 authors', ip:'\u2014', time:'Jun 17, 2026 09:00 AM' },
    { user:'Daniel Carter', av:'https://i.pravatar.cc/100?img=12', action:'Updated book status: Published', type:'update', detail:'"He Deleted Our Photos" status changed to Published', ip:'10.0.0.15', time:'Jun 16, 2026 04:15 PM' },
    { user:'Sophia Bennett', av:'https://i.pravatar.cc/100?img=29', action:'Verified author: Sofia Lindqvist', type:'create', detail:'Author verification approved - Sofia Lindqvist', ip:'10.0.0.22', time:'Jun 16, 2026 02:30 PM' },
    { user:'Reina Morgan', av:'https://i.pravatar.cc/100?img=47', action:'Created announcement', type:'create', detail:'New announcement: "Introducing Book Analytics"', ip:'192.168.1.42', time:'Jun 16, 2026 11:20 AM' },
    { user:'Ethan Walker', av:'https://i.pravatar.cc/100?img=53', action:'Flagged content as inappropriate', type:'update', detail:'Flagged Chapter 12 in "The Ruthless CEO"', ip:'10.0.0.8', time:'Jun 15, 2026 09:45 AM' },
    { user:'System', av:'https://i.pravatar.cc/100?img=3', action:'Automated backup completed', type:'create', detail:'Daily system backup completed successfully (2.4 GB)', ip:'\u2014', time:'Jun 15, 2026 03:00 AM' },
    { user:'Marcus Webb', av:'https://i.pravatar.cc/100?img=33', action:'Rejected author verification', type:'delete', detail:'Verification rejected for Tobias Bergman - insufficient documents', ip:'10.0.0.5', time:'Jun 14, 2026 01:10 PM' },
  ];

  /* ── AUTHOR VERIFICATION ── */
  var REQUESTS = [
    { name:'Daniel Reyes', email:'daniel.reyes@mail.com', avatar:'https://i.pravatar.cc/100?img=51', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jul 4, 2026', reviewer:null, status:'pending' },
    { name:'Julien Moreau', email:'julien.moreau@mail.com', avatar:'https://i.pravatar.cc/100?img=15', doc:'Passport', docIcon:'fa-passport', submitted:'Jul 3, 2026', reviewer:null, status:'pending' },
    { name:'Kenji Watanabe', email:'kenji.watanabe@mail.com', avatar:'https://i.pravatar.cc/100?img=13', doc:'Driver\'s License', docIcon:'fa-id-card-clip', submitted:'Jul 3, 2026', reviewer:null, status:'pending' },
    { name:'Nadia Petrov', email:'nadia.petrov@mail.com', avatar:'https://i.pravatar.cc/100?img=24', doc:'Passport', docIcon:'fa-passport', submitted:'Jul 2, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'pending' },
    { name:'Owen Fitzgerald', email:'owen.fitzgerald@mail.com', avatar:'https://i.pravatar.cc/100?img=6', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jul 1, 2026', reviewer:{name:'Marcus Webb', avatar:'https://i.pravatar.cc/100?img=33'}, status:'pending' },
    { name:'Sofia Lindqvist', email:'sofia.lindqvist@mail.com', avatar:'https://i.pravatar.cc/100?img=32', doc:'Passport', docIcon:'fa-passport', submitted:'Jun 29, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'approved' },
    { name:'Amara Okafor', email:'amara.okafor@mail.com', avatar:'https://i.pravatar.cc/100?img=45', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jun 28, 2026', reviewer:{name:'Marcus Webb', avatar:'https://i.pravatar.cc/100?img=33'}, status:'approved' },
    { name:'Isabella Rossi', email:'isabella.rossi@mail.com', avatar:'https://i.pravatar.cc/100?img=38', doc:'Driver\'s License', docIcon:'fa-id-card-clip', submitted:'Jun 27, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'approved' },
    { name:'Layla Haddad', email:'layla.haddad@mail.com', avatar:'https://i.pravatar.cc/100?img=48', doc:'Passport', docIcon:'fa-passport', submitted:'Jun 25, 2026', reviewer:{name:'Marcus Webb', avatar:'https://i.pravatar.cc/100?img=33'}, status:'approved' },
    { name:'Priya Nair', email:'priya.nair@mail.com', avatar:'https://i.pravatar.cc/100?img=27', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jun 24, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'approved' },
    { name:'Tobias Bergman', email:'tobias.bergman@mail.com', avatar:'https://i.pravatar.cc/100?img=8', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jun 20, 2026', reviewer:{name:'Marcus Webb', avatar:'https://i.pravatar.cc/100?img=33'}, status:'rejected' },
    { name:'Grace Wallace', email:'grace.wallace@mail.com', avatar:'https://i.pravatar.cc/100?img=44', doc:'Passport', docIcon:'fa-passport', submitted:'Jun 18, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'rejected' },
  ];

  var RECENT_REVIEWS = [
    { name:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', meta:'Approved \u00b7 Jun 29', status:'approved' },
    { name:'Amara Okafor', avatar:'https://i.pravatar.cc/100?img=45', meta:'Approved \u00b7 Jun 28', status:'approved' },
    { name:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', meta:'Approved \u00b7 Jun 27', status:'approved' },
    { name:'Layla Haddad', avatar:'https://i.pravatar.cc/100?img=48', meta:'Approved \u00b7 Jun 25', status:'approved' },
    { name:'Tobias Bergman', avatar:'https://i.pravatar.cc/100?img=8', meta:'Rejected \u00b7 Jun 20', status:'rejected' },
    { name:'Grace Wallace', avatar:'https://i.pravatar.cc/100?img=44', meta:'Rejected \u00b7 Jun 18', status:'rejected' },
  ];

  /* ── CATEGORIES & GENRES ── */
  var CATEGORIES = [
    { name:'Romance', icon:'fa-heart', bg:'#ffe1eb', color:'#ff0050', desc:'Stories about love, relationships, and emotional connections.', genres:17, books:'5,284', status:'active' },
    { name:'Billionaire', icon:'fa-crown', bg:'#ece3fd', color:'#7c5cfc', desc:'Billionaire and rich man romance stories filled with drama and passion.', genres:8, books:'2,156', status:'active' },
    { name:'Werewolf', icon:'fa-paw', bg:'#eef0f2', color:'#5b6470', desc:'Werewolf, alpha, mate and pack stories.', genres:10, books:'1,896', status:'active' },
    { name:'Vampire', icon:'fa-droplet', bg:'#fde3e3', color:'#e0384d', desc:'Vampire, bloodline, and immortal romance stories.', genres:7, books:'1,234', status:'active' },
    { name:'Fantasy', icon:'fa-wand-magic-sparkles', bg:'#ece3fd', color:'#7c5cfc', desc:'Magic, kingdoms, mythical creatures and epic adventures.', genres:11, books:'2,045', status:'active' },
    { name:'Mafia', icon:'fa-gun', bg:'#e7e7ea', color:'#26262b', desc:'Mafia, crime families, power and dangerous love.', genres:6, books:'1,102', status:'active' },
    { name:'Urban', icon:'fa-building', bg:'#e3ecfd', color:'#2f7de1', desc:'Modern life, city drama, and contemporary stories.', genres:7, books:'1,567', status:'active' },
    { name:'Marriage', icon:'fa-ring', bg:'#fef3d8', color:'#d97706', desc:'Marriage of convenience, arranged marriage and unions.', genres:6, books:'876', status:'active' },
    { name:'Revenge', icon:'fa-fire', bg:'#fde3e3', color:'#e0384d', desc:'Betrayal, comeuppance and long-awaited reckonings.', genres:5, books:'742', status:'active' },
    { name:'Second Chance', icon:'fa-rotate-left', bg:'#ffe1eb', color:'#ff0050', desc:'Reunited lovers and rekindled relationships.', genres:4, books:'689', status:'inactive' },
  ];

  var GENRES = [
    { name:'CEO Romance', cat:'Billionaire', icon:'fa-briefcase', bg:'#e3ecfd', color:'#2f7de1', books:'1,245', status:'active' },
    { name:'Alpha Romance', cat:'Werewolf', icon:'fa-paw', bg:'#eef0f2', color:'#5b6470', books:'987', status:'active' },
    { name:'Secret Baby', cat:'Romance', icon:'fa-shield', bg:'#fef3d8', color:'#d97706', books:'876', status:'active' },
    { name:'Enemies to Lovers', cat:'Romance', icon:'fa-heart-crack', bg:'#fde3e3', color:'#e0384d', books:'754', status:'active' },
    { name:'Second Chance', cat:'Romance', icon:'fa-rotate-left', bg:'#ffe1eb', color:'#ff0050', books:'689', status:'active' },
    { name:'Royal Romance', cat:'Fantasy', icon:'fa-crown', bg:'#ece3fd', color:'#7c5cfc', books:'612', status:'active' },
    { name:'Mafia Romance', cat:'Mafia', icon:'fa-gun', bg:'#e7e7ea', color:'#26262b', books:'588', status:'active' },
    { name:'Vampire Romance', cat:'Vampire', icon:'fa-droplet', bg:'#fde3e3', color:'#e0384d', books:'503', status:'active' },
    { name:'Arranged Marriage', cat:'Marriage', icon:'fa-ring', bg:'#fef3d8', color:'#d97706', books:'411', status:'active' },
    { name:'Forbidden Love', cat:'Romance', icon:'fa-ban', bg:'#ffe1eb', color:'#ff0050', books:'298', status:'inactive' },
  ];

  var POPULAR_GENRES = [
    { name:'CEO Romance', icon:'fa-briefcase', bg:'#e3ecfd', color:'#2f7de1', books:'1,245 books' },
    { name:'Alpha Romance', icon:'fa-paw', bg:'#eef0f2', color:'#5b6470', books:'987 books' },
    { name:'Secret Baby', icon:'fa-shield', bg:'#fef3d8', color:'#d97706', books:'876 books' },
    { name:'Enemies to Lovers', icon:'fa-heart-crack', bg:'#fde3e3', color:'#e0384d', books:'754 books' },
    { name:'Second Chance', icon:'fa-rotate-left', bg:'#ffe1eb', color:'#ff0050', books:'689 books' },
    { name:'Royal Romance', icon:'fa-crown', bg:'#ece3fd', color:'#7c5cfc', books:'612 books' },
  ];

  /* ── ANNOUNCEMENTS ── */
  var ANNOUNCEMENT_TYPE_META = {
    update:   { label: 'Update',   icon: 'fa-rocket',        tile: 'linear-gradient(135deg,#2d2154,#5b4bcf)' },
    event:    { label: 'Event',    icon: 'fa-trophy',        tile: 'linear-gradient(135deg,#b8860b,#f2a900)' },
    system:   { label: 'System',   icon: 'fa-gear',          tile: 'linear-gradient(135deg,#1f3a63,#2f7de1)' },
    policy:   { label: 'Policy',   icon: 'fa-file-lines',    tile: 'linear-gradient(135deg,#3c8f6f,#16a34a)' },
    program:  { label: 'Program',  icon: 'fa-star',          tile: 'linear-gradient(135deg,#c2185b,#ff0050)' },
    news:     { label: 'News',     icon: 'fa-chart-line',    tile: 'linear-gradient(135deg,#0f766e,#14b8a6)' },
    security: { label: 'Security', icon: 'fa-shield-halved', tile: 'linear-gradient(135deg,#3a3a45,#5c5c6b)' },
  };

  var ANNOUNCEMENTS = [
    { id:'ANN-2026-0132', title:'Introducing Book Analytics', desc:'Explore detailed analytics for your books and track your performance.', type:'update', status:'published', audience:'All Authors', date:'Jun 17, 2026', time:'10:24 AM', views:'8,420' },
    { id:'ANN-2026-0131', title:'Payment System Update', desc:'We have improved payout speed and added new payment options.', type:'update', status:'published', audience:'All Authors', date:'Jun 15, 2026', time:'09:15 AM', views:'6,120' },
    { id:'ANN-2026-0130', title:'Summer Writing Contest 2026', desc:'Join our annual writing contest and win exciting rewards.', type:'event', status:'published', audience:'All Authors', date:'Jun 10, 2026', time:'11:00 AM', views:'12,850' },
    { id:'ANN-2026-0129', title:'Scheduled Maintenance', desc:'The platform will be under maintenance for system improvements.', type:'system', status:'scheduled', audience:'All Authors', date:'Jun 20, 2026', time:'02:00 AM', views:'\u2014' },
    { id:'ANN-2026-0128', title:'Content Guidelines Update', desc:'Please review our updated content guidelines and policies.', type:'policy', status:'draft', audience:'All Authors', date:'\u2014', time:'', views:'\u2014' },
    { id:'ANN-2026-0127', title:'Author Spotlight Program', desc:'Nominate your favorite authors for our monthly spotlight!', type:'program', status:'scheduled', audience:'All Authors', date:'Jun 25, 2026', time:'10:00 AM', views:'\u2014' },
    { id:'ANN-2026-0126', title:'We Reached 100K Books!', desc:'Thank you for being part of this amazing journey.', type:'news', status:'published', audience:'All Authors', date:'Jun 5, 2026', time:'04:30 PM', views:'9,430' },
    { id:'ANN-2026-0125', title:'Security Best Practices', desc:'Tips to keep your account and content safe.', type:'security', status:'draft', audience:'All Authors', date:'\u2014', time:'', views:'\u2014' },
  ];

  var OVERVIEW_BREAKDOWN = [
    { label:'Updates',  value:12, pct:37.5, color:'#5b4bcf' },
    { label:'Events',   value:6,  pct:18.8, color:'var(--amber)' },
    { label:'System',   value:5,  pct:15.6, color:'var(--blue)' },
    { label:'Policies', value:4,  pct:12.5, color:'var(--text-faint)' },
    { label:'Programs', value:3,  pct:9.4,  color:'#ff0050' },
    { label:'News',     value:2,  pct:6.2,  color:'var(--green)' },
  ];

  var ANNOUNCE_QUICK_ACTIONS = [
    { label:'Create Announcement',    icon:'fa-plus',     cls:'purple' },
    { label:'Manage Categories',      icon:'fa-tags',      cls:'pink' },
    { label:'Announcement Templates', icon:'fa-file-lines',cls:'blue' },
    { label:'Notification Settings',  icon:'fa-bell',      cls:'amber' },
  ];

  var ANNOUNCE_RECENT = [
    { title:'Introducing Book Analytics', status:'published', date:'Jun 17, 2026' },
    { title:'Payment System Update',       status:'published', date:'Jun 15, 2026' },
    { title:'Summer Writing Contest 2026', status:'published', date:'Jun 10, 2026' },
    { title:'Scheduled Maintenance',       status:'scheduled', date:'Jun 20, 2026' },
  ];

  /* ── AUTHORS ── */
  var AUTHORS = [
    { name:'Sofia Lindqvist', email:'sofia.lindqvist@mail.com', avatar:'https://i.pravatar.cc/100?img=32', books:24, followers:'48.2K', earnings:'$18,420', joined:'Jan 2023', status:'verified' },
    { name:'Marcus Chen', email:'marcus.chen@mail.com', avatar:'https://i.pravatar.cc/100?img=12', books:16, followers:'31.7K', earnings:'$12,890', joined:'Mar 2023', status:'verified' },
    { name:'Amara Okafor', email:'amara.okafor@mail.com', avatar:'https://i.pravatar.cc/100?img=45', books:31, followers:'62.5K', earnings:'$24,110', joined:'Aug 2022', status:'verified' },
    { name:'Daniel Reyes', email:'daniel.reyes@mail.com', avatar:'https://i.pravatar.cc/100?img=51', books:9, followers:'12.3K', earnings:'$4,560', joined:'Nov 2023', status:'pending' },
    { name:'Priya Nair', email:'priya.nair@mail.com', avatar:'https://i.pravatar.cc/100?img=27', books:19, followers:'27.9K', earnings:'$9,340', joined:'Jun 2023', status:'verified' },
    { name:'Julien Moreau', email:'julien.moreau@mail.com', avatar:'https://i.pravatar.cc/100?img=15', books:5, followers:'6.1K', earnings:'$1,980', joined:'Feb 2024', status:'pending' },
    { name:'Isabella Rossi', email:'isabella.rossi@mail.com', avatar:'https://i.pravatar.cc/100?img=38', books:27, followers:'55.6K', earnings:'$21,050', joined:'Sep 2022', status:'verified' },
    { name:'Tobias Bergman', email:'tobias.bergman@mail.com', avatar:'https://i.pravatar.cc/100?img=8', books:3, followers:'2.4K', earnings:'$640', joined:'Apr 2024', status:'suspended' },
    { name:'Layla Haddad', email:'layla.haddad@mail.com', avatar:'https://i.pravatar.cc/100?img=48', books:22, followers:'40.3K', earnings:'$15,780', joined:'Dec 2022', status:'verified' },
    { name:'Kenji Watanabe', email:'kenji.watanabe@mail.com', avatar:'https://i.pravatar.cc/100?img=13', books:11, followers:'18.8K', earnings:'$6,920', joined:'Jul 2023', status:'pending' },
  ];

  var TOP_AUTHORS = [
    { name:'Amara Okafor', avatar:'https://i.pravatar.cc/100?img=45', books:'31 books', verified:true },
    { name:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', books:'27 books', verified:true },
    { name:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', books:'24 books', verified:true },
    { name:'Layla Haddad', avatar:'https://i.pravatar.cc/100?img=48', books:'22 books', verified:true },
    { name:'Priya Nair', avatar:'https://i.pravatar.cc/100?img=27', books:'19 books', verified:true },
    { name:'Marcus Chen', avatar:'https://i.pravatar.cc/100?img=12', books:'16 books', verified:true },
  ];

  /* ── AUTHOR MESSAGES ── */
  var CONVERSATIONS = [
    { id:1, name:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', role:'Verified Author', unread:2, flagged:false, time:'10m ago',
      messages:[
        { from:'author', text:'Hi, I wanted to check in about my contract - it is set to expire next month.', time:'2 days ago' },
        { from:'admin', text:'Hi Sofia! Thanks for reaching out. Let me check with the contracts team and get back to you.', time:'2 days ago' },
        { from:'author', text:'Great, thank you! Also wondering if there is flexibility on the royalty percentage for the renewal.', time:'1 day ago' },
        { from:'author', text:'Can we discuss extending my contract renewal deadline? I need a bit more time to review the new terms.', time:'10m ago' },
      ] },
    { id:2, name:'Marcus Chen', avatar:'https://i.pravatar.cc/100?img=12', role:'Verified Author', unread:0, flagged:false, time:'1h ago',
      messages:[
        { from:'author', text:'Just submitted the revised chapter 12 - fixed the pacing issue you flagged.', time:'3h ago' },
        { from:'admin', text:'Reviewed it, looks great. Approved and scheduled for publishing.', time:'2h ago' },
        { from:'author', text:'Thanks for approving my chapter revision!', time:'1h ago' },
      ] },
    { id:3, name:'Amara Okafor', avatar:'https://i.pravatar.cc/100?img=45', role:'Verified Author', unread:1, flagged:true, time:'3h ago',
      messages:[
        { from:'author', text:'My earnings dashboard is showing the wrong total again for the second month in a row.', time:'1 day ago' },
        { from:'admin', text:'Sorry about that, Amara. Escalating to the finance team right now.', time:'22h ago' },
        { from:'author', text:'This is the third time my earnings report is wrong. I need this resolved this week.', time:'3h ago' },
      ] },
    { id:4, name:'Daniel Reyes', avatar:'https://i.pravatar.cc/100?img=51', role:'Pending Author', unread:0, flagged:false, time:'1d ago',
      messages:[
        { from:'author', text:'Hi, just following up on my verification status - submitted docs 2 weeks ago.', time:'1d ago' },
        { from:'admin', text:'Hi Daniel, your documents are under final review. Should be resolved by Friday.', time:'20h ago' },
      ] },
    { id:5, name:'Priya Nair', avatar:'https://i.pravatar.cc/100?img=27', role:'Verified Author', unread:3, flagged:false, time:'2d ago',
      messages:[
        { from:'author', text:'Read through the new royalty structure doc - a couple of questions on tiered rates.', time:'2d ago' },
        { from:'author', text:'Specifically, does the 70% tier apply retroactively to existing contracts?', time:'2d ago' },
        { from:'author', text:'Also, when does the new structure take effect exactly?', time:'2d ago' },
      ] },
    { id:6, name:'Julien Moreau', avatar:'https://i.pravatar.cc/100?img=15', role:'Pending Author', unread:0, flagged:false, time:'3d ago',
      messages:[
        { from:'author', text:'Uploaded my new manuscript, please review when you get a chance.', time:'3d ago' },
        { from:'admin', text:'Got it, added to the review queue - we will get back within 3-5 business days.', time:'3d ago' },
      ] },
    { id:7, name:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', role:'Verified Author', unread:0, flagged:false, time:'4d ago',
      messages:[
        { from:'admin', text:'Congrats Isabella - your book was selected for this month\'s featured banner!', time:'4d ago' },
        { from:'author', text:'Thank you so much for featuring my book! Really appreciate the support.', time:'4d ago' },
      ] },
    { id:8, name:'Tobias Bergman', avatar:'https://i.pravatar.cc/100?img=8', role:'Suspended Author', unread:1, flagged:true, time:'5d ago',
      messages:[
        { from:'admin', text:'Your account has been suspended due to repeated content policy violations.', time:'6d ago' },
        { from:'author', text:'I want to appeal my suspension. I believe this was a misunderstanding.', time:'5d ago' },
      ] },
  ];

  /* ── WITHDRAWAL REQUESTS ── */
  var WITHDRAWALS = [
    { id:'WD-0047', author:'Amara Okafor', avatar:'https://i.pravatar.cc/100?img=45', amount:'$2,450.00', method:'Bank Transfer', status:'pending', requested:'Jun 17, 2026', processed:'\u2014' },
    { id:'WD-0046', author:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', amount:'$1,820.00', method:'PayPal', status:'processing', requested:'Jun 16, 2026', processed:'Jun 17, 2026' },
    { id:'WD-0045', author:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', amount:'$3,100.00', method:'Mobile Money', status:'completed', requested:'Jun 14, 2026', processed:'Jun 16, 2026' },
    { id:'WD-0044', author:'Marcus Chen', avatar:'https://i.pravatar.cc/100?img=12', amount:'$980.00', method:'Bank Transfer', status:'pending', requested:'Jun 13, 2026', processed:'\u2014' },
    { id:'WD-0043', author:'Priya Nair', avatar:'https://i.pravatar.cc/100?img=27', amount:'$1,560.00', method:'PayPal', status:'completed', requested:'Jun 12, 2026', processed:'Jun 14, 2026' },
    { id:'WD-0042', author:'Layla Haddad', avatar:'https://i.pravatar.cc/100?img=48', amount:'$2,890.00', method:'Bank Transfer', status:'processing', requested:'Jun 11, 2026', processed:'Jun 13, 2026' },
    { id:'WD-0041', author:'Daniel Reyes', avatar:'https://i.pravatar.cc/100?img=51', amount:'$450.00', method:'Mobile Money', status:'pending', requested:'Jun 10, 2026', processed:'\u2014' },
    { id:'WD-0040', author:'Julien Moreau', avatar:'https://i.pravatar.cc/100?img=15', amount:'$320.00', method:'PayPal', status:'rejected', requested:'Jun 9, 2026', processed:'Jun 11, 2026' },
  ];

  /* ── TRANSACTION HISTORY ── */
  var TXNS = [
    { id:'TXN-2450', desc:'Book Sale - The Ruthless CEO', type:'revenue', amount:'+$12.99', usr:'Reader_2345', date:'Jun 17, 2026 10:24AM', cls:'credit' },
    { id:'TXN-2449', desc:'Author Payout - Amara Okafor', type:'payout', amount:'-$2,450.00', usr:'Amara Okafor', date:'Jun 17, 2026 09:15AM', cls:'debit' },
    { id:'TXN-2448', desc:'Refund - Wrong Charge', type:'refund', amount:'-$9.99', usr:'Reader_8901', date:'Jun 16, 2026 04:30PM', cls:'debit' },
    { id:'TXN-2447', desc:'Book Sale - Bound by the Alpha', type:'revenue', amount:'+$8.99', usr:'Reader_5678', date:'Jun 16, 2026 02:10PM', cls:'credit' },
    { id:'TXN-2446', desc:'Processing Fee - Payout Batch', type:'fee', amount:'-$15.00', usr:'System', date:'Jun 16, 2026 11:00AM', cls:'debit' },
    { id:'TXN-2445', desc:'Royalty Adjustment - Isabella Rossi', type:'adjustment', amount:'+$120.00', usr:'Isabella Rossi', date:'Jun 15, 2026 03:45PM', cls:'credit' },
    { id:'TXN-2444', desc:'Book Sale - His Hidden Luna', type:'revenue', amount:'+$6.99', usr:'Reader_1234', date:'Jun 15, 2026 01:20PM', cls:'credit' },
    { id:'TXN-2443', desc:'Author Payout - Sofia Lindqvist', type:'payout', amount:'-$1,820.00', usr:'Sofia Lindqvist', date:'Jun 15, 2026 10:00AM', cls:'debit' },
  ];

  /* ── PAYMENTS ── */
  var PAYMENTS = [
    { id:'PYMT-0156', recipient:'Amara Okafor', amount:'$3,420.00', method:'Bank Transfer', status:'completed', date:'Jun 17, 2026' },
    { id:'PYMT-0155', recipient:'Sofia Lindqvist', amount:'$2,180.00', method:'PayPal', status:'completed', date:'Jun 17, 2026' },
    { id:'PYMT-0154', recipient:'Isabella Rossi', amount:'$4,500.00', method:'Mobile Money', status:'pending', date:'Jun 16, 2026' },
    { id:'PYMT-0153', recipient:'Marcus Chen', amount:'$980.00', method:'Bank Transfer', status:'completed', date:'Jun 15, 2026' },
    { id:'PYMT-0152', recipient:'Priya Nair', amount:'$1,560.00', method:'PayPal', status:'failed', date:'Jun 14, 2026' },
    { id:'PYMT-0151', recipient:'Layla Haddad', amount:'$2,890.00', method:'Bank Transfer', status:'completed', date:'Jun 13, 2026' },
    { id:'PYMT-0150', recipient:'Daniel Reyes', amount:'$450.00', method:'Mobile Money', status:'pending', date:'Jun 12, 2026' },
    { id:'PYMT-0149', recipient:'Julien Moreau', amount:'$320.00', method:'PayPal', status:'completed', date:'Jun 11, 2026' },
  ];

  /* ── NOTIFICATION CENTER ── */
  var NOTIFS = [
    { ico:'pink', icon:'fa-file-contract', title:'Contract Signed: CNTR-2026-00125', desc:'Luna Skye has signed the Exclusive Publishing Agreement for "Bound by the Ruthless Alpha".', time:'12 minutes ago', unread:true },
    { ico:'blue', icon:'fa-star', title:'New Review Submitted', desc:'A reader left a 4.8-star review on "The Ruthless CEO" by Ava Winters.', time:'1 hour ago', unread:true },
    { ico:'amber', icon:'fa-money-bill-wave', title:'Withdrawal Request: Amara Okafor', desc:'Amara Okafor has requested a withdrawal of $2,450.00.', time:'2 hours ago', unread:true },
    { ico:'green', icon:'fa-user-plus', title:'New Author Registered', desc:'A new author "Nadia Petrov" has registered and submitted verification documents.', time:'3 hours ago', unread:true },
    { ico:'red', icon:'fa-flag', title:'Content Flagged: Inappropriate Content', desc:'Chapter 12 in "The Ruthless CEO" has been flagged by readers.', time:'5 hours ago', unread:false },
    { ico:'pink', icon:'fa-bullhorn', title:'Announcement Published', desc:'"Introducing Book Analytics" has been published to all authors.', time:'6 hours ago', unread:false },
    { ico:'blue', icon:'fa-circle-check', title:'Verification Approved', desc:'Sofia Lindqvist\'s author verification has been approved.', time:'1 day ago', unread:false },
    { ico:'amber', icon:'fa-clock', title:'Contract Expiring Soon', desc:'Contract CNTR-2026-00121 for "Claimed by the Mafia King" expires in 18 days.', time:'1 day ago', unread:false },
    { ico:'green', icon:'fa-sack-dollar', title:'Payment Processed', desc:'Monthly payout batch of $12,840 has been processed successfully.', time:'2 days ago', unread:false },
    { ico:'red', icon:'fa-shield', title:'Security Alert: Login Attempt', desc:'Unusual login attempt detected from an unknown IP address.', time:'2 days ago', unread:false },
  ];

  /* ── CONTRACTS ── */
  var CONTRACT_TYPE_META = {
    'Exclusive Publishing': { icon: 'fa-book', cls: 'purple' },
    'Revenue Share': { icon: 'fa-hand-holding-dollar', cls: 'green' },
    'License Agreement': { icon: 'fa-file-shield', cls: 'grey' },
  };

  var CONTRACTS = [
    { id:'CNTR-2026-00125', cover:'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100&q=80', title:'Bound by the Ruthless Alpha', author:'Luna Skye', type:'Exclusive Publishing', status:'active', effective:'Jun 14, 2026', expiry:'Jun 14, 2028', expirySub:'(2 years)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
    { id:'CNTR-2026-00124', cover:'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&q=80', title:'The Ruthless CEO', author:'Ava Winters', type:'Exclusive Publishing', status:'active', effective:'Jun 10, 2026', expiry:'Jun 10, 2028', expirySub:'(2 years)', editor:'Daniel Carter', editorAvatar:'https://i.pravatar.cc/100?img=12' },
    { id:'CNTR-2026-00123', cover:'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=100&q=80', title:'Reborn to Revenge', author:'Mia Carter', type:'Revenue Share', status:'pending', effective:'Jun 8, 2026', expiry:'\u2014', expirySub:'', editor:'Sophia Bennett', editorAvatar:'https://i.pravatar.cc/100?img=29' },
    { id:'CNTR-2026-00122', cover:'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=100&q=80', title:'His Hidden Luna', author:'Lyra Night', type:'Exclusive Publishing', status:'active', effective:'Jun 5, 2026', expiry:'Jun 5, 2028', expirySub:'(2 years)', editor:'Ethan Walker', editorAvatar:'https://i.pravatar.cc/100?img=53' },
    { id:'CNTR-2026-00121', cover:'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=100&q=80', title:'Claimed by the Mafia King', author:'Bella King', type:'Exclusive Publishing', status:'expiring', effective:'May 20, 2024', expiry:'May 20, 2026', expirySub:'(in 18 days)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
    { id:'CNTR-2026-00120', cover:'https://images.unsplash.com/photo-1526398006332-190020ec2fb9?w=100&q=80', title:'The Vampire\'s Obsession', author:'Ethan Vale', type:'License Agreement', status:'expired', effective:'Apr 15, 2024', expiry:'Apr 15, 2026', expirySub:'', editor:'Daniel Carter', editorAvatar:'https://i.pravatar.cc/100?img=12' },
    { id:'CNTR-2026-00119', cover:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=100&q=80', title:'Broken Vows', author:'Sophie Lane', type:'Exclusive Publishing', status:'terminated', effective:'Mar 10, 2024', expiry:'Mar 10, 2026', expirySub:'', editor:'Sophia Bennett', editorAvatar:'https://i.pravatar.cc/100?img=29' },
    { id:'CNTR-2026-00118', cover:'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80', title:'The Prince\'s Secret Wife', author:'Isabella Rose', type:'Revenue Share', status:'active', effective:'May 1, 2026', expiry:'May 1, 2028', expirySub:'(2 years)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
  ];

  var EXPIRING_SOON = [
    { cover:'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=100&q=80', title:'Claimed by the Mafia King', author:'Bella King', date:'May 20, 2026', inDays:'in 18 days' },
    { cover:'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&q=80', title:'The Ruthless CEO', author:'Ava Winters', date:'Jun 10, 2026', inDays:'in 39 days' },
    { cover:'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=100&q=80', title:'His Hidden Luna', author:'Lyra Night', date:'Jun 30, 2026', inDays:'in 59 days' },
    { cover:'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100&q=80', title:'Bound by the Ruthless Alpha', author:'Luna Skye', date:'Jul 14, 2026', inDays:'in 73 days' },
  ];

  var STATS_BREAKDOWN = [
    { label:'Active', value:198, pct:80.8, color:'var(--green)' },
    { label:'Pending', value:17, pct:6.9, color:'var(--amber)' },
    { label:'Expiring Soon', value:12, pct:4.9, color:'var(--red)' },
    { label:'Expired', value:18, pct:7.4, color:'var(--text-faint)' },
    { label:'Terminated', value:0, pct:0, color:'#8a86a8' },
  ];

  var CONTRACT_TYPES = [
    { label:'Exclusive Publishing', value:156, pct:63.7, icon:'fa-book', cls:'purple', color:'#5b4bcf' },
    { label:'Revenue Share', value:48, pct:19.6, icon:'fa-hand-holding-dollar', cls:'green', color:'var(--green)' },
    { label:'License Agreement', value:25, pct:10.2, icon:'fa-file-shield', cls:'grey', color:'var(--text-faint)' },
    { label:'Translation Rights', value:10, pct:4.1, icon:'fa-globe', cls:'red', color:'var(--red)' },
    { label:'Other Agreements', value:6, pct:2.4, icon:'fa-ellipsis', cls:'amber', color:'var(--amber)' },
  ];

  /* ── EARNINGS OVERVIEW ── */
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun'];
  var AUTHOR_DATA = [45600,38900,32400,35600,41200,48300];
  var PLATFORM_DATA = [28400,25600,23800,26400,29100,30800];
  var AD_DATA = [12600,11800,10900,11400,12100,11500];

  var TOP_EARNERS = [
    { name:'Amara Okafor', avatar:'https://i.pravatar.cc/100?img=45', book:'The Ruthless CEO', earn:'$24,110', pct:'+22%' },
    { name:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', book:'His Hidden Luna', earn:'$21,050', pct:'+18%' },
    { name:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', book:'Bound by the Alpha', earn:'$18,420', pct:'+15%' },
    { name:'Layla Haddad', avatar:'https://i.pravatar.cc/100?img=48', book:'Broken Vows', earn:'$15,780', pct:'+12%' },
  ];

  /* ── CONTRACT TEMPLATES ── */
  var TEMPLATES = [
    { id:1, name:'Non-Exclusive Publishing Agreement', desc:'Standard agreement for non-exclusive publishing rights.', type:'Publishing', icon:'fa-file-lines', bg:'#ece3fd', color:'#7c5cfc', status:'active', updated:'Jun 15, 2026', by:'Reina Morgan', clauses:12 },
    { id:2, name:'Exclusive Publishing Agreement', desc:'Exclusive rights agreement for publishing and distribution.', type:'Publishing', icon:'fa-file-circle-check', bg:'#e2f8ea', color:'#16a34a', status:'active', updated:'Jun 10, 2026', by:'Reina Morgan', clauses:14 },
    { id:3, name:'Revenue Share Agreement', desc:'Agreement for revenue sharing with authors.', type:'Financial', icon:'fa-sack-dollar', bg:'#e2f8ea', color:'#16a34a', status:'active', updated:'Jun 8, 2026', by:'Reina Morgan', clauses:9 },
    { id:4, name:'Author Assignment Agreement', desc:'Transfer of certain rights by the author to the platform.', type:'Legal', icon:'fa-user-pen', bg:'#e3ecfd', color:'#2f7de1', status:'active', updated:'Jun 5, 2026', by:'Reina Morgan', clauses:8 },
    { id:5, name:'Confidentiality Agreement (NDA)', desc:'Non-disclosure agreement for confidential information.', type:'Legal', icon:'fa-lock', bg:'#fde3e3', color:'#e0384d', status:'draft', updated:'Jun 2, 2026', by:'Reina Morgan', clauses:6 },
    { id:6, name:'Translation Rights Agreement', desc:'Agreement for translation and foreign language rights.', type:'Rights', icon:'fa-globe', bg:'#e2f8ea', color:'#16a34a', status:'active', updated:'May 28, 2026', by:'Reina Morgan', clauses:10 },
    { id:7, name:'Short Story Publishing Agreement', desc:'Agreement template for short story publications.', type:'Publishing', icon:'fa-book', bg:'#e2f8ea', color:'#16a34a', status:'active', updated:'May 25, 2026', by:'Reina Morgan', clauses:7 },
    { id:8, name:'Audiobook Rights Agreement', desc:'Agreement for audiobook production and distribution.', type:'Rights', icon:'fa-headphones', bg:'#fef3d8', color:'#d97706', status:'draft', updated:'May 20, 2026', by:'Reina Morgan', clauses:11 },
    { id:9, name:'Old Standard Agreement', desc:'Previous version of standard publishing agreement.', type:'Publishing', icon:'fa-file', bg:'#eef0f2', color:'#5b6470', status:'archived', updated:'May 15, 2026', by:'Reina Morgan', clauses:9 },
    { id:10, name:'Film & Adaptation Rights Agreement', desc:'Agreement for film, TV, and other adaptations.', type:'Rights', icon:'fa-film', bg:'#fde3e3', color:'#e0384d', status:'active', updated:'May 10, 2026', by:'Reina Morgan', clauses:13 },
    { id:11, name:'Merchandising Rights Agreement', desc:'Agreement covering merchandising and licensing rights.', type:'Rights', icon:'fa-tags', bg:'#ece3fd', color:'#7c5cfc', status:'active', updated:'May 6, 2026', by:'Reina Morgan', clauses:8 },
    { id:12, name:'Co-Authorship Agreement', desc:'Agreement between two or more co-authors of a work.', type:'Legal', icon:'fa-user-group', bg:'#e3ecfd', color:'#2f7de1', status:'active', updated:'May 2, 2026', by:'Reina Morgan', clauses:10 },
  ];

  var TEMPLATE_HISTORY = [
    { icon:'fa-pen', label:'Edited by Reina Morgan', date:'Jun 15, 2026' },
    { icon:'fa-check', label:'Marked as Active', date:'Jun 15, 2026' },
    { icon:'fa-copy', label:'Duplicated from v1.2', date:'Feb 3, 2026' },
    { icon:'fa-plus', label:'Template created', date:'Jan 18, 2026' },
  ];

  /* ── REPORTS & FLAGS ── */
  var FLAGS = [
    { id:'FLG-0047', title:'Inappropriate Content in "The Ruthless CEO"', desc:'Chapter 12 contains explicit content not marked as mature.', type:'content', reporter:'Reader_2345', status:'pending', date:'Jun 17, 2026', ico:'fa-flag', bg:'#fde3e3', clr:'var(--red)' },
    { id:'FLG-0046', title:'Spam Comments on "Bound by the Alpha"', desc:'Multiple spam comments promoting external websites.', type:'spam', reporter:'ModBot', status:'pending', date:'Jun 16, 2026', ico:'fa-bug', bg:'#fde3e3', clr:'var(--red)' },
    { id:'FLG-0045', title:'Plagiarism: "His Hidden Luna"', desc:'Sections of this story appear to be copied from another work.', type:'plagiarism', reporter:'Author_789', status:'resolved', date:'Jun 15, 2026', ico:'fa-copy', bg:'#e3ecfd', clr:'var(--blue)' },
    { id:'FLG-0044', title:'Harassment in Comments', desc:'User making offensive remarks towards the author.', type:'abuse', reporter:'LunaSkye', status:'pending', date:'Jun 14, 2026', ico:'fa-hand', bg:'#ece9fb', clr:'#5b4bcf' },
    { id:'FLG-0043', title:'Fake Account Reporting', desc:'Account suspected of impersonating a verified author.', type:'other', reporter:'Admin_Team', status:'resolved', date:'Jun 13, 2026', ico:'fa-user-slash', bg:'#eef0f2', clr:'#5b6470' },
    { id:'FLG-0042', title:'Explicit Cover Image', desc:'Book cover contains nudity that violates guidelines.', type:'content', reporter:'Reader_8901', status:'dismissed', date:'Jun 12, 2026', ico:'fa-image', bg:'#fde3e3', clr:'var(--red)' },
    { id:'FLG-0041', title:'Copyright Infringement', desc:'Author claims their work was republished without permission.', type:'plagiarism', reporter:'MiaCarter', status:'pending', date:'Jun 11, 2026', ico:'fa-copyright', bg:'#e3ecfd', clr:'var(--blue)' },
    { id:'FLG-0040', title:'Spam Promo in Bio', desc:'Author bio contains links to competitor platform.', type:'spam', reporter:'ModBot', status:'resolved', date:'Jun 10, 2026', ico:'fa-bug', bg:'#fde3e3', clr:'var(--red)' },
  ];

  var FLAG_TYPE_META = { content:{label:'Content',cls:'content'}, spam:{label:'Spam',cls:'spam'}, plagiarism:{label:'Plagiarism',cls:'plagiarism'}, abuse:{label:'Abuse',cls:'abuse'}, other:{label:'Other',cls:'other'} };

  /* ── PROMOTIONS ── */
  var PROMO_TYPE_META = {
    discount: { label: 'Discount Code',  icon: 'fa-percent',           tile: 'linear-gradient(135deg,#2d2154,#5b4bcf)' },
    bundle:   { label: 'Bundle Deal',    icon: 'fa-boxes-stacked',     tile: 'linear-gradient(135deg,#1f3a63,#2f7de1)' },
    flash:    { label: 'Flash Sale',     icon: 'fa-bolt',              tile: 'linear-gradient(135deg,#7a1f2b,#e0384d)' },
    referral: { label: 'Referral Bonus', icon: 'fa-user-plus',         tile: 'linear-gradient(135deg,#0f5132,#16a34a)' },
    trial:    { label: 'Free Trial',     icon: 'fa-hourglass-start',   tile: 'linear-gradient(135deg,#c2185b,#ff0050)' },
  };

  var PROMOTIONS = [
    { id:'PROMO-2026-028', title:'Summer Reading Sale',   code:'SUMMER25',  desc:'Site-wide seasonal discount on all book bundles.', type:'discount', discount:'25% OFF',            status:'active',    used:1240, cap:5000,  start:'Jun 1, 2026',  end:'Jun 30, 2026' },
    { id:'PROMO-2026-027', title:'New Author Bundle',     code:'AUTHOR2X',  desc:'Buy any 2 books from a new author, get 1 free.',   type:'bundle',   discount:'Buy 2 Get 1',        status:'active',    used:380,  cap:1000,  start:'Jun 10, 2026', end:'Jul 10, 2026' },
    { id:'PROMO-2026-026', title:'Flash Friday',          code:'FLASH40',   desc:'One-day flash sale across the whole catalog.',     type:'flash',    discount:'40% OFF',            status:'scheduled', used:0,    cap:2000,  start:'Jul 11, 2026', end:'Jul 12, 2026' },
    { id:'PROMO-2026-025', title:'Refer a Friend',        code:'REFER500',  desc:'Give N500, get N500 when a referral signs up.',    type:'referral', discount:'N500 Credit',        status:'active',    used:892,  cap:null,  start:'Jan 1, 2026',  end:'Dec 31, 2026' },
    { id:'PROMO-2026-024', title:'7-Day Free Trial',      code:'TRY7FREE',  desc:'Full platform access free for the first week.',    type:'trial',    discount:'Free Access',        status:'active',    used:3120, cap:null,  start:'May 1, 2026',  end:'Ongoing' },
    { id:'PROMO-2026-023', title:'Spring Clearance',      code:'SPRING30',  desc:'End-of-season clearance on selected titles.',      type:'discount', discount:'30% OFF',            status:'expired',   used:2450, cap:2500,  start:'Mar 1, 2026',  end:'Mar 31, 2026' },
    { id:'PROMO-2026-022', title:'Loyalty Rewards',       code:'LOYAL15',   desc:'Discount for readers with 10+ purchases.',         type:'bundle',   discount:'15% OFF',            status:'draft',     used:0,    cap:null,  start:'\u2014',       end:'\u2014' },
    { id:'PROMO-2026-021', title:'Independence Day Sale', code:'INDEP50',   desc:'National holiday storewide discount event.',       type:'flash',    discount:'50% OFF',            status:'scheduled', used:0,    cap:3000,  start:'Oct 1, 2026',  end:'Oct 1, 2026' },
  ];

  var MIX_BREAKDOWN = [
    { label:'Discount Code',  value:9, pct:32.1, color:'#5b4bcf' },
    { label:'Bundle Deal',    value:7, pct:25.0, color:'var(--blue)' },
    { label:'Flash Sale',     value:5, pct:17.9, color:'var(--red)' },
    { label:'Free Trial',     value:4, pct:14.3, color:'#ff0050' },
    { label:'Referral Bonus', value:3, pct:10.7, color:'var(--green)' },
  ];

  var TOP_PROMOS = [
    { title:'7-Day Free Trial',    sub:'Free Trial \u00b7 Ongoing', val:'3,120 uses' },
    { title:'Spring Clearance',    sub:'Discount Code \u00b7 Ended', val:'2,450 uses' },
    { title:'Summer Reading Sale', sub:'Discount Code \u00b7 Active', val:'1,240 uses' },
  ];

  var PROMO_QUICK_ACTIONS = [
    { label:'Create Promotion',       icon:'fa-plus',       cls:'purple' },
    { label:'Manage Discount Codes',  icon:'fa-percent',    cls:'pink' },
    { label:'Promotion Templates',    icon:'fa-file-lines', cls:'blue' },
    { label:'Notification Settings',  icon:'fa-bell',       cls:'amber' },
  ];

  /* ── BOOKS (for book management) ── */
  var BOOKS = [
    { id:'BK001256', title:'The Ruthless CEO', author:'Ava Winters', avatar:'https://i.pravatar.cc/100?img=45', cat:'Romance', genre:'Billionaire Romance', status:'Published', views:'1.2M', added:'Jun 15, 2026', img:'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', desc:'Driven by power, torn by desire. A billionaire romance like no other.' },
    { id:'BK001255', title:'Bound by the Ruthless Alpha', author:'Luna Skye', avatar:'https://i.pravatar.cc/100?img=32', cat:'Romance', genre:'Werewolf Romance', status:'Published', views:'946K', added:'Jun 14, 2026', img:'https://i.postimg.cc/vDn9YLx5/wife2.jpg', desc:'She was meant to be his enemy, but fate had other plans.' },
    { id:'BK001254', title:'His Hidden Luna', author:'Lyra Night', avatar:'https://i.pravatar.cc/100?img=25', cat:'Romance', genre:'Werewolf Romance', status:'Published', views:'832K', added:'Jun 13, 2026', img:'https://i.postimg.cc/fkdXzjSj/wife.jpg', desc:'A secret identity that could destroy the pack or unite it.' },
    { id:'BK001253', title:'Reborn to Revenge', author:'Mia Carter', avatar:'https://i.pravatar.cc/100?img=48', cat:'Urban', genre:'Revenge', status:'Under Review', views:'623K', added:'Jun 12, 2026', img:'https://i.postimg.cc/ftRZbhKx/3.jpg', desc:'Given a second chance at life, she will make them pay for every tear.' },
    { id:'BK001252', title:'Claimed by the Mafia King', author:'Bella King', avatar:'https://i.pravatar.cc/100?img=29', cat:'Romance', genre:'Mafia Romance', status:'Draft', views:'\u2014', added:'Jun 11, 2026', img:'https://i.postimg.cc/cgLZJNmC/8.jpg', desc:'A dangerous pact in the shadows of the underworld.' },
    { id:'BK001251', title:'The Vampire\'s Obsession', author:'Ethan Vale', avatar:'https://i.pravatar.cc/100?img=13', cat:'Fantasy', genre:'Vampire Romance', status:'Published', views:'512K', added:'Jun 10, 2026', img:'https://i.postimg.cc/WF1j4Pnh/6.jpg', desc:'Immortal hunger meets unbreakable mortal devotion.' },
    { id:'BK001250', title:'Broken Vows', author:'Sophie Lane', avatar:'https://i.pravatar.cc/100?img=31', cat:'Romance', genre:'Second Chance', status:'Flagged', views:'\u2014', added:'Jun 10, 2026', img:'https://i.postimg.cc/0MyxNqfz/7.jpg', desc:'Can love survive the truths they swore never to reveal?' },
    { id:'BK001249', title:'The Prince\'s Secret Wife', author:'Isabella Rose', avatar:'https://i.pravatar.cc/100?img=44', cat:'Romance', genre:'Royal Romance', status:'Published', views:'391K', added:'Jun 9, 2026', img:'https://i.postimg.cc/N9jY0w4m/5.jpg', desc:'Behind palace gates lies a royal scandal waiting to explode.' },
    { id:'BK001248', title:'Runaway Bride in Socked Feet', author:'Ifeanyi_Story', avatar:'https://i.pravatar.cc/100?img=53', cat:'Romance', genre:'Twist', status:'Published', views:'312K', added:'Jun 8, 2026', img:'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', desc:'Leaving the altar was only the beginning of her real journey.' },
    { id:'BK001247', title:'The Letter He Never Sent', author:'Efe_O', avatar:'https://i.pravatar.cc/100?img=22', cat:'Elegy', genre:'Romance', status:'Published', views:'218K', added:'Jun 7, 2026', img:'https://i.postimg.cc/23WvkFLH/images-(2).jpg', desc:'Words hidden in an old drawer change two lives forever.' },
    { id:'BK001246', title:'Caught Kissing Her Photograph', author:'Ada_Writes', avatar:'https://i.pravatar.cc/100?img=32', cat:'Romance', genre:'Betrayal', status:'Published', views:'171K', added:'Jun 6, 2026', img:'https://i.postimg.cc/vDn9YLx5/wife2.jpg', desc:'A picture is worth a thousand lies.' },
    { id:'BK001245', title:'She Rejected Me 3 Times', author:'Dami_Cole', avatar:'https://i.pravatar.cc/100?img=64', cat:'Romance', genre:'Second Chance', status:'Published', views:'22K', added:'Jun 5, 2026', img:'https://i.postimg.cc/fkdXzjSj/wife.jpg', desc:'Three rejections, one last desperate gamble for her heart.' },
    { id:'BK001244', title:'The Richest Boy Beside Me', author:'CampusQueen', avatar:'https://i.pravatar.cc/100?img=12', cat:'Campus', genre:'Romance', status:'Published', views:'134K', added:'Jun 4, 2026', img:'https://i.postimg.cc/cgLZJNmC/8.jpg', desc:'She thought he was a broke student until she saw his motorcade.' },
    { id:'BK001243', title:'Stepmother Stole My Fund', author:'Zara_M', avatar:'https://i.pravatar.cc/100?img=16', cat:'Revenge', genre:'Family Drama', status:'Published', views:'192K', added:'Jun 3, 2026', img:'https://i.postimg.cc/ftRZbhKx/3.jpg', desc:'Reclaiming her inheritance, one calculated step at a time.' },
  ];

  /* ── FEATURED STORIES ── */
  var FEATURED_TAGS = {
    'featured':     { label:'⭐ Featured',        bg:'var(--accent-soft)', fg:'var(--accent)' },
    'hot':          { label:'🔥 Hot',            bg:'var(--red-bg)',    fg:'var(--red)'    },
    'trending':     { label:'📈 Trending',       bg:'var(--blue-bg)',   fg:'var(--blue)'   },
    'editors-pick': { label:"🎖️ Editor's Pick",  bg:'var(--purple-bg)', fg:'var(--purple)' },
    'new':          { label:'✨ New',             bg:'var(--green-bg)',  fg:'var(--green)'  },
    'staff-fav':    { label:'👑 Staff Favorite', bg:'var(--amber-bg)',  fg:'var(--amber)'  },
  };

  var FEATURED_SECTIONS = [
    { id:'hero-banner',        label:'Hero Banner (Homepage Slider)', icon:'🎬', needsSub:false },
    { id:'popular-stories',    label:'Popular Stories',               icon:'📚', needsSub:false },
    { id:'story-rankings',     label:'Story Rankings',                icon:'🏆', needsSub:true, subLabel:'Ranking Tab', subOptions:['Hot','Top','New'] },
    { id:'editors-picks',      label:"Editor's Picks",                icon:'⭐', needsSub:false },
    { id:'browse-by-feeling',  label:'Browse by Feeling',             icon:'😭', needsSub:true, subLabel:'Feeling', subOptions:['Heartbreak','Rage','Shocked','Emotional','Savage'] },
    { id:'genre-row',          label:'Genre Row',                     icon:'🏷️', needsSub:true, subLabel:'Genre', subOptions:['Romance','Betrayal','Family','Campus','Revenge','Elegy','Twist','Comedy','Dark','Spiritual','Werewolf'] },
    { id:'new-releases',       label:'New Releases',                  icon:'✨', needsSub:false },
    { id:'popular-by-country', label:'Popular By Country',            icon:'🌍', needsSub:true, subLabel:'Country', subOptions:['Nigeria','Ghana','Kenya','S.Africa','Uganda'] },
  ];

  var FEATURED_LIBRARY = [
    { id:'ST-001', title:'Bound by the Ruthless Alpha', author:'Chioma Okafor', genre:'Romance & Betrayal', cover:'https://i.postimg.cc/fkdXzjS8/wolf.jpg', rating:4.5, chapters:31, words:124000, status:'ongoing', synopsis:"Chained to an alpha who broke her trust once already, Amara must decide whether loyalty to her pack is worth risking her heart a second time." },
    { id:'ST-002', title:"The CEO's Hidden Son", author:'Luna Skye', genre:'Billionaire & CEO', cover:'https://i.postimg.cc/23WvkFLH/images-(2).jpg', rating:4.3, chapters:24, words:96000, status:'ongoing', synopsis:"When a boardroom takeover forces billionaire Adrian Cole to confront the son he never knew existed, one accidental meeting threatens to unravel a decade of secrets." },
    { id:'ST-003', title:"Wolf King's Vow", author:'Elena Vasquez', genre:'Werewolf & Fantasy', cover:'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', rating:4.1, chapters:12, words:48000, status:'ongoing', synopsis:"Bound by an ancient vow neither of them chose, a reluctant wolf king and the human he's sworn to protect must survive a war between packs." },
    { id:'ST-004', title:'Betrayed by the Mafia Prince', author:'Marcus Webb Jr.', genre:'Mafia & Urban', cover:'https://i.postimg.cc/WF1j4Pnh/6.jpg', rating:3.9, chapters:7, words:28000, status:'ongoing', synopsis:"Raised to inherit an empire built on blood, Dante Moretti trusted no one — until the one person he let in turned out to be working for the family that wants him dead." },
    { id:'ST-005', title:"The Duke's Secret", author:'Isabelle Moreau', genre:'Historical & Regency', cover:'https://i.postimg.cc/fkdXzjSj/wife.jpg', rating:4.7, chapters:31, words:155000, status:'completed', synopsis:"A duke's carefully buried past resurfaces the night his estranged wife returns to London society, forcing him to choose between title and truth." },
    { id:'ST-006', title:'Revenge at the Ivy League', author:'Wren Okonkwo', genre:'Campus & Revenge', cover:'https://i.postimg.cc/cgLZJNmC/8.jpg', rating:4.0, chapters:9, words:31000, status:'ongoing', synopsis:"Expelled on false charges and quietly reinstated years later, Naomi returns to the Ivy League with one goal: expose the golden boy who destroyed her name." },
    { id:'ST-007', title:'The Runaway Bride in Socked Feet', author:'Ifeanyi_Story', genre:'Twist & Drama', cover:'https://i.postimg.cc/tY7KnJyr/images.jpg', rating:4.6, chapters:22, words:88000, status:'ongoing', synopsis:"She walked out of her own wedding in her socked feet with nothing but her phone and a plan — but the life she builds comes with secrets of its own." },
    { id:'ST-008', title:'The Letter He Never Sent', author:'Efe_O', genre:'Elegy & Heartbreak', cover:'https://i.postimg.cc/N9jY0w4m/5.jpg', rating:4.4, chapters:15, words:52000, status:'ongoing', synopsis:"Ten years after he disappeared without a word, a folded letter turns up in his old jacket pocket — and everything she thought she knew starts to fall apart." },
    { id:'ST-009', title:'Caught Him Kissing Her Photograph', author:'Ada_Writes', genre:'Romance & Betrayal', cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg', rating:4.2, chapters:19, words:64000, status:'ongoing', synopsis:"She came home early to celebrate their anniversary and found her husband kissing a photograph of a woman she'd never seen." },
    { id:'ST-010', title:'My Stepmother Stole My Fund', author:'Zara_M', genre:'Mafia & Urban', cover:'https://i.postimg.cc/ftRZbhKx/3.jpg', rating:3.8, chapters:11, words:37000, status:'ongoing', synopsis:"When her university fund vanishes days before tuition is due, Zara traces the missing money straight to the stepmother who's spent a decade pretending to love her." },
    { id:'ST-011', title:'She Rejected Me Three Times', author:'Dami_Cole', genre:'Romance & Betrayal', cover:'https://i.postimg.cc/YGCkSw-33/1.jpg', rating:4.0, chapters:8, words:21000, status:'ongoing', synopsis:"Third time trying to ask out the girl from the coffee shop, and third time she said no — but this time she left her number on the receipt." },
    { id:'ST-012', title:"My Grandmother's Will", author:'Chiamaka_N', genre:'Campus & Revenge', cover:'https://i.postimg.cc/DJwFzKgd/4.jpg', rating:4.3, chapters:27, words:101000, status:'completed', synopsis:"The will names her sole heir to a fortune she didn't know existed — on one condition: that she uncover the family secret her grandmother took to her grave." },
  ];

  var FEATURED_PLACEMENTS = [
    { id:'ST-002', placement:{section:'hero-banner',sub:null}, tags:['featured','hot','editors-pick'], start:'2026-07-20', end:'2026-08-03', note:'Gripping storyline with unexpected twists — perfect for CEO romance fans.' },
    { id:'ST-001', placement:{section:'genre-row',sub:'Romance'}, tags:['featured','trending'], start:'2026-07-15', end:'2026-07-29', note:'' },
    { id:'ST-003', placement:{section:'genre-row',sub:'Werewolf'}, tags:['featured','new'], start:'2026-07-22', end:'2026-08-05', note:'' },
    { id:'ST-007', placement:{section:'new-releases',sub:null}, tags:['featured','new','staff-fav'], start:'2026-07-25', end:'2026-08-08', note:'' },
    { id:'ST-012', placement:{section:'story-rankings',sub:'Top'}, tags:['featured','staff-fav'], start:'2026-07-18', end:'2026-08-01', note:'' },
    { id:'ST-009', placement:{section:'browse-by-feeling',sub:'Heartbreak'}, tags:['featured'], start:'2026-07-27', end:'2026-08-10', note:'' },
  ];

  var FEATURED_HISTORY = [
    { title:"The Duke's Secret", author:'Isabelle Moreau', cover:'https://i.postimg.cc/fkdXzjSj/wife.jpg', genre:'Historical & Regency', rating:4.7, placement:{section:'editors-picks',sub:null}, tags:['editors-pick'], period:'Jun 1 – Jun 15, 2026' },
    { title:'Betrayed by the Mafia Prince', author:'Marcus Webb Jr.', cover:'https://i.postimg.cc/WF1j4Pnh/6.jpg', genre:'Mafia & Urban', rating:3.9, placement:{section:'hero-banner',sub:null}, tags:['hot'], period:'May 15 – May 29, 2026' },
    { title:"The CEO's Hidden Son", author:'Luna Skye', cover:'https://i.postimg.cc/23WvkFLH/images-(2).jpg', genre:'Billionaire & CEO', rating:4.3, placement:{section:'story-rankings',sub:'Hot'}, tags:['hot','trending'], period:'Jun 20 – Jul 4, 2026' },
  ];

  /* ── EDITOR'S PICKS ── */
  var EDITORS_PICKS = [
    { id:'ST-005', title:"The Duke's Secret", author:'Isabelle Moreau', genre:'Historical & Regency', cover:'https://i.postimg.cc/fkdXzjSj/wife.jpg', rating:4.7, chapters:31, words:155000, status:'completed', synopsis:"A duke's carefully buried past resurfaces the night his estranged wife returns to London society, forcing him to choose between the title he was born to and the truth he's spent years hiding.", reason:'Masterful pacing and emotional depth — a standout historical romance.', pickedBy:'Chioma Reddy', pickedDate:'2026-07-10', category:'Best Completed', active:true },
    { id:'ST-002', title:"The CEO's Hidden Son", author:'Luna Skye', genre:'Billionaire & CEO', cover:'https://i.postimg.cc/23WvkFLH/images-(2).jpg', rating:4.3, chapters:24, words:96000, status:'ongoing', synopsis:"When a boardroom takeover forces billionaire Adrian Cole to confront the son he never knew existed, one accidental meeting threatens to unravel a decade of carefully guarded secrets.", reason:'Addictive twist on the billionaire trope — readers can\'t stop bingeing.', pickedBy:'Chioma Reddy', pickedDate:'2026-07-05', category:'Must Read', active:true },
    { id:'ST-007', title:'The Runaway Bride in Socked Feet', author:'Ifeanyi_Story', genre:'Twist & Drama', cover:'https://i.postimg.cc/tY7KnJyr/images.jpg', rating:4.6, chapters:22, words:88000, status:'ongoing', synopsis:"She walked out of her own wedding in her socked feet with nothing but her phone and a plan — but the life she builds to replace it comes with secrets of its own.", reason:'Fresh premise, razor-sharp dialogue, and a heroine readers root for.', pickedBy:'Chioma Reddy', pickedDate:'2026-07-12', category:'Editor\'s Choice', active:true },
    { id:'ST-001', title:'Bound by the Ruthless Alpha', author:'Chioma Okafor', genre:'Romance & Betrayal', cover:'https://i.postimg.cc/fkdXzjS8/wolf.jpg', rating:4.5, chapters:31, words:124000, status:'ongoing', synopsis:"Chained to an alpha who broke her trust once already, Amara must decide whether loyalty to her pack is worth risking her heart a second time — even as an old rival circles closer.", reason:'Powerful worldbuilding and a heroine with real agency.', pickedBy:'Chioma Reddy', pickedDate:'2026-06-28', category:'Must Read', active:true },
    { id:'ST-008', title:'The Letter He Never Sent', author:'Efe_O', genre:'Elegy & Heartbreak', cover:'https://i.postimg.cc/N9jY0w4m/5.jpg', rating:4.4, chapters:15, words:52000, status:'ongoing', synopsis:"Ten years after he disappeared without a word, a folded letter turns up in his old jacket pocket — and everything she thought she knew about why he left starts to fall apart.", reason:'Raw emotional storytelling — the kind that stays with you.', pickedBy:'Chioma Reddy', pickedDate:'2026-07-01', category:'Best Completed', active:false },
    { id:'ST-003', title:"Wolf King's Vow", author:'Elena Vasquez', genre:'Werewolf & Fantasy', cover:'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', rating:4.1, chapters:12, words:48000, status:'ongoing', synopsis:"Bound by an ancient vow neither of them chose, a reluctant wolf king and the human he's sworn to protect must survive a war between packs — and the pull growing between them.", reason:'A fresh take on wolf lore with genuine romantic tension.', pickedBy:'Chioma Reddy', pickedDate:'2026-06-20', category:'Rising Star', active:true },
    { id:'ST-009', title:'Caught Him Kissing Her Photograph', author:'Ada_Writes', genre:'Romance & Betrayal', cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg', rating:4.2, chapters:19, words:64000, status:'ongoing', synopsis:"She came home early to celebrate their anniversary and found her husband kissing a photograph of a woman she'd never seen — the first thread in a marriage built on more than one lie.", reason:'Domestic suspense meets raw emotional truth — unputdownable.', pickedBy:'Chioma Reddy', pickedDate:'2026-07-08', category:'Editor\'s Choice', active:true },
  ];

  var EDITORS_PICKS_LOG = [
    { action:'picked', story:'The Duke\'s Secret', by:'Chioma Reddy', date:'2026-07-10', note:'Added to Best Completed' },
    { action:'picked', story:"The CEO's Hidden Son", by:'Chioma Reddy', date:'2026-07-05', note:'Added to Must Read' },
    { action:'picked', story:'The Runaway Bride in Socked Feet', by:'Chioma Reddy', date:'2026-07-12', note:'Added to Editor\'s Choice' },
    { action:'picked', story:'Bound by the Ruthless Alpha', by:'Chioma Reddy', date:'2026-06-28', note:'Added to Must Read' },
    { action:'removed', story:'The Letter He Never Sent', by:'Chioma Reddy', date:'2026-07-14', note:'Moved to archive — ended run' },
    { action:'picked', story:"Wolf King's Vow", by:'Chioma Reddy', date:'2026-06-20', note:'Added to Rising Star' },
    { action:'picked', story:'Caught Him Kissing Her Photograph', by:'Chioma Reddy', date:'2026-07-08', note:'Added to Editor\'s Choice' },
  ];

  /* ═══════════════════════════════════════════════════════════════
     Expose as window.EditorDemo
     ═══════════════════════════════════════════════════════════════ */
  window.EditorDemo = {
    LOGS: LOGS,
    REQUESTS: REQUESTS,
    RECENT_REVIEWS: RECENT_REVIEWS,
    CATEGORIES: CATEGORIES,
    GENRES: GENRES,
    POPULAR_GENRES: POPULAR_GENRES,
    ANNOUNCEMENT_TYPE_META: ANNOUNCEMENT_TYPE_META,
    ANNOUNCEMENTS: ANNOUNCEMENTS,
    OVERVIEW_BREAKDOWN: OVERVIEW_BREAKDOWN,
    ANNOUNCE_QUICK_ACTIONS: ANNOUNCE_QUICK_ACTIONS,
    ANNOUNCE_RECENT: ANNOUNCE_RECENT,
    AUTHORS: AUTHORS,
    TOP_AUTHORS: TOP_AUTHORS,
    CONVERSATIONS: CONVERSATIONS,
    WITHDRAWALS: WITHDRAWALS,
    TXNS: TXNS,
    PAYMENTS: PAYMENTS,
    NOTIFS: NOTIFS,
    CONTRACT_TYPE_META: CONTRACT_TYPE_META,
    CONTRACTS: CONTRACTS,
    EXPIRING_SOON: EXPIRING_SOON,
    STATS_BREAKDOWN: STATS_BREAKDOWN,
    CONTRACT_TYPES: CONTRACT_TYPES,
    MONTHS: MONTHS,
    AUTHOR_DATA: AUTHOR_DATA,
    PLATFORM_DATA: PLATFORM_DATA,
    AD_DATA: AD_DATA,
    TOP_EARNERS: TOP_EARNERS,
    TEMPLATES: TEMPLATES,
    TEMPLATE_HISTORY: TEMPLATE_HISTORY,
    FLAGS: FLAGS,
    FLAG_TYPE_META: FLAG_TYPE_META,
    PROMO_TYPE_META: PROMO_TYPE_META,
    PROMOTIONS: PROMOTIONS,
    MIX_BREAKDOWN: MIX_BREAKDOWN,
    TOP_PROMOS: TOP_PROMOS,
    PROMO_QUICK_ACTIONS: PROMO_QUICK_ACTIONS,
    BOOKS: BOOKS,
    FEATURED_TAGS: FEATURED_TAGS,
    FEATURED_SECTIONS: FEATURED_SECTIONS,
    FEATURED_LIBRARY: FEATURED_LIBRARY,
    FEATURED_PLACEMENTS: FEATURED_PLACEMENTS,
    FEATURED_HISTORY: FEATURED_HISTORY,
    EDITORS_PICKS: EDITORS_PICKS,
    EDITORS_PICKS_LOG: EDITORS_PICKS_LOG,
  };

})();
