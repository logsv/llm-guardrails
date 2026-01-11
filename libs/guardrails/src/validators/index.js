import { inputSizeValidator } from './input-size.js';
import { piiValidator } from './pii.js';
import { secretsValidator } from './secrets.js';
import { promptInjectionValidator } from './prompt-injection.js';
import { schemaValidator } from './schema.js';
import { profanityValidator } from './profanity.js';

export const validators = {
    size_limits: inputSizeValidator,
    pii_detection: piiValidator,
    secrets_detection: secretsValidator,
    prompt_injection: promptInjectionValidator,
    schema_validation: schemaValidator,
    profanity_filter: profanityValidator,
};
