/**
 * services/transaction-history-service.js — Transaction History page logic.
 * Pure call-and-render: transaction-history.html only loads this + init().
 * Backend-ready: set USE_API=true and implement endpoints below.
 */
(function () {
'use strict';
if (window.TransactionHistoryService) return;

const USE_API = false;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[TransactionHistoryService] backend unavailable, using demo data', e);
    return null;
  }
}

const TXNS = [
  { id: 'TXN-2450', desc: 'Book Sale - The Ruthless CEO', type: 'revenue', amount: '+$12.99', usr: 'Reader_2345', date: 'Jun 17, 2026 10:24AM', cls: 'credit' },
  { id: 'TXN-2449', desc: 'Author Payout - Amara Okafor', type: 'payout', amount: '-$2,450.00', usr: 'Amara Okafor', date: 'Jun 17, 2026 09:15AM', cls: 'debit' },
  { id: 'TXN-2448', desc: 'Refund - Wrong Charge', type: 'refund', amount: '-$9.99', usr: 'Reader_8901', date: 'Jun 16, 2026 04:30PM', cls: 'debit' },
  { id: 'TXN-2447', desc: 'Book Sale - Bound by the Alpha', type: 'revenue', amount: '+$8.99', usr: 'Reader_5678', date: 'Jun 16, 2026 02:10PM', cls: 'credit' },
  { id: 'TXN-2446', desc: 'Processing Fee - Payout Batch', type: 'fee', amount: '-$15.00', usr: 'System', date: 'Jun 16, 2026 11:00AM', cls: 'debit' },
  { id: 'TXN-2445', desc: 'Royalty Adjustment - Isabella Rossi', type: 'adjustment', amount: '+$120.00', usr: 'Isabella Rossi', date: 'Jun 15, 2026 03:45PM', cls: 'credit' },
  { id: 'TXN-2444', desc: 'Book Sale - His Hidden Luna', type: 'revenue', amount: '+$6.99', usr: 'Reader_1234', date: 'Jun 15, 2026 01:20PM', cls: 'credit' },
  { id: 'TXN-2443', desc: 'Author Payout - Sofia Lindqvist', type: 'payout', amount: '-$1,820.00', usr: 'Sofia Lindqvist', date: 'Jun 15, 2026 10:00AM', cls: 'debit' },
];

let txns = TXNS.slice();

async function refresh() {
  const backend = await callBackend('/transactions');
  if (backend && backend.items) txns = backend.items;
  const q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
  const t = document.getElementById('typeSelect').value;
  let l = txns;
  if (t) l = l.filter(r => r.type === t);
  if (q) l = l.filter(r => r.id.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q) || r.usr.toLowerCase().includes(q));
  renderTable(l);
  document.getElementById('pageInfo').innerHTML = `Showing <b>${l.length ? 1 : 0}</b> to <b>${Math.min(8, l.length)}</b> of <b>2,450</b> transactions`;
}

function renderTable(l) {
  const b = document.getElementById('tableBody');
  if (!l.length) { b.innerHTML = `<tr class="empty-row"><td colspan="7"><i class="fas fa-clock-rotate-left"></i>No transactions match.</td></tr>`; return; }
  b.innerHTML = l.slice(0, 8).map(r => `<tr><td data-label="Transaction ID" style="font-weight:700;font-size:11.5px">${r.id}</td><td data-label="Description" style="font-weight:600">${r.desc}</td><td data-label="Type"><span class="type-pill ${r.type}">${r.type.charAt(0).toUpperCase() + r.type.slice(1)}</span></td><td data-label="Amount" class="amount ${r.cls}">${r.amount}</td><td data-label="User" style="font-weight:600">${r.usr}</td><td data-label="Date" style="font-size:12px;color:var(--text-muted)">${r.date}</td><td data-label="Actions"><div class="actions-cell"><button class="act-btn" onclick="toast('Viewing transaction…')"><i class="fas fa-eye"></i></button></div></td></tr>`).join('');
}

function renderPagination() {
  const w = document.getElementById('pageBtns');
  const p = [1, 2, 3, 4, 5, '...', 307];
  w.innerHTML = `<button class="pg-btn" disabled><i class="fas fa-chevron-left"></i></button>` + p.map(p => p === '...' ? `<span style="color:var(--text-faint);font-size:12px;padding:0 2px">…</span>` : `<button class="pg-btn${p === 1 ? ' active' : ''}" data-p="${p}">${p}</button>`).join('') + `<button class="pg-btn"><i class="fas fa-chevron-right"></i></button>`;
  w.querySelectorAll('[data-p]').forEach(b => { b.addEventListener('click', () => { w.querySelectorAll('.pg-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); }); });
}

function ensureToast() {
  if (typeof window.toast !== 'function') {
    window.toast = function (m) {
      let t = document.getElementById('toastEl');
      if (!t) {
        t = document.createElement('div'); t.id = 'toastEl';
        t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a1730;color:#fff;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:.3s;pointer-events:none';
        document.body.appendChild(t);
      }
      t.textContent = m; t.style.opacity = '1';
      clearTimeout(t._t); t._t = setTimeout(function () { t.style.opacity = '0'; }, 2200);
    };
  }
}

function init() {
  SeniorEditorSidebar.attach('#dashboardRoot', { activeItem: 'transaction-history', title: 'Transaction History', subtitle: 'View all financial transactions across the platform', user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' }, notifCount: 8, searchPlaceholder: 'Search by ID, description, or user...', mobileSearchTarget: '#tableSearch', onSearch: (v) => { document.getElementById('tableSearch').value = v; refresh(); } });
  ensureToast();
  document.getElementById('tableSearch').addEventListener('input', refresh);
  document.getElementById('typeSelect').addEventListener('change', refresh);
  renderPagination();
  refresh();
}

function svcToast(m){ if(typeof window.toast==='function'){ try{ window.toast(m); return; }catch(e){} } }
function exportCSV(){ return callBackend('/transactions/export', { method:'POST' }).then(function(r){ if(!r) svcToast('Exporting transaction log…'); }); }
function openDatePicker(){ svcToast('Date picker'); }
function openFilters(){ svcToast('Filters'); }

window.TransactionHistoryService = { init: init, exportCSV: exportCSV, openDatePicker: openDatePicker, openFilters: openFilters };
})();
