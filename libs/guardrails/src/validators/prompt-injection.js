import { GuardrailViolation } from '../errors.js';

export const promptInjectionValidator = {
    validate: async ({ input, config }) => {
        let text = '';
        if (typeof input === 'string') text = input;
        else if (input.messages) text = JSON.stringify(input.messages);
        else if (input.text) text = input.text;
        
        const lower = text.toLowerCase();
        const detected = [];

        for (const phrase of config.patterns || []) {
            if (lower.includes(phrase.toLowerCase())) {
                detected.push(phrase);
            }
        }

        if (detected.length > 0) {
            throw new GuardrailViolation('Potential prompt injection', {
                guardrail: 'prompt_injection',
                type: 'keyword_match',
                value: detected,
                metadata: { matches: detected }
            });
        }
    }
};
