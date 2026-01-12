import { GuardrailViolation } from '../errors.js';

const PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  credit_card: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  aadhaar: /\b\d{4}\s\d{4}\s\d{4}\b/g,
  pan: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g,
};

export const piiValidator = {
  validate: async ({ input, output, config }) => {
     const target = output !== undefined ? output : input;
     let text = '';
     
     if (typeof target === 'string') {
         text = target;
     } else if (target && typeof target === 'object') {
         try {
             text = JSON.stringify(target);
         } catch (e) {
             text = String(target);
         }
     } else {
         text = String(target || '');
     }

     const detected = [];
     const categories = config.categories || Object.keys(PATTERNS);
     let maskedText = text;
     let hasPII = false;
     
     for (const cat of categories) {
         const regex = PATTERNS[cat];
         if (regex) {
             // Reset regex state
             regex.lastIndex = 0;
             if (regex.test(text)) {
                 detected.push(cat);
                 hasPII = true;
                 if (config.action === 'mask') {
                     // Reset again for replace
                     regex.lastIndex = 0;
                     maskedText = maskedText.replace(regex, config.mask_token || '[REDACTED]');
                 }
             }
         }
     }

     if (hasPII) {
            if (config.action === 'reject') {
                throw new GuardrailViolation('PII detected', {
                    guardrail: 'pii_detection',
                    type: 'pii_found',
                    value: detected,
                    metadata: { categories: detected }
                });
            } else if (config.action === 'mask') {
                // If the target was an object, try to parse the masked string back to an object
                if (typeof target === 'object' && target !== null) {
                    try {
                        return { output: JSON.parse(maskedText) };
                    } catch (e) {
                        // If parsing fails, return the string
                        return { output: maskedText };
                    }
                }
                return { output: maskedText };
            }
        }
    }
};
