import { processRequest } from '@llm-governance/gateway';

export const executeLLM = async (req, res, next) => {
  try {
    const result = await processRequest(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
