/**
 * api.js — Droboard Editor API Layer
 * ─────────────────────────────────────────────────────────────────────
 * Supports real backend calls with automatic fallback to demo data.
 * To use a real backend, set CONFIG.BASE_URL or window.DroboardAPI.CONFIG.BASE_URL.
 * Demo data mutations persist in localStorage for a seamless experience.
 */
(function () {
  'use strict';

  if (window.DroboardAPI) return;

  const STORAGE_KEY = 'DROBOARD_STORE_V1';

  const CONFIG = {
    BASE_URL: localStorage.getItem('DROBOARD_BASE_URL') || '', // e.g., 'https://api.example.com/admin'
  };

  // ── Consistent image URLs ──────────────────────────────────
  const IMG = {
    wife3: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
    wife2: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
    wife:  'https://i.postimg.cc/fkdXzjSj/wife.jpg',
    letter:'https://i.postimg.cc/23WvkFLH/images-(2).jpg',
    campus:'https://i.postimg.cc/cgLZJNmC/8.jpg',
    photos:'https://i.postimg.cc/0MyxNqfz/7.jpg',
    rank1: 'https://i.postimg.cc/WF1j4Pnh/6.jpg',
    rank2: 'https://i.postimg.cc/N9jY0w4m/5.jpg',
    rank3: 'https://i.postimg.cc/DJwFzKgd/4.jpg',
    rank4: 'https://i.postimg.cc/ftRZbhKx/3.jpg',
    rank5: 'https://i.postimg.cc/JDzmhWqj/2.jpg',
    rank6: 'https://i.postimg.cc/YGCkSw-33/1.jpg',
  };
  const IMG_LIST = Object.values(IMG);

  // ── Initial Datasets ───────────────────────────────────────
  const DEFAULT_DATA = {
    stats: {
      pendingReviews: 8, signedThisMonth: 12, activeContracts: 24,
      activeAuthors: 31, reviewsThisMonth: 142, signRate: '73%', signedStories: 38,
      totalBooks: 1284, publishedBooks: 892, draftBooks: 47, flaggedBooks: 18, totalViews: '12.4M'
    },
    activity: [
      { icon: 'accent', emoji: '📝', text: '<strong>Ifeanyi_Story</strong> signed a contract for <span class="highlight">Runaway Bride</span>', time: '2h ago', unread: true },
      { icon: 'green', emoji: '✅', text: '<strong>Chiamaka_N</strong> story approved — <span class="highlight">Grandmother\'s Will</span>', time: '4h ago', unread: true },
      { icon: 'yellow', emoji: '💰', text: 'Revenue share credited from Ada_Writes reads', time: '5h ago', unread: true },
      { icon: 'blue', emoji: '📚', text: '<strong>Dami_Cole</strong> submitted new story: <span class="highlight">"She Rejected Me 3 Times"</span>', time: '7h ago', unread: false },
      { icon: 'accent', emoji: '📧', text: '<strong>Kemi_A</strong> opened contract email for <span class="highlight">"He Deleted Our Photos"</span>', time: '1d ago', unread: false },
      { icon: 'green', emoji: '🛡️', text: 'Admin <strong>co-signed</strong> premium contract for <span class="highlight">Chiamaka_N</span>', time: '1d ago', unread: false },
    ],
    books: [
      { id:'BK001256', title:'The Ruthless CEO', author:'Ava Winters', avatar:'https://i.pravatar.cc/100?img=45', cat:'Romance', genre:'Billionaire Romance', status:'Published', views:'1.2M', added:'Jun 15, 2026', img:IMG.wife3, desc:'Driven by power, torn by desire. A billionaire romance like no other.' },
      { id:'BK001255', title:'Bound by the Ruthless Alpha', author:'Luna Skye', avatar:'https://i.pravatar.cc/100?img=32', cat:'Romance', genre:'Werewolf Romance', status:'Published', views:'946K', added:'Jun 14, 2026', img:IMG.wife2, desc:'She was meant to be his enemy, but fate had other plans.' },
      { id:'BK001254', title:'His Hidden Luna', author:'Lyra Night', avatar:'https://i.pravatar.cc/100?img=25', cat:'Romance', genre:'Werewolf Romance', status:'Published', views:'832K', added:'Jun 13, 2026', img:IMG.wife, desc:'A secret identity that could destroy the pack or unite it.' },
      { id:'BK001253', title:'Reborn to Revenge', author:'Mia Carter', avatar:'https://i.pravatar.cc/100?img=48', cat:'Urban', genre:'Revenge', status:'Under Review', views:'623K', added:'Jun 12, 2026', img:IMG.rank4, desc:'Given a second chance at life, she will make them pay for every tear.' },
      { id:'BK001252', title:'Claimed by the Mafia King', author:'Bella King', avatar:'https://i.pravatar.cc/100?img=29', cat:'Romance', genre:'Mafia Romance', status:'Draft', views:'—', added:'Jun 11, 2026', img:IMG.campus, desc:'A dangerous pact in the shadows of the underworld.' },
      { id:'BK001251', title:"The Vampire's Obsession", author:'Ethan Vale', avatar:'https://i.pravatar.cc/100?img=13', cat:'Fantasy', genre:'Vampire Romance', status:'Published', views:'512K', added:'Jun 10, 2026', img:IMG.rank1, desc:'Immortal hunger meets unbreakable mortal devotion.' },
      { id:'BK001250', title:'Broken Vows', author:'Sophie Lane', avatar:'https://i.pravatar.cc/100?img=31', cat:'Romance', genre:'Second Chance', status:'Flagged', views:'—', added:'Jun 10, 2026', img:IMG.photos, desc:'Can love survive the truths they swore never to reveal?' },
      { id:'BK001249', title:"The Prince's Secret Wife", author:'Isabella Rose', avatar:'https://i.pravatar.cc/100?img=44', cat:'Romance', genre:'Royal Romance', status:'Published', views:'391K', added:'Jun 9, 2026', img:IMG.rank2, desc:'Behind palace gates lies a royal scandal waiting to explode.' },
      { id:'BK001248', title:'Runaway Bride in Socked Feet', author:'Ifeanyi_Story', avatar:'https://i.pravatar.cc/100?img=53', cat:'Romance', genre:'Twist', status:'Published', views:'312K', added:'Jun 8, 2026', img:IMG.wife3, desc:'Leaving the altar was only the beginning of her real journey.' },
      { id:'BK001247', title:'The Letter He Never Sent', author:'Efe_O', avatar:'https://i.pravatar.cc/100?img=22', cat:'Elegy', genre:'Romance', status:'Published', views:'218K', added:'Jun 7, 2026', img:IMG.letter, desc:'Words hidden in an old drawer change two lives forever.' },
      { id:'BK001246', title:'Caught Kissing Her Photograph', author:'Ada_Writes', avatar:'https://i.pravatar.cc/100?img=32', cat:'Romance', genre:'Betrayal', status:'Published', views:'171K', added:'Jun 6, 2026', img:IMG.wife2, desc:'A picture is worth a thousand lies.' },
      { id:'BK001245', title:'She Rejected Me 3 Times', author:'Dami_Cole', avatar:'https://i.pravatar.cc/100?img=64', cat:'Romance', genre:'Second Chance', status:'Published', views:'22K', added:'Jun 5, 2026', img:IMG.wife, desc:'Three rejections, one last desperate gamble for her heart.' },
      { id:'BK001244', title:'The Richest Boy Beside Me', author:'CampusQueen', avatar:'https://i.pravatar.cc/100?img=12', cat:'Campus', genre:'Romance', status:'Published', views:'134K', added:'Jun 4, 2026', img:IMG.campus, desc:'She thought he was a broke student until she saw his motorcade.' },
      { id:'BK001243', title:'Stepmother Stole My Fund', author:'Zara_M', avatar:'https://i.pravatar.cc/100?img=16', cat:'Revenge', genre:'Family Drama', status:'Published', views:'192K', added:'Jun 3, 2026', img:IMG.rank4, desc:'Reclaiming her inheritance, one calculated step at a time.' },
    ],
    reviews: [
      { id:'BK001', title:'The Ruthless CEO', writer:'Ava Winters', writerAv:'https://i.pravatar.cc/100?img=45', cat:'Romance', rating:4.8, status:'approved', submitted:'2026-06-15T10:00:00Z', likes:1200, img:IMG.wife3, cover:'#ff0050', time:'2h ago', reads:'12.4k' },
      { id:'BK002', title:'Bound by the Ruthless Alpha', writer:'Luna Skye', writerAv:'https://i.pravatar.cc/100?img=32', cat:'Romance', rating:4.7, status:'pending', submitted:'2026-06-14T14:30:00Z', likes:850, img:IMG.wife2, cover:'#34d399', time:'4h ago', reads:'8.1k' },
      { id:'BK003', title:'His Hidden Luna', writer:'Lyra Night', writerAv:'https://i.pravatar.cc/100?img=25', cat:'Romance', rating:4.6, status:'reviewing', submitted:'2026-06-13T09:15:00Z', likes:640, img:IMG.wife, cover:'#ff0050', time:'3h ago', reads:'45k' },
      { id:'BK004', title:'Reborn to Revenge', writer:'Mia Carter', writerAv:'https://i.pravatar.cc/100?img=48', cat:'Urban', rating:4.3, status:'approved', submitted:'2026-06-12T16:45:00Z', likes:430, img:IMG.rank4, cover:'#fbbf24', time:'6h ago', reads:'4.2k' },
      { id:'BK005', title:'Claimed by the Mafia King', writer:'Bella King', writerAv:'https://i.pravatar.cc/100?img=29', cat:'Romance', rating:4.9, status:'rejected', submitted:'2026-06-11T11:20:00Z', likes:320, img:IMG.campus, cover:'#38bdf8', time:'1d ago', reads:'7.2k' },
      { id:'BK006', title:"The Vampire's Obsession", writer:'Ethan Vale', writerAv:'https://i.pravatar.cc/100?img=13', cat:'Fantasy', rating:4.5, status:'approved', submitted:'2026-06-10T08:00:00Z', likes:510, img:IMG.rank1, cover:'#f87171', time:'1d ago', reads:'1.2k' },
      { id:'BK007', title:'Broken Vows', writer:'Sophie Lane', writerAv:'https://i.pravatar.cc/100?img=31', cat:'Romance', rating:3.9, status:'pending', submitted:'2026-06-10T13:30:00Z', likes:180, img:IMG.photos, cover:'#fbbf24', time:'1d ago', reads:'2.5k' },
      { id:'BK008', title:"The Prince's Secret Wife", writer:'Isabella Rose', writerAv:'https://i.pravatar.cc/100?img=44', cat:'Romance', rating:4.8, status:'approved', submitted:'2026-06-09T15:00:00Z', likes:390, img:IMG.rank2, cover:'#ff0050', time:'2d ago', reads:'9.8k' },
    ],
    authors: [
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
    ],
    contracts: [
      { id:'CNTR-2026-00125', cover:IMG.wife3, title:'Bound by the Ruthless Alpha', author:'Luna Skye', type:'Exclusive Publishing', status:'active', effective:'Jun 14, 2026', expiry:'Jun 14, 2028', expirySub:'(2 years)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
      { id:'CNTR-2026-00124', cover:IMG.wife2, title:'The Ruthless CEO', author:'Ava Winters', type:'Exclusive Publishing', status:'active', effective:'Jun 10, 2026', expiry:'Jun 10, 2028', expirySub:'(2 years)', editor:'Daniel Carter', editorAvatar:'https://i.pravatar.cc/100?img=12' },
      { id:'CNTR-2026-00123', cover:IMG.rank4, title:'Reborn to Revenge', author:'Mia Carter', type:'Revenue Share', status:'pending', effective:'Jun 8, 2026', expiry:'—', expirySub:'', editor:'Sophia Bennett', editorAvatar:'https://i.pravatar.cc/100?img=29' },
      { id:'CNTR-2026-00122', cover:IMG.wife, title:'His Hidden Luna', author:'Lyra Night', type:'Exclusive Publishing', status:'active', effective:'Jun 5, 2026', expiry:'Jun 5, 2028', expirySub:'(2 years)', editor:'Ethan Walker', editorAvatar:'https://i.pravatar.cc/100?img=53' },
      { id:'CNTR-2026-00121', cover:IMG.campus, title:'Claimed by the Mafia King', author:'Bella King', type:'Exclusive Publishing', status:'expiring', effective:'May 20, 2024', expiry:'May 20, 2026', expirySub:'(in 18 days)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
      { id:'CNTR-2026-00120', cover:IMG.rank1, title:"The Vampire's Obsession", author:'Ethan Vale', type:'License Agreement', status:'expired', effective:'Apr 15, 2024', expiry:'Apr 15, 2026', expirySub:'', editor:'Daniel Carter', editorAvatar:'https://i.pravatar.cc/100?img=12' },
      { id:'CNTR-2026-00119', cover:IMG.photos, title:'Broken Vows', author:'Sophie Lane', type:'Exclusive Publishing', status:'terminated', effective:'Mar 10, 2024', expiry:'Mar 10, 2026', expirySub:'', editor:'Sophia Bennett', editorAvatar:'https://i.pravatar.cc/100?img=29' },
      { id:'CNTR-2026-00118', cover:IMG.rank2, title:"The Prince's Secret Wife", author:'Isabella Rose', type:'Revenue Share', status:'active', effective:'May 1, 2026', expiry:'May 1, 2028', expirySub:'(2 years)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
    ],
    withdrawals: [
      { id:'WD-0047', author:'Amara Okafor', avatar:'https://i.pravatar.cc/100?img=45', amount:'$2,450.00', method:'Bank Transfer', status:'pending', requested:'Jun 17, 2026', processed:'—' },
      { id:'WD-0046', author:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', amount:'$1,820.00', method:'PayPal', status:'processing', requested:'Jun 16, 2026', processed:'Jun 17, 2026' },
      { id:'WD-0045', author:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', amount:'$3,100.00', method:'Mobile Money', status:'completed', requested:'Jun 14, 2026', processed:'Jun 16, 2026' },
      { id:'WD-0044', author:'Marcus Chen', avatar:'https://i.pravatar.cc/100?img=12', amount:'$980.00', method:'Bank Transfer', status:'pending', requested:'Jun 13, 2026', processed:'—' },
      { id:'WD-0043', author:'Priya Nair', avatar:'https://i.pravatar.cc/100?img=27', amount:'$1,560.00', method:'PayPal', status:'completed', requested:'Jun 12, 2026', processed:'Jun 14, 2026' },
      { id:'WD-0042', author:'Layla Haddad', avatar:'https://i.pravatar.cc/100?img=48', amount:'$2,890.00', method:'Bank Transfer', status:'processing', requested:'Jun 11, 2026', processed:'Jun 13, 2026' },
      { id:'WD-0041', author:'Daniel Reyes', avatar:'https://i.pravatar.cc/100?img=51', amount:'$450.00', method:'Mobile Money', status:'pending', requested:'Jun 10, 2026', processed:'—' },
      { id:'WD-0040', author:'Julien Moreau', avatar:'https://i.pravatar.cc/100?img=15', amount:'$320.00', method:'PayPal', status:'rejected', requested:'Jun 9, 2026', processed:'Jun 11, 2026' },
    ],
    reports: [
      { id:'FLG-0047', title:'Inappropriate Content in "The Ruthless CEO"', desc:'Chapter 12 contains explicit content.', type:'content', reporter:'Reader_2345', status:'pending', date:'Jun 17, 2026', ico:'fa-flag', bg:'#fde3e3', clr:'var(--red)' },
      { id:'FLG-0046', title:'Spam Comments', desc:'Multiple spam comments promoting websites.', type:'spam', reporter:'ModBot', status:'pending', date:'Jun 16, 2026', ico:'fa-bug', bg:'#fde3e3', clr:'var(--red)' },
      { id:'FLG-0045', title:'Plagiarism: "His Hidden Luna"', desc:'Sections appear copied from another work.', type:'plagiarism', reporter:'Author_789', status:'resolved', date:'Jun 15, 2026', ico:'fa-copy', bg:'#e3ecfd', clr:'var(--blue)' },
      { id:'FLG-0044', title:'Harassment in Comments', desc:'User making offensive remarks.', type:'abuse', reporter:'LunaSkye', status:'pending', date:'Jun 14, 2026', ico:'fa-hand', bg:'#ece9fb', clr:'#5b4bcf' },
      { id:'FLG-0043', title:'Fake Account', desc:'Account suspected of impersonation.', type:'other', reporter:'Admin_Team', status:'resolved', date:'Jun 13, 2026', ico:'fa-user-slash', bg:'#eef0f2', clr:'#5b6470' },
      { id:'FLG-0042', title:'Explicit Cover Image', desc:'Cover contains nudity.', type:'content', reporter:'Reader_8901', status:'dismissed', date:'Jun 12, 2026', ico:'fa-image', bg:'#fde3e3', clr:'var(--red)' },
      { id:'FLG-0041', title:'Copyright Infringement', desc:'Work republished without permission.', type:'plagiarism', reporter:'MiaCarter', status:'pending', date:'Jun 11, 2026', ico:'fa-copyright', bg:'#e3ecfd', clr:'var(--blue)' },
      { id:'FLG-0040', title:'Spam Promo in Bio', desc:'Author bio contains competitor links.', type:'spam', reporter:'ModBot', status:'resolved', date:'Jun 10, 2026', ico:'fa-bug', bg:'#fde3e3', clr:'var(--red)' },
    ],
    categories: [
      { name:'Romance', icon:'fa-heart', bg:'#ffe1eb', color:'#ff0050', desc:'Stories about love and relationships.', genres:17, books:'5,284', status:'active' },
      { name:'Billionaire', icon:'fa-crown', bg:'#ece3fd', color:'#7c5cfc', desc:'Billionaire romance stories.', genres:8, books:'2,156', status:'active' },
      { name:'Werewolf', icon:'fa-paw', bg:'#eef0f2', color:'#5b6470', desc:'Werewolf, alpha, mate and pack stories.', genres:10, books:'1,896', status:'active' },
      { name:'Vampire', icon:'fa-droplet', bg:'#fde3e3', color:'#e0384d', desc:'Vampire and dark fantasy romance.', genres:7, books:'1,234', status:'active' },
      { name:'Fantasy', icon:'fa-wand-magic-sparkles', bg:'#ece3fd', color:'#7c5cfc', desc:'Magic, kingdoms, mythical creatures.', genres:11, books:'2,045', status:'active' },
    ],
    genres: [
      { name:'CEO Romance', cat:'Billionaire', icon:'fa-briefcase', bg:'#e3ecfd', color:'#2f7de1', books:'1,245', status:'active' },
      { name:'Alpha Romance', cat:'Werewolf', icon:'fa-paw', bg:'#eef0f2', color:'#5b6470', books:'987', status:'active' },
      { name:'Secret Baby', cat:'Romance', icon:'fa-shield', bg:'#fef3d8', color:'#d97706', books:'876', status:'active' },
      { name:'Enemies to Lovers', cat:'Romance', icon:'fa-heart-crack', bg:'#fde3e3', color:'#e0384d', books:'754', status:'active' },
      { name:'Royal Romance', cat:'Fantasy', icon:'fa-crown', bg:'#ece3fd', color:'#7c5cfc', books:'612', status:'active' },
      { name:'Vampire Romance', cat:'Vampire', icon:'fa-droplet', bg:'#fde3e3', color:'#e0384d', books:'503', status:'active' },
    ],
    promotions: [
      { id:'PRM-101', title:'Summer Romance Blitz', type:'Discount', target:'Romance', value:'30% OFF', status:'active', start:'Jun 01, 2026', end:'Jun 30, 2026', clicks:'45.2K' },
      { id:'PRM-102', title:'Billionaire Featured Spotlight', type:'Featured Banner', target:'The Ruthless CEO', value:'Top Carousel', status:'active', start:'Jun 10, 2026', end:'Jul 10, 2026', clicks:'89.1K' },
    ],
    banners: [
      { id:'BNR-01', title:'Top Werewolf Reads of 2026', img:IMG.wife2, link:'/category/werewolf', pos:'Home Slider 1', status:'active', clicks:'124.5K' },
      { id:'BNR-02', title:'New Release: Bound by the Alpha', img:IMG.wife3, link:'/book/BK001255', pos:'Home Slider 2', status:'active', clicks:'98.2K' },
    ],
    announcements: [
      { id:'ANC-01', title:'Author Royalty Share Update Q3', audience:'All Authors', priority:'High', body:'We have increased author revenue share for exclusive contracts to 75%.', date:'Jun 15, 2026', status:'published' },
      { id:'ANC-02', title:'Scheduled Platform Maintenance', audience:'All Users', priority:'Normal', body:'Maintenance scheduled for Sunday 2:00 AM UTC.', date:'Jun 10, 2026', status:'published' },
    ],
    templates: [
      { id:'TPL-01', name:'Standard Exclusive Publishing Agreement', type:'Exclusive', royalty:'70%', duration:'2 Years', updated:'Jun 01, 2026', status:'active' },
      { id:'TPL-02', name:'Non-Exclusive Revenue Share Contract', type:'Revenue Share', royalty:'50%', duration:'1 Year', updated:'May 15, 2026', status:'active' },
    ],
    notifications: [
      { id:1, type:'contract', title:'Contract Signed: CNTR-2026-00125', desc:'Luna Skye signed Exclusive Publishing Agreement', time:'12m ago', unread:true },
      { id:2, type:'review', title:'New Review Submitted', desc:'4.8-star review on "The Ruthless CEO"', time:'1h ago', unread:true },
    ],
    logs: [
      { user:'Reina Morgan', av:'https://i.pravatar.cc/100?img=47', action:'Approved contract CNTR-2026-00125', type:'update', detail:'Signed Exclusive Publishing Agreement', ip:'192.168.1.42', time:'Jun 17, 2026 10:24 AM' },
      { user:'System', av:'https://i.pravatar.cc/100?img=3', action:'Processed payout batch', type:'create', detail:'Monthly payout of $12,840', ip:'—', time:'Jun 17, 2026 09:00 AM' },
    ],
    settings: {
      siteName: 'TikStory Editor Portal',
      currency: 'USD ($)',
      authorRoyalty: '70',
      minWithdrawal: '50',
      maintenanceMode: false,
      autoApproveReviews: false,
    },
    systemPages: [
      { key:'terms', title:'Terms of Service', updated:'Jun 12, 2026', status:'Published', body:'Standard platform terms and legal guidelines.' },
      { key:'privacy', title:'Privacy Policy', updated:'Jun 10, 2026', status:'Published', body:'Data privacy protection policy.' },
    ],
    messages: [
      { id:1, author:'Luna Skye', av:'https://i.pravatar.cc/100?img=32', subject:'Question on Royalty Payout', text:'Hi Editor, when will the June royalties be finalized?', time:'2h ago', status:'unread' },
    ],
    verifications: [
      { id:'VRF-001', author:'Daniel Reyes', email:'daniel.reyes@mail.com', idType:'National Passport', docUrl:'https://i.postimg.cc/0MyxNqfz/7.jpg', date:'Jun 16, 2026', status:'pending' },
    ]
  };

  // ── Helper to load/save state ──────────────────────────────
  function _loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[DroboardAPI] Error loading store:', e);
    }
    return DEFAULT_DATA;
  }

  const STORE = _loadStore();

  function _saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(STORE));
    } catch (e) {
      console.warn('[DroboardAPI] Error saving store:', e);
    }
  }

  // ── Helper for API requests with fallback ──────────────────
  async function _request(endpoint, options = {}, mockResponse = null) {
    if (CONFIG.BASE_URL) {
      try {
        const res = await fetch(CONFIG.BASE_URL + endpoint, {
          ...options,
          headers: { 'Content-Type': 'application/json', ...options.headers }
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn(`[DroboardAPI] Request to ${endpoint} failed. Fallback to mock.`, e);
      }
    }
    return new Promise(resolve => setTimeout(() => resolve(mockResponse), 150));
  }

  window.DroboardAPI = {
    CONFIG,

    // ═══════════════════════════════════════════════════════
    // DASHBOARD & ACTIVITY
    // ═══════════════════════════════════════════════════════
    getDashboardStats() {
      STORE.stats.pendingReviews = STORE.reviews.filter(r => r.status === 'pending' || r.status === 'reviewing').length;
      STORE.stats.totalBooks = STORE.books.length;
      STORE.stats.publishedBooks = STORE.books.filter(b => b.status === 'Published').length;
      STORE.stats.draftBooks = STORE.books.filter(b => b.status === 'Draft').length;
      STORE.stats.flaggedBooks = STORE.books.filter(b => b.status === 'Flagged').length;
      return _request('/stats', {}, STORE.stats);
    },

    getRecentActivity() {
      return _request('/activity', {}, STORE.activity);
    },

    // ═══════════════════════════════════════════════════════
    // BOOKS & STORIES
    // ═══════════════════════════════════════════════════════
    async getBooks(filters = {}) {
      const data = await _request('/books', {}, { items: STORE.books, total: STORE.books.length });
      let items = [...data.items];
      if (filters.tab && filters.tab !== 'all') items = items.filter(b => b.status === filters.tab);
      if (filters.category && filters.category !== 'All Categories') items = items.filter(b => b.cat === filters.category);
      if (filters.genre && filters.genre !== 'All Genres') items = items.filter(b => b.genre === filters.genre);
      if (filters.status && filters.status !== 'All Status') items = items.filter(b => b.status === filters.status);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
      }
      return { items, total: items.length, grandTotal: STORE.books.length };
    },

    getBookById(id) {
      const b = STORE.books.find(x => x.id === id) || STORE.books[0];
      return _request(`/books/${id}`, {}, b);
    },

    createBook(data) {
      const b = {
        id: 'BK' + Math.floor(100000 + Math.random() * 900000),
        views: '0',
        added: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        img: data.img || IMG_LIST[Math.floor(Math.random() * IMG_LIST.length)],
        avatar: 'https://i.pravatar.cc/100?img=' + Math.floor(Math.random() * 70),
        status: data.status || 'Draft',
        desc: data.desc || 'A newly submitted story waiting for reader reviews.',
        ...data,
      };
      STORE.books.unshift(b);
      _saveStore();
      return _request('/books', { method: 'POST', body: JSON.stringify(data) }, b);
    },

    updateBook(id, data) {
      const idx = STORE.books.findIndex(b => b.id === id);
      if (idx >= 0) Object.assign(STORE.books[idx], data);
      _saveStore();
      return _request(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, { success: true, id });
    },

    deleteBook(id) {
      STORE.books = STORE.books.filter(b => b.id !== id);
      _saveStore();
      return _request(`/books/${id}`, { method: 'DELETE' }, { success: true, id });
    },

    // ═══════════════════════════════════════════════════════
    // REVIEWS
    // ═══════════════════════════════════════════════════════
    getPendingReviews() {
      const items = STORE.reviews.filter(r => r.status === 'pending' || r.status === 'reviewing');
      return _request('/reviews/pending', {}, items);
    },

    async getReviews(filters = {}) {
      const data = await _request('/reviews', {}, { items: STORE.reviews, total: STORE.reviews.length });
      let items = [...data.items];
      if (filters.tab && filters.tab !== 'all') items = items.filter(r => r.status === filters.tab);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(r => r.title.toLowerCase().includes(q) || r.writer.toLowerCase().includes(q));
      }
      return { items, total: items.length, grandTotal: STORE.reviews.length };
    },

    approveReview(id) {
      const r = STORE.reviews.find(r => r.id === id);
      if (r) r.status = 'approved';
      _saveStore();
      return _request(`/reviews/${id}/approve`, { method: 'POST' }, { success: true, id, status: 'approved' });
    },

    rejectReview(id) {
      const r = STORE.reviews.find(r => r.id === id);
      if (r) r.status = 'rejected';
      _saveStore();
      return _request(`/reviews/${id}/reject`, { method: 'POST' }, { success: true, id, status: 'rejected' });
    },

    // ═══════════════════════════════════════════════════════
    // AUTHORS
    // ═══════════════════════════════════════════════════════
    async getAuthors(filters = {}) {
      const data = await _request('/authors', {}, { items: STORE.authors, total: STORE.authors.length });
      let items = [...data.items];
      if (filters.view && filters.view !== 'all') items = items.filter(a => a.status === filters.view);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
      }
      return { items, total: items.length, grandTotal: STORE.authors.length };
    },

    createAuthor(data) {
      const a = {
        avatar: 'https://i.pravatar.cc/100?img=' + Math.floor(Math.random() * 70),
        books: 0,
        followers: '0',
        earnings: '$0',
        status: 'pending',
        joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        ...data,
      };
      STORE.authors.unshift(a);
      _saveStore();
      return _request('/authors', { method: 'POST', body: JSON.stringify(data) }, a);
    },

    updateAuthor(email, data) {
      const a = STORE.authors.find(x => x.email === email);
      if (a) Object.assign(a, data);
      _saveStore();
      return _request(`/authors/${encodeURIComponent(email)}`, { method: 'PATCH', body: JSON.stringify(data) }, { success: true });
    },

    // ═══════════════════════════════════════════════════════
    // CONTRACTS
    // ═══════════════════════════════════════════════════════
    async getContracts(filters = {}) {
      const data = await _request('/contracts', {}, { items: STORE.contracts, total: STORE.contracts.length });
      let items = [...data.items];
      if (filters.view && filters.view !== 'all') items = items.filter(c => c.status === filters.view);
      if (filters.status && filters.status !== 'all') items = items.filter(c => c.status === filters.status);
      if (filters.type && filters.type !== 'All Types') items = items.filter(c => c.type === filters.type);
      if (filters.editor && filters.editor !== 'All Editors') items = items.filter(c => c.editor === filters.editor);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(c => c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.author.toLowerCase().includes(q));
      }
      return { items, total: items.length, grandTotal: STORE.contracts.length };
    },

    createContract(data) {
      const c = {
        id: 'CNTR-2026-' + Math.floor(10000 + Math.random() * 90000),
        status: 'pending',
        effective: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        expiry: '—',
        cover: IMG_LIST[Math.floor(Math.random() * IMG_LIST.length)],
        editorAvatar: 'https://i.pravatar.cc/100?img=47',
        ...data,
      };
      STORE.contracts.unshift(c);
      _saveStore();
      return _request('/contracts', { method: 'POST', body: JSON.stringify(data) }, c);
    },

    // ═══════════════════════════════════════════════════════
    // WITHDRAWALS
    // ═══════════════════════════════════════════════════════
    async getWithdrawals(filters = {}) {
      const data = await _request('/withdrawals', {}, { items: STORE.withdrawals, total: STORE.withdrawals.length });
      let items = [...data.items];
      if (filters.view && filters.view !== 'all') items = items.filter(w => w.status === filters.view);
      if (filters.status && filters.status !== 'all') items = items.filter(w => w.status === filters.status);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(w => w.id.toLowerCase().includes(q) || w.author.toLowerCase().includes(q) || w.amount.toLowerCase().includes(q));
      }
      return { items, total: items.length, grandTotal: STORE.withdrawals.length };
    },

    approveWithdrawal(id, ref = 'TXN-998822') {
      const w = STORE.withdrawals.find(w => w.id === id);
      if (w) {
        w.status = 'completed';
        w.processed = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      }
      _saveStore();
      return _request(`/withdrawals/${id}/approve`, { method: 'POST', body: JSON.stringify({ ref }) }, { success: true, id, status: 'completed' });
    },

    rejectWithdrawal(id, reason = '') {
      const w = STORE.withdrawals.find(w => w.id === id);
      if (w) {
        w.status = 'rejected';
        w.processed = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      }
      _saveStore();
      return _request(`/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }, { success: true, id, status: 'rejected' });
    },

    // ═══════════════════════════════════════════════════════
    // REPORTS
    // ═══════════════════════════════════════════════════════
    async getReports(filters = {}) {
      const data = await _request('/reports', {}, { items: STORE.reports, total: STORE.reports.length });
      let items = [...data.items];
      if (filters.view && filters.view !== 'all') items = items.filter(r => r.status === filters.view);
      if (filters.status && filters.status !== 'all') items = items.filter(r => r.status === filters.status);
      if (filters.type && filters.type !== 'all') items = items.filter(r => r.type === filters.type);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(r => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.reporter.toLowerCase().includes(q));
      }
      return { items, total: items.length, grandTotal: STORE.reports.length };
    },

    resolveReport(id) {
      const r = STORE.reports.find(r => r.id === id);
      if (r) r.status = 'resolved';
      _saveStore();
      return _request(`/reports/${id}/resolve`, { method: 'POST' }, { success: true, id, status: 'resolved' });
    },

    dismissReport(id) {
      const r = STORE.reports.find(r => r.id === id);
      if (r) r.status = 'dismissed';
      _saveStore();
      return _request(`/reports/${id}/dismiss`, { method: 'POST' }, { success: true, id, status: 'dismissed' });
    },

    // ═══════════════════════════════════════════════════════
    // CATEGORIES & GENRES
    // ═══════════════════════════════════════════════════════
    getCategories() {
      return _request('/categories', {}, { categories: STORE.categories });
    },

    createCategory(data) {
      const cat = {
        genres: 0,
        books: '0',
        status: 'active',
        bg: '#ffe1eb',
        color: '#ff0050',
        icon: 'fa-tag',
        ...data,
      };
      STORE.categories.unshift(cat);
      _saveStore();
      return _request('/categories', { method: 'POST', body: JSON.stringify(data) }, cat);
    },

    deleteCategory(name) {
      STORE.categories = STORE.categories.filter(c => c.name !== name);
      _saveStore();
      return _request(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }, { success: true });
    },

    getGenres() {
      return _request('/genres', {}, { genres: STORE.genres });
    },

    createGenre(data) {
      const g = {
        books: '0',
        status: 'active',
        bg: '#e3ecfd',
        color: '#2f7de1',
        icon: 'fa-bookmark',
        ...data,
      };
      STORE.genres.unshift(g);
      _saveStore();
      return _request('/genres', { method: 'POST', body: JSON.stringify(data) }, g);
    },

    deleteGenre(name) {
      STORE.genres = STORE.genres.filter(g => g.name !== name);
      _saveStore();
      return _request(`/genres/${encodeURIComponent(name)}`, { method: 'DELETE' }, { success: true });
    },

    // ═══════════════════════════════════════════════════════
    // PROMOTIONS & BANNERS & ANNOUNCEMENTS
    // ═══════════════════════════════════════════════════════
    getPromotions() {
      return _request('/promotions', {}, STORE.promotions);
    },
    createPromotion(data) {
      const p = {
        id: 'PRM-' + Math.floor(100 + Math.random() * 900),
        status: 'active',
        clicks: '0',
        ...data,
      };
      STORE.promotions.unshift(p);
      _saveStore();
      return _request('/promotions', { method: 'POST', body: JSON.stringify(data) }, p);
    },
    endPromotion(id) {
      const p = STORE.promotions.find(x => x.id === id);
      if (p) p.status = 'ended';
      _saveStore();
      return _request(`/promotions/${id}/end`, { method: 'POST' }, { success: true });
    },

    getBanners() {
      return _request('/banners', {}, STORE.banners);
    },
    createBanner(data) {
      const b = {
        id: 'BNR-' + Math.floor(10 + Math.random() * 90),
        status: 'active',
        clicks: '0',
        img: IMG_LIST[Math.floor(Math.random() * IMG_LIST.length)],
        ...data,
      };
      STORE.banners.unshift(b);
      _saveStore();
      return _request('/banners', { method: 'POST', body: JSON.stringify(data) }, b);
    },
    deleteBanner(id) {
      STORE.banners = STORE.banners.filter(b => b.id !== id);
      _saveStore();
      return _request(`/banners/${id}`, { method: 'DELETE' }, { success: true });
    },

    getAnnouncements() {
      return _request('/announcements', {}, STORE.announcements);
    },
    createAnnouncement(data) {
      const a = {
        id: 'ANC-' + Math.floor(10 + Math.random() * 90),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        status: 'published',
        ...data,
      };
      STORE.announcements.unshift(a);
      _saveStore();
      return _request('/announcements', { method: 'POST', body: JSON.stringify(data) }, a);
    },
    deleteAnnouncement(id) {
      STORE.announcements = STORE.announcements.filter(a => a.id !== id);
      _saveStore();
      return _request(`/announcements/${id}`, { method: 'DELETE' }, { success: true });
    },

    // ═══════════════════════════════════════════════════════
    // TEMPLATES & SETTINGS & SYSTEM PAGES
    // ═══════════════════════════════════════════════════════
    getTemplates() {
      return _request('/templates', {}, STORE.templates);
    },
    createTemplate(data) {
      const t = {
        id: 'TPL-' + Math.floor(10 + Math.random() * 90),
        updated: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        status: 'active',
        ...data,
      };
      STORE.templates.unshift(t);
      _saveStore();
      return _request('/templates', { method: 'POST', body: JSON.stringify(data) }, t);
    },

    getSettings() {
      return _request('/settings', {}, STORE.settings);
    },
    saveSettings(data) {
      Object.assign(STORE.settings, data);
      _saveStore();
      return _request('/settings', { method: 'POST', body: JSON.stringify(data) }, { success: true });
    },

    getSystemPages() {
      return _request('/system-pages', {}, STORE.systemPages);
    },
    updateSystemPage(key, data) {
      const p = STORE.systemPages.find(x => x.key === key);
      if (p) {
        Object.assign(p, data);
        p.updated = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      }
      _saveStore();
      return _request(`/system-pages/${key}`, { method: 'PATCH', body: JSON.stringify(data) }, { success: true });
    },

    // ═══════════════════════════════════════════════════════
    // NOTIFICATIONS & LOGS & MESSAGES & VERIFICATIONS
    // ═══════════════════════════════════════════════════════
    async getNotifications(filters = {}) {
      return _request('/notifications', {}, { items: STORE.notifications, unreadCount: STORE.notifications.filter(n => n.unread).length, total: STORE.notifications.length });
    },
    markAllRead() {
      STORE.notifications.forEach(n => n.unread = false);
      _saveStore();
      return _request('/notifications/mark-read', { method: 'POST' }, { success: true });
    },

    async getActivityLogs(filters = {}) {
      let items = [...STORE.logs];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(l => l.user.toLowerCase().includes(q) || l.action.toLowerCase().includes(q));
      }
      return _request('/logs', {}, { items, total: items.length });
    },

    getMessages() {
      return _request('/messages', {}, STORE.messages);
    },
    sendMessage(data) {
      const msg = {
        id: STORE.messages.length + 1,
        time: 'Just now',
        status: 'sent',
        ...data,
      };
      STORE.messages.unshift(msg);
      _saveStore();
      return _request('/messages', { method: 'POST', body: JSON.stringify(data) }, msg);
    },

    getVerifications() {
      return _request('/verifications', {}, STORE.verifications);
    },
    approveVerification(id) {
      const v = STORE.verifications.find(x => x.id === id);
      if (v) v.status = 'approved';
      _saveStore();
      return _request(`/verifications/${id}/approve`, { method: 'POST' }, { success: true });
    },
    rejectVerification(id) {
      const v = STORE.verifications.find(x => x.id === id);
      if (v) v.status = 'rejected';
      _saveStore();
      return _request(`/verifications/${id}/reject`, { method: 'POST' }, { success: true });
    },
  };

  // ── Shared Modal System ────────────────────────────────────
  if (!window.DroboardModal) {
    window.DroboardModal = {
      _stack: [],
      show(html, opts = {}) {
        const overlay = document.createElement('div');
        overlay.className = 'drm-overlay';
        overlay.innerHTML = `<div class="drm-backdrop"></div><div class="drm-panel">${html}</div>`;
        document.body.appendChild(overlay);
        if (opts.width) overlay.querySelector('.drm-panel').style.maxWidth = opts.width;
        requestAnimationFrame(() => overlay.classList.add('open'));
        overlay.querySelector('.drm-backdrop').addEventListener('click', () => this.close(overlay));
        this._stack.push(overlay);
        return overlay;
      },
      close(overlay) {
        if (!overlay) overlay = this._stack.pop();
        if (!overlay) return;
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 250);
      },
      closeTop() { this.close(this._stack[this._stack.length - 1]); },
      confirm(msg, title = 'Confirm') {
        return new Promise(resolve => {
          const overlay = this.show(`<div class="drm-confirm"><h3>${title}</h3><p>${msg}</p><div class="drm-confirm-actions"><button class="drm-btn drm-cancel" data-act="cancel">Cancel</button><button class="drm-btn drm-ok" data-act="ok">OK</button></div></div>`, { width: '380px' });
          overlay.querySelector('.drm-cancel').addEventListener('click', () => { this.close(overlay); resolve(false); });
          overlay.querySelector('.drm-ok').addEventListener('click', () => { this.close(overlay); resolve(true); });
        });
      },
    };
    const s = document.createElement('style');
    s.textContent = `.drm-overlay{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;visibility:hidden;transition:.25s}.drm-overlay.open{opacity:1;visibility:visible}.drm-backdrop{position:absolute;inset:0;background:rgba(10,6,25,.65);backdrop-filter:blur(4px)}.drm-panel{position:relative;width:100%;max-width:520px;max-height:86vh;overflow-y:auto;background:var(--card);border:1px solid var(--border);border-radius:20px;box-shadow:0 12px 48px rgba(0,0,0,.4);padding:24px;transform:translateY(20px);transition:transform .25s}.drm-overlay.open .drm-panel{transform:translateY(0)}.drm-panel h2{font-size:16px;font-weight:800;margin-bottom:4px;color:var(--text)}.drm-panel .sub{font-size:12px;color:var(--text-muted);margin-bottom:16px}.drm-confirm{text-align:center;padding:10px 0}.drm-confirm h3{font-size:15px;font-weight:800;margin-bottom:8px;color:var(--text)}.drm-confirm p{font-size:13px;color:var(--text-muted);margin-bottom:20px}.drm-confirm-actions{display:flex;gap:10px;justify-content:center}.drm-btn{padding:10px 24px;border-radius:10px;font-size:12.5px;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:.15s}.drm-cancel{background:var(--input-bg);color:var(--text);border:1px solid var(--input-border)}.drm-ok{background:var(--accent);color:#fff}.drm-form-group{margin-bottom:14px}.drm-form-group label{display:block;font-size:11.5px;font-weight:700;color:var(--text);margin-bottom:5px}.drm-form-group input,.drm-form-group select,.drm-form-group textarea{width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:9px;padding:9px 12px;font-size:12.5px;color:var(--text);font-family:inherit;outline:none}.drm-form-group input:focus,.drm-form-group select:focus,.drm-form-group textarea:focus{border-color:var(--accent)}.drm-form-group textarea{resize:vertical;min-height:70px}.drm-form-actions{display:flex;gap:10px;margin-top:18px;justify-content:flex-end}`;
    document.head.appendChild(s);
  }
})();