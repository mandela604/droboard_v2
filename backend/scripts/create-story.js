'use strict';
/**
 * Create a complete story with chapters, polls, debates, predictions
 * Run: node backend/scripts/create-story.js
 * Requires: MONGO_URI, JWT_ACCESS_SECRET in env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { Book, Chapter, Genre, Category } = require('../src/models/content.model');
const { User, Wallet, WalletTransaction } = require('../src/models/user.model');
const { Poll, Prediction, Debate } = require('../src/models/social.model');
const { FeaturedPlacement, FeaturedSection } = require('../src/models/editorial.model');
const { newId } = require('../src/models/ids');

// Simple slugify (copied from books.service.js)
function slugify(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/droboard';

async function connect() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

async function getOrCreateAdmin() {
  let admin = await User.findOne({ roles: 'admin' }).lean();
  if (!admin) {
    admin = await User.findOne({ email: { $regex: /admin/i } }).lean();
  }
  if (!admin) {
    throw new Error('No admin user found. Create one first or specify ADMIN_ID env var.');
  }
  console.log('Using admin:', admin.username || admin.email, admin.id);
  return admin;
}

async function getOrCreateGenre() {
  let genre = await Genre.findOne({ status: 'active' }).lean();
  if (!genre) {
    const cat = await Category.findOne().lean();
    if (!cat) throw new Error('No category exists');
    genre = await Genre.create({
      id: newId('genre'),
      name: 'Fantasy',
      slug: 'fantasy',
      categoryId: cat.id,
      status: 'active',
    });
    console.log('Created genre:', genre.name);
  }
  return genre;
}

async function createStory(admin, genre) {
  const storyId = newId('book');
  const coverUrl = 'https://imagedelivery.net/test/cover-test/public'; // placeholder CF Images URL
  
  const book = await Book.create({
    id: storyId,
    title: 'The Crown of Shadows',
    slug: slugify('The Crown of Shadows') + '-' + storyId.slice(-6),
    authorId: admin.id,
    genre: genre.name,
    genreId: genre.id,
    categoryId: genre.categoryId,
    synopsis: 'A young thief discovers she is the last heir to a forgotten throne. With ancient magic awakening and enemies closing in, she must master her birthright before the kingdom falls to darkness.',
    cover: coverUrl,
    status: 'published',
    chapterCount: 0,
    reads: 0,
    likes: 0,
    rating: 0,
    tags: ['fantasy', 'magic', 'royalty', 'adventure'],
    tropes: ['hidden heir', 'forbidden magic', 'slow burn romance', 'political intrigue'],
    publishedAt: new Date(),
  });
  console.log('Created story:', book.title, book.id);
  return book;
}

async function createChapters(book, admin) {
  const chapterData = [
    { n: 1, title: 'The Lockpick and the Letter', words: 3200 },
    { n: 2, title: 'Midnight in the Archives', words: 2800 },
    { n: 3, title: 'The King\'s Forgotten Seal', words: 3500 },
    { n: 4, title: 'Flight from the Capital', words: 3100 },
    { n: 5, title: 'The Whispering Woods', words: 2900 },
  ];

  const chapters = [];
  for (const ch of chapterData) {
    const chapter = await Chapter.create({
      id: newId('chapter'),
      bookId: book.id,
      n: ch.n,
      title: ch.title,
      text: `<p>Chapter ${ch.n} content goes here. This is placeholder text for "${ch.title}". In production, replace with actual chapter content (~${ch.words} words).</p>
<p>The story continues with vivid descriptions, dialogue, and plot advancement. Each chapter builds upon the last, revealing more about the protagonist's heritage and the magical world she's thrust into.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>`,
      wordCount: ch.words,
      status: 'published',
      publishedAt: new Date(Date.now() - (5 - ch.n) * 86400000), // stagger publish dates
    });
    chapters.push(chapter);
    console.log(`Created chapter ${ch.n}: ${ch.title}`);
  }

  // Update book chapter count
  await Book.updateOne({ id: book.id }, { chapterCount: chapters.length });
  return chapters;
}

async function createPolls(book, chapters, admin) {
  const polls = [
    {
      bookId: book.id,
      chapterId: null, // book-wide
      question: 'Who is the true villain of the story?',
      options: [
        { text: 'The Shadow King', votes: 0 },
        { text: 'The Royal Advisor', votes: 0 },
        { text: 'The Protagonist\'s Sibling', votes: 0 },
        { text: 'An Ancient God', votes: 0 },
      ],
      isBookWide: true,
    },
    {
      bookId: book.id,
      chapterId: chapters[0].id,
      question: 'What should the thief steal first?',
      options: [
        { text: 'The Royal Signet Ring', votes: 0 },
        { text: 'The Ancient Map', votes: 0 },
        { text: 'The Forbidden Grimoire', votes: 0 },
        { text: 'The Queen\'s Necklace', votes: 0 },
      ],
      isBookWide: false,
    },
    {
      bookId: book.id,
      chapterId: chapters[2].id,
      question: 'Which ally will betray the group?',
      options: [
        { text: 'The Loyal Knight', votes: 0 },
        { text: 'The Mysterious Mage', votes: 0 },
        { text: 'The Street Urchin', votes: 0 },
        { text: 'None - they\'re all loyal', votes: 0 },
      ],
      isBookWide: false,
    },
  ];

  for (const p of polls) {
    await Poll.create({
      id: newId('poll'),
      bookId: p.bookId,
      chapterId: p.chapterId,
      question: p.question,
      options: p.options,
      totalVotes: 0,
      isActive: true,
      createdBy: admin.id,
    });
    console.log(`Created poll: ${p.question} (${p.chapterId ? 'ch ' + p.chapterId.slice(-4) : 'book-wide'})`);
  }
}

async function createPredictions(book, chapters, admin) {
  const predictions = [
    {
      bookId: book.id,
      chapterId: null,
      question: 'What will the protagonist\'s true name be revealed as?',
      options: [
        { text: 'Princess Aelindra', votes: 0 },
        { text: 'Lady Seraphina', votes: 0 },
        { text: 'Queen Isolde', votes: 0 },
        { text: 'Something else entirely', votes: 0 },
      ],
      resolvesAt: new Date(Date.now() + 30 * 86400000), // 30 days
    },
    {
      bookId: book.id,
      chapterId: chapters[1].id,
      question: 'Will the ancient map lead to the hidden vault?',
      options: [
        { text: 'Yes, exactly as shown', votes: 0 },
        { text: 'Yes, but it\'s a trap', votes: 0 },
        { text: 'No, the map is fake', votes: 0 },
        { text: 'It leads somewhere unexpected', votes: 0 },
      ],
      resolvesAt: new Date(Date.now() + 14 * 86400000),
    },
    {
      bookId: book.id,
      chapterId: chapters[3].id,
      question: 'Which character dies in the forest?',
      options: [
        { text: 'The Mentor', votes: 0 },
        { text: 'The Love Interest', votes: 0 },
        { text: 'The Comic Relief', votes: 0 },
        { text: 'Nobody dies', votes: 0 },
      ],
      resolvesAt: new Date(Date.now() + 21 * 86400000),
    },
  ];

  for (const p of predictions) {
    await Prediction.create({
      id: newId('prediction'),
      bookId: p.bookId,
      chapterId: p.chapterId,
      question: p.question,
      options: p.options,
      totalVotes: 0,
      isActive: true,
      resolvesAt: p.resolvesAt,
      createdBy: admin.id,
    });
    console.log(`Created prediction: ${p.question} (${p.chapterId ? 'ch ' + p.chapterId.slice(-4) : 'book-wide'})`);
  }
}

async function createDebates(book, chapters, admin) {
  const debates = [
    {
      bookId: book.id,
      chapterId: null,
      motion: 'Magic should be regulated by the crown',
      forText: 'Regulated magic protects the realm from chaos and abuse. Uncontrolled magic users are a danger to everyone.',
      againstText: 'Magic is a natural right. Regulation is oppression. The crown fears what it cannot control.',
      forVotes: 0,
      againstVotes: 0,
    },
    {
      bookId: book.id,
      chapterId: chapters[1].id,
      motion: 'The thief was justified in stealing the royal seal',
      forText: 'She\'s reclaiming her birthright. The seal belongs to her bloodline, not the usurper on the throne.',
      againstText: 'Theft is theft. Two wrongs don\'t make a right. She should have pursued legal channels.',
      forVotes: 0,
      againstVotes: 0,
    },
    {
      bookId: book.id,
      chapterId: chapters[4].id,
      motion: 'The forest spirits are allies, not enemies',
      forText: 'They protect the ancient magic. The protagonist needs their guidance to unlock her power.',
      againstText: 'They\'re manipulative entities using her for their own ends. Every interaction has a hidden price.',
      forVotes: 0,
      againstVotes: 0,
    },
  ];

  for (const d of debates) {
    await Debate.create({
      id: newId('debate'),
      bookId: d.bookId,
      chapterId: d.chapterId,
      motion: d.motion,
      forText: d.forText,
      againstText: d.againstText,
      forVotes: d.forVotes,
      againstVotes: d.againstVotes,
      isActive: true,
      createdBy: admin.id,
    });
    console.log(`Created debate: ${d.motion} (${d.chapterId ? 'ch ' + d.chapterId.slice(-4) : 'book-wide'})`);
  }
}

async function addToFeatured(book, admin) {
  // Add to "hero-banner" section
  const heroSection = await FeaturedSection.findOne({ key: 'hero-banner' }).lean();
  if (heroSection) {
    await FeaturedPlacement.create({
      id: newId('featured'),
      sectionKey: 'hero-banner',
      bookId: book.id,
      order: 1,
      active: true,
      startAt: new Date(),
      endAt: new Date(Date.now() + 30 * 86400000),
      createdBy: admin.id,
    });
    console.log('Added to hero-banner');
  }

  // Add to "editors-picks" section
  const picksSection = await FeaturedSection.findOne({ key: 'editors-picks' }).lean();
  if (picksSection) {
    await FeaturedPlacement.create({
      id: newId('featured'),
      sectionKey: 'editors-picks',
      bookId: book.id,
      order: 1,
      active: true,
      startAt: new Date(),
      endAt: new Date(Date.now() + 30 * 86400000),
      createdBy: admin.id,
    });
    console.log('Added to editors-picks');
  }
}

async function main() {
  try {
    await connect();
    
    const admin = await getOrCreateAdmin();
    const genre = await getOrCreateGenre();
    const book = await createStory(admin, genre);
    const chapters = await createChapters(book, admin);
    await createPolls(book, chapters, admin);
    await createPredictions(book, chapters, admin);
    await createDebates(book, chapters, admin);
    await addToFeatured(book, admin);
    
    console.log('\n✅ Story created successfully!');
    console.log('Book ID:', book.id);
    console.log('Title:', book.title);
    console.log('Chapters:', chapters.length);
    console.log('Status: published');
    console.log('\nTo verify in admin panel:');
    console.log('1. Go to /super-admin/books');
    console.log('2. Search for "The Crown of Shadows"');
    console.log('3. Check chapters, polls, debates, predictions tabs');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();