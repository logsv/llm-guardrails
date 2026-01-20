import Ajv from 'ajv';
import { jsonrepair } from 'jsonrepair';
import { GuardrailViolation } from '../errors.js';

const ajv = new Ajv({ allErrors: true });

export const schemaValidator = {
    validate: async ({ output, config, context }) => {
        // Support schema from context or config
        const schema = context?.schema || config?.schema;
        if (!schema) return;

        let data = output;
        let wasRepaired = false;

        if (typeof output === 'string') {
            try {
                data = JSON.parse(output);
            } catch (e) {
                // Try to repair JSON
                try {
                    const repaired = jsonrepair(output);
                    data = JSON.parse(repaired);
                    wasRepaired = true;
                } catch (repairError) {
                    throw new GuardrailViolation('Output is not valid JSON and could not be repaired', {
                        guardrail: 'schema_validation',
                        type: 'json_parse_error',
                        value: output,
                        metadata: { error: e.message }
                    });
                }
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

        // If we parsed or repaired the JSON, return the structured object
        // This ensures the application receives the clean object instead of the raw string
        if (typeof output === 'string' || wasRepaired) {
            return { output: data };
        }
    }
};
