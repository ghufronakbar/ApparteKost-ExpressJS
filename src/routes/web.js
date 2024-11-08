import express from 'express';
const router = express.Router();
import auth from '../services/web/auth.js';
import boarding from '../services/web/boarding.js';

router.use('/auth', auth);
router.use('/boardings', boarding);

export default router