/**
 * users-service.js — Data layer for Users page
 * Reads from window.AdminDemo.PLATFORM_USERS / PLATFORM_ROLES
 */
(function(){
'use strict';
if(window.__usersService) return;
window.__usersService = true;

var _users = [];
var _roles = [];
var _genres = [];
var _genreColors = {};

function loadFromDemo(){
  var D = window.AdminDemo || {};
  _users = JSON.parse(JSON.stringify(D.PLATFORM_USERS || []));
  _roles = D.PLATFORM_ROLES || ['Reader','Writer','Senior Editor','Chief Editor','Marketing','Finance'];
  _genres = D.USERS_GENRES || [];
  _genreColors = D.USERS_GENRE_COLORS || {};
}
loadFromDemo();

function users(){ return _users; }
function roles(){ return _roles; }
function genres(){ return _genres; }
function genreColors(){ return _genreColors; }
function byId(id){ return _users.find(function(u){ return u.id === id; }); }

function stats(){
  var total = _users.length;
  var writers = _users.filter(function(u){ return u.role==='Writer'; }).length;
  var activeToday = _users.filter(function(u){
    var d = new Date(u.lastActive); var now = new Date();
    return Math.floor((now-d)/86400000) <= 0;
  }).length;
  var flagged = _users.filter(function(u){ return u.status!=='active'; }).length;
  return { total:total, writers:writers, activeToday:activeToday, flagged:flagged };
}

function search(query, role, status, sort){
  var q = (query||'').toLowerCase();
  var list = _users.filter(function(u){
    var matchQ = !q || u.name.toLowerCase().indexOf(q)!==-1 || u.username.toLowerCase().indexOf(q)!==-1 || u.email.toLowerCase().indexOf(q)!==-1;
    var matchR = !role || role==='all' || u.role===role;
    var matchS = !status || status==='all' || u.status===status;
    return matchQ && matchR && matchS;
  });
  if(sort==='name') list.sort(function(a,b){ return a.name.localeCompare(b.name); });
  else if(sort==='active') list.sort(function(a,b){ return new Date(b.lastActive)-new Date(a.lastActive); });
  else if(sort==='followers-desc') list.sort(function(a,b){ return b.followers-a.followers; });
  else if(sort==='reports-desc') list.sort(function(a,b){ return b.reports-a.reports; });
  else list.sort(function(a,b){ return new Date(b.joined)-new Date(a.joined); });
  return list;
}

function updateUser(id, changes){
  var u = byId(id);
  if(!u) return null;
  if(changes.name) u.name = changes.name;
  if(changes.username) u.username = changes.username;
  if(changes.email) u.email = changes.email;
  if(changes.role) u.role = changes.role;
  if(changes.status) u.status = changes.status;
  if(changes.notes !== undefined) u.notes = changes.notes;
  if(changes.platformRoles) u.platformRoles = changes.platformRoles;
  return u;
}

function deleteUser(id){
  var idx = _users.findIndex(function(u){ return u.id === id; });
  if(idx===-1) return null;
  return _users.splice(idx,1)[0];
}

function addUser(data){
  var u = Object.assign({
    id:'u'+(_users.length+1+Math.floor(Math.random()*90)),
    avatar:'https://i.pravatar.cc/100?img='+Math.floor(Math.random()*70),
    verified:false, joined:new Date().toISOString().slice(0,10), lastActive:new Date().toISOString().slice(0,10),
    followers:0, stories:0, reads:0, payout:0, coinsSpent:0, following:0, comments:0, reports:0,
    readingHours:0, avgSessionMin:0, streakDays:0, topGenres:[], likesGiven:0, sharesCount:0, savesCount:0, tipsAmount:0, platformRoles:[]
  }, data);
  _users.unshift(u);
  return u;
}

function assignRole(userId, role){
  var u = byId(userId);
  if(!u) return null;
  if(!u.platformRoles) u.platformRoles = [];
  if(u.platformRoles.indexOf(role)===-1) u.platformRoles.push(role);
  return u;
}

function removeRole(userId, role){
  var u = byId(userId);
  if(!u) return null;
  u.platformRoles = (u.platformRoles||[]).filter(function(r){ return r!==role; });
  return u;
}

window.__usersAPI = {
  users: users,
  roles: roles,
  genres: genres,
  genreColors: genreColors,
  byId: byId,
  stats: stats,
  search: search,
  updateUser: updateUser,
  deleteUser: deleteUser,
  addUser: addUser,
  assignRole: assignRole,
  removeRole: removeRole
};

})();
