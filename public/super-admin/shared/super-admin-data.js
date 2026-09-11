(function () {
  'use strict';
  if (window.__superAdminData) return;
  window.__superAdminData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/super-admin';
  const TIMEOUT_MS = 2500;

  async function callBackend(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Bad response: ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms || 200 + Math.random() * 200)); }

  const DEMO = {
    dashboard: {
      totalUsers: 2847,
      activeUsers: 1923,
      totalAuthors: 142,
      totalEditors: 14,
      totalReaders: 2691,
      mrr: '$47,280',
      arr: '$567,360',
      platformRevenue: '$1.2M',
      pendingVerifications: 8,
      openTickets: 3,
      systemUptime: '99.98%',
      storageUsed: '2.4TB',
      quickActions: [
        { label: 'Run System Backup', icon: 'fa-server', cls: 'blue', href: 'system-logs.html' },
        { label: 'Review Pending Verifications', icon: 'fa-user-check', cls: 'amber', count: 8, href: 'user-management.html' },
        { label: 'Check Security Alerts', icon: 'fa-shield-halved', cls: 'red', count: 3, href: 'security.html' },
        { label: 'Update Feature Flags', icon: 'fa-toggle-on', cls: 'purple', href: 'feature-flags.html' },
      ],
      recentActivity: [
        { icon: 'fa-user-plus', color: 'blue', text: 'New Super Admin <b>Adaeze Bello</b> logged in from a new device', time: '5m ago' },
        { icon: 'fa-shield-alt', color: 'green', text: 'Security scan completed — <b>0 critical vulnerabilities</b> found', time: '1h ago' },
        { icon: 'fa-toggle-on', color: 'purple', text: '<b>New Feature Flag</b> "audio-books" activated for 10% of users', time: '3h ago' },
        { icon: 'fa-server', color: 'amber', text: 'Scheduled maintenance window set for <b>Aug 2, 2026</b>', time: '5h ago' },
        { icon: 'fa-piggy-bank', color: 'green', text: 'Monthly revenue target of <b>$50K</b> reached', time: '1d ago' },
      ],
    },

    users: [
      { id: 'USR-001', name: 'Adaeze Bello', email: 'adaeze.bello@droboard.io', role: 'Super Admin', status: 'active', joined: 'Jan 2023', lastLogin: '5m ago', avatar: 'https://i.pravatar.cc/100?img=49' },
      { id: 'USR-002', name: 'Chioma Reddy', email: 'chioma.reddy@droboard.io', role: 'Chief Editor', status: 'active', joined: 'Mar 2024', lastLogin: '2h ago', avatar: 'https://i.pravatar.cc/100?img=5' },
      { id: 'USR-003', name: 'Daniel Carter', email: 'daniel.carter@droboard.io', role: 'Senior Editor', status: 'active', joined: 'Jan 2024', lastLogin: '1h ago', avatar: 'https://i.pravatar.cc/100?img=13' },
      { id: 'USR-004', name: 'Sophia Bennett', email: 'sophia.bennett@droboard.io', role: 'Senior Editor', status: 'active', joined: 'Jun 2023', lastLogin: '3h ago', avatar: 'https://i.pravatar.cc/100?img=48' },
      { id: 'USR-005', name: 'Marcus Ihejirika', email: 'marcus.ihejirika@droboard.io', role: 'Senior Editor', status: 'suspended', joined: 'Sep 2023', lastLogin: '2d ago', avatar: 'https://i.pravatar.cc/100?img=59' },
      { id: 'USR-006', name: 'Luna Skye', email: 'luna.skye@droboard.io', role: 'Author', status: 'active', joined: 'Mar 2025', lastLogin: '4h ago', avatar: 'https://i.pravatar.cc/100?img=24' },
      { id: 'USR-007', name: 'Elena Vasquez', email: 'elena.vasquez@droboard.io', role: 'Author', status: 'active', joined: 'Jan 2024', lastLogin: '6h ago', avatar: 'https://i.pravatar.cc/100?img=31' },
      { id: 'USR-008', name: 'Isabelle Moreau', email: 'isabelle.moreau@droboard.io', role: 'Author', status: 'active', joined: 'Sep 2023', lastLogin: '1d ago', avatar: 'https://i.pravatar.cc/100?img=44' },
      { id: 'USR-009', name: 'BookLover92', email: 'booklover92@gmail.com', role: 'Reader', status: 'active', joined: 'Apr 2024', lastLogin: '12h ago', avatar: 'https://i.pravatar.cc/100?img=36' },
      { id: 'USR-010', name: 'ChapterChaser', email: 'chapterchaser@yahoo.com', role: 'Reader', status: 'active', joined: 'Nov 2023', lastLogin: '1d ago', avatar: 'https://i.pravatar.cc/100?img=19' },
    ],

    roles: [
      { id: 'ROL-001', name: 'Super Admin', description: 'Full platform access — all features, settings, and user management.', permissions: ['all'], userCount: 1, isEditable: false },
      { id: 'ROL-002', name: 'Chief Editor', description: 'Manage senior editors, contracts, reports, and platform content.', permissions: ['manage_senior_editors', 'manage_contracts', 'view_reports', 'manage_content'], userCount: 1, isEditable: true },
      { id: 'ROL-003', name: 'Senior Editor', description: 'Review submissions, manage authors, and curate content.', permissions: ['review_submissions', 'manage_authors', 'curate_content'], userCount: 12, isEditable: true },
      { id: 'ROL-004', name: 'Author', description: 'Write, publish, and manage their own stories.', permissions: ['write_stories', 'publish_own', 'view_analytics'], userCount: 142, isEditable: true },
      { id: 'ROL-005', name: 'Reader', description: 'Read stories, leave reviews, and participate in community.', permissions: ['read_stories', 'leave_reviews', 'join_community'], userCount: 2691, isEditable: true },
    ],

    platformSettings: {
      general: {
        platformName: 'Droboard',
        tagline: 'Where Stories Come Alive',
        registrationEnabled: true,
        authorApplicationRequired: true,
        minAuthorAge: 16,
        contentRating: 'Mature',
        defaultLanguage: 'English',
        supportedLanguages: ['English', 'Spanish', 'French', 'German', 'Portuguese'],
      },
      content: {
        maxChapterWords: 5000,
        minChapterWords: 2000,
        maxTitleLength: 100,
        matureContentTag: true,
        plagiarismCheck: true,
        aiContentDetection: true,
        autoTranslation: true,
      },
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        weeklyDigest: true,
        systemAnnouncements: true,
        authorReminders: true,
      },
    },

    finance: {
      monthlyRevenue: '$47,280',
      annualRevenue: '$567,360',
      totalPayouts: '$342,100',
      pendingPayouts: '$18,240',
      platformFee: '20%',
      mrrGrowth: '+12.4%',
      revenueByGenre: [
        { genre: 'Billionaire & CEO', revenue: '$84,200' },
        { genre: 'Werewolf & Fantasy', revenue: '$67,800' },
        { genre: 'Mafia & Urban', revenue: '$52,300' },
        { genre: 'Romance & Betrayal', revenue: '$48,900' },
        { genre: 'Historical & Regency', revenue: '$39,100' },
        { genre: 'Campus & Revenge', revenue: '$28,700' },
      ],
      payoutQueue: [
        { name: 'Isabelle Moreau', role: 'Author', amount: '$2,140', due: 'Jul 31, 2026', status: 'due' },
        { name: 'Elena Vasquez', role: 'Author', amount: '$980', due: 'Jul 31, 2026', status: 'due' },
        { name: 'Chioma Reddy', role: 'Senior Editor', amount: '$3,200', due: 'Aug 1, 2026', status: 'scheduled' },
        { name: 'Luna Skye', role: 'Author', amount: '$1,510', due: 'Jul 31, 2026', status: 'due' },
      ],
    },

    analytics: {
      totalReads: '2.4M',
      totalWords: '847M',
      avgSession: '18m 32s',
      bounceRate: '23.4%',
      topCountries: [
        { country: 'United States', reads: '842K' },
        { country: 'United Kingdom', reads: '321K' },
        { country: 'Nigeria', reads: '298K' },
        { country: 'India', reads: '256K' },
        { country: 'Canada', reads: '187K' },
      ],
      dailyActive: [
        { day: 'Mon', users: 42800 },
        { day: 'Tue', users: 45200 },
        { day: 'Wed', users: 47800 },
        { day: 'Thu', users: 46100 },
        { day: 'Fri', users: 52300 },
        { day: 'Sat', users: 38900 },
        { day: 'Sun', users: 35600 },
      ],
      genrePerformance: [
        { genre: 'Billionaire & CEO', reads: '520K', completion: 62 },
        { genre: 'Werewolf & Fantasy', reads: '480K', completion: 58 },
        { genre: 'Mafia & Urban', reads: '390K', completion: 55 },
        { genre: 'Romance & Betrayal', reads: '350K', completion: 67 },
        { genre: 'Historical & Regency', reads: '280K', completion: 74 },
        { genre: 'Campus & Revenge', reads: '210K', completion: 49 },
      ],
    },

    security: {
      twoFactorEnabled: true,
      lastSecurityScan: '2h ago',
      vulnerabilities: 0,
      criticalAlerts: 0,
      warnings: 2,
      loginAttempts: { successful: 1247, failed: 3, blocked: 0 },
      recentEvents: [
        { type: 'login', severity: 'info', text: 'New device login — Super Admin Adaeze Bello from San Francisco', time: '5m ago' },
        { type: 'scan', severity: 'info', text: 'Automated security scan completed — 0 critical vulnerabilities', time: '2h ago' },
        { type: 'warning', severity: 'warning', text: 'Multiple failed login attempts on account USR-005 (Marcus Ihejirika)', time: '1d ago' },
        { type: 'blocked', severity: 'warning', text: 'Suspicious API request pattern detected and blocked', time: '2d ago' },
      ],
      apiKey: 'sk_live_7f3a9b2c1e8d4f6a5b0c3e7d9f1a2b4c',
    },

    systemLogs: [
      { id: 'LOG-001', level: 'info', source: 'auth-service', message: 'User login: adaeze.bello@droboard.io', timestamp: '2026-07-29 04:55:22', ip: '192.168.1.42' },
      { id: 'LOG-002', level: 'info', source: 'api-gateway', message: 'Request processed: GET /api/v1/stories/featured', timestamp: '2026-07-29 04:55:18', ip: '10.0.3.15' },
      { id: 'LOG-003', level: 'warning', source: 'payment-service', message: 'Payment retry triggered for transaction TX-8847', timestamp: '2026-07-29 04:54:55', ip: '10.0.2.8' },
      { id: 'LOG-004', level: 'error', source: 'content-service', message: 'Plagiarism check timeout for story ST-142', timestamp: '2026-07-29 04:53:31', ip: '10.0.5.22' },
      { id: 'LOG-005', level: 'info', source: 'notification-service', message: 'Batch email sent: 2,847 recipients', timestamp: '2026-07-29 04:50:00', ip: '10.0.1.3' },
      { id: 'LOG-006', level: 'info', source: 'backup-service', message: 'Daily backup completed successfully', timestamp: '2026-07-29 02:00:00', ip: '10.0.0.1' },
      { id: 'LOG-007', level: 'warning', source: 'auth-service', message: 'Rate limit exceeded for IP 203.0.113.45', timestamp: '2026-07-28 23:45:12', ip: '203.0.113.45' },
      { id: 'LOG-008', level: 'error', source: 'storage-service', message: 'Disk usage above 85% threshold on node-3', timestamp: '2026-07-28 22:10:00', ip: '10.0.0.3' },
    ],

    integrations: [
      { id: 'INT-001', name: 'Stripe', type: 'Payment', status: 'connected', lastSync: '2h ago', icon: 'fa-credit-card' },
      { id: 'INT-002', name: 'SendGrid', type: 'Email', status: 'connected', lastSync: '5m ago', icon: 'fa-envelope' },
      { id: 'INT-003', name: 'Cloudflare', type: 'CDN', status: 'connected', lastSync: '1h ago', icon: 'fa-cloud' },
      { id: 'INT-004', name: 'AWS S3', type: 'Storage', status: 'connected', lastSync: '3h ago', icon: 'fa-database' },
      { id: 'INT-005', name: 'Google Analytics', type: 'Analytics', status: 'connected', lastSync: '1d ago', icon: 'fa-chart-line' },
      { id: 'INT-006', name: 'Slack', type: 'Messaging', status: 'disconnected', lastSync: '2d ago', icon: 'fa-slack' },
      { id: 'INT-007', name: 'GitHub', type: 'Deployment', status: 'connected', lastSync: '4h ago', icon: 'fa-github' },
    ],

    featureFlags: [
      { id: 'FF-001', name: 'audio-books', description: 'Enable audiobook production and distribution', enabled: true, rollout: 10, created: 'Jul 15, 2026', lastModified: 'Jul 28, 2026' },
      { id: 'FF-002', name: 'ai-content-detection', description: 'Detect AI-generated content in submissions', enabled: true, rollout: 100, created: 'Jun 20, 2026', lastModified: 'Jul 20, 2026' },
      { id: 'FF-003', name: 'dark-mode', description: 'Dark mode theme for all users', enabled: true, rollout: 100, created: 'May 10, 2026', lastModified: 'May 10, 2026' },
      { id: 'FF-004', name: 'beta-reading', description: 'Allow readers to sign up as beta readers', enabled: false, rollout: 0, created: 'Jul 1, 2026', lastModified: 'Jul 25, 2026' },
      { id: 'FF-005', name: 'subscription-tier', description: 'Premium subscription tier with exclusive content', enabled: false, rollout: 0, created: 'Jul 20, 2026', lastModified: 'Jul 28, 2026' },
      { id: 'FF-006', name: 'offline-reading', description: 'Download stories for offline reading', enabled: true, rollout: 50, created: 'Jul 18, 2026', lastModified: 'Jul 27, 2026' },
    ],

    /* ─────────────────────────────────────────────────────────────
       BOOKS — required by all-books.html (SuperAdminData.getBooks(),
       approveBook, featureBook, flagBook, removeBook). This was the
       piece missing from the file, which left that page's loading
       skeleton spinning forever with an uncaught TypeError.
    ───────────────────────────────────────────────────────────── */
    books: [
      { id: 'BK-001', title: 'Bound by the Ruthless Alpha', author: 'Chioma Okafor', genre: 'Romance & Betrayal', cover: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', status: 'published', featured: true, reads: 171000, likes: 24300, rating: 4.5, chapters: 31, wordCount: 124000, uploadDate: '2026-03-12', flagCount: 0, description: 'Chained to an alpha who broke her trust once already, Amara must decide whether loyalty to her pack is worth risking her heart a second time.' },
      { id: 'BK-002', title: "The CEO's Hidden Son", author: 'Luna Skye', genre: 'Billionaire & CEO', cover: 'https://i.postimg.cc/23WvkFLH/images-(2).jpg', status: 'published', featured: true, reads: 96000, likes: 19200, rating: 4.3, chapters: 24, wordCount: 96000, uploadDate: '2026-05-02', flagCount: 0, description: "When a boardroom takeover forces billionaire Adrian Cole to confront the son he never knew existed, one meeting threatens to unravel everything." },
      { id: 'BK-003', title: "Wolf King's Vow", author: 'Elena Vasquez', genre: 'Werewolf & Fantasy', cover: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', status: 'under_review', featured: false, reads: 48000, likes: 8100, rating: 4.1, chapters: 12, wordCount: 48000, uploadDate: '2026-07-20', flagCount: 0, description: 'Bound by an ancient vow, a reluctant wolf king and the human he must protect are pulled into a war between packs.' },
      { id: 'BK-004', title: 'Betrayed by the Mafia Prince', author: 'Marcus Webb Jr.', genre: 'Mafia & Urban', cover: 'https://i.postimg.cc/WF1j4Pnh/6.jpg', status: 'flagged', featured: false, reads: 28000, likes: 5300, rating: 3.9, chapters: 7, wordCount: 28000, uploadDate: '2026-06-18', flagCount: 4, moderationNote: 'Flagged by 4 readers for graphic violence exceeding platform mature-content guidelines. Pending Chief Editor review.', description: "Raised to inherit an empire built on blood, Dante Moretti trusted no one — until the one person he let in turned out to be working against him." },
      { id: 'BK-005', title: "The Duke's Secret", author: 'Isabelle Moreau', genre: 'Historical & Regency', cover: 'https://i.postimg.cc/fkdXzjSj/wife.jpg', status: 'published', featured: true, reads: 155000, likes: 31000, rating: 4.7, chapters: 31, wordCount: 155000, uploadDate: '2026-01-09', flagCount: 0, description: "A duke's carefully buried past resurfaces the night his estranged wife returns to London society." },
      { id: 'BK-006', title: 'Revenge at the Ivy League', author: 'Wren Okonkwo', genre: 'Campus & Revenge', cover: 'https://i.postimg.cc/cgLZJNmC/8.jpg', status: 'published', featured: false, reads: 31000, likes: 6200, rating: 4.0, chapters: 9, wordCount: 31000, uploadDate: '2026-04-27', flagCount: 0, description: 'Expelled on false charges and quietly reinstated years later, Naomi returns with one goal: expose the golden boy who destroyed her name.' },
      { id: 'BK-007', title: 'The Runaway Bride in Socked Feet', author: 'Ifeanyi_Story', genre: 'Twist & Drama', cover: 'https://i.postimg.cc/tY7KnJyr/images.jpg', status: 'published', featured: true, reads: 312000, likes: 45000, rating: 4.6, chapters: 22, wordCount: 88000, uploadDate: '2026-02-14', flagCount: 0, description: 'She walked out of her own wedding in her socked feet with nothing but her phone and a plan.' },
      { id: 'BK-008', title: 'The Letter He Never Sent', author: 'Efe_O', genre: 'Elegy & Heartbreak', cover: 'https://i.postimg.cc/N9jY0w4m/5.jpg', status: 'published', featured: false, reads: 52000, likes: 11200, rating: 4.4, chapters: 15, wordCount: 52000, uploadDate: '2026-05-30', flagCount: 0, description: 'Ten years after he disappeared without a word, a folded letter turns up in his old jacket pocket.' },
      { id: 'BK-009', title: 'Caught Him Kissing Her Photograph', author: 'Ada_Writes', genre: 'Romance & Betrayal', cover: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg', status: 'published', featured: false, reads: 64000, likes: 14000, rating: 4.2, chapters: 19, wordCount: 64000, uploadDate: '2026-03-25', flagCount: 1, description: "She came home early to celebrate their anniversary and found her husband kissing a photograph of a woman she'd never seen." },
      { id: 'BK-010', title: 'My Stepmother Stole My Fund', author: 'Zara_M', genre: 'Mafia & Urban', cover: 'https://i.postimg.cc/ftRZbhKx/3.jpg', status: 'under_review', featured: false, reads: 5000, likes: 900, rating: 3.8, chapters: 11, wordCount: 37000, uploadDate: '2026-07-24', flagCount: 0, description: "When her university fund vanishes days before tuition is due, Zara traces the missing money straight to her stepmother." },
      { id: 'BK-011', title: 'She Rejected Me Three Times', author: 'Dami_Cole', genre: 'Romance & Betrayal', cover: 'https://i.postimg.cc/YGCkSw-33/1.jpg', status: 'published', featured: false, reads: 21000, likes: 4400, rating: 4.0, chapters: 8, wordCount: 21000, uploadDate: '2026-06-05', flagCount: 0, description: 'Third time trying to ask out the girl from the coffee shop, and third time she said no.' },
      { id: 'BK-012', title: "My Grandmother's Will", author: 'Chiamaka_N', genre: 'Campus & Revenge', cover: 'https://i.postimg.cc/DJwFzKgd/4.jpg', status: 'published', featured: true, reads: 101000, likes: 21000, rating: 4.3, chapters: 27, wordCount: 101000, uploadDate: '2026-02-02', flagCount: 0, description: "The will names her sole heir to a fortune she didn't know existed — on one condition." },
      { id: 'BK-013', title: 'The Assistant Who Owned the Company', author: 'Vivian_Cross', genre: 'Billionaire & CEO', cover: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', status: 'published', featured: false, reads: 44000, likes: 9200, rating: 4.1, chapters: 18, wordCount: 71000, uploadDate: '2026-04-08', flagCount: 0, description: "She became his assistant. He didn't know she owned his rival company." },
      { id: 'BK-014', title: 'Married for the Merger', author: 'Bode_Sterling', genre: 'Billionaire & CEO', cover: 'https://i.postimg.cc/0MyxNqfz/7.jpg', status: 'flagged', featured: false, reads: 12000, likes: 2100, rating: 3.6, chapters: 6, wordCount: 22000, uploadDate: '2026-07-10', flagCount: 2, moderationNote: 'Flagged for a suspected plagiarism match against a previously published title. Under Senior Editor review.', description: 'Married for the merger, falling for the man behind the contract.' },
      { id: 'BK-015', title: 'The House That Remembers', author: 'Uju_Blackwood', genre: 'Horror & Suspense', cover: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', status: 'removed', featured: false, reads: 3200, likes: 400, rating: 3.2, chapters: 4, wordCount: 14000, uploadDate: '2026-05-15', flagCount: 6, moderationNote: 'Removed for repeated copyright violations after two prior warnings.', description: 'The house remembers every tenant who almost left.' },
      { id: 'BK-016', title: 'Second Son, Forgotten Prince', author: 'Femi_Aldric', genre: 'Werewolf & Fantasy', cover: 'https://i.postimg.cc/DJwFzKgd/4.jpg', status: 'published', featured: false, reads: 18000, likes: 3900, rating: 4.0, chapters: 10, wordCount: 45000, uploadDate: '2026-06-29', flagCount: 0, description: 'The second son, forgotten prince, is the first to break the seal.' },
      { id: 'BK-017', title: 'Every Witness Remembers a Different Killer', author: 'Ken_Osei', genre: 'Mystery & Thriller', cover: 'https://i.postimg.cc/tY7KnJyr/images.jpg', status: 'published', featured: true, reads: 87000, likes: 16400, rating: 4.6, chapters: 20, wordCount: 61000, uploadDate: '2026-01-22', flagCount: 0, description: 'A mystery where five witnesses recall five different killers, and only one truth survives.' },
      { id: 'BK-018', title: 'The Neighbour Who Reported the Fire', author: 'Doris_Vance', genre: 'Mystery & Thriller', cover: 'https://i.postimg.cc/ftRZbhKx/3.jpg', status: 'under_review', featured: false, reads: 2100, likes: 300, rating: 3.9, chapters: 3, wordCount: 9000, uploadDate: '2026-07-27', flagCount: 0, description: 'The neighbour who reported the fire also lit it.' },
      { id: 'BK-019', title: 'It Only Comes When You Say Thank You', author: 'Marcus_Grey', genre: 'Horror & Suspense', cover: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', status: 'published', featured: false, reads: 55000, likes: 12300, rating: 4.4, chapters: 14, wordCount: 39000, uploadDate: '2026-03-30', flagCount: 0, description: 'A slow-dread horror story about the one word you must never say back.' },
      { id: 'BK-020', title: 'The Last Flamebearer of Ashenreach', author: 'Obi_Runeforge', genre: 'Werewolf & Fantasy', cover: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', status: 'published', featured: false, reads: 34000, likes: 7000, rating: 4.5, chapters: 16, wordCount: 92000, uploadDate: '2026-02-19', flagCount: 0, description: 'A magic system where every spell costs something real — and no one has paid the full price yet.' },
      { id: 'BK-021', title: 'I Failed the Academy Trials', author: 'Layla_Thorn', genre: 'Werewolf & Fantasy', cover: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', status: 'published', featured: false, reads: 26000, likes: 5100, rating: 4.2, chapters: 13, wordCount: 58000, uploadDate: '2026-04-14', flagCount: 0, description: 'She failed the academy trials — the curse chose her anyway.' },
      { id: 'BK-022', title: "He Proposed With My Best Friend's Ring", author: 'Kemi_A', genre: 'Romance & Betrayal', cover: 'https://i.postimg.cc/JDzmhWqj/2.jpg', status: 'published', featured: false, reads: 96000, likes: 19200, rating: 4.0, chapters: 3, wordCount: 12000, uploadDate: '2026-06-11', flagCount: 0, description: "He proposed with my best friend's ring — and she giggled before he even knelt." },
      { id: 'BK-023', title: 'The Luna Trials', author: 'Yusuf_Howl', genre: 'Werewolf & Fantasy', cover: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', status: 'published', featured: true, reads: 71000, likes: 15600, rating: 4.4, chapters: 17, wordCount: 84000, uploadDate: '2026-02-27', flagCount: 0, description: 'Three packs, one crown, no mercy.' },
      { id: 'BK-024', title: 'My Uncle Claimed the Inheritance', author: 'Chiamaka_N', genre: 'Campus & Revenge', cover: 'https://i.postimg.cc/cgLZJNmC/8.jpg', status: 'published', featured: false, reads: 138000, likes: 21000, rating: 4.3, chapters: 21, wordCount: 79000, uploadDate: '2026-01-30', flagCount: 0, description: "My uncle claimed the inheritance using my late mother's stolen will." },
    ],
  };

  function findBook(id) { return DEMO.books.find(b => b.id === id); }

  window.SuperAdminData = {
    async getDashboard() {
      try { return await callBackend('/dashboard'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.dashboard)); }
    },
    async getUsers() {
      try { return await callBackend('/users'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.users)); }
    },
    async updateUser(id, data) {
      try { return await callBackend('/users/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
      catch (e) { await delay(200); const u = DEMO.users.find(x => x.id === id); if (u) Object.assign(u, data); return { ok: true }; }
    },
    async deleteUser(id) {
      try { return await callBackend('/users/' + id, { method: 'DELETE' }); }
      catch (e) { await delay(200); DEMO.users = DEMO.users.filter(x => x.id !== id); return { ok: true }; }
    },
    async getRoles() {
      try { return await callBackend('/roles'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.roles)); }
    },
    async updateRole(id, data) {
      try { return await callBackend('/roles/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
      catch (e) { await delay(200); const r = DEMO.roles.find(x => x.id === id); if (r) Object.assign(r, data); return { ok: true }; }
    },
    async getPlatformSettings() {
      try { return await callBackend('/platform-settings'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.platformSettings)); }
    },
    async updatePlatformSettings(data) {
      try { return await callBackend('/platform-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
      catch (e) { await delay(200); Object.assign(DEMO.platformSettings, data); return { ok: true }; }
    },
    async getFinance() {
      try { return await callBackend('/finance'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.finance)); }
    },
    async getAnalytics() {
      try { return await callBackend('/analytics'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.analytics)); }
    },
    async getSecurity() {
      try { return await callBackend('/security'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.security)); }
    },
    async getSystemLogs() {
      try { return await callBackend('/system-logs'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.systemLogs)); }
    },
    async getIntegrations() {
      try { return await callBackend('/integrations'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.integrations)); }
    },
    async updateIntegration(id, data) {
      try { return await callBackend('/integrations/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
      catch (e) { await delay(200); const i = DEMO.integrations.find(x => x.id === id); if (i) Object.assign(i, data); return { ok: true }; }
    },
    async getFeatureFlags() {
      try { return await callBackend('/feature-flags'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.featureFlags)); }
    },
    async updateFeatureFlag(id, data) {
      try { return await callBackend('/feature-flags/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
      catch (e) { await delay(200); const f = DEMO.featureFlags.find(x => x.id === id); if (f) Object.assign(f, data); return { ok: true }; }
    },

    /* ── Books — powers all-books.html ── */
    async getBooks() {
      try { return await callBackend('/books'); }
      catch (e) { await delay(); return JSON.parse(JSON.stringify(DEMO.books)); }
    },
    async approveBook(id) {
      try { return await callBackend('/books/' + id + '/approve', { method: 'POST' }); }
      catch (e) { await delay(200); const b = findBook(id); if (b) { b.status = 'published'; } return { ok: true }; }
    },
    async featureBook(id, featured) {
      try { return await callBackend('/books/' + id + '/feature', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured }) }); }
      catch (e) { await delay(200); const b = findBook(id); if (b) { b.featured = !!featured; } return { ok: true }; }
    },
    async flagBook(id, note) {
      try { return await callBackend('/books/' + id + '/flag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }); }
      catch (e) { await delay(200); const b = findBook(id); if (b) { b.status = 'flagged'; b.moderationNote = note || 'Flagged for review.'; b.flagCount = (b.flagCount || 0) + 1; } return { ok: true }; }
    },
    async removeBook(id, note) {
      try { return await callBackend('/books/' + id + '/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }); }
      catch (e) { await delay(200); const b = findBook(id); if (b) { b.status = 'removed'; b.moderationNote = note || 'Removed by Super Admin.'; b.featured = false; } return { ok: true }; }
    },
  };
})();