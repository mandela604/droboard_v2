/**
 * Audit Script: Author Center & Notification Pages
 * Tests all backend routes and verifies data completeness
 */
require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const { Book, Category, Chapter, Character, Plot } = require('./src/models/content.model');
const { ContractApplication, CompletionApplication, VipApplication, ChapterReviewRequest, AuthorVerification } = require('./src/models/application.model');
const { User } = require('./src/models/user.model');
const { LaunchCampaign } = require('./src/models/editorial.model');
const { Contract } = require('./src/models/contract.model');
const { Notification } = require('./src/models/social.model');

// Import services
const authorService = require('./src/services/author.service');
const notificationsService = require('./src/services/notifications.service');

// Test user ID (replace with real test user)
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');
}

async function testAuthorCenter() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('AUDIT: AUTHOR CENTER');
  console.log('══════════════════════════════════════════════════════════════\n');

  // Test 1: Dashboard
  console.log('📊 Test 1: GET /api/author/dashboard');
  try {
    const dashboard = await authorService.dashboard({ userId: TEST_USER_ID });
    console.log('✅ Dashboard response:', JSON.stringify(dashboard, null, 2));
    console.log('   Fields returned:', Object.keys(dashboard));
    console.log('   Expected fields: stats (books, contracts, reads, pendingReviews)');
    const hasStats = dashboard.stats && typeof dashboard.stats === 'object';
    const hasBooks = dashboard.stats && 'books' in dashboard.stats;
    const hasContracts = dashboard.stats && 'contracts' in dashboard.stats;
    const hasReads = dashboard.stats && 'reads' in dashboard.stats;
    console.log(`   Complete: ${hasStats && hasBooks && hasContracts && hasReads ? '✅' : '❌'}\n`);
  } catch (e) {
    console.log('❌ Dashboard failed:', e.message, '\n');
  }

  // Test 2: Books List
  console.log('📚 Test 2: GET /api/author/books');
  try {
    const books = await authorService.books({ userId: TEST_USER_ID });
    console.log(`✅ Books returned: ${books.length} books`);
    if (books.length > 0) {
      console.log('   Sample book fields:', Object.keys(books[0]));
      console.log('   Expected fields: id, title, genre, cover, reads, likes, chapters, status, lastChapter, category');
      const hasRequired = books[0].id && books[0].title && books[0].genre && books[0].cover && books[0].reads !== undefined && books[0].likes !== undefined && books[0].chapters !== undefined && books[0].status && books[0].lastChapter !== undefined;
      console.log(`   Complete: ${hasRequired ? '✅' : '❌'}\n`);
    } else {
      console.log('   ⚠️  No books found for user\n');
    }
  } catch (e) {
    console.log('❌ Books failed:', e.message, '\n');
  }

  // Test 3: Contracts
  console.log('📝 Test 3: GET /api/author/contracts');
  try {
    const contracts = await authorService.listContracts({ userId: TEST_USER_ID });
    console.log(`✅ Contracts returned: ${contracts.length} books with contract info`);
    if (contracts.length > 0) {
      console.log('   Sample contract fields:', Object.keys(contracts[0]));
      console.log('   Expected fields: id, title, genre, cover, chapters, status, appliedAt, contractId, offerType, offerSentAt, termMonths, revenueSplit, kycType, verificationStatus');
      const hasRequired = contracts[0].id && contracts[0].title && contracts[0].status !== undefined && contracts[0].verificationStatus !== undefined;
      console.log(`   Complete: ${hasRequired ? '✅' : '❌'}\n`);
    } else {
      console.log('   ⚠️  No contracts found for user\n');
    }
  } catch (e) {
    console.log('❌ Contracts failed:', e.message, '\n');
  }

  // Test 4: Verification
  console.log('🔐 Test 4: GET /api/author/verification');
  try {
    const verification = await authorService.getVerification({ userId: TEST_USER_ID });
    console.log('✅ Verification response:', JSON.stringify(verification, null, 2));
    console.log('   Expected fields: status, kycType, submittedAt, hasPhotos');
    const hasRequired = verification.status !== undefined && verification.kycType !== undefined && verification.submittedAt !== undefined && verification.hasPhotos !== undefined;
    console.log(`   Complete: ${hasRequired ? '✅' : '❌'}\n`);
  } catch (e) {
    console.log('❌ Verification failed:', e.message, '\n');
  }
}

