import { GuardrailViolation } from '../errors.js';

const PATTERNS = {
    aws_access_key: /\bAKIA[0-9A-Z]{16}\b/g,
    private_key: /-----BEGIN PRIVATE KEY-----/g,
    api_key: /sk-[a-zA-Z0-9]{20,}/g,
};

export const secretsValidator = {
    validate: async ({ input, config }) => {
        let text = '';
        if (typeof input === 'string') text = input;
        else if (input.messages) text = JSON.stringify(input.messages);
        else if (input.text) text = input.text;

        const detected = [];
        const patternsToCheck = config.patterns || Object.keys(PATTERNS);

        for (const p of patternsToCheck) {
            const regex = PATTERNS[p];
            if (regex && regex.test(text)) {
                detected.push(p);
            }
        }

        if (detected.length > 0) {
            throw new GuardrailViolation('Secret leaked', {
                guardrail: 'secrets_detection',
                type: 'secret_found',
                value: detected,
                metadata: { patterns: detected }
            });
        }
    }
};
