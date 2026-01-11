import { prisma } from '@llm-governance/common';
import { evaluationRunner } from './runner.js';
import { datasetService } from './dataset.js';

export class EvaluationService {
  async createRun({ datasetId, promptId, config }) {
    // Resolve dataset by ID or Name
    let dataset = await prisma.dataset.findUnique({ where: { id: datasetId } });
    if (!dataset) {
        dataset = await prisma.dataset.findUnique({ where: { name: datasetId } });
    }
    
    if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

    const run = await prisma.evaluationRun.create({
      data: {
        datasetId: dataset.id,
        promptId,
        config: config || {},
        status: 'pending',
      },
    });

    // Trigger async
    await evaluationRunner.triggerEvaluation(run.id);

    return run;
  }

  async getRun(runId) {
    return prisma.evaluationRun.findUnique({
      where: { id: runId },
      include: { results: true, dataset: true },
    });
  }

  async importDataset(json) {
      return datasetService.importDataset(json);
  }
}

export const evaluationService = new EvaluationService();
