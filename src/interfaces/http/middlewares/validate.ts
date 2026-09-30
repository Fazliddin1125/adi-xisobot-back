import type { Request } from 'express';
import type { z } from 'zod';
import { AppError } from '../../../domain/errors/AppError.js';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw AppError.badRequest(result.error.issues[0]?.message ?? 'Ma\'lumotlar noto\'g\'ri');
  }
  return result.data;
}

export const body = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.body);
export const query = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.query);
export const params = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.params);
