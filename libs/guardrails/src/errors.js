export class GuardrailViolation extends Error {
  constructor(message, { guardrail, type, value, metadata } = {}) {
    super(message);
    this.name = 'GuardrailViolation';
    this.guardrail = guardrail;
    this.type = type;
    this.value = value;
    this.metadata = metadata;
  }
}

export class RetryRequest extends Error {
    constructor(message, { guardrail, prompt } = {}) {
        super(message);
        this.name = 'RetryRequest';
        this.guardrail = guardrail;
        this.prompt = prompt; // Optional: new prompt/input to use
    }
}
