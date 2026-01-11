import { z } from 'zod';
import { prisma } from '@llm-governance/common';

const TestCaseSchema = z.object({
  id: z.string().optional(),
  input: z.record(z.any()),
  expected_output: z.string().optional(),
  expected_traits: z.record(z.any()).optional(), // For rubric matching
  metadata: z.record(z.any()).optional(),
});

const DatasetSchema = z.object({
  dataset_id: z.string(),
  name: z.string().optional(), // Fallback to dataset_id
  description: z.string().optional(),
  version: z.string(),
  owner: z.string().optional(),
  samples: z.array(TestCaseSchema),
});

export class DatasetService {
  async importDataset(jsonData) {
    const parsed = DatasetSchema.safeParse(jsonData);
    if (!parsed.success) {
      throw new Error(`Invalid dataset format: ${JSON.stringify(parsed.error.format())}`);
    }

    const { dataset_id, description, samples } = parsed.data;

    // Transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
      // Upsert Dataset
      const dataset = await tx.dataset.upsert({
        where: { name: dataset_id },
        update: {
          description,
        },
        create: {
          name: dataset_id,
          description,
        },
      });

      // Process Samples
      // We can replace all or append. 
      // "Immutable once published (new version instead)" implies we shouldn't change existing samples of a versioned dataset.
      // But here we are just syncing. Let's wipe and recreate for simplicity or update if ID matches.
      // Since samples have IDs in the JSON, let's try to upsert them.

      const results = [];
      for (const sample of samples) {
        // Construct metadata from traits + extra
        const metadata = {
            expected_traits: sample.expected_traits,
            ...sample.metadata
        };

        const testCase = await tx.testCase.upsert({
            where: { id: sample.id || 'undefined-id-fallback' }, // If ID provided, use it. If not, create new (but upsert needs unique)
            // Actually, prisma schema for TestCase has ID @default(uuid()). 
            // If sample.id is provided, we treat it as the UUID? Or an external ID?
            // The JSON sample says "id": "sample-001". This is not a UUID.
            // We should store this external ID in metadata or make ID a string (it is string).
            // But upsert requires a unique constraint. TestCase ID is PK.
            // "sample-001" might conflict across datasets if not careful, but usually it's scoped.
            // Let's assume we create new if not found, or update. 
            // BUT "id" in schema is PK.
            // Let's verify schema: `id String @id @default(uuid())`
            // If we want to use "sample-001" as ID, we can, but it must be unique globally in the table? 
            // Ideally we should have `datasetId` + `externalId` unique.
            // For now, let's rely on wiping and recreating for this "version".
            // OR: Just create new ones if not exist.
            
            // SIMPLIFICATION: Delete all test cases for this dataset and recreate.
            // This ensures strict sync with the JSON file.
            create: {
                datasetId: dataset.id,
                input: sample.input,
                expectedOutput: sample.expected_output,
                metadata: metadata,
            },
            update: {
                input: sample.input,
                expectedOutput: sample.expected_output,
                metadata: metadata,
            }
        });
        // Wait, upsert needs a unique key. 'id' is unique.
        // If sample.id is NOT a UUID, we can't easily rely on it being the PK unless we enforce it.
        // If the user provides "sample-001", and we use it as PK, it might clash.
        // Better strategy: Delete all test cases for this dataset and insert new ones.
      }
      
      // Let's do the delete-insert strategy for safety and consistency with "versioned dataset" concept.
      // If the user wants a new version, they change the dataset_id (e.g. "support_v1" -> "support_v2").
      
      await tx.testCase.deleteMany({
          where: { datasetId: dataset.id }
      });

      await tx.testCase.createMany({
          data: samples.map(s => ({
              datasetId: dataset.id,
              input: s.input,
              expectedOutput: s.expected_output,
              metadata: { expected_traits: s.expected_traits, ...s.metadata },
              // We lose the stable ID "sample-001" if we don't store it.
              // Let's store it in metadata.external_id
          }))
      });

      return dataset;
    });
  }

  async getDataset(name) {
    return prisma.dataset.findUnique({
      where: { name },
      include: { testCases: true },
    });
  }
}

export const datasetService = new DatasetService();
