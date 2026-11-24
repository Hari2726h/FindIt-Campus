const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { wrapAsync } = require('../utils/wrapAsync');
const {
  confirmClaim,
  rejectClaim,
  listMessages,
  sendMessage,
  listMyClaims,
} = require('../controllers/claimController');

const router = express.Router();

router.get('/mine', requireAuth, wrapAsync(listMyClaims));
router.post('/:claimId/confirm', requireAuth, wrapAsync(confirmClaim));
router.post('/:claimId/reject', requireAuth, wrapAsync(rejectClaim));
router.get('/:claimId/messages', requireAuth, wrapAsync(listMessages));
router.post('/:claimId/messages', requireAuth, wrapAsync(sendMessage));

module.exports = router;
