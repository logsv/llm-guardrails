import { GuardrailViolation } from '../errors.js';

const PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  credit_card: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  aadhaar: /\b\d{4}\s\d{4}\s\d{4}\b/g,
  pan: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g,
};

export const piiValidator = {
  validate: async ({ input, config }) => {
     let text = '';
     if (typeof input === 'string') text = input;
     else if (input.messages) text = JSON.stringify(input.messages);
     else if (input.text) text = input.text;

     const detected = [];
     
     const categories = config.categories || Object.keys(PATTERNS);
     
     for (const cat of categories) {
         const regex = PATTERNS[cat];
         if (regex && regex.test(text)) {
             detected.push(cat);
         }
     }

     if (detected.length > 0) {
         throw new GuardrailViolation('PII detected', {
             guardrail: 'pii_detection',
             type: 'pii_found',
             value: detected,
             metadata: { categories: detected }
         });
     }
  }
};
