import OpenAI from 'openai';
import { ProviderError } from '@llm-governance/common';
import { BaseLLMProvider } from './base.js';

export class HuggingFaceProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    // HuggingFace Inference Endpoints (and vLLM) often provide an OpenAI-compatible API
    // Config should include 'baseURL' (e.g., local vLLM or HF Endpoint URL)
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.HF_API_KEY || 'dummy',
      baseURL: config.baseURL || process.env.HF_BASE_URL || 'http://localhost:8000/v1',
    });
  }

  async generate(messages, options = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || 'tgi', // 'tgi' is often used for Text Generation Inference
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
        provider: 'huggingface',
        model: response.model,
        metadata: {
          id: response.id,
          finish_reason: choice.finish_reason,
        },
      };
    } catch (error) {
      throw new ProviderError(`HuggingFace Error: ${error.message}`, {
        originalError: error,
        provider: 'huggingface',
      });
    }
  }
}
