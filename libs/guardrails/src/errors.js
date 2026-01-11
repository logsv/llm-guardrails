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
