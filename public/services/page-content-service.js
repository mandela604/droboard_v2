/**
 * page-content-service.js — Editable content for Terms, Privacy, FAQ pages.
 * Sections stored in localStorage; falls back to defaults below.
 * Consumed by system-pages editor and the rendered pages themselves.
 */
(function(){
'use strict';
if(window.PageContentService) return;

var KEY_PREFIX = 'dro_page_';

/* ── Default sections for Terms ── */
var TERMS_DEFAULTS = [
  { heading:'Introduction',
    body:'Welcome to Droboard ("Platform", "we", "our"). These Terms of Service ("Terms") govern your use of our website, services, and content.\n\nBy accessing or using Droboard, you agree to be bound by these Terms and our Privacy Policy. If you do not agree with any part of these Terms, you must not use our Platform. Please read these Terms carefully.' },
  { heading:'Eligibility & Account',
    body:'Age Requirements\n- You must be at least 13 years old to create an account.\n- If you are between 13-17, you represent that you have parental consent.\n- Users under 13 are prohibited from using the Platform.\n\nAccount Registration\n- You must provide accurate, current, and complete information during registration.\n- You are responsible for safeguarding your password.\n- You must notify us immediately of any unauthorized access to your account.\n- You may not use another person\'s account without permission.' },
  { heading:'User Content & Rights',
    body:'Your Content\nYou retain ownership of all content you create, publish, or share on Droboard. By submitting content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content on the Platform.\n\nContent Standards\nBy using Droboard, you agree not to post content that:\n- Is illegal, promotes violence, hate speech, or discrimination.\n- Infringes on others\' intellectual property rights.\n- Contains malware, spam, or deceptive practices.\n- Violates local laws or regulations.\n- Is sexually explicit or contains graphic violence.\n- Threatens, harasses, bullies, or harms others.\n- Impersonates others or provides false information.' },
  { heading:'Monetization & Payments',
    body:'Earnings Structure\n- Writers earn coins through reads, tips, and engagement metrics. Coins convert to fiat based on platform exchange rates.\n- Editors receive compensation for approved work per agreed terms and contracts.\n- Referrals earn bonuses for successful user referrals as outlined in our reward program.\n\nPayment Terms\n- Minimum withdrawal threshold applies (details in wallet settings).\n- Payments processed within 5-7 business days after approval.\n- Platform reserves right to hold payments pending investigation.\n- Invalid activity detected results in coin forfeiture and possible suspension.\n- Tax responsibilities remain with the earner.\n\nCoin System\nCoin transactions are final except when error originates from Droboard systems. We maintain detailed transaction history accessible through your account dashboard.' },
  { heading:'Intellectual Property',
    body:'Platform IP\nThe Droboard platform, including its design, logos, trademarks, and proprietary technology, is protected under international copyright and trademark laws.\n\nUser IP\nYou remain responsible for ensuring you have necessary rights to any content you upload. You indemnify Droboard against claims arising from IP infringement caused by your submissions.\n\nFair Use\nLimited portions of platform content may be used for personal, educational purposes under fair use doctrines applicable in your jurisdiction.' },
  { heading:'Prohibited Conduct',
    body:'Violations may result in immediate account suspension or termination without notice.\n\nYou agree not to:\n- Harvest or collect personal information from users without consent.\n- Use bots, scrapers, or automated tools to access the Platform contrary to stated APIs.\n- Attempt to gain unauthorized access to servers, accounts, or network features.\n- Interfere with or overburden platform services.\n- Reverse engineer, decompile, or disassemble any portion of Droboard.\n- Advertise or promote services not permitted under our guidelines.\n- Create accounts for fraudulent purposes or to evade restrictions.\n- Engage in coordinated manipulation of rankings, views, or earnings.' },
  { heading:'Content Moderation & Removal',
    body:'Droboard reserves the right to:\n- Review, flag, hide, or remove any content that violates these Terms.\n- Suspend or terminate accounts engaging in prohibited conduct.\n- Investigate suspected fraud, abuse, or policy violations.\n- Report illegal activities to appropriate authorities.\n\nWe strive to make moderation decisions fairly and promptly. Appeals can be submitted through our support channel.' },
  { heading:'Disclaimer of Warranties',
    body:'Droboard is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that:\n- Services will be uninterrupted, secure, or error-free.\n- Content is accurate, complete, or timely.\n- Results obtained from use of the Platform are reliable.\n- Defects will be corrected.\n\nTo the extent permitted by law, Droboard disclaims all warranties including merchantability, fitness for particular purpose, and non-infringement.' },
  { heading:'Limitation of Liability',
    body:'To the maximum extent permitted by applicable law, Droboard shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill. Our total liability shall not exceed amounts paid by you in the past 3 months or $100 USD, whichever is greater.\n\nThis limitation applies regardless of whether we were advised of potential damages.' },
  { heading:'Indemnification',
    body:'You agree to indemnify and hold harmless Droboard, its officers, employees, and agents from any claims, damages, liabilities, costs, and expenses (including reasonable legal fees) arising from:\n- Your use of the Platform.\n- Your violation of these Terms.\n- Your content or interaction with other users.\n- Infringement of third-party rights.' },
  { heading:'Modifications to Terms',
    body:'We reserve the right to modify these Terms at any time. Changes will be posted with an updated "Last Updated" date. Continued use after changes constitutes acceptance. Material changes will receive 30-day advance notice via email or platform notification.' },
  { heading:'Governing Law',
    body:'These Terms are governed by applicable federal laws and the laws of the jurisdiction in which Droboard operates, without regard to conflict of law provisions. Any disputes shall be resolved in courts with proper jurisdiction.' },
  { heading:'Contact Information',
    body:'For questions about these Terms, please contact us:\n- Email: legal@droboard.app\n- Support Portal: Available through app Settings → Help & Support\n\nBy continuing to use Droboard, you acknowledge that you have read, understood, and agree to these Terms of Service.' }
];

/* ── Default sections for Privacy ── */
var PRIVACY_DEFAULTS = [
  { heading:'Introduction',
    body:'Droboard ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Platform.\n\nWe only collect information necessary to operate Droboard and never sell your personal data to third parties.' },
  { heading:'Information We Collect',
    body:'Personal Information You Provide\n- Account Information: Email address, username, profile picture, display name, bio, location (optional).\n- Payment Details: Bank account or payment processor information for withdrawals (processed securely via PCI-compliant partners).\n- Communications: Messages sent through platform support channels, content reports, feedback.\n\nAutomatically Collected Data\n- Device Information: Device type, operating system, browser type, IP address.\n- Usage Data: Pages viewed, content interacted with, time spent on Platform, features used.\n- Reading Activity: Stories read, chapters completed, reading preferences (customizable in settings).\n- Cookies & Tracking: Session identifiers, preference storage, analytics.' },
  { heading:'How We Use Your Information',
    body:'We use collected information for the following purposes:\n- Service Operation: To provide, maintain, and improve Platform functionality.\n- Content Delivery: To serve personalized recommendations based on your preferences.\n- Transaction Processing: To manage payments, tips, earnings distribution, and withdrawal requests.\n- Communication: To send service-related notifications, updates, and respond to inquiries.\n- Safety & Security: To detect fraud, prevent abuse, and enforce Terms of Service.\n- Analytics: To understand usage patterns and improve user experience.\n- Legal Compliance: To meet legal obligations and protect our rights.' },
  { heading:'Information Sharing & Disclosure',
    body:'We do not sell your personal information. We share data only in the following circumstances:\n\nWith Your Consent\nWhen you explicitly choose to share information publicly (e.g., publishing stories, making your profile visible).\n\nService Providers\nWith trusted third-party vendors who perform services on our behalf:\n- Payment Processors: Paystack, Flutterwave for transaction handling.\n- Cloud Infrastructure: AWS for hosting, databases, and content delivery.\n- Email Services: Transactional email providers for notifications.\n- Analytics: Google Analytics (anonymized) for usage insights.\n\nLegal Requirements\n- To comply with applicable laws, regulations, or legal processes.\n- To respond to valid court orders, subpoenas, or government requests.\n- To protect against fraudulent activity or illegal behavior.\n- To protect the rights, property, and safety of Droboard or others.\n\nBusiness Transfers\nIn connection with any merger, sale of assets, acquisition, or bankruptcy, where user information may be transferred as part of the transaction.' },
  { heading:'Your Privacy Choices',
    body:'Profile Visibility Controls — You control who sees your activity through Settings → Privacy:\n- Public: Your profile, reading activity, and engagement visible to everyone.\n- Friends Only: Limited visibility to users you connect with.\n- Private: Hide all activity from public view.\n\nReading Activity Management\nToggle off "Show Reading Activity" in Settings to prevent it from appearing on your profile while retaining full Platform functionality.\n\nData Access & Export\nDownload a complete copy of your data at any time through Settings → Download My Data.\n\nMarketing Communications\nOpt-out of promotional emails by clicking the unsubscribe link in any marketing message. Service communications cannot be disabled.' },
  { heading:'Data Retention & Deletion',
    body:'Retention Period\nWe retain your information for as long as your account is active plus a reasonable period after closure for legal compliance, dispute resolution, and legitimate business purposes.\n\nAccount Deletion\nTo delete your account and remove your data:\n1. Go to Settings → Account → Delete Account.\n2. Confirm your decision and reason (optional).\n3. Receive confirmation email within 24 hours.\n\nNote: Some data may be retained anonymized for analytics and legal requirements.\n\nContact Support\nEmail support@droboard.app to request data deletion or modification at any time.' },
  { heading:'Data Security Measures',
    body:'We implement industry-standard security practices to protect your information:\n- Encryption: TLS/SSL encryption for all data in transit; AES-256 for data at rest.\n- Access Controls: Role-based access limiting employee data exposure.\n- Regular Audits: Third-party security assessments and penetration testing.\n- Secure Development: Security reviews throughout software development lifecycle.\n- Monitoring: 24/7 intrusion detection and anomaly monitoring systems.' },
  { heading:'International Data Transfers',
    body:'Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including Standard Contractual Clauses approved by relevant authorities.' },
  { heading:'Children\'s Privacy',
    body:'Droboard does not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal data, please contact us. We will take steps to delete such information promptly.' },
  { heading:'Changes to This Policy',
    body:'We may update this Privacy Policy periodically. Material changes will be communicated via email or prominent notice within the Platform. Continued use constitutes acceptance of updated terms.' },
  { heading:'Contact Us',
    body:'For privacy concerns, questions, or to exercise your rights, contact our Privacy Team:\n- Email: privacy@droboard.app\n- Response Time: We aim to respond to privacy requests within 30 days.\n\nEU GDPR Rights\nEU residents have additional rights including access, rectification, erasure, restriction, portability, and objection. Contact privacy@droboard.app to exercise these rights.\n\nCalifornia CCPA Rights\nCalifornia residents have rights to know, delete, and opt-out of data sales. See our California Notice of Collection for details.' }
];

var DEFAULTS = {
  'terms-of-service': { title:'Terms of Service', kind:'sections', sections:TERMS_DEFAULTS },
  'privacy-policy':   { title:'Privacy Policy',   kind:'sections', sections:PRIVACY_DEFAULTS },
  'faq':              { title:'Frequently Asked Questions', kind:'qa',
    qa:[
      { q:'How do I publish a story on Droboard?',
        a:'Go to your dashboard, click "Create New", fill in your title, cover, genre and first chapter, then submit for review. A Senior Editor typically responds within 3-5 business days.' },
      { q:'How long does book review take?',
        a:'Typically 3-5 business days. You will receive an in-app notification once your book is approved or rejected with a written reason.' },
      { q:'Can I edit my book after publishing?',
        a:'Yes. Open Your Library, find your book, and click Edit. Any changes go back to the Senior Editor who owns your book for re-approval before republishing.' },
      { q:'How do coins and tips work?',
        a:'Readers buy coins from the Store and use them to unlock chapters, tip writers, or send gifts. Bonus coins earned from promos can be read with but cannot be tipped.' },
      { q:'When and how do I get paid as a writer?',
        a:'Earnings accrue in USD on your Author Earnings page. Request a withdrawal once you hit the minimum threshold; Finance typically settles within 5-7 business days to your linked bank account.' },
      { q:'What happens if my content is reported?',
        a:'A Senior Editor flags the specific chapter and explains the reason. You can edit and resubmit. Repeated violations may escalate to a Chief Editor review and possible contract action.' },
      { q:'How do I contact support?',
        a:'From Settings, tap Help Center → Contact Support, or email support@droboard.app. We aim to reply within 24 hours.' },
      { q:'Can I hide my reading activity?',
        a:'Yes. Settings → Privacy → Reading Activity → toggle off. Your profile remains intact; only the visible history is hidden.' },
      { q:'How do contracts work?',
        a:'After your book is accepted, a Senior Editor sends you an offer template. Review the terms and sign. Signed books may receive editorial, marketing and monetisation support from Droboard.' },
      { q:'How do I delete my account?',
        a:'Settings → Account → Delete Account. Confirm and you will receive a confirmation email within 24 hours. Some anonymised data is retained for legal and analytics purposes.' }
    ]
  }
};

/* ── Storage ── */
function storageKey(id){ return KEY_PREFIX + id; }
function isEditable(id){ return !!DEFAULTS[id]; }

function get(id){
  if(!isEditable(id)) return null;
  var def = DEFAULTS[id];
  try{
    var raw = localStorage.getItem(storageKey(id));
    if(raw){
      var parsed = JSON.parse(raw);
      if(def.kind === 'qa'){
        if(parsed && Array.isArray(parsed.qa)) return parsed;
      } else {
        if(parsed && Array.isArray(parsed.sections)) return parsed;
      }
    }
  }catch(e){}
  if(def.kind === 'qa'){
    return { title: def.title, qa: def.qa.map(function(x){ return { q:x.q, a:x.a }; }) };
  }
  return { title: def.title, sections: def.sections.slice() };
}

function save(id, doc){
  if(!isEditable(id)) return false;
  try{
    var payload = DEFAULTS[id].kind === 'qa'
      ? { title:doc.title, qa:doc.qa }
      : { title:doc.title, sections:doc.sections };
    localStorage.setItem(storageKey(id), JSON.stringify(payload));
    return true;
  }catch(e){ return false; }
}

function reset(id){
  if(!isEditable(id)) return false;
  try{ localStorage.removeItem(storageKey(id)); }catch(e){}
  return true;
}

/* ── Rendering ── */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderBody(body){
  var out = '';
  var paragraphs = String(body||'').split(/\n\s*\n/);
  paragraphs.forEach(function(p){
    var lines = p.split(/\n/);
    var bullets = [];
    var prose = [];
    lines.forEach(function(l){
      var t = l.trim();
      if(!t){ return; }
      if(/^[-•*]\s+/.test(t)){ bullets.push(t.replace(/^[-•*]\s+/,'')); }
      else if(/^\d+\.\s+/.test(t)){ bullets.push(t); }
      else { prose.push(t); }
    });
    if(prose.length){ out += '<p>'+esc(prose.join(' ')).replace(/\n/g,'<br/>')+'</p>'; }
    if(bullets.length){ out += '<ul>'+bullets.map(function(b){ return '<li>'+esc(b)+'</li>'; }).join('')+'</ul>'; }
  });
  return out;
}

function render(id, targetId){
  if(!isEditable(id)) return;
  var el = document.getElementById(targetId || 'pageBody');
  if(!el) return;
  var doc = get(id);
  if(DEFAULTS[id].kind === 'qa'){
    el.innerHTML = doc.qa.map(function(pair,i){
      return '<details class="faq-item"'+(i===0?' open':'')+'>'+
        '<summary><span class="faq-q-num">'+(i+1)+'</span><span class="faq-q-text">'+esc(pair.q)+'</span><i class="fas fa-chevron-down faq-caret"></i></summary>'+
        '<div class="faq-a">'+renderBody(pair.a)+'</div>'+
      '</details>';
    }).join('') || '<div class="empty">No questions yet.</div>';
    return;
  }
  el.innerHTML = doc.sections.map(function(s){
    return '<section class="page-section"><h2>'+esc(s.heading)+'</h2>'+renderBody(s.body)+'</section>';
  }).join('');
}

/* ── Editor (used by system-pages) ── */
function openEditor(id, onDone){
  if(!isEditable(id)) return;
  if(DEFAULTS[id].kind === 'qa') return openQaEditor(id, onDone);
  return openSectionsEditor(id, onDone);
}

function openQaEditor(id, onDone){
  var doc = get(id);
  var overlay = document.createElement('div');
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(10,10,20,.55);z-index:2500;align-items:center;justify-content:center;padding:20px';
  var box = document.createElement('div');
  box.style.cssText = 'background:var(--card);border-radius:16px;width:100%;max-width:860px;max-height:92vh;overflow-y:auto;box-shadow:0 30px 70px -20px rgba(0,0,0,.4);display:flex;flex-direction:column';
  var rows = doc.qa.map(function(pair,i){ return qaRow(i, pair); }).join('');
  box.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--border)"><h3 style="font-size:15px;font-weight:800;display:flex;align-items:center;gap:9px"><i class="fas fa-pen-to-square" style="color:var(--accent)"></i> Editing '+esc(doc.title)+'</h3><button class="pc-close" style="width:30px;height:30px;border-radius:8px;border:none;background:var(--input-bg);color:var(--text-muted);cursor:pointer;font-size:13px"><i class="fas fa-xmark"></i></button></div>'+
    '<div style="padding:22px;flex:1">'+
      '<div style="margin-bottom:16px"><label style="display:block;font-size:11.5px;font-weight:700;color:var(--text-faint);margin-bottom:6px">Page Title</label><input type="text" class="pc-title" value="'+esc(doc.title)+'" style="width:100%;padding:10px 12px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:12.5px;font-family:inherit"/></div>'+
      '<div style="font-size:11.5px;font-weight:700;color:var(--text-faint);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">Questions <span class="pc-count" style="font-weight:600;color:var(--text-faint);font-size:10.5px">'+doc.qa.length+' question'+(doc.qa.length===1?'':'s')+'</span></div>'+
      '<div class="pc-qa-list" style="display:flex;flex-direction:column;gap:14px">'+rows+'</div>'+
      '<button class="pc-add-btn" style="margin-top:14px;padding:10px 18px;background:var(--blue-bg);color:var(--blue);border:1px solid var(--blue);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-plus" style="font-size:10px"></i> Add Question</button>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;gap:10px;padding:14px 22px 20px;border-top:1px solid var(--border);flex-wrap:wrap"><button class="pc-reset-btn" style="padding:10px 18px;background:transparent;color:var(--red);border:1px solid var(--red);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-rotate-left"></i> Reset to Defaults</button><div style="display:flex;gap:8px"><button class="pc-cancel-btn" style="padding:10px 20px;background:var(--card);color:var(--text);border:1px solid var(--input-border);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Cancel</button><button class="pc-save-btn" style="padding:10px 22px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-check"></i> Save Changes</button></div></div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function(){ overlay.style.display='flex'; });

  function close(){ overlay.style.display='none'; setTimeout(function(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); },180); }
  function renum(){
    var list = box.querySelectorAll('.pc-qa-row');
    list.forEach(function(row,i){ row.querySelector('.pc-qa-num').textContent = (i+1); });
    box.querySelector('.pc-count').textContent = list.length+' question'+(list.length===1?'':'s');
  }
  function wireDelete(btn){ btn.onclick = function(){ var row=btn.closest('.pc-qa-row'); row.parentNode.removeChild(row); renum(); }; }
  box.querySelectorAll('.pc-qa-del').forEach(wireDelete);

  box.querySelector('.pc-close').onclick = close;
  box.querySelector('.pc-cancel-btn').onclick = close;

  box.querySelector('.pc-add-btn').onclick = function(){
    var nextIdx = box.querySelectorAll('.pc-qa-row').length;
    box.querySelector('.pc-qa-list').insertAdjacentHTML('beforeend', qaRow(nextIdx, {q:'',a:''}));
    var last = box.querySelector('.pc-qa-list .pc-qa-row:last-child');
    wireDelete(last.querySelector('.pc-qa-del'));
    renum();
    last.querySelector('.pc-q').focus();
  };

  box.querySelector('.pc-reset-btn').onclick = function(){
    if(!confirm('Reset all FAQ questions to defaults?')) return;
    reset(id);
    close();
    render(id);
    if(onDone) onDone();
  };

  box.querySelector('.pc-save-btn').onclick = function(){
    var rows = box.querySelectorAll('.pc-qa-row');
    var list = [];
    rows.forEach(function(row){
      var q = row.querySelector('.pc-q').value.trim();
      var a = row.querySelector('.pc-a').value;
      if(!q && !a.trim()) return;
      list.push({ q: q||'Untitled question', a: a });
    });
    var title = box.querySelector('.pc-title').value.trim() || doc.title;
    save(id, { title:title, qa:list });
    render(id);
    close();
    if(onDone) onDone();
  };
}

