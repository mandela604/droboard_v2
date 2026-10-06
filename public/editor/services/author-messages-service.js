/* author-messages-service.js — Author Messages page logic (backend-ready).
 * Demo mode: USE_API=false keeps all demo paths working.
 * Flip USE_API=true and point API_BASE at the real backend to go live. */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    const res = await fetch(API_BASE + path, options || {});
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  /* ═══════════════════════════════════════════════════════════
     ATTACH THE SHARED SHELL — sidebar + topbar wrap the content
     already inside #dashboardRoot above.
     ═══════════════════════════════════════════════════════════ */
  function attachShell(){
    DroboardShell.attach('#dashboardRoot', {
      activeFile: 'author-messages.html',
      title: 'Author Messages',
      subtitle: 'Manage conversations with authors on your platform',
      user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
      notifCount: 8,
      searchPlaceholder: 'Search conversations or authors...',
      mobileSearchTarget: '#convSearch',
      onSearch: (value) => {
        document.getElementById('convSearch').value = value;
        renderConvList();
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════
     DATA
     ═══════════════════════════════════════════════════════════ */
  const CONVERSATIONS = [
    { id:1, name:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', role:'Verified Author', unread:2, flagged:false, time:'10m ago',
      messages:[
        { from:'author', text:"Hi, I wanted to check in about my contract — it's set to expire next month.", time:'2 days ago' },
        { from:'admin', text:'Hi Sofia! Thanks for reaching out. Let me check with the contracts team and get back to you.', time:'2 days ago' },
        { from:'author', text:'Great, thank you! Also wondering if there\u2019s flexibility on the royalty percentage for the renewal.', time:'1 day ago' },
        { from:'author', text:'Can we discuss extending my contract renewal deadline? I need a bit more time to review the new terms.', time:'10m ago' },
      ] },
    { id:2, name:'Marcus Chen', avatar:'https://i.pravatar.cc/100?img=12', role:'Verified Author', unread:0, flagged:false, time:'1h ago',
      messages:[
        { from:'author', text:'Just submitted the revised chapter 12 — fixed the pacing issue you flagged.', time:'3h ago' },
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
        { from:'author', text:'Hi, just following up on my verification status — submitted docs 2 weeks ago.', time:'1d ago' },
        { from:'admin', text:'Hi Daniel, your documents are under final review. Should be resolved by Friday.', time:'20h ago' },
      ] },
    { id:5, name:'Priya Nair', avatar:'https://i.pravatar.cc/100?img=27', role:'Verified Author', unread:3, flagged:false, time:'2d ago',
      messages:[
        { from:'author', text:'Read through the new royalty structure doc — a couple of questions on tiered rates.', time:'2d ago' },
        { from:'author', text:'Specifically, does the 70% tier apply retroactively to existing contracts?', time:'2d ago' },
        { from:'author', text:'Also, when does the new structure take effect exactly?', time:'2d ago' },
      ] },
    { id:6, name:'Julien Moreau', avatar:'https://i.pravatar.cc/100?img=15', role:'Pending Author', unread:0, flagged:false, time:'3d ago',
      messages:[
        { from:'author', text:'Uploaded my new manuscript, please review when you get a chance.', time:'3d ago' },
        { from:'admin', text:"Got it, added to the review queue — we'll get back within 3-5 business days.", time:'3d ago' },
      ] },
    { id:7, name:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', role:'Verified Author', unread:0, flagged:false, time:'4d ago',
      messages:[
        { from:'admin', text:"Congrats Isabella — your book was selected for this month's featured banner!", time:'4d ago' },
        { from:'author', text:'Thank you so much for featuring my book! Really appreciate the support.', time:'4d ago' },
      ] },
    { id:8, name:'Tobias Bergman', avatar:'https://i.pravatar.cc/100?img=8', role:'Suspended Author', unread:1, flagged:true, time:'5d ago',
      messages:[
        { from:'admin', text:'Your account has been suspended due to repeated content policy violations.', time:'6d ago' },
        { from:'author', text:'I want to appeal my suspension. I believe this was a misunderstanding.', time:'5d ago' },
      ] },
  ];

  let currentView = 'all';
  let activeConvId = CONVERSATIONS[0].id;

  function filteredConversations(){
    const q = (document.getElementById('convSearch').value || '').trim().toLowerCase();
    let list = CONVERSATIONS;
    if (currentView === 'unread') list = list.filter(c => c.unread > 0);
    else if (currentView === 'flagged') list = list.filter(c => c.flagged);
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q));
    return list;
  }

  function renderConvList(){
    const list = filteredConversations();
    const wrap = document.getElementById('convList');
    if (!list.length){
      wrap.innerHTML = `<div style="padding:40px 16px;text-align:center;color:var(--text-muted)"><i class="fas fa-inbox" style="font-size:24px;color:var(--text-faint);display:block;margin-bottom:8px"></i>No conversations here.</div>`;
      return;
    }
    wrap.innerHTML = list.map(c => {
      const lastMsg = c.messages[c.messages.length - 1];
      const preview = (lastMsg.from === 'admin' ? 'You: ' : '') + lastMsg.text;
      return `
      <div class="conv-item${c.unread > 0 ? ' unread' : ''}${c.id === activeConvId ? ' active' : ''}" data-id="${c.id}">
        <img class="conv-avatar" src="${c.avatar}" alt="${c.name}"/>
        <div class="conv-body">
          <div class="conv-top-row">
            <div class="conv-name">${c.name}${c.flagged ? '<i class="fas fa-flag"></i>' : ''}</div>
            <div class="conv-time">${c.time}</div>
          </div>
          <div class="conv-preview">${preview}</div>
        </div>
        ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : ''}
      </div>`;
    }).join('');

    wrap.querySelectorAll('.conv-item').forEach(el => {
      el.addEventListener('click', () => {
        activeConvId = +el.dataset.id;
        const conv = CONVERSATIONS.find(c => c.id === activeConvId);
        if (conv) conv.unread = 0;
        renderConvList();
        renderThread();
        document.getElementById('inboxCard').classList.add('thread-open');
      });
    });
  }

  function renderThread(){
    const pane = document.getElementById('threadPane');
    const conv = CONVERSATIONS.find(c => c.id === activeConvId);
    if (!conv){
      pane.innerHTML = `<div class="inbox-empty"><i class="fas fa-comments"></i>Select a conversation to view messages</div>`;
      return;
    }
    pane.innerHTML = `
      <div class="thread-head">
        <button class="thread-back" id="threadBackBtn"><i class="fas fa-arrow-left"></i></button>
        <img src="${conv.avatar}" alt="${conv.name}"/>
        <div>
          <div class="thread-head-name">${conv.name}${conv.flagged ? '<i class="fas fa-flag" style="color:var(--red);font-size:10px"></i>' : ''}</div>
          <div class="thread-head-sub">${conv.role}</div>
        </div>
        <div class="thread-head-right">
          <button class="th-act-btn" title="View profile" onclick="toast('Opening ${conv.name}\\'s profile…')"><i class="fas fa-user"></i></button>
          <button class="th-act-btn" title="Flag conversation" onclick="toggleFlag(${conv.id})"><i class="fas fa-flag"></i></button>
          <button class="th-act-btn" title="Archive" onclick="toast('Conversation archived')"><i class="fas fa-box-archive"></i></button>
        </div>
      </div>
      <div class="thread-body" id="threadBody">
        ${conv.messages.map(m => `
          <div class="msg-row ${m.from === 'admin' ? 'out' : 'in'}">
            <img src="${m.from === 'admin' ? 'https://i.pravatar.cc/100?img=47' : conv.avatar}" alt=""/>
            <div>
              <div class="msg-bubble">${m.text}</div>
              <span class="msg-time">${m.time}</span>
            </div>
          </div>`).join('')}
      </div>
      <div class="thread-compose">
        <input id="composeInput" placeholder="Type a reply to ${conv.name}..."/>
        <button class="send-btn" id="sendBtn"><i class="fas fa-paper-plane"></i></button>
      </div>
    `;
    const body = document.getElementById('threadBody');
    body.scrollTop = body.scrollHeight;

    document.getElementById('threadBackBtn').addEventListener('click', () => {
      document.getElementById('inboxCard').classList.remove('thread-open');
    });
    const input = document.getElementById('composeInput');
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      conv.messages.push({ from:'admin', text, time:'Just now' });
      input.value = '';
      renderThread();
      renderConvList();
      toast('Message sent');
    };
    document.getElementById('sendBtn').addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  }

  function toggleFlag(id){
    const conv = CONVERSATIONS.find(c => c.id === id);
    if (!conv) return;
    conv.flagged = !conv.flagged;
    toast(conv.flagged ? 'Conversation flagged' : 'Flag removed');
    renderConvList();
    renderThread();
  }

  function bindEvents(){
    /* ── Top tab switching (All / Unread / Flagged) ── */
    document.querySelectorAll('.top-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentView = tab.dataset.view;
        renderConvList();
      });
    });

    /* ── Mark all as read ── */
    document.getElementById('markAllBtn').addEventListener('click', () => {
      CONVERSATIONS.forEach(c => c.unread = 0);
      document.getElementById('countUnread').textContent = '0';
      renderConvList();
      toast('All messages marked as read');
    });

    document.getElementById('convSearch').addEventListener('input', renderConvList);
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════ */
  function init(){
    attachShell();
    bindEvents();
    renderConvList();
    renderThread();
  }

  window.AuthorMessagesService = { init: init };
  window.toggleFlag = toggleFlag;
})();
