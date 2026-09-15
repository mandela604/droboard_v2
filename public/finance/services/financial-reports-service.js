/**
 * financial-reports-service.js — Financial Reports page renderer
 * ──────────────────────────────────────────────────────────────
 * Self-contained: owns its demo data, renders into the page.
 * Uses FinanceDemo (from finance-demo-data.js) as central source.
 */
(function(){
'use strict';

const ICO = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };

let DATA = null;

function money(n){ return '$' + Number(n||0).toLocaleString('en-US'); }
function moneyShort(n){
  const v = Number(n||0);
  if(v>=1000000) return '$'+(v/1000000).toFixed(1)+'M';
  if(v>=1000) return '$'+(v/1000).toFixed(1)+'K';
  return '$'+v.toLocaleString('en-US');
}
function pct(n){ return Number(n||0).toFixed(1)+'%'; }

function getDemoData(){
  if(window.FinanceDemo && window.FinanceDemo.financialReports) return JSON.parse(JSON.stringify(window.FinanceDemo.financialReports));
  return {
    summary:{ totalRevenue:182400, totalPayouts:96200, platformIncome:86200, coinSalesRevenue:142300, growthVsLastMonth:8.4 },
    monthlyRevenue:[
      {month:'Feb',revenue:128000},{month:'Mar',revenue:141500},{month:'Apr',revenue:135800},
      {month:'May',revenue:158200},{month:'Jun',revenue:168900},{month:'Jul',revenue:182400}
    ],
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

async function init(){
  try {
    if(window.FinanceData && window.FinanceData.getFinancialReports){
      DATA = await window.FinanceData.getFinancialReports();
    } else {
      DATA = getDemoData();
    }
  } catch(e){
    DATA = getDemoData();
  }
  if(!DATA || !DATA.summary){ DATA = getDemoData(); }
  renderStatCards();
  renderRevenueChart();
  renderExpenseBreakdown();
  renderTopCategories();
}

function renderStatCards(){
  const s = DATA.summary;
  const stats = [
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

function renderRevenueChart(){
  var months = DATA.monthlyRevenue;
  var maxRevenue = Math.max.apply(null, months.map(function(m){return m.revenue;}));
  var chartBox = document.getElementById('revenueChart');
  if(!chartBox) return;
  var html = '<div class="chart-bars">';
  months.forEach(function(m){
    var height = Math.round((m.revenue / maxRevenue) * 100);
    html += '<div class="chart-col">'+
      '<div class="chart-val">'+moneyShort(m.revenue)+'</div>'+
      '<div class="chart-bar-wrap">'+
        '<div class="chart-bar" style="height:'+height+'%" data-rev="'+m.revenue+'"></div>'+
      '</div>'+
      '<div class="chart-label">'+m.month+'</div>'+
    '</div>';
  });
  html += '</div>';
  chartBox.innerHTML = html;
}

function renderExpenseBreakdown(){
  var items = DATA.expenseBreakdown;
  var total = 0;
  items.forEach(function(e){ total += e.amount; });
  var box = document.getElementById('expenseBreakdown');
  if(!box) return;
  box.innerHTML = items.map(function(e){
    var percent = ((e.amount/total)*100).toFixed(1);
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

function renderTopCategories(){
  var items = DATA.topCategories;
  var maxRev = Math.max.apply(null, items.map(function(c){return c.revenue;}));
  var box = document.getElementById('topCategories');
  if(!box) return;
  box.innerHTML = items.map(function(c,i){
    var width = Math.round((c.revenue / maxRev) * 100);
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

function exportCSV(){
  if(!DATA) return;
  var rows = [
    ['Metric','Value'],
    ['Total Revenue', DATA.summary.totalRevenue],
    ['Total Payouts', DATA.summary.totalPayouts],
    ['Platform Income', DATA.summary.platformIncome],
    ['Coin Sales Revenue', DATA.summary.coinSalesRevenue],
    ['Growth vs Last Month', DATA.summary.growthVsLastMonth+'%'],
    [],
    ['Month','Revenue']
  ];
  DATA.monthlyRevenue.forEach(function(m){ rows.push([m.month, m.revenue]); });
  rows.push([]);
  rows.push(['Expense','Amount']);
  DATA.expenseBreakdown.forEach(function(e){ rows.push([e.label, e.amount]); });
  rows.push([]);
  rows.push(['Category','Revenue']);
  DATA.topCategories.forEach(function(c){ rows.push([c.genre, c.revenue]); });

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

var exportBtn = document.getElementById('exportBtn');
if(exportBtn) exportBtn.addEventListener('click', exportCSV);

init();
})();
