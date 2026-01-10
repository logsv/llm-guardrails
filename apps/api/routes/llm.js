import express from 'express';
import { executeLLM } from '../controllers/gatewayController.js';

const router = express.Router();

router.post('/execute', executeLLM);

export default router;
