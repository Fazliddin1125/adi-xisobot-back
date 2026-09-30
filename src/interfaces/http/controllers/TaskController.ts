import type { Request, Response } from 'express';
import type { TaskService } from '../../../application/services/TaskService.js';
import { actorOf } from '../middlewares/auth.js';
import { body, params, query } from '../middlewares/validate.js';
import {
  createTaskSchema,
  idParamSchema,
  taskCommentSchema,
  taskListQuerySchema,
  taskStatusSchema,
  updateTaskSchema,
} from '../validators/schemas.js';

export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  list = async (req: Request, res: Response) => {
    res.json(await this.tasks.list(actorOf(req), query(req, taskListQuerySchema)));
  };

  get = async (req: Request, res: Response) => {
    res.json(await this.tasks.get(actorOf(req), params(req, idParamSchema).id));
  };

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.tasks.create(actorOf(req), body(req, createTaskSchema)));
  };

  update = async (req: Request, res: Response) => {
    res.json(await this.tasks.update(actorOf(req), params(req, idParamSchema).id, body(req, updateTaskSchema)));
  };

  changeStatus = async (req: Request, res: Response) => {
    const { status, comment } = body(req, taskStatusSchema);
    res.json(await this.tasks.changeStatus(actorOf(req), params(req, idParamSchema).id, status, comment));
  };

  remove = async (req: Request, res: Response) => {
    await this.tasks.delete(actorOf(req), params(req, idParamSchema).id);
    res.status(204).end();
  };

  addComment = async (req: Request, res: Response) => {
    const { text } = body(req, taskCommentSchema);
    res.status(201).json(await this.tasks.addComment(actorOf(req), params(req, idParamSchema).id, text));
  };
}
