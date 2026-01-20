import { GuardrailViolation } from '../errors.js';
import libphonenumber from 'google-libphonenumber';

// For ESM environments, google-libphonenumber might behave differently.
// We might need to access PNF or other internals if findNumbers isn't exposed directly on util instance.
// But findNumbers is usually on PhoneNumberUtil instance.
// Let's fallback to regex if libphonenumber fails, to unblock.
const { PhoneNumberUtil } = libphonenumber;
const phoneUtil = PhoneNumberUtil.getInstance();

const PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Fallback regex
  credit_card: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
  aadhaar: /\b\d{4}\s\d{4}\s\d{4}\b/g,
  pan: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
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
     const categories = config.categories || [...Object.keys(PATTERNS), 'phone'];
     let maskedText = text;
     let hasPII = false;
     
     for (const cat of categories) {
         let matched = false;

         if (cat === 'phone') {
             try {
                 // Try libphonenumber first
                 if (phoneUtil && typeof phoneUtil.findNumbers === 'function') {
                    const region = config.region || 'US';
                    const iterator = phoneUtil.findNumbers(maskedText, region);
                    // ... implementation
                 } else {
                     throw new Error("findNumbers not available");
                 }
             } catch (e) {
                 // Fallback to regex
                 const regex = PATTERNS['phone'];
                 if (regex) {
                     regex.lastIndex = 0;
                     if (regex.test(maskedText)) {
                         matched = true;
                         if (config.action === 'mask') {
                             regex.lastIndex = 0;
                             maskedText = maskedText.replace(regex, config.mask_token || '[REDACTED]');
                         }
                     }
                 }
             }
         } else {
             const regex = PATTERNS[cat];
             if (regex) {
                 regex.lastIndex = 0;
                 if (regex.test(maskedText)) {
                     matched = true;
                     if (config.action === 'mask') {
                         regex.lastIndex = 0;
                         maskedText = maskedText.replace(regex, config.mask_token || '[REDACTED]');
                     }
                 }
             }
         }

         if (matched) {
             detected.push(cat);
             hasPII = true;
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
                let finalOutput = maskedText;
                if (typeof target === 'object' && target !== null) {
                    try {
                        finalOutput = JSON.parse(maskedText);
                    } catch (e) {
                        finalOutput = maskedText;
                    }
                }
                
                return { 
                    output: finalOutput,
                    violation: {
                        guardrail: 'pii_detection',
                        type: 'pii_masked',
                        value: detected,
                        message: 'PII detected and masked'
                    }
                };
            }
        }
    }
};
