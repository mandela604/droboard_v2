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

  /* Backend-ready API */
  Svc.get = Svc.get || async function (bookId, num) {
    var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/chapters/' + num, { credentials: 'include' });
    if (!r.ok) throw new Error('Chapter API failed: ' + r.status);
    return await r.json();
  };
  Svc.save = Svc.save || async function (bookId, num, payload) {
    var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/chapters/' + num, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('Save chapter failed: ' + r.status);
    return await r.json();
  };

  /* ── No demo data — fetch from API only ── */

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
    var bookId=params.get('book');
    var chapterParam=params.get('chapter')||'1';
    var isNew = chapterParam === 'new';
    var chapterNum=parseInt(chapterParam)||1;
    var isViewer=(params.get('viewer')||'')==='editor';

    if (!bookId) {
      document.getElementById('pageTitle').textContent = 'Error: No book selected';
      document.getElementById('editor').innerHTML = '<div style="color:var(--red);padding:20px"><i class="fas fa-exclamation-triangle"></i> Please select a book first</div>';
      return;
    }

    // Fetch chapter from API
    Svc.get(bookId, chapterNum)
      .then(function(data) {
        var book = data.book || {};
        var chapter = data.chapter || { n: chapterNum, title: '', status: 'draft', content: '' };
        
        document.getElementById('pageTitle').textContent = 'Ch. '+chapter.n+' — '+chapter.title;
        document.getElementById('chTitle').value = chapter.title;
        document.getElementById('editor').innerHTML = chapter.content || '';
        document.getElementById('chapterInfo').innerHTML =
          '<img class="chapter-cover" src="'+(book.cover||'../assets/droboard-icon.png')+'" alt=""/>'
          +'<div><div class="chapter-info-title">'+(book.title||'Untitled')+'</div>'
          +'<div class="chapter-info-meta">'+(book.genre||'Unknown')+'</div>'
          +'<div class="chapter-info-ch">Chapter '+chapter.n+'</div></div>';

        var banner=document.getElementById('statusBanner');
        banner.className='status-banner '+(chapter.status||'draft').replace('_','');
        banner.innerHTML=getStatusBanner(chapter.status||'draft');

        updateWordCount();
        document.getElementById('editor').addEventListener('input',updateWordCount);

        if(isViewer){
          var act=document.querySelector('.actions');
          if(act)act.style.display='none';
          var ed=document.getElementById('editor');
          ed.setAttribute('contenteditable','false');
          ed.style.caretColor='transparent';
          document.querySelectorAll('.editor-toolbar button').forEach(function(b){b.disabled=true;b.style.opacity='.45';b.style.cursor='default';});
          var ct=document.getElementById('chTitle');
          if(ct){ct.readOnly=true;ct.style.background='var(--l2,#f5f5f8)';}
        }

        document.getElementById('saveBtn').addEventListener('click',function(){
          var updatedChapter = {
            title: document.getElementById('chTitle').value.trim() || chapter.title,
            content: document.getElementById('editor').innerHTML
          };
          Svc.save(bookId, chapter.n, updatedChapter)
            .then(function() {
              toast('Chapter saved!');
              document.getElementById('reviewPrompt').classList.add('show');
            })
            .catch(function(e) {
              toast('Failed to save chapter: ' + (e.message || 'Unknown error'));
            });
        });

        document.getElementById('submitReviewBtn').addEventListener('click',function(){
          var updatedChapter = {
            title: document.getElementById('chTitle').value.trim() || chapter.title,
            content: document.getElementById('editor').innerHTML
          };
          Svc.save(bookId, chapter.n, updatedChapter)
            .then(function() {
              toast('Chapter saved!');
              document.getElementById('reviewPrompt').classList.add('show');
            })
            .catch(function(e) {
              toast('Failed to save chapter: ' + (e.message || 'Unknown error'));
            });
        });

        document.getElementById('applyReviewBtn').addEventListener('click',function(){
          var updatedChapter = {
            title: document.getElementById('chTitle').value.trim() || chapter.title,
            content: document.getElementById('editor').innerHTML,
            status: 'pending_review'
          };
          Svc.save(bookId, chapter.n, updatedChapter)
            .then(function() {
              banner.className='status-banner pending_review';
              banner.innerHTML=getStatusBanner('pending_review');
              document.getElementById('reviewPrompt').classList.remove('show');
              toast('Chapter submitted for review!');
            })
            .catch(function(e) {
              toast('Failed to submit for review: ' + (e.message || 'Unknown error'));
            });
        });
      })
      .catch(function(e) {
        console.error('Failed to load chapter:', e);
        document.getElementById('pageTitle').textContent = 'Error Loading Chapter';
        document.getElementById('editor').innerHTML = '<div style="color:var(--red);padding:20px"><i class="fas fa-exclamation-triangle"></i> <p>Failed to load chapter</p><p style="font-size:12px;margin-top:8px">' + (e.message || 'Please try again') + '</p></div>';
      });

    document.getElementById('backBtn').addEventListener('click',function(){
      if(window.history.length>1)window.history.back();else window.location.href='book-workspace.html';
    });

    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('edit-chapter.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
  }

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
