import type { Request, Response } from 'express';
import type { UserService } from '../../../application/services/UserService.js';
import type { NotificationService } from '../../../application/services/NotificationService.js';
import { actorOf } from '../middlewares/auth.js';
import { body, params } from '../middlewares/validate.js';
import { createUserSchema, idParamSchema, updateUserSchema, vacationSchema } from '../validators/schemas.js';

export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly notifications: NotificationService,
  ) {}

  telegramTest = async (req: Request, res: Response) => {
    await this.notifications.sendTest(params(req, idParamSchema).id);
    res.status(204).end();
  };

  list = async (_req: Request, res: Response) => {
    res.json(await this.users.list());
  };

  get = async (req: Request, res: Response) => {
    res.json(await this.users.get(params(req, idParamSchema).id));
  };

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.users.create(body(req, createUserSchema)));
  };

  update = async (req: Request, res: Response) => {
    const { id } = params(req, idParamSchema);
    res.json(await this.users.update(actorOf(req).id, id, body(req, updateUserSchema)));
  };

  setVacation = async (req: Request, res: Response) => {
    const { id } = params(req, idParamSchema);
    res.json(await this.users.setVacation(id, body(req, vacationSchema).vacation));
  };

  remove = async (req: Request, res: Response) => {
    await this.users.delete(actorOf(req).id, params(req, idParamSchema).id);
    res.status(204).end();
  };
}
