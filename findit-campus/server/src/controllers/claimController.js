const prisma = require('../lib/prisma');
const { containsProfanity } = require('../utils/profanity');
const { parsePositiveInt } = require('../utils/validate');

const ATTEMPTS_ORDER = { attempts: { orderBy: { createdAt: 'asc' } } };
const CONFIRM_TRUST_BONUS = { finder: 2, claimant: 1 };

function toPublicAttempt(attempt) {
  return { id: attempt.id, answerText: attempt.answerText, createdAt: attempt.createdAt };
}

function toPublicClaimForClaimant(claim) {
  return {
    id: claim.id,
    status: claim.status,
    attemptsUsed: claim.attempts.length,
    attempts: claim.attempts.map(toPublicAttempt),
    hasConversation: Boolean(claim.conversation),
    createdAt: claim.createdAt,
  };
}

function toPublicClaimForFinder(claim) {
  return {
    id: claim.id,
    status: claim.status,
    claimant: { id: claim.claimant.id, name: claim.claimant.name },
    attempts: claim.attempts.map(toPublicAttempt),
    hasConversation: Boolean(claim.conversation),
    createdAt: claim.createdAt,
  };
}

function toPublicMessage(message) {
  return { id: message.id, senderId: message.senderId, text: message.text, createdAt: message.createdAt };
}

async function createClaim(req, res) {
  const postId = parsePositiveInt(req.params.id);
  if (postId === null) return res.status(400).json({ error: 'Invalid post id' });

  const { answerText } = req.body;
  if (!answerText || !answerText.trim()) {
    return res.status(400).json({ error: 'answerText is required' });
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, include: { challenge: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.type !== 'FOUND' || !post.challenge) {
    return res.status(400).json({ error: 'Only found-item posts with a verification question can be claimed' });
  }
  if (post.userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot claim your own post' });
  }
  if (post.status !== 'OPEN') {
    return res.status(400).json({ error: 'This item is no longer open for claims' });
  }

  // The read-check-write for "already confirmed?" / "attempts exhausted?"
  // used to happen outside any transaction, so two near-simultaneous
  // submits (flaky client retry, or someone scripting guesses at the
  // secret answer) could both read "2 of 3 attempts used" and both insert
  // an attempt, exceeding the cap meant to stop exactly that. Running the
  // whole read-then-write as one interactive transaction makes SQLite
  // serialize the two attempts, so the second one's read reflects the
  // first one's already-committed write.
  let claimId = null;
  let outcome = 'ok';

  await prisma.$transaction(async (tx) => {
    let claim = await tx.claim.findUnique({
      where: { postId_claimantId: { postId, claimantId: req.user.id } },
      include: ATTEMPTS_ORDER,
    });

    if (claim && claim.status === 'CONFIRMED') {
      outcome = 'confirmed';
      return;
    }
    if (claim && claim.attempts.length >= post.challenge.maxAttempts) {
      outcome = 'limit';
      return;
    }

    if (!claim) {
      claim = await tx.claim.create({
        data: { postId, claimantId: req.user.id, status: 'PENDING' },
        include: ATTEMPTS_ORDER,
      });
    } else if (claim.status === 'REJECTED') {
      await tx.claim.update({ where: { id: claim.id }, data: { status: 'PENDING' } });
    }

    await tx.claimAttempt.create({ data: { claimId: claim.id, answerText: answerText.trim() } });
    claimId = claim.id;
  });

  if (outcome === 'confirmed') {
    return res.status(400).json({ error: 'This claim has already been confirmed' });
  }
  if (outcome === 'limit') {
    return res.status(429).json({
      error: `You've used all ${post.challenge.maxAttempts} attempts for this item. If you're sure it's yours, message campus lost-and-found staff directly.`,
    });
  }

  const updated = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { ...ATTEMPTS_ORDER, conversation: true },
  });

  res.status(201).json({
    claim: toPublicClaimForClaimant(updated),
    attemptsRemaining: post.challenge.maxAttempts - updated.attempts.length,
  });
}

