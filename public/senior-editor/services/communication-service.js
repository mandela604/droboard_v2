(function(){
'use strict';

/* ── Backend-ready header (for future API use; demo paths keep working) ── */
const USE_API = false;
const API_BASE = '/api/senior-editor';
async function callBackend(path, options){
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}

let shell = null;

/* Email + avatar mapped per author — matches the Authors page so the same
   person looks the same everywhere in the dashboard. */
const AUTHOR_INFO = {
  'Luna Skye':       { email: 'luna.skye@mail.com',      avatar: 'https://i.pravatar.cc/100?img=45' },
  'Elena Vasquez':   { email: 'elena.vasquez@mail.com',  avatar: 'https://i.pravatar.cc/100?img=47' },
  'Marcus Webb Jr.': { email: 'marcus.webbjr@mail.com',  avatar: 'https://i.pravatar.cc/100?img=12' },
  'Wren Okonkwo':    { email: 'wren.okonkwo@mail.com',   avatar: 'https://i.pravatar.cc/100?img=15' },
  'Isabelle Moreau': { email: 'isabelle.moreau@mail.com',avatar: 'https://i.pravatar.cc/100?img=25' },
};
const EDITOR_EMAIL = 'chioma.reddy@droboard.com';
const EDITOR_INBOX = 'editors@droboard.com';

/* Full thread bodies + tags, keyed by the message id from the data file.
   The base list only gives a short preview — this fills in the rest so the
   sheet reads like a real email thread. */
const THREAD_EXTRA = {
  'MSG-001': { tag: 'question', status: 'unread', messages: [
    { from: 'author', time: '2h ago', body: "Hi Chioma, I wanted to ask about the word count requirement for Chapter 24 of The CEO's Hidden Son. My draft is sitting at 3,450 words — is that enough to submit, or should I pad it out closer to 5k before sending it in? Don't want to get flagged for being short." },
  ]},
  'MSG-002': { tag: 'feedback', status: 'unread', messages: [
    { from: 'author', time: '5h ago', body: "Thanks for the notes on chapter 11. I've made the revisions and tightened up the pacing in the pack council scene like you suggested. Let me know if it reads better now — happy to do another pass if needed." },
  ]},
  'MSG-003': { tag: 'dispute', status: 'unread', messages: [
    { from: 'author', time: '1d ago', body: "I don't agree with the rejection of chapter 6. The content flagged as explicit is no more graphic than what's already published in similar mafia-genre stories on the platform. Can we revisit this or get a second opinion? I'd like to understand exactly which lines triggered the flag." },
  ]},
  'MSG-004': { tag: 'idea', status: 'awaiting-reply', messages: [
    { from: 'author', time: '2d ago', body: "I have an idea for a new series set in a dystopian college where scholarships are awarded through a brutal survival-style competition. Loosely Hunger-Games-meets-campus-drama. Would love your thoughts before I start drafting — is this something Droboard would want in the Campus & Revenge category, or does it need its own tag?" },
    { from: 'editor', time: '1d ago', body: "This sounds like a strong hook — I'd lean toward filing it under Campus & Revenge with a 'dark academia' tag rather than a new category. Send over a synopsis and first-chapter outline whenever you're ready and I'll take a proper look." },
  ]},
  'MSG-005': { tag: 'update', status: 'replied', messages: [
    { from: 'author', time: '3d ago', body: "Just wanted to let you know I'm planning to wrap up The Duke's Secret within the next 4-5 chapters. Been such a fun series to write — thank you for all the editorial support along the way." },
    { from: 'editor', time: '2d ago', body: "So glad to hear it's coming together well — it's been one of our strongest performers this quarter. Let's plan a proper send-off: I'll flag the final chapter for a Homepage Banner feature when it goes live. Congrats on finishing the series!" },
  ]},
};

const PER_PAGE = 4;
let allMsgs = [], filtered = [], activeStat = 'all', currentPg = 1;

async function init(){
  shell = SeniorEditorSidebar.attach('#commRoot', {
    activeItem: 'communication',
    title: 'Communication',
    subtitle: 'Author emails & team chat',
    user: { name: 'Chioma Reddy', role: 'Senior Editor', avatar: 'https://i.pravatar.cc/100?img=5' },
    notifCount: 4,
    onSearch: v => { document.getElementById('mailSearch').value = v; currentPg = 1; applyFilters(); }
  });

  const d = await SeniorEditorData.getMessages();

  allMsgs = d.messages.map(m => {
    const info = AUTHOR_INFO[m.from] || { email: m.from.toLowerCase().replace(/\s+/g,'.') + '@mail.com', avatar: 'https://i.pravatar.cc/100?img=1' };
    const extra = THREAD_EXTRA[m.id] || { tag: 'update', status: m.unread ? 'unread' : 'awaiting-reply', messages: [{ from: 'author', time: m.date, body: m.preview }] };
    return {
      ...m,
      email: info.email,
      avatar: info.avatar,
      tag: extra.tag,
      status: extra.status,
      thread: extra.messages,
    };
  });

  buildStats();
  buildFilterPills();
  applyFilters();

  document.getElementById('teamChat').innerHTML = d.teamChat.map(c => `
    <div class="chat-msg"><div class="cm-from">${c.from}</div>${c.text}<div class="cm-time">${c.time}</div></div>`).join('');

  document.getElementById('mailSearch').addEventListener('input', () => { currentPg = 1; applyFilters(); });
  document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);
  document.getElementById('sheetClose').addEventListener('click', closeSheet);
  document.getElementById('teamChatSend').addEventListener('click', sendTeamChat);
  document.getElementById('teamChatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendTeamChat(); });
}

function sendTeamChat(){
  const input = document.getElementById('teamChatInput');
  const text = input.value.trim();
  if (!text) return;
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.innerHTML = `<div class="cm-from">Chioma Reddy (you)</div>${text}<div class="cm-time">Just now</div>`;
  document.getElementById('teamChat').appendChild(el);
  input.value = '';
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function buildStats(){
  const total = allMsgs.length;
  const unread = allMsgs.filter(m => m.status === 'unread').length;
  const awaiting = allMsgs.filter(m => m.status === 'awaiting-reply').length;
  const replied = allMsgs.filter(m => m.status === 'replied').length;
  const stats = [
    { n: total,    l: 'Author Emails',   ico: 'fa-envelope',         clr: 'var(--accent)', bg: 'rgba(255,0,80,.1)' },
    { n: unread,   l: 'Unread',          ico: 'fa-envelope-open-text', clr: 'var(--accent)', bg: 'var(--accent-soft)' },
    { n: awaiting, l: 'Awaiting Reply',  ico: 'fa-hourglass-half',   clr: 'var(--amber)',  bg: 'var(--amber-bg)' },
    { n: replied,  l: 'Replied',         ico: 'fa-circle-check',     clr: 'var(--green)',  bg: 'var(--green-bg)' },
  ];
  document.getElementById('statRow').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-ico" style="background:${s.bg};color:${s.clr}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

function buildFilterPills(){
  const statuses = ['all', ...new Set(allMsgs.map(m => m.status))];
  const labels = { all: 'All', unread: 'Unread', 'awaiting-reply': 'Awaiting Reply', replied: 'Replied' };
  const counts = { all: allMsgs.length };
  allMsgs.forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });
  document.getElementById('filterRow').innerHTML = statuses.map(st => `
    <button class="filter-pill${st===activeStat?' on':''}" data-status="${st}">
      ${labels[st] || st}<span class="pill-count">${counts[st] || 0}</span>
    </button>`).join('');
  document.querySelectorAll('.filter-pill').forEach(p => p.addEventListener('click', () => {
    activeStat = p.dataset.status; currentPg = 1;
    document.querySelectorAll('.filter-pill').forEach(x => x.classList.toggle('on', x === p));
    applyFilters();
  }));
}

function applyFilters(){
  const q = document.getElementById('mailSearch').value.trim().toLowerCase();
  filtered = allMsgs.filter(m => {
    const matchSt = activeStat === 'all' || m.status === activeStat;
    const matchQ = !q || m.from.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q);
    return matchSt && matchQ;
  });
  document.getElementById('msgCount').textContent = `${filtered.length} of ${allMsgs.length}`;
  const maxPg = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  if (currentPg > maxPg) currentPg = maxPg;
  renderPage();
}

function renderPage(){
  const start = (currentPg - 1) * PER_PAGE;
  const page = filtered.slice(start, start + PER_PAGE);

  if (!page.length) {
    document.getElementById('messagesList').innerHTML = `<div class="empty-msg">No emails match your search.</div>`;
    document.getElementById('pgn').innerHTML = '';
    return;
  }

  document.getElementById('messagesList').innerHTML = page.map(m => `
    <div class="row-item${m.status==='unread'?' is-unread':''}" data-id="${m.id}">
      <img class="row-avatar" src="${m.avatar}" alt="${m.from}"/>
      <div class="row-main">
        <div class="row-top">
          ${m.status==='unread' ? '<span class="unread-dot"></span>' : ''}
          <span class="row-from">${m.from}</span>
          <span class="row-email">${m.email}</span>
        </div>
        <div class="row-subject">${m.subject}</div>
        <div class="row-preview">${m.preview}</div>
        <div class="row-meta">
          <span><i class="fas fa-clock"></i> ${m.date}</span>
          <span class="status-pill ${m.status}">${m.status.replace('-', ' ')}</span>
          <span class="tag-chip ${m.tag}">${m.tag}</span>
        </div>
      </div>
      <i class="fas fa-chevron-right row-chevron"></i>
    </div>`).join('');

  document.querySelectorAll('.row-item').forEach(el => el.addEventListener('click', () => openSheet(el.dataset.id)));
  renderPagination();
}

function renderPagination(){
  const total = filtered.length;
  const maxPg = Math.ceil(total / PER_PAGE);
  if (maxPg <= 1) { document.getElementById('pgn').innerHTML = ''; return; }
  const start = (currentPg - 1) * PER_PAGE + 1;
  const end = Math.min(currentPg * PER_PAGE, total);
  let btns = '';
  for (let i = 1; i <= maxPg; i++) btns += `<button class="pgn-btn${i===currentPg?' on':''}" data-pg="${i}">${i}</button>`;
  document.getElementById('pgn').innerHTML = `
    <span class="pgn-info">Showing ${start}–${end} of ${total}</span>
    <div class="pgn-btns">
      <button class="pgn-btn" id="pgPrev" ${currentPg===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>
      ${btns}
      <button class="pgn-btn" id="pgNext" ${currentPg===maxPg?'disabled':''}><i class="fas fa-chevron-right"></i></button>
    </div>`;
  document.getElementById('pgPrev').addEventListener('click', () => { currentPg--; renderPage(); });
  document.getElementById('pgNext').addEventListener('click', () => { currentPg++; renderPage(); });
  document.querySelectorAll('.pgn-btn[data-pg]').forEach(b => b.addEventListener('click', () => { currentPg = parseInt(b.dataset.pg); renderPage(); }));
}

/* ── Email thread sheet ── */
let sheetMsgId = null;

function openSheet(id){
  const m = allMsgs.find(x => x.id === id); if (!m) return;
  sheetMsgId = id;
  if (m.status === 'unread') { m.status = 'awaiting-reply'; buildStats(); buildFilterPills(); applyFilters(); }

  document.getElementById('sheetAvatar').src = m.avatar;
  document.getElementById('sheetSubject').textContent = m.subject;
  document.getElementById('sheetFromLine').textContent = `${m.from} · ${m.email}`;
  document.getElementById('sheetTags').innerHTML = `
    <span class="status-pill ${m.status}">${m.status.replace('-', ' ')}</span>
    <span class="tag-chip ${m.tag}">${m.tag}</span>`;

  document.getElementById('threadList').innerHTML = m.thread.map(t => `
    <div class="thread-msg ${t.from === 'editor' ? 'from-editor' : ''}">
      <div class="thread-msg-top">
        <span class="thread-msg-from">${t.from === 'editor' ? 'You (Editor)' : m.from}</span>
        <span class="thread-msg-time">${t.time}</span>
      </div>
      <div class="thread-msg-body">${t.body}</div>
    </div>`).join('');

  document.getElementById('replyText').value = '';
  document.getElementById('mailtoBtn').onclick = () => {
    const subject = encodeURIComponent(`Re: ${m.subject}`);
    const body = encodeURIComponent(document.getElementById('replyText').value || '');
    window.location.href = `mailto:${m.email}?subject=${subject}&body=${body}`;
  };
  document.getElementById('sendReplyBtn').onclick = () => sendReply(m);

  document.getElementById('sheetBackdrop').classList.add('open');
  document.getElementById('detailSheet').classList.add('open');
  document.getElementById('detailSheet').scrollTop = 0;
}

function sendReply(m){
  const text = document.getElementById('replyText').value.trim();
  if (!text) { toast('⚠️ Write a reply before sending'); return; }
  // In production this posts to your email API (e.g. Postmark/SendGrid send endpoint)
  // using EDITOR_INBOX as the From address. No such endpoint exists yet, so we
  // just reflect the reply in the thread locally.
  m.thread.push({ from: 'editor', time: 'Just now', body: text });
  m.status = 'replied';
  toast(`📨 Reply sent to ${m.email}`);
  closeSheet();
  buildStats(); buildFilterPills(); applyFilters();
}

function closeSheet(){
  document.getElementById('sheetBackdrop').classList.remove('open');
  document.getElementById('detailSheet').classList.remove('open');
  sheetMsgId = null;
}

window.CommunicationService = { init };

})();
