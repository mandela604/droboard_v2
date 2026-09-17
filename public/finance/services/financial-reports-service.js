/**
 * financial-reports-service.js — Financial Reports page renderer
 * ──────────────────────────────────────────────────────────────
 * Call-and-render only. All data comes from FinanceDemo (central demo data file).
 * Handles date-range filtering: KPIs, chart, expenses, and categories all
 * recalculate based on the selected date range.
 */
(function(){
'use strict';

var ICO = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
var BG  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };

var RAW = null;
var CURRENT_RANGE = { from:null, to:null };

/* ── Helpers ── */
function money(n){ return '$' + Number(n||0).toLocaleString('en-US'); }
function moneyShort(n){
  var v = Number(n||0);
  if(v>=1000000) return '$'+(v/1000000).toFixed(1)+'M';
  if(v>=1000) return '$'+(v/1000).toFixed(1)+'K';
  return '$'+v.toLocaleString('en-US');
}
function pct(n){ return Number(n||0).toFixed(1)+'%'; }
function toNum(v){ return Number(v||0); }

function getDefaultData(){
  if(window.FinanceDemo && window.FinanceDemo.financialReports) return JSON.parse(JSON.stringify(window.FinanceDemo.financialReports));
  return {
    summary:{ totalRevenue:182400, totalPayouts:96200, platformIncome:86200, coinSalesRevenue:142300, growthVsLastMonth:8.4 },
    monthlyRevenue:[
      {month:'Feb',revenue:128000},{month:'Mar',revenue:141500},{month:'Apr',revenue:135800},
      {month:'May',revenue:158200},{month:'Jun',revenue:168900},{month:'Jul',revenue:182400}
    ],
    dailyRevenue:[],
    dailyExpenses:[],
    dailyCategoryRevenue:[],
    expenseBreakdown:[
      {label:'Author Payouts',amount:96200,color:'accent'},
      {label:'Payment Processing Fees',amount:5460,color:'blue'},
      {label:'Bonuses & Incentives',amount:4200,color:'purple'},
      {label:'Marketing Spend',amount:12800,color:'amber'},
      {label:'Infrastructure',amount:7100,color:'green'}
    ],
    topCategories:[
      {genre:'Romance & Betrayal',revenue:41200},
      {genre:'Werewolf & Fantasy',revenue:33800},
      {genre:'Billionaire & CEO',revenue:28900},
      {genre:'Mafia & Urban',revenue:22100},
      {genre:'Historical & Regency',revenue:15600}
    ]
  };
}

/* ── Date-range filter ── */
function filterByRange(arr, from, to){
  if(!from && !to) return arr;
  return arr.filter(function(row){
    var d = row.date;
    if(from && d < from) return false;
    if(to && d > to) return false;
    return true;
  });
}

function buildFilteredData(raw, from, to){
  var filtered = filterByRange(raw.dailyRevenue, from, to);
  if(!filtered.length) filtered = raw.dailyRevenue.slice();

  /* ── KPI summary from daily rows ── */
  var totalRevenue=0, totalPayouts=0, platformIncome=0, coinSales=0;
  filtered.forEach(function(r){
    totalRevenue  += toNum(r.revenue);
    totalPayouts  += toNum(r.payouts);
    platformIncome+= toNum(r.platformIncome);
    coinSales     += toNum(r.coinSales);
  });

  /* ── Monthly chart (group by month) ── */
  var monthMap = {};
  var monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  filtered.forEach(function(r){
    var parts = r.date.split('-');
    var mIdx = parseInt(parts[1],10)-1;
    var mKey = monthOrder[mIdx];
    if(!monthMap[mKey]) monthMap[mKey] = {month:mKey, revenue:0, order:mIdx};
    monthMap[mKey].revenue += toNum(r.revenue);
  });
  var monthlyRevenue = Object.values(monthMap).sort(function(a,b){return a.order-b.order;});
  monthlyRevenue.forEach(function(m){ delete m.order; });

  /* ── Expense breakdown from daily expenses ── */
  var expFiltered = filterByRange(raw.dailyExpenses, from, to);
  if(!expFiltered.length) expFiltered = raw.dailyExpenses.slice();
  var expTotals = { authorPayouts:0, processingFees:0, bonuses:0, marketing:0, infrastructure:0 };
  expFiltered.forEach(function(e){
    expTotals.authorPayouts   += toNum(e.authorPayouts);
    expTotals.processingFees  += toNum(e.processingFees);
    expTotals.bonuses         += toNum(e.bonuses);
    expTotals.marketing       += toNum(e.marketing);
    expTotals.infrastructure  += toNum(e.infrastructure);
  });
  var expenseBreakdown = [
    { label:'Author Payouts',          amount:expTotals.authorPayouts,   color:'accent' },
    { label:'Payment Processing Fees', amount:expTotals.processingFees,  color:'blue' },
    { label:'Bonuses & Incentives',    amount:expTotals.bonuses,         color:'purple' },
    { label:'Marketing Spend',         amount:expTotals.marketing,       color:'amber' },
    { label:'Infrastructure',          amount:expTotals.infrastructure,  color:'green' },
  ];

  /* ── Top categories from daily category revenue ── */
  var catFiltered = filterByRange(raw.dailyCategoryRevenue, from, to);
  if(!catFiltered.length) catFiltered = raw.dailyCategoryRevenue.slice();
  var catMap = {};
  catFiltered.forEach(function(c){
    if(!catMap[c.genre]) catMap[c.genre] = 0;
    catMap[c.genre] += toNum(c.revenue);
  });
  var topCategories = Object.keys(catMap).map(function(g){ return {genre:g, revenue:catMap[g]}; });
  topCategories.sort(function(a,b){ return b.revenue - a.revenue; });

  /* ── Growth vs last month ── */
  var growth = 0;
  if(monthlyRevenue.length >= 2){
    var last = monthlyRevenue[monthlyRevenue.length-1].revenue;
    var prev = monthlyRevenue[monthlyRevenue.length-2].revenue;
    if(prev > 0) growth = ((last - prev) / prev) * 100;
  }

  return {
    summary:{
      totalRevenue: totalRevenue,
      totalPayouts: totalPayouts,
      platformIncome: platformIncome,
      coinSalesRevenue: coinSales,
      growthVsLastMonth: Math.round(growth*10)/10
    },
    monthlyRevenue: monthlyRevenue,
    expenseBreakdown: expenseBreakdown,
    topCategories: topCategories
  };
}

/* ── Render: KPI stat cards ── */
function renderStatCards(s){
  var stats = [
    { n:money(s.totalRevenue), l:'Total Revenue', ico:'fa-chart-line', cls:'green' },
    { n:money(s.totalPayouts), l:'Total Payouts', ico:'fa-money-check-dollar', cls:'accent' },
    { n:money(s.platformIncome), l:'Platform Income', ico:'fa-building-columns', cls:'blue' },
    { n:pct(s.growthVsLastMonth), l:'Growth vs Last Month', ico:'fa-arrow-trend-up', cls:'amber' }
  ];
  var el = document.getElementById('statCards');
  if(!el) return;
  el.innerHTML = stats.map(function(s){
    return '<div class="stat-card">'+
      '<div class="stat-ico" style="background:'+BG[s.cls]+';color:'+ICO[s.cls]+'"><i class="fas '+s.ico+'"></i></div>'+
      '<div><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div></div>'+
    '</div>';
  }).join('');
}

/* ── Render: Expense breakdown ── */
function renderExpenseBreakdown(items){
  var total = 0;
  items.forEach(function(e){ total += e.amount; });
  var box = document.getElementById('expenseBreakdown');
  if(!box) return;
  box.innerHTML = items.map(function(e){
    var percent = total > 0 ? ((e.amount/total)*100).toFixed(1) : '0.0';
    return '<div class="exp-row">'+
      '<div class="exp-info">'+
        '<div class="exp-dot" style="background:'+(ICO[e.color]||'var(--text-faint)')+'"></div>'+
        '<span class="exp-label">'+e.label+'</span>'+
        '<span class="exp-amount">'+money(e.amount)+'</span>'+
      '</div>'+
      '<div class="exp-bar-wrap">'+
        '<div class="exp-bar" style="width:'+percent+'%;background:'+(ICO[e.color]||'var(--text-faint)')+'"></div>'+
      '</div>'+
      '<div class="exp-pct">'+percent+'%</div>'+
    '</div>';
  }).join('');
  var totalEl = document.getElementById('expenseTotal');
  if(totalEl) totalEl.textContent = money(total);
}

/* ── Render: Top categories ── */
function renderTopCategories(items){
  if(!items.length){
    var box = document.getElementById('topCategories');
    if(box) box.innerHTML = '<div class="empty-state"><i class="fas fa-ranking-star"></i><p>No category data for selected range</p></div>';
    return;
  }
  var maxRev = Math.max.apply(null, items.map(function(c){return c.revenue;}));
  var box = document.getElementById('topCategories');
  if(!box) return;
  box.innerHTML = items.map(function(c,i){
    var width = maxRev > 0 ? Math.round((c.revenue / maxRev) * 100) : 0;
    var medal = i===0?'1st':i===1?'2nd':i===2?'3rd':(i+1)+'th';
    return '<div class="cat-row">'+
      '<div class="cat-rank">'+medal+'</div>'+
      '<div class="cat-body">'+
        '<div class="cat-top">'+
          '<span class="cat-name">'+c.genre+'</span>'+
          '<span class="cat-rev">'+money(c.revenue)+'</span>'+
        '</div>'+
        '<div class="cat-bar-wrap">'+
          '<div class="cat-bar" style="width:'+width+'%"></div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ── Full render ── */
function renderAll(from, to){
  var filtered = buildFilteredData(RAW, from, to);
  renderStatCards(filtered.summary);
  renderExpenseBreakdown(filtered.expenseBreakdown);
  renderTopCategories(filtered.topCategories);
}

/* ── Date filter UI wiring ── */
function wireDateFilter(){
  var fromInput  = document.getElementById('dateFrom');
  var toInput    = document.getElementById('dateTo');
  var applyBtn   = document.getElementById('applyFilter');
  var resetBtn   = document.getElementById('resetFilter');
  var display    = document.getElementById('dateRangeDisplay');
  var dropdown   = document.getElementById('dateRangeDropdown');
  var rangeText  = document.getElementById('dateRangeText');
  var labelText  = document.getElementById('dateRangeLabel');

  function fmtDate(s){
    if(!s) return null;
    var d = new Date(s+'T00:00:00');
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }
  function updateDisplay(from,to){
    if(!from && !to){
      rangeText.innerHTML = '<span class="dr-placeholder">Select date range</span>';
      labelText.textContent = 'Showing all data';
    } else {
      var f = fmtDate(from)||'Start';
      var t = fmtDate(to)||'Now';
      rangeText.textContent = f + ' — ' + t;
      labelText.textContent = f + ' — ' + t;
    }
  }

  if(display){
    display.addEventListener('click', function(e){
      e.stopPropagation();
      dropdown.classList.toggle('show');
      display.classList.toggle('open');
    });
  }

  document.addEventListener('click', function(e){
    if(dropdown && !dropdown.contains(e.target)){
      dropdown.classList.remove('show');
      if(display) display.classList.remove('open');
    }
  });

  if(dropdown) dropdown.addEventListener('click', function(e){ e.stopPropagation(); });

  if(applyBtn){
    applyBtn.addEventListener('click', function(){
      CURRENT_RANGE.from = fromInput && fromInput.value ? fromInput.value : null;
      CURRENT_RANGE.to   = toInput && toInput.value ? toInput.value : null;
      updateDisplay(CURRENT_RANGE.from, CURRENT_RANGE.to);
      renderAll(CURRENT_RANGE.from, CURRENT_RANGE.to);
      dropdown.classList.remove('show');
      if(display) display.classList.remove('open');
    });
  }
  if(resetBtn){
    resetBtn.addEventListener('click', function(){
      if(fromInput) fromInput.value = '';
      if(toInput) toInput.value = '';
      CURRENT_RANGE = { from:null, to:null };
      updateDisplay(null, null);
      renderAll(null, null);
      dropdown.classList.remove('show');
      if(display) display.classList.remove('open');
    });
  }
}

/* ── Export CSV ── */
function exportCSV(){
  var filtered = buildFilteredData(RAW, CURRENT_RANGE.from, CURRENT_RANGE.to);
  var rows = [
    ['Metric','Value'],
    ['Total Revenue', filtered.summary.totalRevenue],
    ['Total Payouts', filtered.summary.totalPayouts],
    ['Platform Income', filtered.summary.platformIncome],
    ['Coin Sales Revenue', filtered.summary.coinSalesRevenue],
    ['Growth vs Last Month', filtered.summary.growthVsLastMonth+'%'],
    [],
    ['Expense','Amount']
  ];
  filtered.expenseBreakdown.forEach(function(e){ rows.push([e.label, e.amount]); });
  rows.push([]);
  rows.push(['Category','Revenue']);
  filtered.topCategories.forEach(function(c){ rows.push([c.genre, c.revenue]); });

  var csv = rows.map(function(r){
    return r.map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(',');
  }).join('\n');
  var blob = new Blob([csv], {type:'text/csv'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'financial-report-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  if(typeof window.toast==='function') window.toast('Report exported as CSV');
}

/* ── Init ── */
async function init(){
  RAW = getDefaultData();
  renderAll(null, null);
  wireDateFilter();
  var exportBtn = document.getElementById('exportBtn');
  if(exportBtn) exportBtn.addEventListener('click', exportCSV);
}

init();
})();
