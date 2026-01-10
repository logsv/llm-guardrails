import OpenAI from 'openai';
import { ProviderError } from '@llm-governance/common';
import { BaseLLMProvider } from './base.js';

export class OpenAIProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    // apiKey should come from config or env
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async generate(messages, options = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages,
        ...options.params,
      });

      const choice = response.choices[0];
      
      return {
        content: choice.message.content,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
        provider: 'openai',
        model: response.model,
        metadata: {
          id: response.id,
          system_fingerprint: response.system_fingerprint,
          finish_reason: choice.finish_reason,
        },
      };
    } catch (error) {
      throw new ProviderError(`OpenAI Error: ${error.message}`, {
        originalError: error,
        provider: 'openai',
      });
    }
  }
}
