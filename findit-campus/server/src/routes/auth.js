const express = require('express');
const { signup, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { wrapAsync } = require('../utils/wrapAsync');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

router.post('/signup', authLimiter, wrapAsync(signup));
router.post('/login', authLimiter, wrapAsync(login));
router.get('/me', requireAuth, wrapAsync(me));

module.exports = router;
