import { gatewayService } from './src/service.js';
import { OpenAIProvider } from './src/providers/openai.js';
import { GeminiProvider } from './src/providers/gemini.js';
import { HuggingFaceProvider } from './src/providers/huggingface.js';
import { BaseLLMProvider } from './src/providers/base.js';

export { GatewayService, gatewayService } from './src/service.js';
export { OpenAIProvider } from './src/providers/openai.js';
export { GeminiProvider } from './src/providers/gemini.js';
export { HuggingFaceProvider } from './src/providers/huggingface.js';
export { BaseLLMProvider } from './src/providers/base.js';

export const processRequest = (req) => gatewayService.execute(req);

export default {
  processRequest,
  GatewayService: gatewayService,
  OpenAIProvider,
  GeminiProvider,
  HuggingFaceProvider,
  BaseLLMProvider,
};
