import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { HuggingFaceProvider } from './providers/huggingface.js';
import { LLMRequestSchema, ValidationError } from '@llm-governance/common';
import { promptService as defaultPromptService } from '@llm-governance/prompts';

export class GatewayService {
  constructor(promptService = defaultPromptService, guardrailsEngine = null) {
    this.promptService = promptService;
    this.guardrailsEngine = guardrailsEngine;
    this.providers = new Map();
    this.registerProvider('openai', new OpenAIProvider({}));
    this.registerProvider('gemini', new GeminiProvider({}));
    this.registerProvider('huggingface', new HuggingFaceProvider({}));
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
    console.log('Gateway executing request:', request);
    // 1. Validate Request
    const parsed = LLMRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new ValidationError('Invalid request schema', parsed.error.format());
    }
    const { input, config } = parsed.data;

    // 2. Guardrails Input Check
    if (this.guardrailsEngine) {
      try {
        await this.guardrailsEngine.executeInput({ 
          input: input || request, 
          context: { request, env: request.env } 
        });
      } catch (error) {
        throw error;
      }
    }

    // 3. Resolve Provider
    const providerName = config?.provider || 'openai';
    const provider = this.getProvider(providerName);

    // 3. Prepare Messages
    let messages = [];
    
    // If prompt_id is provided, fetch from registry
    if (request.prompt_id) {
      try {
        const promptVersion = await this.promptService.getPrompt(request.prompt_id, request.env);
        
        // Simple template substitution
        let content = promptVersion.template;
        if (input) {
          Object.entries(input).forEach(([key, value]) => {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
          });
        }
        
        messages = [{ role: 'user', content }];
        
        // Merge metadata/config from prompt if not overridden
        if (promptVersion.metadata) {
            // TODO: Merge config logic here
        }
      } catch (error) {
        throw new ValidationError(`Failed to resolve prompt: ${error.message}`);
      }
    } else if (input.messages) {
      messages = input.messages;
    } else if (input.text) {
      messages = [{ role: 'user', content: input.text }];
    } else {
      throw new ValidationError('Input must contain "text", "messages", or "prompt_id"');
    }

    // 4. Execute with Retry/Timeout (Placeholder for advanced logic)
    // In a real implementation, we would wrap this in p-retry
    const options = {
      model: config?.model,
      params: config?.params,
    };

    const result = await provider.generate(messages, options);

    // 5. Guardrails Output Check
    if (this.guardrailsEngine) {
      const guardResult = await this.guardrailsEngine.executeOutput({ 
        output: result, 
        context: { request, config } 
      });
      
      if (guardResult.output) {
        return guardResult.output;
      }
    }

    return result;
  }
}

export const gatewayService = new GatewayService();
