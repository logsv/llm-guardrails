import { init, observe, invoke } from './src/llm.js';
import * as context from './src/context.js';
import { prompts } from './src/prompts.js';
import { evaluation } from './src/evaluation.js';
import { gatewayService } from '@llm-governance/gateway';

export default {
    init,
    observe,
    invoke,
    context,
    prompts,
    evaluation,
    gateway: gatewayService
};

export { init, observe, invoke, context, prompts, evaluation, gatewayService as gateway };
