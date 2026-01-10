import './config.js'; // Must be first
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId.js';
import llmRoutes from './routes/llm.js';
import promptRoutes from './routes/prompts.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(requestIdMiddleware);

// Routes
app.use('/v1/llm', llmRoutes);
app.use('/v1/prompts', promptRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
      details: err.details,
      requestId: req.id,
    },
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
