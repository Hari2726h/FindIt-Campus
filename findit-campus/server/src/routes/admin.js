const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { wrapAsync } = require('../utils/wrapAsync');
const { listReports, updateReportStatus, adminDeletePost, getStats } = require('../controllers/reportController');

const router = express.Router();

router.use(requireAuth, wrapAsync(requireAdmin));

router.get('/stats', wrapAsync(getStats));
router.get('/reports', wrapAsync(listReports));
router.patch('/reports/:id', wrapAsync(updateReportStatus));
router.delete('/posts/:id', wrapAsync(adminDeletePost));

module.exports = router;