async function getMyClaimForPost(req, res) {
  const postId = parsePositiveInt(req.params.id);
  if (postId === null) return res.status(400).json({ error: 'Invalid post id' });

  const post = await prisma.post.findUnique({ where: { id: postId }, include: { challenge: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const claim = await prisma.claim.findUnique({
    where: { postId_claimantId: { postId, claimantId: req.user.id } },
    include: { ...ATTEMPTS_ORDER, conversation: true },
  });

  res.json({
    claim: claim ? toPublicClaimForClaimant(claim) : null,
    maxAttempts: post.challenge ? post.challenge.maxAttempts : null,
  });
}

async function listClaimsForPost(req, res) {
  const postId = parsePositiveInt(req.params.id);
  if (postId === null) return res.status(400).json({ error: 'Invalid post id' });

  const post = await prisma.post.findUnique({ where: { id: postId }, include: { challenge: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user.id) {
    return res.status(403).json({ error: 'You can only review claims on your own posts' });
  }

  const claims = await prisma.claim.findMany({
    where: { postId },
    include: { claimant: true, ...ATTEMPTS_ORDER, conversation: true },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    question: post.challenge ? post.challenge.questionText : null,
    secretAnswer: post.challenge ? post.challenge.secretAnswer : null,
    claims: claims.map(toPublicClaimForFinder),
  });
}

async function confirmClaim(req, res) {
  const claimId = parsePositiveInt(req.params.claimId);
  if (claimId === null) return res.status(400).json({ error: 'Invalid claim id' });

  const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { post: true, conversation: true } });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.post.userId !== req.user.id) {
    return res.status(403).json({ error: 'Only the post owner can confirm a claim' });
  }
  if (claim.status === 'CONFIRMED') {
    return res.status(400).json({ error: 'This claim is already confirmed' });
  }

  // A conditional updateMany (rather than a plain update) inside the
  // transaction means a racing second "Confirm" click — which already
  // passed the plain status check above before either transaction ran —
  // affects 0 rows here instead of re-running the trust-score increments a
  // second time.
  await prisma.$transaction(async (tx) => {
    const claimUpdate = await tx.claim.updateMany({
      where: { id: claimId, status: { not: 'CONFIRMED' } },
      data: { status: 'CONFIRMED' },
    });
    if (claimUpdate.count === 0) return;

    await tx.post.update({ where: { id: claim.postId }, data: { status: 'CLAIMED' } });
    await tx.claim.updateMany({
      where: { postId: claim.postId, id: { not: claimId }, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    await tx.user.update({
      where: { id: claim.post.userId },
      data: { trustScore: { increment: CONFIRM_TRUST_BONUS.finder } },
    });
    await tx.user.update({
      where: { id: claim.claimantId },
      data: { trustScore: { increment: CONFIRM_TRUST_BONUS.claimant } },
    });
  });

  if (!claim.conversation) {
    try {
      await prisma.conversation.create({ data: { claimId } });
    } catch (err) {
      // Same double-click race as above: a second "Confirm" click can land
      // here before the first one's conversation is visible in this request's
      // pre-fetched `claim`. Conversation.claimId is unique — ignore and move
      // on, since the first request already created the one we need.
      if (err.code !== 'P2002') throw err;
    }
  }

  const updated = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { claimant: true, ...ATTEMPTS_ORDER, conversation: true },
  });

  res.json({ claim: toPublicClaimForFinder(updated) });
}

async function rejectClaim(req, res) {
  const claimId = parsePositiveInt(req.params.claimId);
  if (claimId === null) return res.status(400).json({ error: 'Invalid claim id' });

  const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { post: true } });
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.post.userId !== req.user.id) {
    return res.status(403).json({ error: 'Only the post owner can reject a claim' });
  }
  if (claim.status === 'CONFIRMED') {
    return res.status(400).json({ error: 'This claim is already confirmed and cannot be rejected' });
  }

  const updated = await prisma.claim.update({
    where: { id: claimId },
    data: { status: 'REJECTED' },
    include: { claimant: true, ...ATTEMPTS_ORDER, conversation: true },
  });

  res.json({ claim: toPublicClaimForFinder(updated) });
}

