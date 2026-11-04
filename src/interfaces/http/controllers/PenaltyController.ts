import type { Request, Response } from 'express';
import type { DisciplineService } from '../../../application/services/DisciplineService.js';
import { actorOf } from '../middlewares/auth.js';
import { body, params } from '../middlewares/validate.js';
import { idParamSchema, remindSchema } from '../validators/schemas.js';

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
    const { onlyIdle, kind, text } = body(req, remindSchema);
    res.json(await this.discipline.broadcastReminder(actorOf(req).id, onlyIdle, kind, text));
  };

  remove = async (req: Request, res: Response) => {
    await this.discipline.remove(params(req, idParamSchema).id);
    res.status(204).end();
  };
}
