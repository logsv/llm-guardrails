import { describe, it } from 'node:test';
import assert from 'node:assert';
import { piiValidator } from '../src/validators/pii.js';

describe('PII Validator', () => {
    it('should detect US phone numbers using libphonenumber', async () => {
        const input = 'My number is 650-253-0000.';
        const result = await piiValidator.validate({
            input: input,
            config: { 
                categories: ['phone'],
                action: 'mask'
            }
        });
        
        assert.ok(result.output.includes('[REDACTED]'));
        assert.ok(!result.output.includes('650-253-0000'));
    });

    it('should detect SSN', async () => {
        const input = 'My SSN is 123-45-6789.';
        const result = await piiValidator.validate({
            input: input,
            config: { 
                categories: ['ssn'],
                action: 'mask'
            }
        });
        
        assert.ok(result.output.includes('[REDACTED]'));
        assert.ok(!result.output.includes('123-45-6789'));
    });

    it('should detect email', async () => {
        const input = 'Contact me at test@example.com';
        const result = await piiValidator.validate({
            input: input,
            config: { 
                categories: ['email'],
                action: 'mask'
            }
        });
        
        assert.ok(result.output.includes('[REDACTED]'));
        assert.ok(!result.output.includes('test@example.com'));
    });

    it('should ignore non-PII', async () => {
        const input = 'I have 5 apples.';
        const result = await piiValidator.validate({
            input: input,
            config: { 
                categories: ['phone', 'email', 'ssn'],
                action: 'mask'
            }
        });
        
        // Should return undefined if no violation/modification?
        // piiValidator returns undefined if no match.
        assert.strictEqual(result, undefined);
    });
});
