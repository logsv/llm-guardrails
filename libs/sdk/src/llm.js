import { GuardrailsEngine, loadPolicy, validators } from '@llm-governance/guardrails';
import { persistenceService, metricsService, calculateCost } from '@llm-governance/observability';
import { gatewayService } from '@llm-governance/gateway';
import { runWithContext } from './context.js';
import path from 'path';
import crypto from 'crypto';

let engine = null;
let initialized = false;

// Initialize the SDK with configuration
export function init(config) {
    if (initialized) return;

    if (config.policyPath) {
        try {
            const policy = loadPolicy(config.policyPath);
            engine = new GuardrailsEngine(policy, validators);
            console.log('LLM Governance SDK initialized with policy:', config.policyPath);
        } catch (err) {
            console.error('Failed to load guardrails policy:', err);
            // We might want to throw or continue without guardrails depending on strictness
            if (config.strict) throw err;
        }
    } else if (config.policy) {
        engine = new GuardrailsEngine(config.policy, validators);
    }

    if (engine) {
        gatewayService.setGuardrails(engine);
    }

    initialized = true;
}

/**
 * Invoke an LLM request through the governance gateway.
 * Handles guardrails, policies, prompt versioning, and observability automatically.
 * 
 * @param {String|Object} input - User query string, or object with { messages } or { prompt_variables }
 * @param {Object} options - Configuration options
 * @param {String} [options.model] - Model to use (e.g., 'gpt-4')
 * @param {String} [options.provider] - Provider to use (e.g., 'openai')
 * @param {String} [options.prompt_id] - Managed Prompt ID to use
 * @param {String} [options.env] - Environment (prod, dev, test)
 * @param {Object} [options.config] - Additional provider config
 * @returns {Promise<Object>} LLM Response
 */
export async function invoke(input, options = {}) {
    if (!initialized && options.policyPath) {
        init({ policyPath: options.policyPath });
    }

    // Map arguments to Gateway Request
    const request = {
        request_id: options.requestId || crypto.randomUUID(),
        env: options.env || process.env.NODE_ENV || 'prod',
        prompt_id: options.prompt_id,
        config: {
            provider: options.provider,
            model: options.model,
            params: options.params || options.config
        }
    };

    // Handle Input Normalization
    if (typeof input === 'string') {
        if (request.prompt_id) {
             // If using a managed prompt, map string to 'user_input' variable
             request.input = { prompt_variables: { user_input: input } };
        } else {
             // Direct text execution
             request.input = { text: input };
        }
    } else {
        // Structured input (messages, prompt_variables, etc)
        request.input = input;
    }

    return await gatewayService.execute(request);
}

export async function observe(options, fn) {
    if (!initialized && options.policyPath) {
        init({ policyPath: options.policyPath });
    }

    const start = Date.now();
    const requestId = crypto.randomUUID();
    
    // Default metadata
    const metadata = {
        requestId,
        timestamp: new Date(),
        ...options.metadata
    };

    return runWithContext({ requestId, metadata }, async () => {
        try {
            // 1. Input Guardrails
            if (engine && options.input) {
                const validation = await engine.executeInput({ 
                    input: options.input,
                    context: metadata 
                });
                // Violations are thrown by engine if action is reject
                // If modified input is returned (e.g. masked), use it
                if (validation.input) {
                    // Update the input for the function? 
                    // The function `fn` is already bound or takes arguments. 
                    // If `fn` expects arguments, we can't easily change them unless `fn` accepts the input object.
                    // For this pattern, we assume `fn` uses the input we validated, 
                    // OR we pass the validated input to `fn` if it accepts arguments.
                }
            }

            // 2. Execute User Function
            let result;
            try {
                result = await fn();
            } catch (err) {
                // Record error
                await persistenceService.logRequest({
                    ...metadata,
                    latencyMs: Date.now() - start,
                    status: 'error',
                    errorCode: err.code || 'EXECUTION_ERROR',
                    errorMessage: err.message
                });
                throw err;
            }

            // 3. Output Guardrails
            if (engine && result) {
                // Determine output string/object
                const outputToCheck = typeof result === 'string' ? result : JSON.stringify(result);
                const guardResult = await engine.executeOutput({ 
                    output: outputToCheck,
                    context: metadata
                });
                
                if (guardResult && guardResult.output && guardResult.output !== outputToCheck) {
                     result = guardResult.output;
                }
            }

            // 4. Observability & Cost
            const latencyMs = Date.now() - start;
            
            // Calculate cost if usage provided
            let costUsd = 0;
            let tokensIn = 0;
            let tokensOut = 0;

            if (options.usage) {
                tokensIn = options.usage.prompt_tokens || 0;
                tokensOut = options.usage.completion_tokens || 0;
                // Estimate cost
                if (options.model && options.provider) {
                    const cost = calculateCost({
                        provider: options.provider,
                        model: options.model,
                        tokensIn,
                        tokensOut
                    });
                    costUsd = cost.totalCost;
                }
            }

            // Persist Log (Fire and forget to avoid blocking)
            persistenceService.logRequest({
                ...metadata,
                latencyMs,
                status: 'success',
                model: options.model,
                provider: options.provider,
                tokensIn,
                tokensOut,
                costUsd
            }).catch(err => console.error('Async Log Error:', err));

            return result;

        } catch (err) {
            // If guardrail violation, log it
            if (err.name === 'GuardrailViolation') {
                persistenceService.logRequest({
                    ...metadata,
                    latencyMs: Date.now() - start,
                    status: 'blocked',
                    errorCode: 'GUARDRAIL_VIOLATION',
                    errorMessage: err.message,
                    metadata: { violation: err.details }
                }).catch(e => console.error('Async Log Error:', e));
            }
            throw err;
        }
    });
}
