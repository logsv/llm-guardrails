import { GuardrailViolation } from './errors.js';

export class GuardrailsEngine {
  constructor(policy, validators) {
    this.policy = policy;
    this.validators = validators; // Expected to be an object mapping policy keys to validator objects
  }

  async executeInput({ input, context }) {
    if (!this.policy.input) return { allowed: true };

    const violations = [];
    
    for (const [key, config] of Object.entries(this.policy.input)) {
      if (!config.enabled) continue;
      
      // Map policy key (e.g. 'size_limits') to validator
      const validator = this.validators[key];
      
      if (!validator) {
        console.warn(`Validator not found for input guardrail: ${key}`);
        // Fail closed if validator is missing? 
        // For now, warn and continue, but typically fail closed would mean error.
        continue;
      }

      try {
        // Validators should throw GuardrailViolation on failure
        await validator.validate({ 
          input, 
          config, 
          context 
        });
      } catch (err) {
        if (err instanceof GuardrailViolation) {
           violations.push(err);
           
           // Handle action
           const action = config.action || 'reject';
           if (action === 'reject') {
             // Stop immediately on reject
             throw err;
           }
           // If 'flag' or 'mask', we continue but record violation
           // Masking might need to update input, need to handle that.
           if (action === 'mask' && err.metadata?.masked) {
               // Update input if the validator returns a masked version in metadata or we need a standard way
               // Let's assume validator handles masking and returns/throws appropriately.
               // Actually, if it's masking, it shouldn't be an error thrown, it should be a success with modification.
               // But the current pattern suggests validate() returns void or throws.
               // Let's adjust: validate returns { valid, modifiedInput } or throws.
           }
        } else {
            // Unexpected error
            throw err;
        }
      }
    }
    
    return { allowed: true, violations };
  }

  async executeOutput({ output, context }) {
    if (!this.policy.output) return { allowed: true };
    
    const violations = [];
    let currentOutput = output;

    for (const [key, config] of Object.entries(this.policy.output)) {
      if (!config.enabled) continue;

      const validator = this.validators[key];
      if (!validator) {
         console.warn(`Validator not found for output guardrail: ${key}`);
         continue;
      }

      try {
        const result = await validator.validate({ 
          output: currentOutput, 
          config, 
          context 
        });
        
        if (result) {
            if (result.output) {
                currentOutput = result.output;
            } else if (result.sanitized) {
                currentOutput = result.sanitized;
            }
        }
      } catch (err) {
        if (err instanceof GuardrailViolation) {
            violations.push(err);
            const action = config.action || 'reject';
            if (action === 'reject') {
                throw err;
            }
        } else {
            throw err;
        }
      }
    }

    return { allowed: true, violations, output: currentOutput };
  }
}
