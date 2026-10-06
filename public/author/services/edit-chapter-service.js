/**
 * edit-chapter-service.js — Data + UI layer for edit-chapter.html.
 * TODO backend: GET/PUT /api/author/books/:bookId/chapters/:num
 */
(function () {
  'use strict';
  if (window.EditChapterService && window.EditChapterService.init) return;
  var Svc = window.EditChapterService || {};
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  /* Backend-ready API (preserved) */
  Svc.get = Svc.get || async function (bookId, num) {
    if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/chapters/' + num); if (r.ok) return await r.json(); } catch (e) {} }
    await delay(); return { bookId: bookId, num: num, title: 'Chapter ' + num, content: '' };
  };
  Svc.save = Svc.save || async function (bookId, num, payload) {
    if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/chapters/' + num, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (r.ok) return await r.json(); } catch (e) {} }
    await delay(250); return { ok: true };
  };

  /* ── Demo data (moved from inline) ── */
  var BOOKS = [
    {id:'b1',title:'The Midnight Protocol',genre:'Romance',cover:'https://picsum.photos/seed/book1/100/140',chapters:[
      {n:1,title:'The Letter',status:'live',content:'<p>Dear Ms. Vale,</p><p>We are pleased to inform you that your manuscript has been selected for our exclusive publishing program. The committee was particularly impressed by the emotional depth of your characters and the unexpected twists in the plot.</p><p>Please review the attached terms and respond within 48 hours.</p><p>Best regards,<br/>The Editorial Team</p>'},
      {n:2,title:'First Meeting',status:'live',content:'<p>The office was exactly as she had imagined — floor-to-ceiling windows overlooking the city, modern art on the walls, and the faint scent of fresh coffee.</p><p>"Ms. Vale? I\'m Marcus Reed, the editor assigned to your project." He extended a hand, his grip firm but warm.</p><p>"Please, call me Luna," she said, settling into the chair across from his desk.</p>'},
      {n:3,title:'The Agreement',status:'pending_review',content:'<p>They spent the next three hours going over every detail of the contract. Luna\'s eyes lingered on the exclusivity clause.</p><p>"Twenty-four months," Marcus said, sliding the paper toward her. "That gives us time to build your brand properly."</p><p>Luna picked up the pen, hesitated, then signed. There was no turning back now.</p>'},
      {n:4,title:'Late Night Call',status:'revision_needed',content:'<p>Her phone buzzed at 11:47 PM. The screen glowed with Marcus\'s name.</p><p>"Luna, I just finished reading Chapter 12. We need to talk about the ending."</p><p>She sat up in bed, suddenly wide awake. "What about it?"</p><p>"It\'s too predictable. Your readers will see it coming from a mile away. Let\'s rewrite it."</p>'},
      {n:5,title:'Confession',status:'live',content:'<p>The rain hammered against the windows as Luna typed the final words of Chapter 15. Tears blurred her vision — not from sadness, but from the raw honesty she had poured into the scene.</p><p>Her phone lit up. A message from Marcus: "Whatever you just wrote — I felt it through the pages."</p>'}
    ]},
    {id:'b2',title:'Echoes of Yesterday',genre:'Drama',cover:'https://picsum.photos/seed/book2/100/140',chapters:[
      {n:1,title:'Return',status:'live',content:'<p>Five years away had not changed the town much. The same cracked sidewalks, the same oak tree outside the library, the same bench where they used to sit.</p><p>But everything else had changed. She was different now. Stronger. Or at least, she hoped so.</p>'},
      {n:2,title:'Old Friends',status:'live',content:'<p>"You\'re back." David stood in the doorway of the café, coffee in hand, looking exactly as she remembered.</p><p>"Just visiting," Elena said quickly.</p><p>"Sure." He smiled that familiar half-smile. "Just visiting."</p>'},
      {n:3,title:'The Truth',status:'live',content:'<p>She hadn\'t planned on telling him. But the words came out anyway, tumbling like stones down a hill.</p><p>"I left because I was scared. Not of you — of what we could have been."</p><p>David was quiet for a long time. Then: "And now?"</p>'}
    ]}
  ];

  function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2400);}

  function getStatusBanner(s){
    if(s==='pending_review')return '<i class="fas fa-clock"></i> Pending Review — waiting for editor';
    if(s==='revision_needed')return '<i class="fas fa-exclamation-circle"></i> Revision Needed — editor requested changes';
    return '<i class="fas fa-check-circle"></i> Live — published and visible to readers';
  }

  function fmt(cmd,val){document.execCommand(cmd,false,val||null);document.getElementById('editor').focus();}
  function insertBreak(){document.execCommand('insertHTML','<p style="text-align:center;color:var(--tx-faint)">— — —</p>');}

  function updateWordCount(){
    var text=document.getElementById('editor').innerText||'';
    var words=text.trim()?text.trim().split(/\s+/).length:0;
    document.getElementById('wordCount').textContent=words+' word'+(words!==1?'s':'');
  }

  function init(){
    if (window.AuthorDrawer) { try { window.AuthorDrawer.setTheme(window.AuthorDrawer.getTheme()); } catch (e) {} }
    var params=new URLSearchParams(location.search);
    var bookId=params.get('book')||'b1';
    var chapterParam=params.get('chapter')||'1';
    var isNew = chapterParam === 'new';
    var chapterNum=parseInt(chapterParam)||1;

    var book=BOOKS.find(function(b){return b.id===bookId;});
    if(!book)book=BOOKS[0];
    var chapter;
    if (isNew) {
      chapter = { n: 'New', title: '', status: 'draft', content: '' };
      document.getElementById('pageTitle').textContent='New Chapter — '+book.title;
      document.getElementById('chTitle').value='';
      document.getElementById('editor').innerHTML='';
      document.getElementById('chapterInfo').innerHTML=
        '<img class="chapter-cover" src="'+book.cover+'" alt=""/>'
        +'<div><div class="chapter-info-title">'+book.title+'</div>'
        +'<div class="chapter-info-meta">Draft</div>'
        +'<div class="chapter-info-ch">New chapter</div></div>';
    } else {
      chapter=book.chapters.find(function(c){return c.n===chapterNum;});
      if(!chapter)chapter=book.chapters[0];
    }

    document.getElementById('pageTitle').textContent = isNew ? 'New Chapter — '+book.title : 'Ch. '+chapter.n+' — '+chapter.title;
    document.getElementById('chTitle').value=chapter.title;
    document.getElementById('editor').innerHTML=chapter.content||'';
    if (!isNew) {
      document.getElementById('chapterInfo').innerHTML=
        '<img class="chapter-cover" src="'+book.cover+'" alt=""/>'
        +'<div><div class="chapter-info-title">'+book.title+'</div>'
        +'<div class="chapter-info-meta">'+book.genre+'</div>'
        +'<div class="chapter-info-ch">Chapter '+chapter.n+'</div></div>';
    }

    var banner=document.getElementById('statusBanner');
    banner.className='status-banner '+chapter.status.replace('_','');
    banner.innerHTML=getStatusBanner(chapter.status);

    updateWordCount();
    document.getElementById('editor').addEventListener('input',updateWordCount);

    document.getElementById('saveBtn').addEventListener('click',function(){
      chapter.title=document.getElementById('chTitle').value.trim()||chapter.title;
      chapter.content=document.getElementById('editor').innerHTML;
      document.getElementById('pageTitle').textContent='Ch. '+chapter.n+' — '+chapter.title;
      toast('Chapter saved!');
      document.getElementById('reviewPrompt').classList.add('show');
    });

    document.getElementById('submitReviewBtn').addEventListener('click',function(){
      chapter.title=document.getElementById('chTitle').value.trim()||chapter.title;
      chapter.content=document.getElementById('editor').innerHTML;
      document.getElementById('pageTitle').textContent='Ch. '+chapter.n+' — '+chapter.title;
      toast('Chapter saved!');
      document.getElementById('reviewPrompt').classList.add('show');
    });

    document.getElementById('applyReviewBtn').addEventListener('click',function(){
      chapter.status='pending_review';
      banner.className='status-banner pending';
      banner.innerHTML=getStatusBanner('pending_review');
      document.getElementById('reviewPrompt').classList.remove('show');
      toast('Chapter submitted for review!');
    });

    document.getElementById('backBtn').addEventListener('click',function(){
      if(window.history.length>1)window.history.back();else window.location.href='book-workspace.html';
    });

    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('edit-chapter.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
  }

  Svc.init = init;
  window.EditChapterService = Svc;
  /* onclick refs in markup */
  window.fmt = fmt;
  window.insertBreak = insertBreak;
})();
