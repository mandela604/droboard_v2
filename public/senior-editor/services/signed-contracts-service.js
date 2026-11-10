/**
 * signed-contracts-service.js — Contract Details page logic (pure call-and-render). */
(function () {
'use strict';

const USE_API = true;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[SignedContractsService] backend unavailable, using demo data', e);
    return null;
  }
}

function attachShell(){
  if(!window.SeniorEditorSidebar||!window.SeniorEditorSidebar.attach)return;
  SeniorEditorSidebar.attach('#dashboardRoot', { activeItem: 'signed-contracts', title: 'Contract Details', user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' }, notifCount: 8, hideSearch: true, });
}

function init(){
  attachShell();  callBackend('/signed-contracts');
}

window.SignedContractsService={init:init};

})();
