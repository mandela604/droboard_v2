/* platform-settings-service.js — Platform Settings page logic (backend-ready).
 * Demo mode: USE_API=false keeps all demo paths working.
 * Flip USE_API=true and point API_BASE at the real backend to go live. */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    const res = await fetch(API_BASE + path, options || {});
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  function attachShell() {
    DroboardShell.attach('#dashboardRoot',{activeFile:'platform-settings.html',title:'Platform Settings',subtitle:'Configure platform settings and preferences',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,hideSearch:true});
  }

  // ── Section templates ───────────────────────────────────
  const SECTIONS = {
    general: {
      title: 'General Settings',
      desc: 'Manage your platform\'s basic information and preferences',
      html: () => `
        <div class="form-group"><label>Platform Name</label><div class="desc">The name of your publishing platform</div><input id="f-platformName" type="text" value="Droboard"/></div>
        <div class="form-group"><label>Platform Description</label><div class="desc">Brief description for SEO and sharing</div><textarea id="f-platformDesc">Droboard is a premier digital publishing platform connecting authors with readers worldwide.</textarea></div>
        <div class="form-group"><label>Default Language</label><div class="desc">Primary language for the platform interface</div><select id="f-language"><option>English (US)</option><option>English (UK)</option><option>French</option><option>Spanish</option></select></div>
        <div class="form-group"><label>Timezone</label><div class="desc">Default timezone for all dates and times</div><select id="f-timezone"><option>Africa/Lagos (UTC+1)</option><option>America/New_York (UTC-5)</option><option>Europe/London (UTC+0)</option></select></div>
        <div class="ca-head" style="margin-top:24px"><h2>Feature Toggles</h2><p>Enable or disable platform features</p></div>
        <div class="toggle-row"><div class="toggle-info"><b>Author Verification</b><span>Require authors to verify their identity before publishing</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Reader Reviews</b><span>Allow readers to rate and review published books</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Content Moderation</b><span>Enable automated content flagging</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Revenue Sharing</b><span>Enable revenue share agreements with authors</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
      `
    },
    branding: {
      title: 'Branding',
      desc: 'Customize your platform\'s visual identity',
      html: () => `
        <div class="form-group"><label>Logo URL</label><div class="desc">URL to your platform logo image</div><input type="text" value="https://i.pravatar.cc/100?img=47" placeholder="https://..."/></div>
        <div class="form-group"><label>Primary Color</label><div class="desc">Main brand color (accent)</div><div style="display:flex;align-items:center;gap:12px"><input type="color" value="#ff0050" style="width:50px;height:40px;padding:2px;border-radius:8px;cursor:pointer"/><span style="font-size:13px;font-weight:700;color:var(--text-muted)">#ff0050</span></div></div>
        <div class="form-group"><label>Secondary Color</label><div class="desc">Secondary brand color</div><div style="display:flex;align-items:center;gap:12px"><input type="color" value="#000000" style="width:50px;height:40px;padding:2px;border-radius:8px;cursor:pointer"/><span style="font-size:13px;font-weight:700;color:var(--text-muted)">#000000</span></div></div>
        <div class="form-group"><label>Favicon URL</label><div class="desc">Small icon shown in browser tabs</div><input type="text" value="https://droboard.app/favicon.ico" placeholder="https://..."/></div>
        <div class="form-group"><label>Footer Text</label><div class="desc">Copyright text shown in the footer</div><input type="text" value="© 2026 Droboard. All rights reserved."/></div>
      `
    },
    email: {
      title: 'Email Settings',
      desc: 'Configure email delivery and notification templates',
      html: () => `
        <div class="form-group"><label>Sender Name</label><div class="desc">Name displayed in the "From" field</div><input type="text" value="Droboard Team"/></div>
        <div class="form-group"><label>Sender Email</label><div class="desc">Email address used for outbound messages</div><input type="email" value="noreply@droboard.app"/></div>
        <div class="form-group"><label>SMTP Host</label><div class="desc">Your email server hostname</div><input type="text" value="smtp.droboard.app"/></div>
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group"><label>SMTP Port</label><input type="text" value="587"/></div>
          <div class="form-group"><label>SMTP Protocol</label><select><option>TLS</option><option>SSL</option></select></div>
        </div>
        <div class="toggle-row"><div class="toggle-info"><b>Welcome Email</b><span>Send welcome email to new authors</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Contract Notifications</b><span>Email authors when contracts are sent</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
      `
    },
    security: {
      title: 'Security Settings',
      desc: 'Manage platform security and access control',
      html: () => `
        <div class="toggle-row"><div class="toggle-info"><b>Two-Factor Authentication</b><span>Require 2FA for all admin accounts</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>IP Whitelisting</b><span>Restrict admin access to specific IPs</span></div><div class="toggle-switch" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Session Timeout</b><span>Auto-logout after inactivity</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="form-group" style="margin-top:18px"><label>Session Duration (minutes)</label><input type="number" value="60"/></div>
        <div class="form-group"><label>Password Policy</label><select><option>Strong (min 12 chars, special chars)</option><option>Moderate (min 8 chars)</option><option>Basic (min 6 chars)</option></select></div>
        <div class="form-group"><label>Allowed IPs (one per line)</label><textarea>192.168.1.0/24&#10;10.0.0.0/8</textarea></div>
      `
    },
    payments: {
      title: 'Payment Settings',
      desc: 'Configure payment gateways and payout preferences',
      html: () => `
        <div class="form-group"><label>Default Currency</label><select><option>USD ($)</option><option>EUR (€)</option><option>NGN (₦)</option><option>GBP (£)</option></select></div>
        <div class="form-group"><label>Minimum Payout</label><div class="desc">Minimum amount before an author can withdraw</div><input type="text" value="$50.00"/></div>
        <div class="form-group"><label>Payout Schedule</label><select><option>Monthly (1st of every month)</option><option>Bi-weekly</option><option>Weekly</option><option>Manual (admin initiated)</option></select></div>
        <div class="form-group"><label>Platform Commission (%)</label><input type="number" value="30" min="0" max="100"/></div>
        <div class="form-group"><label>Payment Gateway</label><select><option>Stripe</option><option>PayPal</option><option>Flutterwave</option><option>Paystack</option></select></div>
        <div class="toggle-row"><div class="toggle-info"><b>Auto-payouts</b><span>Automatically process payouts on schedule</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
      `
    },
    notifications: {
      title: 'Notification Settings',
      desc: 'Configure which notifications are sent and how',
      html: () => `
        <h3 style="font-size:13px;font-weight:800;margin-bottom:10px;color:var(--text)">Push Notifications</h3>
        <div class="toggle-row"><div class="toggle-info"><b>New Author Registration</b><span>Alert when a new author registers</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Contract Signed</b><span>Alert when an author signs a contract</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Content Flagged</b><span>Alert when content is reported</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Withdrawal Requests</b><span>Alert when authors request payouts</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <h3 style="font-size:13px;font-weight:800;margin:16px 0 10px;color:var(--text)">Email Notifications</h3>
        <div class="toggle-row"><div class="toggle-info"><b>Daily Digest</b><span>Receive a daily summary of platform activity</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Weekly Report</b><span>Receive a weekly performance report</span></div><div class="toggle-switch" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
      `
    },
    content: {
      title: 'Content Settings',
      desc: 'Manage content policies and moderation rules',
      html: () => `
        <div class="form-group"><label>Mature Content Label</label><div class="desc">How to label mature/explicit content</div><select><option>Auto-detect and label</option><option>Require author self-labeling</option><option>Disable mature content</option></select></div>
        <div class="form-group"><label>Max Story Length (words)</label><input type="number" value="100000"/></div>
        <div class="form-group"><label>Allowed File Types</label><input type="text" value=".jpg, .png, .pdf, .doc, .docx"/></div>
        <div class="toggle-row"><div class="toggle-info"><b>Auto-moderation</b><span>Automatically flag potentially violating content</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>AI Content Detection</b><span>Flag content that appears AI-generated</span></div><div class="toggle-switch" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Plagiarism Check</b><span>Auto-check submissions for plagiarism</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
      `
    },
    integrations: {
      title: 'API & Integrations',
      desc: 'Manage API keys and third-party integrations',
      html: () => `
        <div class="form-group"><label>API Status</label><div style="display:flex;align-items:center;gap:8px;padding:8px 0"><span style="width:10px;height:10px;border-radius:50%;background:var(--green);display:inline-block"></span><span style="font-weight:700;color:var(--green)">Operational</span></div></div>
        <div class="form-group"><label>API Base URL</label><input type="text" value="https://api.droboard.app/v1" readonly style="font-family:monospace;background:var(--table-head)"/></div>
        <div class="form-group"><label>API Key</label><div style="display:flex;gap:10px"><input type="password" value="dro_sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" readonly style="font-family:monospace;flex:1;background:var(--table-head)" id="apiKeyInput"/><button class="btn-save" style="padding:9px 14px;font-size:11px" onclick="const i=document.getElementById('apiKeyInput');i.type=i.type==='password'?'text':'password'">Show</button></div></div>
        <div class="form-group"><label>Webhook URL</label><div class="desc">Receive real-time events via POST requests</div><input type="text" value="https://droboard.app/webhooks"/></div>
        <div class="toggle-row"><div class="toggle-info"><b>Public API Access</b><span>Allow third-party integrations via public API</span></div><div class="toggle-switch" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
        <div class="toggle-row"><div class="toggle-info"><b>Webhook Enabled</b><span>Send real-time events to configured webhook URL</span></div><div class="toggle-switch active" onclick="this.classList.toggle('active')"><div class="knob"></div></div></div>
      `
    }
  };

  // ── Render active section ───────────────────────────────
  let activeSection = 'general';

  function renderSection(sectionId) {
    const section = SECTIONS[sectionId];
    if (!section) return;
    const content = document.getElementById('settingsContent');
    content.innerHTML = `
      <div class="ca-head"><h2>${section.title}</h2><p>${section.desc}</p></div>
      ${section.html()}
    `;
    activeSection = sectionId;
  }

  // ── Nav click handlers ──────────────────────────────────
  function bindNav() {
    document.querySelectorAll('.sn-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.sn-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        renderSection(item.dataset.section);
      });
    });
  }

  // ── Save button ────────────────────────────────────────
  function bindSave() {
    document.getElementById('saveAllBtn').addEventListener('click', async () => {
      toast('Saving all settings…');
      // Simulate API call
      if (window.DroboardAPI && DroboardAPI.updateBook) {
        await new Promise(r => setTimeout(r, 600));
      }
      toast('✅ All settings saved successfully!');
    });
  }

  function init() {
    attachShell();
    bindNav();
    bindSave();
    // ── Init ───────────────────────────────────────────────
    renderSection('general');
  }

  window.PlatformSettingsService = { init: init };
})();