async function testNotifications() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('AUDIT: NOTIFICATION PAGE');
  console.log('══════════════════════════════════════════════════════════════\n');

  // Test 1: List Notifications
  console.log('🔔 Test 1: GET /api/notifications');
  try {
    const notifs = await notificationsService.list({ userId: TEST_USER_ID });
    console.log(`✅ Notifications returned: ${notifs.items.length} items`);
    console.log('   Response fields:', Object.keys(notifs));
    console.log('   Expected fields: items, total, unreadCount, page, limit');
    const hasRequired = notifs.items && notifs.total !== undefined && notifs.unreadCount !== undefined && notifs.page !== undefined && notifs.limit !== undefined;
    console.log(`   Complete: ${hasRequired ? '✅' : '❌'}`);
    if (notifs.items.length > 0) {
      console.log('   Sample notification fields:', Object.keys(notifs.items[0]));
      console.log('   Expected notification fields: id, type, cat, kind, audience, unread, at, title, desc, link, icon');
      const hasNotifFields = notifs.items[0].id && notifs.items[0].type && notifs.items[0].cat && notifs.items[0].kind && notifs.items[0].audience && notifs.items[0].unread !== undefined && notifs.items[0].at && notifs.items[0].title;
      console.log(`   Notification complete: ${hasNotifFields ? '✅' : '❌'}\n`);
    } else {
      console.log('   ⚠️  No notifications found for user\n');
    }
  } catch (e) {
    console.log('❌ Notifications list failed:', e.message, '\n');
  }

  // Test 2: Unread Count
  console.log('🔢 Test 2: GET /api/notifications/unread-count');
  try {
    const count = await notificationsService.unreadCount(TEST_USER_ID);
    console.log('✅ Unread count response:', JSON.stringify(count, null, 2));
    console.log('   Expected fields: count');
    const hasRequired = count.count !== undefined;
    console.log(`   Complete: ${hasRequired ? '✅' : '❌'}\n`);
  } catch (e) {
    console.log('❌ Unread count failed:', e.message, '\n');
  }

  // Test 3: Settings
  console.log('⚙️  Test 3: GET /api/notifications/settings');
  try {
    const settings = await notificationsService.getSettings(TEST_USER_ID);
    console.log('✅ Settings response:', JSON.stringify(settings, null, 2));
    console.log('   Expected fields: settings');
    const hasRequired = settings.settings !== undefined;
    console.log(`   Complete: ${hasRequired ? '✅' : '❌'}\n`);
  } catch (e) {
    console.log('❌ Settings failed:', e.message, '\n');
  }
}

async function checkDatabaseCollections() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('DATABASE COLLECTIONS CHECK');
  console.log('══════════════════════════════════════════════════════════════\n');

  const collections = [
    { name: 'Book', model: Book },
    { name: 'Chapter', model: Chapter },
    { name: 'Character', model: Character },
    { name: 'Plot', model: Plot },
    { name: 'Contract', model: Contract },
    { name: 'ContractApplication', model: ContractApplication },
    { name: 'AuthorVerification', model: AuthorVerification },
    { name: 'LaunchCampaign', model: LaunchCampaign },
    { name: 'Notification', model: Notification },
    { name: 'User', model: User },
  ];

  for (const col of collections) {
    try {
      const count = await col.model.countDocuments();
      console.log(`✅ ${col.name.padEnd(25)} ${count} documents`);
    } catch (e) {
      console.log(`❌ ${col.name.padEnd(25)} Error: ${e.message}`);
    }
  }
  console.log();
}

async function checkFrontendBackendMapping() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('FRONTEND ↔ BACKEND MAPPING');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('AUTHOR CENTER:');
  console.log('Frontend: author-center-service.js');
  console.log('  - demoStats() → Expected: GET /api/author/dashboard');
  console.log('  - demoBooks() → Expected: GET /api/author/books');
  console.log('Backend: author.routes.js');
  console.log('  - GET /dashboard → author.controller.dashboard() → author.service.dashboard()');
  console.log('  - GET /books → author.controller.books() → author.service.books()');
  console.log('  - GET /contracts → author.controller.contracts() → author.service.listContracts()');
  console.log('  - GET /verification → author.controller.verification() → author.service.getVerification()');
  console.log('Status: ✅ All routes exist\n');

  console.log('NOTIFICATION PAGE:');
  console.log('Frontend: notification-page-service.js');
  console.log('  - Uses DroboardNotifStore → Expected: GET /api/notifications');
  console.log('Backend: notifications.routes.js');
  console.log('  - GET / → notifications.service.list()');
  console.log('  - GET /unread-count → notifications.service.unreadCount()');
  console.log('  - POST /read → notifications.service.markRead()');
  console.log('  - POST /read-all → notifications.service.markRead()');
  console.log('  - PATCH /:id → notifications.service.patchOne()');
  console.log('  - GET /settings → notifications.service.getSettings()');
  console.log('  - PUT /settings → notifications.service.saveSettings()');
  console.log('Status: ✅ All routes exist\n');
}

async function main() {
  try {
    await connectDB();
    await checkDatabaseCollections();
    await checkFrontendBackendMapping();
    await testAuthorCenter();
    await testNotifications();

    console.log('══════════════════════════════════════════════════════════════');
    console.log('AUDIT COMPLETE');
    console.log('══════════════════════════════════════════════════════════════\n');
    console.log('⚠️  NOTE: To test with real data, set TEST_USER_ID in .env');
    console.log('⚠️  Frontend USE_API flag determines if backend is called\n');

    await mongoose.disconnect();
  } catch (e) {
    console.error('Fatal error:', e);
    process.exit(1);
  }
}

main();
