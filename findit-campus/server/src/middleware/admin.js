const prisma = require('../lib/prisma');

// requireAuth only decodes the JWT (id, email) — admin status can change
// after a token is issued, so it's looked up fresh from the DB on every
// request rather than trusted from the token payload.
async function requireAdmin(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAdmin };
