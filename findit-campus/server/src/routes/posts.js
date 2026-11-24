const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { wrapAsync } = require('../utils/wrapAsync');
const { list, mine, getOne, create, update, remove, matches } = require('../controllers/postController');
const { createClaim, getMyClaimForPost, listClaimsForPost } = require('../controllers/claimController');

const router = express.Router();

// Order matters: /mine must come before /:id
router.get('/', wrapAsync(list));
router.get('/mine', requireAuth, wrapAsync(mine));
router.get('/:id', wrapAsync(getOne));
router.get('/:id/matches', requireAuth, wrapAsync(matches));
router.get('/:id/claims/mine', requireAuth, wrapAsync(getMyClaimForPost));
router.get('/:id/claims', requireAuth, wrapAsync(listClaimsForPost));
router.post('/:id/claims', requireAuth, wrapAsync(createClaim));
router.post('/', requireAuth, upload.array('images', 5), wrapAsync(create));
router.put('/:id', requireAuth, upload.array('images', 5), wrapAsync(update));
router.delete('/:id', requireAuth, wrapAsync(remove));

module.exports = router;
