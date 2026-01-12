import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { HuggingFaceProvider } from './providers/huggingface.js';
import { OllamaProvider } from './providers/ollama.js';
import { LiteLLMProvider } from './providers/litellm.js';
import { LLMRequestSchema, ValidationError } from '@llm-governance/common';
import { promptService as defaultPromptService } from '@llm-governance/prompts';
import { metricsService, persistenceService, calculateCost, tracer, startSpan } from '../../observability/index.js';
import { randomUUID } from 'crypto';

export class GatewayService {
  constructor(promptService = defaultPromptService, guardrailsEngine = null) {
    this.promptService = promptService;
    this.guardrailsEngine = guardrailsEngine;
    this.providers = new Map();
    this.registerProvider('openai', new OpenAIProvider({}));
    this.registerProvider('gemini', new GeminiProvider({}));
    this.registerProvider('huggingface', new HuggingFaceProvider({}));
    this.registerProvider('ollama', new OllamaProvider({}));
    this.registerProvider('litellm', new LiteLLMProvider({}));
  }

  setGuardrails(engine) {
    this.guardrailsEngine = engine;
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  getProvider(name = 'openai') {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new ValidationError(`Provider '${name}' not found`);
    }
    return provider;
  }

  async execute(request) {
    const startTime = Date.now();
    const requestId = request.request_id || randomUUID(); // Ensure request_id
    
    // Start Trace
    return tracer.startActiveSpan('gateway.execute', async (span) => {
      span.setAttribute('llm.request_id', requestId);
      span.setAttribute('llm.env', request.env || 'prod');

      let providerName = 'unknown';
      let model = 'unknown';
      let promptId = request.prompt_id || null;
      let promptVersionId = null;
      let tokensIn = 0;
      let tokensOut = 0;
      let cost = 0;
      let error = null;

      try {
        console.log('Gateway executing request:', request);
        
        // 1. Validate Request
        const parsed = LLMRequestSchema.safeParse(request);
        if (!parsed.success) {
          throw new ValidationError('Invalid request schema', parsed.error.format());
        }
        const { input, config } = parsed.data;
        const effectiveConfig = config || {};
        
        providerName = effectiveConfig.provider || 'openai';
        model = effectiveConfig.model || 'gpt-3.5-turbo'; // Default model
        
        span.setAttribute('llm.provider', providerName);
        span.setAttribute('llm.model', model);

        // 2. Guardrails Input Check
        if (this.guardrailsEngine) {
          await startSpan('guardrails.input', {}, async () => {
            try {
              await this.guardrailsEngine.executeInput({ 
                input: input || request, 
                context: { request, env: request.env } 
              });
            } catch (err) {
              span.recordException(err);
              throw err;
            }
          });
        }

        // 3. Prepare Messages & Resolve Prompt (and potentially Provider)
        let messages = [];
        
        // If prompt_id is provided, fetch from registry
        if (request.prompt_id) {
           await startSpan('prompt.resolve', {}, async () => {
              try {
                const promptVersion = await this.promptService.getPrompt(request.prompt_id, request.env);
                promptVersionId = promptVersion.version; // Use version string or ID
                span.setAttribute('llm.prompt_id', request.prompt_id);
                span.setAttribute('llm.prompt_version', promptVersionId);

                // Simple template substitution
                let content = promptVersion.template;
                if (input && input.prompt_variables) {
                  Object.entries(input.prompt_variables).forEach(([key, value]) => {
                    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
                  });
                } else if (input && !input.messages && !input.text) {
                   // Fallback: if input is flat object, treat as variables
                   Object.entries(input).forEach(([key, value]) => {
                    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
                  });
                }
                
                messages = [];

                // 1. Add System Prompt if present in metadata
                if (promptVersion.metadata && promptVersion.metadata.system_prompt) {
                    messages.push({ role: 'system', content: promptVersion.metadata.system_prompt });
                }

                // 2. Add User Message (Template)
                messages.push({ role: 'user', content });
                
                // 3. Merge metadata/config from prompt if not overridden
                if (promptVersion.metadata) {
                    if (!effectiveConfig.model && promptVersion.metadata.model) {
                        model = promptVersion.metadata.model;
                        effectiveConfig.model = model;
                    }
                    if (!effectiveConfig.provider && promptVersion.metadata.provider) {
                        providerName = promptVersion.metadata.provider;
                        effectiveConfig.provider = providerName;
                    }
                    // Merge params (temperature, etc)
                    effectiveConfig.params = { ...promptVersion.metadata.parameters, ...effectiveConfig.params };
                }
              } catch (error) {
                throw new ValidationError(`Failed to resolve prompt: ${error.message}`);
              }
           });
        } else if (input.messages) {
          messages = input.messages;
        } else if (input.text) {
          messages = [{ role: 'user', content: input.text }];
        } else {
          throw new ValidationError('Input must contain "text", "messages", or "prompt_id"');
        }

        // 4. Resolve Provider (After prompt resolution in case provider changed)
        const provider = this.getProvider(providerName);

        // Calculate Input Tokens (Approximate)
        tokensIn = JSON.stringify(messages).length / 4; 

        // 5. Execute with Retry/Timeout
        const options = {
          model: model,
          params: effectiveConfig.params,
        };

        let result = await startSpan('llm.generate', {}, async () => {
            return await provider.generate(messages, options);
        });
        
        // Calculate Output Tokens (Approximate or from provider)
        // Assume result has usage info, or approximate
        if (result.usage) {
            tokensIn = result.usage.prompt_tokens || tokensIn;
            tokensOut = result.usage.completion_tokens || (result.content?.length / 4) || 0;
        } else {
            tokensOut = (result.content?.length / 4) || 0;
        }

        // 5. Guardrails Output Check
        if (this.guardrailsEngine) {
          await startSpan('guardrails.output', {}, async () => {
             const guardResult = await this.guardrailsEngine.executeOutput({ 
                output: result, 
                context: { request, config } 
              });
              
              if (guardResult.output) {
                result = guardResult.output;
              }
          });
        }

        return result;

      } catch (err) {
        error = err;
        span.setStatus({ code: 2, message: err.message }); // Error
        span.recordException(err);
        throw err;
      } finally {
        const latency = Date.now() - startTime;
        cost = calculateCost(providerName, model, tokensIn, tokensOut);

        // Record Metrics
        metricsService.recordRequest({
          env: request.env || 'prod',
          provider: providerName,
          model: model,
          status: error ? 'error' : 'success',
          errorCode: error?.code || (error ? 'UNKNOWN' : null),
          latencyMs: latency,
          tokensIn,
          tokensOut,
          cost
        });

        // Persist Log
        persistenceService.logRequest({
          requestId,
          timestamp: new Date().toISOString(),
          env: request.env || 'prod',
          provider: providerName,
          model: model,
          promptId,
          promptVersion: promptVersionId,
          latencyMs: latency,
          tokensIn: Math.round(tokensIn),
          tokensOut: Math.round(tokensOut),
          costUsd: cost,
          status: error ? 'error' : 'success',
          errorCode: error?.code || null,
          errorMessage: error?.message || null,
          metadata: request.metadata,
        });

        span.end();
      }
    });
  }
}

export const gatewayService = new GatewayService();
