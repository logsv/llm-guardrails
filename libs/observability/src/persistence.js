import { Queue } from 'bullmq';
import { configLoader } from './config.js';

const config = configLoader.getPersistenceConfig();

const QUEUE_NAME = 'request-logs';
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const isTest = process.env.NODE_ENV === 'test' && !process.env.TEST_INTEGRATION;

// Queue for producers
// Use offline queue to prevent crashing if Redis is down
export const logQueue = (config.enabled && !isTest) ? new Queue(QUEUE_NAME, { 
  connection: {
    ...connection,
    enableOfflineQueue: true,
    connectTimeout: 1000, // Fail fast on connection
  }
}) : { add: async () => {}, close: async () => {}, on: () => {} };

// Handle queue errors
if (logQueue.on) {
    logQueue.on('error', (err) => {
        // Suppress unhandled error events and reduce verbosity
        // Only log if it's NOT a connection refused error, or log it once?
        if (err.code !== 'ECONNREFUSED') {
            console.error('Queue error:', err.message);
        }
    });
}

export const persistenceService = {
  async logRequest(data) {
    if (!config.enabled) return;
    
    try {
      await logQueue.add('log', data, {
        removeOnComplete: true,
        removeOnFail: 5000, // Keep failed jobs for 5s
      });
    } catch (err) {
      const failureMode = configLoader.load().failure_handling?.on_persistence_error || 'log_only';
      if (failureMode !== 'ignore') {
          // console.error('Failed to queue request log:', err.message);
          // Fallback: log to console so we don't lose data completely
          // console.log('FALLBACK_LOG:', JSON.stringify(data));
      }
    }
  },
  
  async close() {
    if (logQueue.close) await logQueue.close();
  }
};
