const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { toPublicPost } = require('../utils/serializers');
const { UPLOAD_DIR } = require('../middleware/upload');
const { scorePair } = require('../utils/matching');
const { containsProfanity } = require('../utils/profanity');
const { parsePositiveInt } = require('../utils/validate');

const INCLUDE = { user: true, images: true, challenge: true };
const VALID_TYPES = new Set(['LOST', 'FOUND']);
const MIN_MATCH_SCORE = 0.2;
const MAX_MATCHES = 5;

async function list(req, res) {
  const { type, category, q, location, from, to, sort } = req.query;

  const where = { status: 'OPEN' };
  if (type && VALID_TYPES.has(type.toUpperCase())) where.type = type.toUpperCase();
  if (category) where.category = category;
  if (location) where.locationText = { contains: location };
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const dateFilter = {};
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) dateFilter.gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) dateFilter.lte = toDate;
  }
  if (Object.keys(dateFilter).length > 0) where.dateEvent = dateFilter;

  const orderBy = { createdAt: sort === 'oldest' ? 'asc' : 'desc' };

  const posts = await prisma.post.findMany({ where, include: INCLUDE, orderBy });

  res.json({ posts: posts.map(toPublicPost) });
}

async function mine(req, res) {
  const posts = await prisma.post.findMany({
    where: { userId: req.user.id },
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ posts: posts.map(toPublicPost) });
}

async function getOne(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid post id' });

  const post = await prisma.post.findUnique({ where: { id }, include: INCLUDE });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json({ post: toPublicPost(post) });
}

async function create(req, res) {
  const { type, category, title, description, dateEvent, locationText, questionText, secretAnswer } = req.body;

  const normalizedType = (type || '').toUpperCase();
  if (!VALID_TYPES.has(normalizedType)) {
    return res.status(400).json({ error: 'type must be LOST or FOUND' });
  }
  if (!category || !title || !description || !dateEvent || !locationText) {
    return res.status(400).json({ error: 'category, title, description, dateEvent and locationText are required' });
  }

  if (normalizedType === 'FOUND' && (!questionText || !secretAnswer)) {
    return res.status(400).json({
      error: 'Found posts require questionText and secretAnswer so the real owner can prove it is theirs',
    });
  }

  if (containsProfanity(title) || containsProfanity(description)) {
    return res.status(400).json({ error: 'Please remove inappropriate language from the title or description' });
  }

  const parsedDate = new Date(dateEvent);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'dateEvent must be a valid date' });
  }

  const files = req.files || [];

  const post = await prisma.post.create({
    data: {
      userId: req.user.id,
      type: normalizedType,
      category,
      title,
      description,
      dateEvent: parsedDate,
      locationText,
      images: { create: files.map((f) => ({ url: `/uploads/${f.filename}` })) },
      ...(normalizedType === 'FOUND'
        ? { challenge: { create: { questionText, secretAnswer } } }
        : {}),
    },
    include: INCLUDE,
  });

  res.status(201).json({ post: toPublicPost(post) });
}

async function update(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid post id' });

  const existing = await prisma.post.findUnique({ where: { id }, include: INCLUDE });
  if (!existing) return res.status(404).json({ error: 'Post not found' });
  if (existing.userId !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own posts' });
  }

  const { category, title, description, dateEvent, locationText, status, questionText, secretAnswer } = req.body;

  if (containsProfanity(title) || containsProfanity(description)) {
    return res.status(400).json({ error: 'Please remove inappropriate language from the title or description' });
  }

  const data = {};
  if (category) data.category = category;
  if (title) data.title = title;
  if (description) data.description = description;
  if (locationText) data.locationText = locationText;
  if (dateEvent) {
    const parsedDate = new Date(dateEvent);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'dateEvent must be a valid date' });
    }
    data.dateEvent = parsedDate;
  }

  // Only a manual "mark resolved" is allowed through this generic edit
  // endpoint. OPEN is the creation default and CLAIMED is only ever set by
  // the claim-confirm flow (claimController.confirmClaim) — letting it be
  // set here too used to mean an owner could silently reopen a CLAIMED post,
  // let a second claimant get confirmed, and double-credit trust scores for
  // what the claim flow treats as a single already-settled item.
  if (status && status.toUpperCase() === 'RESOLVED') {
    data.status = 'RESOLVED';
  }

  const newFiles = req.files || [];
  if (newFiles.length) {
    data.images = { create: newFiles.map((f) => ({ url: `/uploads/${f.filename}` })) };
  }

  if (existing.type === 'FOUND' && (questionText || secretAnswer)) {
    data.challenge = {
      upsert: {
        create: {
          questionText: questionText || 'What identifying detail does this item have?',
          secretAnswer: secretAnswer || existing.challenge?.secretAnswer || '',
        },
        update: {
          ...(questionText ? { questionText } : {}),
          ...(secretAnswer ? { secretAnswer } : {}),
        },
      },
    };
  }

  const updated = await prisma.post.update({ where: { id }, data, include: INCLUDE });
  res.json({ post: toPublicPost(updated) });
}

async function matches(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid post id' });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user.id) {
    return res.status(403).json({ error: 'You can only view match suggestions for your own posts' });
  }

  const oppositeType = post.type === 'LOST' ? 'FOUND' : 'LOST';
  const candidates = await prisma.post.findMany({
    where: { type: oppositeType, status: 'OPEN' },
    include: INCLUDE,
  });

  const scored = candidates
    .map((candidate) => ({ candidate, ...scorePair(post, candidate) }))
    .filter((entry) => entry.total >= MIN_MATCH_SCORE)
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_MATCHES);

  res.json({
    matches: scored.map((entry) => ({
      post: toPublicPost(entry.candidate),
      score: Math.round(entry.total * 100),
      breakdown: {
        category: Math.round(entry.breakdown.category * 100),
        date: Math.round(entry.breakdown.date * 100),
        location: Math.round(entry.breakdown.location * 100),
        text: Math.round(entry.breakdown.text * 100),
      },
    })),
  });
}

async function remove(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid post id' });

  const existing = await prisma.post.findUnique({ where: { id }, include: INCLUDE });
  if (!existing) return res.status(404).json({ error: 'Post not found' });
  if (existing.userId !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own posts' });
  }
  if (existing.status === 'CLAIMED') {
    return res.status(400).json({
      error: 'This item has a confirmed claim in progress — mark it resolved instead of deleting it, so the other person does not lose their chat.',
    });
  }

  for (const img of existing.images) {
    const filePath = path.join(UPLOAD_DIR, path.basename(img.url));
    fs.promises.unlink(filePath).catch(() => {});
  }

  await prisma.post.delete({ where: { id } });
  res.status(204).send();
}

module.exports = { list, mine, getOne, create, update, remove, matches };
