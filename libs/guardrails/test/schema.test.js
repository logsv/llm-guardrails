import { describe, it } from 'node:test';
import assert from 'node:assert';
import { schemaValidator } from '../src/validators/schema.js';
import { GuardrailViolation } from '../src/errors.js';

const mockSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        age: { type: "number" }
    },
    required: ["name", "age"]
};

describe('Schema Validator', () => {
    it('should pass valid JSON string and return object', async () => {
        const input = '{"name": "Alice", "age": 30}';
        const result = await schemaValidator.validate({
            output: input,
            context: { schema: mockSchema }
        });
        
        assert.deepStrictEqual(result.output, { name: "Alice", age: 30 });
    });

    it('should repair malformed JSON (missing quotes)', async () => {
        // jsonrepair can fix unquoted keys
        const input = '{name: "Bob", age: 25}'; 
        const result = await schemaValidator.validate({
            output: input,
            context: { schema: mockSchema }
        });
        
        assert.deepStrictEqual(result.output, { name: "Bob", age: 25 });
    });

    it('should repair malformed JSON (trailing comma)', async () => {
        const input = '{"name": "Charlie", "age": 40,}';
        const result = await schemaValidator.validate({
            output: input,
            context: { schema: mockSchema }
        });
        
        assert.deepStrictEqual(result.output, { name: "Charlie", age: 40 });
    });

    it('should fail on unrepairable JSON', async () => {
        const input = '{{{{';
        await assert.rejects(async () => {
            await schemaValidator.validate({
                output: input,
                context: { schema: mockSchema }
            });
        }, (err) => {
            assert.strictEqual(err.name, 'GuardrailViolation');
            assert.strictEqual(err.type, 'json_parse_error');
            return true;
        });
    });

    it('should fail on schema mismatch', async () => {
        const input = '{"name": "Dave", "age": "thirty"}'; // age should be number
        await assert.rejects(async () => {
            await schemaValidator.validate({
                output: input,
                context: { schema: mockSchema }
            });
        }, (err) => {
            assert.strictEqual(err.name, 'GuardrailViolation');
            assert.strictEqual(err.type, 'schema_mismatch');
            return true;
        });
    });

    it('should respect config.schema if context.schema is missing', async () => {
        const input = '{"name": "Eve", "age": 20}';
        const result = await schemaValidator.validate({
            output: input,
            config: { schema: mockSchema }
        });
        
        assert.deepStrictEqual(result.output, { name: "Eve", age: 20 });
    });
});
