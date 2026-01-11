import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { GatewayService } from '../../../libs/gateway/src/service.js';
import { GuardrailViolation } from '../../../libs/guardrails/src/errors.js';

describe('Gateway with Guardrails', () => {
    it('should block request when input guardrail fails', async () => {
        const mockPromptService = { getPrompt: mock.fn() };
        
        // Mock Engine
        const mockEngine = {
            executeInput: mock.fn(async () => {
                throw new GuardrailViolation('Blocked by guardrail');
            }),
            executeOutput: mock.fn()
        };

        const gateway = new GatewayService(mockPromptService, mockEngine);
        
        const request = {
            input: { text: 'bad input' },
            config: { provider: 'mock' }
        };

        await assert.rejects(async () => {
            await gateway.execute(request);
        }, (err) => {
            return err instanceof GuardrailViolation;
        });
        
        assert.strictEqual(mockEngine.executeInput.mock.callCount(), 1);
    });

    it('should sanitize output when guardrail modifies it', async () => {
         const mockPromptService = { getPrompt: mock.fn() };
         const mockProvider = {
             generate: mock.fn(async () => ({ content: 'bad output' }))
         };

         const mockEngine = {
             executeInput: mock.fn(),
             executeOutput: mock.fn(async () => {
                 // console.log('Mock executeOutput called');
                 return { allowed: true, output: { content: 'sanitized output' } };
             })
         };

         const gateway = new GatewayService(mockPromptService, mockEngine);
         gateway.registerProvider('mock', mockProvider);
         
         const request = {
             input: { text: 'good input' },
             config: { provider: 'mock' }
         };

         const result = await gateway.execute(request);
         assert.strictEqual(result.content, 'sanitized output');
    });
});
