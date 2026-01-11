import { GuardrailsEngine } from './engine.js';
import { loadPolicy } from './policy-loader.js';
import { validators } from './validators/index.js';
import { GuardrailViolation } from './errors.js';

export { GuardrailsEngine, loadPolicy, validators, GuardrailViolation };

export function createEngine(policyPath) {
    const policy = loadPolicy(policyPath);
    return new GuardrailsEngine(policy, validators);
}
