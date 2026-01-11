import { Queue, Worker } from 'bullmq';
import { prisma } from '@llm-governance/common';
import { gatewayService } from '@llm-governance/gateway';
import { judgeService } from './judge.js';

const EVAL_QUEUE_NAME = 'evaluation-jobs';
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export class EvaluationRunner {
  constructor() {
    this.queue = new Queue(EVAL_QUEUE_NAME, { connection });
    this.worker = null;
  }

  async startWorker() {
    // Prevent starting multiple workers in same process
    if (this.worker) return;

    this.worker = new Worker(EVAL_QUEUE_NAME, async (job) => {
      await this.processJob(job);
    }, { connection });
    
    console.log('Evaluation worker started');
    
    this.worker.on('failed', (job, err) => {
        console.error(`Evaluation job ${job.id} failed:`, err);
    });
  }

  async triggerEvaluation(runId) {
    // We assume the Run is already created in DB with 'pending' status
    await this.queue.add('evaluate', { runId });
  }

  async processJob(job) {
    const { runId } = job.data;
    
    const run = await prisma.evaluationRun.findUnique({
      where: { id: runId },
      include: { dataset: { include: { testCases: true } } }
    });

    if (!run) throw new Error(`Run ${runId} not found`);

    await prisma.evaluationRun.update({
      where: { id: runId },
      data: { status: 'running' }
    });

    const results = [];
    
    // Config for candidate
    const candidateConfig = run.config || {}; 

    try {
      for (const testCase of run.dataset.testCases) {
        // 1. Run Candidate
        const request = {
          request_id: `eval-${runId}-${testCase.id}`,
          input: testCase.input, // { text: "..." } or { messages: ... }
          config: candidateConfig,
          env: 'test', // We use 'test' env for evaluations
          prompt_id: run.promptId, // Pass promptId if available
        };

        let candidateOutput = '';
        let error = null;

        try {
            const response = await gatewayService.execute(request);
            candidateOutput = response.content;
        } catch (err) {
            console.error(`Candidate failed for test case ${testCase.id}`, err);
            candidateOutput = `ERROR: ${err.message}`;
            error = err.message;
        }

        // 2. Run Judge
        // Skip judge if candidate failed completely? Or judge the error?
        // Usually if candidate fails, score is 0.
        
        let score = 0;
        let judgeResult = {};
        
        if (!error) {
            try {
                // metadata usually contains expected_traits
                const traits = testCase.metadata?.expected_traits || {};
                
                // If expectedOutput exists in DB, include it in traits or separate field?
                // The JudgeService currently takes (input, output, traits).
                // We can merge expectedOutput into traits if needed, or update JudgeService.
                // For now, sticking to traits.
                
                judgeResult = await judgeService.evaluate(
                    testCase.input,
                    candidateOutput,
                    traits
                );
                score = judgeResult.overall_score;
            } catch (err) {
                console.error(`Judge failed for test case ${testCase.id}`, err);
                judgeResult = { error: err.message };
                score = 0; // Fail
            }
        } else {
             judgeResult = { error: 'Candidate generation failed' };
        }

        // 3. Save Result
        const result = await prisma.evaluationResult.create({
            data: {
                runId: run.id,
                testCaseId: testCase.id,
                output: candidateOutput,
                score: score,
                reasoning: judgeResult.reasoning || judgeResult.error,
                metrics: judgeResult, // Store full breakdown
            }
        });
        results.push(result);
      }

      // 4. Aggregate
      const avgScore = results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;
      
      // Regression Check
      let regressionInfo = null;
      try {
          const previousRun = await prisma.evaluationRun.findFirst({
              where: {
                  datasetId: run.datasetId,
                  status: 'completed',
                  id: { not: runId }
              },
              orderBy: { createdAt: 'desc' }
          });

          if (previousRun && previousRun.score !== null) {
              const delta = avgScore - previousRun.score;
              // Threshold: 5% drop (0.25 on 5 point scale)
              const isRegression = delta < -0.25; 
              
              regressionInfo = {
                  baseline_run_id: previousRun.id,
                  baseline_score: previousRun.score,
                  delta: delta,
                  is_regression: isRegression
              };
          }
      } catch (err) {
          console.warn('Failed to check regression:', err);
      }

      await prisma.evaluationRun.update({
          where: { id: runId },
          data: {
              status: 'completed',
              completedAt: new Date(),
              score: avgScore,
              summary: {
                  total: results.length,
                  avg_score: avgScore,
                  regression: regressionInfo
              }
          }
      });

      // Metrics
      metricsService.recordEvaluation({
          dataset: run.dataset.name,
          status: 'completed',
          isRegression: regressionInfo?.is_regression || false
      });

    } catch (err) {
      console.error(`Evaluation Run ${runId} failed`, err);
      await prisma.evaluationRun.update({
          where: { id: runId },
          data: { status: 'failed' }
      });
      
      // Metrics (failed)
      try {
        metricsService.recordEvaluation({
            dataset: run.dataset?.name || 'unknown',
            status: 'failed',
            isRegression: false
        });
      } catch (e) { /* ignore */ }
      
      throw err;
    }
  }
  
  async close() {
      await this.queue.close();
      if (this.worker) await this.worker.close();
  }
}

export const evaluationRunner = new EvaluationRunner();
