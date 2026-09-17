/**
 * admin-demo-data.js — Central demo data for Super Admin pages
 */
(function(){
'use strict';

var FIRST = ['Zara','Marcus','Nadia','Kelo','Ife','Diego','Lena','TJ','Aminah','Chidi','Priya','Wren','Rita','Sam','Femi','Ada','Kelechi','Tari','Ngozi','Ola','Tobi','Sade','Emeka','Bola','Yemi','Kunle','Aisha','Dami','Chidera','Musa'];
var LAST = ['M.','Webb Jr.','Cross','Writes','Solarin','Marsh','Okafor','Rourke','Cole','Blackwood','Nandan','Okonkwo','Chen','Okafor','Reddy','Lin','Uba','Benson','Fields','Adeyemi','Adenuga','Obi','Nnamdi','Bakare','Olawale','Ibrahim','Chukwu','Taiwo','Abiodun','Lawal'];
var GENRES = ['Romance','Fantasy','Thriller','Werewolf','Drama','Teen Fiction','Mystery'];
var STATUSES = ['active','active','active','active','pending','suspended'];
var GENRE_COLORS = { Romance:'#ff0050', Fantasy:'#9333ea', Thriller:'#2563eb', Werewolf:'#7c3aed', Drama:'#d97706', 'Teen Fiction':'#16a34a', Mystery:'#d4a017' };

function generateAuthors(n){
  var out = [];
  for(var i=0;i<n;i++){
    var name = FIRST[i%FIRST.length] + ' ' + LAST[(i*3)%LAST.length];
    var status = STATUSES[i % STATUSES.length];
    var books = 1 + (i % 22);
    var reads = Math.floor(Math.pow((i%400)+1, 2.05) * 4.1) + Math.floor(Math.random()*500);
    var revenue = Math.round(reads * 0.011 * (0.5+Math.random()));
    var joinedDaysAgo = 20 + (i*17)%900;
    out.push({
      id: 'au-' + (40000+i),
      name: name,
      status: status,
      books: books,
      reads: reads,
      revenue: revenue,
      verified: i % 5 === 0,
      genre: GENRES[i % GENRES.length],
      joinedDaysAgo: joinedDaysAgo,
      avatar: 'https://i.pravatar.cc/60?img=' + ((i%70)+1),
      bio: 'Award-winning author specializing in ' + GENRES[i % GENRES.length].toLowerCase() + ' stories.',
      email: name.toLowerCase().replace(/[^a-z]/g,'') + '@example.com',
      totalWords: (books * (30000 + Math.floor(Math.random()*70000))),
      avgRating: (3.5 + Math.random()*1.5).toFixed(1),
    });
  }
  return out;
}

var AUTHORS_AUTHORS = generateAuthors(1840);
var AUTHORS_GENRE_COLORS = GENRE_COLORS;
var AUTHORS_GENRES = GENRES;

/* ── USERS ── */
var USERS_GENRES = ['Romance & Betrayal','Twist & Drama','Werewolf & Fantasy','Mafia & Urban','Campus & Revenge','Elegy & Heartbreak','Historical & Regency','Billionaire & CEO','Mystery'];
var USERS_GENRE_COLORS = { 'Romance & Betrayal':'#ff0050','Twist & Drama':'#d97706','Werewolf & Fantasy':'#9333ea','Mafia & Urban':'#2563eb','Campus & Revenge':'#16a34a','Elegy & Heartbreak':'#7c3aed','Historical & Regency':'#d4a017','Billionaire & CEO':'#e0384d','Mystery':'#5b4bcf' };
var PLATFORM_ROLES = ['Reader','Writer','Senior Editor','Chief Editor','Marketing','Finance'];

function generateUsers(n){
  var out = [];
  var seeded = [
    { id:'u1', name:'Ada_Writes', username:'ada_writes', email:'ada.writes@mail.com', role:'Writer', status:'active', verified:true, joined:'2024-05-12', lastActive:'2026-07-29', followers:15400, stories:2, reads:389000, payout:4010000, coinsSpent:0, following:0, comments:12, reports:0, notes:'Top-performing writer, two active titles.', readingHours:64, avgSessionMin:22, streakDays:9, topGenres:[{name:'Romance & Betrayal',count:31},{name:'Elegy & Heartbreak',count:14}], likesGiven:412, sharesCount:38, savesCount:76, tipsAmount:186000, platformRoles:[] },
    { id:'u2', name:'Ifeanyi_Story', username:'ifeanyi_story', email:'ifeanyi.story@mail.com', role:'Writer', status:'active', verified:true, joined:'2024-02-03', lastActive:'2026-07-28', followers:21200, stories:1, reads:312000, payout:3120000, coinsSpent:0, following:0, comments:4, reports:0, notes:'', readingHours:40, avgSessionMin:18, streakDays:3, topGenres:[{name:'Twist & Drama',count:22}], likesGiven:198, sharesCount:20, savesCount:44, tipsAmount:224000, platformRoles:[] },
    { id:'u3', name:'Chinelo_23', username:'chinelo_23', email:'chinelo23@mail.com', role:'Reader', status:'active', verified:false, joined:'2025-09-18', lastActive:'2026-07-29', followers:340, stories:0, reads:0, payout:0, coinsSpent:48000, following:38, comments:210, reports:0, notes:'', readingHours:210, avgSessionMin:41, streakDays:27, topGenres:[{name:'Romance & Betrayal',count:64}], likesGiven:890, sharesCount:112, savesCount:206, tipsAmount:34000, platformRoles:[] },
    { id:'u4', name:'KingDave', username:'king_dave', email:'kingdave@mail.com', role:'Reader', status:'suspended', verified:false, joined:'2025-01-22', lastActive:'2026-07-10', followers:120, stories:0, reads:0, payout:0, coinsSpent:12500, following:9, comments:340, reports:6, notes:'Suspended for repeated harassment in comments.', readingHours:58, avgSessionMin:12, streakDays:0, topGenres:[{name:'Mafia & Urban',count:19}], likesGiven:120, sharesCount:8, savesCount:15, tipsAmount:2000, platformRoles:[] },
    { id:'u5', name:'Zara_M', username:'zara_m', email:'zara.m@mail.com', role:'Writer', status:'active', verified:true, joined:'2023-11-30', lastActive:'2026-07-27', followers:9800, stories:1, reads:192000, payout:1740000, coinsSpent:0, following:0, comments:2, reports:0, notes:'', readingHours:52, avgSessionMin:20, streakDays:6, topGenres:[{name:'Mafia & Urban',count:18}], likesGiven:230, sharesCount:19, savesCount:33, tipsAmount:98000, platformRoles:[] },
    { id:'u6', name:'Blessing_O', username:'blessing_o', email:'blessing.o@mail.com', role:'Reader', status:'active', verified:true, joined:'2025-03-14', lastActive:'2026-07-29', followers:890, stories:0, reads:0, payout:0, coinsSpent:96000, following:64, comments:512, reports:0, notes:'One of our most engaged readers.', readingHours:340, avgSessionMin:52, streakDays:61, topGenres:[{name:'Elegy & Heartbreak',count:71}], likesGiven:1540, sharesCount:210, savesCount:388, tipsAmount:112000, platformRoles:[] },
    { id:'u7', name:'CampusQueen', username:'campus_queen', email:'campusqueen@mail.com', role:'Writer', status:'active', verified:true, joined:'2024-08-09', lastActive:'2026-05-01', followers:18700, stories:1, reads:134000, payout:1560000, coinsSpent:0, following:0, comments:1, reports:1, notes:'Contract lapsed; renewal outreach pending.', readingHours:12, avgSessionMin:9, streakDays:0, topGenres:[{name:'Campus & Revenge',count:9}], likesGiven:44, sharesCount:5, savesCount:8, tipsAmount:31000, platformRoles:[] },
    { id:'u8', name:'Emeka_T', username:'emeka_t', email:'emeka.t@mail.com', role:'Reader', status:'banned', verified:false, joined:'2025-06-02', lastActive:'2026-06-15', followers:45, stories:0, reads:0, payout:0, coinsSpent:3200, following:2, comments:88, reports:14, notes:'Banned for posting plagiarized content in comments.', readingHours:8, avgSessionMin:6, streakDays:0, topGenres:[{name:'Mafia & Urban',count:5}], likesGiven:12, sharesCount:1, savesCount:2, tipsAmount:0, platformRoles:[] },
    { id:'u9', name:'Kemi_A', username:'kemi_a', email:'kemi.a@mail.com', role:'Writer', status:'active', verified:true, joined:'2025-01-05', lastActive:'2026-07-29', followers:6200, stories:1, reads:96000, payout:830000, coinsSpent:0, following:0, comments:6, reports:0, notes:'', readingHours:33, avgSessionMin:16, streakDays:4, topGenres:[{name:'Romance & Betrayal',count:9}], likesGiven:140, sharesCount:12, savesCount:22, tipsAmount:52000, platformRoles:[] },
    { id:'u10', name:'Dami_Cole', username:'dami_cole', email:'dami.cole@mail.com', role:'Writer', status:'active', verified:false, joined:'2026-03-20', lastActive:'2026-07-26', followers:210, stories:1, reads:22400, payout:190000, coinsSpent:0, following:0, comments:0, reports:0, notes:'New writer, first title still ongoing.', readingHours:7, avgSessionMin:14, streakDays:2, topGenres:[{name:'Campus & Revenge',count:5}], likesGiven:22, sharesCount:2, savesCount:4, tipsAmount:6000, platformRoles:[] },
    { id:'u11', name:'Yusuf_Howl', username:'yusuf_howl', email:'yusuf.howl@mail.com', role:'Writer', status:'active', verified:true, joined:'2023-07-19', lastActive:'2026-07-29', followers:14300, stories:1, reads:210000, payout:1980000, coinsSpent:0, following:0, comments:9, reports:0, notes:'', readingHours:45, avgSessionMin:19, streakDays:11, topGenres:[{name:'Werewolf & Fantasy',count:26}], likesGiven:186, sharesCount:15, savesCount:29, tipsAmount:74000, platformRoles:[] },
    { id:'u12', name:'Doris_Vance', username:'doris_vance', email:'doris.vance@mail.com', role:'Writer', status:'active', verified:true, joined:'2024-01-11', lastActive:'2026-06-30', followers:5100, stories:1, reads:88000, payout:790000, coinsSpent:0, following:0, comments:3, reports:0, notes:'', readingHours:21, avgSessionMin:13, streakDays:2, topGenres:[{name:'Mystery',count:11}], likesGiven:66, sharesCount:6, savesCount:10, tipsAmount:19000, platformRoles:[] },
    { id:'u13', name:'PraiseUnending', username:'praise_unending', email:'praiseu@mail.com', role:'Reader', status:'active', verified:false, joined:'2026-04-02', lastActive:'2026-07-28', followers:560, stories:0, reads:0, payout:0, coinsSpent:15400, following:21, comments:76, reports:0, notes:'', readingHours:95, avgSessionMin:29, streakDays:15, topGenres:[{name:'Romance & Betrayal',count:31}], likesGiven:410, sharesCount:52, savesCount:88, tipsAmount:21000, platformRoles:[] },
    { id:'u14', name:'TheGreyFox', username:'the_grey_fox', email:'greyfox@mail.com', role:'Reader', status:'suspended', verified:false, joined:'2025-11-27', lastActive:'2026-07-05', followers:95, stories:0, reads:0, payout:0, coinsSpent:5100, following:5, comments:150, reports:5, notes:'Suspended pending review of spam reports.', readingHours:14, avgSessionMin:8, streakDays:0, topGenres:[{name:'Mystery',count:6}], likesGiven:30, sharesCount:3, savesCount:6, tipsAmount:1000, platformRoles:[] },
  ];
  for(var i=seeded.length;i<n;i++){
    var name = FIRST[i%FIRST.length]+' '+LAST[(i*3)%LAST.length];
    var status = ['active','active','active','suspended','banned'][i%5];
    var role = ['Reader','Writer'][i%2];
    var daysSinceJoined = 30+(i*23)%800;
    var dt = new Date(Date.now()-daysSinceJoined*86400000);
    out.push({
      id:'u'+(i+1), name:name, username:name.toLowerCase().replace(/[^a-z0-9]/g,'_'), email:name.toLowerCase().replace(/[^a-z]/g,'')+'@example.com',
      avatar:'https://i.pravatar.cc/100?img='+((i%70)+1), role:role, status:status, verified:i%7===0,
      joined:dt.toISOString().slice(0,10), lastActive:new Date(Date.now()-(i%30)*86400000).toISOString().slice(0,10),
      followers:Math.floor(Math.random()*12000), stories:role==='Writer'?1+(i%5):0, reads:role==='Writer'?Math.floor(Math.random()*300000):0,
      payout:role==='Writer'?Math.floor(Math.random()*3000000):0, coinsSpent:role==='Reader'?Math.floor(Math.random()*100000):0,
      following:role==='Reader'?Math.floor(Math.random()*80):0, comments:Math.floor(Math.random()*400),
      reports:status==='banned'?8+Math.floor(Math.random()*10):status==='suspended'?3+Math.floor(Math.random()*5):Math.floor(Math.random()*3),
      notes:'', readingHours:Math.floor(Math.random()*350), avgSessionMin:5+Math.floor(Math.random()*45),
      streakDays:status==='active'?Math.floor(Math.random()*60):0,
      topGenres:[{name:USERS_GENRES[i%USERS_GENRES.length],count:10+Math.floor(Math.random()*50)}],
      likesGiven:Math.floor(Math.random()*1500), sharesCount:Math.floor(Math.random()*200), savesCount:Math.floor(Math.random()*350),
      tipsAmount:Math.floor(Math.random()*200000), platformRoles:[]
    });
  }
  return seeded.concat(out);
}

var PLATFORM_USERS = generateUsers(86);

/* ═══════════════════════════════════════════════════════════════ */
window.AdminDemo = {
  AUTHORS_AUTHORS: AUTHORS_AUTHORS,
  AUTHORS_GENRE_COLORS: AUTHORS_GENRE_COLORS,
  AUTHORS_GENRES: AUTHORS_GENRES,
  PLATFORM_USERS: PLATFORM_USERS,
  PLATFORM_ROLES: PLATFORM_ROLES,
  USERS_GENRES: USERS_GENRES,
  USERS_GENRE_COLORS: USERS_GENRE_COLORS,
};

})();
