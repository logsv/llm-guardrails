import { describe, it } from 'node:test';
import assert from 'node:assert';
import { toxicityValidator } from '../src/validators/toxicity.js';

describe('Toxicity Validator - OpenAI Provider', () => {
    it('should detect toxicity using OpenAI', async () => {
        // Mock OpenAI Client
        const mockOpenAI = {
            moderations: {
                create: async ({ input }) => {
                    if (input.includes('hate')) {
                        return {
                            results: [{
                                flagged: true,
                                categories: { hate: true, violence: false },
                                category_scores: { hate: 0.99, violence: 0.1 }
                            }]
                        };
                    }
                    return {
                        results: [{
                            flagged: false,
                            categories: { hate: false },
                            category_scores: { hate: 0.01 }
                        }]
                    };
                }
            }
        };

        toxicityValidator.setOpenAI(mockOpenAI);

        // Test flagged content
        await assert.rejects(async () => {
            await toxicityValidator.validate({
                output: 'I hate you',
                config: { provider: 'openai', apiKey: 'test' }
            });
        }, (err) => {
            assert.strictEqual(err.name, 'GuardrailViolation');
            assert.strictEqual(err.type, 'toxicity');
            assert.ok(err.value.includes('hate'));
            return true;
        });

        // Test safe content
        await toxicityValidator.validate({
            output: 'I love you',
            config: { provider: 'openai', apiKey: 'test' }
        });
    });

    it('should throw if no API key', async () => {
        toxicityValidator.setOpenAI(null); // Reset to force client creation logic
        
        // Remove env var if set (mocking process.env isn't perfect in parallel tests but ok here)
        const originalKey = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;

        await assert.rejects(async () => {
             await toxicityValidator.validate({
                output: 'test',
                config: { provider: 'openai' },
                context: { env: {} }
            });
        }, /OpenAI API key not found/);

        // Restore
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });
});
