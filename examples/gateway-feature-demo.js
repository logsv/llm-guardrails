import { gatewayService, BaseLLMProvider } from '@llm-governance/gateway';

// 1. Mock Provider to inspect incoming messages and config
class InspectorProvider extends BaseLLMProvider {
    async generate(messages, config) {
        console.log("\n[InspectorProvider] Received Call:");
        console.log("Messages:", JSON.stringify(messages, null, 2));
        console.log("Config:", JSON.stringify(config, null, 2));
        return { content: "Mock response" };
    }
}

// 2. Mock Prompt Service
gatewayService.promptService = {
    getPrompt: async (name, env) => {
        console.log(`[PromptService] Resolving prompt '${name}' for env '${env}'`);
        if (name === 'demo-prompt') {
            return {
                version: '1.0.0',
                template: "Hello {{name}}, how can I help you with {{topic}}?",
                metadata: {
                    system_prompt: "You are a helpful assistant.",
                    model: "gpt-4-turbo",
                    provider: "inspector", // Force use of our inspector provider
                    parameters: {
                        temperature: 0.2
                    }
                }
            };
        }
        throw new Error("Prompt not found");
    }
};

async function runDemo() {
    console.log("--- Gateway Feature Demo ---");

    // Register Inspector Provider
    gatewayService.registerProvider('inspector', new InspectorProvider({}));

    // Execute Request using Library Gateway
    // User only provides prompt_id and input variables
    const response = await gatewayService.execute({
        request_id: 'test-req-1',
        prompt_id: 'demo-prompt',
        env: 'prod',
        input: {
            name: "Alice",
            topic: "Governance"
        }
        // No config provided here, expecting it to come from prompt metadata
    });

    console.log("\n[Result] Response:", response.content);
}

runDemo().catch(console.error);
