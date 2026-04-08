import express from 'express';
import cors from 'cors';
import creatorsRouter from './routes/creators';
import scoringRouter from './routes/scoring';
import outreachRouter from './routes/outreach';
import pipelineRouter from './routes/pipeline';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1/creators', creatorsRouter);
  app.use('/api/v1/scoring', scoringRouter);
  app.use('/api/v1/outreach', outreachRouter);
  app.use('/api/v1/pipeline', pipelineRouter);

  app.use(errorHandler);

  return app;
}
