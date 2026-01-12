import { Worker } from 'bullmq';
import { prisma } from '@llm-governance/common';
import { configLoader } from './config.js';

const config = configLoader.getPersistenceConfig();
const QUEUE_NAME = 'request-logs';
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const isTest = process.env.NODE_ENV === 'test' && !process.env.TEST_INTEGRATION;

export function startWorker() {
  if (!config.enabled || isTest) {
    console.log('Persistence worker disabled or in test mode');
    return null;
  }

  console.log(`Starting persistence worker for queue: ${QUEUE_NAME}`);
  
  const worker = new Worker(QUEUE_NAME, async (job) => {
    const data = job.data;
    try {
      await prisma.requestLog.create({
        data: {
          requestId: data.requestId,
          timestamp: new Date(data.timestamp),
          env: data.env,
          provider: data.provider,
          model: data.model,
          promptId: data.promptId,
          promptVersion: data.promptVersion,
          latencyMs: data.latencyMs,
          tokensIn: data.tokensIn,
          tokensOut: data.tokensOut,
          costUsd: data.costUsd,
          status: data.status,
          errorCode: data.errorCode,
          errorMessage: data.errorMessage,
          metadata: data.metadata || {},
        },
      });
    } catch (err) {
      if (configLoader.load().failure_handling?.on_persistence_error !== 'ignore') {
          console.error('Failed to persist request log:', err);
      }
      throw err;
    }
  }, { connection });

  worker.on('completed', (job) => {
    // console.log(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with ${err.message}`);
  });

  return worker;
}
