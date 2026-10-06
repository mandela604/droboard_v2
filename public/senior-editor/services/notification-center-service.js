/**
 * services/notification-center-service.js — Notification Center page logic.
 * Pure call-and-render: notification-center.html only loads this + init().
 * Backend-ready: set USE_API=true and implement endpoints below.
 */
(function () {
'use strict';
if (window.NotificationCenterService) return;

const USE_API = false;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[NotificationCenterService] backend unavailable, using demo data', e);
    return null;
  }
}

const NOTIFS = [
  { ico: 'pink', icon: 'fa-file-contract', title: 'Contract Signed: CNTR-2026-00125', desc: 'Luna Skye has signed the Exclusive Publishing Agreement for "Bound by the Ruthless Alpha".', time: '12 minutes ago', unread: true },
  { ico: 'blue', icon: 'fa-star', title: 'New Review Submitted', desc: 'A reader left a 4.8-star review on "The Ruthless CEO" by Ava Winters.', time: '1 hour ago', unread: true },
  { ico: 'amber', icon: 'fa-money-bill-wave', title: 'Withdrawal Request: Amara Okafor', desc: 'Amara Okafor has requested a withdrawal of $2,450.00.', time: '2 hours ago', unread: true },
  { ico: 'green', icon: 'fa-user-plus', title: 'New Author Registered', desc: 'A new author "Nadia Petrov" has registered and submitted verification documents.', time: '3 hours ago', unread: true },
  { ico: 'red', icon: 'fa-flag', title: 'Content Flagged: Inappropriate Content', desc: 'Chapter 12 in "The Ruthless CEO" has been flagged by readers.', time: '5 hours ago', unread: false },
  { ico: 'pink', icon: 'fa-bullhorn', title: 'Announcement Published', desc: '"Introducing Book Analytics" has been published to all authors.', time: '6 hours ago', unread: false },
  { ico: 'blue', icon: 'fa-circle-check', title: 'Verification Approved', desc: 'Sofia Lindqvist\'s author verification has been approved.', time: '1 day ago', unread: false },
  { ico: 'amber', icon: 'fa-clock', title: 'Contract Expiring Soon', desc: 'Contract CNTR-2026-00121 for "Claimed by the Mafia King" expires in 18 days.', time: '1 day ago', unread: false },
  { ico: 'green', icon: 'fa-sack-dollar', title: 'Payment Processed', desc: 'Monthly payout batch of $12,840 has been processed successfully.', time: '2 days ago', unread: false },
  { ico: 'red', icon: 'fa-shield', title: 'Security Alert: Login Attempt', desc: 'Unusual login attempt detected from an unknown IP address.', time: '2 days ago', unread: false },
];

let notifs = NOTIFS.slice();

async function refresh() {
  const backend = await callBackend('/notifications');
  if (backend && backend.items) notifs = backend.items;
  render();
}

function render() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const t = document.getElementById('typeFilter').value;
  let list = notifs;
  if (t) list = list.filter(n => { return n.title.toLowerCase().includes(t.toLowerCase()); });
  if (q) list = list.filter(n => n.title.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q));
  const el = document.getElementById('notifList');
  el.innerHTML = list.map(n => `<div class="notif-item${n.unread ? ' unread' : ''}"><div class="notif-ico ${n.ico}"><i class="fas ${n.icon}"></i></div><div class="notif-body"><div class="notif-title">${n.title}</div><div class="notif-desc">${n.desc}</div><div class="notif-time">${n.time}</div></div>${n.unread ? '<div class="notif-dot"></div>' : ''}</div>`).join('');
}

function init() {
  SeniorEditorSidebar.attach('#dashboardRoot', { activeItem: 'notification-center', title: 'Notification Center', subtitle: 'View and manage all platform notifications and alerts', user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' }, notifCount: 27, hideSearch: true });
  document.getElementById('searchInput').addEventListener('input', render);
  document.getElementById('typeFilter').addEventListener('change', render);
  refresh();
}

function svcToast(m){ if(typeof window.toast==='function'){ try{ window.toast(m); return; }catch(e){} } }
function createNotification(){ return callBackend('/notifications', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }).then(function(r){ if(!r) svcToast('Creating new notification…'); }); }
function markAllRead(){ return callBackend('/notifications/read-all', { method:'POST' }).then(function(r){ if(!r){ notifs.forEach(function(n){ n.unread=false; }); render(); svcToast('Marking all as read…'); } else if(r && r.items){ notifs=r.items; render(); } }); }

window.NotificationCenterService = { init: init, createNotification: createNotification, markAllRead: markAllRead };
})();
