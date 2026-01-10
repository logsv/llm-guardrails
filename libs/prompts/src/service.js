import { prisma as defaultPrisma, cacheService as defaultCache } from '@llm-governance/common';

export class PromptService {
  constructor(prisma = defaultPrisma, cache = defaultCache) {
    this.prisma = prisma;
    this.cache = cache;
  }

  /**
   * Create a new prompt
   */
  async createPrompt(data) {
    return await this.prisma.prompt.create({
      data: {
        name: data.name,
        description: data.description,
        owner: data.owner,
      },
    });
  }

  /**
   * Create a new version for a prompt
   */
  async createVersion(promptId, data) {
    // 1. Check if prompt exists
    const prompt = await this.prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) throw new Error(`Prompt ${promptId} not found`);

    // 2. Create version
    return await this.prisma.promptVersion.create({
      data: {
        promptId,
        version: data.version,
        template: data.template,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Bind a version to an environment (prod/dev/test)
   */
  async bindEnvironment(promptId, versionId, env) {
    // Invalidate cache
    const prompt = await this.prisma.prompt.findUnique({ where: { id: promptId } });
    if (prompt) {
      await this.cache.del(`prompt:${prompt.name}:${env}`);
    }

    return await this.prisma.promptEnvBinding.upsert({
      where: {
        promptId_env: {
          promptId,
          env,
        },
      },
      update: {
        versionId,
      },
      create: {
        promptId,
        versionId,
        env,
      },
    });
  }

  /**
   * Get the resolved prompt template for an environment
   */
  async getPrompt(name, env = 'prod') {
    const cacheKey = `prompt:${name}:${env}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // 1. Find prompt by name
    const prompt = await this.prisma.prompt.findUnique({
      where: { name },
      include: {
        environments: {
          where: { env },
          include: {
            version: true,
          },
        },
      },
    });

    if (!prompt) throw new Error(`Prompt '${name}' not found`);

    const binding = prompt.environments[0];
    if (!binding) {
      throw new Error(`Prompt '${name}' has no version bound to '${env}'`);
    }

    await this.cache.set(cacheKey, binding.version);
    return binding.version;
  }
  
  /**
   * Get all prompts
   */
  async listPrompts() {
      return await this.prisma.prompt.findMany();
  }
}

export const promptService = new PromptService();
