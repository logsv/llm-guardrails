import { GuardrailViolation } from '../errors.js';

export const inputSizeValidator = {
  validate: async ({ input, config }) => {
    let text = '';
    if (typeof input === 'string') text = input;
    else if (input.messages) text = input.messages.map(m => m.content).join(' ');
    else if (input.text) text = input.text;
    
    if (text.length > config.max_characters) {
      throw new GuardrailViolation('Input too large', {
        guardrail: 'size_limits',
        type: 'max_characters',
        value: text.length,
        metadata: { limit: config.max_characters }
      });
    }
    
    // Crude token estimation (4 chars per token)
    const estimatedTokens = text.length / 4;
    if (estimatedTokens > config.max_tokens_estimate) {
        throw new GuardrailViolation('Token limit exceeded', {
            guardrail: 'size_limits',
            type: 'max_tokens_estimate',
            value: estimatedTokens,
            metadata: { limit: config.max_tokens_estimate }
        });
    }
  }
};
