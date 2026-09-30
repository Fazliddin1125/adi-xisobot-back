import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../domain/errors/AppError.js';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: 'Yo\'l topilmadi' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: 'JSON formati noto\'g\'ri' });
    return;
  }
  console.error(err);
  res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
}
