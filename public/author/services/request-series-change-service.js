/** request-series-change-service.js — Data + UI for request-series-change.html. TODO: GET/POST /api/author/series-changes */
(function () {
  'use strict';
  if (window.SeriesChangeService && window.SeriesChangeService.init) return;
  var Svc = window.SeriesChangeService || {};
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  /* Backend-ready API (preserved) */
  Svc.list = Svc.list || async function () { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/series-changes'); if (r.ok) return await r.json(); } catch (e) {} } await delay(); return []; };
  Svc.submit = Svc.submit || async function (d) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/series-changes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (r.ok) return await r.json(); } catch (e) {} } await delay(250); return { ok: true }; };

  /* ── Demo data (moved from inline) ── */
  var SERIES = [
    {id:'s1',title:'The Midnight Saga',cover:'https://picsum.photos/seed/s1/100/140',chapters:48,desc:'A sweeping romance spanning two generations of love, betrayal, and redemption.',seasonList:[{id:'s1e1',name:'Season 1 — The Beginning',chapters:24},{id:'s1e2',name:'Season 2 — The Return',chapters:24}]},
    {id:'s2',title:'Echoes Collection',cover:'https://picsum.photos/seed/s2/100/140',chapters:24,desc:'Short stories exploring memory, loss, and the echoes we leave behind.',seasonList:[{id:'s2e1',name:'Season 1 — Memories',chapters:24}]},
    {id:'s3',title:'Crimson Timeline',cover:'https://picsum.photos/seed/s3/100/140',chapters:72,desc:'A thriller series following detective Noir across parallel timelines.',seasonList:[{id:'s3e1',name:'Season 1 — The Case',chapters:24},{id:'s3e2',name:'Season 2 — The Trail',chapters:24},{id:'s3e3',name:'Season 3 — The Truth',chapters:24}]}
  ];

  var CHANGES = [
    {icon:'fa-pen',label:'Change Title'},
    {icon:'fa-image',label:'Change Cover'},
    {icon:'fa-align-left',label:'Change Description'},
    {icon:'fa-layer-group',label:'Reorder Seasons'},
    {icon:'fa-tag',label:'Change Genre Tags'}
  ];

  function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2400);}

  function renderList(){
    document.getElementById('seriesList').innerHTML=SERIES.map(function(s){
      return '<div class="series-row" data-sid="'+s.id+'">'
        +'<div class="series-header">'
        +'<img class="series-cover" src="'+s.cover+'" alt=""/>'
        +'<div class="series-info"><div class="series-title">'+s.title+'</div>'
        +'<div class="series-meta">'+s.seasonList.length+' seasons · '+s.chapters+' chapters</div>'
        +'<div class="series-desc">'+s.desc+'</div></div>'
        +'<i class="fas fa-chevron-down series-chevron"></i></div>'
        +'<div class="series-accordion"><div class="accordion-inner">'
        +'<div class="change-options">'
        +CHANGES.map(function(c){
          return '<div class="change-opt" data-sid="'+s.id+'" data-change="'+c.label+'">'
            +'<i class="fas '+c.icon+'"></i>'+c.label
            +'<div class="change-check"><i class="fas fa-check"></i></div></div>';
        }).join('')
        +'</div>'
        +'<button class="submit-selected" data-sid="'+s.id+'"><i class="fas fa-paper-plane"></i> Submit Selected (<span class="sel-count">0</span>)</button>'
        +'</div></div></div>';
    }).join('');

    document.querySelectorAll('.series-header').forEach(function(h){
      h.addEventListener('click',function(e){
        if(e.target.closest('.change-opt')||e.target.closest('.submit-selected'))return;
        var row=h.parentElement;
        var wasOpen=row.classList.contains('open');
        document.querySelectorAll('.series-row').forEach(function(r){r.classList.remove('open');});
        if(!wasOpen)row.classList.add('open');
      });
    });

    document.querySelectorAll('.change-opt').forEach(function(opt){
      opt.addEventListener('click',function(e){
        e.stopPropagation();
        opt.classList.toggle('selected');
        var sid=opt.getAttribute('data-sid');
        updateSubmitBtn(sid);
      });
    });

    document.querySelectorAll('.submit-selected').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var sid=btn.getAttribute('data-sid');
        var selected=document.querySelectorAll('.change-opt.selected[data-sid="'+sid+'"]');
        var changes=[];
        selected.forEach(function(s){changes.push(s.getAttribute('data-change'));});
        if(changes.length) openModal(sid,changes);
      });
    });
  }

  function updateSubmitBtn(sid){
    var count=document.querySelectorAll('.change-opt.selected[data-sid="'+sid+'"]').length;
    var btn=document.querySelector('.submit-selected[data-sid="'+sid+'"]');
    var counter=btn.querySelector('.sel-count');
    counter.textContent=count;
    if(count>0)btn.classList.add('show');
    else btn.classList.remove('show');
  }

  function openModal(sid,changes){
    var series=SERIES.find(function(s){return s.id===sid;});
    if(!series)return;
    var title=changes.length===1?changes[0]:'Change Request';
    document.getElementById('modalTitle').textContent=title;
    document.getElementById('modalSeries').innerHTML=
      '<img src="'+series.cover+'" alt=""/>'
      +'<div><div class="modal-series-title">'+series.title+'</div>'
      +'<div class="modal-series-meta">'+series.seasonList.length+' seasons · '+series.chapters+' chapters</div></div>';
    document.getElementById('selectedTags').innerHTML=changes.map(function(c){
      return '<span class="selected-tag">'+c+'</span>';
    }).join('');
    document.getElementById('requestDetails').value='';
    document.getElementById('modalBodyTextarea').style.display='';
    document.getElementById('modalBodyReorder').style.display='none';
    document.getElementById('requestModal').classList.add('open');
    document.getElementById('requestModal')._sid=sid;
    document.getElementById('requestModal')._changes=changes;
  }

  function openReorderModal(sid){
    var series=SERIES.find(function(s){return s.id===sid;});
    if(!series)return;
    document.getElementById('modalTitle').textContent='Reorder Seasons';
    document.getElementById('modalSeries').innerHTML=
      '<img src="'+series.cover+'" alt=""/>'
      +'<div><div class="modal-series-title">'+series.title+'</div>'
      +'<div class="modal-series-meta">'+series.seasonList.length+' seasons · '+series.chapters+' chapters</div></div>';
    document.getElementById('modalBodyTextarea').style.display='none';
    document.getElementById('modalBodyReorder').style.display='';
    var list=document.getElementById('reorderList');
    list.innerHTML=series.seasonList.map(function(s,i){
      return '<div class="reorder-item" data-idx="'+i+'">'
        +'<i class="fas fa-grip-vertical reorder-handle"></i>'
        +'<span class="reorder-name">'+s.name+'</span>'
        +'<span class="reorder-chapters">'+s.chapters+' ch</span></div>';
    }).join('');
    document.getElementById('requestModal').classList.add('open');
    document.getElementById('requestModal')._sid=sid;
    document.getElementById('requestModal')._change='Reorder Seasons';
    initDrag(list);
  }

  function initDrag(list){
    var dragEl=null;
    list.querySelectorAll('.reorder-item').forEach(function(item){
      item.querySelector('.reorder-handle').addEventListener('mousedown',function(){dragEl=item;item.classList.add('dragging');});
      item.addEventListener('mouseover',function(){
        if(!dragEl||dragEl===item)return;
        var items=Array.from(list.children);
        var fromIdx=items.indexOf(dragEl);
        var toIdx=items.indexOf(item);
        if(fromIdx<toIdx){list.insertBefore(dragEl,item.nextSibling);}
        else{list.insertBefore(dragEl,item);}
      });
    });
    document.addEventListener('mouseup',function(){if(dragEl){dragEl.classList.remove('dragging');dragEl=null;}});
  }

  function closeModal(){
    document.getElementById('requestModal').classList.remove('open');
  }

  function submitRequest(){
    var modal=document.getElementById('requestModal');
    var sid=modal._sid;
    var changes=modal._changes;
    var series=SERIES.find(function(s){return s.id===sid;});
    var details=document.getElementById('requestDetails').value.trim();
    if(!details){document.getElementById('requestDetails').style.borderColor='var(--red)';return;}
    document.getElementById('requestDetails').style.borderColor='';
    var btn=document.querySelector('.modal-btn.send');
    btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Submitting…';
    setTimeout(function(){
      modal.classList.remove('open');
      btn.innerHTML='<i class="fas fa-paper-plane"></i> Submit';
      document.querySelectorAll('.change-opt.selected[data-sid="'+sid+'"]').forEach(function(o){o.classList.remove('selected');});
      updateSubmitBtn(sid);
      toast(series.title+' — '+changes.length+' change'+(changes.length>1?'s':'')+' submitted!');
    },1200);
  }

  function init(){
    if (window.AuthorDrawer) { try { window.AuthorDrawer.setTheme(window.AuthorDrawer.getTheme()); } catch (e) {} }
    renderList();
    document.getElementById('modalClose').onclick=closeModal;
    document.getElementById('requestModal').onclick=function(e){if(e.target===this)closeModal();};
    document.getElementById('backBtn').addEventListener('click',function(){if(window.history.length>1)window.history.back();else window.location.href='author-center.html';});
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('request-series-change.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
  }

  Svc.init = init;
  Svc.renderList = renderList;
  window.SeriesChangeService = Svc;
  /* onclick refs in markup */
  window.closeModal = closeModal;
  window.submitRequest = submitRequest;
})();
