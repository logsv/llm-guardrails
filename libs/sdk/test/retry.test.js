import { describe, it } from 'node:test';
import assert from 'node:assert';
import { observe, init } from '../src/llm.js';

describe('SDK Retry Logic', () => {
    it('should retry and succeed', async () => {
        // Mock policy using profanity validator which triggers on 'badword'
        const policy = {
            output: {
                profanity_filter: { 
                    enabled: true, 
                    action: 'retry' // This triggers the retry logic
                }
            }
        };
        
        // Re-init SDK
        init({ policy });

        let attempts = 0;
        const fn = async () => {
            attempts++;
            console.log(`Mock FN called, attempt ${attempts}`);
            if (attempts === 1) {
                return "This contains a badword";
            }
            return "This is clean";
        };

        const result = await observe({ 
            maxRetries: 2,
            model: 'test-model'
        }, fn);

        assert.strictEqual(result, "This is clean");
        assert.strictEqual(attempts, 2);
    });

    it('should exhaust retries and fail', async () => {
        const policy = {
            output: {
                profanity_filter: { 
                    enabled: true, 
                    action: 'retry'
                }
            }
        };
        
        init({ policy });

        let attempts = 0;
        const fn = async () => {
            attempts++;
            return "This always has a badword";
        };

        await assert.rejects(async () => {
            await observe({ 
                maxRetries: 2,
                model: 'test-model'
            }, fn);
        }, (err) => {
            assert.match(err.message, /Max retries exceeded/);
            return true;
        });

        assert.strictEqual(attempts, 3); // Initial + 2 retries
    });
});
