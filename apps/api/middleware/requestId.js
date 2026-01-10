import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  
  // Attach request ID to logger context if we had a proper logger
  // logger.defaultMeta = { requestId: req.id };
  
  next();
};
