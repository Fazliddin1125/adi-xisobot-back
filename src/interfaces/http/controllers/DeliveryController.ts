import type { Request, Response } from 'express';
import type { BotDeliveryService } from '../../../application/services/BotDeliveryService.js';

export class DeliveryController {
  constructor(private readonly delivery: BotDeliveryService) {}

  /** Superadmin: bot oxirgi yuborgan xabarlar — kimga yetib bordi, kimga bormadi */
  list = async (_req: Request, res: Response) => {
    res.json(await this.delivery.listRecent(60));
  };
}
