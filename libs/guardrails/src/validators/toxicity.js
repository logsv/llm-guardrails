import { GuardrailViolation } from '../errors.js';
import { pipeline } from '@xenova/transformers';
import OpenAI from 'openai';

let classifier = null;
let openaiClient = null;

export const toxicityValidator = {
    // For testing
    setClassifier: (mock) => { classifier = mock; },
    setOpenAI: (mock) => { openaiClient = mock; },

    // Initialize model once
    init: async () => {
        if (!classifier) {
            // Use a small, efficient model for toxicity detection
            // 'Xenova/toxic-bert' or similar would be ideal, but for general demo:
            // We'll use sentiment-analysis as a proxy or a specific toxicity model if available.
            // Let's use 'Xenova/distilbert-base-uncased-finetuned-sst-2-english' for now as a placeholder for "Negative Sentiment" = "Toxic"
            // In a real scenario, use 'Xenova/toxic-bert' or equivalent.
            classifier = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
        }
    },

    validate: async ({ output, config, context }) => {
        const text = typeof output === 'string' ? output : JSON.stringify(output);
        const provider = config.provider || 'local';

        if (provider === 'openai') {
            if (!openaiClient) {
                const apiKey = config.apiKey || context?.env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
                if (!apiKey) {
                    throw new Error('OpenAI API key not found for toxicity validation');
                }
                openaiClient = new OpenAI({ apiKey });
            }

            const response = await openaiClient.moderations.create({ input: text });
            const result = response.results[0];

            if (result.flagged) {
                 const categories = Object.keys(result.categories).filter(cat => result.categories[cat]);
                 throw new GuardrailViolation('Toxic content detected (OpenAI)', {
                    guardrail: 'toxicity_detection',
                    type: 'toxicity',
                    value: categories,
                    metadata: { categories, scores: result.category_scores }
                 });
            }
            return;
        }

        if (!classifier) await toxicityValidator.init();

        const results = await classifier(text);
        
        // Results are like [{ label: 'NEGATIVE', score: 0.99 }]
        const topResult = results[0];
        const threshold = config.threshold || 0.8;

        // For SST-2, 'NEGATIVE' is the label we care about for "toxicity" proxy
        if (topResult.label === 'NEGATIVE' && topResult.score > threshold) {
            throw new GuardrailViolation('Toxic content detected', {
                guardrail: 'toxicity_detection',
                type: 'toxicity',
                value: topResult.score,
                metadata: { label: topResult.label, score: topResult.score }
            });
        }
    }
};
