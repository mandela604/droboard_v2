/**
 * edit-profile-service.js — Page logic for edit-profile.html (call-and-render)
 * HTML is markup only; all logic lives here and runs on script load.
 * DEMO: uses window.ProfileData (services/profile-data.js) for load/save.
 * Backend-ready: const USE_API=false, API_BASE='/api' reserved for live swap;
 *   when live, replace ProfileData calls with fetch(API_BASE + '/users/...').
 */
(function(){
'use strict';

const USE_API = false;
const API_BASE = '/api';

const GENRES_ALL = (window.ProfileData && ProfileData.GENRES_ALL) || [];
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
  const url = document.getElementById('fAvatar').value.trim();
  if (url) document.getElementById('avatarPreview').src = url;
}
function syncCover(){
  const url = document.getElementById('fCover').value.trim();
  document.getElementById('coverPreview').style.backgroundImage = url ? `url('${url}')` : 'none';
}
function promptAvatar(){
  const cur = document.getElementById('fAvatar').value;
  const next = prompt('Avatar image URL', cur || '');
  if (next === null) return;
  document.getElementById('fAvatar').value = next.trim();
  syncAvatar();
}
function promptCover(){
  const cur = document.getElementById('fCover').value;
  const next = prompt('Cover image URL', cur || '');
  if (next === null) return;
  document.getElementById('fCover').value = next.trim();
  syncCover();
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
  if (!PROFILE || !window.ProfileData){ toast('Profile service not loaded'); return; }
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
      email: email || undefined,
      bio: document.getElementById('fBio').value.trim(),
      location: document.getElementById('fLocation').value.trim(),
      avatar: document.getElementById('fAvatar').value.trim(),
      cover: document.getElementById('fCover').value.trim(),
    };

    const extraList = collectExtras();
    patch.about = {
      favoriteGenres: [...selectedGenres],
      extra: extraList,
    };

    let updated = await ProfileData.updateProfile(PROFILE.handle, patch);
    updated = await ProfileData.updateGenres(PROFILE.handle, [...selectedGenres]);
    PROFILE = updated || PROFILE;
    toast('Profile saved');
    setTimeout(() => { location.href = 'profile.html'; }, 500);
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
  if (!window.ProfileData){
    document.getElementById('loading').innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>ProfileData not found. Include services/profile-data.js';
    return;
  }
  try {
    ME = await ProfileData.getCurrentUserHandle();
    PROFILE = await ProfileData.getProfile(ME);
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
window.promptAvatar = promptAvatar;
window.promptCover = promptCover;
window.renderGenres = renderGenres;
window.renderExtras = renderExtras;
window.escAttr = escAttr;
window.fillForm = fillForm;
window.collectExtras = collectExtras;
window.saveAll = saveAll;
window.boot = boot;

})();
