import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error('Unhandled error:', err);

  // Anthropic credit exhausted
  if (err.message?.includes('credit balance is too low')) {
    res.status(402).json({ error: 'Anthropic API credit balance is too low. Please top up at console.anthropic.com → Plans & Billing.' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
