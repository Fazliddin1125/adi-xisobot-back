import type { Request, Response } from 'express';
import type { DepartmentService } from '../../../application/services/DepartmentService.js';
import { body, params } from '../middlewares/validate.js';
import { departmentSchema, idParamSchema } from '../validators/schemas.js';

export class DepartmentController {
  constructor(private readonly departments: DepartmentService) {}

  list = async (_req: Request, res: Response) => {
    res.json(await this.departments.list());
  };

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.departments.create(body(req, departmentSchema).name));
  };

  update = async (req: Request, res: Response) => {
    res.json(await this.departments.update(params(req, idParamSchema).id, body(req, departmentSchema).name));
  };

  remove = async (req: Request, res: Response) => {
    await this.departments.delete(params(req, idParamSchema).id);
    res.status(204).end();
  };
}
