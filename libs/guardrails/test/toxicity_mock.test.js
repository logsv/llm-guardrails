import { describe, it } from 'node:test';
import assert from 'node:assert';
import { toxicityValidator } from '../src/validators/toxicity.js';
import { GuardrailViolation } from '../src/errors.js';

describe('Toxicity Validator', () => {
    it('should detect toxic content', async () => {
        // Mock classifier
        const mockClassifier = async (text) => {
            if (text.includes('hate')) {
                return [{ label: 'NEGATIVE', score: 0.99 }];
            }
            return [{ label: 'POSITIVE', score: 0.99 }];
        };

        toxicityValidator.setClassifier(mockClassifier);

        // Toxic input
        await assert.rejects(async () => {
            await toxicityValidator.validate({
                output: 'I hate everything',
                config: { threshold: 0.9 }
            });
        }, (err) => {
            assert.strictEqual(err.name, 'GuardrailViolation');
            assert.strictEqual(err.type, 'toxicity');
            return true;
        });

        // Safe input
        await toxicityValidator.validate({
            output: 'I love everything',
            config: { threshold: 0.9 }
        });
    });
});
