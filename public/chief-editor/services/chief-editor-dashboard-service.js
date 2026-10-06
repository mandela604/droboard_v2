/* chief-editor-dashboard-service.js — migrated from chief-editor-dashboard.html inline script (byte-identical logic).
   Backend-ready header: set USE_API=true and implement endpoints under API_BASE to go live; demo paths keep working. */
(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, opts){
  if(!USE_API) return null;
  try{
    const res = await fetch(API_BASE + path, opts);
    if(!res.ok) throw new Error('Backend error: ' + res.status);
    return await res.json();
  }catch(e){ return null; }
}

let _initDone = false;
let shell = null;

/* ═══════════════════════════════════════════════════════════
   STAT CARDS
   ═══════════════════════════════════════════════════════════ */
const STAT_DEFS = [
  { key: 'seniorEditors',       label: 'Senior Editors',          ico: 'fa-users-gear',        cls: 'purple', deltaKey: 'seniorEditorsDelta' },
  { key: 'pendingPolicies',     label: 'Pending Policy Approvals',ico: 'fa-scroll',             cls: 'amber',  deltaKey: 'pendingPoliciesDelta' },
  { key: 'escalatedDisputes',   label: 'Escalated Disputes',      ico: 'fa-scale-balanced',     cls: 'red',    deltaKey: 'escalatedDisputesDelta' },
  { key: 'contractsAwaiting',   label: 'Contracts Awaiting Approval', ico: 'fa-handshake',      cls: 'green',  deltaKey: 'contractsAwaitingDelta' },
  { key: 'submissionsThisMonth',label: 'Platform Submissions (mo)', ico: 'fa-book-open',        cls: 'blue',   deltaKey: 'submissionsDelta' },
];

function fmtN(n){ return typeof n === 'number' ? n.toLocaleString() : n; }

function renderStatsSkeleton(){
  document.getElementById('statsGrid').innerHTML = STAT_DEFS.map(() => `
    <div class="stat-card" style="cursor:default">
      <div class="skeleton" style="width:42px;height:42px;border-radius:12px"></div>
      <div class="skeleton" style="width:60%;height:20px"></div>
      <div class="skeleton" style="width:80%;height:12px"></div>
    </div>`).join('');
}

function renderStats(stats){
  document.getElementById('statsGrid').innerHTML = STAT_DEFS.map(d => `
    <div class="stat-card" data-nav="${d.key}">
      <div class="stat-top"><div class="stat-ico ${d.cls}"><i class="fas ${d.ico}"></i></div></div>
      <div class="stat-num">${fmtN(stats[d.key])}</div>
      <div class="stat-lbl">${d.label}</div>
      <span class="stat-delta">${stats[d.deltaKey] || ''}</span>
    </div>`).join('');

  document.getElementById('wbDisputes').textContent = stats.escalatedDisputes;
  document.getElementById('wbContracts').textContent = stats.contractsAwaiting;
  document.getElementById('wbEditors').textContent = stats.seniorEditors;
  document.getElementById('wbSubmissions').textContent = fmtN(stats.submissionsThisMonth);
}

/* ═══════════════════════════════════════════════════════════
   ESCALATIONS & APPROVALS QUEUE
   ═══════════════════════════════════════════════════════════ */
const QUEUE_TYPES = [
  { key: 'dispute',  label: 'Disputes',  icon: 'fa-scale-balanced' },
  { key: 'policy',   label: 'Policies',  icon: 'fa-scroll' },
  { key: 'contract', label: 'Contracts', icon: 'fa-handshake' },
];
let activeQueueType = 'dispute';
let queueCache = {};

function renderQueueTabs(){
  document.getElementById('queueTabs').innerHTML = QUEUE_TYPES.map(t => `
    <div class="queue-tab${t.key===activeQueueType?' active':''}" data-type="${t.key}">
      <i class="fas ${t.icon}"></i> ${t.label} <span class="cnt">${(queueCache[t.key]||[]).length}</span>
    </div>`).join('');
  document.querySelectorAll('.queue-tab').forEach(tab => {
    tab.addEventListener('click', () => { activeQueueType = tab.dataset.type; renderQueueList(); renderQueueTabs(); });
  });
}

