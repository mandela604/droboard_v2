(function(){
  'use strict';
  if(window.SeniorEditorsService) return;

  var PAGE_SIZE = 6;
  var ALL = [];
  var filtered = [];
  var currentPage = 1;
  var authorPool = [];
  var assignments = {};

  var ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
  var BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };

  function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function init(){
    console.log('[SeniorEditorsService] init called');
    window.ChiefEditorData.getSeniorEditors().then(function(data){
      console.log('[SeniorEditorsService] got editors:', data.length);
      ALL = data;
      return window.ChiefEditorData.getAuthorPool();
    }).then(function(data){
      console.log('[SeniorEditorsService] got authors:', data.length);
      authorPool = data;
      return window.ChiefEditorData.getAssignments();
    }).then(function(data){
      console.log('[SeniorEditorsService] got assignments:', Object.keys(data).length);
      assignments = data;
      renderStatCards();
      applyFilters();
      bindToolbar();
      console.log('[SeniorEditorsService] render complete');
    }).catch(function(err){
      console.error('[SeniorEditorsService] init error:', err);
      document.getElementById('edGrid').innerHTML = '<div class="empty-msg">Failed to load senior editors. Check console.</div>';
    });
  }

  function renderStatCards(){
    var behind = ALL.filter(function(e){return e.status==='behind';}).length;
    var totalAuthors = ALL.reduce(function(sum,e){return sum+e.authorsManaged;},0);
    var stats = [
      { n:ALL.length, l:'Senior Editors', ico:'fa-people-group', cls:'accent' },
      { n:ALL.length-behind, l:'On Track or Ahead', ico:'fa-circle-check', cls:'blue' },
      { n:behind, l:'Behind Quota', ico:'fa-triangle-exclamation', cls:'red' },
      { n:totalAuthors, l:'Authors Managed', ico:'fa-user-tie', cls:'purple' }
    ];
    document.getElementById('statCards').innerHTML = stats.map(function(s){
      return '<div class="stat-card"><div class="stat-ico" style="background:'+BG_MAP[s.cls]+';color:'+ICO_MAP[s.cls]+'"><i class="fas '+s.ico+'"></i></div><div><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div></div></div>';
    }).join('');
  }

  function applyFilters(){
    var q = document.getElementById('searchInput').value.trim().toLowerCase();
    var statusVal = document.getElementById('statusFilter').value;
    var sortVal = document.getElementById('sortSelect').value;

    filtered = ALL.filter(function(e){
      var matchesQ = !q || e.name.toLowerCase().indexOf(q)!==-1 || e.email.toLowerCase().indexOf(q)!==-1;
      var matchesStatus = statusVal==='all' || e.status===statusVal;
      return matchesQ && matchesStatus;
    });

    filtered.sort(function(a,b){
      if(sortVal==='name') return a.name.localeCompare(b.name);
      if(sortVal==='authors-desc') return b.authorsManaged-a.authorsManaged;
      if(sortVal==='quota-asc') return (a.invited/a.target)-(b.invited/b.target);
      if(sortVal==='pay-desc') return parseFloat(b.monthlyPay.replace(/[^0-9.]/g,''))-parseFloat(a.monthlyPay.replace(/[^0-9.]/g,''));
      return 0;
    });

    currentPage = 1;
    renderGrid();
  }

  function renderGrid(){
    document.getElementById('resultCount').textContent = filtered.length;
    var box = document.getElementById('edGrid');

    if(!filtered.length){
      box.innerHTML = '<div class="empty-msg"><i class="fas fa-user-slash" style="font-size:20px;margin-bottom:8px;display:block"></i>No senior editors match your filters.</div>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    var totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
    if(currentPage>totalPages) currentPage = totalPages;
    var start = (currentPage-1)*PAGE_SIZE;
    var pageItems = filtered.slice(start, start+PAGE_SIZE);

    box.innerHTML = pageItems.map(function(e){
      var pct = Math.min(100, Math.round(e.invited/e.target*100));
      var statusLabel = e.status==='behind' ? 'Behind' : e.status==='ahead' ? 'Ahead' : 'On track';
      var assigned = assignments[e.id] || [];
      var assignedCount = assigned.length;
      return '<div class="ed-card" data-id="'+e.id+'">' +
        '<div class="ed-top">' +
          '<img class="ed-avatar" src="'+esc(e.avatar)+'" alt="'+esc(e.name)+'"/>' +
          '<div class="ed-name-wrap">' +
            '<div class="ed-name">'+esc(e.name)+' '+(e.openReports>0?'<span class="report-dot" title="'+e.openReports+' open report(s)"></span>':'')+'</div>' +
            '<div class="ed-email">'+esc(e.email)+'</div>' +
          '</div>' +
          '<div class="ed-top-right">' +
            '<span class="ed-status '+e.status+'">'+statusLabel+'</span>' +
            '<div class="ed-dots-wrap">' +
              '<button class="ed-dots-btn" data-editor-id="'+e.id+'" title="More actions"><i class="fas fa-ellipsis-vertical"></i></button>' +
              '<div class="ed-dots-menu" data-menu-for="'+e.id+'">' +
                '<button class="ed-dots-item" data-editor-action="assign-authors" data-editor-id="'+e.id+'">' +
                  '<i class="fas fa-user-plus"></i> Assign Authors' +
                  (assignedCount?'<span class="ed-dots-badge">'+assignedCount+'</span>':'') +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ed-meta-row">' +
          '<div class="ed-meta-item"><span>Authors</span><b>'+e.authorsManaged+'</b></div>' +
          '<div class="ed-meta-item"><span>Assigned</span><b>'+assignedCount+'</b></div>' +
          '<div class="ed-meta-item"><span>Joined</span><b>'+esc(e.joined)+'</b></div>' +
          '<div class="ed-meta-item"><span>Payment</span><b><span class="pay-badge '+(e.paymentType||'fixed')+'">'+(e.paymentType==='revenue-share'?'Revenue Share':'Fixed Pay')+'</span></b></div>' +
          '<div class="ed-meta-item"><span>Pay</span><b>'+(e.paymentType==='revenue-share'?esc(e.revenueShare||'—')+' rev-share':esc(e.monthlyPay))+'</b></div>' +
          '<div class="ed-meta-item"><span>YTD Paid</span><b>'+esc(e.ytdPaid)+'</b></div>' +
        '</div>' +
        '<div>' +
          '<div class="ed-quota-label"><span>Invite quota \u2014 '+e.invited+'/'+e.target+'</span><span>Due '+esc(e.deadline)+'</span></div>' +
          '<div class="ed-quota-track"><div class="ed-quota-fill '+e.status+'" style="width:'+pct+'%"></div></div>' +
        '</div>' +
        '<div class="ed-actions">' +
          '<button class="mini-btn ghost" data-action="view" data-id="'+e.id+'"><i class="fas fa-eye"></i> View Profile</button>' +
          '<button class="mini-btn" data-action="message" data-id="'+e.id+'"><i class="fas fa-comment-dots"></i> Message</button>' +
          (e.status==='behind'
            ? '<button class="mini-btn danger" data-action="quota" data-id="'+e.id+'"><i class="fas fa-triangle-exclamation"></i> Take Action</button>'
            : '<button class="mini-btn" data-action="quota" data-id="'+e.id+'"><i class="fas fa-bullseye"></i> Manage Quota</button>') +
        '</div>' +
      '</div>';
    }).join('');

    renderPagination(totalPages);
    bindGridEvents();
  }

  function renderPagination(totalPages){
    var box = document.getElementById('pagination');
    if(totalPages<=1){
      box.innerHTML = '<div class="pg-info">Showing all '+filtered.length+' editor'+(filtered.length===1?'':'s')+'</div>';
      return;
    }

    var start = (currentPage-1)*PAGE_SIZE+1;
    var end = Math.min(filtered.length, currentPage*PAGE_SIZE);
    var pageBtns = '';

    for(var p=1;p<=totalPages;p++){
      pageBtns += '<button class="pg-btn'+(p===currentPage?' active':'')+'" data-page="'+p+'">'+p+'</button>';
    }

    box.innerHTML = '<div class="pg-info">Showing '+start+'\u2013'+end+' of '+filtered.length+' editors</div>' +
      '<div class="pg-controls">' +
        '<button class="pg-btn" id="pgPrev" '+(currentPage===1?'disabled':'')+'><i class="fas fa-chevron-left"></i></button>' +
        pageBtns +
        '<button class="pg-btn" id="pgNext" '+(currentPage===totalPages?'disabled':'')+'><i class="fas fa-chevron-right"></i></button>' +
      '</div>';

    document.getElementById('pgPrev').addEventListener('click', function(){ currentPage--; renderGrid(); });
    document.getElementById('pgNext').addEventListener('click', function(){ currentPage++; renderGrid(); });
    box.querySelectorAll('[data-page]').forEach(function(b){
      b.addEventListener('click', function(){ currentPage = parseInt(b.dataset.page,10); renderGrid(); });
    });
  }

  function bindToolbar(){
    var searchDebounce;
    document.getElementById('searchInput').addEventListener('input', function(){
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(applyFilters, 180);
    });
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('sortSelect').addEventListener('change', applyFilters);
    document.getElementById('inviteBtn').addEventListener('click', function(){
      if(typeof window.toast==='function') window.toast('Opening invite form\u2026');
    });
  }

  function bindGridEvents(){
    var toast = typeof window.toast==='function' ? window.toast : function(m){console.log(m);};

    document.querySelectorAll('.ed-dots-btn').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var id = btn.dataset.editorId;
        document.querySelectorAll('.ed-dots-menu.open').forEach(function(m){ if(m.dataset.menuFor!==id) m.classList.remove('open'); });
        var menu = document.querySelector('.ed-dots-menu[data-menu-for="'+id+'"]');
        menu.classList.toggle('open');
      });
    });

    document.addEventListener('click', function(e){
      if(!e.target.closest('.ed-dots-wrap')){
        document.querySelectorAll('.ed-dots-menu.open').forEach(function(m){ m.classList.remove('open'); });
      }
    });

    document.querySelectorAll('[data-editor-action="assign-authors"]').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var editorId = btn.dataset.editorId;
        var editor = ALL.find(function(x){return x.id===editorId;});
        if(!editor) return;
        document.querySelectorAll('.ed-dots-menu.open').forEach(function(m){m.classList.remove('open');});

        window.AssignAuthorsSheet.open({
          editorId: editorId,
          editorName: editor.name,
          editorAvatar: editor.avatar,
          authorPool: authorPool,
          assignedIds: assignments[editorId] || [],
          onSave: function(edId, newIds){
            assignments[edId] = newIds;
            window.ChiefEditorData.saveAssignments({}).then(function(){
              renderGrid();
              toast('Authors updated for '+editor.name);
            });
          }
        });
      });
    });

    document.querySelectorAll('[data-action]').forEach(function(el){
      el.addEventListener('click', function(){
        var editor = ALL.find(function(x){return x.id===el.dataset.id;});
        if(!editor) return;
        var action = el.dataset.action;
        if(action==='view') toast('Opening '+editor.name+'\'s profile\u2026');
        else if(action==='message') toast('Opening message thread with '+editor.name+'\u2026');
        else if(action==='quota') toast('Opening quota options for '+editor.name+'\u2026');
      });
    });
  }

  window.SeniorEditorsService = { init: init };
})();
