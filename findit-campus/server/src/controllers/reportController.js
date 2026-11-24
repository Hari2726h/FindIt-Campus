const prisma = require('../lib/prisma');
const { parsePositiveInt } = require('../utils/validate');

const VALID_TARGET_TYPES = new Set(['POST', 'USER']);
const TRUST_PENALTY = { POST: 3, USER: 5 };

async function createReport(req, res) {
  const { targetType, targetId, reason } = req.body;
  const normalizedType = (targetType || '').toUpperCase();

  if (!VALID_TARGET_TYPES.has(normalizedType)) {
    return res.status(400).json({ error: 'targetType must be POST or USER' });
  }
  const parsedTargetId = parsePositiveInt(targetId);
  if (parsedTargetId === null) {
    return res.status(400).json({ error: 'targetId must be a positive number' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'reason is required' });
  }

  if (normalizedType === 'POST') {
    const post = await prisma.post.findUnique({ where: { id: parsedTargetId } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot report your own post' });
    }
  } else {
    const target = await prisma.user.findUnique({ where: { id: parsedTargetId } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot report yourself' });
    }
  }

  const existingOpen = await prisma.report.findFirst({
    where: { reporterId: req.user.id, targetType: normalizedType, targetId: parsedTargetId, status: 'OPEN' },
  });
  if (existingOpen) {
    return res.status(409).json({ error: "You've already reported this — it's still pending review." });
  }

  const report = await prisma.report.create({
    data: { reporterId: req.user.id, targetType: normalizedType, targetId: parsedTargetId, reason: reason.trim() },
  });

  res.status(201).json({ report });
}

async function resolveTargetPreview(report) {
  if (report.targetType === 'POST') {
    const post = await prisma.post.findUnique({ where: { id: report.targetId } });
    return post ? { label: post.title, deleted: false } : { label: '(post deleted)', deleted: true };
  }
  const user = await prisma.user.findUnique({ where: { id: report.targetId } });
  return user ? { label: user.name, deleted: false } : { label: '(user deleted)', deleted: true };
}

async function listReports(req, res) {
  const reports = await prisma.report.findMany({
    include: { reporter: true },
    orderBy: { createdAt: 'desc' },
  });

  const withPreviews = await Promise.all(
    reports.map(async (r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      target: await resolveTargetPreview(r),
      reason: r.reason,
      status: r.status,
      reporter: { id: r.reporter.id, name: r.reporter.name },
      createdAt: r.createdAt,
    }))
  );

  res.json({ reports: withPreviews });
}

async function updateReportStatus(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid report id' });

  const { status } = req.body;
  const normalizedStatus = (status || '').toUpperCase();

  if (!['RESOLVED', 'DISMISSED'].includes(normalizedStatus)) {
    return res.status(400).json({ error: 'status must be RESOLVED or DISMISSED' });
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return res.status(404).json({ error: 'Report not found' });

  // Conditional updateMany, not a plain update: two admins (or one
  // double-clicking) resolving the same report at once both used to pass a
  // plain `status !== 'OPEN'` check before either write landed, so both
  // would apply the trust penalty — only one would actually stick given a
  // read-then-subtract, silently losing the other. Guarding the status
  // transition itself on `status: 'OPEN'` means only one of two racing
  // requests ever proceeds past this point.
  const transition = await prisma.report.updateMany({
    where: { id, status: 'OPEN' },
    data: { status: normalizedStatus },
  });
  if (transition.count === 0) {
    return res.status(400).json({ error: 'This report has already been reviewed' });
  }

  // A resolved report means the report was valid — penalize the target's
  // trust score. A dismissed report means it wasn't, so no penalty.
  if (normalizedStatus === 'RESOLVED') {
    const penalty = TRUST_PENALTY[report.targetType] || 0;
    const targetUserId =
      report.targetType === 'USER'
        ? report.targetId
        : (await prisma.post.findUnique({ where: { id: report.targetId } }))?.userId;

    if (targetUserId) {
      // Atomic decrement rather than read-then-subtract, so concurrent
      // penalties against the same user (two different resolved reports)
      // both land instead of one clobbering the other.
      await prisma.user.updateMany({
        where: { id: targetUserId },
        data: { trustScore: { decrement: penalty } },
      });
      const target = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (target && target.trustScore < 0) {
        await prisma.user.update({ where: { id: targetUserId }, data: { trustScore: 0 } });
      }
    }
  }

  const updated = await prisma.report.findUnique({ where: { id } });
  res.json({ report: updated });
}

async function adminDeletePost(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid post id' });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  await prisma.post.delete({ where: { id } });
  res.status(204).send();
}

async function getStats(req, res) {
  const [totalUsers, totalPosts, openPosts, claimedPosts, resolvedPosts, openReports] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.post.count({ where: { status: 'OPEN' } }),
    prisma.post.count({ where: { status: 'CLAIMED' } }),
    prisma.post.count({ where: { status: 'RESOLVED' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
  ]);

  res.json({ totalUsers, totalPosts, openPosts, claimedPosts, resolvedPosts, openReports });
}

module.exports = { createReport, listReports, updateReportStatus, adminDeletePost, getStats };
