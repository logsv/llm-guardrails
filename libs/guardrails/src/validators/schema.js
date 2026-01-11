import Ajv from 'ajv';
import { GuardrailViolation } from '../errors.js';

const ajv = new Ajv();

export const schemaValidator = {
    validate: async ({ output, config, context }) => {
        if (!context || !context.schema) return;

        let data = output;
        if (typeof output === 'string') {
            try {
                data = JSON.parse(output);
            } catch (e) {
                throw new GuardrailViolation('Output is not valid JSON', {
                    guardrail: 'schema_validation',
                    type: 'json_parse_error',
                    value: output
                });
            }
        }

        const validate = ajv.compile(schema);
        const valid = validate(data);

        if (!valid) {
             throw new GuardrailViolation('Output schema validation failed', {
                 guardrail: 'schema_validation',
                 type: 'schema_mismatch',
                 value: validate.errors,
                 metadata: { errors: validate.errors }
             });
        }
    }
};
