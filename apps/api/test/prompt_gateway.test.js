import { test, describe, it, before, mock } from 'node:test';
import assert from 'node:assert';
import { PromptService } from '../../../libs/prompts/src/service.js';
import { GatewayService } from '../../../libs/gateway/src/service.js';

describe('Prompt Registry & Gateway Integration', () => {
  let promptService;
  let gatewayService;
  let mockPrisma;
  let mockCache;
  let mockProvider;

  before(() => {
    // Mock Prisma
    mockPrisma = {
      prompt: {
        findUnique: mock.fn(),
      },
    };

    // Mock Cache
    mockCache = {
      get: mock.fn(() => Promise.resolve(null)),
      set: mock.fn(() => Promise.resolve()),
      del: mock.fn(() => Promise.resolve()),
    };

    // Instantiate PromptService with mocks
    promptService = new PromptService(mockPrisma, mockCache);

    // Instantiate GatewayService with promptService
    gatewayService = new GatewayService(promptService);

    // Register a mock provider
    mockProvider = {
      generate: mock.fn(async (messages) => ({
        content: 'Mock response',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        provider: 'mock',
        model: 'test-model',
      })),
    };
    gatewayService.registerProvider('mock-provider', mockProvider);
  });

  it('should resolve prompt from registry and execute', async () => {
    // Setup Mock Data
    const promptName = 'test-prompt';
    const promptTemplate = 'Hello {{name}}';
    const mockPromptData = {
      id: 'p1',
      name: promptName,
      environments: [
        {
          env: 'prod',
          version: {
            version: 'v1',
            template: promptTemplate,
            metadata: { model: 'gpt-4' },
          },
        },
      ],
    };

    // Setup Prisma Mock Return
    mockPrisma.prompt.findUnique.mock.mockImplementation(async () => mockPromptData);

    // Execute Request
    const request = {
      prompt_id: promptName,
      input: { name: 'World' },
      env: 'prod',
      config: {
        provider: 'mock-provider',
      },
    };

    const response = await gatewayService.execute(request);

    // Assertions
    assert.strictEqual(response.content, 'Mock response');
    
    // Verify Prompt Resolution
    assert.strictEqual(mockPrisma.prompt.findUnique.mock.callCount(), 1);
    const findCall = mockPrisma.prompt.findUnique.mock.calls[0];
    assert.deepStrictEqual(findCall.arguments[0], {
      where: { name: promptName },
      include: {
        environments: {
          where: { env: 'prod' },
          include: {
            version: true,
          },
        },
      },
    });

    // Verify Provider Execution
    assert.strictEqual(mockProvider.generate.mock.callCount(), 1);
    const generateCall = mockProvider.generate.mock.calls[0];
    const messages = generateCall.arguments[0];
    assert.strictEqual(messages[0].content, 'Hello World'); // Template substitution check
  });
});
