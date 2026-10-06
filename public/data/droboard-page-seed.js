/* ═══════════════════════════════════════════════════════════════
   DROBOARD-PAGE SEED — Official page data
   Marketing-curated. No HTML reads this directly; service does.
   Covers reuse central-demo-data.js COVERS where available.
   ═══════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

const DROBOARD_HERO = {
  name:'Droboard', handle:'@droboard', verified:true,
  avatar:'../assets/droboard-icon.png',
  bio:'The official Droboard account. Announcements, writer shoutouts, live debates and the best story picks from across the platform — straight from the team that builds it. 🖤',
  topFollowers:'12.4k followers',
  stats:{ followers:'12.4k', posts:312, writersFeatured:0, founded:2021 },
  links:{ instagram:'@droboard.app', x:'@droboard', email:'hello@droboard.app', support:'support.droboard.app' },
  support:{ title:'Support Droboard', sub:'Help keep the platform ad-light and independent', cta:'Support' }
};

const DROBOARD_POSTS = [
  { id:'d1',  type:'announcement', pinned:true, time:'2d ago', title:'Welcome to the official Droboard page 👋', text:"This is home base for everything platform-wide — new features, community debates, standout writers, and the stories our team can't stop thinking about. Follow along and turn on notifications so you never miss a drop.", likes:2840, comments:312 },
  { id:'d2',  type:'debate', time:'5h ago', title:'Debate of the Week', rank:'🔥 Live Debate', debateData:{ motion:'"Writers should be allowed to tag spoilers instead of hiding them completely."', forV:4120, agV:2380, userVote:null }, likes:980, comments:640 },
  { id:'d3',  type:'shoutout', time:'8h ago', text:'Massive congratulations to one of our most-read writers this year 🎉 Her betrayal series has readers refreshing the app every midnight.', shoutout:{ id:'w1', tagline:'Just crossed 1M reads on their Betrayal series 🎉' }, likes:1560, comments:203 },
  { id:'d4',  type:'post', time:'11h ago', text:'This week on Droboard: betrayal stories are up 34%, debates are getting spicier, and someone in the comments called a plot twist "emotional damage." We felt that. 😭', likes:734, comments:98 },
  { id:'d5',  type:'repost', time:'1d ago', note:'Droboard Picks: if you love a slow-burn heartbreak that sneaks up on you by chapter 3 — start here.', storyRef:{ cat:'🌙 Elegy', title:'The letter folded in his jacket pocket — he died before he could send it', cover:'https://i.postimg.cc/N9jY0w4m/5.jpg', writer:'Efe_O' }, likes:512, comments:67 },
  { id:'d6',  type:'forum-poll', time:'1d ago', title:'Quick poll: what keeps you reading past midnight?', poll:{ q:'What keeps you reading past midnight?', opts:[{t:"A plot twist I didn't see coming",v:812},{t:'A slow-burn romance',v:540},{t:'A debate I need to win in the comments',v:301},{t:'A cliffhanger the writer left on purpose',v:698}], voted:-1, total:2351 }, likes:410, comments:88 },
  { id:'d7',  type:'ama', time:'2d ago', title:'Droboard Live: Ask the Team Anything', rank:'🎙 Droboard Live', amaData:{ isLive:false, viewers:0, title:'Droboard Live: Ask the Team Anything', meta:'Community features, moderation, and what\'s coming next — Friday 8pm WAT' }, likes:288, comments:54 },
  { id:'d8',  type:'shoutout', time:'2d ago', text:"Some writers just have a gift for endings. This one keeps making readers cry into their phones on public transport, and we're not sorry about it.", shoutout:{ id:'w6', tagline:'Their elegy series has the highest reread rate on the platform 📖' }, likes:1120, comments:141 },
  { id:'d9',  type:'announcement', time:'3d ago', title:'New: tag your comments with spoiler warnings', text:'You asked, we built it. Comments can now be marked as spoilers and get blurred until tapped. Try it on any story or debate thread.', likes:1980, comments:276 },
  { id:'d10', type:'post', time:'4d ago', text:'Reminder: the debate leaderboard resets every Sunday. Current #1 debater has a 68% win rate across 40 debates. Can anyone dethrone them this week?', likes:645, comments:132 },
];

const DROBOARD_MORE_POSTS = [
  { id:'d11', type:'shoutout', time:'5d ago', text:'New voice, big talent. Three chapters in and the comments are already begging for a season 2.', shoutout:{ id:'w3', tagline:'Rising fast in Family drama — 3 chapters, 40k reads already' }, likes:390, comments:52 },
  { id:'d12', type:'debate', time:'6d ago', title:"Last week's debate — final results", debateData:{ motion:'"Revenge arcs are more satisfying than reconciliation arcs."', forV:5800, agV:3400, userVote:'for' }, likes:820, comments:410 },
  { id:'d13', type:'repost', time:'6d ago', note:'Droboard Picks: campus stories rarely get this specific. If you went to a Nigerian university, you will feel personally attacked.', storyRef:{ cat:'🎓 Campus', title:'The richest boy started sitting beside me every morning', cover:'https://i.postimg.cc/cgLZJNmC/8.jpg', writer:'CampusQueen' }, likes:298, comments:41 },
  { id:'d14', type:'announcement', time:'1w ago', title:'Platform milestone: 1 million debate votes cast', text:'One million votes across every debate on Droboard. Thank you for actually showing up to argue about fictional people\'s choices with us. It means everything.', likes:3100, comments:520 },
  { id:'d15', type:'post', time:'1w ago', text:"PSA: 'reading it for the plot' is a valid excuse for being on your phone at a family gathering. We don't make the rules. Okay, we do. But still.", likes:2210, comments:301 },
  { id:'d16', type:'shoutout', time:'2w ago', text:"She's been writing on Droboard since day one and every single series still hits. Legacy behavior.", shoutout:{ id:'w5', tagline:'One of our founding writers — 5 completed series and counting' }, likes:1780, comments:233 },
];

const DROBOARD_COLLECTIONS = [
  { id:'cc1', name:"Editors' Picks 2025", count:22, privacy:'public', covers:['https://i.postimg.cc/RqtfSQJJ/wife3.jpg','https://i.postimg.cc/N9jY0w4m/5.jpg','https://i.postimg.cc/WF1j4Pnh/6.jpg','https://i.postimg.cc/cgLZJNmC/8.jpg'] },
  { id:'cc2', name:'Debate-Worthy Endings', count:14, privacy:'public', covers:['https://i.postimg.cc/ftRZbhKx/3.jpg','https://i.postimg.cc/DJwFzKgd/4.jpg'] },
  { id:'cc3', name:'New Voices to Watch', count:9, privacy:'public', covers:['https://i.postimg.cc/0MyxNqfz/7.jpg','https://i.postimg.cc/23WvkFLH/images-(2).jpg','https://i.postimg.cc/fkdXzjSj/wife.jpg'] },
];

const DROBOARD_MANAGERS = [
  { handle:'Ada_Writes', role:'admin' },
  { handle:'Tobi_Adenuga', role:'editor' },
];

const DROBOARD_ALLOWED_TYPES = ['announcement','post','debate','shoutout','repost','forum-poll','ama'];

// Demo pools for composer — searchable, varied stats to verify behaviour
const DROBOARD_COMPOSER_USERS = [
  { id:'w1', name:'Ada_Writes', avatar:'https://i.pravatar.cc/100?img=32', handle:'Ada_Writes', stats:{reads:1280000,followers:48200,books:3}, isLive:true, ring:'ring-live' },
  { id:'w2', name:'CampusQueen', avatar:'https://i.pravatar.cc/100?img=12', handle:'CampusQueen', stats:{reads:340000,followers:12100,books:5}, ring:'ring-has' },
  { id:'w3', name:'Chiamaka_N', avatar:'https://i.pravatar.cc/100?img=47', handle:'Chiamaka_N', stats:{reads:98000,followers:3400,books:8}, ring:'ring-none' },
  { id:'w4', name:'Kemi_A', avatar:'https://i.pravatar.cc/100?img=28', handle:'Kemi_A', stats:{reads:56000,followers:2100,books:1}, ring:'ring-viewed' },
  { id:'w5', name:'Ifeanyi_Story', avatar:'https://i.pravatar.cc/100?img=53', handle:'Ifeanyi_Story', stats:{reads:890000,followers:32000,books:5}, ring:'ring-has' },
  { id:'w6', name:'Efe_O', avatar:'https://i.pravatar.cc/100?img=22', handle:'Efe_O', stats:{reads:210000,followers:8900,books:2}, ring:'ring-viewed' },
  { id:'w7', name:'Zara_M', avatar:'https://i.pravatar.cc/100?img=16', handle:'Zara_M', stats:{reads:15000,followers:520,books:1}, ring:'ring-none' },
  { id:'w8', name:'Dami_Cole', avatar:'https://i.pravatar.cc/100?img=64', handle:'Dami_Cole', stats:{reads:670000,followers:18900,books:4}, ring:'ring-has' },
  { id:'w9', name:'Bode_Rex', avatar:'https://i.pravatar.cc/100?img=15', handle:'Bode_Rex', stats:{reads:42000,followers:1100,books:2}, ring:'ring-none' },
  { id:'w10', name:'Ngozi_Pens', avatar:'https://i.pravatar.cc/100?img=26', handle:'Ngozi_Pens', stats:{reads:730000,followers:25000,books:6}, ring:'ring-live' },
  { id:'w11', name:'Luna_Grey', avatar:'https://i.pravatar.cc/100?img=45', handle:'Luna_Grey', stats:{reads:310000,followers:7800,books:3}, ring:'ring-has' },
  { id:'w12', name:'Tobi_Adenuga', avatar:'https://i.pravatar.cc/100?img=68', handle:'Tobi_Adenuga', stats:{reads:45000,followers:1800,books:1}, ring:'ring-viewed' },
];

const DROBOARD_COMPOSER_STORIES = [
  { id:'cs1', title:'The letter he never sent', cover:'https://i.postimg.cc/N9jY0w4m/5.jpg', author:'Efe_O', writer:'Efe_O', genre:'Elegy' },
  { id:'cs2', title:'His sweet revenge', cover:'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', author:'Ada_Writes', writer:'Ada_Writes', genre:'Betrayal' },
  { id:'cs3', title:'The richest boy started sitting beside me', cover:'https://i.postimg.cc/cgLZJNmC/8.jpg', author:'CampusQueen', writer:'CampusQueen', genre:'Campus' },
  { id:'cs4', title:'The wolf beside the bed', cover:'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', author:'Chiamaka_N', writer:'Chiamaka_N', genre:'Werewolf' },
  { id:'cs5', title:'His secret life', cover:'https://i.postimg.cc/0MyxNqfz/7.jpg', author:'Kemi_A', writer:'Kemi_A', genre:'Drama' },
  { id:'cs6', title:'Alpha bloodline', cover:'https://i.postimg.cc/fkdXzjS8/wolf.jpg', author:'Ifeanyi_Story', writer:'Ifeanyi_Story', genre:'Werewolf' },
  { id:'cs7', title:'Revenge is a dish we both ordered', cover:'https://i.postimg.cc/DJwFzKgd/4.jpg', author:'Zara_M', writer:'Zara_M', genre:'Revenge' },
  { id:'cs8', title:'Lagos after midnight', cover:'https://i.postimg.cc/ftRZbhKx/3.jpg', author:'Dami_Cole', writer:'Dami_Cole', genre:'Campus' },
  { id:'cs9', title:'The house on Willow Lane', cover:'https://i.postimg.cc/JDzmhWqj/2.jpg', author:'Bode_Rex', writer:'Bode_Rex', genre:'Horror' },
  { id:'cs10', title:'Inheritance war', cover:'https://i.postimg.cc/YGCkSw-33/1.jpg', author:'Ngozi_Pens', writer:'Ngozi_Pens', genre:'Family' },
  { id:'cs11', title:'Campus lies', cover:'https://i.postimg.cc/tY7KnJyr/images.jpg', author:'Luna_Grey', writer:'Luna_Grey', genre:'Campus' },
  { id:'cs12', title:'Alpha\'s stolen mate', cover:'https://i.postimg.cc/WF1j4Pnh/6.jpg', author:'Tobi_Adenuga', writer:'Tobi_Adenuga', genre:'Fantasy' },
];

global.DroboardPageSeed = { DROBOARD_HERO, DROBOARD_POSTS, DROBOARD_MORE_POSTS, DROBOARD_COLLECTIONS, DROBOARD_MANAGERS, DROBOARD_ALLOWED_TYPES, DROBOARD_COMPOSER_USERS, DROBOARD_COMPOSER_STORIES };

})(window);
