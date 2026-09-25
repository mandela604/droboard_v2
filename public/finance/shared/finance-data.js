/**
 * finance-data.js — Data layer for Finance pages.
 * ──────────────────────────────────────────────────────────────
 * Every function tries the real backend first and falls back to
 * demo data. Set window.DROBOARD_API_BASE to switch to production.
 */
(function () {
  'use strict';
  if (window.__financeData) return;
  window.__financeData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/finance';
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
      pendingPayoutsCount: 9,
      pendingPayoutsTotal: '$14,860',
      totalVolumeMonth: '$182,400',
      coinBalance: '4.2M',
      openDisputes: 4,
      quickActions: [
        { label:'Review Withdrawals',       icon:'fa-building-columns',  cls:'blue',   count:9,  href:'withdrawals.html' },
        { label:'Process Author Payments',  icon:'fa-money-check-dollar',cls:'accent', href:'author-payments.html' },
        { label:'Resolve Payment Disputes', icon:'fa-scale-balanced',    cls:'red',    count:4,  href:'payment-disputes.html' },
        { label:'Generate Financial Report',icon:'fa-chart-pie',         cls:'purple', href:'financial-reports.html' },
      ],
      pendingPayouts: [
        { id:'WD-501', author:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', amount:'$2,140', method:'Bank Transfer', requested:'3h ago' },
        { id:'WD-502', author:'Elena Vasquez',   avatar:'https://i.pravatar.cc/60?img=31', amount:'$980',   method:'PayPal',        requested:'6h ago' },
        { id:'WD-503', author:'Luna Skye',       avatar:'https://i.pravatar.cc/60?img=24', amount:'$1,510', method:'Bank Transfer', requested:'8h ago' },
        { id:'WD-504', author:'Wren Okonkwo',    avatar:'https://i.pravatar.cc/60?img=41', amount:'$640',   method:'PayPal',        requested:'1d ago' },
      ],
      coinSnapshot:{ purchasedToday:'$3,240', coinsInCirculation:'4.2M', redeemedToday:'182K', avgPurchase:'$18.50' },
      disputesSnapshot:{ open:4, urgent:1, avgResolutionDays:1.8, resolvedThisWeek:6 },
      recentActivity: [
        { icon:'fa-money-check-dollar', color:'green', text:'Payout of $2,140 approved for <b>Isabelle Moreau</b>', time:'25m ago' },
        { icon:'fa-coins',   color:'amber',  text:'Coin package purchase spike — $3,240 processed today', time:'1h ago' },
        { icon:'fa-scale-balanced', color:'red', text:'<b>Marcus Webb Jr.</b> disputed a delayed royalty payment', time:'3h ago' },
        { icon:'fa-building-columns', color:'blue', text:'9 withdrawal requests queued for review', time:'4h ago' },
        { icon:'fa-gift',    color:'purple', text:'Monthly bonus batch scheduled for top 20 authors', time:'6h ago' },
        { icon:'fa-file-invoice-dollar', color:'accent', text:'Q2 tax withholding report generated', time:'1d ago' },
      ],
    },

    withdrawals: [
      { id:'WD-501', author:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', amount:2140, method:'Bank Transfer', account:'GTBank •••• 4821', requested:'2026-07-29T09:10:00', status:'pending', note:'' },
      { id:'WD-502', author:'Elena Vasquez',   avatar:'https://i.pravatar.cc/60?img=31', amount:980,  method:'PayPal',        account:'elena.v@paypal.com', requested:'2026-07-29T06:40:00', status:'pending', note:'' },
      { id:'WD-503', author:'Luna Skye',       avatar:'https://i.pravatar.cc/60?img=24', amount:1510, method:'Bank Transfer', account:'Access Bank •••• 7793', requested:'2026-07-29T04:05:00', status:'pending', note:'' },
      { id:'WD-504', author:'Wren Okonkwo',    avatar:'https://i.pravatar.cc/60?img=41', amount:640,  method:'PayPal',        account:'wren.o@paypal.com', requested:'2026-07-28T15:20:00', status:'pending', note:'' },
      { id:'WD-505', author:'Ifeanyi_Story',   avatar:'https://i.pravatar.cc/60?img=8',  amount:2975, method:'Bank Transfer', account:'Zenith Bank •••• 3310', requested:'2026-07-28T11:00:00', status:'pending', note:'' },
      { id:'WD-506', author:'Sophia Bennett',  avatar:'https://i.pravatar.cc/100?img=48',amount:3200, method:'Wire Transfer', account:'Chase •••• 9012', requested:'2026-07-27T18:30:00', status:'approved', note:'', processed:'2026-07-27T20:15:00' },
      { id:'WD-507', author:'Daniel Carter',   avatar:'https://i.pravatar.cc/100?img=13',amount:1200, method:'Bank Transfer', account:'UBA •••• 5567', requested:'2026-07-27T09:45:00', status:'approved', note:'', processed:'2026-07-27T14:00:00' },
      { id:'WD-508', author:'Marcus Webb Jr.', avatar:'https://i.pravatar.cc/60?img=12', amount:410,  method:'PayPal',        account:'marcuswebb@paypal.com', requested:'2026-07-26T13:10:00', status:'declined', note:'Account name mismatch with registered payee — please update payout details.', processed:'2026-07-26T16:40:00' },
      { id:'WD-509', author:'Zara_M',          avatar:'https://i.pravatar.cc/60?img=36', amount:75,   method:'PayPal',        account:'zara.m@paypal.com', requested:'2026-07-25T10:05:00', status:'declined', note:'Below the $100 minimum withdrawal threshold.', processed:'2026-07-25T11:20:00' },
      { id:'WD-510', author:'Chioma Reddy',    avatar:'https://i.pravatar.cc/100?img=5', amount:3200, method:'Wire Transfer', account:'GTBank •••• 1189', requested:'2026-07-24T08:00:00', status:'approved', note:'', processed:'2026-07-24T12:30:00' },
    ],

    authorPayments: [
      { id:'AU-01', author:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', totalEarned:24800, pendingPayout:2140, method:'Bank Transfer', status:'active', lastPayout:'2026-07-15', lastAmount:1980, nextScheduled:'2026-07-31' },
      { id:'AU-02', author:'Elena Vasquez',   avatar:'https://i.pravatar.cc/60?img=31', totalEarned:11200, pendingPayout:980,  method:'PayPal',        status:'active', lastPayout:'2026-07-15', lastAmount:870,  nextScheduled:'2026-07-31' },
      { id:'AU-03', author:'Luna Skye',       avatar:'https://i.pravatar.cc/60?img=24', totalEarned:18650, pendingPayout:1510, method:'Bank Transfer', status:'active', lastPayout:'2026-07-15', lastAmount:1420, nextScheduled:'2026-07-31' },
      { id:'AU-04', author:'Wren Okonkwo',    avatar:'https://i.pravatar.cc/60?img=41', totalEarned:6300,  pendingPayout:640,  method:'PayPal',        status:'active', lastPayout:'2026-07-15', lastAmount:590,  nextScheduled:'2026-07-31' },
      { id:'AU-05', author:'Ifeanyi_Story',   avatar:'https://i.pravatar.cc/60?img=8',  totalEarned:31900, pendingPayout:2975, method:'Bank Transfer', status:'active', lastPayout:'2026-07-15', lastAmount:2610, nextScheduled:'2026-07-31' },
      { id:'AU-06', author:'Sophia Bennett',  avatar:'https://i.pravatar.cc/100?img=48',totalEarned:42500, pendingPayout:0,    method:'Wire Transfer', status:'active', lastPayout:'2026-07-27', lastAmount:3200, nextScheduled:'2026-08-15' },
      { id:'AU-07', author:'Daniel Carter',   avatar:'https://i.pravatar.cc/100?img=13',totalEarned:19700, pendingPayout:0,    method:'Bank Transfer', status:'active', lastPayout:'2026-07-27', lastAmount:1200, nextScheduled:'2026-08-15' },
      { id:'AU-08', author:'Marcus Webb Jr.', avatar:'https://i.pravatar.cc/60?img=12', totalEarned:2100,  pendingPayout:0,    method:'PayPal',        status:'on-hold', lastPayout:'2026-06-30', lastAmount:410, nextScheduled:null, holdReason:'Payout details under review after a declined withdrawal.' },
      { id:'AU-09', author:'Zara_M',          avatar:'https://i.pravatar.cc/60?img=36', totalEarned:540,   pendingPayout:0,    method:'PayPal',        status:'on-hold', lastPayout:null, lastAmount:0, nextScheduled:null, holdReason:'Account under review for a reader complaint.' },
      { id:'AU-10', author:'Chioma Reddy',    avatar:'https://i.pravatar.cc/100?img=5', totalEarned:38900, pendingPayout:0,    method:'Wire Transfer', status:'active', lastPayout:'2026-07-24', lastAmount:3200, nextScheduled:'2026-08-15' },
    ],
    paymentHistory: [
      { id:'PH-9001', author:'Sophia Bennett', avatar:'https://i.pravatar.cc/100?img=48', amount:3200, method:'Wire Transfer', date:'2026-07-27T20:15:00', status:'completed', reference:'TXN-88213' },
      { id:'PH-9002', author:'Daniel Carter',  avatar:'https://i.pravatar.cc/100?img=13', amount:1200, method:'Bank Transfer', date:'2026-07-27T14:00:00', status:'completed', reference:'TXN-88190' },
      { id:'PH-9003', author:'Chioma Reddy',   avatar:'https://i.pravatar.cc/100?img=5',  amount:3200, method:'Wire Transfer', date:'2026-07-24T12:30:00', status:'completed', reference:'TXN-88044' },
      { id:'PH-9004', author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/60?img=44',  amount:1980, method:'Bank Transfer', date:'2026-07-15T10:00:00', status:'completed', reference:'TXN-87510' },
      { id:'PH-9005', author:'Elena Vasquez',  avatar:'https://i.pravatar.cc/60?img=31',  amount:870,  method:'PayPal',        date:'2026-07-15T10:00:00', status:'completed', reference:'TXN-87511' },
      { id:'PH-9006', author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/60?img=12',  amount:410,  method:'PayPal',        date:'2026-06-30T09:00:00', status:'failed', reference:'TXN-86220', failReason:'Recipient account mismatch' },
    ],

    coinTransactions: [
      { id:'CT-2001', user:'Reader_Amara',  avatar:'https://i.pravatar.cc/60?img=15', type:'purchase', coins:5000,  usd:49.99, date:'2026-07-29T08:30:00', status:'completed' },
      { id:'CT-2002', user:'Tobi_Reads',    avatar:'https://i.pravatar.cc/60?img=22', type:'purchase', coins:1000,  usd:9.99,  date:'2026-07-29T07:15:00', status:'completed' },
      { id:'CT-2003', user:'NovelFan_92',   avatar:'https://i.pravatar.cc/60?img=27', type:'purchase', coins:12000, usd:99.99, date:'2026-07-28T21:10:00', status:'completed' },
      { id:'CT-2004', user:'DeeReadsAlot',  avatar:'https://i.pravatar.cc/60?img=19', type:'purchase', coins:1000,  usd:9.99,  date:'2026-07-28T15:40:00', status:'refunded', note:'Duplicate charge' },
      { id:'CT-2005', user:'NovelFan_92',   avatar:'https://i.pravatar.cc/60?img=27', type:'purchase', coins:5000,  usd:49.99, date:'2026-07-27T20:00:00', status:'completed' },
      { id:'CT-2006', user:'Reader_Amara',  avatar:'https://i.pravatar.cc/60?img=15', type:'gift',     coins:-500,  usd:-4.99, date:'2026-07-28T18:00:00', status:'completed', note:'Gifted to Luna Skye' },
      { id:'CT-2007', user:'ChiomaReddy',   avatar:'https://i.pravatar.cc/60?img=5',  type:'purchase', coins:3000,  usd:29.99, date:'2026-07-27T14:20:00', status:'completed' },
      { id:'CT-2008', user:'Ifeanyi_Story', avatar:'https://i.pravatar.cc/60?img=8',  type:'purchase', coins:8000,  usd:79.99, date:'2026-07-26T19:00:00', status:'completed' },
      { id:'CT-2009', user:'SophiaBennett', avatar:'https://i.pravatar.cc/60?img=48', type:'purchase', coins:1000,  usd:9.99,  date:'2026-07-26T11:30:00', status:'completed' },
      { id:'CT-2010', user:'Tobi_Reads',    avatar:'https://i.pravatar.cc/60?img=22', type:'gift',     coins:-200,  usd:-1.99, date:'2026-07-25T16:45:00', status:'completed', note:'Gifted to Wren Okonkwo' },
      { id:'CT-2011', user:'DanielCarter',  avatar:'https://i.pravatar.cc/60?img=13', type:'purchase', coins:5000,  usd:49.99, date:'2026-07-25T09:10:00', status:'completed' },
      { id:'CT-2012', user:'ElenaVasquez',  avatar:'https://i.pravatar.cc/60?img=31', type:'purchase', coins:2000,  usd:19.99, date:'2026-07-24T20:00:00', status:'refunded', note:'Accidental purchase' },
      { id:'CT-2013', user:'Reader_Amara',  avatar:'https://i.pravatar.cc/60?img=15', type:'purchase', coins:1000,  usd:9.99,  date:'2026-07-24T14:30:00', status:'completed' },
      { id:'CT-2014', user:'LunaSkye',      avatar:'https://i.pravatar.cc/60?img=24', type:'gift',     coins:-100,  usd:-0.99, date:'2026-07-23T12:00:00', status:'completed', note:'Gifted to Reader_Amara' },
    ],

    bonuses: [
      { id:'BN-01', name:'July Top Performer Bonus',  type:'Performance', criteria:'Top 10 authors by reads this month', recipients:10, amountEach:200,  status:'distributed', date:'2026-07-31', createdBy:'Ngozi Falade' },
      { id:'BN-02', name:'100K Reads Milestone',       type:'Milestone',   criteria:'Any story crossing 100,000 reads',    recipients:4,  amountEach:150,  status:'distributed', date:'2026-07-20', createdBy:'Ngozi Falade' },
      { id:'BN-03', name:'New Author Welcome Bonus',   type:'Onboarding',  criteria:'Authors who published their first story this month', recipients:18, amountEach:25, status:'scheduled', date:'2026-08-01', createdBy:'Tari Benson' },
      { id:'BN-04', name:'Summer Romance Contest Prize',type:'Contest',    criteria:'Top 3 entries in Summer Romance Writing Contest',  recipients:3,  amountEach:1500, status:'draft',     date:'2026-08-10', createdBy:'Tari Benson' },
      { id:'BN-05', name:'Inner Circle Loyalty Bonus', type:'Loyalty',     criteria:'Authors with 6+ months of Inner Circle subscribers', recipients:7,  amountEach:100,  status:'scheduled', date:'2026-08-05', createdBy:'Ngozi Falade' },
    ],

    paymentDisputes: [
      { id:'PD-301', author:'Marcus Webb Jr.', avatar:'https://i.pravatar.cc/60?img=12', amount:410,  reason:'Payout declined but coins were already deducted from reader balance.', status:'open',         filed:'2026-07-28T10:00:00', resolutionNote:'', replies:[
        { from:'Ngozi Falade', message:'Hi Marcus, we are reviewing your account transaction logs. Will update you within 24 hours.', time:'2026-07-28T14:30:00' }
      ] },
      { id:'PD-302', author:'Ada_Writes',     avatar:'https://i.pravatar.cc/60?img=52', amount:1200, reason:'Royalty calculation seems lower than expected reads for June.',       status:'investigating', filed:'2026-07-26T14:30:00', resolutionNote:'', replies:[] },
      { id:'PD-303', author:'Efe_O',          avatar:'https://i.pravatar.cc/60?img=17', amount:75,   reason:'Withdrawal declined for being under minimum, but threshold was not clearly stated.', status:'open', filed:'2026-07-25T09:15:00', resolutionNote:'', replies:[] },
      { id:'PD-304', author:'Wren Okonkwo',   avatar:'https://i.pravatar.cc/60?img=41', amount:300,  reason:'Missing tip earnings from July 10–12.',                            status:'resolved', filed:'2026-07-14T11:00:00', resolutionNote:'Verified and credited missing tips of $300 on Jul 16.', replies:[
        { from:'Ngozi Falade', message:'Hi Wren, we found the discrepancy in the tip aggregation pipeline. $300 has been credited to your account.', time:'2026-07-16T09:00:00' }
      ] },
      { id:'PD-305', author:'Zara_M',         avatar:'https://i.pravatar.cc/60?img=36', amount:50,   reason:'Disputes a coin refund deducted from author earnings.',              status:'rejected', filed:'2026-07-10T08:20:00', resolutionNote:'Refund was reader-initiated within policy window; deduction stands.', replies:[] },
      { id:'PD-306', author:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', amount:850,  reason:'Bonus payout for June was not received despite meeting all criteria.', status:'open', filed:'2026-07-29T08:00:00', resolutionNote:'', replies:[] },
      { id:'PD-307', author:'Luna Skye',       avatar:'https://i.pravatar.cc/60?img=24', amount:220,  reason:'Coin tip from a reader shows as pending but reader was charged.',    status:'investigating', filed:'2026-07-27T16:45:00', resolutionNote:'', replies:[] },
      { id:'PD-308', author:'Daniel Carter',   avatar:'https://i.pravatar.cc/100?img=13', amount:1500, reason:'Royalty rate applied was 60% instead of agreed 70% for new releases.', status:'open', filed:'2026-07-29T11:20:00', resolutionNote:'', replies:[] },
      { id:'PD-309', author:'Chioma Reddy',    avatar:'https://i.pravatar.cc/100?img=5',  amount:340,  reason:'Subscription revenue share not reflected in last payout.',          status:'resolved', filed:'2026-07-20T10:00:00', resolutionNote:'Subscription revenue of $340 has been added to your next payout.', replies:[
        { from:'Ngozi Falade', message:'Hi Chioma, we confirmed the subscription revenue was missing from the aggregation. $340 added.', time:'2026-07-22T09:00:00' }
      ] },
      { id:'PD-310', author:'Ifeanyi_Story',   avatar:'https://i.pravatar.cc/60?img=8',  amount:600,  reason:'Promotional campaign earnings not showing in dashboard.',           status:'investigating', filed:'2026-07-25T13:10:00', resolutionNote:'', replies:[] },
      { id:'PD-311', author:'Sophia Bennett',  avatar:'https://i.pravatar.cc/100?img=48', amount:95,   reason:'Withdrawal processed but funds not received in bank account.',      status:'rejected', filed:'2026-07-18T09:30:00', resolutionNote:'Bank confirmed receipt on Jul 19. Please check with your bank.', replies:[] },
      { id:'PD-312', author:'Elena Vasquez',   avatar:'https://i.pravatar.cc/60?img=31', amount:180,  reason:'Coins redeemed for gift but gift was not delivered to recipient.',  status:'open', filed:'2026-07-29T14:00:00', resolutionNote:'', replies:[] },
    ],

    financialReports: {
      summary: { totalRevenue:182400, totalPayouts:96200, platformIncome:86200, coinSalesRevenue:142300, growthVsLastMonth:8.4 },
      monthlyRevenue: [
        { month:'Feb', revenue:128000 }, { month:'Mar', revenue:141500 }, { month:'Apr', revenue:135800 },
        { month:'May', revenue:158200 }, { month:'Jun', revenue:168900 }, { month:'Jul', revenue:182400 },
      ],
      expenseBreakdown: [
        { label:'Author Payouts',          amount:96200, color:'accent' },
        { label:'Payment Processing Fees', amount:5460,  color:'blue' },
        { label:'Bonuses & Incentives',    amount:4200,  color:'purple' },
        { label:'Marketing Spend',         amount:12800, color:'amber' },
        { label:'Infrastructure',          amount:7100,  color:'green' },
      ],
      topCategories: [
        { genre:'Romance & Betrayal',  revenue:41200 },
        { genre:'Werewolf & Fantasy',  revenue:33800 },
        { genre:'Billionaire & CEO',   revenue:28900 },
        { genre:'Mafia & Urban',       revenue:22100 },
        { genre:'Historical & Regency',revenue:15600 },
      ],
    },

    taxDocuments: [
      { id:'TX-01', author:'Sophia Bennett',  avatar:'https://i.pravatar.cc/100?img=48', docType:'1099-NEC',              period:'2025 Tax Year', amount:38400, status:'issued', issuedDate:'2026-01-31' },
      { id:'TX-02', author:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44',  docType:'1099-NEC',              period:'2025 Tax Year', amount:21200, status:'issued', issuedDate:'2026-01-31' },
      { id:'TX-03', author:'Ifeanyi_Story',   avatar:'https://i.pravatar.cc/60?img=8',   docType:'1099-NEC',              period:'2025 Tax Year', amount:27600, status:'pending',issuedDate:null },
      { id:'TX-04', author:'Daniel Carter',   avatar:'https://i.pravatar.cc/100?img=13', docType:'Withholding Statement', period:'Q2 2026',        amount:1980,  status:'issued', issuedDate:'2026-07-05' },
      { id:'TX-05', author:'Chioma Reddy',    avatar:'https://i.pravatar.cc/100?img=5',  docType:'Withholding Statement', period:'Q2 2026',        amount:2340,  status:'issued', issuedDate:'2026-07-05' },
      { id:'TX-06', author:'Elena Vasquez',   avatar:'https://i.pravatar.cc/60?img=31',  docType:'Receipt',               period:'Jul 2026',       amount:870,   status:'issued', issuedDate:'2026-07-15' },
    ],

    /* ── Store: Coin Packs & Earn Coins (managed by Finance, consumed by Store) ── */
    coinPacks: [
      { id:'pack1', coins:100, price:'$0.99', badge:'', color:'#635F6E' },
      { id:'pack2', coins:500, price:'$3.99', badge:'Popular', color:'#FF2D6A' },
      { id:'pack3', coins:1200, price:'$7.99', badge:'Best Value', color:'#D6165A' },
      { id:'pack4', coins:2500, price:'$14.99', badge:'', color:'#16A34A' },
    ],
    adRewards: [
      { id:'ad1', action:'Watch Ad', coins:10, cooldown:'5 min', icon:'fa-film', available:true, type:'watch_ad' },
      { id:'ad2', action:'Daily Check-in', coins:25, cooldown:'24 hr', icon:'fa-calendar-check', available:true, type:'checkin' },
      { id:'ad3', action:'Rate Story', coins:5, cooldown:'1 hr', icon:'fa-star', available:true, type:'rate' },
      { id:'ad4', action:'Share Story', coins:15, cooldown:'2 hr', icon:'fa-share-nodes', available:true, type:'share' },
      { id:'ad5', action:'Read Blog — Tech Niche (3 pages)', coins:25, cooldown:'24 hr', icon:'fa-microchip', available:true, type:'blog_read', pagesRequired:3, blogCategory:'tech', blogUrl:'Pages/blog.html?cat=tech' },
      { id:'ad8', action:'Read Blog — Health Niche (3 pages)', coins:25, cooldown:'24 hr', icon:'fa-heart-pulse', available:true, type:'blog_read', pagesRequired:3, blogCategory:'health', blogUrl:'Pages/blog.html?cat=health' },
      { id:'ad6', action:'Subscribe on YouTube', coins:30, cooldown:'30d', icon:'fa-youtube', available:true, type:'youtube_sub', channelId:'UCxxxxDroboard', channelUrl:'https://youtube.com/@droboard?sub_confirmation=1' },
      { id:'ad7', action:'Watch YouTube Video', coins:15, cooldown:'24 hr', icon:'fa-circle-play', available:true, type:'youtube_watch', videoId:'dQw4w9WgXcQ', minWatchSec:60 },
    ],
    bundles: [
      { id:'b1', name:'Starter Bundle', coins:500, bonus:50, price:'$3.99', icon:'fa-seedling', color:'#22c55e' },
      { id:'b2', name:'Pro Bundle', coins:1500, bonus:300, price:'$9.99', icon:'fa-fire', color:'#FF2D6A' },
      { id:'b3', name:'Elite Bundle', coins:5000, bonus:1500, price:'$29.99', icon:'fa-crown', color:'#D6165A' },
    ],
  };

  /* ── Finance-managed Store overrides (localStorage, like marketing ads) ── */
  const FIN_PACKS_KEY = 'dro_finance_packs';
  const FIN_REWARDS_KEY = 'dro_finance_rewards';
  const FIN_BUNDLES_KEY = 'dro_finance_bundles';
  function readStoredPacks(){ try{ const v=JSON.parse(localStorage.getItem(FIN_PACKS_KEY)||'null'); return Array.isArray(v)?v:null; }catch(e){ return null; } }
  function writeStoredPacks(v){ try{ localStorage.setItem(FIN_PACKS_KEY, JSON.stringify(v)); }catch(e){} }
  function readStoredRewards(){ try{ const v=JSON.parse(localStorage.getItem(FIN_REWARDS_KEY)||'null'); return Array.isArray(v)?v:null; }catch(e){ return null; } }
  function writeStoredRewards(v){ try{ localStorage.setItem(FIN_REWARDS_KEY, JSON.stringify(v)); }catch(e){} }
  function readStoredBundles(){ try{ const v=JSON.parse(localStorage.getItem(FIN_BUNDLES_KEY)||'null'); return Array.isArray(v)?v:null; }catch(e){ return null; } }
  function writeStoredBundles(v){ try{ localStorage.setItem(FIN_BUNDLES_KEY, JSON.stringify(v)); }catch(e){} }
  (function seedFinanceStore(){
    const sp=readStoredPacks(); if(sp) DEMO.coinPacks=sp; else writeStoredPacks(DEMO.coinPacks);
    const sr=readStoredRewards(); if(sr) DEMO.adRewards=sr; else writeStoredRewards(DEMO.adRewards);
    const sb=readStoredBundles(); if(sb) DEMO.bundles=sb; else writeStoredBundles(DEMO.bundles);
  })();

  function findWithdrawal(id) {
    const w = DEMO.withdrawals.find(x => x.id === id);
    if (!w) throw new Error('Withdrawal not found: ' + id);
    return w;
  }
  function findIn(arr, id) {
    const item = arr.find(x => x.id === id);
    if (!item) throw new Error('Not found: ' + id);
    return item;
  }

  window.FinanceData = {
    async getDashboard() {
      try { return await callBackend('/dashboard'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.dashboard)); }
    },

    async getWithdrawals() {
      try { return await callBackend('/withdrawals'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.withdrawals)); }
    },

    async approveWithdrawal(id) {
      try { return await callBackend('/withdrawals/' + id + '/approve', { method: 'POST' }); }
      catch (e) {
        await delay(150);
        const w = findWithdrawal(id);
        w.status = 'approved'; w.note = ''; w.processed = new Date().toISOString();
        return JSON.parse(JSON.stringify(w));
      }
    },

    async declineWithdrawal(id, reason) {
      try { return await callBackend('/withdrawals/' + id + '/decline', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ reason }) }); }
      catch (e) {
        await delay(150);
        const w = findWithdrawal(id);
        w.status = 'declined'; w.note = reason || 'Declined by Finance.'; w.processed = new Date().toISOString();
        return JSON.parse(JSON.stringify(w));
      }
    },

    async getAuthorPayments() {
      try { return await callBackend('/author-payments'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.authorPayments)); }
    },
    async getPaymentHistory() {
      try { return await callBackend('/payment-history'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.paymentHistory)); }
    },
    async schedulePayout(authorId, amount, date) {
      try { return await callBackend('/author-payments/' + authorId + '/schedule', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount, date }) }); }
      catch (e) {
        await delay(150);
        const a = findIn(DEMO.authorPayments, authorId);
        a.nextScheduled = date; a.pendingPayout = amount;
        return JSON.parse(JSON.stringify(a));
      }
    },
    async processPayment(authorId) {
      try { return await callBackend('/author-payments/' + authorId + '/process', { method:'POST' }); }
      catch (e) {
        await delay(150);
        const a = findIn(DEMO.authorPayments, authorId);
        const paid = a.pendingPayout;
        a.lastAmount = paid; a.lastPayout = new Date().toISOString().slice(0,10); a.pendingPayout = 0;
        DEMO.paymentHistory.unshift({ id:'PH-'+Math.floor(Math.random()*9000+1000), author:a.author, avatar:a.avatar, amount:paid, method:a.method, date:new Date().toISOString(), status:'completed', reference:'TXN-'+Math.floor(Math.random()*90000+10000) });
        return JSON.parse(JSON.stringify(a));
      }
    },

    async getCoinTransactions() {
      try { return await callBackend('/coin-transactions'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.coinTransactions)); }
    },

    async getBonuses() {
      try { return await callBackend('/bonuses'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.bonuses)); }
    },
    async createBonus(payload) {
      try { return await callBackend('/bonuses', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }
      catch (e) {
        await delay(150);
        const item = Object.assign({ id:'BN-'+String(DEMO.bonuses.length+1).padStart(2,'0'), status:'draft' }, payload);
        DEMO.bonuses.unshift(item);
        return JSON.parse(JSON.stringify(item));
      }
    },
    async updateBonus(id, payload) {
      try { return await callBackend('/bonuses/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }
      catch (e) { await delay(150); const b = findIn(DEMO.bonuses, id); Object.assign(b, payload); return JSON.parse(JSON.stringify(b)); }
    },
    async deleteBonus(id) {
      try { return await callBackend('/bonuses/' + id, { method:'DELETE' }); }
      catch (e) { await delay(150); DEMO.bonuses = DEMO.bonuses.filter(x => x.id !== id); return { ok:true }; }
    },
    async distributeBonus(id) {
      try { return await callBackend('/bonuses/' + id + '/distribute', { method:'POST' }); }
      catch (e) { await delay(150); const b = findIn(DEMO.bonuses, id); b.status = 'distributed'; return JSON.parse(JSON.stringify(b)); }
    },

    async getPaymentDisputes() {
      try { return await callBackend('/payment-disputes'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.paymentDisputes)); }
    },
    async resolveDispute(id, note) {
      try { return await callBackend('/payment-disputes/' + id + '/resolve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ note }) }); }
      catch (e) { await delay(150); const d = findIn(DEMO.paymentDisputes, id); d.status='resolved'; d.resolutionNote = note || 'Resolved by Finance.'; return JSON.parse(JSON.stringify(d)); }
    },
    async rejectDispute(id, note) {
      try { return await callBackend('/payment-disputes/' + id + '/reject', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ note }) }); }
      catch (e) { await delay(150); const d = findIn(DEMO.paymentDisputes, id); d.status='rejected'; d.resolutionNote = note || 'Rejected by Finance.'; return JSON.parse(JSON.stringify(d)); }
    },
    async replyToDispute(id, message) {
      try { return await callBackend('/payment-disputes/' + id + '/reply', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message }) }); }
      catch (e) {
        await delay(150);
        const d = findIn(DEMO.paymentDisputes, id);
        return JSON.parse(JSON.stringify(d));
      }
    },

    async getFinancialReports() {
      try { return await callBackend('/financial-reports'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.financialReports)); }
    },

    async getTaxDocuments() {
      try { return await callBackend('/tax-documents'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.taxDocuments)); }
    },
    async generateTaxDocument(payload) {
      try { return await callBackend('/tax-documents', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }
      catch (e) {
        await delay(150);
        const item = Object.assign({ id:'TX-'+String(DEMO.taxDocuments.length+1).padStart(2,'0'), status:'issued', issuedDate: new Date().toISOString().slice(0,10) }, payload);
        DEMO.taxDocuments.unshift(item);
        return JSON.parse(JSON.stringify(item));
      }
    },

    /* ── Store settings: Coin Packs ── */
    async getCoinPacks(){
      try{ const d=await callBackend('/store/coin-packs'); return Array.isArray(d)?d:d.packs; }
      catch(e){ await delay(); const sp=readStoredPacks(); if(sp) DEMO.coinPacks=sp; return JSON.parse(JSON.stringify(DEMO.coinPacks)); }
    },
    async saveCoinPack(pack){
      try{ return await callBackend('/store/coin-packs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(pack) }); }
      catch(e){
        await delay(120);
        if(!pack.id) pack.id='pack'+(Date.now().toString(36));
        const idx=DEMO.coinPacks.findIndex(x=>x.id===pack.id);
        if(idx===-1) DEMO.coinPacks.push(pack); else DEMO.coinPacks[idx]=Object.assign({}, DEMO.coinPacks[idx], pack);
        writeStoredPacks(DEMO.coinPacks);
        return JSON.parse(JSON.stringify(pack));
      }
    },
    async deleteCoinPack(id){
      try{ return await callBackend('/store/coin-packs/'+encodeURIComponent(id), { method:'DELETE' }); }
      catch(e){ await delay(120); DEMO.coinPacks=DEMO.coinPacks.filter(x=>x.id!==id); writeStoredPacks(DEMO.coinPacks); return { ok:true }; }
    },

    /* ── Store settings: Earn Coins (Ad Rewards) ── */
    async getAdRewards(){
      try{ const d=await callBackend('/store/ad-rewards'); return Array.isArray(d)?d:d.rewards; }
      catch(e){ await delay(); const sr=readStoredRewards(); if(sr) DEMO.adRewards=sr; return JSON.parse(JSON.stringify(DEMO.adRewards)); }
    },
    async saveAdReward(r){
      try{ return await callBackend('/store/ad-rewards', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(r) }); }
      catch(e){
        await delay(120);
        if(!r.id) r.id='ad'+(Date.now().toString(36));
        const idx=DEMO.adRewards.findIndex(x=>x.id===r.id);
        if(idx===-1) DEMO.adRewards.push(r); else DEMO.adRewards[idx]=Object.assign({}, DEMO.adRewards[idx], r);
        writeStoredRewards(DEMO.adRewards);
        return JSON.parse(JSON.stringify(r));
      }
    },
    async deleteAdReward(id){
      try{ return await callBackend('/store/ad-rewards/'+encodeURIComponent(id), { method:'DELETE' }); }
      catch(e){ await delay(120); DEMO.adRewards=DEMO.adRewards.filter(x=>x.id!==id); writeStoredRewards(DEMO.adRewards); return { ok:true }; }
    },

    /* ── Store settings: Bundles ── */
    async getBundles(){
      try{ const d=await callBackend('/store/bundles'); return Array.isArray(d)?d:d.bundles; }
      catch(e){ await delay(); const sb=readStoredBundles(); if(sb) DEMO.bundles=sb; return JSON.parse(JSON.stringify(DEMO.bundles)); }
    },
    async saveBundle(b){
      try{ return await callBackend('/store/bundles', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(b) }); }
      catch(e){
        await delay(120);
        if(!b.id) b.id='b'+(Date.now().toString(36));
        const idx=DEMO.bundles.findIndex(x=>x.id===b.id);
        if(idx===-1) DEMO.bundles.push(b); else DEMO.bundles[idx]=Object.assign({}, DEMO.bundles[idx], b);
        writeStoredBundles(DEMO.bundles);
        return JSON.parse(JSON.stringify(b));
      }
    },
    async deleteBundle(id){
      try{ return await callBackend('/store/bundles/'+encodeURIComponent(id), { method:'DELETE' }); }
      catch(e){ await delay(120); DEMO.bundles=DEMO.bundles.filter(x=>x.id!==id); writeStoredBundles(DEMO.bundles); return { ok:true }; }
    },
  };
})();
