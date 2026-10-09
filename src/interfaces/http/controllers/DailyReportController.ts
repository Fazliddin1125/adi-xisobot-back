import type { Request, Response } from 'express';
import type { DailyReportService } from '../../../application/services/DailyReportService.js';
import { actorOf } from '../middlewares/auth.js';

export class DailyReportController {
  constructor(private readonly reports: DailyReportService) {}

  /** Bugungi hisobot (hozirgi holat bo'yicha) */
  preview = async (_req: Request, res: Response) => {
    res.json(await this.reports.build());
  };

  sendTest = async (req: Request, res: Response) => {
    await this.reports.sendTest(actorOf(req).id);
    res.status(204).end();
  };
}
