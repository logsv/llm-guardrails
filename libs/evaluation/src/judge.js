import { z } from 'zod';
import { gatewayService } from '@llm-governance/gateway';

const JudgeResultSchema = z.object({
  relevance: z.number().min(1).max(5),
  accuracy: z.number().min(1).max(5),
  clarity: z.number().min(1).max(5),
  hallucination_risk: z.number().min(1).max(5),
  overall_score: z.number().min(1).max(5),
  reasoning: z.string().optional(),
});

const JUDGE_PROMPT_TEMPLATE = `
You are an impartial AI Judge. Evaluate the "Actual Output" against the "Input" and "Expected Traits".
Use the following rubric.

Input:
{{input}}

Actual Output:
{{output}}

Expected Traits:
{{traits}}

Rubric:
- Relevance (1-5): Does it directly answer the input?
- Accuracy (1-5): Is the information correct?
- Clarity (1-5): Is it easy to understand?
- Hallucination Risk (1-5): 1 = Low Risk (Grounded), 5 = High Risk (Made up info).

Provide a JSON response with the following structure:
{
  "relevance": <number>,
  "accuracy": <number>,
  "clarity": <number>,
  "hallucination_risk": <number>,
  "overall_score": <number>,
  "reasoning": "<short explanation>"
}
`;

export class JudgeService {
  constructor(gateway = gatewayService) {
    this.gateway = gateway;
    // Config could come from a file/env, but hardcoding 'strongest model' for judge is common practice
    this.judgeConfig = {
      provider: 'openai', 
      model: 'gpt-4', 
    };
  }

  async evaluate(input, output, traits) {
    const prompt = JUDGE_PROMPT_TEMPLATE
      .replace('{{input}}', JSON.stringify(input, null, 2))
      .replace('{{output}}', output)
      .replace('{{traits}}', JSON.stringify(traits, null, 2));

    try {
      // We assume the gateway can handle raw messages or text input
      // The gateway service usually expects `input: { text: ... }` or `messages`.
      // Let's use messages for chat models.
      const request = {
        request_id: `judge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        input: { 
            messages: [{ role: 'user', content: prompt }] 
        },
        config: this.judgeConfig,
        env: 'prod', // Judge runs as a system process
      };

      const response = await this.gateway.execute(request);
      
      const content = response.content;
      // Extract JSON (handle potential markdown blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found in judge response: ${content}`);
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = JudgeResultSchema.parse(parsed);
      
      return validated;
    } catch (err) {
      console.error('Judge evaluation failed:', err);
      // We explicitly throw so the worker can handle retry or failure marking
      throw err;
    }
  }
}

export const judgeService = new JudgeService();