async function getConversationContext(claimId, userId) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { post: true, conversation: true },
  });
  if (!claim) return { error: { status: 404, message: 'Claim not found' } };

  const isClaimant = claim.claimantId === userId;
  const isFinder = claim.post.userId === userId;
  if (!isClaimant && !isFinder) {
    return { error: { status: 403, message: 'You are not part of this conversation' } };
  }
  if (!claim.conversation) {
    return { error: { status: 400, message: 'Chat opens once the finder confirms this claim' } };
  }

  return { claim, isClaimant, isFinder };
}

async function listMessages(req, res) {
  const claimId = parsePositiveInt(req.params.claimId);
  if (claimId === null) return res.status(400).json({ error: 'Invalid claim id' });

  const ctx = await getConversationContext(claimId, req.user.id);
  if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

  const messages = await prisma.message.findMany({
    where: { conversationId: ctx.claim.conversation.id },
    orderBy: { createdAt: 'asc' },
  });

  const readField = ctx.isClaimant ? 'claimantLastReadAt' : 'finderLastReadAt';
  await prisma.claim.update({ where: { id: claimId }, data: { [readField]: new Date() } });

  res.json({ messages: messages.map(toPublicMessage) });
}

async function sendMessage(req, res) {
  const claimId = parsePositiveInt(req.params.claimId);
  if (claimId === null) return res.status(400).json({ error: 'Invalid claim id' });

  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
  if (containsProfanity(text)) {
    return res.status(400).json({ error: 'Please keep the conversation respectful — message not sent' });
  }

  const ctx = await getConversationContext(claimId, req.user.id);
  if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message });

  const message = await prisma.message.create({
    data: { conversationId: ctx.claim.conversation.id, senderId: req.user.id, text: text.trim() },
  });

  res.status(201).json({ message: toPublicMessage(message) });
}

async function listMyClaims(req, res) {
  const userId = req.user.id;

  const [asClaimantRaw, asFinderRaw] = await Promise.all([
    prisma.claim.findMany({
      where: { claimantId: userId },
      include: { post: true, conversation: { include: { messages: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.claim.findMany({
      where: { post: { userId } },
      include: { post: true, claimant: true, conversation: { include: { messages: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  function unreadFor(claim, lastReadAt) {
    if (!claim.conversation) return 0;
    return claim.conversation.messages.filter(
      (m) => m.senderId !== userId && (!lastReadAt || m.createdAt > lastReadAt)
    ).length;
  }

  const asClaimant = asClaimantRaw.map((c) => ({
    id: c.id,
    status: c.status,
    post: { id: c.post.id, title: c.post.title, type: c.post.type },
    hasConversation: Boolean(c.conversation),
    unread: unreadFor(c, c.claimantLastReadAt),
    createdAt: c.createdAt,
  }));

  const asFinder = asFinderRaw.map((c) => ({
    id: c.id,
    status: c.status,
    post: { id: c.post.id, title: c.post.title, type: c.post.type },
    claimant: { id: c.claimant.id, name: c.claimant.name },
    hasConversation: Boolean(c.conversation),
    unread: unreadFor(c, c.finderLastReadAt),
    createdAt: c.createdAt,
  }));

  const summary = {
    pendingAsFinder: asFinder.filter((c) => c.status === 'PENDING').length,
    unreadTotal: [...asClaimant, ...asFinder].reduce((sum, c) => sum + c.unread, 0),
  };

  res.json({ asClaimant, asFinder, summary });
}

module.exports = {
  createClaim,
  getMyClaimForPost,
  listClaimsForPost,
  confirmClaim,
  rejectClaim,
  listMessages,
  sendMessage,
  listMyClaims,
};
