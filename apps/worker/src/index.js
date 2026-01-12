import 'dotenv/config';
import { startWorker } from '@llm-governance/observability';

console.log('Starting LLM Governance Worker Service...');

try {
  const worker = startWorker();
  
  if (worker) {
    console.log('Worker started successfully.');
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received. Closing worker...');
      await worker.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('SIGINT received. Closing worker...');
        await worker.close();
        process.exit(0);
      });
  } else {
    console.log('Worker failed to start or is disabled.');
  }
} catch (err) {
  console.error('Fatal error starting worker:', err);
  process.exit(1);
}
