import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import userRouter from './routes/user';
import activityRouter from './routes/activity';
import insightsRouter from './routes/insights';
import challengeRouter from './routes/challenge';
import discussionRouter from './routes/discussion';

import { sanitizeBody } from './middleware/sanitize';
import { errorHandler } from './middleware/errorHandler';

const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Factory function — creates and configures the Express app WITHOUT calling
 * app.listen(). This lets Supertest import the app in tests without binding
 * a real port, avoiding "address already in use" errors.
 */
export function createApp() {
  const app = express();

  // 1. Security headers
  app.use(helmet());

  // 2. CORS
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  app.use(
    cors({
      origin: ALLOWED_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  // 3. Body parsing (2mb cap to support custom base64 profile avatars)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));

  // 4. Input sanitisation
  app.use(sanitizeBody);

  // 5. Rate limiting — disabled in test environment to allow repeated requests
  if (!IS_TEST) {
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
      skip: (req) => req.path === '/health',
    });
    const aiLimiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'AI insights limit reached. Please wait before trying again.' },
    });
    app.use('/api/', apiLimiter);
    app.use('/api/insights', aiLimiter);
  }

  // 6. Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 7. Routes
  app.use('/api/users', userRouter);
  app.use('/api/activities', activityRouter);
  app.use('/api/insights', insightsRouter);
  app.use('/api/challenges', challengeRouter);
  app.use('/api/discussion', discussionRouter);


  // 8. 404
  app.use((_req, res) => {
    res.status(404).json({ error: { status: 404, message: 'Route not found.' } });
  });

  // 9. Centralised error handler (must be last)
  app.use(errorHandler);

  return app;
}
