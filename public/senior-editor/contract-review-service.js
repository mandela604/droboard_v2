var CT=[
  {value:'exclusive',label:'Exclusive Publishing',term:'12 months',rev:'70/30'},
  {value:'non-exclusive',label:'Non-Exclusive Publishing',term:'6 months',rev:'60/40'},
  {value:'revenue-share',label:'Revenue Share',term:'12 months',rev:'65/35'},
  {value:'licensing',label:'Licensing Agreement',term:'9 months',rev:'55/45'}
];
var items=[
  {id:'CTR-001',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',bookTitle:'The Last Horizon',bookGenre:'Sci-Fi',ct:'',term:'12 months',rev:'70/30',submitted:'2h ago',status:'pending',notes:'Standard exclusive deal request. Author initiated.',sent:false},
  {id:'CTR-002',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',bookTitle:'Wolf Kings Vow',bookGenre:'Fantasy',ct:'',term:'6 months',rev:'60/40',submitted:'5h ago',status:'pending',notes:'Non-exclusive request. Author retains rights.',sent:false},
  {id:'CTR-003',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',bookTitle:'Midnight Ember',bookGenre:'Romance',ct:'exclusive',term:'18 months',rev:'75/25',submitted:'1d ago',status:'approved',notes:'Premium exclusive. Author signed. Awaiting platform sign.',sent:true},
  {id:'CTR-004',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',bookTitle:'Streetlight Dreams',bookGenre:'Urban Fiction',ct:'revenue-share',term:'12 months',rev:'65/35',submitted:'2d ago',status:'signed',notes:'Completed. Revenue share with milestone bonuses.',sent:true},
  {id:'CTR-005',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',bookTitle:'Kingdom of Ashes',bookGenre:'Epic Fantasy',ct:'exclusive',term:'24 months',rev:'80/20',submitted:'3d ago',status:'signed',notes:'Long-term exclusive. Premium author.',sent:true},
  {id:'CTR-006',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',bookTitle:'Lagos After Dark',bookGenre:'Thriller',ct:'',term:'3 months',rev:'55/45',submitted:'4d ago',status:'pending',notes:'Short-term trial. Author initiated.',sent:false},
  {id:'CTR-007',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',bookTitle:'Crimson Petals',bookGenre:'Literary Fiction',ct:'exclusive',term:'12 months',rev:'70/30',submitted:'5d ago',status:'rejected',notes:'Contract terms rejected. Revenue split dispute.',sent:true},
  {id:'CTR-008',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',bookTitle:'Neon Streets',bookGenre:'Cyberpunk',ct:'revenue-share',term:'9 months',rev:'60/40',submitted:'6d ago',status:'signed',notes:'Completed. Standard revenue share.',sent:true},
  {id:'CTR-009',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',bookTitle:'Daughter of Wind',bookGenre:'YA Fantasy',ct:'exclusive',term:'12 months',rev:'70/30',submitted:'1w ago',status:'approved',notes:'Author signed. Awaiting platform final sign.',sent:true},
  {id:'CTR-010',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',bookTitle:'Shadow Protocol',bookGenre:'Action',ct:'non-exclusive',term:'6 months',rev:'55/45',submitted:'1w ago',status:'signed',notes:'Completed. Second contract for this author.',sent:true},
  {id:'CTR-011',author:'Sofia Lindqvist',avatar:'https://i.pravatar.cc/100?img=32',bookTitle:'Frozen Echoes',bookGenre:'Nordic Noir',ct:'',term:'',rev:'',submitted:'3h ago',status:'pending',notes:'Author just applied. Editor to select contract type.',sent:false},
  {id:'CTR-012',author:'Marcus Chen',avatar:'https://i.pravatar.cc/100?img=12',bookTitle:'The Silent Accord',bookGenre:'Mystery',ct:'',term:'',rev:'',submitted:'6h ago',status:'pending',notes:'New submission. Needs contract assignment.',sent:false}
];
var curPage=1,PP=5,openId=null,selCT={};
function ctLabel(v){for(var i=0;i<CT.length;i++){if(CT[i].value===v)return CT[i].label;}return '--';}
function ctTerm(v){for(var i=0;i<CT.length;i++){if(CT[i].value===v)return CT[i].term;}return '12 months';}
function ctRev(v){for(var i=0;i<CT.length;i++){if(CT[i].value===v)return CT[i].rev;}return '70/30';}
function filtered(){
  var q=(document.getElementById('searchInput').value||'').trim().toLowerCase();
  var st=document.getElementById('statusFilter').value;
  return items.filter(function(a){
    if(st&&a.status!==st)return false;
    if(q&&a.author.toLowerCase().indexOf(q)===-1&&a.id.toLowerCase().indexOf(q)===-1&&a.bookTitle.toLowerCase().indexOf(q)===-1)return false;
    return true;
  });
}
function stats(){
  var p=0,ap=0,s=0,r=0;
  for(var i=0;i<items.length;i++){if(items[i].status==='pending')p++;else if(items[i].status==='approved')ap++;else if(items[i].status==='signed')s++;else if(items[i].status==='rejected')r++;}
  document.getElementById('sP').textContent=p;
  document.getElementById('sA').textContent=ap;
  document.getElementById('sS').textContent=s;
  document.getElementById('sR').textContent=r;
}
function pill(s){
  var ic={pending:'fa-clock',approved:'fa-check-circle',signed:'fa-pen-fancy',rejected:'fa-ban'};
  return '<span class="status-pill '+s+'"><i class="fas '+ic[s]+'"></i> '+s.charAt(0).toUpperCase()+s.slice(1)+'</span>';
}
function render(){
  stats();
  var list=filtered(),total=list.length,tp=Math.max(1,Math.ceil(total/PP));
  if(curPage>tp)curPage=tp;
  var start=(curPage-1)*PP,page=list.slice(start,start+PP);
  var body=document.getElementById('tableBody');
  if(!body)return;
  if(!page.length){body.innerHTML='<div class="empty-msg"><i class="fas fa-file-circle-exclamation"></i>No contracts match your filters.</div>';document.getElementById('pageBtns').innerHTML='';document.getElementById('pageInfo').innerHTML='';return;}
  var html='';
  for(var i=0;i<page.length;i++){
    var a=page[i],isOpen=openId===a.id;
    var tl=a.ct?ctLabel(a.ct):'--';
    var acts='';
    if(a.status==='pending'){
      if(!a.sent){acts='<button class="btn btn-primary" onclick="event.stopPropagation();window._openD(\''+a.id+'\')"><span class="btn-text"><i class="fas fa-paper-plane"></i> Send</span></button>';}
      else{acts='<span class="waiting-tag"><i class="fas fa-hourglass-half"></i> Awaiting</span>';}
    }else if(a.status==='approved'){
      acts='<button class="btn btn-green" onclick="event.stopPropagation();window._doSign(\''+a.id+'\')"><span class="btn-text"><i class="fas fa-pen-fancy"></i> Sign</span></button><button class="btn btn-danger" onclick="event.stopPropagation();window._doReject(\''+a.id+'\')"><span class="btn-text"><i class="fas fa-xmark"></i></span></button>';
    }else if(a.status==='signed'){
      acts='<button class="btn btn-ghost" onclick="event.stopPropagation();window._dlPDF(\''+a.id+'\')"><i class="fas fa-download"></i> PDF</button>';
    }
    html+='<div><div class="item-row'+(isOpen?' is-open':'')+'" data-id="'+a.id+'">';
    html+='<div class="expand-ico"><i class="fas fa-chevron-right"></i></div>';
    html+='<div class="author-cell"><img src="'+a.avatar+'" alt=""><div class="author-info"><span class="author-name">'+a.author+'</span><span class="author-id">'+a.id+'</span></div></div>';
    html+='<div class="col-book"><div class="book-title">'+a.bookTitle+'</div><div class="book-genre">'+a.bookGenre+'</div></div>';
    html+='<div class="contract-type col-type">'+tl+'</div>';
    html+='<div>'+pill(a.status)+'</div>';
    html+='<div class="submitted col-submitted">'+a.submitted+'</div>';
    html+='<div class="actions-cell">'+acts+'</div>';
    html+='</div><div class="item-detail'+(isOpen?' show':'')+'" id="d-'+a.id+'"></div></div>';
  }
  body.innerHTML=html;
  if(openId)renderDetail(openId);
  document.getElementById('pageInfo').innerHTML='Showing <b>'+(start+1)+'</b> - <b>'+Math.min(start+PP,total)+'</b> of <b>'+total+'</b> contracts';
  renderPag(tp);
}
function renderDetail(id){
  var a=null;for(var i=0;i<items.length;i++){if(items[i].id===id){a=items[i];break;}}
  if(!a)return;
  var el=document.getElementById('d-'+id);if(!el)return;
  var isP=a.status==='pending',isA=a.status==='approved',isS=a.status==='signed',isR=a.status==='rejected',ro=isS||isR;
  var ctHtml='';
  if(isP&&!a.sent){
    var sv=selCT[id]||'';
    ctHtml='<div class="detail-contract-select"><div class="lbl"><i class="fas fa-file-contract"></i> Select Contract Type</div>';
    ctHtml+='<select id="cts-'+id+'" onchange="window._pickCT(\''+a.id+'\',this.value)"><option value="">-- Choose contract type --</option>';
    for(var j=0;j<CT.length;j++){ctHtml+='<option value="'+CT[j].value+'"'+(sv===CT[j].value?' selected':'')+'>'+CT[j].label+'</option>';}
    ctHtml+='</select></div>';
  }
  var selType=a.ct||selCT[id]||'';
  var term=a.term||ctTerm(selType),rev=a.rev||ctRev(selType),typeLabel=selType?ctLabel(selType):'--';
  var grid='<div class="detail-grid">';
  grid+='<div class="detail-card"><label>Book Title</label><b>'+a.bookTitle+'</b></div>';
  grid+='<div class="detail-card"><label>Genre</label><b>'+a.bookGenre+'</b></div>';
  grid+='<div class="detail-card"><label>Author</label><b>'+a.author+'</b></div>';
  grid+='<div class="detail-card"><label>Submitted</label><b>'+a.submitted+'</b></div></div>';
  var terms='';
  if(selType){
    terms='<div class="detail-grid">';
    terms+='<div class="detail-card accent"><label>Contract Type</label><b>'+typeLabel+'</b></div>';
    terms+='<div class="detail-card"><label>Term</label><b>'+term+'</b></div>';
    terms+='<div class="detail-card accent"><label>Revenue Split</label><b>'+rev+'</b></div>';
    terms+='<div class="detail-card"><label>Status</label><b>'+a.status.charAt(0).toUpperCase()+a.status.slice(1)+'</b></div></div>';
  }
  var roNote='';
  if(ro){roNote='<div style="background:var(--green-bg);border:1px solid rgba(22,163,74,.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:11.5px;color:var(--green);font-weight:600"><i class="fas fa-lock" style="margin-right:6px"></i>This contract is '+a.status+' and read-only.</div>';}
  var actsH='';
  if(isP&&!a.sent){
    actsH='<button class="btn btn-primary" id="sendBtn-'+id+'" onclick="window._doSend(\''+a.id+'\')" disabled><span class="btn-text"><i class="fas fa-paper-plane"></i> Send Contract to Author</span></button>';
    actsH+='<button class="btn btn-danger" onclick="window._doReject(\''+a.id+'\')"><span class="btn-text"><i class="fas fa-xmark"></i> Reject</span></button>';
  }else if(isP&&a.sent){
    actsH='<span class="waiting-tag" style="font-size:12px"><i class="fas fa-hourglass-half"></i> Waiting for author to sign...</span>';
  }else if(isA){
    actsH='<button class="btn btn-green" onclick="window._doSign(\''+a.id+'\')"><span class="btn-text"><i class="fas fa-pen-fancy"></i> Sign Contract</span></button>';
    actsH+='<button class="btn btn-danger" onclick="window._doReject(\''+a.id+'\')"><span class="btn-text"><i class="fas fa-xmark"></i> Reject</span></button>';
  }else if(isS){
    actsH='<span class="readonly-tag"><i class="fas fa-lock"></i> READ ONLY</span>';
    actsH+='<button class="btn btn-ghost" onclick="window._dlPDF(\''+a.id+'\')"><i class="fas fa-download"></i> Download PDF</button>';
  }else if(isR){
    actsH='<span class="readonly-tag" style="color:var(--red);background:var(--red-bg)"><i class="fas fa-lock"></i> REJECTED</span>';
  }
  var h='<div class="detail-inner">';
  h+='<div class="detail-header"><img class="detail-avatar" src="'+a.avatar+'" alt=""><div class="detail-title"><h3>'+a.author+'</h3><p>'+a.id+' | '+a.bookTitle+' | '+a.bookGenre+'</p></div>'+pill(a.status)+'</div>';
  h+=roNote+grid+ctHtml+terms;
  h+='<div class="detail-notes-box"><div class="lbl"><i class="fas fa-note-sticky"></i> Notes</div><p>'+a.notes+'</p></div>';
  h+='<div class="detail-actions">'+actsH+'</div></div>';
  el.innerHTML=h;
  if(isP&&!a.sent&&selCT[id]){var btn=document.getElementById('sendBtn-'+id);if(btn)btn.disabled=false;}
}
function renderPag(tp){
  var w=document.getElementById('pageBtns');if(tp<=1){w.innerHTML='';return;}
  var h='<button class="pg-btn"'+(curPage<=1?' disabled':'')+' onclick="window._go('+(curPage-1)+')"><i class="fas fa-chevron-left"></i></button>';
  for(var i=1;i<=tp;i++)h+='<button class="pg-btn'+(i===curPage?' active':'')+'" onclick="window._go('+i+')">'+i+'</button>';
  h+='<button class="pg-btn"'+(curPage>=tp?' disabled':'')+' onclick="window._go('+(curPage+1)+')"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML=h;
}
function toast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2400);}
window._go=function(p){curPage=p;render();};
window._openD=function(id){openId=openId===id?null:id;render();};
window._pickCT=function(id,val){
  selCT[id]=val;
  for(var i=0;i<items.length;i++){if(items[i].id===id&&val){items[i].ct=val;items[i].term=ctTerm(val);items[i].rev=ctRev(val);}}
  renderDetail(id);
  if(val){var btn=document.getElementById('sendBtn-'+id);if(btn)btn.disabled=false;}
};
window._doSend=function(id){
  var a=null;for(var i=0;i<items.length;i++){if(items[i].id===id){a=items[i];break;}}
  if(!a)return;
  var sel=document.getElementById('cts-'+id);
  if(!sel||!sel.value){toast('Please select a contract type first');return;}
  var btn=document.getElementById('sendBtn-'+id);
  if(btn){btn.classList.add('loading');btn.innerHTML='<span class="btn-text"><i class="fas fa-paper-plane"></i> Sending</span>';}
  setTimeout(function(){
    a.ct=sel.value;a.term=ctTerm(sel.value);a.rev=ctRev(sel.value);a.sent=true;
    openId=null;render();toast('Contract sent to '+a.author+' for signature');
  },800);
};
window._doSign=function(id){
  var a=null;for(var i=0;i<items.length;i++){if(items[i].id===id){a=items[i];break;}}
  if(!a)return;
  var row=document.querySelector('.item-row[data-id="'+id+'"]');
  if(row){var btn=row.querySelector('.btn-green');if(btn){btn.classList.add('loading');btn.innerHTML='<span class="btn-text"><i class="fas fa-pen-fancy"></i> Signing</span>';}}
  var det=document.getElementById('d-'+id);
  if(det){var dbtn=det.querySelector('.btn-green');if(dbtn){dbtn.classList.add('loading');dbtn.innerHTML='<span class="btn-text"><i class="fas fa-pen-fancy"></i> Signing</span>';}}
  setTimeout(function(){
    a.status='signed';openId=null;render();toast(a.author+' - contract signed and complete');
  },1000);
};
window._doReject=function(id){
  var a=null;for(var i=0;i<items.length;i++){if(items[i].id===id){a=items[i];break;}}
  if(!a)return;
  var row=document.querySelector('.item-row[data-id="'+id+'"]');
  if(row){var btn=row.querySelector('.btn-danger');if(btn){btn.classList.add('loading');btn.innerHTML='<span class="btn-text"><i class="fas fa-xmark"></i></span>';}}
  var det=document.getElementById('d-'+id);
  if(det){var dbtn=det.querySelector('.btn-danger');if(dbtn){dbtn.classList.add('loading');dbtn.innerHTML='<span class="btn-text"><i class="fas fa-xmark"></i> Rejecting</span>';}}
  setTimeout(function(){
    a.status='rejected';openId=null;render();toast(a.author+' - contract rejected');
  },700);
};
window._dlPDF=function(id){
  var a=null;for(var i=0;i<items.length;i++){if(items[i].id===id){a=items[i];break;}}
  if(!a)return;
  var tl=ctLabel(a.ct);
  var w=window.open('','_blank','width=700,height=900');
  var lines=[
    'DROBOARD PLATFORM - PUBLISHING CONTRACT','',
    '=======================================','',
    'Contract ID: '+a.id,
    'Status: '+a.status.toUpperCase(),'',
    '--- PARTIES ---',
    'Author: '+a.author,
    'Platform: Droboard Publishing','',
    '--- BOOK DETAILS ---',
    'Title: '+a.bookTitle,
    'Genre: '+a.bookGenre,'',
    '--- CONTRACT TERMS ---',
    'Type: '+tl,
    'Term: '+a.term,
    'Revenue Split: '+a.rev,'',
    '--- NOTES ---',
    a.notes,'',
    '=======================================',
    'Generated: '+new Date().toLocaleDateString()
  ];
  var doc='<html><head><title>'+a.id+' Contract</title>';
  doc+='<style>body{font-family:Courier New,monospace;padding:40px;font-size:13px;line-height:1.8;color:#1a1a1a}pre{white-space:pre-wrap}</style>';
  doc+='</head><body>';
  doc+='<h2 style="text-align:center">DROBOARD PLATFORM</h2>';
  doc+='<p style="text-align:center;color:#666">Publishing Contract</p><hr>';
  doc+='<pre>'+lines.join('\n')+'</pre>';
  doc+='<p style="text-align:center;margin-top:30px">';
  doc+='<button onclick="window.print()" style="padding:10px 24px;background:#ff0050;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer">Print / Save as PDF</button>';
  doc+='</p></body></html>';
  w.document.write(doc);
  w.document.close();
};
document.addEventListener('click',function(e){
  var row=e.target.closest('.item-row');
  if(row&&!e.target.closest('.actions-cell')){var id=row.dataset.id;openId=openId===id?null:id;render();}
});
document.getElementById('searchInput').addEventListener('input',function(){curPage=1;render();});
document.getElementById('statusFilter').addEventListener('change',function(){curPage=1;render();});
render();
