import type { Request, Response } from 'express';
import type { SettingsService } from '../../../application/services/SettingsService.js';
import { body } from '../middlewares/validate.js';
import { settingsSchema } from '../validators/schemas.js';

export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  get = async (_req: Request, res: Response) => {
    res.json(await this.settings.get());
  };

  update = async (req: Request, res: Response) => {
    res.json(await this.settings.update(body(req, settingsSchema)));
  };
}
