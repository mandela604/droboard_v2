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
    /* ── Dashboard ── */
    dashboard: {
      pendingPayoutsCount: 9,
      pendingPayoutsTotal: '$14,860',
      totalVolumeMonth: '$182,400',
      coinBalance: '4.2M',
      openDisputes: 4,

      quickActions: [
        { label: 'Review Withdrawals',        icon: 'fa-building-columns', cls: 'blue',   count: 9, href: 'withdrawals.html' },
        { label: 'Process Author Payments',   icon: 'fa-money-check-dollar', cls: 'accent', href: 'author-payments.html' },
        { label: 'Resolve Payment Disputes',  icon: 'fa-scale-balanced',   cls: 'red',    count: 4, href: 'payment-disputes.html' },
        { label: 'Generate Financial Report', icon: 'fa-chart-pie',        cls: 'purple', href: 'financial-reports.html' },
      ],

      /* Withdrawal / payout requests awaiting Finance action */
      pendingPayouts: [
        { id:'WD-501', author:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', amount:'$2,140', method:'Bank Transfer', requested:'3h ago' },
        { id:'WD-502', author:'Elena Vasquez',   avatar:'https://i.pravatar.cc/60?img=31', amount:'$980',   method:'PayPal',        requested:'6h ago' },
        { id:'WD-503', author:'Luna Skye',       avatar:'https://i.pravatar.cc/60?img=24', amount:'$1,510', method:'Bank Transfer', requested:'8h ago' },
        { id:'WD-504', author:'Wren Okonkwo',    avatar:'https://i.pravatar.cc/60?img=41', amount:'$640',   method:'PayPal',        requested:'1d ago' },
      ],

      coinSnapshot: { purchasedToday:'$3,240', coinsInCirculation:'4.2M', redeemedToday:'182K', avgPurchase:'$18.50' },
      disputesSnapshot: { open:4, urgent:1, avgResolutionDays:1.8, resolvedThisWeek:6 },

      recentActivity: [
        { icon:'fa-money-check-dollar', color:'green', text:'Payout of $2,140 approved for <b>Isabelle Moreau</b>', time:'25m ago' },
        { icon:'fa-coins',   color:'amber',  text:'Coin package purchase spike — $3,240 processed today', time:'1h ago' },
        { icon:'fa-scale-balanced', color:'red', text:'<b>Marcus Webb Jr.</b> disputed a delayed royalty payment', time:'3h ago' },
        { icon:'fa-building-columns', color:'blue', text:'9 withdrawal requests queued for review', time:'4h ago' },
        { icon:'fa-gift',    color:'purple', text:'Monthly bonus batch scheduled for top 20 authors', time:'6h ago' },
        { icon:'fa-file-invoice-dollar', color:'accent', text:'Q2 tax withholding report generated', time:'1d ago' },
      ],
    },

    /* ── Withdrawals (full queue) ── */
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

    /* ── Author Payments ── */
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

    /* ── Coin Transactions ── */
    coinTransactions: [
      { id:'CT-2001', user:'Reader_Amara',  avatar:'https://i.pravatar.cc/60?img=15', type:'purchase', coins:5000, usd:49.99, date:'2026-07-29T08:30:00', status:'completed' },
      { id:'CT-2002', user:'Tobi_Reads',    avatar:'https://i.pravatar.cc/60?img=22', type:'purchase', coins:1000, usd:9.99,  date:'2026-07-29T07:15:00', status:'completed' },
      { id:'CT-2003', user:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', type:'spend', coins:-300, usd:-2.99, date:'2026-07-29T06:50:00', status:'completed', note:'Unlocked 3 chapters' },
      { id:'CT-2004', user:'NovelFan_92',   avatar:'https://i.pravatar.cc/60?img=27', type:'purchase', coins:12000, usd:99.99, date:'2026-07-28T21:10:00', status:'completed' },
      { id:'CT-2005', user:'Reader_Amara',  avatar:'https://i.pravatar.cc/60?img=15', type:'gift', coins:-500, usd:-4.99, date:'2026-07-28T18:00:00', status:'completed', note:'Gifted to Luna Skye' },
      { id:'CT-2006', user:'DeeReadsAlot',  avatar:'https://i.pravatar.cc/60?img=19', type:'purchase', coins:1000, usd:9.99,  date:'2026-07-28T15:40:00', status:'refunded', note:'Duplicate charge' },
      { id:'CT-2007', user:'Tobi_Reads',    avatar:'https://i.pravatar.cc/60?img=22', type:'spend', coins:-200, usd:-1.99, date:'2026-07-28T12:05:00', status:'completed', note:'Tipped Wren Okonkwo' },
      { id:'CT-2008', user:'NovelFan_92',   avatar:'https://i.pravatar.cc/60?img=27', type:'purchase', coins:5000, usd:49.99, date:'2026-07-27T20:00:00', status:'completed' },
    ],

    /* ── Bonuses ── */
    bonuses: [
      { id:'BN-01', name:'July Top Performer Bonus', type:'Performance', criteria:'Top 10 authors by reads this month', recipients:10, amountEach:200, status:'distributed', date:'2026-07-31', createdBy:'Ngozi Falade' },
      { id:'BN-02', name:'100K Reads Milestone', type:'Milestone', criteria:'Any story crossing 100,000 reads', recipients:4, amountEach:150, status:'distributed', date:'2026-07-20', createdBy:'Ngozi Falade' },
      { id:'BN-03', name:'New Author Welcome Bonus', type:'Onboarding', criteria:'Authors who published their first story this month', recipients:18, amountEach:25, status:'scheduled', date:'2026-08-01', createdBy:'Tari Benson' },
      { id:'BN-04', name:'Summer Romance Contest Prize', type:'Contest', criteria:'Top 3 entries in Summer Romance Writing Contest', recipients:3, amountEach:1500, status:'draft', date:'2026-08-10', createdBy:'Tari Benson' },
      { id:'BN-05', name:'Inner Circle Loyalty Bonus', type:'Loyalty', criteria:'Authors with 6+ months of Inner Circle subscribers', recipients:7, amountEach:100, status:'scheduled', date:'2026-08-05', createdBy:'Ngozi Falade' },
    ],

    /* ── Payment Disputes ── */
    paymentDisputes: [
      { id:'PD-301', author:'Marcus Webb Jr.', avatar:'https://i.pravatar.cc/60?img=12', amount:410,  reason:'Payout declined but coins were already deducted from reader balance.', status:'open', filed:'2026-07-28T10:00:00', resolutionNote:'' },
      { id:'PD-302', author:'Ada_Writes',      avatar:'https://i.pravatar.cc/60?img=52', amount:1200, reason:'Royalty calculation seems lower than expected reads for June.', status:'investigating', filed:'2026-07-26T14:30:00', resolutionNote:'' },
      { id:'PD-303', author:'Efe_O',           avatar:'https://i.pravatar.cc/60?img=17', amount:75,   reason:'Withdrawal declined for being under minimum, but threshold was not clearly stated.', status:'open', filed:'2026-07-25T09:15:00', resolutionNote:'' },
      { id:'PD-304', author:'Wren Okonkwo',    avatar:'https://i.pravatar.cc/60?img=41', amount:300,  reason:'Missing tip earnings from July 10–12.', status:'resolved', filed:'2026-07-14T11:00:00', resolutionNote:'Verified and credited missing tips of $300 on Jul 16.' },
      { id:'PD-305', author:'Zara_M',          avatar:'https://i.pravatar.cc/60?img=36', amount:50,   reason:'Disputes a coin refund deducted from author earnings.', status:'rejected', filed:'2026-07-10T08:20:00', resolutionNote:'Refund was reader-initiated within policy window; deduction stands.' },
    ],

    /* ── Financial Reports ── */
    financialReports: {
      summary: { totalRevenue:182400, totalPayouts:96200, platformIncome:86200, coinSalesRevenue:142300, growthVsLastMonth:8.4 },
      monthlyRevenue: [
        { month:'Feb', revenue:128000 }, { month:'Mar', revenue:141500 }, { month:'Apr', revenue:135800 },
        { month:'May', revenue:158200 }, { month:'Jun', revenue:168900 }, { month:'Jul', revenue:182400 },
      ],
      expenseBreakdown: [
        { label:'Author Payouts', amount:96200, color:'accent' },
        { label:'Payment Processing Fees', amount:5460, color:'blue' },
        { label:'Bonuses & Incentives', amount:4200, color:'purple' },
        { label:'Marketing Spend', amount:12800, color:'amber' },
        { label:'Infrastructure', amount:7100, color:'green' },
      ],
      topCategories: [
        { genre:'Romance & Betrayal', revenue:41200 }, { genre:'Werewolf & Fantasy', revenue:33800 },
        { genre:'Billionaire & CEO', revenue:28900 }, { genre:'Mafia & Urban', revenue:22100 },
        { genre:'Historical & Regency', revenue:15600 },
      ],
    },

    /* ── Tax & Accounting ── */
    taxDocuments: [
      { id:'TX-01', author:'Sophia Bennett', avatar:'https://i.pravatar.cc/100?img=48', docType:'1099-NEC', period:'2025 Tax Year', amount:38400, status:'issued', issuedDate:'2026-01-31' },
      { id:'TX-02', author:'Isabelle Moreau', avatar:'https://i.pravatar.cc/60?img=44', docType:'1099-NEC', period:'2025 Tax Year', amount:21200, status:'issued', issuedDate:'2026-01-31' },
      { id:'TX-03', author:'Ifeanyi_Story',   avatar:'https://i.pravatar.cc/60?img=8',  docType:'1099-NEC', period:'2025 Tax Year', amount:27600, status:'pending', issuedDate:null },
      { id:'TX-04', author:'Daniel Carter',   avatar:'https://i.pravatar.cc/100?img=13',docType:'Withholding Statement', period:'Q2 2026', amount:1980, status:'issued', issuedDate:'2026-07-05' },
      { id:'TX-05', author:'Chioma Reddy',    avatar:'https://i.pravatar.cc/100?img=5', docType:'Withholding Statement', period:'Q2 2026', amount:2340, status:'issued', issuedDate:'2026-07-05' },
      { id:'TX-06', author:'Elena Vasquez',   avatar:'https://i.pravatar.cc/60?img=31', docType:'Receipt', period:'Jul 2026', amount:870,  status:'issued', issuedDate:'2026-07-15' },
    ],
  };

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

    /* ── Author Payments ── */
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

    /* ── Coin Transactions ── */
    async getCoinTransactions() {
      try { return await callBackend('/coin-transactions'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.coinTransactions)); }
    },

    /* ── Bonuses ── */
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

    /* ── Payment Disputes ── */
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

    /* ── Financial Reports ── */
    async getFinancialReports() {
      try { return await callBackend('/financial-reports'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.financialReports)); }
    },

    /* ── Tax & Accounting ── */
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
  };
})();