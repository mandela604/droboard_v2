/**
 * edit-profile-service.js — Page logic for edit-profile.html (call-and-render)
 * HTML is markup only; all logic lives here and runs on script load.
 * Live: uses /api/users/me for profile, /api/genres for genre list.
 */
(function(){
'use strict';

const API_BASE = '/api';

let GENRES_ALL = [];
let ME = null;
let PROFILE = null;
let selectedGenres = new Set();
let extras = [];

function toast(msg){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
function goBack(){
  if (history.length > 1) history.back();
  else location.href = 'profile.html';
}
function updateChar(id, countId, max){
  const el = document.getElementById(id);
  document.getElementById(countId).textContent = (el.value || '').length;
}
function syncAvatar(){
  const url = document.getElementById('fAvatar').value;
  if (url) document.getElementById('avatarPreview').src = url;
}
function syncCover(){
  const url = document.getElementById('fCover').value;
  document.getElementById('coverPreview').style.backgroundImage = url ? `url('${url}')` : 'none';
}
/* Image upload — no URL fields anywhere. The File goes straight to the
   backend (POST /api/uploads/image, Cloudflare Images) and the returned
   delivery URL lands in the hidden fAvatar/fCover inputs; saveAll already
   reads those inputs and PATCHes /api/users/me with the real URL. */
async function handleImageFile(ev, which){
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  toast('Uploading ' + (which === 'avatar' ? 'photo' : 'cover') + '…');
  try {
    const fd = new FormData();
    fd.append('file', f);
    const res = await fetch(API_BASE + '/uploads/image', { method: 'POST', credentials: 'include', body: fd });
    let j = null;
    try { j = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok || !j || !j.url) {
      const errMsg = (j && j.error) === 'images_not_configured'
        ? 'Image uploads are not configured yet — please contact support.'
        : ((j && (j.error || j.message)) || ('Upload failed (' + res.status + ')'));
      throw new Error(errMsg);
    }
    if (which === 'avatar'){ document.getElementById('fAvatar').value = j.url; syncAvatar(); }
    else { document.getElementById('fCover').value = j.url; syncCover(); }
    toast(which === 'avatar' ? 'Photo updated — save changes' : 'Cover updated — save changes');
  } catch (err) {
    toast('❌ ' + (err.message || 'Upload failed — try again.'));
  }
}

function renderGenres(){
  const grid = document.getElementById('genreGrid');
  grid.innerHTML = GENRES_ALL.map(g => {
    const on = selectedGenres.has(g.id) ? ' on' : '';
    return `<div class="genre-tog${on}" data-gid="${g.id}">${g.label}</div>`;
  }).join('');
  grid.querySelectorAll('.genre-tog').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.gid;
      if (selectedGenres.has(id)) selectedGenres.delete(id);
      else {
        if (selectedGenres.size >= 6){ toast('Max 6 genres'); return; }
        selectedGenres.add(id);
      }
      el.classList.toggle('on', selectedGenres.has(id));
    });
  });
}

function renderExtras(){
  const card = document.getElementById('extrasCard');
  while (extras.length < 3) extras.push({ icon: 'fa-star', label: '', value: '' });
  card.innerHTML = extras.slice(0,3).map((e,i) => `
    <div class="extra-row">
      <div class="extra-icon"><i class="fa-solid ${e.icon || 'fa-star'}"></i></div>
      <div class="extra-fields">
        <input data-ex="label" data-i="${i}" type="text" placeholder="Label (e.g. Website)" value="${escAttr(e.label || '')}"/>
        <input data-ex="value" data-i="${i}" type="text" placeholder="Value" value="${escAttr(e.value || '')}"/>
      </div>
    </div>
  `).join('') + `<div class="hint" style="margin-top:8px">Optional — website, writing schedule, tropes, reading goals…</div>`;
}

