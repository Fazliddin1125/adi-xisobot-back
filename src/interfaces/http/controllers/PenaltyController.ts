import type { Request, Response } from 'express';
import type { DisciplineService } from '../../../application/services/DisciplineService.js';
import { actorOf } from '../middlewares/auth.js';
import { params } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/schemas.js';

export class PenaltyController {
  constructor(private readonly discipline: DisciplineService) {}

  mine = async (req: Request, res: Response) => {
    res.json(await this.discipline.summary(actorOf(req).id));
  };

  ofUser = async (req: Request, res: Response) => {
    res.json(await this.discipline.summary(params(req, idParamSchema).id));
  };

  /** userId → jami ball (rahbarlar uchun xodimlar ro'yxatida) */
  totals = async (_req: Request, res: Response) => {
    res.json(await this.discipline.totals());
  };

  /** Rahbar: hammaga (yoki faqat bugun yozmaganlarga) "ishlarni botga yozing" eslatmasi */
  remind = async (req: Request, res: Response) => {
    const onlyIdle = req.body?.onlyIdle === true;
    res.json(await this.discipline.broadcastReminder(actorOf(req).id, onlyIdle));
  };

  remove = async (req: Request, res: Response) => {
    await this.discipline.remove(params(req, idParamSchema).id);
    res.status(204).end();
  };
}
