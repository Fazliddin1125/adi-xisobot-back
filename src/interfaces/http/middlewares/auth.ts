import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../domain/errors/AppError.js';
import type { Role } from '../../../domain/entities/User.js';
import type { TokenService } from '../../../application/ports/TokenService.js';
import type { UserRepository } from '../../../domain/repositories/UserRepository.js';
import type { Actor } from '../../../application/Actor.js';

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

export function requireAuth(tokens: TokenService, users: UserRepository) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw AppError.unauthorized();
    const payload = tokens.verify(token);
    // Rol/bo'lim o'zgargan yoki xodim o'chirilgan bo'lsa, bazadagi holat amal qiladi
    const user = await users.findById(payload.sub);
    if (!user) throw AppError.unauthorized('Foydalanuvchi topilmadi');
    req.actor = { id: user.id, role: user.role, departmentId: user.departmentId };
    next();
  };
}

export function requireRole(roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor || !roles.includes(req.actor.role)) throw AppError.forbidden();
    next();
  };
}

export function actorOf(req: Request): Actor {
  if (!req.actor) throw AppError.unauthorized();
  return req.actor;
}
