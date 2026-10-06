/** request-chapter-review-service.js — Data + UI for request-chapter-review.html. TODO: GET/POST /api/author/chapter-reviews */
(function () {
  'use strict';
  if (window.ChapterReviewService && window.ChapterReviewService.init) return;
  var Svc = window.ChapterReviewService || {};
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  /* Backend-ready API (preserved) */
  Svc.listBooks = Svc.listBooks || async function () { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books'); if (r.ok) return await r.json(); } catch (e) {} } await delay(); return []; };
  Svc.submit = Svc.submit || async function (d) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/chapter-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (r.ok) return await r.json(); } catch (e) {} } await delay(250); return { ok: true }; };

  /* ── Demo data (moved from inline) ── */
  var BOOKS = [
    {id:'b1',title:'The Midnight Protocol',cover:'https://picsum.photos/seed/book1/80/112',chapters:[
      {num:3,title:'Late Night Call',words:2410,status:'pending',date:'Submitted 2 hours ago',
        authorNotes:'Focused on pacing and the phone call scene. Let me know if the dialogue feels natural.',
        editorNotes:''},
      {num:4,title:'The Door She Finally Opened',words:2250,status:'revision',date:'Revision requested 1 day ago',
        authorNotes:'Rewrote the ending based on your last feedback. Added more tension.',
        editorNotes:'The pacing in the middle section drags. Cut paragraphs 4-6 and tighten the dialogue between Luna and Marcus. Also, the twist at the end needs better setup — add a foreshadowing line in the opening scene.'}
    ]},
    {id:'b2',title:'Echoes of Yesterday',cover:'https://picsum.photos/seed/book2/80/112',chapters:[
      {num:2,title:'Old Friends',words:2320,status:'pending',date:'Submitted 1 day ago',
        authorNotes:'Tightened the dialogue and added more emotional beats. Please check the pacing.',
        editorNotes:''}
    ]}
  ];

  var openBooks={b1:true};
  var currentBookId=null;
  var currentChNum=null;

  function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2400);}

  function renderBooks(){
    var el=document.getElementById('bookList');
    var hasAny=false;
    el.innerHTML=BOOKS.map(function(book){
      if(!book.chapters.length)return '';
      hasAny=true;
      var isOpen=openBooks[book.id];
      return '<div class="book-section'+(isOpen?' open':'')+'" data-bid="'+book.id+'">'
        +'<div class="book-header" onclick="toggleBook(\''+book.id+'\')">'
        +'<img class="book-cover" src="'+book.cover+'" alt=""/>'
        +'<div class="book-info"><div class="book-title">'+book.title+'</div>'
        +'<div class="book-meta">'+book.chapters.length+' chapter'+(book.chapters.length>1?'s':'')+' under review</div></div>'
        +'<i class="fas fa-chevron-down book-chevron"></i></div>'
        +'<div class="chapter-list" style="display:'+(isOpen?'flex':'none')+'">'
        +book.chapters.map(function(ch){
          var statusClass=ch.status==='pending'?'pending':'revision';
          var statusLabel=ch.status==='pending'?'Under Review':'Revision Needed';
          return '<div class="chapter-item" onclick="openDetail(\''+book.id+'\','+ch.num+')">'
            +'<span class="ch-num">'+ch.num+'</span>'
            +'<div class="ch-info"><div class="ch-name">'+ch.title+'</div>'
            +'<div class="ch-meta">'+ch.words.toLocaleString()+' words · '+ch.date+'</div></div>'
            +'<span class="ch-status '+statusClass+'">'+statusLabel+'</span></div>';
        }).join('')+'</div></div>';
    }).join('');
    if(!hasAny){
      el.innerHTML='<div class="empty"><i class="fas fa-clipboard-check"></i><p>No chapters under review.</p></div>';
    }
  }

  function toggleBook(bid){
    openBooks[bid]=!openBooks[bid];
    renderBooks();
  }

  function openDetail(bid,chNum){
    var book=BOOKS.find(function(b){return b.id===bid;});
    if(!book)return;
    var ch=book.chapters.find(function(c){return c.num===chNum;});
    if(!ch)return;
    currentBookId=bid;
    currentChNum=chNum;
    var statusClass=ch.status==='pending'?'pending':'revision';
    var statusLabel=ch.status==='pending'?'Under Review':'Revision Needed';
    var body=document.getElementById('detailBody');
    body.innerHTML='<div class="detail-chapter">Ch. '+ch.num+' — '+ch.title+'</div>'
      +'<div class="detail-book">'+book.title+'</div>'
      +'<div class="detail-meta">'+ch.words.toLocaleString()+' words · '+ch.date+'</div>'
      +'<div class="detail-status '+statusClass+'">'+statusLabel+'</div>'
      +'<div class="note-section">'
      +'<div class="note-label"><i class="fas fa-pen"></i> Your Notes</div>'
      +'<div class="note-box'+(ch.authorNotes?'':' empty-note')+'">'+(ch.authorNotes||'No notes submitted.')+'</div>'
      +'</div>'
      +'<div class="note-section">'
      +'<div class="note-label"><i class="fas fa-comment-dots"></i> Editor Feedback</div>'
      +'<div class="note-box editor'+(ch.editorNotes?'':' empty-note')+'">'+(ch.editorNotes||'Awaiting editor review.')+'</div>'
      +'</div>';
    var footer=document.getElementById('detailFooter');
    if(ch.status==='revision'){
      footer.innerHTML='<button class="modal-btn close-modal" onclick="closeDetail()">Close</button>'
        +'<button class="modal-btn edit" onclick="editChapter('+ch.num+')"><i class="fas fa-pen"></i> Edit Chapter</button>';
    }else{
      footer.innerHTML='<button class="modal-btn close-modal" onclick="closeDetail()" style="flex:1">Close</button>';
    }
    document.getElementById('detailModal').classList.add('open');
  }

  function closeDetail(){
    document.getElementById('detailModal').classList.remove('open');
  }

  function editChapter(num){
    window.location.href='edit-chapter.html?book='+(currentBookId||'b1')+'&chapter='+num;
  }

  function init(){
    if (window.AuthorDrawer) { try { window.AuthorDrawer.setTheme(window.AuthorDrawer.getTheme()); } catch (e) {} }
    renderBooks();
    document.getElementById('detailClose').onclick=closeDetail;
    document.getElementById('detailModal').onclick=function(e){if(e.target===this)closeDetail();};
    document.getElementById('backBtn').addEventListener('click',function(){if(window.history.length>1)window.history.back();else window.location.href='author-center.html';});
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('request-chapter-review.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
  }

  Svc.init = init;
  Svc.renderBooks = renderBooks;
  window.ChapterReviewService = Svc;
  /* onclick refs in markup + generated HTML */
  window.toggleBook = toggleBook;
  window.openDetail = openDetail;
  window.closeDetail = closeDetail;
  window.editChapter = editChapter;
})();
