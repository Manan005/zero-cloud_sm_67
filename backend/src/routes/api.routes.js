import express from 'express';
import { indexRepository, searchCodebase } from '../controllers/ingest.controller.js';

const router = express.Router();

// Route to ingest / crawl local code repository
router.post('/index-repo', indexRepository);

// Route to run semantic queries against the codebase
router.post('/search', searchCodebase);

export default router;
export { router as apiRouter };
