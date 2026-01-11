import { GuardrailViolation } from '../errors.js';

const BAD_WORDS = ['badword', 'forbidden']; 

export const profanityValidator = {
    validate: async ({ output, config }) => {
        let text = typeof output === 'string' ? output : JSON.stringify(output);
        const lower = text.toLowerCase();
        
        // This should be more robust in real implementation
        for (const word of BAD_WORDS) {
            if (lower.includes(word)) {
                if (config.action === 'sanitize') {
                    const sanitized = text.replace(new RegExp(word, 'gi'), '*'.repeat(word.length));
                    return { sanitized };
                }
                throw new GuardrailViolation('Profanity detected', {
                    guardrail: 'profanity_filter',
                    type: 'profanity',
                    value: word
                });
            }
        }
    }
};
