import { promptService } from './src/service.js';

export { PromptService, promptService } from './src/service.js';

export const getPrompt = (name, env) => promptService.getPrompt(name, env);

export default {
  getPrompt,
  PromptService: promptService,
};
