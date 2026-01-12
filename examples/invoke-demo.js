import llm from '../libs/sdk/index.js';
import { BaseLLMProvider } from '@llm-governance/gateway';

// Mock Provider
class DemoProvider extends BaseLLMProvider {
    async generate(messages, config) {
        console.log(`\n[DemoProvider] Generating response...`);
        console.log(`  Model: ${config.model}`);
        console.log(`  Messages: ${JSON.stringify(messages)}`);
        
        const lastMsg = messages[messages.length - 1].content;
        
        // Simulate PII response for testing guardrails
        if (lastMsg.includes('secret')) {
            return { content: "Contact me at test@example.com for details." };
        }

        return { content: `Echo: ${lastMsg}` };
    }
}

async function runDemo() {
    console.log("--- LLM.invoke Demo ---");

    // 1. Initialize SDK (Setup Guardrails & Gateway)
    // We'll use a dummy policy for this demo
    llm.init({
        policy: {
            input: {
                secrets_detection: { enabled: true, action: 'reject' }
            },
            output: {
                pii_detection: { enabled: true, action: 'mask', mask_token: '[REDACTED]' }
            }
        }
    });

    // Register Mock Provider
    llm.gateway.registerProvider('demo', new DemoProvider({}));

    // 2. Scenario A: Direct Invoke (User Query + Config)
    console.log("\n--- Scenario A: Direct Invoke ---");
    try {
        const response = await llm.invoke("What is the capital of France?", {
            provider: 'demo',
            model: 'gpt-4-demo'
        });
        console.log("Response:", response.content);
    } catch (err) {
        console.error("Error:", err.message);
    }

    // 3. Scenario B: Output Guardrail (PII Masking)
    console.log("\n--- Scenario B: PII Masking ---");
    try {
        const response = await llm.invoke("Tell me a secret", {
            provider: 'demo',
            model: 'gpt-4-demo'
        });
        console.log("Response:", response.content);
    } catch (err) {
        console.error("Error:", err.message);
    }

    // 4. Scenario C: Managed Prompt
    console.log("\n--- Scenario C: Managed Prompt ---");
    // Mock the prompt service for this demo
    llm.gateway.promptService = {
        getPrompt: async (id) => ({
            version: '1.0.0',
            template: "Translate this to French: {{user_input}}",
            metadata: {
                model: 'gpt-3.5-turbo',
                provider: 'demo'
            }
        })
    };

    try {
        const response = await llm.invoke("Hello World", {
            prompt_id: 'translator-bot'
        });
        console.log("Response:", response.content);
    } catch (err) {
        console.error("Error:", err.message);
    }

    // 5. Scenario D: Input Guardrail (Secrets)
    console.log("\n--- Scenario D: Input Secrets Detection ---");
    try {
        // Use a pattern that matches sk-[a-zA-Z0-9]{20,}
        const secretKey = "sk-abcdef1234567890abcdef1234567890"; 
        const response = await llm.invoke(`My key is ${secretKey}`, {
            provider: 'demo',
            model: 'gpt-4-demo'
        });
        console.log("Response:", response.content);
    } catch (err) {
        console.log("Expected Error Caught:", err.message);
    }
}

runDemo().catch(console.error);
