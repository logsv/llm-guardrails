import { test, describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { evaluationService, evaluationRunner } from '../../../libs/evaluation/index.js';
import { gatewayService } from '../../../libs/gateway/index.js';
import { prisma } from '@llm-governance/common';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Evaluation Flow', () => {
  before(async () => {
    // Start the worker for processing jobs
    await evaluationRunner.startWorker();
  });

  after(async () => {
    await evaluationRunner.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean DB
    await prisma.evaluationResult.deleteMany();
    await prisma.evaluationRun.deleteMany();
    await prisma.testCase.deleteMany();
    await prisma.dataset.deleteMany();
  });

  it('should run an evaluation end-to-end', async () => {
    // 1. Mock Gateway
    // We need to mock calls for "Candidate" and "Judge"
    
    // We can inspect arguments to distinguish
    const executeMock = mock.method(gatewayService, 'execute', async (req) => {
        if (req.request_id && req.request_id.startsWith('judge-')) {
            // It's a judge call
            return {
                content: JSON.stringify({
                    relevance: 5,
                    accuracy: 5,
                    clarity: 5,
                    hallucination_risk: 1,
                    overall_score: 5,
                    reasoning: "Perfect response"
                })
            };
        } else {
            // It's a candidate call
            return {
                content: "This is the candidate response."
            };
        }
    });

    // 2. Import Dataset
    const datasetJson = {
      dataset_id: "test_dataset_v1",
      version: "1.0",
      samples: [
        {
          id: "sample-1",
          input: { text: "Hello" },
          expected_traits: { politeness: true }
        }
      ]
    };
    await evaluationService.importDataset(datasetJson);

    // 3. Create Run
    const run = await evaluationService.createRun({
      datasetId: "test_dataset_v1",
      promptId: "test-prompt",
      config: { provider: "mock", model: "mock-model" }
    });

    assert.strictEqual(run.status, 'pending');

    // 4. Wait for completion
    let updatedRun;
    for (let i = 0; i < 20; i++) {
        await sleep(500);
        updatedRun = await evaluationService.getRun(run.id);
        if (updatedRun.status === 'completed' || updatedRun.status === 'failed') break;
    }

    assert.strictEqual(updatedRun.status, 'completed');
    assert.strictEqual(updatedRun.score, 5);
    assert.strictEqual(updatedRun.results.length, 1);
    assert.strictEqual(updatedRun.results[0].score, 5);
    
    // Verify mocks were called
    assert.ok(executeMock.mock.calls.length >= 2, 'Should call gateway twice (candidate + judge)');
    
    executeMock.mock.restore();
  });
});
