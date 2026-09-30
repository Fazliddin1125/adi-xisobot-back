import type { Request, Response } from 'express';
import type { AppealService } from '../../../application/services/AppealService.js';
import { actorOf } from '../middlewares/auth.js';
import { body, params, query } from '../middlewares/validate.js';
import { createAppealSchema, idParamSchema, periodQuerySchema, updateAppealSchema } from '../validators/schemas.js';

export class AppealController {
  constructor(private readonly appeals: AppealService) {}

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.appeals.create(actorOf(req), body(req, createAppealSchema)));
  };

  list = async (req: Request, res: Response) => {
    res.json(await this.appeals.list(actorOf(req), query(req, periodQuerySchema)));
  };

  update = async (req: Request, res: Response) => {
    const { id } = params(req, idParamSchema);
    res.json(await this.appeals.update(actorOf(req), id, body(req, updateAppealSchema)));
  };

  remove = async (req: Request, res: Response) => {
    const { id } = params(req, idParamSchema);
    await this.appeals.delete(actorOf(req), id);
    res.status(204).end();
  };
}
