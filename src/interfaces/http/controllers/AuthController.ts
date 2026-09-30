import type { Request, Response } from 'express';
import type { AuthService } from '../../../application/services/AuthService.js';
import { actorOf } from '../middlewares/auth.js';
import { body } from '../middlewares/validate.js';
import { changePasswordSchema, loginSchema } from '../validators/schemas.js';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  login = async (req: Request, res: Response) => {
    const { username, password } = body(req, loginSchema);
    res.json(await this.auth.login(username, password));
  };

  me = async (req: Request, res: Response) => {
    res.json(await this.auth.me(actorOf(req).id));
  };

  changePassword = async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = body(req, changePasswordSchema);
    await this.auth.changePassword(actorOf(req).id, currentPassword, newPassword);
    res.status(204).end();
  };
}