function qaRow(i, pair){
  return '<div class="pc-qa-row" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;padding:14px">'+
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span class="pc-qa-num" style="font-size:10.5px;font-weight:800;color:#fff;background:var(--accent);padding:3px 8px;border-radius:6px">'+(i+1)+'</span>'+
    '<input type="text" class="pc-q" value="'+esc(pair.q||'')+'" placeholder="Question" style="flex:1;padding:9px 12px;border:1px solid var(--input-border);border-radius:8px;background:var(--card);color:var(--text);font-size:12.5px;font-family:inherit;font-weight:700"/>'+
    '<button class="pc-qa-del" style="padding:6px 10px;background:var(--red-bg);color:var(--red);border:1px solid transparent;border-radius:6px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-trash"></i></button></div>'+
    '<textarea class="pc-a" rows="4" placeholder="Answer — blank lines separate paragraphs, \x27- \x27 starts a bullet" style="width:100%;padding:10px 12px;border:1px solid var(--input-border);border-radius:8px;background:var(--card);color:var(--text);font-size:12.5px;font-family:inherit;line-height:1.6;resize:vertical;min-height:90px">'+esc(pair.a||'')+'</textarea>'+
    '</div>';
}

function openSectionsEditor(id, onDone){
  var doc = get(id);
  var overlay = document.createElement('div');
  overlay.className = 'pc-overlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(10,10,20,.55);z-index:2500;align-items:center;justify-content:center;padding:20px';
  var box = document.createElement('div');
  box.style.cssText = 'background:var(--card);border-radius:16px;width:100%;max-width:920px;max-height:92vh;overflow-y:auto;box-shadow:0 30px 70px -20px rgba(0,0,0,.4);display:flex;flex-direction:column';
  var sectionsHTML = doc.sections.map(function(s,i){ return sectionRow(i, s); }).join('');
  box.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--border)"><h3 style="font-size:15px;font-weight:800;display:flex;align-items:center;gap:9px"><i class="fas fa-pen-to-square" style="color:var(--accent)"></i> Editing '+esc(doc.title)+'</h3><button class="pc-close" style="width:30px;height:30px;border-radius:8px;border:none;background:var(--input-bg);color:var(--text-muted);cursor:pointer;font-size:13px"><i class="fas fa-xmark"></i></button></div>'+
    '<div style="padding:22px;flex:1">'+
      '<div style="margin-bottom:16px"><label style="display:block;font-size:11.5px;font-weight:700;color:var(--text-faint);margin-bottom:6px">Page Title</label><input type="text" class="pc-title" value="'+esc(doc.title)+'" style="width:100%;padding:10px 12px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:12.5px;font-family:inherit"/></div>'+
      '<div style="font-size:11.5px;font-weight:700;color:var(--text-faint);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">Sections <span class="pc-count" style="font-weight:600;color:var(--text-faint);font-size:10.5px">'+doc.sections.length+' section'+(doc.sections.length===1?'':'s')+' · edit freely, save when done</span></div>'+
      '<div class="pc-sections" style="display:flex;flex-direction:column;gap:14px">'+sectionsHTML+'</div>'+
      '<button class="pc-add-btn" style="margin-top:14px;padding:10px 18px;background:var(--blue-bg);color:var(--blue);border:1px solid var(--blue);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-plus" style="font-size:10px"></i> Add Section</button>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;gap:10px;padding:14px 22px 20px;border-top:1px solid var(--border);flex-wrap:wrap"><button class="pc-reset-btn" style="padding:10px 18px;background:transparent;color:var(--red);border:1px solid var(--red);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-rotate-left"></i> Reset to Defaults</button><div style="display:flex;gap:8px"><button class="pc-cancel-btn" style="padding:10px 20px;background:var(--card);color:var(--text);border:1px solid var(--input-border);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Cancel</button><button class="pc-save-btn" style="padding:10px 22px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-check"></i> Save Changes</button></div></div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function(){ overlay.style.display='flex'; });

  function close(){ overlay.style.display='none'; setTimeout(function(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); },180); }
  function updateCount(){ var n=box.querySelectorAll('.pc-sec-row').length; box.querySelector('.pc-count').textContent = n+' section'+(n===1?'':'s')+' · edit freely, save when done'; }

  box.querySelector('.pc-close').onclick = close;
  box.querySelector('.pc-cancel-btn').onclick = close;

  function wireSectionDelete(btn){
    btn.onclick = function(){ var row = btn.closest('.pc-sec-row'); row.parentNode.removeChild(row); updateCount(); };
  }
  box.querySelectorAll('.pc-del-btn').forEach(wireSectionDelete);

  box.querySelector('.pc-add-btn').onclick = function(){
    var nextIdx = box.querySelectorAll('.pc-sec-row').length;
    var rowHtml = sectionRow(nextIdx, { heading:'New Section', body:'Write the content here. Use blank lines to separate paragraphs. Start a line with "- " to make a bullet.' });
    box.querySelector('.pc-sections').insertAdjacentHTML('beforeend', rowHtml);
    var last = box.querySelector('.pc-sections .pc-sec-row:last-child');
    var ta = last.querySelector('textarea');
    if(ta){ ta.style.height = Math.min(320, Math.max(140, ta.scrollHeight)) + 'px'; }
    wireSectionDelete(last.querySelector('.pc-del-btn'));
    updateCount();
    if(ta){ ta.focus(); }
  };

  box.querySelector('.pc-reset-btn').onclick = function(){
    if(!confirm('Reset all sections for '+doc.title+' back to defaults?')) return;
    reset(id);
    close();
    render(id);
    if(onDone) onDone();
  };

  box.querySelector('.pc-save-btn').onclick = function(){
    var rows = box.querySelectorAll('.pc-sec-row');
    var newSections = [];
    rows.forEach(function(row){
      var heading = row.querySelector('input.pc-h').value.trim();
      var body = row.querySelector('textarea.pc-b').value;
      if(!heading && !body.trim()) return;
      newSections.push({ heading: heading||'Untitled', body: body });
    });
    var title = box.querySelector('.pc-title').value.trim() || doc.title;
    save(id, { title:title, sections:newSections });
    render(id);
    close();
    if(onDone) onDone();
  };
}

