'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/posts.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
// Composers (feed/profile post-composer + droboard composer) attach client-only
// meta (id, name, avatar, time, likes, liked, comments, saved, mine, userVote,
// voted…). .passthrough() lets them through; the service normalizes content
// and mongoose drops unknown fields on save. Both debate/poll payload dialects
// are accepted: droboard {motion}/{q,opts:{t}} and feed {question,forText…}/{question,opts:{label}}.
const postBody = z.object({
  type: z.enum(['announcement', 'post', 'debate', 'shoutout', 'repost', 'poll', 'forum-poll', 'ama', 'review', 'recommendation', 'quote', 'chapter-drop']),
  title: z.string().max(160).optional(),
  text: z.string().max(10000).optional(),
  note: z.string().max(2000).optional(),
  image: z.string().max(1000).optional(),
  heading: z.string().max(160).optional(),
  quote: z.string().max(2000).optional(),
  caption: z.string().max(300).optional(),
  quoteBg: z.string().max(40).optional(),
  quoteBgCss: z.string().max(300).optional(),
  poll: z.object({
    q: z.string().max(300).optional(),
    question: z.string().max(300).optional(), // feed-composer alias
    opts: z.array(z.union([z.string().min(1).max(120), z.record(z.any())])).min(2).max(4).optional(),
    total: z.number().optional(), voted: z.any().optional(), // client state — ignored
  }).refine(p => p.q || p.question, { message: 'poll_question_required' }).optional(),
  debateData: z.object({
    motion: z.string().max(500).optional(),
    question: z.string().max(500).optional(), // feed-composer alias
    prompt: z.string().max(300).optional(),
    forText: z.string().max(60).optional(),
    againstText: z.string().max(60).optional(),
    forV: z.number().optional(), agV: z.number().optional(), userVote: z.any().optional(), // server counts — ignored
  }).refine(d => d.motion || d.question, { message: 'debate_motion_required' }).optional(),
  amaData: z.object({
    isLive: z.boolean().optional(), viewers: z.number().int().min(0).optional(),
    title: z.string().max(160).optional(), meta: z.string().max(300).optional(),
  }).passthrough().optional(),
  shoutout: z.object({
    id: z.string().max(40).optional(), userId: z.string().max(40).optional(),
    name: z.string().max(80).optional(), avatar: z.string().max(2000).optional(),
    handle: z.string().max(40).optional(), tagline: z.string().max(300).optional(),
    role: z.string().max(30).optional(), stats: z.any().optional(),
    readingHours: z.number().optional(), chaptersRead: z.number().optional(),
    streak: z.number().optional(), following: z.boolean().optional(),
  }).passthrough().optional(),
  storyRef: z.object({
    id: z.string().max(40).optional(),
    title: z.string().min(1).max(160), cat: z.string().max(40).optional(),
    writer: z.string().max(80).optional(), author: z.string().max(80).optional(),
    cover: z.string().max(500).optional(),
  }).optional(),
  chapterRef: z.object({
    id: z.string().max(40).optional(), title: z.string().max(160).optional(),
    author: z.string().max(80).optional(), cover: z.string().max(500).optional(),
    ch: z.string().max(40).optional(), cat: z.string().max(40).optional(),
  }).passthrough().optional(),
  // review posts: stars + review body (post-card renders both)
  score: z.number().min(1).max(5).optional(),
  reviewText: z.string().max(600).optional(),
}).passthrough().refine(
  d => d.title || d.text || d.note || d.image || d.poll || d.shoutout || d.storyRef
    || d.debateData || d.quote || d.amaData || d.chapterRef || d.reviewText,
  { message: 'empty_post' },
);

router.get('/', generalLimiter, (req, _res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.cookies && req.cookies.dro_access) || null;
    if (token) {
      const jwt = require('jsonwebtoken');
      const env = require('../config/env');
      const p = jwt.verify(token, env.jwtAccessSecret);
      req.user = { id: p.sub, roles: p.roles || [] };
    }
  } catch (e) { /* anonymous */ }
  next();
}, validate(z.object({ query: z.object({
  tab: z.string().max(20).optional(), type: z.string().max(20).optional(),
  authorId: z.string().max(40).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict() })), ctrl.list);

router.post('/', requireAuth, writeLimiter, audit('posts.create'),
  validate(z.object({ body: postBody })), ctrl.create);

router.get('/:id', generalLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.get);
router.patch('/:id', requireAuth, writeLimiter, audit('posts.update'),
  validate(z.object({
    params: z.object({ id }),
    // passthrough: composer edit payloads carry the whole post; service picks fields
    body: z.object({
      title: z.string().max(160).optional(), text: z.string().max(10000).optional(),
      note: z.string().max(2000).optional(), image: z.string().max(1000).optional(),
      pinned: z.boolean().optional(), heading: z.string().max(160).optional(),
      quote: z.string().max(2000).optional(), caption: z.string().max(300).optional(),
      quoteBg: z.string().max(40).optional(), quoteBgCss: z.string().max(300).optional(),
    }).passthrough(),
  })), ctrl.update);
router.delete('/:id', requireAuth, writeLimiter, audit('posts.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

router.post('/:id/like', requireAuth, writeLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.like);
router.post('/:id/save', requireAuth, writeLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.save);
router.post('/:id/poll/vote', requireAuth, writeLimiter, audit('posts.pollVote'),
  validate(z.object({ params: z.object({ id }), body: z.object({ option: z.number().int().min(0).max(10) }).strict() })), ctrl.pollVote);
router.post('/:id/debate/vote', requireAuth, writeLimiter, audit('posts.debateVote'),
  validate(z.object({ params: z.object({ id }), body: z.object({ side: z.enum(['for', 'against']) }).strict() })), ctrl.debateVote);

const rid = z.string().min(1).max(40);
router.get('/:id/reactions', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.reactions);
router.post('/:id/react', requireAuth, writeLimiter, audit('posts.react'),
  validate(z.object({ params: z.object({ id }), body: z.object({ rid }).strict() })), ctrl.react);
router.delete('/:id/react', requireAuth, writeLimiter, audit('posts.unreact'),
  validate(z.object({ params: z.object({ id }) })), ctrl.unreact);
router.post('/:id/share', requireAuth, writeLimiter, audit('posts.share'),
  validate(z.object({ params: z.object({ id }), body: z.object({ channel: z.string().min(1).max(30) }).strict() })), ctrl.share);

module.exports = router;
