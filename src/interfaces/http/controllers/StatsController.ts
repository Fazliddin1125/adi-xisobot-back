import type { Request, Response } from 'express';
import type { StatsService } from '../../../application/services/StatsService.js';
import type { ExportService } from '../../../application/services/ExportService.js';
import { actorOf } from '../middlewares/auth.js';
import { query } from '../middlewares/validate.js';
import { periodQuerySchema } from '../validators/schemas.js';

export class StatsController {
  constructor(
    private readonly stats: StatsService,
    private readonly exporter: ExportService,
  ) {}

  summary = async (req: Request, res: Response) => {
    res.json(await this.stats.summary(actorOf(req)));
  };

  details = async (req: Request, res: Response) => {
    res.json(await this.stats.details(actorOf(req), query(req, periodQuerySchema)));
  };

  perStaff = async (req: Request, res: Response) => {
    res.json(await this.stats.perStaff(query(req, periodQuerySchema)));
  };

  exportXlsx = async (req: Request, res: Response) => {
    const { filename, buffer } = await this.exporter.appealsXlsx(actorOf(req), query(req, periodQuerySchema));
    res
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  };
}
