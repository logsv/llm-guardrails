import express from 'express';
import * as promptController from '../controllers/promptController.js';

const router = express.Router();

router.post('/', promptController.createPrompt);
router.get('/', promptController.listPrompts);
router.post('/:id/versions', promptController.createVersion);
router.post('/:id/bind', promptController.bindEnvironment);
router.get('/:name/resolve', promptController.getPrompt);

export default router;