function sectionRow(i, s){
  return '<div class="pc-sec-row" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;padding:14px">'+
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span style="font-size:10.5px;font-weight:800;color:#fff;background:var(--accent);padding:3px 8px;border-radius:6px">'+(i+1)+'</span>'+
    '<input type="text" class="pc-h" value="'+esc(s.heading||'')+'" placeholder="Section heading" style="flex:1;padding:9px 12px;border:1px solid var(--input-border);border-radius:8px;background:var(--card);color:var(--text);font-size:12.5px;font-family:inherit;font-weight:700"/>'+
    '<button class="pc-del-btn" style="padding:6px 10px;background:var(--red-bg);color:var(--red);border:1px solid transparent;border-radius:6px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-trash"></i></button></div>'+
    '<textarea class="pc-b" rows="8" placeholder="Body — blank lines separate paragraphs, "- " starts a bullet" style="width:100%;padding:10px 12px;border:1px solid var(--input-border);border-radius:8px;background:var(--card);color:var(--text);font-size:12.5px;font-family:inherit;line-height:1.6;resize:vertical;min-height:120px">'+esc(s.body||'')+'</textarea>'+
    '</div>';
}

window.PageContentService = {
  isEditable:isEditable,
  get:get,
  save:save,
  reset:reset,
  render:render,
  openEditor:openEditor,
  renderBody:renderBody
};
})();
