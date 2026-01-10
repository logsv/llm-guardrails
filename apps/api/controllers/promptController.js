import { promptService } from '@llm-governance/prompts';
import { AppError } from '@llm-governance/common';

export const createPrompt = async (req, res, next) => {
  try {
    const { name, description, owner } = req.body;
    if (!name) throw new AppError('Prompt name is required', 400);

    const prompt = await promptService.createPrompt({ name, description, owner });
    res.status(201).json(prompt);
  } catch (error) {
    next(error);
  }
};

export const listPrompts = async (req, res, next) => {
  try {
    const prompts = await promptService.listPrompts();
    res.json(prompts);
  } catch (error) {
    next(error);
  }
};

export const createVersion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { version, template, metadata } = req.body;
    
    if (!version || !template) {
      throw new AppError('Version and template are required', 400);
    }

    const newVersion = await promptService.createVersion(id, { version, template, metadata });
    res.status(201).json(newVersion);
  } catch (error) {
    next(error);
  }
};

export const bindEnvironment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { env, versionId } = req.body;

    if (!env || !versionId) {
      throw new AppError('Environment and versionId are required', 400);
    }

    const binding = await promptService.bindEnvironment(id, versionId, env);
    res.json(binding);
  } catch (error) {
    next(error);
  }
};

export const getPrompt = async (req, res, next) => {
    try {
        const { name } = req.params;
        const { env } = req.query;
        
        // This resolves the actual template
        const resolved = await promptService.getPrompt(name, env || 'prod');
        res.json(resolved);
    } catch (error) {
        next(error);
    }
}
