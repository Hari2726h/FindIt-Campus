// Minimal in-memory sliding-window limiter — no Redis, no extra dependency.
// Good enough for a single-process student deployment; resets on restart
// and doesn't share state across multiple server instances, which is a
// known trade-off, not an oversight.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // key -> array of hit timestamps

  const sweepInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of hits) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }, Math.max(windowMs, 60000));
  sweepInterval.unref();

  return function rateLimitMiddleware(req, res, next) {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = (hits.get(key) || []).filter((t) => t > windowStart);
    if (timestamps.length >= max) {
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

module.exports = { rateLimit };