function queueActionsHtml(type, item){
  if (type === 'contract'){
    return `<div class="qi-actions">
      <button class="qi-btn approve" data-act="approve">Approve & Sign</button>
      <button class="qi-btn reject" data-act="reject">Reject</button>
    </div>`;
  }
  if (type === 'policy'){
    return `<div class="qi-actions">
      <button class="qi-btn approve" data-act="approve">Approve Policy</button>
      <button class="qi-btn reject" data-act="reject">Send Back</button>
    </div>`;
  }
  return `<div class="qi-actions">
    <button class="qi-btn approve" data-act="approve">Resolve</button>
    <button class="qi-btn reject" data-act="reject">Escalate to Legal</button>
  </div>`;
}

function renderQueueList(){
  const list = queueCache[activeQueueType] || [];
  const wrap = document.getElementById('queueList');
  if (!list.length){
    wrap.innerHTML = `<div class="queue-empty"><i class="fas fa-circle-check"></i>Nothing waiting here — you're all caught up.</div>`;
    return;
  }
  wrap.innerHTML = list.map(item => `
    <div class="queue-item" data-id="${item.id}">
      <div class="qi-top">
        <div class="qi-title-wrap">
          <div class="qi-title">${item.title}</div>
          <div class="qi-meta"><span><i class="fas fa-user" style="margin-right:3px"></i>${item.from}</span><span>·</span><span>Escalated by ${item.escalatedBy}</span><span>·</span><span>${item.time}</span></div>
        </div>
        <span class="prio-pill ${item.priority}">${item.priority}</span>
      </div>
      <div class="qi-detail">${item.detail}</div>
      ${item.value ? `<div class="qi-value"><i class="fas fa-sack-dollar" style="margin-right:4px"></i>${item.value}</div>` : ''}
      ${queueActionsHtml(activeQueueType, item)}
    </div>`).join('');

  wrap.querySelectorAll('.queue-item').forEach(el => {
    const id = el.dataset.id;
    el.querySelectorAll('.qi-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        btn.disabled = true;
        btn.textContent = 'Processing…';
        await ChiefEditorData.resolveQueueItem(activeQueueType, id, act);
        queueCache[activeQueueType] = (queueCache[activeQueueType] || []).filter(x => x.id !== id);
        toast(act === 'approve' ? '✅ Approved' : act === 'reject' ? '↩️ Sent back' : 'Updated');
        renderQueueList();
        renderQueueTabs();
        refreshStats();
      });
    });
  });
}

async function loadQueues(){
  const queues = await ChiefEditorData.getDashboardQueues();
  QUEUE_TYPES.forEach(t => { queueCache[t.key] = queues[t.key] || []; });
  renderQueueTabs();
  renderQueueList();
}

/* ═══════════════════════════════════════════════════════════
   PERFORMANCE CHART
   ═══════════════════════════════════════════════════════════ */
const PERIODS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];
let activePeriod = 'month';

function renderPeriodTabs(){
  document.getElementById('periodTabs').innerHTML = PERIODS.map(p => `
    <div class="period-tab${p.key===activePeriod?' active':''}" data-period="${p.key}">${p.label}</div>`).join('');
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      activePeriod = tab.dataset.period;
      renderPeriodTabs();
      const data = await ChiefEditorData.getPerformanceTrend(activePeriod);
      renderChart(data);
    });
  });
}

function renderChart(data){
  const max = Math.max(...data.submissions);
  document.getElementById('chartWrap').innerHTML = data.labels.map((lbl, i) => {
    const h = Math.max(6, Math.round((data.submissions[i] / max) * 130));
    return `<div class="chart-bar-col">
      <div class="chart-bar" style="height:${h}px" title="${data.submissions[i].toLocaleString()} submissions · ${data.approvalRate[i]}% approved"></div>
      <div class="chart-bar-lbl">${lbl}</div>
    </div>`;
  }).join('');
  const avgApproval = Math.round(data.approvalRate.reduce((a,b)=>a+b,0) / data.approvalRate.length);
  document.getElementById('chartApprovalAvg').textContent = avgApproval + '%';
  document.getElementById('wbApproval').textContent = avgApproval + '%';
}

/* ═══════════════════════════════════════════════════════════
   QUICK ACTIONS
   ═══════════════════════════════════════════════════════════ */
const QUICK_ACTIONS = [
  { label: 'Review Disputes',        icon: 'fa-scale-balanced', cls: 'red',    href: 'disputes-appeals.html' },
  { label: 'Approve Contracts',      icon: 'fa-handshake',      cls: 'green',  href: 'author-contracts.html' },
  { label: 'Publish Policy Update',  icon: 'fa-scroll',         cls: 'purple', href: 'editorial-policies.html' },
  { label: 'Manage Editorial Team',  icon: 'fa-users-gear',     cls: 'pink',   href: 'editorial-team.html' },
  { label: 'Plan Content Strategy',  icon: 'fa-compass',        cls: 'blue',   href: 'editorial-strategy.html' },
  { label: 'Review Partnerships',    icon: 'fa-globe',          cls: 'amber',  href: 'partnerships.html' },
];

function renderQuickActions(){
  document.getElementById('quickActions').innerHTML = QUICK_ACTIONS.map(a => `
    <div class="qa-item" data-href="${a.href}">
      <div class="qa-ico ${a.cls}"><i class="fas ${a.icon}"></i></div>
      <span class="qa-lbl">${a.label}</span>
      <i class="fas fa-chevron-right"></i>
    </div>`).join('');
  document.querySelectorAll('#quickActions .qa-item').forEach(el => {
    el.addEventListener('click', () => { location.href = el.dataset.href; });
  });
}

/* ═══════════════════════════════════════════════════════════
   SENIOR EDITOR TEAM
   ═══════════════════════════════════════════════════════════ */
async function loadEditors(){
  const editors = await ChiefEditorData.getEditorialTeam();
  document.getElementById('editorList').innerHTML = editors.slice(0, 5).map(e => `
    <div class="editor-row" data-name="${e.name}">
      <img class="editor-av" src="${e.avatar}" alt="${e.name}"/>
      <div class="editor-info">
        <div class="editor-name"><span class="editor-status-dot${e.status==='needs-attention'?' needs-attention':''}"></span>${e.name}</div>
        <div class="editor-team">${e.team} · ${e.reviewsThisMonth} reviews this month</div>
      </div>
      <div class="editor-perf">
        <div class="editor-perf-num">${e.approvalRate}%</div>
        <div class="editor-perf-track"><div class="editor-perf-fill${e.approvalRate<85?' warn':''}" style="width:${e.approvalRate}%"></div></div>
      </div>
    </div>`).join('');
  document.querySelectorAll('.editor-row').forEach(el => {
    el.addEventListener('click', () => toast(`Opening ${el.dataset.name}'s profile…`));
  });
}

/* ═══════════════════════════════════════════════════════════
   RECENT ACTIVITY
   ═══════════════════════════════════════════════════════════ */
async function loadActivity(){
  const activity = await ChiefEditorData.getRecentActivity();
  document.getElementById('activityList').innerHTML = activity.map(a => `
    <div class="activity-row">
      <div class="activity-ico ${a.color}"><i class="fas ${a.icon}"></i></div>
      <div>
        <div class="activity-text">${a.text}</div>
        <div class="activity-time">${a.time}</div>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */
async function refreshStats(){
  const stats = await ChiefEditorData.getDashboardStats();
  renderStats(stats);
}

function toast(msg, icon) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = (icon ? icon + ' ' : '') + msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

async function init(){
  if(_initDone) return;
  _initDone = true;

  /* ── Sidebar shell (moved verbatim from inline script) ── */
  shell = ChiefEditorSidebar.attach('#dashboardRoot', {
    activeItem: 'dashboard',
    title: 'Chief Editor Dashboard',
    subtitle: 'Platform-wide editorial oversight',
    user: { name: 'Reina Morgan', role: 'Chief Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
    notifCount: 6,
    searchPlaceholder: 'Search editors, disputes, contracts…',
    onSearch: (v) => { if (v) toast('Searching: ' + v); },
  });

  document.getElementById('teamViewAll').addEventListener('click', () => { location.href = 'editorial-team.html'; });

  document.getElementById('wbDisputesBtn').addEventListener('click', () => { location.href = 'disputes-appeals.html'; });
  document.getElementById('wbTeamBtn').addEventListener('click', () => { location.href = 'editorial-team.html'; });

  renderStatsSkeleton();
  renderPeriodTabs();
  renderQuickActions();

  const [stats, perf] = await Promise.all([
    ChiefEditorData.getDashboardStats(),
    ChiefEditorData.getPerformanceTrend(activePeriod),
  ]);
  renderStats(stats);
  renderChart(perf);

  loadQueues();
  loadEditors();
  loadActivity();
}

window.ChiefEditorDashboardService = { init: init };
// No onclick= handlers found in markup; preserve former global for compatibility.
try{ window.toast = toast; }catch(e){}

})();
