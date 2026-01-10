import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderError } from '@llm-governance/common';
import { BaseLLMProvider } from './base.js';

export class GeminiProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey || process.env.GEMINI_API_KEY);
  }

  async generate(messages, options = {}) {
    try {
      const modelName = options.model || 'gemini-pro';
      const model = this.client.getGenerativeModel({ model: modelName });

      // Convert messages to Gemini format
      // Gemini expects: { role: 'user' | 'model', parts: [{ text: '...' }] }
      // We assume standard format: { role: 'user' | 'assistant', content: '...' }
      const history = messages.slice(0, -1).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const lastMessage = messages[messages.length - 1];
      const chat = model.startChat({
        history,
        generationConfig: options.params,
      });

      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;
      const text = response.text();

      return {
        content: text,
        usage: {
          // Gemini doesn't always provide token usage in standard response
          // Placeholder values or extraction if available
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
        provider: 'gemini',
        model: modelName,
        metadata: {
          finishReason: response.candidates?.[0]?.finishReason,
        },
      };
    } catch (error) {
      throw new ProviderError(`Gemini Error: ${error.message}`, {
        originalError: error,
        provider: 'gemini',
      });
    }
  }
}
