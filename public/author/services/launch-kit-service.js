/**
 * launch-kit-service.js — Author-local UI layer for launch-kit.html.
 * Real data logic lives in ../marketing/shared/launch-kit-service.js until backend.
 * TODO backend: GET/POST /api/author/launch-kit
 */
(function () {
  'use strict';
  if (window.AuthorLaunchKitService && window.AuthorLaunchKitService.init) return;
  var Svc = window.AuthorLaunchKitService || {};

  /* Preserved passthrough note */
  Svc.passthrough = (Svc.passthrough !== undefined) ? Svc.passthrough : true;
  Svc.note = Svc.note || 'Uses ../marketing/shared/launch-kit-service.js. Replace with fetch to /api/author/launch-kit when backend live.';

  /* ── Page state (moved from inline) ── */
  var WRITER_ID='w_001';
  var WRITER_NAME='Tobi Adenuga';
  var selectedStory=null;
  var currentView='dashboard';

  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  function toast(msg){var el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.appendChild(el);setTimeout(function(){el.remove();},1500);}
  function copyText(text){navigator.clipboard.writeText(text).then(function(){toast('Copied!');}).catch(function(){var t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.left='-9999px';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('Copied!');});}
  function shareCampaign(){var k=window._currentCampaign;if(!k)return;if(navigator.share){navigator.share({title:k.campaignName,text:k.description,url:k.campaignLink}).catch(function(){});}else{copyText(k.campaignLink);toast('Campaign link copied!');}}
  function shareTo(platform,text,url){if(platform==='whatsapp'){window.open('https://wa.me/?text='+encodeURIComponent(text+' '+url),'_blank');}else if(platform==='facebook'){window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url)+'&quote='+encodeURIComponent(text),'_blank');}else{copyText(text);toast('Copied! Open '+platform+' and paste.');}}

  function generateQR(text){return '<div class="lk-qr" data-lkqr="'+esc(text)+'" style="width:80px;height:80px;background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0"><i class="fas fa-qrcode" style="color:#1a1730;font-size:22px"></i></div>';}
  function hydrateLaunchQR(){try{if(window.FlyerPreview&&FlyerPreview.qr){FlyerPreview.qr.draw(document.getElementById('pageContent'));}}catch(e){}}

  function searchStory(q){
    if(!q){document.getElementById('storyDropdown').style.display='none';return;}
    var lower=q.toLowerCase();
    var matches=window.StoryLibrary.filter(function(s){return s.title.toLowerCase().includes(lower)||s.genre.toLowerCase().includes(lower)||s.author.toLowerCase().includes(lower);}).slice(0,5);
    if(!matches.length){document.getElementById('storyDropdown').style.display='none';return;}
    document.getElementById('storyDropdown').innerHTML=matches.map(function(s){
      return '<div class="story-option" onclick="pickStory(\''+s.id+'\')"><img src="'+esc(s.cover)+'" alt=""/><div><div class="title">'+esc(s.title)+'</div><div class="genre">'+esc(s.genre)+' | '+esc(s.author)+'</div></div></div>';
    }).join('');
    document.getElementById('storyDropdown').style.display='block';
  }

  function pickStory(id){
    var s=window.StoryLibrary.find(function(x){return x.id===id;});if(!s)return;
    selectedStory=s;
    document.getElementById('storySearch').value='';
    document.getElementById('storyDropdown').style.display='none';
    var prev=document.getElementById('storyPreview');
    prev.style.display='flex';
    prev.querySelector('img').src=s.cover;
    prev.querySelector('h4').textContent=s.title;
    prev.querySelector('p').textContent=s.genre+' | '+s.author;
  }

  function clearStory(){selectedStory=null;document.getElementById('storyPreview').style.display='none';}

  function showCreateForm(){
    currentView='create';
    var el=document.getElementById('pageContent');
    var html='';
    html+='<div class="form-card">';
    html+='<div style="font-size:14px;font-weight:700;margin-bottom:14px">Create Campaign</div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Search Your Story</label><div class="story-search-wrap"><input id="storySearch" class="form-input" placeholder="Type story title..." oninput="searchStory(this.value)"/><div class="story-dropdown" id="storyDropdown"></div></div></div>';
    html+='<div id="storyPreview" class="story-preview" style="display:none"><img src="" alt=""/><div class="info"><h4></h4><p></p></div><button class="remove" onclick="clearStory()"><i class="fas fa-xmark"></i></button></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Campaign Name</label><input id="edName" class="form-input" placeholder="e.g. The Last Sunrise"/></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Description</label><textarea id="edDesc" class="form-input" placeholder="What is this campaign about?"></textarea></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Destination URL</label><input id="edDest" class="form-input" placeholder="https://..."/></div>';
    html+='<div class="form-row" style="margin-bottom:12px"><div><label class="form-label">CTA Button</label><input id="edCta" class="form-input" value="Read Now"/></div><div><label class="form-label">Launch Date</label><input id="edDate" class="form-input" type="date"/></div></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">WhatsApp Message</label><textarea id="edWa" class="form-input" placeholder="Status text..."></textarea></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Facebook Post</label><textarea id="edFb" class="form-input" placeholder="Post text..."></textarea></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">TikTok Script</label><textarea id="edTk" class="form-input" placeholder="Video script..."></textarea></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Instagram Caption</label><textarea id="edIg" class="form-input" placeholder="Caption..."></textarea></div>';
    html+='<div style="margin-bottom:14px"><label class="form-label">Excerpt / Hook</label><textarea id="edExcerpt" class="form-input" placeholder="A compelling excerpt..."></textarea></div>';
    html+='<div style="display:flex;gap:8px"><button class="form-btn form-btn-outline" onclick="showDashboard()">Cancel</button><button class="form-btn form-btn-primary" onclick="saveNewCampaign()">Create Campaign</button></div>';
    html+='</div>';
    el.innerHTML=html;
  }

  function saveNewCampaign(){
    var name=document.getElementById('edName').value.trim();
    if(!name){toast('Campaign name required');return;}
    var code=WRITER_NAME.split(' ')[0].toUpperCase()+new Date().getFullYear();
    var slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    var data={
      writerId:WRITER_ID,writerName:WRITER_NAME,
      campaignName:name,
      campaignType:'book',
      campaignImage:selectedStory?selectedStory.cover:'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop',
      campaignImageWide:selectedStory?selectedStory.cover.replace('w=300','w=600').replace('h=400','h=300'):'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=300&fit=crop',
      description:document.getElementById('edDesc').value,
      destination:document.getElementById('edDest').value||(selectedStory?selectedStory.link:''),
      cta:document.getElementById('edCta').value||'Read Now',
      referralCode:code,
      campaignLink:'https://droboard.app/c/'+slug+'?ref='+code,
      status:document.getElementById('edDate').value?'scheduled':'draft',
      launchDate:document.getElementById('edDate').value,
      analytics:{visitors:0,clicks:0,conversions:0,conversionRate:0},
      sources:{whatsapp:0,facebook:0,tiktok:0,instagram:0,direct:0},
      promoters:[],
      assets:{
        whatsapp:document.getElementById('edWa').value,
        facebook:document.getElementById('edFb').value,
        tiktok:document.getElementById('edTk').value,
        instagram:document.getElementById('edIg').value,
        excerpt:document.getElementById('edExcerpt').value,
        caption:''
      },
      rewards:[{threshold:10,label:'Homepage feature',earned:false},{threshold:50,label:'Premium badge',earned:false}],
      countdown:[]
    };
    window.LaunchKitService.create(data).then(function(){toast('Campaign created!');showDashboard();});
  }

  function showEditForm(k){
    currentView='edit';
    selectedStory=null;
    var el=document.getElementById('pageContent');
    var html='';
    html+='<div class="form-card">';
    html+='<div style="font-size:14px;font-weight:700;margin-bottom:14px">Edit Campaign</div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Search Your Story</label><div class="story-search-wrap"><input id="storySearch" class="form-input" placeholder="Type story title..." oninput="searchStory(this.value)"/><div class="story-dropdown" id="storyDropdown"></div></div></div>';
    html+='<div id="storyPreview" class="story-preview" style="display:none"><img src="" alt=""/><div class="info"><h4></h4><p></p></div><button class="remove" onclick="clearStory()"><i class="fas fa-xmark"></i></button></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Campaign Name</label><input id="edName" class="form-input" value="'+esc(k.campaignName)+'"/></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Description</label><textarea id="edDesc" class="form-input">'+esc(k.description)+'</textarea></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Destination URL</label><input id="edDest" class="form-input" value="'+esc(k.destination)+'"/></div>';
    html+='<div class="form-row" style="margin-bottom:12px"><div><label class="form-label">CTA Button</label><input id="edCta" class="form-input" value="'+esc(k.cta)+'"/></div><div><label class="form-label">Launch Date</label><input id="edDate" class="form-input" type="date" value="'+esc(k.launchDate)+'"/></div></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">WhatsApp Message</label><textarea id="edWa" class="form-input">'+esc(k.assets.whatsapp)+'</textarea></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Facebook Post</label><textarea id="edFb" class="form-input">'+esc(k.assets.facebook)+'</textarea></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">TikTok Script</label><textarea id="edTk" class="form-input">'+esc(k.assets.tiktok)+'</textarea></div>';
    html+='<div style="margin-bottom:12px"><label class="form-label">Instagram Caption</label><textarea id="edIg" class="form-input">'+esc(k.assets.instagram)+'</textarea></div>';
    html+='<div style="margin-bottom:14px"><label class="form-label">Excerpt / Hook</label><textarea id="edExcerpt" class="form-input">'+esc(k.assets.excerpt)+'</textarea></div>';
    html+='<div style="display:flex;gap:8px"><button class="form-btn form-btn-outline" onclick="showDashboard()">Cancel</button><button class="form-btn form-btn-primary" onclick="saveEditCampaign(\''+k.id+'\')">Save Changes</button></div>';
    html+='</div>';
    el.innerHTML=html;
  }

  function saveEditCampaign(id){
    var name=document.getElementById('edName').value.trim();
    if(!name){toast('Campaign name required');return;}
    var data={
      campaignName:name,
      description:document.getElementById('edDesc').value,
      destination:document.getElementById('edDest').value,
      cta:document.getElementById('edCta').value||'Read Now',
      launchDate:document.getElementById('edDate').value,
      assets:{
        whatsapp:document.getElementById('edWa').value,
        facebook:document.getElementById('edFb').value,
        tiktok:document.getElementById('edTk').value,
        instagram:document.getElementById('edIg').value,
        excerpt:document.getElementById('edExcerpt').value,
        caption:''
      }
    };
    if(selectedStory){
      data.campaignImage=selectedStory.cover;
      data.campaignImageWide=selectedStory.cover.replace('w=300','w=600').replace('h=400','h=300');
      data.destination=selectedStory.link;
    }
    window.LaunchKitService.update(id,data).then(function(){toast('Campaign updated!');showDashboard();});
  }

  function showDashboard(){
    currentView='dashboard';
    window.LaunchKitService.getByWriterId(WRITER_ID).then(function(kit){
      var el=document.getElementById('pageContent');
      if(!kit){
        el.innerHTML='<div class="empty-state"><i class="fas fa-bullseye"></i><p>No Campaign Yet</p><small>Create your first campaign to start sharing and tracking.</small><div style="margin-top:16px"><button class="form-btn form-btn-primary" style="width:auto;padding:10px 24px;display:inline-flex;align-items:center;gap:6px" onclick="showCreateForm()"><i class="fas fa-plus"></i> Create Campaign</button></div></div>';
        return;
      }
      window._currentCampaign=kit;
      var k=kit;
      var a=k.analytics;
      var pct=Math.min(100,Math.round((a.conversions/500)*100));
      var html='';

      html+='<div class="tab-bar"><div class="tab-item active" onclick="showDashboard()">Dashboard</div><div class="tab-item" onclick="showEditForm(window._currentCampaign)">Edit</div></div>';

      html+='<div class="campaign-banner">';
      html+='<img src="'+esc(k.campaignImageWide||k.campaignImage)+'" alt="'+esc(k.campaignName)+'"/>';
      html+='<div class="campaign-banner-overlay">';
      html+='<div class="campaign-banner-title">'+esc(k.campaignName)+'</div>';
      html+='<div class="campaign-banner-desc">'+esc(k.description)+'</div>';
      html+='</div>';
      html+='<div class="campaign-banner-badge">'+k.status+'</div>';
      html+='</div>';

      html+='<div class="stats-row">';
      html+='<div class="stat-item"><div class="stat-num">'+a.visitors.toLocaleString()+'</div><div class="stat-label">Visitors</div></div>';
      html+='<div class="stat-item"><div class="stat-num">'+a.clicks.toLocaleString()+'</div><div class="stat-label">Clicks</div></div>';
      html+='<div class="stat-item"><div class="stat-num">'+a.conversions.toLocaleString()+'</div><div class="stat-label">Conversions</div></div>';
      html+='</div>';

      html+='<div class="link-card">';
      html+='<div class="link-label">Your Referral Link</div>';
      html+='<div class="link-row"><div class="link-url">'+esc(k.campaignLink)+'</div><button class="link-btn" onclick="copyText(\''+esc(k.campaignLink)+'\')">Copy</button></div>';
      html+='<div class="qr-row">';
      html+='<div class="qr-box">'+generateQR(k.campaignLink)+'</div>';
      html+='<div class="qr-info"><p>Scan to visit your campaign</p><div class="qr-btns"><button class="btn btn-outline" style="padding:6px 10px;font-size:9.5px;border-radius:6px" onclick="alert(\'QR saved!\')"><i class="fas fa-download"></i> Save</button><button class="btn btn-outline" style="padding:6px 10px;font-size:9.5px;border-radius:6px" onclick="shareCampaign()"><i class="fas fa-share"></i> Share</button></div></div>';
      html+='</div></div>';

      html+='<div class="section"><div class="sec-title"><i class="fas fa-share-nodes"></i>Share Materials</div>';
      var platforms=[
        {key:'whatsapp',icon:'fa-whatsapp',color:'#25d366',label:'WhatsApp'},
        {key:'facebook',icon:'fa-facebook',color:'#1877f2',label:'Facebook'},
        {key:'tiktok',icon:'fa-tiktok',color:'#000',label:'TikTok'},
        {key:'instagram',icon:'fa-instagram',color:'#e1306c',label:'Instagram'}
      ];
      platforms.forEach(function(p){
        var text=k.assets[p.key]||'';if(!text)return;
        html+='<div class="share-card">';
        html+='<div class="share-card-platform"><i class="fab '+p.icon+'" style="color:'+p.color+'"></i><div class="name">'+p.label+'</div><button class="copy-btn" style="background:'+p.color+'" onclick="copyText(\''+esc(text)+'\')"><i class="fas fa-copy"></i> Copy</button></div>';
        html+='<div class="share-card-body">';
        html+='<img class="share-card-img" src="'+esc(k.campaignImageWide||k.campaignImage)+'" alt=""/>';
        html+='<div class="share-card-text">'+esc(text)+'</div>';
        html+='</div>';
        html+='<div class="share-card-actions">';
        html+='<button class="btn btn-'+p.key+'" onclick="shareTo(\''+p.key+'\',\''+esc(text)+'\',\''+esc(k.campaignLink)+'\')"><i class="fab '+p.icon+'"></i> Share</button>';
        html+='<button class="btn btn-copy" onclick="copyText(\''+esc(text)+'\')"><i class="fas fa-copy"></i> Copy</button>';
        html+='</div></div>';
      });
      html+='</div>';

      if(k.promoters&&k.promoters.length){
        html+='<div class="section"><div class="sec-title"><i class="fas fa-users"></i>Promoters</div>';
        html+='<div class="link-card">';
        k.promoters.forEach(function(p){
          html+='<div class="promoter-item"><div class="promoter-avatar">'+p.name[0]+'</div><div class="promoter-info"><div class="promoter-name">'+esc(p.name)+'</div><div class="promoter-stats">'+p.clicks+' clicks</div></div><div class="promoter-conversions">'+p.conversions+'</div></div>';
        });
        html+='</div></div>';
      }

      html+='<div class="section"><div class="sec-title"><i class="fas fa-chart-simple"></i>Analytics</div>';
      html+='<div class="analytics-grid">';
      html+='<div class="analytics-item"><div class="analytics-num" style="color:var(--blue)">'+a.visitors.toLocaleString()+'</div><div class="analytics-label">Visitors</div></div>';
      html+='<div class="analytics-item"><div class="analytics-num" style="color:var(--pink)">'+a.clicks.toLocaleString()+'</div><div class="analytics-label">CTA Clicks</div></div>';
      html+='<div class="analytics-item"><div class="analytics-num" style="color:var(--success)">'+a.conversions.toLocaleString()+'</div><div class="analytics-label">Conversions</div></div>';
      html+='<div class="analytics-item"><div class="analytics-num" style="color:var(--purple)">'+a.conversionRate+'%</div><div class="analytics-label">Conv. Rate</div></div>';
      html+='</div>';
      var maxSrc=Math.max.apply(null,Object.values(k.sources));
      ['whatsapp','facebook','tiktok','instagram','direct'].forEach(function(s){
        var count=k.sources[s]||0;var w=maxSrc>0?Math.round((count/maxSrc)*100):0;
        html+='<div class="source-bar"><div class="icon"><i class="fab fa-'+(s==='direct'?'link':s)+'" style="color:'+(s==='whatsapp'?'#25d366':s==='facebook'?'#1877f2':s==='tiktok'?'#000':s==='instagram'?'#e1306c':'var(--muted)')+'"></i></div><div class="bar"><div class="fill" style="width:'+w+'%;background:'+(s==='whatsapp'?'#25d366':s==='facebook'?'#1877f2':s==='tiktok'?'#000':s==='instagram'?'#e1306c':'var(--muted)')+'"></div></div><div class="count">'+count+'</div></div>';
      });
      html+='</div>';

      html+='<div class="section"><div class="sec-title"><i class="fas fa-trophy"></i>Rewards</div><div class="rewards-card">';
      k.rewards.forEach(function(r){
        html+='<div class="reward-item"><span class="reward-threshold">'+r.threshold+' conversions</span><span class="reward-label '+(r.earned?'done':'locked')+'">'+(r.earned?'Earned':'Locked')+' — '+esc(r.label)+'</span></div>';
      });
      html+='<div class="rewards-progress"><div class="rewards-bar" style="width:'+pct+'%"></div></div>';
      html+='</div></div>';

      if(k.countdown&&k.countdown.length){
        html+='<div class="section"><div class="sec-title"><i class="fas fa-clock"></i>Countdown</div>';
        k.countdown.forEach(function(c){
          html+='<div class="countdown-item"><div class="countdown-day">'+c.day+'</div><div class="countdown-text">'+esc(c.text)+'</div><button class="countdown-copy" onclick="copyText(\''+esc(c.text)+'\')"><i class="fas fa-copy"></i></button></div>';
        });
        html+='</div>';
      }

      el.innerHTML=html;
      hydrateLaunchQR();
    });
  }

  function init(){
    showDashboard();
  }

  Svc.init = init;
  Svc.showDashboard = showDashboard;
  window.AuthorLaunchKitService = Svc;
  /* onclick / oninput refs in markup + generated HTML */
  window.esc = esc;
  window.copyText = copyText;
  window.shareCampaign = shareCampaign;
  window.shareTo = shareTo;
  window.searchStory = searchStory;
  window.pickStory = pickStory;
  window.clearStory = clearStory;
  window.showCreateForm = showCreateForm;
  window.saveNewCampaign = saveNewCampaign;
  window.showEditForm = showEditForm;
  window.saveEditCampaign = saveEditCampaign;
  window.showDashboard = showDashboard;
})();
