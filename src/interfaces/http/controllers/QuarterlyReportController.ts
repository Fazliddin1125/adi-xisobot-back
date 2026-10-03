import type { Request, Response } from 'express';
import type { QuarterlyReportService } from '../../../application/services/QuarterlyReportService.js';
import { actorOf } from '../middlewares/auth.js';
import { body, params, query } from '../middlewares/validate.js';
import { idParamSchema, quarterlyQuerySchema, quarterlyUpdateSchema } from '../validators/schemas.js';

export class QuarterlyReportController {
  constructor(private readonly reports: QuarterlyReportService) {}

  aiStatus = async (req: Request, res: Response) => {
    res.json(await this.reports.aiStatus(actorOf(req)));
  };

  get = async (req: Request, res: Response) => {
    const { departmentId, year, quarter } = query(req, quarterlyQuerySchema);
    res.json(await this.reports.get(departmentId, year, quarter));
  };

  generate = async (req: Request, res: Response) => {
    const { departmentId, year, quarter } = body(req, quarterlyQuerySchema);
    res.status(202).json(await this.reports.generate(actorOf(req), departmentId, year, quarter));
  };

  update = async (req: Request, res: Response) => {
    res.json(await this.reports.update(params(req, idParamSchema).id, body(req, quarterlyUpdateSchema)));
  };

  docx = async (req: Request, res: Response) => {
    const { filename, buffer } = await this.reports.docx(params(req, idParamSchema).id);
    res
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .send(buffer);
  };
}
