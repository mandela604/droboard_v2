/**
 * author-verification-service.js — Data layer for Author Verification page
 * Reads from window.EditorDemo.AUTHOR_VERIFICATION / window.EditorDemo.RECENT_REVIEWS
 * Falls back to empty arrays if demo data is missing.
 */
(function(){
'use strict';
if(window.__authorVerificationService) return;
window.__authorVerificationService = true;

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/author-verification';
var TIMEOUT_MS = 2500;
function delay(ms){ return new Promise(function(r){ setTimeout(r, ms || 200 + Math.random()*200); }); }
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

function getDemo(){
  var D = window.EditorDemo || {};
  return {
    requests: JSON.parse(JSON.stringify(D.REQUESTS || [])),
    recentReviews: JSON.parse(JSON.stringify(D.RECENT_REVIEWS || []))
  };
}

function findIn(arr, idx){
  if(idx < 0 || idx >= arr.length) throw new Error('Not found: index ' + idx);
  return arr[idx];
}

window.AuthorVerificationService = {

  async getRequests(){
    try { return await timeoutFetch(API_BASE + '/requests'); }
    catch(e){ await delay(); return getDemo().requests; }
  },

  async getRecentReviews(){
    try { return await timeoutFetch(API_BASE + '/recent-reviews'); }
    catch(e){ await delay(); return getDemo().recentReviews; }
  },

  async approveRequest(idx, requests){
    try { await timeoutFetch(API_BASE + '/requests/' + idx + '/approve', {method:'POST'}); }
    catch(e){ await delay(100); }
    var r = requests[idx];
    if(r){
      r.status = 'approved';
      r.reviewer = { name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47' };
    }
    return r;
  },

  async rejectRequest(idx, requests){
    try { await timeoutFetch(API_BASE + '/requests/' + idx + '/reject', {method:'POST'}); }
    catch(e){ await delay(100); }
    var r = requests[idx];
    if(r){
      r.status = 'rejected';
      r.reviewer = { name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47' };
    }
    return r;
  }
};
})();
