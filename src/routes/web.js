import express from 'express';
const router = express.Router();
import auth from '../services/web/auth.js';
import boarding from '../services/web/boarding.js';
import transaction from '../services/web/transaction.js';

router.use('/auth', auth);
router.use('/boardings', boarding);
router.use('/transactions', transaction);

export default router