function escAttr(s){
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function fillForm(p){
  document.getElementById('fName').value = p.name || '';
  document.getElementById('fEmail').value = p.email || p.userEmail || '';
  document.getElementById('fBio').value = p.bio || '';
  document.getElementById('fLocation').value = p.location || '';
  document.getElementById('fAvatar').value = p.avatar || '';
  document.getElementById('fCover').value = p.cover || '';
  updateChar('fName','nameCount',40);
  updateChar('fBio','bioCount',180);
  syncAvatar();
  syncCover();

  const ring = document.getElementById('avRing');
  ring.classList.toggle('reader', !p.isWriter);

  document.getElementById('roleBadge').innerHTML = p.isWriter
    ? `<span class="role-pill writer"><i class="fa-solid fa-pen-nib"></i> Writer</span>`
    : `<span class="role-pill reader"><i class="fa-solid fa-book-open"></i> Reader</span>`;

  document.getElementById('subTitle').textContent = `@${p.handle}`;

  selectedGenres = new Set(p.genres || p.about?.favoriteGenres || []);
  renderGenres();

  extras = (p.about && Array.isArray(p.about.extra))
    ? p.about.extra.map(x => ({ icon: x.icon || 'fa-star', label: x.label || '', value: x.value || '' }))
    : [];
  renderExtras();
}

function collectExtras(){
  const labels = [...document.querySelectorAll('[data-ex="label"]')];
  const values = [...document.querySelectorAll('[data-ex="value"]')];
  const out = [];
  labels.forEach((lab, i) => {
    const label = lab.value.trim();
    const value = (values[i] && values[i].value.trim()) || '';
    if (label || value) {
      out.push({
        icon: (extras[i] && extras[i].icon) || 'fa-star',
        label: label || 'Note',
        value,
      });
    }
  });
  return out;
}

async function saveAll(){
  if (!PROFILE){ toast('Profile not loaded'); return; }
  const name = document.getElementById('fName').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  if (!name){ toast('Display name is required'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Enter a valid email'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…';

  try {
    const patch = {
      name,
      bio: document.getElementById('fBio').value.trim(),
      location: document.getElementById('fLocation').value.trim(),
      avatar: document.getElementById('fAvatar').value.trim(),
      cover: document.getElementById('fCover').value.trim(),
      genres: [...selectedGenres],
    };

    const extraList = collectExtras();
    if (extraList.length) {
      patch.about = { extra: extraList };
    }

    const res = await fetch(API_BASE + '/users/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    let saved = null;
    try { saved = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new Error((saved && (saved.error || saved.message)) || ('Save failed (' + res.status + ')'));

    PROFILE = { ...PROFILE, ...patch };

    /* Email changes run through the real request/confirm flow: the server
       mails a confirmation token, nothing changes until it's confirmed. */
    const newEmail = email && PROFILE.email && email !== PROFILE.email ? email : null;
    if (newEmail) {
      const mailRes = await fetch(API_BASE + '/users/me/email/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      });
      let mailBody = null;
      try { mailBody = await mailRes.json(); } catch (e) { /* empty body */ }
      if (!mailRes.ok) {
        throw new Error((mailBody && (mailBody.error || mailBody.message)) || ('Email change failed (' + mailRes.status + ')'));
      }
    }

    toast(newEmail ? 'Profile saved — check your new inbox to confirm the email change' : 'Profile saved');
    setTimeout(() => { location.href = 'profile.html'; }, newEmail ? 1200 : 500);
  } catch (err) {
    toast(err.message || 'Save failed');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Save changes';
  }
}

async function boot(){
  if (location.hash === '#email') {
    setTimeout(function(){
      var el=document.getElementById('fEmail');
      if(el){ el.focus(); el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.borderColor='var(--acc)'; setTimeout(function(){el.style.borderColor='';},1200); }
    },600);
  }
  
  try {
    // Load genres list (favourite-genre picker source)
    const genresRes = await fetch(API_BASE + '/genres?limit=100', { credentials: 'include' });
    if (!genresRes.ok) throw new Error('Genres API failed: ' + genresRes.status);
    const genresData = await genresRes.json();
    GENRES_ALL = ((genresData.items || genresData.genres || genresData.data) || []).map(g => ({ id: g.id || g.slug, label: g.name }));
    
    // Load current user profile
    const profileRes = await fetch(API_BASE + '/users/me', { credentials: 'include' });
    if (!profileRes.ok) throw new Error(profileRes.status === 401 ? 'Please sign in to edit your profile.' : ('Profile API failed: ' + profileRes.status));
    PROFILE = await profileRes.json();
    PROFILE = PROFILE.user || PROFILE.data || PROFILE;
    
    if (!PROFILE){
      document.getElementById('loading').innerHTML = '<i class="fa-solid fa-user-slash"></i>Could not load your profile.';
      return;
    }
    
    fillForm(PROFILE);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('editor').style.display = 'block';
    document.getElementById('saveBar').style.display = 'flex';
  } catch (err) {
    document.getElementById('loading').innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>${err.message || 'Failed to load'}`;
  }
}
boot();

// Expose identical window globals (inline onclick + prior global fns)
window.toast = toast;
window.goBack = goBack;
window.updateChar = updateChar;
window.syncAvatar = syncAvatar;
window.syncCover = syncCover;
window.handleImageFile = handleImageFile;
window.renderGenres = renderGenres;
window.renderExtras = renderExtras;
window.escAttr = escAttr;
window.fillForm = fillForm;
window.collectExtras = collectExtras;
window.saveAll = saveAll;
window.boot = boot;

})();
