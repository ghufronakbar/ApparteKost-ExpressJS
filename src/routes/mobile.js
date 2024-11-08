import express from 'express';
const router = express.Router();
import account from '../services/mobile/account.js';
import boarding from '../services/mobile/boarding.js';

router.use('/account', account);
router.use('/boardings', boarding);

export default router