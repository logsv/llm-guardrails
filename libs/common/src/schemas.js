import { z } from 'zod';

export const LLMRequestSchema = z.object({
  prompt_id: z.string().optional(),
  input: z.record(z.any()),
  env: z.enum(['prod', 'dev', 'test']).default('prod'),
  metadata: z.record(z.any()).optional(),
  config: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
      timeout: z.number().optional(),
      retries: z.number().optional(),
    })
    .optional(),
});

export const LLMResponseSchema = z.object({
  content: z.string().nullable(),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
  provider: z.string(),
  model: z.string(),
  metadata: z.record(z.any()).optional(),
});
