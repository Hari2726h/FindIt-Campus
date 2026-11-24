const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { wrapAsync } = require('../utils/wrapAsync');
const { createReport } = require('../controllers/reportController');

const router = express.Router();

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many reports submitted. Please try again later.',
});

router.post('/', requireAuth, reportLimiter, wrapAsync(createReport));

module.exports = router;
