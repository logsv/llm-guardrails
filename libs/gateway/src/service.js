import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { HuggingFaceProvider } from './providers/huggingface.js';
import { LLMRequestSchema, ValidationError } from '@llm-governance/common';

export class GatewayService {
  constructor() {
    this.providers = new Map();
    this.registerProvider('openai', new OpenAIProvider({}));
    this.registerProvider('gemini', new GeminiProvider({}));
    this.registerProvider('huggingface', new HuggingFaceProvider({}));
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

    // 2. Resolve Provider
    const providerName = config?.provider || 'openai';
    const provider = this.getProvider(providerName);

    // 3. Prepare Messages (Simple text-to-message conversion for now)
    // TODO: Integrate with @llm-governance/prompts for advanced templating
    let messages = [];
    if (input.messages) {
      messages = input.messages;
    } else if (input.text) {
      messages = [{ role: 'user', content: input.text }];
    } else {
      throw new ValidationError('Input must contain "text" or "messages"');
    }

    // 4. Execute with Retry/Timeout (Placeholder for advanced logic)
    // In a real implementation, we would wrap this in p-retry
    const options = {
      model: config?.model,
      params: config?.params,
    };

    return await provider.generate(messages, options);
  }
}

export const gatewayService = new GatewayService();
